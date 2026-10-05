package net.lemursaucepacket.fixes.zone;

import net.neoforged.neoforge.common.NeoForge;

/**
 * Safe zones (docs/world.md): areas such as the spawn city where players can't build, fight each other or meet
 * hostile mobs. Zones live in the world's saved data and are managed with {@code /lsp zone}; fire is handled by
 * {@code mixin.FireZoneMixin} and {@code mixin.LightningZoneMixin}.
 */
public final class SafeZoneModule {
    private SafeZoneModule() {
    }

    public static void init() {
        NeoForge.EVENT_BUS.register(ZoneEvents.class);
        NeoForge.EVENT_BUS.addListener(ZoneCommands::register);
    }
}
