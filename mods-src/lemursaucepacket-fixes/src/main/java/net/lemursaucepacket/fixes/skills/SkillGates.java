package net.lemursaucepacket.fixes.skills;

import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import javax.annotation.Nullable;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.tags.TagKey;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.alchemy.PotionContents;
import net.neoforged.fml.loading.FMLPaths;

/**
 * The RuneScape-style gates, config/lemursaucepacket/skill_gates.json (skills/build.mjs writes it from
 * skills/unlocks.mjs), read the same on both sides: the level each made item needs, each brewing ingredient, the drops
 * that wait on a level, the Fishing level for treasure, and how much each potion is worth in Brewing XP. Read on first
 * use, when every mod's items exist.
 */
public final class SkillGates {
    /** A level to have in a skill ("combat" is the combat level); {@code what} names what it unlocks. */
    public record Need(String skill, int level, String what) {
    }

    public record Drop(EntityType<?> entity, Item item, Need need) {
    }

    private static boolean loaded;
    private static final Map<Item, Need> CRAFT = new HashMap<>();
    private static final Map<TagKey<Item>, Need> CRAFT_TAGS = new HashMap<>();
    private static final Map<Item, Need> BREW = new HashMap<>();
    private static final Map<Item, Need> WEAR = new HashMap<>();
    private static final Map<ResourceLocation, Need> RECIPES = new HashMap<>();
    private static JsonObject construction = new JsonObject();
    private static final List<Drop> DROPS = new ArrayList<>();
    private static final Map<String, Integer> POTIONS = new HashMap<>();
    private static final Map<Item, Integer> POTION_FORMS = new HashMap<>();
    private static int fishingTreasure = 0;
    private static double xpBase = 8, xpPerLevel = 2.2;

    private static synchronized void ensureLoaded() {
        if (loaded) return;
        loaded = true;
        Path file = FMLPaths.CONFIGDIR.get().resolve("lemursaucepacket").resolve("skill_gates.json");
        if (!Files.isRegularFile(file)) {
            SkillsModule.LOGGER.warn("No skill gates at {}: nothing is gated", file);
            return;
        }
        try (Reader reader = Files.newBufferedReader(file)) {
            JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
            for (JsonElement e : root.getAsJsonArray("craft")) {
                JsonObject c = e.getAsJsonObject();
                Need need = new Need(c.get("skill").getAsString(), c.get("level").getAsInt(), c.get("what").getAsString());
                for (JsonElement id : c.getAsJsonArray("items")) {
                    String s = id.getAsString();
                    if (s.startsWith("#")) CRAFT_TAGS.put(TagKey.create(Registries.ITEM, ResourceLocation.parse(s.substring(1))), need);
                    else item(s).ifPresent(item -> CRAFT.put(item, need));
                }
            }
            if (root.has("recipes")) for (JsonElement e : root.getAsJsonArray("recipes")) {
                JsonObject r = e.getAsJsonObject();
                RECIPES.put(ResourceLocation.parse(r.get("id").getAsString()), new Need(r.get("skill").getAsString(), r.get("level").getAsInt(), r.get("what").getAsString()));
            }
            if (root.has("construction")) construction = root.getAsJsonObject("construction");
            if (root.has("wear")) for (JsonElement e : root.getAsJsonArray("wear")) {
                JsonObject w = e.getAsJsonObject();
                Need need = new Need(w.get("skill").getAsString(), w.get("level").getAsInt(), w.get("what").getAsString());
                item(w.get("item").getAsString()).ifPresent(item -> WEAR.put(item, need));
            }
            for (JsonElement e : root.getAsJsonArray("brew")) {
                JsonObject b = e.getAsJsonObject();
                Need need = new Need("brewing", b.get("level").getAsInt(), b.get("what").getAsString());
                item(b.get("item").getAsString()).ifPresent(item -> BREW.put(item, need));
            }
            for (JsonElement e : root.getAsJsonArray("drops")) {
                JsonObject d = e.getAsJsonObject();
                var type = BuiltInRegistries.ENTITY_TYPE.getOptional(ResourceLocation.parse(d.get("entity").getAsString()));
                var item = item(d.get("item").getAsString());
                if (type.isPresent() && item.isPresent())
                    DROPS.add(new Drop(type.get(), item.get(), new Need(d.get("skill").getAsString(), d.get("level").getAsInt(), d.get("what").getAsString())));
            }
            if (root.has("potions")) root.getAsJsonObject("potions").entrySet().forEach(p -> POTIONS.put(p.getKey(), p.getValue().getAsInt()));
            if (root.has("potionForms")) root.getAsJsonObject("potionForms").entrySet().forEach(p -> item(p.getKey()).ifPresent(i -> POTION_FORMS.put(i, p.getValue().getAsInt())));
            fishingTreasure = root.has("fishingTreasure") ? root.get("fishingTreasure").getAsInt() : 0;
            if (root.has("brewXp")) {
                xpBase = root.getAsJsonObject("brewXp").get("base").getAsDouble();
                xpPerLevel = root.getAsJsonObject("brewXp").get("perLevel").getAsDouble();
            }
            SkillsModule.LOGGER.info("Skill gates: {} made items (+{} tags), {} recipes, {} worn items, {} brewing ingredients, {} drops, {} potions, fishing treasure at {}",
                    CRAFT.size(), CRAFT_TAGS.size(), RECIPES.size(), WEAR.size(), BREW.size(), DROPS.size(), POTIONS.size(), fishingTreasure);
        } catch (Exception ex) {
            SkillsModule.LOGGER.error("Couldn't read the skill gates {}", file, ex);
        }
    }

