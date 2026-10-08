package net.lemursaucepacket.nekomasfixed.block.entity;

import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.entity.BedBlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;

/**
 * A new-colour bed's block entity. Vanilla's constructor hard-wires {@link BlockEntityType#BED}; NeoForge reads the type
 * through {@link #getType()} (to validate, save and pick a renderer), so overriding it gives the bed our own type.
 */
public class DyedBedBlockEntity extends BedBlockEntity {
    public DyedBedBlockEntity(BlockPos pos, BlockState state) {
        super(pos, state);
    }

    @Override
    public BlockEntityType<?> getType() {
        return ModBlockEntities.BED.get();
    }
}
