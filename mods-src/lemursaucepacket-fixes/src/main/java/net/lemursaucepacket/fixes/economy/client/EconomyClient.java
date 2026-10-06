package net.lemursaucepacket.fixes.economy.client;

import java.util.List;

import net.lemursaucepacket.fixes.LspFixes;
import net.lemursaucepacket.fixes.economy.Coins;
import net.lemursaucepacket.fixes.economy.EconomyContent;
import net.lemursaucepacket.fixes.economy.EconomyNet;
import net.lemursaucepacket.fixes.economy.ItemValues;
import net.lemursaucepacket.fixes.economy.shop.ShopMenu;
import net.lemursaucepacket.fixes.economy.trade.TradeMenu;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.client.gui.screens.inventory.CreativeModeInventoryScreen;
import net.minecraft.client.renderer.item.ClampedItemPropertyFunction;
import net.minecraft.client.renderer.item.ItemProperties;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.event.lifecycle.FMLClientSetupEvent;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.client.event.RegisterItemDecorationsEvent;
import net.neoforged.neoforge.client.event.RegisterMenuScreensEvent;
import net.neoforged.neoforge.client.event.ScreenEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.entity.player.ItemTooltipEvent;

/**
 * The economy on the client: the compact coin count in slots (2.3k, in RuneScape's stack colours), the coin pile that
 * grows with the amount, the shop and trade windows, the price lines in shop tooltips, and the amount box.
 */
public final class EconomyClient {
    /** Pile sizes, like RuneScape's coin icons: 1, 2, 3, 4, 5, 25, 100, 250, 1,000 and 10,000 coins. */
    private static final long[] PILES = {1, 2, 3, 4, 5, 25, 100, 250, 1000, 10000};

