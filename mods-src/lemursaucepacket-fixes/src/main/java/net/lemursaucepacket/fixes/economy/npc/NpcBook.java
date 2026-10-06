package net.lemursaucepacket.fixes.economy.npc;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import javax.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.mojang.serialization.JsonOps;

import net.lemursaucepacket.fixes.economy.EconomyModule;
import net.minecraft.core.RegistryAccess;
import net.minecraft.resources.RegistryOps;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.server.packs.resources.SimpleJsonResourceReloadListener;
import net.minecraft.util.profiling.ProfilerFiller;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.ItemStack;

/**
 * The townsfolk the economy knows: data/<ns>/lsp_npcs/<who>.json (npcs/build.mjs writes Lemurton's). An Easy NPC entity
 * is one of them when it carries the tag {@code lsp_npc.<who>}.
 *
 * <pre>
 * { "name": "Bessa the Baker",
 *   "talks": [ { "dialog": "quest_market", "when": ["q_welcome_met"], "unless": ["q_welcome_bread"] },
 *              { "dialog": "default", "intro": true } ],
 *   "shop": { "goods": [ { "item": { "id": "minecraft:bread", "count": 4 }, "price": 40 } ],
 *             "onBuy": [ "tag {player} add q_welcome_bread" ] },
 *   "quests": [ { "title": "Welcome to Lemurton", "steps": [ { "text": "...", "stage": "q_welcome_met" } ] } ] }
 * </pre>
 */
public final class NpcBook {
    public static final String TAG_PREFIX = "lsp_npc.";

    /** A dialog to show before anything else: an intro (first meeting only) or one that waits on quest stages. Each plays once. */
    public record Talk(String dialog, boolean intro, List<String> when, List<String> unless) {
    }

    public record Good(ItemStack item, long price) {
    }

    public record Shop(List<Good> goods, List<String> onBuy) {
    }

    public record Step(String text, String stage) {
    }

    public record QuestLine(String title, List<Step> steps) {
    }

    public record Npc(String id, String name, int color, List<Talk> talks, @Nullable Shop shop, List<QuestLine> quests) {
    }

    private static volatile Map<String, Npc> npcs = Map.of();

    public static Collection<Npc> all() {
        return npcs.values();
    }

    @Nullable
    public static Npc get(String id) {
        return npcs.get(id);
    }

    /** Which of ours an entity is (its lsp_npc.<who> tag), or null. */
    @Nullable
    public static Npc of(Entity entity) {
        for (String tag : entity.getTags()) if (tag.startsWith(TAG_PREFIX)) return npcs.get(tag.substring(TAG_PREFIX.length()));
        return null;
    }

    /** The reload listener for data/<ns>/lsp_npcs. */
    public static final class Loader extends SimpleJsonResourceReloadListener {
        private final RegistryAccess registries;

        public Loader(RegistryAccess registries) {
            super(new Gson(), "lsp_npcs");
            this.registries = registries;
        }

        @Override
        protected void apply(Map<ResourceLocation, JsonElement> files, ResourceManager manager, ProfilerFiller profiler) {
            RegistryOps<JsonElement> ops = RegistryOps.create(JsonOps.INSTANCE, registries);
            Map<String, Npc> out = new TreeMap<>();
            files.forEach((file, json) -> {
                String id = file.getPath();
                try {
                    out.put(id, parse(id, json.getAsJsonObject(), ops));
                } catch (Exception e) {
                    EconomyModule.LOGGER.error("lsp_npcs/{}.json: {}", id, e.toString());
                }
            });
            npcs = Map.copyOf(out);
            EconomyModule.LOGGER.info("Townsfolk: {} ({} with shops)", out.size(), out.values().stream().filter(n -> n.shop() != null).count());
        }
    }

    private static Npc parse(String id, JsonObject json, RegistryOps<JsonElement> ops) {
        String name = json.has("name") ? json.get("name").getAsString() : id;
        int color = 0xFFFFFF;
        if (json.has("color")) color = Integer.parseInt(json.get("color").getAsString().replace("#", ""), 16);
        List<Talk> talks = new ArrayList<>();
        if (json.has("talks")) for (JsonElement e : json.getAsJsonArray("talks")) {
            JsonObject t = e.getAsJsonObject();
            talks.add(new Talk(t.get("dialog").getAsString(), t.has("intro") && t.get("intro").getAsBoolean(), strings(t, "when"), strings(t, "unless")));
        }
        Shop shop = null;
        if (json.has("shop")) {
            JsonObject s = json.getAsJsonObject("shop");
            List<Good> goods = new ArrayList<>();
            for (JsonElement e : s.getAsJsonArray("goods")) {
                JsonObject g = e.getAsJsonObject();
                ItemStack item = ItemStack.CODEC.parse(ops, g.get("item")).getOrThrow(msg -> new IllegalArgumentException("good " + goods.size() + ": " + msg));
                long price = g.get("price").getAsLong();
                if (price <= 0) throw new IllegalArgumentException("good " + goods.size() + " has no price");
                goods.add(new Good(item, price));
            }
            shop = new Shop(List.copyOf(goods), strings(s, "onBuy"));
        }
        List<QuestLine> quests = new ArrayList<>();
        if (json.has("quests")) for (JsonElement e : json.getAsJsonArray("quests")) {
            JsonObject q = e.getAsJsonObject();
            List<Step> steps = new ArrayList<>();
            for (JsonElement se : q.getAsJsonArray("steps")) {
                JsonObject st = se.getAsJsonObject();
                steps.add(new Step(st.get("text").getAsString(), st.get("stage").getAsString()));
            }
            quests.add(new QuestLine(q.get("title").getAsString(), List.copyOf(steps)));
        }
        return new Npc(id, name, color, List.copyOf(talks), shop, List.copyOf(quests));
    }

    private static List<String> strings(JsonObject json, String key) {
        if (!json.has(key)) return List.of();
        List<String> out = new ArrayList<>();
        JsonArray array = json.getAsJsonArray(key);
        for (JsonElement e : array) out.add(e.getAsString());
        return List.copyOf(out);
    }

    private NpcBook() {
    }
}
