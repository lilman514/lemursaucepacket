package net.lemursaucepacket.nekomasfixed.block;

import net.lemursaucepacket.nekomasfixed.Colour;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.StainedGlassBlock;
import net.minecraft.world.level.block.state.BlockState;

/** Stained glass in one of the new colours. A beacon beam through it takes the real colour, not the borrowed DyeColor's. */
public class DyedStainedGlassBlock extends StainedGlassBlock {
    private final Colour colour;

    public DyedStainedGlassBlock(Colour colour, Properties properties) {
        super(colour.base, properties);
        this.colour = colour;
    }

    @Override
    public Integer getBeaconColorMultiplier(BlockState state, LevelReader level, BlockPos pos, BlockPos beaconPos) {
        return 0xFF000000 | colour.rgb;
    }
}
