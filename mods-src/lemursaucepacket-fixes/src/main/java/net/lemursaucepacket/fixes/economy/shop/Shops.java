package net.lemursaucepacket.fixes.economy.shop;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.economy.Coins;
import net.lemursaucepacket.fixes.economy.EconomyContent;
import net.lemursaucepacket.fixes.economy.EconomyModule;
import net.lemursaucepacket.fixes.economy.ItemValues;
import net.lemursaucepacket.fixes.economy.npc.NpcBook;
import net.lemursaucepacket.fixes.economy.npc.NpcBook.Npc;
import net.lemursaucepacket.fixes.economy.npc.NpcInteractions;
import net.minecraft.ChatFormatting;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Unit;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.SimpleMenuProvider;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.ClickType;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.Rarity;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.level.ItemLike;

/**
 * Vendors' shops, Hypixel style. The goods sit in a bordered grid (click to buy one lot, shift-click for a stack); the
 * bottom row has the purse, a button back to the vendor's dialog, the buyback slot (the last things sold), the vendor's
 * quests (the "2 for 1": where you are in anything this vendor is part of) and close. Clicking an item in your own
 * inventory sells it, shift-click sells every stack like it, and anything worth a lot asks for a second click first.
 */
public final class Shops {
    private static final int MAX_GOODS = 28;
    private static final int BUYBACK = 5;
    private static final long CONFIRM_MS = 4000;

    /** One sale that can be bought back: the stacks and what was paid. */
    private record Sold(List<ItemStack> stacks, long paid) {
    }

    /** Remembered per player while the server runs, so buyback survives closing and reopening a shop. */
    private static final Map<java.util.UUID, Deque<Sold>> BUYBACKS = new HashMap<>();

    public static void open(ServerPlayer player, Entity npcEntity, Npc npc) {
        NpcBook.Shop shop = npc.shop();
        if (shop == null) return;
        int goods = Math.min(MAX_GOODS, shop.goods().size());
        int rows = Math.max(1, (goods + 6) / 7) + 2;
        SimpleContainer container = new SimpleContainer(rows * 9);
        Session session = new Session(player, npcEntity, npc, container, rows);
        session.layout();
        player.openMenu(new SimpleMenuProvider((id, inventory, p) -> {
            session.menu = new ShopMenu(id, inventory, container, rows, session);
            return session.menu;
        }, Component.literal(npc.name())), buf -> buf.writeVarInt(rows));
    }

    static final class Session {
        final ServerPlayer player;
        final Entity npcEntity;
        final Npc npc;
        final SimpleContainer container;
        final int rows;
        ShopMenu menu;
        boolean closed;
        private final int[] goodAt;
        private int confirmSlot = -1;
        private boolean confirmShift;
        private ItemStack confirmStack = ItemStack.EMPTY;
        private long confirmUntil;

        Session(ServerPlayer player, Entity npcEntity, Npc npc, SimpleContainer container, int rows) {
            this.player = player;
            this.npcEntity = npcEntity;
            this.npc = npc;
            this.container = container;
            this.rows = rows;
            this.goodAt = new int[rows * 9];
            java.util.Arrays.fill(goodAt, -1);
        }

        private int bar() {
            return (rows - 1) * 9;
        }

        void layout() {
            for (int i = 0; i < container.getContainerSize(); i++) container.setItem(i, pane());
            List<NpcBook.Good> goods = npc.shop().goods();
            for (int i = 0; i < Math.min(MAX_GOODS, goods.size()); i++) {
                int slot = (1 + i / 7) * 9 + 1 + i % 7;
                goodAt[slot] = i;
                ItemStack shown = goods.get(i).item().copy();
                shown.set(EconomyContent.SHOP_COST.get(), goods.get(i).price());
                container.setItem(slot, shown);
            }
            refreshBar();
        }

        void refreshBar() {
            int bar = bar();
            long purse = Coins.purse(player);
            ItemStack purseIcon = purse > 0 ? Coins.stack(purse) : new ItemStack(Items.GOLD_NUGGET);
            container.setItem(bar, button(purseIcon, Component.literal("Purse").withStyle(ChatFormatting.GOLD), List.of(
                    Coins.text(purse),
                    Component.empty(),
                    gray("Coins in your inventory. Vendors"),
                    gray("take them and pay in them."))));
            container.setItem(bar + 2, button(new ItemStack(Items.OAK_SIGN), Component.literal("Talk to " + npc.name()).withStyle(ChatFormatting.GREEN), List.of(
                    gray("Hear what " + firstName() + " has to say."),
                    Component.empty(),
                    Component.literal("Click to talk!").withStyle(ChatFormatting.YELLOW))));
            container.setItem(bar + 4, buybackIcon());
            if (!npc.quests().isEmpty()) container.setItem(bar + 6, questIcon());
            container.setItem(bar + 8, button(new ItemStack(Items.BARRIER), Component.literal("Close").withStyle(ChatFormatting.RED), List.of()));
        }

