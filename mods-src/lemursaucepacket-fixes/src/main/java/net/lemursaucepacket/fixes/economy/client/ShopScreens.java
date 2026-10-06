package net.lemursaucepacket.fixes.economy.client;

import net.minecraft.client.gui.screens.inventory.ContainerScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.ChestMenu;

/**
 * The shop and trade windows: vanilla's chest screen, under their own classes so the inventory mods leave them alone.
 * Inventory Profiles Next's sort buttons and Mouse Tweaks' drag and scroll tweaks work by sending clicks, and in these
 * windows a click buys, sells or offers, so both are told to ignore them.
 */
public final class ShopScreens {
    @org.anti_ad.mc.ipn.api.IPNIgnore
    @yalter.mousetweaks.api.MouseTweaksIgnore
    public static class Shop extends ContainerScreen {
        public Shop(ChestMenu menu, Inventory inventory, Component title) {
            super(menu, inventory, title);
        }
    }

    @org.anti_ad.mc.ipn.api.IPNIgnore
    @yalter.mousetweaks.api.MouseTweaksIgnore
    public static class Trade extends ContainerScreen {
        public Trade(ChestMenu menu, Inventory inventory, Component title) {
            super(menu, inventory, title);
        }
    }

    private ShopScreens() {
    }
}
