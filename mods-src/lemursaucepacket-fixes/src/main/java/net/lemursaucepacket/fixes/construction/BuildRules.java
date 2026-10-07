package net.lemursaucepacket.fixes.construction;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import net.lemursaucepacket.fixes.skills.SkillGates;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.tags.BlockTags;
import net.minecraft.tags.TagKey;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.crafting.Ingredient;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.ChangeOverTimeBlock;
import net.minecraft.world.level.block.FallingBlock;
import net.neoforged.neoforge.server.ServerLifecycleHooks;

/**
 * Construction's rules, from config/lemursaucepacket/skill_gates.json (skills/unlocks.mjs): the XP each block pays, the
 * blocks the saving perk may give back, and the Mason's Palette's blocks by category. Blocks are matched by id, tag
 * (#), mod (@), regex over the id (~) or "*entity" (has a block entity), as in skills/unlocks.mjs.
 *
 * <p>Neither the perk nor the palette touches anything Create crushes, mills or washes into something: those come from
 * the server's own recipes, so a free block could never be ground into resources even if one got out.
 */
public final class BuildRules {
    private static final Set<String> PROCESSING = Set.of("create:crushing", "create:milling", "create:splashing");
    private static final String WRENCHABLE = "com.simibubi.create.content.equipment.wrench.IWrenchable";

    public record Category(String name, ResourceLocation icon, List<Block> blocks) {
    }

    private record XpRule(int xp, List<Predicate<Block>> match) {
    }

    private static boolean parsed;
    private static final List<XpRule> XP_RULES = new ArrayList<>();
    private static double savePerLevel;
    private static int paletteLevel = 99;
    private static long paletteCoins = 10000;
    private static final List<Predicate<Block>> NEVER = new ArrayList<>();
    private static final Set<ResourceLocation> ENTITIES_ALLOWED = new HashSet<>();
    private static final List<Predicate<Block>> PROCESSING_ALLOWED = new ArrayList<>();
    private static final List<Map.Entry<String, Map.Entry<ResourceLocation, List<Predicate<Block>>>>> CATEGORY_RULES = new ArrayList<>();

    private static final Map<Block, Integer> XP = Collections.synchronizedMap(new IdentityHashMap<>());
    private static volatile Set<Item> processable;
    private static volatile List<Category> categories;
    private static volatile Map<Block, Category> paletteOf;
    private static Class<?> wrenchable;
    private static boolean wrenchableLooked;

    // ---------------------------------------------------------------- reading the rules

    private static synchronized void parse() {
        if (parsed) return;
        parsed = true;
        JsonObject c = SkillGates.construction();
        if (c.has("xp")) for (JsonElement e : c.getAsJsonArray("xp")) {
            JsonObject r = e.getAsJsonObject();
            XP_RULES.add(new XpRule(r.get("xp").getAsInt(), matchers(r.getAsJsonArray("match"))));
        }
        savePerLevel = c.has("savePerLevel") ? c.get("savePerLevel").getAsDouble() : 0;
        JsonObject p = c.has("palette") ? c.getAsJsonObject("palette") : new JsonObject();
        if (p.has("level")) paletteLevel = p.get("level").getAsInt();
        if (p.has("coins")) paletteCoins = p.get("coins").getAsLong();
        if (p.has("never")) NEVER.addAll(matchers(p.getAsJsonArray("never")));
        if (p.has("blockEntities")) for (JsonElement e : p.getAsJsonArray("blockEntities")) ENTITIES_ALLOWED.add(ResourceLocation.parse(e.getAsString()));
        if (p.has("processingAllowed")) PROCESSING_ALLOWED.addAll(matchers(p.getAsJsonArray("processingAllowed")));
        if (p.has("categories")) for (JsonElement e : p.getAsJsonArray("categories")) {
            JsonObject cat = e.getAsJsonObject();
            CATEGORY_RULES.add(Map.entry(cat.get("name").getAsString(), Map.entry(ResourceLocation.parse(cat.get("icon").getAsString()), matchers(cat.getAsJsonArray("match")))));
        }
        ConstructionModule.LOGGER.info("Construction: {} XP rules, saving {} a level, the palette at {} in {} categories", XP_RULES.size(), savePerLevel, paletteLevel, CATEGORY_RULES.size());
    }

