package net.lemursaucepacket.fixes.compat;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

import net.lemursaucepacket.fixes.skills.MachineXp;
import net.lemursaucepacket.fixes.skills.SkillsModule;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;

/**
 * Create's encased fans: an air current ticking (where its fan smelts, blasts and smokes what's in it) is its fan at
 * work, for machine XP (skills.MachineXp). The current's source is read by its public names, so this builds without
 * Create.
 */
public final class Fans {
    private static Field source;
    private static Method world, pos;
    private static boolean failed;

    private Fans() {
    }

    /** Always paired with {@link #workEnds}. */
    public static void workStarts(Object current) {
        Level level = null;
        BlockPos at = null;
        if (!failed) {
            try {
                if (source == null) {
                    source = current.getClass().getField("source");
                    Class<?> type = Class.forName("com.simibubi.create.content.kinetics.fan.IAirCurrentSource");
                    world = type.getMethod("getAirCurrentWorld");
                    pos = type.getMethod("getAirCurrentPos");
                }
                Object from = source.get(current);
                if (from != null) {
                    level = (Level) world.invoke(from);
                    at = (BlockPos) pos.invoke(from);
                }
            } catch (ReflectiveOperationException | ClassCastException | LinkageError e) {
                failed = true;
                SkillsModule.LOGGER.warn("Fans can't pay machine XP: {}", e.toString());
            }
        }
        MachineXp.enter(level, at, "fan");
    }

    public static void workEnds() {
        MachineXp.leave();
    }
}