    public static void init(IEventBus modBus) {
        modBus.addListener(EconomyClient::onClientSetup);
        modBus.addListener(EconomyClient::onDecorators);
        modBus.addListener(EconomyClient::onScreens);
        NeoForge.EVENT_BUS.addListener(EconomyClient::onTooltip);
        NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, EconomyClient::onTooltipLast);
        NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, EconomyClient::onTooltipComponents);
        NeoForge.EVENT_BUS.addListener(EconomyClient::onMouse);
        NeoForge.EVENT_BUS.addListener((ClientPlayerNetworkEvent.LoggingOut e) -> ItemValues.install(new ItemValues.Table(java.util.Map.of(), java.util.Set.of(), 8f)));
    }

    private static void onClientSetup(FMLClientSetupEvent event) {
        event.enqueueWork(() -> ItemProperties.register(EconomyContent.GOLD_COINS.get(), ResourceLocation.fromNamespaceAndPath(LspFixes.MOD_ID, "pile"),
                (ClampedItemPropertyFunction) (stack, level, entity, seed) -> pile(Coins.value(stack)) / 10f));
    }

    static int pile(long amount) {
        int tier = 0;
        for (int i = 0; i < PILES.length; i++) if (amount >= PILES[i]) tier = i;
        return tier;
    }

    private static void onDecorators(RegisterItemDecorationsEvent event) {
        event.register(EconomyContent.GOLD_COINS.get(), EconomyClient::decorate);
    }

    /** The amount in the slot's corner where vanilla puts a count: full size up to two digits, smaller beyond. */
    private static boolean decorate(GuiGraphics graphics, Font font, ItemStack stack, int x, int y) {
        long amount = Coins.value(stack);
        if (amount <= 0) return false;
        String text = Coins.compact(amount);
        int width = font.width(text);
        float scale = text.length() <= 2 ? 1f : 0.75f;
        var pose = graphics.pose();
        pose.pushPose();
        pose.translate(x + 17, y + 17, 200);
        pose.scale(scale, scale, 1);
        graphics.drawString(font, text, -width, -8, Coins.compactColor(amount), true);
        pose.popPose();
        return false;
    }

    private static void onScreens(RegisterMenuScreensEvent event) {
        event.register(EconomyContent.SHOP_MENU.get(), ShopScreens.Shop::new);
        event.register(EconomyContent.TRADE_MENU.get(), ShopScreens.Trade::new);
    }

    // ---------------------------------------------------------------- tooltips

    private static void onTooltip(ItemTooltipEvent event) {
        ItemStack stack = event.getItemStack();
        List<Component> lines = event.getToolTip();
        Long cost = stack.get(EconomyContent.SHOP_COST.get());
        if (cost != null) {
            int lots = Math.max(1, stack.getMaxStackSize() / Math.max(1, stack.getCount()));
            lines.add(Component.empty());
            lines.add(Component.literal("Cost").withStyle(ChatFormatting.GRAY));
            lines.add(Coins.text(cost));
            lines.add(Component.empty());
            lines.add(Component.literal("Click to buy!").withStyle(ChatFormatting.YELLOW));
            if (lots > 1) lines.add(Component.literal("Shift-click to buy " + stack.getCount() * lots + " for " + Coins.exact(cost * lots) + "!").withStyle(ChatFormatting.YELLOW));
            return;
        }
        Minecraft mc = Minecraft.getInstance();
        if (!(mc.screen instanceof AbstractContainerScreen<?> screen) || !(screen.getMenu() instanceof ShopMenu menu)) return;
        Slot hovered = screen.getSlotUnderMouse();
        if (hovered == null || !menu.isPlayerSlot(hovered) || hovered.getItem() != stack) return;
        String why = ItemValues.refusal(stack);
        lines.add(Component.empty());
        if (why != null) {
            lines.add(Component.literal(why).withStyle(ChatFormatting.RED));
            return;
        }
        long pay = (long) Math.floor(ItemValues.worth(stack) + 1e-9);
        if (pay < 1) {
            lines.add(Component.literal("Worth less than a coin.").withStyle(ChatFormatting.DARK_GRAY));
            return;
        }
        lines.add(Component.literal("Sells for ").withStyle(ChatFormatting.GRAY).append(Coins.text(pay)));
        lines.add(Component.literal("Click to sell!").withStyle(ChatFormatting.YELLOW));
    }

    /**
     * A shop or trade button (purse, talk, buyback, panes...) shows only its name and its own lines: other mods' tooltip
     * additions (rarity footers, mod names, weights) are trimmed off after everyone has had their say.
     */
    private static void onTooltipLast(ItemTooltipEvent event) {
        ItemStack stack = event.getItemStack();
        if (!stack.has(EconomyContent.DISPLAY.get())) return;
        List<Component> lines = event.getToolTip();
        if (lines.isEmpty()) return;
        Component name = lines.get(0);
        var lore = stack.get(net.minecraft.core.component.DataComponents.LORE);
        lines.clear();
        lines.add(name);
        if (lore != null) lines.addAll(lore.styledLines());
    }

    /** The same for lines added while the tooltip is drawn (mod names). */
    private static void onTooltipComponents(net.neoforged.neoforge.client.event.RenderTooltipEvent.GatherComponents event) {
        ItemStack stack = event.getItemStack();
        if (!stack.has(EconomyContent.DISPLAY.get())) return;
        var lore = stack.get(net.minecraft.core.component.DataComponents.LORE);
        int keep = 1 + (lore == null ? 0 : lore.lines().size());
        var elements = event.getTooltipElements();
        while (elements.size() > keep) elements.remove(elements.size() - 1);
    }

    // ---------------------------------------------------------------- the amount box

    /** Shift + right-click a coin stack in any inventory screen: take an exact amount. */
    private static void onMouse(ScreenEvent.MouseButtonPressed.Pre event) {
        if (event.getButton() != 1 || !Screen.hasShiftDown()) return;
        if (!(event.getScreen() instanceof AbstractContainerScreen<?> screen) || screen instanceof CreativeModeInventoryScreen) return;
        if (screen.getMenu() instanceof ShopMenu || screen.getMenu() instanceof TradeMenu) return;
        Slot slot = screen.getSlotUnderMouse();
        if (slot == null || !Coins.is(slot.getItem()) || !screen.getMenu().getCarried().isEmpty()) return;
        long have = Coins.value(slot.getItem());
        if (have <= 1) return;
        event.setCanceled(true);
        Minecraft.getInstance().setScreen(new CoinAmountScreen(screen, EconomyNet.PURPOSE_SPLIT, have, have / 2, screen.getMenu().containerId, slot.index));
    }

    public static void openCoinInput(EconomyNet.OpenCoinInput payload) {
        Minecraft mc = Minecraft.getInstance();
        mc.setScreen(new CoinAmountScreen(mc.screen, payload.purpose(), payload.max(), payload.current(), -1, -1));
    }

    private EconomyClient() {
    }
}