    private static List<Predicate<Block>> matchers(JsonArray list) {
        List<Predicate<Block>> out = new ArrayList<>();
        if (list != null) for (JsonElement e : list) out.add(matcher(e.getAsString()));
        return out;
    }

    /** One matcher from skills/unlocks.mjs: an id, #tag, @mod, ~regex, or *entity. */
    static Predicate<Block> matcher(String m) {
        if (m.equals("*entity")) return b -> b.defaultBlockState().hasBlockEntity();
        if (m.startsWith("#")) {
            TagKey<Block> tag = TagKey.create(Registries.BLOCK, ResourceLocation.parse(m.substring(1)));
            return b -> b.builtInRegistryHolder().is(tag);
        }
        if (m.startsWith("@")) {
            String ns = m.substring(1);
            return b -> BuiltInRegistries.BLOCK.getKey(b).getNamespace().equals(ns);
        }
        if (m.startsWith("~")) {
            Pattern pattern = Pattern.compile(m.substring(1));
            return b -> pattern.matcher(BuiltInRegistries.BLOCK.getKey(b).toString()).matches();
        }
        ResourceLocation id = ResourceLocation.parse(m);
        return b -> BuiltInRegistries.BLOCK.getKey(b).equals(id);
    }

    private static boolean any(List<Predicate<Block>> list, Block b) {
        for (Predicate<Block> m : list) if (m.test(b)) return true;
        return false;
    }

    /** After a datapack reload: tags and recipes may have changed. */
    static void invalidate() {
        XP.clear();
        processable = null;
        categories = null;
        paletteOf = null;
    }

    // ---------------------------------------------------------------- XP and the saving perk

    /** The Construction XP a block pays when it's placed (first rule that matches; 0 if none). */
    public static int xp(Block block) {
        parse();
        return XP.computeIfAbsent(block, b -> {
            for (XpRule r : XP_RULES) if (any(r.match(), b)) return r.xp();
            return 0;
        });
    }

    public static double saveChance(int level) {
        parse();
        return Math.max(0, level) * savePerLevel;
    }

    /** Whether the saving perk may give this block back: a building block that pays XP, plain, and not grist for Create. */
    public static boolean saveEligible(Block block) {
        return xp(block) > 0 && plain(block, false) && !processable(block);
    }

    /**
     * A block that stays what it was and holds nothing: no block entity (bar the allowed ones), nothing that falls or
     * changes on its own (copper weathering), nothing Create's wrench can pick up, and it has an item.
     */
    static boolean plain(Block b, boolean allowEntities) {
        if (b.asItem() == Items.AIR || !(b.asItem() instanceof BlockItem)) return false;
        if (b.defaultBlockState().hasBlockEntity() && !(allowEntities && ENTITIES_ALLOWED.contains(BuiltInRegistries.BLOCK.getKey(b)))) return false;
        if (b instanceof FallingBlock || b instanceof ChangeOverTimeBlock<?>) return false;
        Class<?> w = wrenchable();
        return w == null || !w.isInstance(b);
    }

    private static synchronized Class<?> wrenchable() {
        if (!wrenchableLooked) {
            wrenchableLooked = true;
            try {
                wrenchable = Class.forName(WRENCHABLE, false, BuildRules.class.getClassLoader());
            } catch (ClassNotFoundException | LinkageError e) {
                wrenchable = null;
            }
        }
        return wrenchable;
    }

    /** Whether Create crushes, mills or washes this block's item into something (bar what the palette lets through). */
    static boolean processable(Block block) {
        Set<Item> set = processable;
        if (set == null) set = rebuildProcessable();
        return set.contains(block.asItem()) && !any(PROCESSING_ALLOWED, block);
    }