        private String firstName() {
            String n = npc.name();
            int space = n.indexOf(' ');
            return space > 0 && !n.startsWith("Mayor") && !n.startsWith("Sister") ? n.substring(0, space) : n;
        }

        private ItemStack buybackIcon() {
            Deque<Sold> sold = BUYBACKS.get(player.getUUID());
            if (sold == null || sold.isEmpty()) {
                return button(new ItemStack(Items.HOPPER), Component.literal("Sell Item").withStyle(ChatFormatting.GREEN), List.of(
                        gray("Click items in your inventory to"),
                        gray("sell them to " + firstName() + "."),
                        Component.empty(),
                        gray("Shift-click sells every stack of it."),
                        gray("Every vendor buys everything.")));
            }
            Sold last = sold.peek();
            ItemStack first = last.stacks().get(0);
            int count = last.stacks().stream().mapToInt(ItemStack::getCount).sum();
            ItemStack icon = first.copyWithCount(Math.min(first.getMaxStackSize(), count));
            List<Component> lore = new ArrayList<>();
            lore.add(gray("You sold " + count + "x " + first.getHoverName().getString() + "."));
            lore.add(Component.empty());
            lore.add(gray("Cost"));
            lore.add(Coins.text(last.paid()));
            lore.add(Component.empty());
            lore.add(Component.literal("Click to buy back!").withStyle(ChatFormatting.YELLOW));
            ItemStack shown = icon.copy();
            shown.set(DataComponents.LORE, new ItemLore(plain(lore)));
            shown.set(DataComponents.CUSTOM_NAME, Component.literal("Buyback: ").withStyle(s -> s.withItalic(false).withColor(ChatFormatting.GREEN)).append(first.getHoverName().copy().withStyle(s -> s.withItalic(false))));
            shown.set(DataComponents.HIDE_ADDITIONAL_TOOLTIP, Unit.INSTANCE);
            shown.set(EconomyContent.DISPLAY.get(), Unit.INSTANCE);
            return shown;
        }

        private ItemStack questIcon() {
            var tags = player.getTags();
            List<Component> lore = new ArrayList<>();
            boolean anyOpen = false;
            for (NpcBook.QuestLine q : npc.quests()) {
                if (!lore.isEmpty()) lore.add(Component.empty());
                int done = 0;
                for (NpcBook.Step s : q.steps()) if (tags.contains(s.stage())) done++;
                if (done == q.steps().size()) {
                    lore.add(Component.literal("✔ " + q.title()).withStyle(ChatFormatting.GREEN));
                    lore.add(gray("Complete."));
                    continue;
                }
                if (done == 0) {
                    lore.add(Component.literal(q.title()).withStyle(ChatFormatting.GRAY));
                    lore.add(Component.literal("Not started: " + q.steps().get(0).text()).withStyle(ChatFormatting.DARK_GRAY));
                    continue;
                }
                anyOpen = true;
                lore.add(Component.literal(q.title()).withStyle(ChatFormatting.YELLOW));
                boolean current = false;
                for (NpcBook.Step s : q.steps()) {
                    if (tags.contains(s.stage())) lore.add(Component.literal("✔ ").withStyle(ChatFormatting.GREEN).append(Component.literal(s.text()).withStyle(ChatFormatting.DARK_GRAY, ChatFormatting.STRIKETHROUGH)));
                    else if (!current) {
                        lore.add(Component.literal("➜ ").withStyle(ChatFormatting.YELLOW).append(Component.literal(s.text()).withStyle(ChatFormatting.WHITE)));
                        current = true;
                    }
                }
            }
            return button(new ItemStack(anyOpen ? Items.WRITABLE_BOOK : Items.BOOK), Component.literal("Quests").withStyle(ChatFormatting.GOLD), lore);
        }

        // ---------------------------------------------------------------- clicks

        void click(int slotId, int button, ClickType type) {
            if (closed || slotId < 0 || slotId >= menu.slots.size()) return;
            if (type != ClickType.PICKUP && type != ClickType.QUICK_MOVE) return;
            boolean shift = type == ClickType.QUICK_MOVE;
            try {
                if (slotId < rows * 9) {
                    int bar = bar();
                    if (goodAt[slotId] >= 0) buy(goodAt[slotId], shift);
                    else if (slotId == bar + 2) {
                        NpcInteractions.openDialog(player, npcEntity, null);
                        return;
                    } else if (slotId == bar + 4) buyBack();
                    else if (slotId == bar + 8) {
                        player.closeContainer();
                        return;
                    } else return;
                } else sell(menu.getSlot(slotId), shift);
            } catch (Exception e) {
                EconomyModule.LOGGER.error("Shop click failed for {}", player.getGameProfile().getName(), e);
            }
            refreshBar();
            menu.broadcastChanges();
        }

