package net.lemursaucepacket.fixes.lifesteal;

import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import net.lemursaucepacket.fixes.LspFixes;
import net.lemursaucepacket.fixes.lifesteal.compass.CompassServer;
import net.lemursaucepacket.fixes.lifesteal.compass.ContainerIndex;
import net.lemursaucepacket.fixes.lifesteal.compass.LostItemIndex;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.config.ModConfig;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.fml.loading.FMLPaths;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.entity.player.ItemTooltipEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.server.ServerStoppingEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Hearts, graves and elimination: the Java half (docs/lifesteal.md). The KubeJS scripts own the hearts
 * themselves; this module adds what scripts can't: graves cost Grave Essence (a mixin into the Gravestone
 * mod), an eliminated player is held on the death screen until they confirm (a mixin on the respawn packet
 * plus a client screen), the erasure of a life's placed blocks and owned items with an archive, and the two
 * compasses' GUI and needle.
 */
public final class LifestealModule {
    public static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/lifesteal");
    /** /lsp elimination pause: stops erasure jobs until resumed or restarted. */
    public static volatile boolean erasuresPaused;
    private static int newcomerProtectionTicks = 2 * 72000;

    public static void init(IEventBus modBus, ModContainer container) {
        container.registerConfig(ModConfig.Type.COMMON, LifestealConfig.SPEC);
        PlacedBlocks.ATTACHMENTS.register(modBus);
        modBus.addListener(LifestealNet::register);
        NeoForge.EVENT_BUS.register(PlacedBlocks.class);
        NeoForge.EVENT_BUS.register(Purge.class);
        NeoForge.EVENT_BUS.register(LostItemIndex.class);
        NeoForge.EVENT_BUS.register(ContainerIndex.class);
        NeoForge.EVENT_BUS.register(CompassServer.class);
        NeoForge.EVENT_BUS.addListener(LifestealCommands::register);
        NeoForge.EVENT_BUS.addListener(LifestealModule::onServerTick);
        NeoForge.EVENT_BUS.addListener(LifestealModule::onServerStopping);
        NeoForge.EVENT_BUS.addListener(LifestealModule::onLogout);
        NeoForge.EVENT_BUS.addListener(LifestealModule::onTooltip);
        if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.lifesteal.client.LifestealClient.init(modBus);
        readSharedNumbers();
    }

    /** The one number both halves need: read from the KubeJS config so the two never disagree. */
    private static void readSharedNumbers() {
        Path file = FMLPaths.CONFIGDIR.get().resolve("lemursaucepacket").resolve("lifesteal.json");
        if (!Files.isRegularFile(file)) return;
        try (Reader reader = Files.newBufferedReader(file)) {
            JsonObject json = JsonParser.parseReader(reader).getAsJsonObject();
            if (json.has("newcomerProtectionHours")) newcomerProtectionTicks = (int) (json.get("newcomerProtectionHours").getAsDouble() * 72000);
        } catch (Exception e) {
            LOGGER.warn("config/lemursaucepacket/lifesteal.json not readable ({}); using {} h of newcomer protection", e.toString(), newcomerProtectionTicks / 72000.0);
        }
    }

    public static int newcomerProtectionTicks() {
        return newcomerProtectionTicks;
    }

    private static void onServerTick(ServerTickEvent.Post event) {
        MinecraftServer server = event.getServer();
        try {
            Limbo.tick(server);
            if (!erasuresPaused) EraseJob.tick(server);
        } catch (Exception e) {
            LOGGER.error("Lifesteal tick failed", e);
        }
    }

    private static void onServerStopping(ServerStoppingEvent event) {
        EraseJob.flushAll(event.getServer());
    }

    private static void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) Limbo.forget(player.getUUID());
    }

    /** "Belongs to <name>" with advanced tooltips on (both sides can read the stamp; names come from the client's cache). */
    private static void onTooltip(ItemTooltipEvent event) {
        if (!LifestealConfig.OWNER_TOOLTIP.get() || !event.getFlags().isAdvanced()) return;
        Ownership.Owner owner = Ownership.of(event.getItemStack());
        if (owner == null) return;
        String name = ownerName(owner.uuid());
        event.getToolTip().add(Component.literal("Belongs to " + name + (owner.generation() > 0 ? " (life " + (owner.generation() + 1) + ")" : "")).withStyle(ChatFormatting.DARK_GRAY));
    }

    private static String ownerName(UUID uuid) {
        if (FMLEnvironment.dist.isClient()) {
            String name = net.lemursaucepacket.fixes.lifesteal.client.LifestealClient.playerName(uuid);
            if (name != null) return name;
        }
        return uuid.toString().substring(0, 8);
    }

    private LifestealModule() {
    }

    static String modId() {
        return LspFixes.MOD_ID;
    }
}
