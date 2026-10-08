package net.lemursaucepacket.nekomasfixed.block;

import net.lemursaucepacket.nekomasfixed.block.entity.ClockBlockEntity;
import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.util.RandomSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.ItemInteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.BaseEntityBlock;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.pathfinder.PathComputationType;
import net.minecraft.world.phys.BlockHitResult;

/**
 * The vanilla clock, placed (see {@code clock.ClockPlacement}). The block model is empty: {@code ClockRenderer} draws the
 * clock item, its spruce stand and the alarm bell.
 *
 * <ul>
 * <li>Right-click toggles an HH:MM label above it.</li>
 * <li>A clock that recorded a time (right-click air with it) gives a 3-second, strength-15 pulse at that time each day:
 * into the block below for a floor clock, into the wall for a wall clock.</li>
 * <li>A bell turns a floor clock into an alarm clock: clicks add 5 seconds (sneak: a minute), up to 10 minutes; at 0 it
 * rings and pulses. Shears take the bell back off.</li>
 * <li>Comparators read the hour on a 12-hour dial (1-12).</li>
 * </ul>
 */
public abstract class AbstractClockBlock extends BaseEntityBlock {
    public static final BooleanProperty POWERED = BlockStateProperties.POWERED;

    protected AbstractClockBlock(Properties properties) {
        super(properties);
        this.registerDefaultState(this.stateDefinition.any().setValue(POWERED, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(POWERED);
    }

    @Override
    protected ItemInteractionResult useItemOn(ItemStack stack, BlockState state, Level level, BlockPos pos, Player player, InteractionHand hand, BlockHitResult hit) {
        if (hand != InteractionHand.MAIN_HAND || !(level.getBlockEntity(pos) instanceof ClockBlockEntity clock)) {
            return ItemInteractionResult.PASS_TO_DEFAULT_BLOCK_INTERACTION;
        }
        if (level.isClientSide) return ItemInteractionResult.SUCCESS; // the server decides and syncs the block entity

        if (this instanceof FloorClockBlock && stack.is(Items.BELL)) {
            if (!clock.hasBell()) {
                clock.setBell(true);
                stack.consume(1, player);
            }
        } else if (this instanceof FloorClockBlock && stack.is(Items.SHEARS)) {
            if (clock.hasBell()) {
                clock.setBell(false);
                clock.setTimer(ClockBlockEntity.IDLE);
                stack.hurtAndBreak(1, player, LivingEntity.getSlotForHand(hand));
                popResource(level, pos, new ItemStack(Items.BELL));
            }
        } else if (clock.hasBell()) {
            // Alarm clock: wind the timer on (sneak for whole minutes).
            clock.setTimer(Math.min(Math.max(clock.getTimer(), 0) + (player.isShiftKeyDown() ? 1200 : 100), ClockBlockEntity.MAX_TIMER));
        } else {
            clock.setShowsTime(!clock.showsTime());
        }
        clock.sync();
        return ItemInteractionResult.CONSUME;
    }

    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new ClockBlockEntity(pos, state);
    }

    @Override
    public <T extends BlockEntity> BlockEntityTicker<T> getTicker(Level level, BlockState state, BlockEntityType<T> type) {
        return createTickerHelper(type, ModBlockEntities.CLOCK.get(), level.isClientSide ? ClockBlockEntity::clientTick : ClockBlockEntity::serverTick);
    }

    @Override
    protected RenderShape getRenderShape(BlockState state) {
        return RenderShape.ENTITYBLOCK_ANIMATED;
    }

    @Override
    protected boolean isSignalSource(BlockState state) {
        return true;
    }

    @Override
    protected int getSignal(BlockState state, BlockGetter level, BlockPos pos, Direction direction) {
        return state.getValue(POWERED) ? 15 : 0;
    }

    /** The side that also gets strong power (the block the clock hangs on or stands on), as seen by redstone methods. */
    protected abstract Direction strongPowerSide(BlockState state);

    @Override
    protected int getDirectSignal(BlockState state, BlockGetter level, BlockPos pos, Direction direction) {
        return direction == strongPowerSide(state) ? state.getSignal(level, pos, direction) : 0;
    }

    /** Turns the pulse on or off and tells the clock's neighbours and the block it is attached to. */
    public void setPowered(Level level, BlockPos pos, BlockState state, boolean powered) {
        BlockState newState = state.setValue(POWERED, powered);
        level.setBlock(pos, newState, Block.UPDATE_ALL);
        updateNeighbours(newState, level, pos);
    }

    private void updateNeighbours(BlockState state, Level level, BlockPos pos) {
        level.updateNeighborsAt(pos, this);
        level.updateNeighborsAt(pos.relative(strongPowerSide(state).getOpposite()), this);
    }

    @Override
    protected void onRemove(BlockState state, Level level, BlockPos pos, BlockState newState, boolean movedByPiston) {
        if (!state.is(newState.getBlock())) {
            // Upstream lost the bell when an alarm clock was broken; give it back.
            if (!level.isClientSide && level.getBlockEntity(pos) instanceof ClockBlockEntity clock && clock.hasBell()) {
                popResource(level, pos, new ItemStack(Items.BELL));
            }
            if (!movedByPiston && state.getValue(POWERED)) updateNeighbours(state.setValue(POWERED, false), level, pos);
        }
        super.onRemove(state, level, pos, newState, movedByPiston);
    }

    @Override
    public ItemStack getCloneItemStack(LevelReader level, BlockPos pos, BlockState state) {
        ItemStack clock = new ItemStack(Items.CLOCK);
        if (level.getBlockEntity(pos) instanceof ClockBlockEntity entity) clock.applyComponents(entity.collectComponents());
        return clock;
    }

    @Override
    public void animateTick(BlockState state, Level level, BlockPos pos, RandomSource random) {
        if (!state.getValue(POWERED)) return;
        for (int i = 0; i < 3; i++) {
            double[] at = particleAt(state, pos, random);
            level.addParticle(DustParticleOptions.REDSTONE, at[0], at[1], at[2], 0.0, 0.0, 0.0);
        }
    }

    /** Where a redstone particle of a pulsing clock appears. */
    protected abstract double[] particleAt(BlockState state, BlockPos pos, RandomSource random);

    @Override
    protected boolean hasAnalogOutputSignal(BlockState state) {
        return true;
    }

    @Override
    protected int getAnalogOutputSignal(BlockState state, Level level, BlockPos pos) {
        // The hour on a 12-hour dial, 1 to 12 (day time 0 is 6 AM, each hour is 1000 ticks).
        return (int) (((level.getDayTime() + 5000) % 12000) / 1000) + 1;
    }

    @Override
    protected boolean isPathfindable(BlockState state, PathComputationType type) {
        return false;
    }
}
