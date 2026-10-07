package net.lemursaucepacket.fixes.capes;

import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.annotation.Nullable;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.neoforged.fml.loading.FMLPaths;

/**
 * The cape list, config/lemursaucepacket/capes.json (written by capes/build.mjs from capes/capes.mjs), read the same on
 * the server and the client. Each cape is an item, {@code lemursaucepacket:<id>} (KubeJS registers them from the same
 * file, startup_scripts/capes.js), worn in the Curios "cape" slot.
 */
public final class CapeDefs {
    public static final String NAMESPACE = "lemursaucepacket";
    private static final Map<String, Def> DEFS = new LinkedHashMap<>();

    /** Where a lost cape can be had again: an NPC ({@code lsp_npc.<npc>}), what they ask, and a line for the screen. */
    public record Reclaim(String npc, String where, long coins, String note) {
    }

    /**
     * One cape. {@code unlock} and {@code perk} are kept as JSON (the shapes are in capes/capes.mjs); {@code frames} is 1
     * for a still cape and the frame count for an animated one ({@code <texture>_f<n>.png}).
     */
    public record Def(String id, String name, String kind, String description, @Nullable String perkText, JsonObject perk, JsonObject unlock,
            ResourceLocation texture, int frames, @Nullable Reclaim reclaim, @Nullable ResourceLocation kit) {
        public ResourceLocation itemId() {
            return ResourceLocation.fromNamespaceAndPath(NAMESPACE, id);
        }

        /** The cape's item, or air if it isn't registered (a cape added to the list without a restart). */
        public Item item() {
            return BuiltInRegistries.ITEM.get(itemId());
        }

        public ItemStack stack() {
            Item item = item();
            return item == Items.AIR ? ItemStack.EMPTY : new ItemStack(item);
        }

        /** The texture to draw now: the cape's own, or the current frame of an animated one (a frame every four ticks). */
        public ResourceLocation texture(long ticks) {
            if (frames <= 1) return texture;
            String path = texture.getPath();
            return ResourceLocation.fromNamespaceAndPath(texture.getNamespace(), path.substring(0, path.length() - 4) + "_f" + (int) ((ticks / 4) % frames) + ".png");
        }

        public boolean animated() {
            return frames > 1;
        }

        /** What comes with the cape when it's handed over (the Construction Cape's Mason's Palette), or nothing. */
        public ItemStack kitStack() {
            if (kit == null) return ItemStack.EMPTY;
            Item item = BuiltInRegistries.ITEM.get(kit);
            return item == Items.AIR ? ItemStack.EMPTY : new ItemStack(item);
        }
    }

    static void load() {
        DEFS.clear();
        Path file = FMLPaths.CONFIGDIR.get().resolve("lemursaucepacket").resolve("capes.json");
        if (!Files.isRegularFile(file)) {
            CapesModule.LOGGER.warn("No cape list at {}: capes are off", file);
            return;
        }
        try (Reader reader = Files.newBufferedReader(file)) {
            JsonObject capes = JsonParser.parseReader(reader).getAsJsonObject().getAsJsonObject("capes");
            for (Map.Entry<String, JsonElement> e : capes.entrySet()) {
                JsonObject c = e.getValue().getAsJsonObject();
                JsonObject r = c.has("reclaim") && c.get("reclaim").isJsonObject() ? c.getAsJsonObject("reclaim") : null;
                Reclaim reclaim = r == null ? null : new Reclaim(str(r, "npc", ""), str(r, "where", ""), r.has("coins") ? r.get("coins").getAsLong() : 0, str(r, "note", ""));
                DEFS.put(e.getKey(), new Def(e.getKey(), str(c, "name", e.getKey()), str(c, "kind", "quest"), str(c, "description", ""),
                        c.has("perkText") && !c.get("perkText").isJsonNull() ? c.get("perkText").getAsString() : null,
                        c.has("perk") && c.get("perk").isJsonObject() ? c.getAsJsonObject("perk") : new JsonObject(),
                        c.has("unlock") && c.get("unlock").isJsonObject() ? c.getAsJsonObject("unlock") : new JsonObject(),
                        ResourceLocation.parse(str(c, "texture", NAMESPACE + ":textures/capes/" + e.getKey() + ".png")),
                        c.has("frames") ? Math.max(1, c.get("frames").getAsInt()) : 1, reclaim,
                        c.has("kit") && !c.get("kit").isJsonNull() ? ResourceLocation.parse(c.get("kit").getAsString()) : null));
            }
            CapesModule.LOGGER.info("{} capes from {}", DEFS.size(), file);
        } catch (Exception ex) {
            CapesModule.LOGGER.error("Couldn't read the cape list {}", file, ex);
        }
    }

    private static String str(JsonObject o, String key, String fallback) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : fallback;
    }

    public static Collection<Def> all() {
        return DEFS.values();
    }

    @Nullable
    public static Def get(String id) {
        return DEFS.get(id);
    }

    /** Which cape an item is, or null. */
    @Nullable
    public static Def of(ItemStack stack) {
        if (stack.isEmpty()) return null;
        ResourceLocation key = BuiltInRegistries.ITEM.getKey(stack.getItem());
        return NAMESPACE.equals(key.getNamespace()) ? DEFS.get(key.getPath()) : null;
    }

    private CapeDefs() {
    }
}
