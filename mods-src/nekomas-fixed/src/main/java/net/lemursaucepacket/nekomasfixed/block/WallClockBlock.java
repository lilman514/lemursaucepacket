package net.lemursaucepacket.nekomasfixed.block;

import java.util.Map;

import com.mojang.serialization.MapCodec;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.util.RandomSource;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.HorizontalDirectionalBlock;
import net.minecraft.world.level.block.Mirror;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.DirectionProperty;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.VoxelShape;

/** A clock hung on the side of a block. {@link #FACING} points away from the wall, the way the face looks. */
public class WallClockBlock extends AbstractClockBlock {
    public static final MapCodec<WallClockBlock> CODEC = simpleCodec(WallClockBlock::new);
    public static final DirectionProperty FACING = HorizontalDirectionalBlock.FACING;
    /** A thin plate flush with the wall behind the clock. */
    private static final Map<Direction, VoxelShape> SHAPES = Map.of(
            Direction.NORTH, Block.box(1.0, 1.0, 15.0, 15.0, 15.0, 16.0),
            Direction.EAST, Block.box(0.0, 1.0, 1.0, 1.0, 15.0, 15.0),
            Direction.SOUTH, Block.box(1.0, 1.0, 0.0, 15.0, 15.0, 1.0),
            Direction.WEST, Block.box(15.0, 1.0, 1.0, 16.0, 15.0, 15.0));

    public WallClockBlock(Properties properties) {
        super(properties);
        this.registerDefaultState(this.defaultBlockState().setValue(FACING, Direction.NORTH));
    }

    @Override
    protected MapCodec<WallClockBlock> codec() {
        return CODEC;
    }

    @Override
    protected Direction strongPowerSide(BlockState state) {
        return state.getValue(FACING); // powers the wall it hangs on
    }

    @Override
    protected VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
        return SHAPES.get(state.getValue(FACING));
    }

    @Override
    public BlockState getStateForPlacement(BlockPlaceContext context) {
        BlockState state = this.defaultBlockState();
        for (Direction direction : context.getNearestLookingDirections()) {
            if (!direction.getAxis().isHorizontal()) continue;
            state = state.setValue(FACING, direction.getOpposite());
            if (state.canSurvive(context.getLevel(), context.getClickedPos())) return state;
        }
        return null;
    }

    @Override
    protected boolean canSurvive(BlockState state, LevelReader level, BlockPos pos) {
        Direction facing = state.getValue(FACING);
        BlockPos wall = pos.relative(facing.getOpposite());
        return level.getBlockState(wall).isFaceSturdy(level, wall, facing);
    }

    @Override
    protected BlockState updateShape(BlockState state, Direction direction, BlockState neighborState, LevelAccessor level, BlockPos pos, BlockPos neighborPos) {
        return direction.getOpposite() == state.getValue(FACING) && !state.canSurvive(level, pos) ? Blocks.AIR.defaultBlockState() : state;
    }

    @Override
    protected double[] particleAt(BlockState state, BlockPos pos, RandomSource random) {
        Direction facing = state.getValue(FACING);
        return new double[] {
                pos.getX() + 0.5 + (facing.getAxis() == Direction.Axis.Z ? (random.nextDouble() - 0.5) * 0.4 : -facing.getStepX() * 0.4),
                pos.getY() + 0.5 + (random.nextDouble() - 0.5) * 0.4,
                pos.getZ() + 0.5 + (facing.getAxis() == Direction.Axis.X ? (random.nextDouble() - 0.5) * 0.4 : -facing.getStepZ() * 0.4)};
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
        super.createBlockStateDefinition(builder);
        builder.add(FACING);
    }
}