        private void buy(int index, boolean shift) {
            NpcBook.Good good = npc.shop().goods().get(index);
            ItemStack item = good.item();
            int lots = shift ? Math.max(1, item.getMaxStackSize() / Math.max(1, item.getCount())) : 1;
            long cost = good.price() * lots;
            long purse = Coins.purse(player);
            if (purse < cost) {
                deny(Component.literal("You don't have enough coins! You need ").withStyle(ChatFormatting.RED).append(Coins.text(cost - purse)).append(Component.literal(" more.").withStyle(ChatFormatting.RED)));
                return;
            }
            Coins.take(player, cost);
            int total = item.getCount() * lots;
            while (total > 0) {
                int n = Math.min(total, item.getMaxStackSize());
                ItemStack give = item.copyWithCount(n);
                if (!player.getInventory().add(give)) player.drop(give, false);
                total -= n;
            }
            player.addTag("econ_bought");
            for (String command : npc.shop().onBuy()) run(player.getServer(), command.replace("{player}", player.getGameProfile().getName()));
            player.sendSystemMessage(Component.literal("You bought ").withStyle(ChatFormatting.GREEN)
                    .append(item.getHoverName().copy().withStyle(ChatFormatting.WHITE))
                    .append(Component.literal(" x" + item.getCount() * lots).withStyle(ChatFormatting.DARK_GRAY))
                    .append(Component.literal(" for ").withStyle(ChatFormatting.GREEN))
                    .append(Coins.text(cost))
                    .append(Component.literal("!").withStyle(ChatFormatting.GREEN)));
            player.playNotifySound(SoundEvents.NOTE_BLOCK_PLING.value(), SoundSource.PLAYERS, 0.6f, 1.5f);
            EconomyModule.LOGGER.info("{} bought {}x {} from {} for {}", player.getGameProfile().getName(), item.getCount() * lots, item.getItem(), npc.id(), cost);
        }

        private void sell(Slot slot, boolean shift) {
            if (!(slot.container instanceof Inventory inventory) || inventory.player != player) return;
            ItemStack stack = slot.getItem();
            if (stack.isEmpty()) return;
            String why = ItemValues.refusal(stack);
            if (why != null) {
                deny(Component.literal(why).withStyle(ChatFormatting.RED));
                return;
            }
            List<Integer> from = new ArrayList<>();
            if (shift) {
                for (int i = 0; i < inventory.getContainerSize(); i++) {
                    ItemStack s = inventory.getItem(i);
                    if (ItemStack.isSameItemSameComponents(s, stack) && ItemValues.refusal(s) == null) from.add(i);
                }
            } else from.add(slot.getContainerSlot());
            double worth = 0;
            int count = 0;
            for (int i : from) {
                worth += ItemValues.worth(inventory.getItem(i));
                count += inventory.getItem(i).getCount();
            }
            long pay = (long) Math.floor(worth + 1e-9);
            if (pay < 1) {
                deny(Component.literal("That's worth less than a coin. Sell more at once.").withStyle(ChatFormatting.RED));
                return;
            }
            if (precious(stack, pay) && !(confirmSlot == slot.index && confirmShift == shift && ItemStack.matches(confirmStack, stack) && System.currentTimeMillis() < confirmUntil)) {
                confirmSlot = slot.index;
                confirmShift = shift;
                confirmStack = stack.copy();
                confirmUntil = System.currentTimeMillis() + CONFIRM_MS;
                player.sendSystemMessage(Component.literal("Click again to sell ").withStyle(ChatFormatting.YELLOW)
                        .append(Component.literal(count + "x ").withStyle(ChatFormatting.WHITE)).append(stack.getHoverName())
                        .append(Component.literal(" for ").withStyle(ChatFormatting.YELLOW)).append(Coins.text(pay)).append(Component.literal(".").withStyle(ChatFormatting.YELLOW)));
                player.playNotifySound(SoundEvents.NOTE_BLOCK_HAT.value(), SoundSource.PLAYERS, 0.6f, 1.2f);
                return;
            }
            confirmSlot = -1;
            List<ItemStack> taken = new ArrayList<>();
            for (int i : from) {
                taken.add(inventory.getItem(i).copy());
                inventory.setItem(i, ItemStack.EMPTY);
            }
            inventory.setChanged();
            Coins.give(player, pay);
            Deque<Sold> sold = BUYBACKS.computeIfAbsent(player.getUUID(), k -> new ArrayDeque<>());
            sold.push(new Sold(taken, pay));
            while (sold.size() > BUYBACK) sold.removeLast();
            player.addTag("econ_sold");
            player.sendSystemMessage(Component.literal("You sold ").withStyle(ChatFormatting.GREEN)
                    .append(stack.getHoverName().copy().withStyle(ChatFormatting.WHITE))
                    .append(Component.literal(" x" + count).withStyle(ChatFormatting.DARK_GRAY))
                    .append(Component.literal(" for ").withStyle(ChatFormatting.GREEN))
                    .append(Coins.text(pay))
                    .append(Component.literal("!").withStyle(ChatFormatting.GREEN)));
            player.playNotifySound(SoundEvents.EXPERIENCE_ORB_PICKUP, SoundSource.PLAYERS, 0.5f, 1.4f);
            EconomyModule.LOGGER.info("{} sold {}x {} to {} for {}", player.getGameProfile().getName(), count, stack.getItem(), npc.id(), pay);
        }

