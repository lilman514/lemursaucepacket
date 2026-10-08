package net.lemursaucepacket.fixes.skills.client;

import java.io.Reader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import harmonised.pmmo.core.Core;
import harmonised.pmmo.storage.Experience;
import net.lemursaucepacket.fixes.pmmo.SkillHud;
import net.minecraft.client.Minecraft;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.ItemStack;
import net.neoforged.fml.LogicalSide;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The skill screens' data: assets/lemursaucepacket/skill_guide.json (written by skills/build.mjs from
 * skills/unlocks.mjs) says how the skills are grouped, what trains each one, what every level gives and what each level
 * unlocks; the player's own levels and XP come from Project MMO's client data.
 */
public final class SkillGuideData {
    static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/skills");

    /** One unlock: a level, what sort of thing (make, wear, plant...), what it is, and an item to show (or none). */
    public record Unlock(int level, String kind, String title, ItemStack icon) {
    }

    public record Info(String id, String trainedBy, String perLevel, List<Unlock> unlocks) {
    }

    /** A group of skills (Project MMO's skill types): combat, gathering, artisan, support. */
    public record Group(String id, String name, int color, List<String> skills) {
    }

    /** A skill's standing: its level, the XP into that level and the step to the next, the XP in all, and if it's maxed. */
    public record Standing(int level, long into, long step, long total, boolean max) {
        public float progress() {
            return max ? 1 : step <= 0 ? 0 : (float) Math.min(1, Math.max(0, (double) into / step));
        }

        public long toNext() {
            return max ? 0 : Math.max(0, step - into);
        }
    }

    private static final Group NO_GROUP = new Group("", "", 0xFFE0AC46, List.of());
    private static Map<String, Info> skills;
    private static List<Group> groups;

    /** Forgets what was read (resources reloaded). */
    static void reset() {
        skills = null;
        groups = null;
    }

    /** Every skill, in the guide's order (combat, gathering, artisan, support). */
    public static List<String> skills() {
        load();
        return List.copyOf(skills.keySet());
    }

    public static List<Group> groups() {
        load();
        return groups;
    }

    public static Group group(String skill) {
        for (Group g : groups()) if (g.skills().contains(skill)) return g;
        return NO_GROUP;
    }

    public static Info of(String skill) {
        load();
        return skills.getOrDefault(skill, new Info(skill, "", "", List.of()));
    }

    public static Component name(String skill) {
        return Component.translatable("pmmo." + skill);
    }

    /** The first unlock above a level (null when there are none). */
    public static Unlock next(String skill, int level) {
        for (Unlock u : of(skill).unlocks()) if (u.level() > level) return u;
        return null;
    }

    /** The skill's icon, Project MMO's (the pack's own 64-pixel art). */
    public static ResourceLocation icon(String skill) {
        return SkillHud.definition(skill).getIcon();
    }

    public static int iconSize(String skill) {
        return Math.max(1, SkillHud.definition(skill).getIconSize());
    }

    public static int maxLevel(String skill) {
        return (int) Math.min(Integer.MAX_VALUE, SkillHud.definition(skill).getMaxLevel());
    }

    public static Standing standing(String skill) {
        try {
            Map<String, Experience> xp = Core.get(LogicalSide.CLIENT).getData().getXpMap(null);
            Experience e = xp.get(skill);
            if (e == null) return new Standing(0, 0, step(0), 0, false);
            long level = e.getLevel().getLevel();
            long into = e.getXp();
            // Project MMO keeps the level and the XP into it; the XP in all adds every level's step below it.
            long total = into;
            for (long i = 0; i < level; i++) {
                long step = step(i);
                if (step == Long.MAX_VALUE) break;
                total += step;
            }
            boolean max = level >= maxLevel(skill);
            return new Standing((int) level, into, e.getLevel().getXpToNext(), total, max);
        } catch (Throwable t) {
            return new Standing(0, 0, 0, 0, false);
        }
    }

    /** The XP still needed to reach a level (0 once it's reached). */
    public static long xpTo(Standing s, int level) {
        if (s.level() >= level) return 0;
        long need = -s.into();
        for (long i = s.level(); i < level; i++) {
            long step = step(i);
            if (step == Long.MAX_VALUE) return Long.MAX_VALUE;
            need += step;
        }
        return Math.max(0, need);
    }

    private static long step(long level) {
        try {
            return Experience.XpLevel.getXpForNextLevel(level);
        } catch (Throwable t) {
            return Long.MAX_VALUE;
        }
    }

    private static void load() {
        if (skills != null) return;
        skills = new LinkedHashMap<>();
        groups = new ArrayList<>();
        try {
            var resource = Minecraft.getInstance().getResourceManager().getResource(ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "skill_guide.json"));
            if (resource.isEmpty()) {
                LOGGER.warn("Skill guide: assets/lemursaucepacket/skill_guide.json is missing (skills/build.mjs writes it)");
                return;
            }
            try (Reader reader = resource.get().openAsReader()) {
                JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
                if (root.has("groups")) for (JsonElement element : root.getAsJsonArray("groups")) {
                    JsonObject o = element.getAsJsonObject();
                    List<String> members = new ArrayList<>();
                    for (JsonElement m : o.getAsJsonArray("skills")) members.add(m.getAsString());
                    groups.add(new Group(text(o, "id"), text(o, "name"), 0xFF000000 | o.get("color").getAsInt(), List.copyOf(members)));
                }
                for (Map.Entry<String, JsonElement> entry : root.getAsJsonObject("skills").entrySet()) {
                    JsonObject o = entry.getValue().getAsJsonObject();
                    List<Unlock> unlocks = new ArrayList<>();
                    for (JsonElement element : o.getAsJsonArray("unlocks")) {
                        JsonObject u = element.getAsJsonObject();
                        ItemStack icon = ItemStack.EMPTY;
                        if (u.has("icon") && !u.get("icon").isJsonNull()) {
                            ResourceLocation id = ResourceLocation.tryParse(u.get("icon").getAsString());
                            if (id != null) icon = BuiltInRegistries.ITEM.getOptional(id).map(ItemStack::new).orElse(ItemStack.EMPTY);
                        }
                        unlocks.add(new Unlock(u.get("level").getAsInt(), u.get("kind").getAsString(), u.get("title").getAsString(), icon));
                    }
                    skills.put(entry.getKey(), new Info(entry.getKey(), text(o, "trainedBy"), text(o, "perLevel"), List.copyOf(unlocks)));
                }
            }
        } catch (Exception e) {
            LOGGER.warn("Skill guide: couldn't read skill_guide.json", e);
        }
        groups = List.copyOf(groups);
    }

    private static String text(JsonObject o, String key) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : "";
    }

    private SkillGuideData() {
    }
}
