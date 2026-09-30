package net.lemursaucepacket.fixes.lifesteal;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.WeakHashMap;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.world.entity.Entity;

/**
 * The player state the KubeJS core keeps in {@code player.persistentData} (kubejs/server_scripts/lifesteal.js).
 * KubeJS adds {@code kjs$getPersistentData()} to every entity through a mixin; it is reached by reflection so
 * this mod needs no compile-time dependency on KubeJS. The keys are the contract between the two sides.
 */
public final class KubeData {
    public static final String HEARTS = "lsp_hearts";
    public static final String GENERATION = "lsp_generation";
    public static final String ELIMINATED = "lsp_eliminated";
    public static final String PLAYTIME = "lsp_playtime";
    public static final String PROTECT_UNTIL = "lsp_protect_until";
    public static final String PROTECT_OFF = "lsp_protect_off";
    public static final String LAST_KILLER = "lsp_last_killer";
    public static final String LAST_KILLER_TIME = "lsp_last_killer_time";
    public static final String DEATH_POS = "lsp_death_pos";
    public static final String NEW_LIFE = "lsp_new_life";

    private static final Method GETTER = find();
    private static final Map<Entity, CompoundTag> FALLBACK = new WeakHashMap<>();

    private static Method find() {
        try {
            return Entity.class.getMethod("kjs$getPersistentData");
        } catch (ReflectiveOperationException e) {
            LifestealModule.LOGGER.warn("KubeJS persistent data is not reachable ({}): lifesteal state will not persist", e.toString());
            return null;
        }
    }

    /** The live tag: writes are seen by the scripts and saved with the player. */
    public static CompoundTag of(Entity entity) {
        if (GETTER != null) {
            try {
                return (CompoundTag) GETTER.invoke(entity);
            } catch (ReflectiveOperationException | RuntimeException t) {
                LifestealModule.LOGGER.warn("Reading KubeJS persistent data failed: {}", t.toString());
            }
        }
        synchronized (FALLBACK) {
            return FALLBACK.computeIfAbsent(entity, e -> new CompoundTag());
        }
    }

    public static boolean isEliminated(Entity entity) {
        return of(entity).getBoolean(ELIMINATED);
    }

    public static int generation(Entity entity) {
        return of(entity).getInt(GENERATION);
    }

    private KubeData() {
    }
}
