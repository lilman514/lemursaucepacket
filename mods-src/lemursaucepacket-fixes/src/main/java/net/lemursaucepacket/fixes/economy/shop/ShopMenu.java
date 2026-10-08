package net.lemursaucepacket.fixes.economy.shop;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.economy.EconomyContent;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.world.Container;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.inventory.ClickType;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;

/**
 * A vendor's shop: a chest-style menu whose top is goods and buttons and whose bottom is the player's inventory (click an
 * item there to sell it). Every click is the server's to handle; the client's copy does nothing locally, so nothing
 * flickers into the cursor while the server decides.
 */
public class ShopMenu extends ChestMenu {
    @Nullable
    private final Shops.Session session;

    public static ShopMenu client(int id, Inventory inventory, RegistryFriendlyByteBuf extra) {
        int rows = extra.readVarInt();
        return new ShopMenu(id, inventory, new SimpleContainer(rows * 9), rows, null);
    }

    ShopMenu(int id, Inventory inventory, Container container, int rows, @Nullable Shops.Session session) {
        super(EconomyContent.SHOP_MENU.get(), id, inventory, container, rows);
        this.session = session;
        net.lemursaucepacket.fixes.economy.LockedSlots.lock(this, rows * 9);
    }

    /** True for a slot in the player's own inventory (the bottom of the screen). */
    public boolean isPlayerSlot(Slot slot) {
        return slot.index >= getRowCount() * 9;
    }

    @Override
    public void clicked(int slotId, int button, ClickType clickType, Player player) {
        if (session != null) session.click(slotId, button, clickType);
    }

    @Override
    public ItemStack quickMoveStack(Player player, int index) {
        return ItemStack.EMPTY;
    }

    @Override
    public boolean canTakeItemForPickAll(ItemStack stack, Slot slot) {
        return false;
    }

    @Override
    public boolean canDragTo(Slot slot) {
        return false;
    }

    @Override
    public boolean stillValid(Player player) {
        return session == null || session.stillValid();
    }

    @Override
    public void removed(Player player) {
        super.removed(player);
        if (session != null) session.closed();
    }
}