    private static synchronized Set<Item> rebuildProcessable() {
        if (processable != null) return processable;
        Set<Item> out = new HashSet<>();
        MinecraftServer server = ServerLifecycleHooks.getCurrentServer();
        if (server != null) {
            for (var holder : server.getRecipeManager().getRecipes()) {
                ResourceLocation type = BuiltInRegistries.RECIPE_TYPE.getKey(holder.value().getType());
                if (type == null || !PROCESSING.contains(type.toString())) continue;
                for (Ingredient ingredient : holder.value().getIngredients()) for (ItemStack s : ingredient.getItems()) out.add(s.getItem());
            }
        }
        processable = out;
        return out;
    }

    // ---------------------------------------------------------------- the Mason's Palette

    public static int paletteLevel() {
        parse();
        return paletteLevel;
    }

    public static long paletteCoins() {
        parse();
        return paletteCoins;
    }

    /** The palette's blocks, in categories (each block in the first category that matches it). Server side. */
    public static List<Category> palette() {
        List<Category> list = categories;
        if (list == null) list = rebuildPalette();
        return list;
    }

    public static boolean paletteAllows(Block block) {
        if (paletteOf == null) rebuildPalette();
        return paletteOf.containsKey(block);
    }

    private static synchronized List<Category> rebuildPalette() {
        if (categories != null) return categories;
        parse();
        Map<String, List<Block>> by = new LinkedHashMap<>();
        for (var c : CATEGORY_RULES) by.put(c.getKey(), new ArrayList<>());
        List<String[]> woods = woods();
        for (Block b : BuiltInRegistries.BLOCK) {
            if (any(NEVER, b) || !plain(b, true) || processable(b) || woodish(b, woods)) continue;
            for (var c : CATEGORY_RULES) {
                if (any(c.getValue().getValue(), b)) {
                    by.get(c.getKey()).add(b);
                    break;
                }
            }
        }
        List<Category> out = new ArrayList<>();
        Map<Block, Category> of = new IdentityHashMap<>();
        int total = 0;
        for (var c : CATEGORY_RULES) {
            List<Block> blocks = by.get(c.getKey());
            if (blocks.isEmpty()) continue;
            ResourceLocation icon = c.getValue().getKey();
            if (!BuiltInRegistries.ITEM.containsKey(icon)) icon = BuiltInRegistries.ITEM.getKey(blocks.get(0).asItem());
            Category cat = new Category(c.getKey(), icon, List.copyOf(blocks));
            out.add(cat);
            for (Block b : blocks) of.put(b, cat);
            total += blocks.size();
        }
        paletteOf = of;
        categories = List.copyOf(out);
        ConstructionModule.LOGGER.info("The Mason's Palette: {} blocks in {} categories", total, out.size());
        return categories;
    }

    /** Every kind of wood in the game, as the words of its planks' name ("dark", "oak"): modded woods too. */
    private static List<String[]> woods() {
        List<String[]> out = new ArrayList<>();
        for (Block b : BuiltInRegistries.BLOCK) {
            if (!b.builtInRegistryHolder().is(BlockTags.PLANKS)) continue;
            String path = BuiltInRegistries.BLOCK.getKey(b).getPath();
            if (path.endsWith("_planks")) out.add(path.substring(path.lastIndexOf('/') + 1, path.length() - "_planks".length()).split("_"));
        }
        return out;
    }

    /** Whether a block's name has a kind of wood in it, word for word (so "dark_prismarine" isn't dark oak). */
    private static boolean woodish(Block b, List<String[]> woods) {
        String[] words = BuiltInRegistries.BLOCK.getKey(b).getPath().split("[_/]");
        for (String[] wood : woods) {
            for (int i = 0; i + wood.length <= words.length; i++) {
                boolean all = true;
                for (int j = 0; j < wood.length && all; j++) all = words[i + j].equals(wood[j]);
                if (all) return true;
            }
        }
        return false;
    }

    private BuildRules() {
    }
}
