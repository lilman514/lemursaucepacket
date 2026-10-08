package net.lemursaucepacket.nekomasfixed.block.entity;

import net.lemursaucepacket.nekomasfixed.block.AbstractClockBlock;
import net.lemursaucepacket.nekomasfixed.block.FloorClockBlock;
import net.lemursaucepacket.nekomasfixed.clock.StoredTime;
import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.lemursaucepacket.nekomasfixed.registry.ModComponents;
import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.component.DataComponentMap;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientGamePacketListener;
import net.minecraft.network.protocol.game.ClientboundBlockEntityDataPacket;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.gameevent.GameEvent;

/**
 * A placed clock's state: the recorded time it pulses at, the alarm timer, whether it carries a bell and whether its
 * HH:MM label is shown.
 *
 * <p>The timer counts down every tick. Above 0 it is an alarm still winding down; from 0 down to {@link #IDLE} the
 * clock is pulsing (and ringing, with a bell); at {@link #IDLE} it rests. The client runs the same countdown for the
 * label and the shake, and the server syncs the block entity whenever something changes it.
 */
public class ClockBlockEntity extends BlockEntity {
    /** How long a pulse lasts, in ticks (3 seconds). */
    public static final int PULSE = 60;
    public static final int IDLE = -PULSE;
    /** The longest alarm, in ticks (10 minutes). */
    public static final int MAX_TIMER = 12000;

    private int storedTime = -1;
    private int timer = IDLE;
    private boolean bell;
    private boolean showsTime;
    /** The day time of the last tick, so a frozen clock (no daylight cycle) pulses once, not every tick. Not saved. */
    private long lastDayTime = Long.MIN_VALUE;

    public ClockBlockEntity(BlockPos pos, BlockState state) {
        super(ModBlockEntities.CLOCK.get(), pos, state);
    }

    public static void serverTick(Level level, BlockPos pos, BlockState state, ClockBlockEntity clock) {
        long dayTime = level.getDayTime();
        if (clock.storedTime >= 0 && dayTime != clock.lastDayTime && StoredTime.timeOfDay(level) == clock.storedTime) {
            clock.timer = 0; // the recorded time: pulse now
            clock.sync();
        }
        clock.lastDayTime = dayTime;
        boolean pulsing = clock.countDown();
        if (state.getValue(AbstractClockBlock.POWERED) != pulsing) {
            ((AbstractClockBlock) state.getBlock()).setPowered(level, pos, state, pulsing);
        }
        if (pulsing && clock.bell && state.getBlock() instanceof FloorClockBlock && level.getGameTime() % 5L == 0L) {
            level.gameEvent(GameEvent.NOTE_BLOCK_PLAY, pos, GameEvent.Context.of(state));
            level.playSound(null, pos, SoundEvents.BELL_BLOCK, SoundSource.BLOCKS, 0.3F, 2.0F);
        }
        // Comparators read the hour, so let them look again now and then.
        if (level.getGameTime() % 20L == 0L) level.updateNeighbourForOutputSignal(pos, state.getBlock());
    }

    public static void clientTick(Level level, BlockPos pos, BlockState state, ClockBlockEntity clock) {
        clock.countDown();
    }

    /** One tick of the timer; true while the clock should pulse. */
    private boolean countDown() {
        if (timer <= IDLE) return false;
        timer--;
        return timer < 1;
    }

    /** Saves and sends the new state to the players who can see the clock. */
    public void sync() {
        setChanged();
        if (level != null) level.sendBlockUpdated(worldPosition, getBlockState(), getBlockState(), Block.UPDATE_CLIENTS);
    }

    public int getTimer() {
        return timer;
    }

    public void setTimer(int timer) {
        this.timer = timer;
    }

    public boolean hasBell() {
        return bell;
    }

    public void setBell(boolean bell) {
        this.bell = bell;
    }

    public boolean showsTime() {
        return showsTime;
    }

    public void setShowsTime(boolean showsTime) {
        this.showsTime = showsTime;
    }

    @Override
    protected void loadAdditional(CompoundTag tag, HolderLookup.Provider registries) {
        super.loadAdditional(tag, registries);
        storedTime = tag.contains("storedTime") ? tag.getInt("storedTime") : -1;
        timer = tag.contains("timer") ? tag.getInt("timer") : IDLE;
        bell = tag.getBoolean("bell");
        showsTime = tag.getBoolean("showsTime");
    }

    @Override
    protected void saveAdditional(CompoundTag tag, HolderLookup.Provider registries) {
        super.saveAdditional(tag, registries);
        if (storedTime >= 0) tag.putInt("storedTime", storedTime);
        tag.putInt("timer", timer);
        tag.putBoolean("bell", bell);
        tag.putBoolean("showsTime", showsTime);
    }

    @Override
    public CompoundTag getUpdateTag(HolderLookup.Provider registries) {
        return saveCustomOnly(registries);
    }

    @Override
    public Packet<ClientGamePacketListener> getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }

    /** The recorded time travels with the clock item (placing it in, breaking it out). */
    @Override
    protected void applyImplicitComponents(DataComponentInput components) {
        super.applyImplicitComponents(components);
        StoredTime time = components.get(ModComponents.STORED_TIME.get());
        storedTime = time == null ? -1 : time.time();
    }

    @Override
    protected void collectImplicitComponents(DataComponentMap.Builder components) {
        super.collectImplicitComponents(components);
        if (storedTime >= 0) components.set(ModComponents.STORED_TIME.get(), new StoredTime(storedTime));
    }

    @Override
    public void removeComponentsFromTag(CompoundTag tag) {
        tag.remove("storedTime");
    }
}
