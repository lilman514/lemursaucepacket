package net.lemursaucepacket.fixes.xpbank;

import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

import com.mojang.serialization.Codec;

import io.netty.buffer.ByteBuf;
import net.lemursaucepacket.fixes.skills.MachineXp;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;

/**
 * What an XP Bank caught: the full XP of the work it was there for, by skill, kept apart by the tier the bank had when
 * it came in (upgrading a bank doesn't raise the share of what it already held). What a player takes is each part's
 * XP times the share of the lower of that tier and the player's own (see {@link XpBanks#tierFor}). Immutable: it is
 * also the item's data component, so a bank broken and moved keeps it.
 */
public record BankedXp(Map<Integer, Map<String, Long>> byTier) {
    public static final BankedXp EMPTY = new BankedXp(Map.of());

    public static final Codec<BankedXp> CODEC = Codec.unboundedMap(Codec.STRING, Codec.unboundedMap(Codec.STRING, Codec.LONG)).xmap(saved -> {
        Map<Integer, Map<String, Long>> out = new TreeMap<>();
        saved.forEach((tier, xp) -> {
            try {
                out.put(Integer.parseInt(tier), xp);
            } catch (NumberFormatException e) {
                // not ours: dropped
            }
        });
        return of(out);
    }, banked -> {
        Map<String, Map<String, Long>> out = new LinkedHashMap<>();
        banked.byTier().forEach((tier, xp) -> out.put(String.valueOf(tier), xp));
        return out;
    });
    public static final StreamCodec<ByteBuf, BankedXp> STREAM_CODEC = ByteBufCodecs.fromCodec(CODEC);

    private static BankedXp of(Map<Integer, Map<String, Long>> byTier) {
        Map<Integer, Map<String, Long>> copy = new TreeMap<>();
        byTier.forEach((tier, xp) -> {
            Map<String, Long> kept = new TreeMap<>();
            xp.forEach((skill, v) -> {
                if (v != null && v > 0) kept.put(skill, v);
            });
            if (!kept.isEmpty()) copy.put(tier, Collections.unmodifiableMap(kept));
        });
        return copy.isEmpty() ? EMPTY : new BankedXp(Collections.unmodifiableMap(copy));
    }

    public boolean isEmpty() {
        return byTier.isEmpty();
    }

    /** This with {@code xp} added at {@code tier}. */
    public BankedXp plus(int tier, Map<String, Long> xp) {
        Map<Integer, Map<String, Long>> out = new TreeMap<>();
        byTier.forEach((t, m) -> out.put(t, new HashMap<>(m)));
        Map<String, Long> at = out.computeIfAbsent(tier, t -> new HashMap<>());
        xp.forEach((skill, v) -> {
            if (v != null && v > 0) at.merge(skill, v, Long::sum);
        });
        return of(out);
    }

    /** What a player of {@code userTier} takes, by skill (0 takes nothing). */
    public Map<String, Long> payout(int userTier) {
        MachineXp.Rules rules = MachineXp.rules();
        Map<String, Double> sum = new TreeMap<>();
        byTier.forEach((tier, xp) -> {
            double keep = rules.keeps(Math.min(tier, userTier));
            xp.forEach((skill, v) -> sum.merge(skill, v * keep, Double::sum));
        });
        Map<String, Long> out = new TreeMap<>();
        sum.forEach((skill, v) -> {
            long n = (long) Math.floor(v);
            if (n > 0) out.put(skill, n);
        });
        return out;
    }

    /** Whether some of it came in at a tier above {@code userTier} (so that player takes less than its full share). */
    public boolean above(int userTier) {
        for (int tier : byTier.keySet()) if (tier > userTier) return true;
        return false;
    }

    /** The highest tier any of it came in at. */
    public int topTier() {
        int top = 0;
        for (int tier : byTier.keySet()) top = Math.max(top, tier);
        return top;
    }
}
