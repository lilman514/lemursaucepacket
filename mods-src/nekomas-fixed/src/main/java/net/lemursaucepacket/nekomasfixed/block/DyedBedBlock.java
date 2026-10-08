package net.lemursaucepacket.nekomasfixed.block;

import net.lemursaucepacket.nekomasfixed.Colour;
import net.lemursaucepacket.nekomasfixed.block.entity.DyedBedBlockEntity;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.BedBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/**
 * A bed in one of the new colours. It is a vanilla bed in every way (sleeping, spawn points, exploding outside the
 * overworld) with its colour's {@link Colour#base} DyeColor, but its block entity is our own type so that our renderer,
 * not the vanilla one, draws it with the right texture.
 */
public class DyedBedBlock extends BedBlock {
    private final Colour colour;

    public DyedBedBlock(Colour colour, Properties properties) {
        super(colour.base, properties);
        this.colour = colour;
    }

    public Colour colour() {
        return colour;
    }

    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new DyedBedBlockEntity(pos, state);
    }
}
