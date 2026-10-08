package net.lemursaucepacket.fixes.compat;

import java.lang.reflect.Field;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.skills.Gates;
import net.lemursaucepacket.fixes.skills.Operators;
import net.lemursaucepacket.fixes.skills.SkillsModule;
import net.minecraft.core.BlockPos;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.Vec3;

/**
 * Drills and saws on a moving contraption (Create's BlockBreakingMovementBehaviour): the actor whose new position is
 * being visited, for {@code canBreak}, which isn't told. Its operator is the one saved with its block when the
 * contraption was put together ({@link Operators#saved}). Create's MovementContext is read by its public fields' names,
 * so this builds without Create.
 */
public final class MovingBreakers {
    private static final ThreadLocal<Object> CURRENT = new ThreadLocal<>();
    private static volatile Class<?> contextClass;
    private static Field blockEntityData, state, position, world;
    private static boolean failed;

    private MovingBreakers() {
    }

    public static void enter(Object context) {
        CURRENT.set(context);
    }

    public static void leave() {
        CURRENT.remove();
    }

    /** Whether the actor being visited may break this block for its operator; true when it isn't known. */
    public static boolean mayBreak(Level level, BlockPos pos, BlockState block) {
        Object context = CURRENT.get();
        if (context == null || !fields(context)) return true;
        try {
            CompoundTag data = (CompoundTag) blockEntityData.get(context);
            BlockState actor = (BlockState) state.get(context);
            Vec3 at = (Vec3) position.get(context);
            String machine = actor == null ? "machine" : actor.getBlock().getName().getString();
            boolean saw = actor != null && actor.getBlock().getDescriptionId().contains("saw");
            return Gates.breakerMayBreak(level, pos, block, Operators.saved(data), machine + " (on a contraption)", at == null ? pos : BlockPos.containing(at), saw ? "cut" : "break");
        } catch (ReflectiveOperationException | ClassCastException e) {
            return true;
        }
    }

    private static boolean fields(Object context) {
        Class<?> type = context.getClass();
        if (type == contextClass) return true;
        if (failed) return false;
        try {
            blockEntityData = type.getField("blockEntityData");
            state = type.getField("state");
            position = type.getField("position");
            world = type.getField("world");
            contextClass = type;
            return true;
        } catch (NoSuchFieldException e) {
            SkillsModule.LOGGER.warn("Contraption drills and saws can't be gated: {} has no {}", type.getName(), e.getMessage());
            failed = true;
            return false;
        }
    }

    /**
     * An actor on a contraption starts its work (a drill or saw's tickBreaker, a harvester's visit): machine XP pays the
     * players near where it is now (skills.MachineXp). Always paired with {@link #workEnds}.
     */
    public static void workStarts(Object context) {
        Level level = null;
        BlockPos at = null;
        String machine = "machine";
        if (context != null && fields(context)) {
            try {
                level = (Level) world.get(context);
                Vec3 v = (Vec3) position.get(context);
                BlockState actor = (BlockState) state.get(context);
                if (v != null) at = BlockPos.containing(v);
                if (actor != null) machine = actor.getBlock().getDescriptionId();
            } catch (ReflectiveOperationException | ClassCastException e) {
                level = null;
            }
        }
        net.lemursaucepacket.fixes.skills.MachineXp.enter(level, at, machine);
    }

    public static void workEnds() {
        net.lemursaucepacket.fixes.skills.MachineXp.leave();
    }

    @Nullable
    public static Object current() {
        return CURRENT.get();
    }
}
