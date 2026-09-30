package net.lemursaucepacket.fixes.lifesteal.client;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.lifesteal.LifestealNet;
import net.lemursaucepacket.fixes.lifesteal.compass.CompassServer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.DeathScreen;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.renderer.item.CompassItemPropertyFunction;
import net.minecraft.client.renderer.item.ItemProperties;
import net.minecraft.core.GlobalPos;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.LodestoneTracker;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.event.lifecycle.FMLClientSetupEvent;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.common.NeoForge;

/** Client side: the compass needle, the limbo death screen and the compass GUI. Loaded only on the client. */
public final class LifestealClient {
    static LifestealNet.LimboState limbo = new LifestealNet.LimboState(false, "", 0, 0, 0);
    private static final Map<UUID, GlobalPos> TARGETS = new HashMap<>();

    public static void init(IEventBus modBus) {
        modBus.addListener(LifestealClient::onClientSetup);
        NeoForge.EVENT_BUS.addListener(EliminationScreens::onScreenInit);
        NeoForge.EVENT_BUS.addListener(EliminationScreens::onScreenRender);
        NeoForge.EVENT_BUS.addListener(LifestealClient::onLoggingOut);
    }

    private static void onClientSetup(FMLClientSetupEvent event) {
        event.enqueueWork(() -> {
            for (ResourceLocation id : new ResourceLocation[] {CompassServer.LOST_ITEM_COMPASS, CompassServer.SEEKERS_COMPASS}) {
                Item item = BuiltInRegistries.ITEM.get(id);
                if (item == null || item == net.minecraft.world.item.Items.AIR) continue;
                ItemProperties.register(item, ResourceLocation.withDefaultNamespace("angle"), new CompassItemPropertyFunction((level, stack, entity) -> target(stack)));
            }
        });
    }

    /** Where a compass points: the live position the server streams, else what the item remembers. */
    @Nullable
    private static GlobalPos target(ItemStack stack) {
        UUID id = CompassServer.compassId(stack);
        if (id != null) {
            GlobalPos live = TARGETS.get(id);
            if (live != null) return live;
        }
        LodestoneTracker tracker = stack.get(DataComponents.LODESTONE_TRACKER);
        return tracker == null ? null : tracker.target().orElse(null);
    }

    private static void onLoggingOut(ClientPlayerNetworkEvent.LoggingOut event) {
        limbo = new LifestealNet.LimboState(false, "", 0, 0, 0);
        TARGETS.clear();
    }

    // ---- payloads (main thread) ----

    public static void onLimboState(LifestealNet.LimboState payload) {
        boolean was = limbo.eliminated();
        limbo = payload;
        Minecraft mc = Minecraft.getInstance();
        if (mc.screen instanceof DeathScreen screen && (was != payload.eliminated() || !EliminationScreens.isPatched(screen))) {
            screen.init(mc, mc.getWindow().getGuiScaledWidth(), mc.getWindow().getGuiScaledHeight());
        }
        if (!payload.eliminated() && mc.screen instanceof EliminationScreens.WarningScreen) mc.setScreen(null);
    }

    public static void onCompassList(LifestealNet.CompassList payload) {
        Minecraft.getInstance().setScreen(new CompassScreen(payload));
    }

    public static void onCompassTarget(LifestealNet.CompassTarget payload) {
        if (!payload.valid()) {
            TARGETS.remove(payload.compass());
            return;
        }
        ResourceLocation dim = ResourceLocation.tryParse(payload.dimension());
        if (dim == null) return;
        TARGETS.put(payload.compass(), GlobalPos.of(ResourceKey.create(Registries.DIMENSION, dim), payload.pos()));
    }

    @Nullable
    public static String playerName(UUID uuid) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.getConnection() == null) return null;
        PlayerInfo info = mc.getConnection().getPlayerInfo(uuid);
        return info == null ? null : info.getProfile().getName();
    }

    private LifestealClient() {
    }
}
