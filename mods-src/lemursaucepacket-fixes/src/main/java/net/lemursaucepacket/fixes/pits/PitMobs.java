package net.lemursaucepacket.fixes.pits;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import javax.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.mojang.brigadier.exceptions.CommandSyntaxException;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.TagParser;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.server.packs.resources.SimpleJsonResourceReloadListener;
import net.minecraft.util.profiling.ProfilerFiller;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.phys.Vec3;

/**
 * What the pit bosses call up mid-fight, from {@code data/lemursaucepacket/lsp_pits/mobs.json} (pits/build.mjs writes
 * it from the same creatures as the events): Jad's and Zuk's menders, the Kal-Tok-Jad and the sets Zuk sends, and the
 * line Zuk's shield drifts along.
 */
public final class PitMobs {
    /** The shield's line, from Zuk's spot: {@code forward} blocks toward the party, sliding from {@code from} to {@code to} across. */
    public record Shield(int forward, int from, int to) {
    }

    private static volatile String jadMenders = "", zukMenders = "", zukJad = "";
    private static volatile List<String> zukSets = List.of();
    private static volatile Shield shield = new Shield(4, -12, 12);

    static String jadMenders() {
        return jadMenders;
    }

    static String zukMenders() {
        return zukMenders;
    }

    static String zukJad() {
        return zukJad;
    }

    static List<String> zukSets() {
        return zukSets;
    }

    static Shield shield() {
        return shield;
    }

    /** The reload listener for data/lemursaucepacket/lsp_pits/mobs.json. */
    public static final class Loader extends SimpleJsonResourceReloadListener {
        public Loader() {
            super(new Gson(), "lsp_pits");
        }

        @Override
        protected void apply(Map<ResourceLocation, JsonElement> files, ResourceManager manager, ProfilerFiller profiler) {
            JsonElement found = files.get(ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "mobs"));
            if (found == null || !found.isJsonObject()) {
                PitsModule.LOGGER.warn("No lsp_pits/mobs.json: the pit bosses call up nobody");
                return;
            }
            JsonObject o = found.getAsJsonObject();
            jadMenders = string(o, "jad_menders");
            zukMenders = string(o, "zuk_menders");
            zukJad = string(o, "zuk_jad");
            List<String> sets = new ArrayList<>();
            if (o.has("zuk_sets")) o.getAsJsonArray("zuk_sets").forEach(e -> sets.add(e.getAsString()));
            zukSets = List.copyOf(sets);
            if (o.has("zuk_shield")) {
                JsonObject s = o.getAsJsonObject("zuk_shield");
                shield = new Shield(s.get("forward").getAsInt(), s.get("from").getAsInt(), s.get("to").getAsInt());
            }
            PitsModule.LOGGER.info("Pit mobs: menders, {} Zuk set(s), shield {}", sets.size(), shield);
        }

        private static String string(JsonObject o, String key) {
            return o.has(key) ? o.get(key).getAsString() : "";
        }
    }

    /** Makes one from SNBT at a place, at full health, facing a way. Null if it couldn't. */
    @Nullable
    static Entity spawn(ServerLevel level, String snbt, Vec3 at, float yaw) {
        if (snbt.isEmpty()) return null;
        try {
            CompoundTag tag = TagParser.parseTag(snbt);
            Entity e = EntityType.loadEntityRecursive(tag, level, made -> {
                made.moveTo(at.x, at.y, at.z, yaw, 0F);
                return made;
            });
            if (e == null) return null;
            if (e instanceof LivingEntity living) living.setHealth(living.getMaxHealth());
            if (e instanceof Mob mob) mob.setPersistenceRequired();
            return level.tryAddFreshEntityWithPassengers(e) ? e : null;
        } catch (CommandSyntaxException ex) {
            PitsModule.LOGGER.error("Bad pit mob SNBT: {}", snbt, ex);
            return null;
        }
    }

    private PitMobs() {
    }
}
