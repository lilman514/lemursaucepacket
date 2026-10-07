package net.lemursaucepacket.fixes.quests;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import javax.annotation.Nullable;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.mojang.serialization.JsonOps;

import net.lemursaucepacket.fixes.economy.Coins;
import net.lemursaucepacket.fixes.economy.npc.NpcInteractions;
import net.minecraft.ChatFormatting;
import net.minecraft.core.RegistryAccess;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.resources.RegistryOps;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.server.packs.resources.SimpleJsonResourceReloadListener;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.profiling.ProfilerFiller;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;

/**
 * RuneScape-style quest steps that NPC dialog buttons run: "here are the ingredients", "buy the map piece", "take this
 * shield". A step (data/<ns>/lsp_quests/<quest>.json, written by npcs/build.mjs from npcs/quests.mjs) checks stage tags
 * and skill levels, takes items and coins, gives items, sets the next stage and opens the NPC's next dialog; if
 * something is missing it says what, and opens the "missing" dialog instead. Stages are player tags, which double as
 * FTB Quests stages. A skill requirement's key may name several skills ("attack|ranged"): the best of them counts.
 *
 * <pre>
 * { "title": "Cook's Assistant", "stages": ["q_cook_started", "q_cook_done"],
 *   "steps": { "deliver": { "needs": ["q_cook_started"], "lacks": ["q_cook_done"],
 *                           "take": [ { "id": "minecraft:egg", "count": 1 }, { "id": "minecraft:iron_sword", "quest": "vyvin_sword" } ],
 *                           "skills": { "defence": 50, "attack|ranged": 50 },
 *                           "coins": 0, "give": [ ItemStack... ], "special": ["crandor_map"], "stage": "q_cook_done",
 *                           "commands": ["..."], "message": "...", "ok": "thanks", "missing": "missing", "done": "after" } } }
 * </pre>
 */
public final class QuestSteps {
    /** custom_data key that marks a quest item ("vyvin_sword", "elvarg_head", ...). */
    public static final String QUEST_ITEM = "lsp_quest";

    public record Take(Item item, int count, @Nullable String quest) {
    }

    public record Step(List<String> needs, List<String> lacks, Map<String, Integer> skills, List<Take> take, long coins, List<ItemStack> give, List<String> special,
            @Nullable String stage, List<String> commands, @Nullable String message, @Nullable String ok, @Nullable String missing, @Nullable String done) {
    }

    public record Quest(String id, String title, List<String> stages, Map<String, Step> steps) {
    }

    private static volatile Map<String, Quest> quests = Map.of();

    public static Map<String, Quest> all() {
        return quests;
    }

    /** The reload listener for data/<ns>/lsp_quests. */
    public static final class Loader extends SimpleJsonResourceReloadListener {
        private final RegistryAccess registries;

        public Loader(RegistryAccess registries) {
            super(new Gson(), "lsp_quests");
            this.registries = registries;
        }

        @Override
        protected void apply(Map<ResourceLocation, JsonElement> files, ResourceManager manager, ProfilerFiller profiler) {
            RegistryOps<JsonElement> ops = RegistryOps.create(JsonOps.INSTANCE, registries);
            Map<String, Quest> out = new TreeMap<>();
            files.forEach((file, json) -> {
                try {
                    out.put(file.getPath(), parse(file.getPath(), json.getAsJsonObject(), ops));
                } catch (Exception e) {
                    QuestModule.LOGGER.error("lsp_quests/{}.json: {}", file.getPath(), e.toString());
                }
            });
            quests = Map.copyOf(out);
            QuestModule.LOGGER.info("Quests: {} ({} steps)", out.size(), out.values().stream().mapToInt(q -> q.steps().size()).sum());
        }
    }

