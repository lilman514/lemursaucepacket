package net.lemursaucepacket.fixes.economy;

import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.JsonElement;

import net.lemursaucepacket.fixes.economy.npc.NpcBook;
import net.lemursaucepacket.fixes.economy.npc.NpcInteractions;
import net.lemursaucepacket.fixes.economy.shop.Shops;
import net.lemursaucepacket.fixes.economy.trade.Trades;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.server.packs.resources.SimpleJsonResourceReloadListener;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.profiling.ProfilerFiller;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.common.util.TriState;
import net.neoforged.neoforge.event.AddReloadListenerEvent;
import net.neoforged.neoforge.event.OnDatapackSyncEvent;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.entity.living.LivingDeathEvent;
import net.neoforged.neoforge.event.entity.player.ItemEntityPickupEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.tick.PlayerTickEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import net.neoforged.neoforge.network.PacketDistributor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The server economy (docs/economy.md): Gold Coins (one stack of any size per purse), vendors who sell their own goods and
 * buy anything at its value, the talk-first flow with the townsfolk, and player-to-player trading.
 */
public final class EconomyModule {
    public static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/economy");

    public static void init(IEventBus modBus) {
        EconomyContent.register(modBus);
        modBus.addListener(EconomyNet::register);
        NeoForge.EVENT_BUS.addListener(EconomyModule::onReloadListeners);
        NeoForge.EVENT_BUS.addListener(EconomyModule::onServerStarted);
        NeoForge.EVENT_BUS.addListener(EconomyModule::onDatapackSync);
        NeoForge.EVENT_BUS.addListener(EconomyModule::onEntityInteract);
        NeoForge.EVENT_BUS.addListener(EconomyModule::onPickup);
        NeoForge.EVENT_BUS.addListener(EconomyModule::onPlayerTick);
        NeoForge.EVENT_BUS.addListener(EconomyModule::onServerTick);
        NeoForge.EVENT_BUS.addListener(EconomyModule::onLogout);
        NeoForge.EVENT_BUS.addListener(EconomyModule::onChangedDimension);
        NeoForge.EVENT_BUS.addListener(EventPriority.HIGHEST, EconomyModule::onDeath);
        NeoForge.EVENT_BUS.addListener((RegisterCommandsEvent e) -> EconomyCommands.register(e.getDispatcher(), e.getBuildContext()));
        if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.economy.client.EconomyClient.init(modBus);
    }

    private static void onReloadListeners(AddReloadListenerEvent event) {
        event.addListener(new NpcBook.Loader(event.getRegistryAccess()));
        event.addListener(new SimpleJsonResourceReloadListener(new Gson(), "lsp_economy") {
            @Override
            protected void apply(Map<ResourceLocation, JsonElement> files, ResourceManager manager, ProfilerFiller profiler) {
                ItemValues.setSources(files);
            }
        });
    }

    private static void recompute(MinecraftServer server) {
        try {
            ItemValues.install(ItemValues.compute(server));
        } catch (Exception e) {
            LOGGER.error("Item values failed; vendors keep the old ones", e);
        }
    }

    private static void onServerStarted(ServerStartedEvent event) {
        recompute(event.getServer());
    }

    /** After /reload (no player) the table is rebuilt; every joining player (and everyone, after a reload) gets it. */
    private static void onDatapackSync(OnDatapackSyncEvent event) {
        if (event.getPlayer() == null) recompute(event.getPlayerList().getServer());
        EconomyNet.Values payload = EconomyNet.Values.of(ItemValues.table());
        event.getRelevantPlayers().forEach(p -> PacketDistributor.sendToPlayer(p, payload));
    }

    private static void onEntityInteract(PlayerInteractEvent.EntityInteract event) {
        NpcInteractions.onEntityInteract(event);
        if (event.isCanceled()) return;
        // Sneak + right-click another player with an empty hand: ask them to trade.
        if (event.getTarget() instanceof ServerPlayer target && event.getEntity() instanceof ServerPlayer player
                && player.isShiftKeyDown() && player.getMainHandItem().isEmpty() && event.getHand() == InteractionHand.MAIN_HAND) {
            Trades.request(player, target);
            event.setCanceled(true);
            event.setCancellationResult(InteractionResult.SUCCESS);
        }
    }

    /** Coins walked over join the purse's stack, even with a full inventory. */
    private static void onPickup(ItemEntityPickupEvent.Pre event) {
        ItemEntity entity = event.getItemEntity();
        Player player = event.getPlayer();
        ItemStack stack = entity.getItem();
        if (player.level().isClientSide || !Coins.is(stack) || entity.hasPickUpDelay()) return;
        if (entity.getTarget() != null && !entity.getTarget().equals(player.getUUID())) return;
        var inv = player.getInventory();
        int slot = -1;
        for (int i = 0; i < inv.getContainerSize(); i++) {
            if (Coins.is(inv.getItem(i))) {
                slot = i;
                break;
            }
        }
        if (slot < 0) return; // no purse yet: vanilla puts the stack in a free slot
        long amount = Coins.value(stack);
        Coins.set(inv.getItem(slot), Coins.value(inv.getItem(slot)) + amount);
        inv.setChanged();
        player.take(entity, 1);
        entity.discard();
        player.level().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 0.2f, 1.4f);
        Coins.afterChange(player);
        event.setCanPickup(TriState.FALSE);
    }

    private static void onPlayerTick(PlayerTickEvent.Post event) {
        if (event.getEntity() instanceof ServerPlayer player && player.tickCount % 10 == 3) Coins.normalize(player);
    }

    private static void onServerTick(ServerTickEvent.Post event) {
        if (event.getServer().getTickCount() % 10 == 5) Trades.tick(event.getServer());
    }

    private static void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) {
            Trades.onLogout(player);
            Shops.forget(player.getUUID());
        }
    }

    private static void onChangedDimension(PlayerEvent.PlayerChangedDimensionEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) Trades.onDeathOrTravel(player, "Someone left for another dimension.");
    }

    private static void onDeath(LivingDeathEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) Trades.onDeathOrTravel(player, player.getGameProfile().getName() + " died.");
    }

    private EconomyModule() {
    }
}
