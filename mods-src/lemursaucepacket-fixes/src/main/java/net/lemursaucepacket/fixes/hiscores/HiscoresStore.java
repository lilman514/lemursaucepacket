package net.lemursaucepacket.fixes.hiscores;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.StringTag;
import net.minecraft.nbt.Tag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.saveddata.SavedData;

/**
 * Everyone's hiscores, kept with the world (data/lsp_hiscores.dat) so a player who's offline still ranks: each player's
 * last record (what's ranked and uploaded, as JSON), the kinds of item they've had (the collection log), and the
 * counters lsp_fixes keeps for them (bosses with no statistic of their own).
 */
public final class HiscoresStore extends SavedData {
    private static final String NAME = "lsp_hiscores";
    private static final Factory<HiscoresStore> FACTORY = new Factory<>(HiscoresStore::new, HiscoresStore::load, null);

    static final class Entry {
        final UUID uuid;
        String name;
        JsonObject record = new JsonObject();
        final Set<String> seen = new HashSet<>();
        final Map<String, Long> counters = new HashMap<>();

        Entry(UUID uuid, String name) {
            this.uuid = uuid;
            this.name = name;
        }
    }

    private final Map<UUID, Entry> entries = new LinkedHashMap<>();
    /** Changed since the last upload (everyone, after a restart: one full upload costs nothing). */
    final Set<UUID> pending = new HashSet<>();

    public static HiscoresStore get(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(FACTORY, NAME);
    }

    Entry entry(UUID uuid, String name) {
        Entry e = entries.computeIfAbsent(uuid, u -> new Entry(u, name));
        if (name != null && !name.isEmpty()) e.name = name;
        return e;
    }

    Entry find(UUID uuid) {
        return entries.get(uuid);
    }

    Entry findByName(String name) {
        for (Entry e : entries.values()) if (e.name.equalsIgnoreCase(name)) return e;
        return null;
    }

    Collection<Entry> all() {
        return entries.values();
    }

    void changed(UUID uuid) {
        pending.add(uuid);
        setDirty();
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider registries) {
        ListTag list = new ListTag();
        for (Entry e : entries.values()) {
            CompoundTag p = new CompoundTag();
            p.putString("uuid", e.uuid.toString());
            p.putString("name", e.name);
            p.putString("record", e.record.toString());
            ListTag seen = new ListTag();
            for (String id : e.seen) seen.add(StringTag.valueOf(id));
            p.put("seen", seen);
            CompoundTag counters = new CompoundTag();
            e.counters.forEach(counters::putLong);
            p.put("counters", counters);
            list.add(p);
        }
        tag.put("players", list);
        return tag;
    }

    private static HiscoresStore load(CompoundTag tag, HolderLookup.Provider registries) {
        HiscoresStore s = new HiscoresStore();
        for (Tag t : tag.getList("players", Tag.TAG_COMPOUND)) {
            CompoundTag p = (CompoundTag) t;
            try {
                Entry e = s.entry(UUID.fromString(p.getString("uuid")), p.getString("name"));
                e.record = JsonParser.parseString(p.getString("record")).getAsJsonObject();
                for (Tag id : p.getList("seen", Tag.TAG_STRING)) e.seen.add(id.getAsString());
                CompoundTag counters = p.getCompound("counters");
                for (String key : counters.getAllKeys()) e.counters.put(key, counters.getLong(key));
                s.pending.add(e.uuid);
            } catch (RuntimeException ex) {
                HiscoresModule.LOGGER.warn("Skipping a broken hiscores record", ex);
            }
        }
        return s;
    }
}
