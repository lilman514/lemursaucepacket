package net.lemursaucepacket.nekomasfixed.block;

import net.lemursaucepacket.nekomasfixed.Colour;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.StainedGlassPaneBlock;
import net.minecraft.world.level.block.state.BlockState;

/** A stained glass pane in one of the new colours, tinting beacon beams with the real colour like {@link DyedStainedGlassBlock}. */
public class DyedStainedGlassPaneBlock extends StainedGlassPaneBlock {
    private final Colour colour;

    public DyedStainedGlassPaneBlock(Colour colour, Properties properties) {
        super(colour.base, properties);
        this.colour = colour;
    }

    @Override
    public Integer getBeaconColorMultiplier(BlockState state, LevelReader level, BlockPos pos, BlockPos beaconPos) {
        return 0xFF000000 | colour.rgb;
    }
}
