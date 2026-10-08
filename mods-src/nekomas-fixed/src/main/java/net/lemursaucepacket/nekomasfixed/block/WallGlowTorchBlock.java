package net.lemursaucepacket.nekomasfixed.block;

import com.mojang.serialization.MapCodec;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.util.RandomSource;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.HorizontalDirectionalBlock;
import net.minecraft.world.level.block.Mirror;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.block.WallTorchBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.DirectionProperty;
import net.minecraft.world.level.material.Fluids;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.VoxelShape;

/** The Glow Torch on a wall: the vanilla wall torch's shape and placement, plus the waterlogging of {@link GlowTorchBlock}. */
public class WallGlowTorchBlock extends GlowTorchBlock {
    public static final MapCodec<WallGlowTorchBlock> CODEC = simpleCodec(WallGlowTorchBlock::new);
    public static final DirectionProperty FACING = HorizontalDirectionalBlock.FACING;

    public WallGlowTorchBlock(Properties properties) {
        super(properties);
        this.registerDefaultState(this.stateDefinition.any().setValue(FACING, Direction.NORTH).setValue(WATERLOGGED, false));
    }

    @Override
    protected MapCodec<WallGlowTorchBlock> codec() {
        return CODEC;
    }

    @Override
    public BlockState getStateForPlacement(BlockPlaceContext context) {
        // The vanilla wall torch knows which walls it can hang on; borrow its answer for the facing.
        BlockState wallTorch = Blocks.WALL_TORCH.getStateForPlacement(context);
        if (wallTorch == null) return null;
        return this.defaultBlockState().setValue(FACING, wallTorch.getValue(WallTorchBlock.FACING)).setValue(WATERLOGGED, isInWaterSource(context));
    }

    @Override
    protected BlockState updateShape(BlockState state, Direction direction, BlockState neighborState, LevelAccessor level, BlockPos pos, BlockPos neighborPos) {
        if (state.getValue(WATERLOGGED)) level.scheduleTick(pos, Fluids.WATER, Fluids.WATER.getTickDelay(level));
        return direction.getOpposite() == state.getValue(FACING) && !state.canSurvive(level, pos) ? Blocks.AIR.defaultBlockState() : state;
    }

    @Override
    protected VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
        return WallTorchBlock.getShape(state);
    }

    @Override
    protected boolean canSurvive(BlockState state, LevelReader level, BlockPos pos) {
        return WallTorchBlock.canSurvive(level, pos, state.getValue(FACING));
    }

    @Override
    public void animateTick(BlockState state, Level level, BlockPos pos, RandomSource random) {
        if (!state.getValue(WATERLOGGED) || random.nextInt(4) != 0) return;
        Direction away = state.getValue(FACING).getOpposite();
        double x = pos.getX() + 0.5 + (random.nextDouble() - 0.5) * 0.2 + 0.27 * away.getStepX();
        double y = pos.getY() + 0.7 + (random.nextDouble() - 0.5) * 0.2 + 0.22;
        double z = pos.getZ() + 0.5 + (random.nextDouble() - 0.5) * 0.2 + 0.27 * away.getStepZ();
        level.addParticle(ParticleTypes.SCRAPE, x, y, z, 0.0, 0.0, 0.0); // upstream's choice for the wall torch
    }

    @Override
    protected BlockState rotate(BlockState state, Rotation rotation) {
        return state.setValue(FACING, rotation.rotate(state.getValue(FACING)));
    }

    @Override
    protected BlockState mirror(BlockState state, Mirror mirror) {
        return state.rotate(mirror.getRotation(state.getValue(FACING)));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(FACING, WATERLOGGED);
    }
}
