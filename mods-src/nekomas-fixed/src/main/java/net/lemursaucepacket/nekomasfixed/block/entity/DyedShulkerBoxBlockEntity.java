package net.lemursaucepacket.nekomasfixed.block.entity;

import net.lemursaucepacket.nekomasfixed.block.DyedShulkerBoxBlock;
import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.entity.ShulkerBoxBlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/**
 * A new-colour shulker box's block entity: all of vanilla's box (storage, lid, hoppers, comparators) under our own
 * type. Like {@link DyedBedBlockEntity}, the type comes from {@link #getType()}, which NeoForge reads everywhere.
 */
public class DyedShulkerBoxBlockEntity extends ShulkerBoxBlockEntity {
    public DyedShulkerBoxBlockEntity(BlockPos pos, BlockState state) {
        super(((DyedShulkerBoxBlock) state.getBlock()).colour().base, pos, state);
    }

    @Override
    public BlockEntityType<?> getType() {
        return ModBlockEntities.SHULKER_BOX.get();
    }
}
