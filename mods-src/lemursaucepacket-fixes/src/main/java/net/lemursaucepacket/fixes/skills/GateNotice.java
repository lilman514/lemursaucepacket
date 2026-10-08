package net.lemursaucepacket.fixes.skills;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.player.Player;

/**
 * How every gate says no (making, machines, backpack upgrades, relics, totems, Hardness): a chat line and a ding only
 * that player hears, so nobody wastes time on something their level can't do yet and it's plain what to train. The
 * same reason is said at most once per {@code everyMs} (a machine or an upgrade asks many times a second).
 */
public final class GateNotice {
    private static final Map<UUID, Map<String, Long>> LAST = new ConcurrentHashMap<>();

    private GateNotice() {
    }

    /** Says {@code message} to the player unless the same {@code key} was said to them in the last {@code everyMs}. */
    public static void tell(Player player, String key, String message, long everyMs) {
        if (!(player instanceof ServerPlayer p)) return;
        long now = System.currentTimeMillis();
        Map<String, Long> said = LAST.computeIfAbsent(p.getUUID(), id -> new ConcurrentHashMap<>());
        Long last = said.get(key);
        if (last != null && now - last < everyMs) return;
        said.put(key, now);
        p.sendSystemMessage(Component.literal(message).withStyle(ChatFormatting.GOLD));
        p.playNotifySound(SoundEvents.NOTE_BLOCK_BELL.value(), SoundSource.MASTER, 0.6F, 1.5F);
        SkillsModule.LOGGER.debug("Told {}: {}", p.getGameProfile().getName(), message);
    }

    /** "Cooking 20 (you have 12)": the level a gate needs and the player's own. */
    public static String needs(SkillGates.Need need, int have) {
        return Levels.name(need.skill()) + " " + need.level() + " (you have " + have + ")";
    }

    /** Forgets a player who left (what they were told, and when). */
    public static void forget(UUID player) {
        LAST.remove(player);
    }
}
