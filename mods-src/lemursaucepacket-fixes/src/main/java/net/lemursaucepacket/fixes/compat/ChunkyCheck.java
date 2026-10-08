package net.lemursaucepacket.fixes.compat;

import java.lang.reflect.Field;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Whether Chunky has started yet: its {@code ChunkyProvider} holds the running instance from server start, and
 * {@code get()} throws until then. Read without Chunky on the class path (it's only ever asked when Distant Horizons
 * found Chunky), and without the exception, since Distant Horizons asks on every chunk update until it binds.
 */
public final class ChunkyCheck {
    private static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/compat");
    private static Field instance;
    private static boolean broken;

    public static boolean isUp() {
        if (broken) return true;
        try {
            if (instance == null) {
                instance = Class.forName("org.popcraft.chunky.ChunkyProvider").getDeclaredField("instance");
                instance.setAccessible(true);
            }
            return instance.get(null) != null;
        } catch (ReflectiveOperationException | RuntimeException | LinkageError e) {
            // Can't tell: let Distant Horizons go ahead as it would without this.
            broken = true;
            LOGGER.warn("Couldn't check whether Chunky has started; Distant Horizons binds its Chunky hook straight away", e);
            return true;
        }
    }

    private ChunkyCheck() {
    }
}
