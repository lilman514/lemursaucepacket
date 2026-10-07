package net.lemursaucepacket.fixes.capes;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

/**
 * A player's capes, kept through death: the capes they've earned (only those can be worn), the flags quest rewards set
 * ({@code lsp cape flag}), and the capes whose item they've been handed (unlocking hands one over; capes earned before
 * capes were items get theirs at the next login).
 */
public final class CapeData {
    public final Set<String> unlocked = new LinkedHashSet<>();
    public final Set<String> flags = new LinkedHashSet<>();
    public final Set<String> given = new LinkedHashSet<>();

    public static final Codec<CapeData> CODEC = RecordCodecBuilder.create(i -> i.group(
            Codec.STRING.listOf().optionalFieldOf("unlocked", List.of()).forGetter(d -> List.copyOf(d.unlocked)),
            Codec.STRING.listOf().optionalFieldOf("flags", List.of()).forGetter(d -> List.copyOf(d.flags)),
            Codec.STRING.listOf().optionalFieldOf("given", List.of()).forGetter(d -> List.copyOf(d.given)))
            .apply(i, CapeData::of));

    static CapeData of(List<String> unlocked, List<String> flags, List<String> given) {
        CapeData d = new CapeData();
        d.unlocked.addAll(unlocked);
        d.flags.addAll(flags);
        d.given.addAll(given);
        return d;
    }

    /** How many flags start with {@code prefix} (the Completionist Cape counts finished chapters). */
    public long flagsStartingWith(String prefix) {
        return flags.stream().filter(f -> f.startsWith(prefix)).count();
    }
}
