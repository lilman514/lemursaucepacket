package net.lemursaucepacket.nekomasfixed.redstone;

import java.util.IdentityHashMap;
import java.util.Map;

import it.unimi.dsi.fastutil.longs.Long2LongMap;
import it.unimi.dsi.fastutil.longs.Long2LongOpenHashMap;
import it.unimi.dsi.fastutil.longs.LongArrayList;
import net.lemursaucepacket.nekomasfixed.mixin.ObserverBlockInvoker;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.DiodeBlock;
import net.minecraft.world.level.block.ObserverBlock;
import net.minecraft.world.level.block.entity.ComparatorBlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.level.LevelEvent;
import net.neoforged.neoforge.event.server.ServerStoppedEvent;
import net.neoforged.neoforge.event.tick.LevelTickEvent;

/**
 * The spots a Redstone Striker hit. For a moment (16 ticks, 1 when sneaking) a struck spot counts as powered at 15:
 * dust there reads 15, a solid block there outputs 15, a component there (lamp, door, piston...) sees a signal, and a
 * struck observer pulses.
 *
 * <p>Vanilla has no hook for redstone power, so the mixins in {@code mixin/} ask {@link #isStruck} from inside
 * vanilla's signal methods. Those run constantly (and Create and Lithium lean on them), so the check returns at once
 * while nothing is struck. Server-only: the map is only ever touched on the server thread.
 */
public final class StruckRedstone {
    /** Per level: struck positions to the game time their power runs out. */
    private static final Map<ServerLevel, Long2LongOpenHashMap> STRUCK = new IdentityHashMap<>();
    /** Whether anything is struck anywhere: the hot-path check the mixins make first. */
    private static volatile boolean anyStruck;

    public static void init() {
        NeoForge.EVENT_BUS.addListener(LevelTickEvent.Post.class, StruckRedstone::onLevelTick);
        NeoForge.EVENT_BUS.addListener(LevelEvent.Unload.class, event -> {
            if (event.getLevel() instanceof ServerLevel level) forget(level);
        });
        NeoForge.EVENT_BUS.addListener(ServerStoppedEvent.class, event -> {
            STRUCK.clear();
            anyStruck = false;
        });
    }

    /** Powers the spot for {@code ticks} ticks and tells it and its neighbours. */
    public static void strike(ServerLevel level, BlockPos pos, int ticks) {
        STRUCK.computeIfAbsent(level, l -> new Long2LongOpenHashMap()).put(pos.asLong(), level.getGameTime() + ticks);
        anyStruck = true;

        BlockState state = level.getBlockState(pos);
        if (state.getBlock() instanceof ObserverBlock observer) ((ObserverBlockInvoker) observer).nekomasfixed$startSignal(level, pos);
        state.handleNeighborChanged(level, pos, Blocks.AIR, pos, false);
        // A struck repeater or comparator turns on straight away; it turns off again on the update when the power runs out.
        if (state.is(Blocks.REPEATER) || state.is(Blocks.COMPARATOR)) {
            level.setBlock(pos, state.setValue(DiodeBlock.POWERED, true), 3);
            if (level.getBlockEntity(pos) instanceof ComparatorBlockEntity comparator) comparator.setOutputSignal(15);
        }
        level.updateNeighborsAt(pos, state.getBlock());
    }

    /** Whether a striker is powering this spot. Cheap while nothing is struck; false off the server thread. */
    public static boolean isStruck(BlockGetter getter, BlockPos pos) {
        if (!anyStruck || !(getter instanceof ServerLevel level) || !level.getServer().isSameThread()) return false;
        Long2LongOpenHashMap struck = STRUCK.get(level);
        return struck != null && struck.containsKey(pos.asLong());
    }

    private static void onLevelTick(LevelTickEvent.Post event) {
        if (!anyStruck || !(event.getLevel() instanceof ServerLevel level)) return;
        Long2LongOpenHashMap struck = STRUCK.get(level);
        if (struck == null) return;

        long now = level.getGameTime();
        LongArrayList expired = new LongArrayList();
        for (Long2LongMap.Entry entry : struck.long2LongEntrySet()) {
            if (now > entry.getLongValue()) expired.add(entry.getLongKey());
        }
        for (long key : expired) {
            struck.remove(key);
            BlockPos pos = BlockPos.of(key);
            BlockState state = level.getBlockState(pos);
            state.handleNeighborChanged(level, pos, Blocks.AIR, pos, false);
            level.updateNeighborsAt(pos, state.getBlock());
        }
        if (struck.isEmpty()) forget(level);
    }

    private static void forget(ServerLevel level) {
        STRUCK.remove(level);
        anyStruck = !STRUCK.isEmpty();
    }

    private StruckRedstone() {
    }
}
