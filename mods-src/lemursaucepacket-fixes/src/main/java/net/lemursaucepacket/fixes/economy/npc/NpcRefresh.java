package net.lemursaucepacket.fixes.economy.npc;

import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import net.lemursaucepacket.fixes.economy.EconomyModule;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.packs.resources.Resource;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.server.packs.resources.SimplePreparableReloadListener;
import net.minecraft.util.profiling.ProfilerFiller;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.level.Level;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.AddReloadListenerEvent;
import net.neoforged.neoforge.event.entity.EntityJoinLevelEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

/**
 * Keeps our NPCs in step with their presets. Easy NPC copies a preset into an NPC when it's placed, so an NPC already in
 * the world keeps its old dialogs when the pack changes them (npcs/npcs.mjs). So each of ours (tag {@code lsp_npc.<who>},
 * preset {@code easy_npc/preset/<model>/lemurton_<who>.npc.snbt}) carries the hash of the preset it was made from (tag
 * {@code lsp_npc_preset.<hash>}); one whose preset has changed since, or that has no hash yet, is imported again onto its
 * own UUID when it loads (Easy NPC then updates it in place), where it stands and facing the way it faces.
 */
public final class NpcRefresh {
    private static final String MARK = "lsp_npc_preset.";
    private static final int PER_TICK = 4;
    private static volatile Map<String, Preset> presets = Map.of();
    private static final Deque<Pending> QUEUE = new ArrayDeque<>();

    private record Preset(ResourceLocation id, String hash) {
    }

    private record Pending(ResourceKey<Level> level, UUID uuid) {
    }

    public static void init() {
        NeoForge.EVENT_BUS.addListener((AddReloadListenerEvent e) -> e.addListener(new Loader()));
        NeoForge.EVENT_BUS.addListener(NpcRefresh::onJoin);
        NeoForge.EVENT_BUS.addListener((ServerTickEvent.Post e) -> drain(e.getServer()));
    }

    private static String whoOf(Entity e) {
        for (String tag : e.getTags()) if (tag.startsWith(NpcBook.TAG_PREFIX)) return tag.substring(NpcBook.TAG_PREFIX.length());
        return null;
    }

    private static void onJoin(EntityJoinLevelEvent e) {
        if (e.getLevel().isClientSide()) return;
        String who = whoOf(e.getEntity());
        Preset p = who == null ? null : presets.get(who);
        if (p == null || e.getEntity().getTags().contains(MARK + p.hash())) return;
        QUEUE.add(new Pending(e.getLevel().dimension(), e.getEntity().getUUID()));
    }

    private static void drain(MinecraftServer server) {
        for (int n = 0; n < PER_TICK && !QUEUE.isEmpty(); n++) {
            Pending pending = QUEUE.poll();
            ServerLevel level = server.getLevel(pending.level());
            Entity e = level == null ? null : level.getEntity(pending.uuid());
            String who = e == null || e.isRemoved() ? null : whoOf(e);
            Preset p = who == null ? null : presets.get(who);
            if (p == null || e.getTags().contains(MARK + p.hash())) continue;
            double x = e.getX(), y = e.getY(), z = e.getZ();
            float yaw = e.getYRot(), pitch = e.getXRot(), head = e.getYHeadRot();
            server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput().withPermission(4).withLevel(level),
                    String.format(Locale.ROOT, "easy_npc preset import data %s %.4f %.4f %.4f %s", p.id(), x, y, z, pending.uuid()));
            Entity now = level.getEntity(pending.uuid());
            if (now == null) {
                EconomyModule.LOGGER.warn("Couldn't refresh {} ({}) from {}", who, pending.uuid(), p.id());
                continue;
            }
            now.moveTo(x, y, z, yaw, pitch);
            now.setYHeadRot(head);
            if (now instanceof Mob mob) mob.setYBodyRot(yaw);
            List<String> old = new ArrayList<>();
            for (String tag : now.getTags()) if (tag.startsWith(MARK)) old.add(tag);
            old.forEach(now::removeTag);
            now.addTag(MARK + p.hash());
            EconomyModule.LOGGER.info("Refreshed {} at {} from its preset ({})", who, now.blockPosition().toShortString(), p.hash());
        }
    }

    /** Hashes every lemurton_<who> preset in the data packs, on each (re)load. */
    private static final class Loader extends SimplePreparableReloadListener<Map<String, Preset>> {
        @Override
        protected Map<String, Preset> prepare(ResourceManager manager, ProfilerFiller profiler) {
            Map<String, Preset> found = new HashMap<>();
            for (Map.Entry<ResourceLocation, Resource> entry : manager.listResources("easy_npc/preset", rl -> rl.getPath().endsWith(".npc.snbt")).entrySet()) {
                String path = entry.getKey().getPath();
                String file = path.substring(path.lastIndexOf('/') + 1);
                if (!file.startsWith("lemurton_")) continue;
                String who = file.substring("lemurton_".length(), file.length() - ".npc.snbt".length());
                try (InputStream in = entry.getValue().open()) {
                    byte[] digest = MessageDigest.getInstance("SHA-1").digest(in.readAllBytes());
                    found.put(who, new Preset(entry.getKey(), HexFormat.of().formatHex(digest).substring(0, 10)));
                } catch (Exception ex) {
                    EconomyModule.LOGGER.warn("Couldn't read the preset {}", entry.getKey(), ex);
                }
            }
            return found;
        }

        @Override
        protected void apply(Map<String, Preset> found, ResourceManager manager, ProfilerFiller profiler) {
            presets = Map.copyOf(found);
            EconomyModule.LOGGER.info("{} NPC presets known for refreshing placed NPCs", found.size());
        }
    }

    private NpcRefresh() {
    }
}
