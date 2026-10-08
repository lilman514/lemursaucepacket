package net.lemursaucepacket.fixes.economy.trade;

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

/** One side of a player-to-player trade (see {@link Trades}). Like the shop, every click is the server's to handle. */
public class TradeMenu extends ChestMenu {
    @Nullable
    private final Trades.Side side;

    public static TradeMenu client(int id, Inventory inventory, RegistryFriendlyByteBuf extra) {
        return new TradeMenu(id, inventory, new SimpleContainer(54), null);
    }

    TradeMenu(int id, Inventory inventory, Container container, @Nullable Trades.Side side) {
        super(EconomyContent.TRADE_MENU.get(), id, inventory, container, 6);
        this.side = side;
        net.lemursaucepacket.fixes.economy.LockedSlots.lock(this, 54);
    }

    @Override
    public void clicked(int slotId, int button, ClickType clickType, Player player) {
        if (side != null) side.click(slotId, button, clickType);
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
        return side == null || side.stillValid();
    }

    @Override
    public void removed(Player player) {
        super.removed(player);
        if (side != null) side.closed();
    }
}
