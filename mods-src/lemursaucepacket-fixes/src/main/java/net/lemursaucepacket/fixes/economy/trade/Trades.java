package net.lemursaucepacket.fixes.economy.trade;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.economy.Coins;
import net.lemursaucepacket.fixes.economy.EconomyContent;
import net.lemursaucepacket.fixes.economy.EconomyModule;
import net.lemursaucepacket.fixes.economy.EconomyNet;
import net.minecraft.ChatFormatting;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Unit;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.ClickType;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * Player-to-player trading, Hypixel style. {@code /trade <player>} (or sneak + right-click them) sends a request; when the
 * other one asks back, both get the trade window: your offer on the left (click items in your inventory to put them up,
 * click them again to take them back), theirs on the right, coins through the gold button. Any change resets both
 * acceptances and starts a short deal timer, so nothing can be swapped at the last second. When both accept, the offers
 * change hands; closing, leaving, dying or walking off gives everything back.
 */
public final class Trades {
    private static final long REQUEST_MS = 60_000;
    private static final long DEAL_TIMER_MS = 3_000;
    private static final double START_RANGE = 24;
    private static final double KEEP_RANGE = 64;
    private static final int OFFER_SLOTS = 16;
    private static final int COINS_SLOT = 36;
    private static final int THEIR_COINS_SLOT = 41;
    private static final int ACCEPT_SLOT = 47;
    private static final int CANCEL_SLOT = 49;
    private static final int STATUS_SLOT = 51;

    private record Request(UUID from, UUID to, long until) {
    }

    private static final List<Request> REQUESTS = new ArrayList<>();
    private static final Map<UUID, Session> SESSIONS = new HashMap<>();

    // ---------------------------------------------------------------- requests

