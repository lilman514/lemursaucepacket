package net.lemursaucepacket.fixes.hud;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import net.neoforged.fml.config.ModConfig;
import net.neoforged.fml.config.ModConfigs;
import net.neoforged.neoforge.common.ModConfigSpec;

/** Small reflection helpers: the HUD elements reach other mods without compiling against them. */
final class Reflect {
    static Class<?> cls(String name) throws ClassNotFoundException {
        return Class.forName(name, true, Reflect.class.getClassLoader());
    }

    static Object staticField(String className, String field) throws ReflectiveOperationException {
        Field f = cls(className).getField(field);
        return f.get(null);
    }

    static Method method(Class<?> owner, String name, Class<?>... params) throws NoSuchMethodException {
        return owner.getMethod(name, params);
    }

    static Object call(Object target, Method m, Object... args) throws Exception {
        try {
            return m.invoke(target, args);
        } catch (java.lang.reflect.InvocationTargetException e) {
            if (e.getCause() instanceof Exception cause) throw cause;
            throw e;
        }
    }

    /**
     * A NeoForge config value by file name and TOML path, e.g. {@code ("create-client.toml",
     * "client.goggleOverlay.overlayOffsetX")}. Works for any mod that uses NeoForge's config system; setting
     * it updates the mod's cached value at once, {@link #saveSpec} writes the file.
     */
    static ModConfigSpec.ConfigValue<?> configValue(String fileName, String path) throws NoSuchFieldException {
        ModConfig config = ModConfigs.getFileMap().get(fileName);
        if (config == null) throw new NoSuchFieldException("no config file " + fileName);
        if (!(config.getSpec() instanceof ModConfigSpec spec)) throw new NoSuchFieldException(fileName + " is not a NeoForge config");
        List<String> keys = Arrays.asList(path.split("\\."));
        Object value = spec.getValues().get(keys);
        if (!(value instanceof ModConfigSpec.ConfigValue<?> configValue)) throw new NoSuchFieldException("no " + path + " in " + fileName);
        return configValue;
    }

    static ModConfigSpec specOf(String fileName) {
        return (ModConfigSpec) ModConfigs.getFileMap().get(fileName).getSpec();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    static void set(ModConfigSpec.ConfigValue<?> value, Object v) {
        ((ModConfigSpec.ConfigValue) value).set(v);
    }

    private Reflect() {
    }
}
