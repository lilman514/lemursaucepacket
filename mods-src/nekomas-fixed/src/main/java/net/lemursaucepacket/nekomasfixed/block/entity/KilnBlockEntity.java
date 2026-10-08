package net.lemursaucepacket.nekomasfixed.block.entity;

import net.lemursaucepacket.nekomasfixed.menu.KilnMenu;
import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.lemursaucepacket.nekomasfixed.registry.ModRecipes;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.AbstractFurnaceBlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/** The kiln's furnace logic: vanilla's, with kiln recipes and fuel that burns for half as long (like a blast furnace). */
public class KilnBlockEntity extends AbstractFurnaceBlockEntity {
    public KilnBlockEntity(BlockPos pos, BlockState state) {
        super(ModBlockEntities.KILN.get(), pos, state, ModRecipes.KILN.get());
    }

    @Override
    protected Component getDefaultName() {
        return Component.translatable("container.nekomasfixed.kiln");
    }

    @Override
    protected int getBurnDuration(ItemStack fuel) {
        return super.getBurnDuration(fuel) / 2;
    }

    @Override
    protected AbstractContainerMenu createMenu(int id, Inventory inventory) {
        return new KilnMenu(id, inventory, this, this.dataAccess);
    }
}
