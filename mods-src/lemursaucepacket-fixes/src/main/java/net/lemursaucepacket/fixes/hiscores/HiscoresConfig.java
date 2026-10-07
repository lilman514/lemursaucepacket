package net.lemursaucepacket.fixes.hiscores;

import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.tags.TagKey;
import net.minecraft.world.item.Item;
import net.neoforged.fml.loading.FMLPaths;

/**
 * What the hiscores record and rank, from config/lemursaucepacket/hiscores.json (hiscores/build.mjs writes it from
 * hiscores/hiscores.mjs): the skills in order, each main quest's quest points, the activities, the bosses and the
 * collections, and when and where to upload. Read when the server starts, once every mod's items exist.
 */
final class HiscoresConfig {
    record Activity(String id, String name, ResourceLocation stat, int divide) {
    }

    record Boss(String id, String name, boolean counter, List<ResourceLocation> kills) {
    }

    /** A collection: the item ids in it (worked out from its matchers when the server starts). */
    record Collection(String id, String name, Set<String> items) {
    }

    final List<String> skills = new ArrayList<>();
    final Map<String, Integer> questPoints = new LinkedHashMap<>();
    final List<Activity> activities = new ArrayList<>();
    final List<Boss> bosses = new ArrayList<>();
    final List<Collection> collections = new ArrayList<>();
    int recordEvery = 300, uploadEvery = 600;
    String uploadUrl = "";

    static HiscoresConfig load() {
        HiscoresConfig c = new HiscoresConfig();
        Path file = FMLPaths.CONFIGDIR.get().resolve("lemursaucepacket").resolve("hiscores.json");
        if (!Files.isRegularFile(file)) {
            HiscoresModule.LOGGER.warn("No hiscores config at {}: recording skills only", file);
            return c;
        }
        try (Reader reader = Files.newBufferedReader(file)) {
            JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
            for (JsonElement e : root.getAsJsonArray("skills")) c.skills.add(e.getAsString());
            for (JsonElement e : root.getAsJsonArray("questPoints")) {
                JsonObject q = e.getAsJsonObject();
                c.questPoints.put(q.get("tag").getAsString(), q.get("points").getAsInt());
            }
            for (JsonElement e : root.getAsJsonArray("activities")) {
                JsonObject a = e.getAsJsonObject();
                c.activities.add(new Activity(a.get("id").getAsString(), name(a), a.has("stat") ? ResourceLocation.parse(a.get("stat").getAsString()) : null,
                        a.has("divide") ? a.get("divide").getAsInt() : 1));
            }
            for (JsonElement e : root.getAsJsonArray("bosses")) {
                JsonObject b = e.getAsJsonObject();
                List<ResourceLocation> kills = new ArrayList<>();
                if (b.has("kills")) for (JsonElement k : b.getAsJsonArray("kills")) kills.add(ResourceLocation.parse(k.getAsString()));
                c.bosses.add(new Boss(b.get("id").getAsString(), name(b), b.has("counter") && b.get("counter").getAsBoolean(), kills));
            }
            for (JsonElement e : root.getAsJsonArray("collections")) {
                JsonObject col = e.getAsJsonObject();
                Set<String> items = new LinkedHashSet<>();
                for (JsonElement m : col.getAsJsonArray("match")) items.addAll(matching(m.getAsString()));
                c.collections.add(new Collection(col.get("id").getAsString(), name(col), items));
            }
            if (root.has("recordEvery")) c.recordEvery = Math.max(30, root.get("recordEvery").getAsInt());
            if (root.has("uploadEvery")) c.uploadEvery = Math.max(60, root.get("uploadEvery").getAsInt());
            if (root.has("uploadUrl")) c.uploadUrl = root.get("uploadUrl").getAsString();
            // A server of its own can send elsewhere (a test server to a local website): never in the pack.
            Path override = file.resolveSibling("hiscores-url.txt");
            if (Files.isRegularFile(override)) c.uploadUrl = Files.readString(override).trim();
            HiscoresModule.LOGGER.info("Hiscores: {} skills, {} activities, {} bosses, {} collections", c.skills.size(), c.activities.size(), c.bosses.size(), c.collections.size());
        } catch (Exception ex) {
            HiscoresModule.LOGGER.error("Couldn't read the hiscores config {}", file, ex);
        }
        return c;
    }

    private static String name(JsonObject o) {
        return o.has("name") ? o.get("name").getAsString() : o.get("id").getAsString();
    }

    /** The item ids a matcher picks out: an id, #tag, @mod or ~regex. */
    private static Set<String> matching(String m) {
        Set<String> out = new LinkedHashSet<>();
        if (m.startsWith("#")) {
            TagKey<Item> tag = TagKey.create(Registries.ITEM, ResourceLocation.parse(m.substring(1)));
            for (Item item : BuiltInRegistries.ITEM) if (item.builtInRegistryHolder().is(tag)) out.add(BuiltInRegistries.ITEM.getKey(item).toString());
        } else if (m.startsWith("@") || m.startsWith("~")) {
            Pattern pattern = m.startsWith("~") ? Pattern.compile(m.substring(1)) : null;
            String ns = m.substring(1);
            for (ResourceLocation id : BuiltInRegistries.ITEM.keySet()) {
                if (pattern != null ? pattern.matcher(id.toString()).matches() : id.getNamespace().equals(ns)) out.add(id.toString());
            }
        } else if (BuiltInRegistries.ITEM.containsKey(ResourceLocation.parse(m))) {
            out.add(m);
        }
        return out;
    }
}
