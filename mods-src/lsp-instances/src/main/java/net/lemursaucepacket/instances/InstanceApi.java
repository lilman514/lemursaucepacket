package net.lemursaucepacket.instances;

import java.util.List;

import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.ItemStack;

/** For other mods and scripts (KubeJS: {@code Java.loadClass('net.lemursaucepacket.instances.InstanceApi')}). */
public final class InstanceApi {
    /** Whether this entity is in the instance dimension. */
    public static boolean inInstance(Entity entity) {
        return entity.level().dimension() == InstanceManager.DIMENSION;
    }

    /** Whether this player is fighting in an event right now. */
    public static boolean inEvent(ServerPlayer player) {
        return InstanceManager.sessionInside(player.getUUID()).isPresent();
    }

    /**
     * Gives a stack to the keeper of the event this player is fighting in (or has just died in), to collect later; false
     * when there's no keeper to give it to. The lifesteal Heart of a player who dies in an event goes this way.
     */
    public static boolean keep(ServerPlayer player, ItemStack stack) {
        return InstanceManager.keep(player, List.of(stack));
    }

    /** Who keeps this player's things for the event they're in ("Ned"), or "" if nobody does. */
    public static String keeperName(ServerPlayer player) {
        return InstanceManager.keeperFor(player).map(s -> s.def.keeper()).orElse("");
    }

    /** Where that keeper is ("the Crandor memorial"), or "". */
    public static String keeperPlace(ServerPlayer player) {
        return InstanceManager.keeperFor(player).map(s -> s.def.keeperPlace()).orElse("");
    }

    private InstanceApi() {
    }
}