    public static void request(ServerPlayer from, ServerPlayer to) {
        long now = System.currentTimeMillis();
        REQUESTS.removeIf(r -> r.until() < now);
        if (from == to) {
            from.sendSystemMessage(Component.literal("You can't trade with yourself.").withStyle(ChatFormatting.RED));
            return;
        }
        if (SESSIONS.containsKey(from.getUUID())) {
            from.sendSystemMessage(Component.literal("You're already trading.").withStyle(ChatFormatting.RED));
            return;
        }
        if (SESSIONS.containsKey(to.getUUID())) {
            from.sendSystemMessage(Component.literal(to.getGameProfile().getName() + " is busy trading.").withStyle(ChatFormatting.RED));
            return;
        }
        if (from.level() != to.level() || from.distanceTo(to) > START_RANGE) {
            from.sendSystemMessage(Component.literal("You need to be closer to " + to.getGameProfile().getName() + " to trade.").withStyle(ChatFormatting.RED));
            return;
        }
        boolean asked = REQUESTS.removeIf(r -> r.from().equals(to.getUUID()) && r.to().equals(from.getUUID()));
        if (asked) {
            start(to, from);
            return;
        }
        if (REQUESTS.stream().anyMatch(r -> r.from().equals(from.getUUID()) && r.to().equals(to.getUUID()))) {
            from.sendSystemMessage(Component.literal("You already asked " + to.getGameProfile().getName() + " to trade.").withStyle(ChatFormatting.GRAY));
            return;
        }
        REQUESTS.add(new Request(from.getUUID(), to.getUUID(), now + REQUEST_MS));
        String name = from.getGameProfile().getName();
        MutableComponent button = Component.literal("[Click to trade]").withStyle(s -> s.withColor(ChatFormatting.GREEN).withBold(true)
                .withClickEvent(new ClickEvent(ClickEvent.Action.RUN_COMMAND, "/trade " + name))
                .withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, Component.literal("Trade with " + name))));
        to.sendSystemMessage(Component.literal(name).withStyle(ChatFormatting.AQUA).append(Component.literal(" wants to trade with you! ").withStyle(ChatFormatting.YELLOW)).append(button));
        to.playNotifySound(SoundEvents.NOTE_BLOCK_CHIME.value(), SoundSource.PLAYERS, 0.8f, 1.2f);
        from.sendSystemMessage(Component.literal("You asked ").withStyle(ChatFormatting.YELLOW).append(Component.literal(to.getGameProfile().getName()).withStyle(ChatFormatting.AQUA)).append(Component.literal(" to trade. It expires in 60 seconds.").withStyle(ChatFormatting.YELLOW)));
    }

    private static void start(ServerPlayer a, ServerPlayer b) {
        Session session = new Session(a, b);
        SESSIONS.put(a.getUUID(), session);
        SESSIONS.put(b.getUUID(), session);
        session.left.open();
        session.right.open();
        session.refresh();
        EconomyModule.LOGGER.info("Trade started: {} and {}", a.getGameProfile().getName(), b.getGameProfile().getName());
    }

    @Nullable
    public static Side sideOf(ServerPlayer player) {
        Session s = SESSIONS.get(player.getUUID());
        if (s == null) return null;
        return s.left.player == player ? s.left : s.right;
    }

    // ---------------------------------------------------------------- events (EconomyModule wires these)

    public static void onLogout(ServerPlayer player) {
        Session s = SESSIONS.get(player.getUUID());
        if (s != null) s.cancel(player.getGameProfile().getName() + " left.");
        REQUESTS.removeIf(r -> r.from().equals(player.getUUID()) || r.to().equals(player.getUUID()));
    }

    public static void onDeathOrTravel(ServerPlayer player, String why) {
        Session s = SESSIONS.get(player.getUUID());
        if (s != null) s.cancel(why);
    }

    /** Every half second: the deal timers, and anyone who walked off. */
    public static void tick(MinecraftServer server) {
        for (Session s : new ArrayList<>(SESSIONS.values())) {
            if (s.over) continue;
            ServerPlayer a = s.left.player;
            ServerPlayer b = s.right.player;
            if (a.level() != b.level() || a.distanceTo(b) > KEEP_RANGE) {
                s.cancel("You walked too far apart.");
                continue;
            }
            if (s.timerShowing && System.currentTimeMillis() >= s.changedAt + DEAL_TIMER_MS) s.refresh();
        }
    }

    /** The coin amount a player typed for their offer. */
    public static void setCoins(ServerPlayer player, long amount) {
        Side side = sideOf(player);
        if (side == null || side.session.over || amount < 0) return;
        long available = Coins.purse(player) + side.coins;
        if (amount > available) {
            player.sendSystemMessage(Component.literal("You only have ").withStyle(ChatFormatting.RED).append(Coins.text(available)).append(Component.literal(".").withStyle(ChatFormatting.RED)));
            amount = available;
        }
        // Hold the coins while they're on offer, so they can't be spent elsewhere meanwhile.
        if (side.coins > 0) Coins.give(player, side.coins);
        side.coins = 0;
        if (amount > 0 && Coins.take(player, amount)) side.coins = amount;
        side.session.changed();
    }

    // ---------------------------------------------------------------- a trade

    static final class Session {
        final Side left;
        final Side right;
        boolean over;
        long changedAt = System.currentTimeMillis();
        boolean timerShowing = true;

        Session(ServerPlayer a, ServerPlayer b) {
            left = new Side(this, a);
            right = new Side(this, b);
        }

        Side other(Side side) {
            return side == left ? right : left;
        }

        /** An offer changed: nobody has accepted this version yet. */
        void changed() {
            left.accepted = false;
            right.accepted = false;
            changedAt = System.currentTimeMillis();
            refresh();
        }

        void refresh() {
            timerShowing = System.currentTimeMillis() < changedAt + DEAL_TIMER_MS;
            left.draw();
            right.draw();
        }

        void cancel(String why) {
            if (over) return;
            over = true;
            SESSIONS.remove(left.player.getUUID());
            SESSIONS.remove(right.player.getUUID());
            left.giveBack();
            right.giveBack();
            for (Side s : new Side[] {left, right}) {
                s.player.sendSystemMessage(Component.literal("Trade cancelled. ").withStyle(ChatFormatting.RED).append(Component.literal(why).withStyle(ChatFormatting.GRAY)));
                if (s.player.containerMenu == s.menu) s.player.closeContainer();
            }
            EconomyModule.LOGGER.info("Trade between {} and {} cancelled: {}", left.player.getGameProfile().getName(), right.player.getGameProfile().getName(), why);
        }

        void complete() {
            if (over) return;
            for (Side s : new Side[] {left, right}) {
                Side o = other(s);
                if (o.stacks() > freeSlots(s.player)) {
                    s.player.sendSystemMessage(Component.literal("You don't have room for everything on offer.").withStyle(ChatFormatting.RED));
                    o.player.sendSystemMessage(Component.literal(s.player.getGameProfile().getName() + " doesn't have room for your offer.").withStyle(ChatFormatting.RED));
                    left.accepted = false;
                    right.accepted = false;
                    refresh();
                    return;
                }
            }
            over = true;
            SESSIONS.remove(left.player.getUUID());
            SESSIONS.remove(right.player.getUUID());
            List<ItemStack> fromLeft = left.takeOffer();
            List<ItemStack> fromRight = right.takeOffer();
            long leftCoins = left.coins;
            long rightCoins = right.coins;
            left.coins = 0;
            right.coins = 0;
            receive(right.player, fromLeft, leftCoins);
            receive(left.player, fromRight, rightCoins);
            for (Side s : new Side[] {left, right}) {
                s.player.addTag("econ_traded");
                s.player.sendSystemMessage(Component.literal("Trade completed with ").withStyle(ChatFormatting.GREEN).append(Component.literal(other(s).player.getGameProfile().getName()).withStyle(ChatFormatting.AQUA)).append(Component.literal("!").withStyle(ChatFormatting.GREEN)));
                s.player.playNotifySound(SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 0.6f, 1.4f);
                if (s.player.containerMenu == s.menu) s.player.closeContainer();
            }
            EconomyModule.LOGGER.info("Trade: {} gave {} + {} coins; {} gave {} + {} coins", left.player.getGameProfile().getName(), describe(fromLeft), leftCoins, right.player.getGameProfile().getName(), describe(fromRight), rightCoins);
        }

        private static void receive(ServerPlayer player, List<ItemStack> stacks, long coins) {
            for (ItemStack s : stacks) if (!player.getInventory().add(s)) player.drop(s, false);
            if (coins > 0) Coins.give(player, coins);
        }

        private static int freeSlots(ServerPlayer player) {
            int free = 0;
            for (int i = 0; i < player.getInventory().items.size(); i++) if (player.getInventory().items.get(i).isEmpty()) free++;
            return free;
        }

        private static String describe(List<ItemStack> stacks) {
            StringBuilder b = new StringBuilder();
            for (ItemStack s : stacks) b.append(b.length() == 0 ? "" : ", ").append(s.getCount()).append("x ").append(s.getItem());
            return b.length() == 0 ? "nothing" : b.toString();
        }
    }

    /** One player's half: their window, their offer, their coins and whether they've accepted. */
    public static final class Side {
        final Session session;
        final ServerPlayer player;
        final SimpleContainer container = new SimpleContainer(54);
        final ItemStack[] offer = new ItemStack[OFFER_SLOTS];
        long coins;
        boolean accepted;
        TradeMenu menu;

        Side(Session session, ServerPlayer player) {
            this.session = session;
            this.player = player;
            java.util.Arrays.fill(offer, ItemStack.EMPTY);
        }

        void open() {
            Side other = session.other(this);
            player.openMenu(new SimpleMenuProvider((id, inventory, p) -> {
                menu = new TradeMenu(id, inventory, container, this);
                return menu;
            }, Component.literal("You                  " + other.player.getGameProfile().getName())));
        }

        int stacks() {
            int n = 0;
            for (ItemStack s : offer) if (!s.isEmpty()) n++;
            if (coins > 0) n++;
            return n;
        }

        List<ItemStack> takeOffer() {
            List<ItemStack> out = new ArrayList<>();
            for (int i = 0; i < OFFER_SLOTS; i++) {
                if (!offer[i].isEmpty()) out.add(offer[i]);
                offer[i] = ItemStack.EMPTY;
            }
            return out;
        }

        void giveBack() {
            for (ItemStack s : takeOffer()) if (!player.getInventory().add(s)) player.drop(s, false);
            if (coins > 0) Coins.give(player, coins);
            coins = 0;
        }

        private static int mine(int i) {
            return (i / 4) * 9 + i % 4;
        }

        private static int theirs(int i) {
            return (i / 4) * 9 + 5 + i % 4;
        }

        void draw() {
            Side other = session.other(this);
            for (int i = 0; i < 54; i++) container.setItem(i, pane());
            for (int i = 0; i < OFFER_SLOTS; i++) {
                container.setItem(mine(i), offer[i].copy());
                container.setItem(theirs(i), other.offer[i].copy());
            }
            for (int r = 0; r < 6; r++) container.setItem(r * 9 + 4, divider());
            container.setItem(COINS_SLOT, coinButton(coins, true, other.player.getGameProfile().getName()));
            container.setItem(THEIR_COINS_SLOT, coinButton(other.coins, false, other.player.getGameProfile().getName()));
            container.setItem(ACCEPT_SLOT, acceptButton(other));
            container.setItem(CANCEL_SLOT, button(Items.BARRIER, Component.literal("Cancel trade").withStyle(ChatFormatting.RED), List.of(gray("Everything goes back to its owner."))));
            container.setItem(STATUS_SLOT, other.accepted
                    ? button(Items.LIME_DYE, Component.literal(other.player.getGameProfile().getName() + " accepted").withStyle(ChatFormatting.GREEN), List.of(gray("They're happy with this deal.")))
                    : button(Items.GRAY_DYE, Component.literal(other.player.getGameProfile().getName() + " hasn't accepted").withStyle(ChatFormatting.GRAY), List.of(gray("Waiting for them..."))));
            if (menu != null) menu.broadcastChanges();
        }

        private ItemStack acceptButton(Side other) {
            if (session.timerShowing) {
                long left = Math.max(1, (session.changedAt + DEAL_TIMER_MS - System.currentTimeMillis() + 999) / 1000);
                return button(Items.CLOCK, Component.literal("Deal timer").withStyle(ChatFormatting.YELLOW), List.of(gray("The deal changed. You can"), gray("accept in " + left + "s.")));
            }
            if (accepted) return button(Items.LIME_STAINED_GLASS, Component.literal("Deal accepted!").withStyle(ChatFormatting.GREEN),
                    List.of(gray("Waiting for " + other.player.getGameProfile().getName() + "."), Component.empty(), Component.literal("Click to take it back.").withStyle(ChatFormatting.YELLOW)));
            return button(Items.LIME_TERRACOTTA, Component.literal("Accept trade").withStyle(ChatFormatting.GREEN), List.of(
                    gray("You give what's on the left,"),
                    gray("you get what's on the right."),
                    Component.empty(),
                    Component.literal("Click to accept!").withStyle(ChatFormatting.YELLOW)));
        }

        private static ItemStack coinButton(long coins, boolean yours, String them) {
            ItemStack icon = coins > 0 ? Coins.stack(coins) : new ItemStack(Items.GOLD_NUGGET);
            if (yours) return button(icon, Component.literal("Your coins").withStyle(ChatFormatting.GOLD), List.of(
                    coins > 0 ? Coins.text(coins) : gray("None on offer."),
                    Component.empty(),
                    Component.literal("Click to set an amount.").withStyle(ChatFormatting.YELLOW),
                    Component.literal("Right-click to take them off.").withStyle(ChatFormatting.YELLOW)));
            return button(icon, Component.literal(them + "'s coins").withStyle(ChatFormatting.GOLD), List.of(coins > 0 ? Coins.text(coins) : gray("None on offer.")));
        }

        void click(int slotId, int button, ClickType type) {
            if (session.over || slotId < 0 || menu == null || slotId >= menu.slots.size()) return;
            if (type != ClickType.PICKUP && type != ClickType.QUICK_MOVE) return;
            try {
                if (slotId >= 54) {
                    putUp(menu.getSlot(slotId));
                    return;
                }
                for (int i = 0; i < OFFER_SLOTS; i++) {
                    if (mine(i) == slotId) {
                        takeBack(i);
                        return;
                    }
                }
                if (slotId == COINS_SLOT) {
                    if (button == 1) {
                        if (coins > 0) Trades.setCoins(player, 0);
                    } else PacketDistributor.sendToPlayer(player, new EconomyNet.OpenCoinInput(EconomyNet.PURPOSE_TRADE, Coins.purse(player) + coins, coins));
                } else if (slotId == ACCEPT_SLOT) accept();
                else if (slotId == CANCEL_SLOT) session.cancel(player.getGameProfile().getName() + " cancelled.");
            } catch (Exception e) {
                EconomyModule.LOGGER.error("Trade click failed for {}", player.getGameProfile().getName(), e);
            }
        }

        private void putUp(Slot slot) {
            if (!(slot.container instanceof Inventory inventory) || inventory.player != player) return;
            offer(slot.getContainerSlot());
        }

        /** Puts the stack in this inventory slot up for trade (what clicking it does; scripts can call it too). */
        public void offer(int inventorySlot) {
            if (session.over || inventorySlot < 0 || inventorySlot >= player.getInventory().getContainerSize()) return;
            ItemStack stack = player.getInventory().getItem(inventorySlot);
            if (stack.isEmpty()) return;
            for (int i = 0; i < OFFER_SLOTS; i++) {
                if (offer[i].isEmpty()) {
                    offer[i] = stack.copy();
                    player.getInventory().setItem(inventorySlot, ItemStack.EMPTY);
                    player.getInventory().setChanged();
                    session.changed();
                    return;
                }
            }
            player.sendSystemMessage(Component.literal("Your side of the trade is full.").withStyle(ChatFormatting.RED));
        }

        private void takeBack(int i) {
            if (offer[i].isEmpty()) return;
            ItemStack back = offer[i].copy();
            if (!player.getInventory().add(back)) {
                offer[i] = back;
                player.sendSystemMessage(Component.literal("You don't have room to take that back.").withStyle(ChatFormatting.RED));
                return;
            }
            offer[i] = ItemStack.EMPTY;
            session.changed();
        }

        /** Accepts (or takes back acceptance of) the deal as it stands; ignored while the deal timer runs. */
        public void accept() {
            if (session.over) return;
            if (session.timerShowing) {
                player.playNotifySound(SoundEvents.VILLAGER_NO, SoundSource.PLAYERS, 0.6f, 1f);
                return;
            }
            accepted = !accepted;
            if (left().accepted && right().accepted) session.complete();
            else session.refresh();
        }

        private Side left() {
            return session.left;
        }

        private Side right() {
            return session.right;
        }

        boolean stillValid() {
            return !session.over && player.isAlive();
        }

        void closed() {
            if (!session.over) session.cancel(player.getGameProfile().getName() + " closed the trade.");
        }
    }

    // ---------------------------------------------------------------- display stacks

    private static ItemStack pane() {
        ItemStack pane = new ItemStack(Items.BLACK_STAINED_GLASS_PANE);
        pane.set(DataComponents.HIDE_TOOLTIP, Unit.INSTANCE);
        pane.set(EconomyContent.DISPLAY.get(), Unit.INSTANCE);
        return pane;
    }

    private static ItemStack divider() {
        ItemStack pane = new ItemStack(Items.GRAY_STAINED_GLASS_PANE);
        pane.set(DataComponents.HIDE_TOOLTIP, Unit.INSTANCE);
        pane.set(EconomyContent.DISPLAY.get(), Unit.INSTANCE);
        return pane;
    }

    private static ItemStack button(net.minecraft.world.level.ItemLike item, Component name, List<Component> lore) {
        return button(new ItemStack(item), name, lore);
    }

    private static ItemStack button(ItemStack icon, Component name, List<Component> lore) {
        ItemStack s = icon.copy();
        s.set(DataComponents.CUSTOM_NAME, name.copy().withStyle(st -> st.withItalic(false)));
        List<Component> plain = new ArrayList<>();
        for (Component c : lore) plain.add(c.copy().withStyle(st -> st.withItalic(false)));
        s.set(DataComponents.LORE, new ItemLore(plain));
        s.set(DataComponents.HIDE_ADDITIONAL_TOOLTIP, Unit.INSTANCE);
        s.set(EconomyContent.DISPLAY.get(), Unit.INSTANCE);
        return s;
    }

    private static MutableComponent gray(String text) {
        return Component.literal(text).withStyle(ChatFormatting.GRAY);
    }

    private Trades() {
    }
}
