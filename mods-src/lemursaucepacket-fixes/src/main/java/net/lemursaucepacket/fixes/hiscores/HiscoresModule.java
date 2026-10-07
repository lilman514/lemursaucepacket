package net.lemursaucepacket.fixes.hiscores;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import com.google.gson.JsonObject;

import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.server.ServerStoppingEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * RuneScape-style hiscores (docs/hiscores.md; what's ranked is hiscores/hiscores.mjs): every few minutes the server
 * records everyone online ({@link Recorder}, kept with the world in {@link HiscoresStore}), /hiscores ranks them in game,
 * and what changed goes to play.limas.ca/hiscores ({@link Uploader}).
 */
public final class HiscoresModule {
    public static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/hiscores");
    private static HiscoresConfig config = new HiscoresConfig();
    private static JsonObject totals = new JsonObject();
    /** Players to record soon after joining (their statistics and skills are loaded by then): uuid -> due tick. */
    private static final Map<UUID, Integer> JOINED = new HashMap<>();
    private static int lastOnlineRecord = -1000;

    public static void init() {
        NeoForge.EVENT_BUS.addListener((ServerStartedEvent e) -> started(e.getServer()));
        NeoForge.EVENT_BUS.addListener((PlayerEvent.PlayerLoggedInEvent e) -> {
            if (e.getEntity() instanceof ServerPlayer p) JOINED.put(p.getUUID(), p.server.getTickCount() + 100);
        });
        NeoForge.EVENT_BUS.addListener((PlayerEvent.PlayerLoggedOutEvent e) -> {
            if (e.getEntity() instanceof ServerPlayer p) record(p);
        });
        NeoForge.EVENT_BUS.addListener((ServerTickEvent.Post e) -> tick(e.getServer()));
        NeoForge.EVENT_BUS.addListener((ServerStoppingEvent e) -> stopping(e.getServer()));
        NeoForge.EVENT_BUS.addListener((RegisterCommandsEvent e) -> HiscoresCommands.register(e.getDispatcher()));
    }

    static HiscoresConfig config() {
        return config;
    }

    private static void started(MinecraftServer server) {
        config = HiscoresConfig.load();
        // What the website shows collections out of.
        JsonObject t = new JsonObject();
        t.addProperty("capes", net.lemursaucepacket.fixes.capes.CapeDefs.all().size());
        t.addProperty("collection", BuiltInRegistries.ITEM.size() - 1);
        t.addProperty("quest_points", config.questPoints.values().stream().mapToInt(Integer::intValue).sum());
        JsonObject collections = new JsonObject();
        for (HiscoresConfig.Collection c : config.collections) collections.addProperty(c.id(), c.items().size());
        t.add("collections", collections);
        totals = t;
        HiscoresStore store = HiscoresStore.get(server);
        LOGGER.info("Hiscores: {} players on record; uploads {}", store.all().size(),
                Uploader.configured(config) ? "on, to " + config.uploadUrl : "off (no key: /lsp hiscores keygen)");
    }

    static long collectionSize(String id) {
        for (HiscoresConfig.Collection c : config.collections) if (c.id().equals(id)) return c.items().size();
        return 0;
    }

    static void record(ServerPlayer p) {
        try {
            Recorder.record(p, config, HiscoresStore.get(p.server));
        } catch (RuntimeException ex) {
            LOGGER.warn("Couldn't record {} for the hiscores", p.getGameProfile().getName(), ex);
        }
    }

    static int recordAll(MinecraftServer server) {
        int n = 0;
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            record(p);
            n++;
        }
        lastOnlineRecord = server.getTickCount();
        return n;
    }

    /** Before showing a table: everyone online, at most every ten seconds. */
    static void recordOnline(MinecraftServer server) {
        if (server.getTickCount() - lastOnlineRecord >= 200) recordAll(server);
    }

    static boolean uploadNow(MinecraftServer server, boolean all) {
        if (!Uploader.configured(config)) return false;
        Uploader.upload(server, config, HiscoresStore.get(server), totals, all);
        return true;
    }

    private static void tick(MinecraftServer server) {
        int now = server.getTickCount();
        if (!JOINED.isEmpty()) {
            for (Iterator<Map.Entry<UUID, Integer>> it = JOINED.entrySet().iterator(); it.hasNext();) {
                Map.Entry<UUID, Integer> j = it.next();
                if (j.getValue() > now) continue;
                it.remove();
                ServerPlayer p = server.getPlayerList().getPlayer(j.getKey());
                if (p != null) record(p);
            }
        }
        if (now % (config.recordEvery * 20) == 0) recordAll(server);
        if (now % (config.uploadEvery * 20) == 40 && !HiscoresStore.get(server).pending.isEmpty()) uploadNow(server, false);
    }

    /** On the way down: everyone online one last time, and what changed goes up (waiting a few seconds for it). */
    private static void stopping(MinecraftServer server) {
        recordAll(server);
        if (!Uploader.configured(config) || HiscoresStore.get(server).pending.isEmpty()) return;
        try {
            Uploader.upload(server, config, HiscoresStore.get(server), totals, false).get(8, TimeUnit.SECONDS);
        } catch (Exception ex) {
            LOGGER.warn("The last hiscores upload didn't finish: {}", ex.toString());
        }
    }

    private HiscoresModule() {
    }
}