        /** Worth a second click: a big sale, or something enchanted, named or rare. */
        private static boolean precious(ItemStack stack, long pay) {
            return pay >= 1000 || stack.isEnchanted() || stack.has(DataComponents.STORED_ENCHANTMENTS) || stack.has(DataComponents.CUSTOM_NAME)
                    || stack.getRarity().ordinal() >= Rarity.RARE.ordinal();
        }

        private void buyBack() {
            Deque<Sold> sold = BUYBACKS.get(player.getUUID());
            if (sold == null || sold.isEmpty()) return;
            Sold last = sold.peek();
            long purse = Coins.purse(player);
            if (purse < last.paid()) {
                deny(Component.literal("You need ").withStyle(ChatFormatting.RED).append(Coins.text(last.paid() - purse)).append(Component.literal(" more to buy that back.").withStyle(ChatFormatting.RED)));
                return;
            }
            sold.pop();
            Coins.take(player, last.paid());
            for (ItemStack s : last.stacks()) {
                ItemStack give = s.copy();
                if (!player.getInventory().add(give)) player.drop(give, false);
            }
            player.sendSystemMessage(Component.literal("You bought back ").withStyle(ChatFormatting.GREEN).append(last.stacks().get(0).getHoverName()).append(Component.literal(" for ").withStyle(ChatFormatting.GREEN)).append(Coins.text(last.paid())).append(Component.literal("!").withStyle(ChatFormatting.GREEN)));
            player.playNotifySound(SoundEvents.NOTE_BLOCK_PLING.value(), SoundSource.PLAYERS, 0.6f, 1.5f);
        }

        private void deny(Component message) {
            player.sendSystemMessage(message);
            player.playNotifySound(SoundEvents.VILLAGER_NO, SoundSource.PLAYERS, 0.6f, 1.0f);
        }

        boolean stillValid() {
            return !closed && npcEntity.isAlive() && npcEntity.level() == player.level() && player.distanceToSqr(npcEntity) < 12 * 12;
        }

        void closed() {
            closed = true;
        }
    }

    // ---------------------------------------------------------------- display stacks

    static ItemStack pane() {
        ItemStack pane = new ItemStack(Items.BLACK_STAINED_GLASS_PANE);
        pane.set(DataComponents.HIDE_TOOLTIP, Unit.INSTANCE);
        pane.set(EconomyContent.DISPLAY.get(), Unit.INSTANCE);
        return pane;
    }

    static ItemStack button(ItemStack icon, Component name, List<Component> lore) {
        ItemStack s = icon.copy();
        s.set(DataComponents.CUSTOM_NAME, name.copy().withStyle(st -> st.withItalic(false)));
        s.set(DataComponents.LORE, new ItemLore(plain(lore)));
        s.set(DataComponents.HIDE_ADDITIONAL_TOOLTIP, Unit.INSTANCE);
        s.set(EconomyContent.DISPLAY.get(), Unit.INSTANCE);
        return s;
    }

    static ItemStack button(ItemLike item, Component name, List<Component> lore) {
        return button(new ItemStack(item), name, lore);
    }

    private static List<Component> plain(List<Component> lines) {
        List<Component> out = new ArrayList<>();
        for (Component c : lines) out.add(c.copy().withStyle(st -> st.withItalic(false)));
        return out;
    }

    static MutableComponent gray(String text) {
        return Component.literal(text).withStyle(ChatFormatting.GRAY);
    }

    private static void run(@Nullable MinecraftServer server, String command) {
        if (server == null) return;
        try {
            server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput().withPermission(4), command);
        } catch (Exception e) {
            EconomyModule.LOGGER.warn("Shop command '{}' failed: {}", command, e.toString());
        }
    }

    public static void forget(java.util.UUID player) {
        BUYBACKS.remove(player);
    }

    private Shops() {
    }
}