    private static Quest parse(String id, JsonObject json, RegistryOps<JsonElement> ops) {
        Map<String, Step> steps = new TreeMap<>();
        if (json.has("steps")) for (var e : json.getAsJsonObject("steps").entrySet()) {
            JsonObject s = e.getValue().getAsJsonObject();
            List<Take> take = new ArrayList<>();
            if (s.has("take")) for (JsonElement t : s.getAsJsonArray("take")) {
                JsonObject o = t.getAsJsonObject();
                ResourceLocation item = ResourceLocation.parse(o.get("id").getAsString());
                if (!BuiltInRegistries.ITEM.containsKey(item)) throw new IllegalArgumentException("step " + e.getKey() + ": unknown item " + item);
                take.add(new Take(BuiltInRegistries.ITEM.get(item), o.has("count") ? o.get("count").getAsInt() : 1, o.has("quest") ? o.get("quest").getAsString() : null));
            }
            List<ItemStack> give = new ArrayList<>();
            if (s.has("give")) for (JsonElement g : s.getAsJsonArray("give")) {
                give.add(ItemStack.CODEC.parse(ops, g).getOrThrow(msg -> new IllegalArgumentException("step " + e.getKey() + " give: " + msg)));
            }
            Map<String, Integer> skills = new TreeMap<>();
            if (s.has("skills")) for (var sk : s.getAsJsonObject("skills").entrySet()) skills.put(sk.getKey(), sk.getValue().getAsInt());
            steps.put(e.getKey(), new Step(strings(s, "needs"), strings(s, "lacks"), Map.copyOf(skills), List.copyOf(take), s.has("coins") ? s.get("coins").getAsLong() : 0,
                    List.copyOf(give), strings(s, "special"), str(s, "stage"), strings(s, "commands"), str(s, "message"), str(s, "ok"), str(s, "missing"), str(s, "done")));
        }
        return new Quest(id, json.has("title") ? json.get("title").getAsString() : id, strings(json, "stages"), Map.copyOf(steps));
    }

    @Nullable
    private static String str(JsonObject json, String key) {
        return json.has(key) && !json.get(key).isJsonNull() ? json.get(key).getAsString() : null;
    }

    private static List<String> strings(JsonObject json, String key) {
        if (!json.has(key)) return List.of();
        List<String> out = new ArrayList<>();
        JsonArray array = json.getAsJsonArray(key);
        for (JsonElement e : array) out.add(e.getAsString());
        return List.copyOf(out);
    }

    // ---------------------------------------------------------------- running a step

