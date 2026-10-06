package net.lemursaucepacket.fixes.economy;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import javax.annotation.Nullable;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import net.lemursaucepacket.fixes.economy.npc.NpcBook;
import net.minecraft.core.Holder;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.tags.TagKey;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.Rarity;
import net.minecraft.world.item.crafting.Ingredient;
import net.minecraft.world.item.crafting.Recipe;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.ItemEnchantments;

/**
 * What vendors pay for things. Every item has a value in coins: the base table (data/<ns>/lsp_economy/*.json) prices raw
 * materials, recipes price everything made from them (the cheapest recipe wins, so crafting never prints money), items
 * nothing prices get a default by rarity, and an item a vendor sells never sells back for more than a share of its
 * price. A stack is worth its item's value times its count, less wear, plus its enchantments.
 *
 * <p>The server computes the table once data is loaded and sends it to every client (the shop's tooltips use it), so
 * both sides value a stack with the same code.
 */
public final class ItemValues {
    /** The table both sides use. Replaced, never mutated. */
    private static volatile Table current = Table.EMPTY;
    /** Server only: where each value came from (base, a recipe id, a vendor cap, a default), for /lsp values get. */
    private static volatile Map<Item, String> sources = Map.of();

    public record Table(Map<Item, Float> values, Set<Item> unsellable, float enchantRate) {
        static final Table EMPTY = new Table(Map.of(), Set.of(), 8f);
    }

    public static Table table() {
        return current;
    }

    /** Installs a table (the client's copy from the server). */
    public static void install(Table table) {
        current = table;
    }

    /** One item's value in coins (0 if it has none). */
    public static double unit(Item item) {
        Float v = current.values().get(item);
        return v == null ? 0 : v;
    }

    /** Why vendors won't buy this stack, or null if they will. */
    @Nullable
    public static String refusal(ItemStack stack) {
        if (stack.isEmpty()) return "nothing";
        if (Coins.is(stack)) return "Coins are what they pay with.";
        if (stack.is(EconomyContent.COIN_POUCH.get())) return "Open it instead: right-click it.";
        if (current.unsellable().contains(stack.getItem())) return "Vendors won't buy that.";
        var container = stack.get(DataComponents.CONTAINER);
        if (container != null && container.nonEmptyStream().findAny().isPresent()) return "Empty it first.";
        var bundle = stack.get(DataComponents.BUNDLE_CONTENTS);
        if (bundle != null && !bundle.isEmpty()) return "Empty it first.";
        if (stack.has(DataComponents.BLOCK_ENTITY_DATA)) return "Empty it first.";
        return null;
    }

    /** What a vendor pays for this whole stack, in coins (fractions included; the sale rounds down). */
    public static double worth(ItemStack stack) {
        if (refusal(stack) != null) return 0;
        double each = unit(stack.getItem());
        if (stack.isDamageableItem() && stack.getMaxDamage() > 0) each *= Math.max(0, 1 - (double) stack.getDamageValue() / stack.getMaxDamage());
        each += enchantments(stack.get(DataComponents.ENCHANTMENTS)) + enchantments(stack.get(DataComponents.STORED_ENCHANTMENTS));
        return each * stack.getCount();
    }

    private static double enchantments(@Nullable ItemEnchantments enchantments) {
        if (enchantments == null || enchantments.isEmpty()) return 0;
        double total = 0;
        for (var entry : enchantments.entrySet()) {
            Holder<Enchantment> holder = entry.getKey();
            total += current.enchantRate() * Math.max(1, holder.value().getAnvilCost()) * entry.getIntValue();
        }
        return total;
    }

    // ---------------------------------------------------------------- building the table (server)

    /** The merged data files, as the reload listener found them. */
    private static List<JsonObject> dataFiles = List.of();

    /** Where an item's value came from (server only). */
    public static String source(Item item) {
        return sources.getOrDefault(item, "none");
    }

    static void setSources(Map<ResourceLocation, JsonElement> files) {
        List<JsonObject> list = new ArrayList<>();
        files.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(e -> {
            if (e.getValue().isJsonObject()) list.add(e.getValue().getAsJsonObject());
        });
        dataFiles = list;
    }