    private static Optional<Item> item(String id) {
        return BuiltInRegistries.ITEM.getOptional(ResourceLocation.parse(id));
    }

    /** What making this item needs, or null if anyone can. */
    @Nullable
    public static Need craft(ItemStack stack) {
        if (stack.isEmpty()) return null;
        ensureLoaded();
        Need need = CRAFT.get(stack.getItem());
        if (need != null) return need;
        for (Map.Entry<TagKey<Item>, Need> e : CRAFT_TAGS.entrySet()) if (stack.is(e.getKey())) return e.getValue();
        return null;
    }

    /** What using this recipe needs (Construction's alternate recipes), or null if anyone can. */
    @Nullable
    public static Need recipe(ResourceLocation id) {
        ensureLoaded();
        return RECIPES.get(id);
    }

    /** Construction's part of the file (its XP rules, saving perk and palette), for the construction package. */
    public static JsonObject construction() {
        ensureLoaded();
        return construction;
    }

    /** What wearing this needs, for gear lsp_fixes makes itself (the Climbing Boots), or null if anyone can. */
    @Nullable
    public static Need wear(ItemStack stack) {
        if (stack.isEmpty()) return null;
        ensureLoaded();
        return WEAR.get(stack.getItem());
    }

    /** What brewing with this ingredient needs, or null if anyone can. */
    @Nullable
    public static Need brew(ItemStack stack) {
        if (stack.isEmpty()) return null;
        ensureLoaded();
        return BREW.get(stack.getItem());
    }

    public static List<Drop> drops() {
        ensureLoaded();
        return DROPS;
    }

    public static int fishingTreasure() {
        ensureLoaded();
        return fishingTreasure;
    }

    /** The level a brewed potion took (its kind, and splash or lingering), or -1 for something that isn't one (water). */
    public static int potionLevel(ItemStack stack) {
        ensureLoaded();
        PotionContents contents = stack.get(DataComponents.POTION_CONTENTS);
        if (contents == null || contents.potion().isEmpty()) return -1;
        String id = contents.potion().get().unwrapKey().map(k -> k.location().toString()).orElse("");
        Integer level = POTIONS.get(id);
        if (level == null) return -1;
        return Math.max(level, POTION_FORMS.getOrDefault(stack.getItem(), 0));
    }

    public static double brewXp(int level) {
        ensureLoaded();
        return xpBase + xpPerLevel * level;
    }

    private SkillGates() {
    }
}
