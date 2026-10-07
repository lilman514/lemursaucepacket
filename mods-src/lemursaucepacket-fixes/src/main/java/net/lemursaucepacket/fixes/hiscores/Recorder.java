package net.lemursaucepacket.fixes.hiscores;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;

import com.google.gson.JsonObject;

import net.lemursaucepacket.fixes.capes.Capes;
import net.lemursaucepacket.fixes.skills.Levels;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.stats.ServerStatsCounter;
import net.minecraft.stats.Stats;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.neoforged.fml.ModList;

/**
 * Turns a player into a hiscores record: each skill's XP and level, the total and combat levels, the activities, boss
 * kill counts, collections, the monsters they've slain most, and deaths. The record is what /hiscores ranks and what
 * goes to the website.
 */
final class Recorder {
    private static final int TOP_KILLS = 40;

    static void record(ServerPlayer p, HiscoresConfig cfg, HiscoresStore store) {
        HiscoresStore.Entry e = store.entry(p.getUUID(), p.getGameProfile().getName());
        ServerStatsCounter stats = p.getStats();
        JsonObject r = new JsonObject();
        r.addProperty("uuid", p.getUUID().toString());
        r.addProperty("name", e.name);
        r.addProperty("seen", System.currentTimeMillis());

        JsonObject skills = new JsonObject();
        long totalXp = 0;
        int totalLevel = 0;
        for (String skill : cfg.skills) {
            long xp = xp(p, skill);
            int level = Math.max(1, Levels.of(p, skill));
            JsonObject s = new JsonObject();
            s.addProperty("xp", xp);
            s.addProperty("level", level);
            skills.add(skill, s);
            totalXp += xp;
            totalLevel += level;
        }
        r.add("skills", skills);
        JsonObject total = new JsonObject();
        total.addProperty("level", totalLevel);
        total.addProperty("xp", totalXp);
        r.add("total", total);
        r.addProperty("combat", Levels.combat(p));

        collectSeen(p, stats, e);
        JsonObject activities = new JsonObject();
        for (HiscoresConfig.Activity a : cfg.activities) activities.addProperty(a.id(), activity(p, stats, cfg, e, a));
        r.add("activities", activities);

        JsonObject bosses = new JsonObject();
        for (HiscoresConfig.Boss b : cfg.bosses) {
            long n = 0;
            if (b.counter()) {
                n = e.counters.getOrDefault(b.id(), 0L);
            } else {
                for (ResourceLocation id : b.kills()) {
                    Optional<EntityType<?>> type = BuiltInRegistries.ENTITY_TYPE.getOptional(id);
                    if (type.isPresent()) n += stats.getValue(Stats.ENTITY_KILLED.get(type.get()));
                }
            }
            bosses.addProperty(b.id(), n);
        }
        r.add("bosses", bosses);

        JsonObject collections = new JsonObject();
        for (HiscoresConfig.Collection c : cfg.collections) collections.addProperty(c.id(), c.items().stream().filter(e.seen::contains).count());
        r.add("collections", collections);

        // The monsters a player has slain most, for their page.
        List<Map.Entry<String, Integer>> kills = new ArrayList<>();
        for (EntityType<?> type : BuiltInRegistries.ENTITY_TYPE) {
            int n = stats.getValue(Stats.ENTITY_KILLED.get(type));
            if (n > 0) kills.add(Map.entry(BuiltInRegistries.ENTITY_TYPE.getKey(type).toString(), n));
        }
        kills.sort((a, b) -> b.getValue() - a.getValue());
        JsonObject top = new JsonObject();
        for (int i = 0; i < Math.min(TOP_KILLS, kills.size()); i++) top.addProperty(kills.get(i).getKey(), kills.get(i).getValue());
        r.add("kills", top);
        r.addProperty("deaths", stats.getValue(Stats.CUSTOM.get(Stats.DEATHS)));

        e.record = r;
        store.changed(e.uuid);
    }

    /**
     * A skill's total XP, as RuneScape counts it. Project MMO keeps a level and the XP earned into it, so the cost of
     * every level below is added back (the pack's level costs are RuneScape's: 13,034,431 at 99).
     */
    private static long xp(Player p, String skill) {
        if (!ModList.get().isLoaded("pmmo")) return 0;
        try {
            long level = harmonised.pmmo.api.APIUtils.getLevel(skill, p);
            long total = harmonised.pmmo.api.APIUtils.getXp(skill, p);
            for (long i = 0; i < level; i++) {
                long step = harmonised.pmmo.storage.Experience.XpLevel.getXpForNextLevel(i);
                if (step == Long.MAX_VALUE) break;
                total += step;
            }
            return total;
        } catch (RuntimeException | NoClassDefFoundError ex) {
            return 0;
        }
    }