    /** Recomputes the table from the data files, the server's recipes and the vendors' prices. */
    static Table compute(MinecraftServer server) {
        long started = System.nanoTime();
        Map<Item, Double> base = new HashMap<>();
        Set<Item> fixed = new HashSet<>();
        Set<Item> unsellable = new HashSet<>();
        Map<Rarity, Double> defaults = new HashMap<>(Map.of(Rarity.COMMON, 0.5, Rarity.UNCOMMON, 8.0, Rarity.RARE, 32.0, Rarity.EPIC, 128.0));
        double enchantRate = 8;
        double vendorShare = 0.5;
        for (JsonObject json : dataFiles) {
            if (json.has("values")) for (var e : json.getAsJsonObject("values").entrySet()) {
                for (Item item : resolve(e.getKey())) base.put(item, e.getValue().getAsDouble());
            }
            if (json.has("fixed")) for (JsonElement e : json.getAsJsonArray("fixed")) fixed.addAll(resolve(e.getAsString()));
            if (json.has("unsellable")) for (JsonElement e : json.getAsJsonArray("unsellable")) unsellable.addAll(resolve(e.getAsString()));
            if (json.has("default")) for (var e : json.getAsJsonObject("default").entrySet()) {
                try {
                    defaults.put(Rarity.valueOf(e.getKey().toUpperCase(java.util.Locale.ROOT)), e.getValue().getAsDouble());
                } catch (IllegalArgumentException ignored) {
                    EconomyModule.LOGGER.warn("lsp_economy: unknown rarity '{}'", e.getKey());
                }
            }
            if (json.has("enchantment")) enchantRate = json.get("enchantment").getAsDouble();
            if (json.has("vendorShare")) vendorShare = json.get("vendorShare").getAsDouble();
        }

        // No vendor buys back what it sells for more than vendorShare of the cheapest price: no buy-low, sell-high loop.
        Map<Item, Double> caps = new HashMap<>();
        for (var npc : NpcBook.all()) {
            if (npc.shop() == null) continue;
            for (var good : npc.shop().goods()) {
                double unit = (double) good.price() / Math.max(1, good.item().getCount()) * vendorShare;
                caps.merge(good.item().getItem(), unit, Math::min);
            }
        }

        List<Derivation> recipes = derivations(server);
        Map<Item, Double> value = new HashMap<>();
        Map<Item, String> why = new HashMap<>();
        base.forEach((item, v) -> {
            value.put(item, cap(caps, item, v));
            why.put(item, caps.containsKey(item) && caps.get(item) < v ? "vendor cap" : "base");
        });
        derive(value, why, fixed, caps, recipes);
        // Everything still unpriced gets its rarity's default; recipes then price what is made from those. A guessed
        // default never lowers anything the base table or a recipe already priced (that's how a modded ore chunk with
        // no recipe would otherwise make iron worth half a coin).
        Set<Item> known = new HashSet<>(value.keySet());
        for (Item item : BuiltInRegistries.ITEM) {
            if (item == Items.AIR || value.containsKey(item)) continue;
            Rarity rarity = item.getDefaultInstance().getRarity();
            value.put(item, cap(caps, item, defaults.getOrDefault(rarity, 0.5)));
            why.put(item, "default (" + rarity.name().toLowerCase(java.util.Locale.ROOT) + ")");
        }
        Set<Item> settled = new HashSet<>(fixed);
        settled.addAll(known);
        derive(value, why, settled, caps, recipes);

        Map<Item, Float> out = new HashMap<>();
        value.forEach((item, v) -> {
            if (v > 0) out.put(item, (float) (double) v);
        });
        EconomyModule.LOGGER.info("Item values: {} items priced ({} base, {} recipes, {} vendor caps) in {} ms", out.size(), base.size(), recipes.size(), caps.size(), (System.nanoTime() - started) / 1_000_000);
        sources = Map.copyOf(why);
        return new Table(Map.copyOf(out), Set.copyOf(unsellable), (float) enchantRate);
    }