    /** Runs a step for a player (the NPC, when given, gets to say the follow-up). Returns 1 if it happened. */
    public static int run(ServerPlayer player, String questId, String stepId, @Nullable Entity npc) {
        Quest quest = quests.get(questId);
        Step step = quest == null ? null : quest.steps().get(stepId);
        if (step == null) {
            QuestModule.LOGGER.warn("No quest step {}/{}", questId, stepId);
            return 0;
        }
        var tags = player.getTags();
        if (!tags.containsAll(step.needs()) || step.lacks().stream().anyMatch(tags::contains)) {
            if (step.done() != null && npc != null) NpcInteractions.openDialog(player, npc, step.done());
            return 0;
        }
        Inventory inv = player.getInventory();
        List<MutableComponent> missing = new ArrayList<>();
        for (Take t : step.take()) {
            int have = count(inv, t);
            if (have < t.count()) missing.add(Component.literal((t.count() - have) + "x ").append(name(t)));
        }
        long purse = Coins.purse(player);
        if (step.coins() > purse) missing.add(Coins.text(step.coins() - purse));
        step.skills().forEach((key, need) -> {
            long have = 0;
            for (String skill : key.split("\\|")) have = Math.max(have, level(player, skill));
            if (have < need) {
                String names = String.join(" or ", java.util.Arrays.stream(key.split("\\|")).map(QuestSteps::skillName).toList());
                missing.add(Component.literal(names + " level " + need + " (you have " + have + ")"));
            }
        });
        if (!missing.isEmpty()) {
            MutableComponent line = Component.literal("You still need: ").withStyle(ChatFormatting.RED);
            for (int i = 0; i < missing.size(); i++) line.append(i == 0 ? Component.empty() : Component.literal(", ").withStyle(ChatFormatting.RED)).append(missing.get(i).withStyle(ChatFormatting.WHITE));
            player.sendSystemMessage(line);
            player.playNotifySound(SoundEvents.VILLAGER_NO, SoundSource.PLAYERS, 0.6f, 1f);
            if (step.missing() != null && npc != null) NpcInteractions.openDialog(player, npc, step.missing());
            return 0;
        }
        for (Take t : step.take()) remove(inv, t);
        inv.setChanged();
        if (step.coins() > 0) Coins.take(player, step.coins());
        for (ItemStack g : step.give()) {
            ItemStack copy = g.copy();
            if (!inv.add(copy)) player.drop(copy, false);
        }
        for (String special : step.special()) {
            if (special.equals("crandor_map")) Crandor.giveMap(player);
            if (special.equals("kiln_pass")) net.lemursaucepacket.fixes.pits.KilnHollow.givePass(player);
        }
        if (step.stage() != null) player.addTag(step.stage());
        MinecraftServer server = player.getServer();
        if (server != null) for (String command : step.commands()) {
            try {
                server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput().withPermission(4), command.replace("{player}", player.getGameProfile().getName()));
            } catch (Exception e) {
                QuestModule.LOGGER.warn("Quest command '{}' failed: {}", command, e.toString());
            }
        }
        if (step.message() != null) player.sendSystemMessage(Component.literal(step.message()).withStyle(ChatFormatting.GREEN));
        player.playNotifySound(SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 0.5f, 1.6f);
        QuestModule.LOGGER.info("{} did {}/{}", player.getGameProfile().getName(), questId, stepId);
        if (step.ok() != null && npc != null) NpcInteractions.openDialog(player, npc, step.ok());
        return 1;
    }

    /** A Project MMO skill level (0 if Project MMO has none for the player yet). */
    private static long level(ServerPlayer player, String skill) {
        try {
            return harmonised.pmmo.api.APIUtils.getLevel(skill, player);
        } catch (RuntimeException | NoClassDefFoundError e) {
            return 0;
        }
    }

    private static String skillName(String skill) {
        return skill.isEmpty() ? skill : Character.toUpperCase(skill.charAt(0)) + skill.substring(1);
    }

    /** Forgets a quest for a player: its stage tags go, so it can be done again (tests, admins). */
    public static int reset(ServerPlayer player, String questId) {
        Quest quest = quests.get(questId);
        if (quest == null) return 0;
        int n = 0;
        for (String stage : quest.stages()) if (player.removeTag(stage)) n++;
        return n;
    }

    public static boolean isQuestItem(ItemStack stack, String quest) {
        CustomData data = stack.get(DataComponents.CUSTOM_DATA);
        return data != null && quest.equals(data.copyTag().getString(QUEST_ITEM));
    }

    private static boolean matches(ItemStack stack, Take t) {
        return !stack.isEmpty() && stack.is(t.item()) && (t.quest() == null || isQuestItem(stack, t.quest()));
    }

    private static int count(Inventory inv, Take t) {
        int n = 0;
        for (int i = 0; i < inv.getContainerSize(); i++) if (matches(inv.getItem(i), t)) n += inv.getItem(i).getCount();
        return n;
    }

    private static void remove(Inventory inv, Take t) {
        int left = t.count();
        for (int i = 0; i < inv.getContainerSize() && left > 0; i++) {
            ItemStack s = inv.getItem(i);
            if (!matches(s, t)) continue;
            int n = Math.min(left, s.getCount());
            s.shrink(n);
            left -= n;
        }
    }

    private static Component name(Take t) {
        if (t.quest() != null) {
            Component special = switch (t.quest()) {
                case "vyvin_sword" -> Component.literal("Sir Vyvin's Sword");
                case "elvarg_head" -> Component.literal("Elvarg's Head");
                case "map_piece_1", "map_piece_2", "map_piece_3" -> Component.literal("Map Part " + t.quest().substring(t.quest().length() - 1));
                case "infernal_key" -> Component.literal("Infernal Key");
                default -> null;
            };
            if (special != null) return special;
        }
        return new ItemStack(t.item()).getHoverName();
    }

    private QuestSteps() {
    }
}