    private static long activity(ServerPlayer p, ServerStatsCounter stats, HiscoresConfig cfg, HiscoresStore.Entry e, HiscoresConfig.Activity a) {
        return switch (a.id()) {
            case "quest_points" -> cfg.questPoints.entrySet().stream().filter(q -> p.getTags().contains(q.getKey())).mapToInt(Map.Entry::getValue).sum();
            case "capes" -> net.lemursaucepacket.fixes.capes.CapeDefs.all().stream().filter(d -> Capes.owns(p, d.id())).count();
            case "collection" -> e.seen.size();
            case "quests" -> questsDone(p);
            default -> {
                if (a.stat() == null) yield 0;
                ResourceLocation key = BuiltInRegistries.CUSTOM_STAT.get(a.stat());
                yield key == null ? 0 : stats.getValue(Stats.CUSTOM.get(key)) / Math.max(1, a.divide());
            }
        };
    }

    /** Every kind of item a player has had: in the bag, worn, in a Curios slot, picked up or crafted. */
    private static void collectSeen(ServerPlayer p, ServerStatsCounter stats, HiscoresStore.Entry e) {
        var inv = p.getInventory();
        for (int i = 0; i < inv.getContainerSize(); i++) see(e, inv.getItem(i));
        if (ModList.get().isLoaded("curios")) {
            try {
                top.theillusivec4.curios.api.CuriosApi.getCuriosInventory(p).ifPresent(h -> {
                    var equipped = h.getEquippedCurios();
                    for (int i = 0; i < equipped.getSlots(); i++) see(e, equipped.getStackInSlot(i));
                });
            } catch (RuntimeException | NoClassDefFoundError ex) {
                // no curios this time
            }
        }
        for (Item item : BuiltInRegistries.ITEM) {
            if (item == Items.AIR) continue;
            if (stats.getValue(Stats.ITEM_PICKED_UP.get(item)) > 0 || stats.getValue(Stats.ITEM_CRAFTED.get(item)) > 0) e.seen.add(BuiltInRegistries.ITEM.getKey(item).toString());
        }
    }

    private static void see(HiscoresStore.Entry e, ItemStack stack) {
        if (!stack.isEmpty()) e.seen.add(BuiltInRegistries.ITEM.getKey(stack.getItem()).toString());
    }

    // ---------------------------------------------------------------- FTB Quests, by reflection (not a compile dependency)

    private static java.lang.reflect.Field instance;
    private static Method teamData, forAllQuests, isCompleted;

    /** How many quests in the quest book the player's team has completed. */
    private static long questsDone(ServerPlayer p) {
        if (!ModList.get().isLoaded("ftbquests")) return 0;
        try {
            if (instance == null) {
                Class<?> file = Class.forName("dev.ftb.mods.ftbquests.quest.ServerQuestFile", true, Recorder.class.getClassLoader());
                instance = file.getField("INSTANCE");
                teamData = file.getMethod("getTeamData", Player.class);
                forAllQuests = file.getMethod("forAllQuests", Consumer.class);
                isCompleted = Class.forName("dev.ftb.mods.ftbquests.quest.TeamData", true, Recorder.class.getClassLoader())
                        .getMethod("isCompleted", Class.forName("dev.ftb.mods.ftbquests.quest.QuestObject", true, Recorder.class.getClassLoader()));
            }
            // The quest book's file is made anew on a reload, so it's looked up each time.
            Object questFile = instance.get(null);
            if (questFile == null) return 0;
            Optional<?> team = (Optional<?>) teamData.invoke(questFile, p);
            if (team.isEmpty()) return 0;
            Object data = team.get();
            long[] done = {0};
            Consumer<Object> count = q -> {
                try {
                    if ((Boolean) isCompleted.invoke(data, q)) done[0]++;
                } catch (ReflectiveOperationException ex) {
                    // skip it
                }
            };
            forAllQuests.invoke(questFile, count);
            return done[0];
        } catch (ReflectiveOperationException | ClassCastException | LinkageError ex) {
            return 0;
        }
    }

    private Recorder() {
    }
}