    private static double cap(Map<Item, Double> caps, Item item, double v) {
        Double c = caps.get(item);
        return c == null ? v : Math.min(v, c);
    }

    /** An item id, a "#tag", or a "/regex/" over item ids. */
    private static List<Item> resolve(String key) {
        List<Item> out = new ArrayList<>();
        if (key.startsWith("#")) {
            ResourceLocation id = ResourceLocation.tryParse(key.substring(1));
            if (id == null) return out;
            BuiltInRegistries.ITEM.getTag(TagKey.create(Registries.ITEM, id)).ifPresent(set -> set.forEach(h -> out.add(h.value())));
        } else if (key.length() > 2 && key.startsWith("/") && key.endsWith("/")) {
            Pattern p = Pattern.compile(key.substring(1, key.length() - 1));
            for (var e : BuiltInRegistries.ITEM.entrySet()) if (p.matcher(e.getKey().location().toString()).matches()) out.add(e.getValue());
        } else {
            ResourceLocation id = ResourceLocation.tryParse(key);
            if (id != null && BuiltInRegistries.ITEM.containsKey(id)) out.add(BuiltInRegistries.ITEM.get(id));
        }
        return out;
    }

    /** A recipe reduced to what the values need: what it makes, how many, and its inputs (each a set of options). */
    private record Derivation(String id, Item output, int count, List<ItemStack[]> inputs) {
    }

    private static List<Derivation> derivations(MinecraftServer server) {
        List<Derivation> out = new ArrayList<>();
        for (RecipeHolder<?> holder : server.getRecipeManager().getRecipes()) {
            try {
                Recipe<?> recipe = holder.value();
                if (recipe.isSpecial()) continue;
                ItemStack result = recipe.getResultItem(server.registryAccess());
                if (result == null || result.isEmpty()) continue;
                List<ItemStack[]> inputs = new ArrayList<>();
                for (Ingredient ing : recipe.getIngredients()) {
                    if (ing == null || ing.isEmpty()) continue;
                    ItemStack[] options = ing.getItems();
                    if (options.length == 0) continue;
                    // A tool the recipe only wears down (every option damageable) costs nothing.
                    boolean tool = true;
                    for (ItemStack o : options) if (!o.isDamageableItem()) tool = false;
                    if (!tool) inputs.add(options);
                }
                if (inputs.isEmpty()) continue;
                out.add(new Derivation(holder.id().toString(), result.getItem(), result.getCount(), inputs));
            } catch (Exception e) {
                // A mod's recipe that can't answer outside a crafting context: skip it.
            }
        }
        return out;
    }

    /** Lowers values to what recipes can make things for, until nothing changes. */
    private static void derive(Map<Item, Double> value, Map<Item, String> why, Set<Item> fixed, Map<Item, Double> caps, List<Derivation> recipes) {
        for (int pass = 0; pass < 64; pass++) {
            boolean changed = false;
            for (Derivation r : recipes) {
                if (fixed.contains(r.output())) continue;
                double cost = 0;
                boolean known = true;
                for (ItemStack[] options : r.inputs()) {
                    double best = Double.POSITIVE_INFINITY;
                    for (ItemStack o : options) {
                        Double v = value.get(o.getItem());
                        if (v == null) continue;
                        double c = v * Math.max(1, o.getCount());
                        ItemStack rest = o.getCraftingRemainingItem();
                        if (!rest.isEmpty()) {
                            Double rv = value.get(rest.getItem());
                            if (rv != null) c -= rv * rest.getCount();
                        }
                        best = Math.min(best, Math.max(0, c));
                    }
                    if (best == Double.POSITIVE_INFINITY) {
                        known = false;
                        break;
                    }
                    cost += best;
                }
                if (!known) continue;
                double each = cap(caps, r.output(), cost / Math.max(1, r.count()));
                Double now = value.get(r.output());
                if (now == null || each < now - 1e-9) {
                    value.put(r.output(), each);
                    why.put(r.output(), "recipe " + r.id());
                    changed = true;
                }
            }
            if (!changed) return;
        }
    }

    private ItemValues() {
    }
}
