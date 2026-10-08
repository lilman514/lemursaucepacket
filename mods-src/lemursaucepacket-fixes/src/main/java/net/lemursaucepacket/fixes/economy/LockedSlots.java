package net.lemursaucepacket.fixes.economy;

import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;

/**
 * The shop's and the trade window's own slots are shown, never taken or filled directly: every move goes through the
 * menu's {@code clicked} (the shop session, the trade side). Mods that move items slot by slot on the server (Inventory
 * Essentials' Ctrl + click and Space + right-click) check {@code mayPickup}/{@code mayPlace}, so this stops them taking a
 * vendor's display goods or another player's offer. Inventory Essentials also ignores both menus outright
 * (resources/inventoryessentials/ignores/lsp_fixes.json); this covers any other mod that works the same way.
 */
public final class LockedSlots {
    private LockedSlots() {
    }

    /** Replaces the menu's first {@code count} slots (its own container's) with ones that refuse direct pickup and placing. */
    public static void lock(AbstractContainerMenu menu, int count) {
        for (int i = 0; i < count && i < menu.slots.size(); i++) {
            Slot old = menu.slots.get(i);
            Slot locked = new Slot(old.container, old.getContainerSlot(), old.x, old.y) {
                @Override
                public boolean mayPickup(Player player) {
                    return false;
                }

                @Override
                public boolean mayPlace(ItemStack stack) {
                    return false;
                }
            };
            locked.index = old.index;
            menu.slots.set(i, locked);
        }
    }
}
