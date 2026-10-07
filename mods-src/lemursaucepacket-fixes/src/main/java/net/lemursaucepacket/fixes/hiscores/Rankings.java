package net.lemursaucepacket.fixes.hiscores;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import net.lemursaucepacket.fixes.skills.Levels;

/**
 * The hiscores' tables, worked out from everyone's last record: Overall (total level, then total XP), each skill (by
 * XP), the combat level, and each activity, boss and collection (by count; nobody with none is ranked). Ties go to
 * names, A to Z.
 */
final class Rankings {
    enum Kind { OVERALL, SKILL, COMBAT, ACTIVITY, BOSS, COLLECTION }

    record Table(String id, String name, Kind kind) {
    }

    /** One player's row: value is what ranks them; level is a skill's level (or the total level). */
    record Row(UUID uuid, String name, long value, int level) {
    }

    static Map<String, Table> tables(HiscoresConfig cfg) {
        Map<String, Table> out = new LinkedHashMap<>();
        out.put("overall", new Table("overall", "Overall", Kind.OVERALL));
        for (String s : cfg.skills) out.put(s, new Table(s, Levels.name(s), Kind.SKILL));
        out.put("combat", new Table("combat", "Combat level", Kind.COMBAT));
        for (HiscoresConfig.Activity a : cfg.activities) out.put(a.id(), new Table(a.id(), a.name(), Kind.ACTIVITY));
        for (HiscoresConfig.Boss b : cfg.bosses) out.put(b.id(), new Table(b.id(), b.name(), Kind.BOSS));
        for (HiscoresConfig.Collection c : cfg.collections) out.put(c.id(), new Table(c.id(), c.name(), Kind.COLLECTION));
        return out;
    }

    static List<Row> rank(HiscoresStore store, Table t) {
        List<Row> rows = new ArrayList<>();
        for (HiscoresStore.Entry e : store.all()) {
            JsonObject r = e.record;
            if (r == null || !r.has("skills")) continue;
            Row row = switch (t.kind()) {
                case OVERALL -> new Row(e.uuid, e.name, num(r.getAsJsonObject("total"), "xp"), (int) num(r.getAsJsonObject("total"), "level"));
                case SKILL -> {
                    JsonObject s = r.getAsJsonObject("skills").getAsJsonObject(t.id());
                    yield s == null ? null : new Row(e.uuid, e.name, num(s, "xp"), (int) num(s, "level"));
                }
                case COMBAT -> new Row(e.uuid, e.name, num(r, "combat"), (int) num(r, "combat"));
                case ACTIVITY -> new Row(e.uuid, e.name, num(r.getAsJsonObject("activities"), t.id()), 0);
                case BOSS -> new Row(e.uuid, e.name, num(r.getAsJsonObject("bosses"), t.id()), 0);
                case COLLECTION -> new Row(e.uuid, e.name, num(r.getAsJsonObject("collections"), t.id()), 0);
            };
            if (row == null) continue;
            if (t.kind() != Kind.OVERALL && t.kind() != Kind.COMBAT && row.value() <= 0) continue;
            rows.add(row);
        }
        Comparator<Row> order = t.kind() == Kind.OVERALL
                ? Comparator.comparingInt(Row::level).reversed().thenComparing(Comparator.comparingLong(Row::value).reversed())
                : Comparator.comparingLong(Row::value).reversed();
        rows.sort(order.thenComparing(Row::name, String.CASE_INSENSITIVE_ORDER));
        return rows;
    }

    /** A player's rank in a table (1-based), or 0 if they aren't in it. */
    static int rankOf(List<Row> rows, UUID uuid) {
        for (int i = 0; i < rows.size(); i++) if (rows.get(i).uuid().equals(uuid)) return i + 1;
        return 0;
    }

    static long num(JsonObject o, String key) {
        if (o == null) return 0;
        JsonElement e = o.get(key);
        return e == null || e.isJsonNull() ? 0 : e.getAsLong();
    }

    private Rankings() {
    }
}
