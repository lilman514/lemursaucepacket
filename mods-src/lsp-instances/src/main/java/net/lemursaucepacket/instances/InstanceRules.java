package net.lemursaucepacket.instances;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.item.BucketItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.GameRules;
import net.minecraft.world.phys.Vec3;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.AddReloadListenerEvent;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.entity.EntityTeleportEvent;
import net.neoforged.neoforge.event.entity.living.LivingDropsEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.level.BlockEvent;
import net.neoforged.neoforge.event.level.ExplosionEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

/** The game events: NPCs opening event windows, deaths inside, what can't be done in an arena, and comings and goings. */
final class InstanceRules {
    static void init() {
        NeoForge.EVENT_BUS.addListener((AddReloadListenerEvent e) -> e.addListener(new EventLoader()));
        NeoForge.EVENT_BUS.addListener((RegisterCommandsEvent e) -> InstanceCommands.register(e.getDispatcher()));
        NeoForge.EVENT_BUS.addListener((ServerStartedEvent e) -> InstanceManager.serverStarted(e.getServer()));
        NeoForge.EVENT_BUS.addListener((ServerTickEvent.Post e) -> {
            if (e.getServer().getTickCount() % 10 == 3) InstanceManager.tick(e.getServer());
        });
        // Before other mods' handlers (lsp_fixes' talk-first townsfolk, Easy NPC's own dialog).
        NeoForge.EVENT_BUS.addListener(EventPriority.HIGHEST, InstanceRules::onEntityInteract);
        // After Curios adds worn items to the drops (HIGHEST) and lifesteal's Heart (KubeJS, NORMAL); before the
        // Gravestone mod makes a grave of them (LOWEST).
        NeoForge.EVENT_BUS.addListener(EventPriority.LOW, InstanceRules::onDrops);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onBreak);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onPlace);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onUseOnBlock);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onExplosion);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onPearl);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onChorus);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onLogin);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onLogout);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onChangedDimension);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onRespawn);
        NeoForge.EVENT_BUS.addListener(InstanceRules::onJoinLevel);
    }

    /**
     * Nothing in an arena outlives its run: a boss, a body or a dropped item saved there (a crash, a server stopped
     * mid-fight) is dropped as its chunk loads again, before a new run can meet it.
     */
    private static void onJoinLevel(net.neoforged.neoforge.event.entity.EntityJoinLevelEvent event) {
        if (event.loadedFromDisk() && inArena(event.getLevel()) && !(event.getEntity() instanceof net.minecraft.world.entity.player.Player)) {
            event.setCanceled(true);
        }
    }

    private static boolean inArena(Level level) {
        return level.dimension() == InstanceManager.DIMENSION;
    }

    private static void onEntityInteract(PlayerInteractEvent.EntityInteract event) {
        Optional<net.minecraft.resources.ResourceLocation> id = InstanceManager.eventOf(event.getTarget());
        if (id.isEmpty() || EventLoader.get(id.get()) == null) return;
        event.setCanceled(true);
        event.setCancellationResult(InteractionResult.SUCCESS);
        if (event.getHand() == InteractionHand.MAIN_HAND && event.getEntity() instanceof ServerPlayer player) {
            InstanceManager.open(player, id.get(), event.getTarget(), InstanceNet.OPEN);
        }
    }

    /** A death in an event with a keeper: everything that would drop goes to the keeper instead, and nothing falls. */
    private static void onDrops(LivingDropsEvent event) {
        if (!(event.getEntity() instanceof ServerPlayer player) || !inArena(player.level())) return;
        if (player.serverLevel().getGameRules().getBoolean(GameRules.RULE_KEEPINVENTORY)) return;
        Optional<InstanceManager.Session> session = InstanceManager.keeperFor(player);
        if (session.isEmpty()) return;
        List<ItemStack> stacks = new ArrayList<>();
        for (ItemEntity drop : event.getDrops()) stacks.add(drop.getItem());
        InstanceManager.keep(player, stacks);
        event.getDrops().clear();
        event.setCanceled(true);
        EventDef def = session.get().def;
        player.sendSystemMessage(Component.literal("You fell in " + def.name() + ". " + def.keeper() + " has your things"
                + (def.keeperPlace().isEmpty() ? "" : " at " + def.keeperPlace()) + ": speak to " + def.keeper() + " to take them back.").withStyle(ChatFormatting.GOLD));
        session.get().inside.remove(player.getUUID());
        LspInstances.LOGGER.info("{} died in {}: {} stack(s) kept by {}", player.getGameProfile().getName(), session.get().event, stacks.size(), def.keeper());
    }

    private static void onBreak(BlockEvent.BreakEvent event) {
        if (event.getLevel() instanceof Level level && inArena(level) && !event.getPlayer().isCreative()) event.setCanceled(true);
    }

    private static void onPlace(BlockEvent.EntityPlaceEvent event) {
        if (event.getLevel() instanceof Level level && inArena(level) && !(event.getEntity() instanceof net.minecraft.world.entity.player.Player p && p.isCreative())) {
            event.setCanceled(true);
        }
    }

    private static void onUseOnBlock(PlayerInteractEvent.RightClickBlock event) {
        if (!inArena(event.getLevel()) || event.getEntity().isCreative()) return;
        if (event.getItemStack().getItem() instanceof BucketItem) event.setCanceled(true);
    }

    private static void onExplosion(ExplosionEvent.Detonate event) {
        if (inArena(event.getLevel())) event.getAffectedBlocks().clear();
    }

    private static void onPearl(EntityTeleportEvent.EnderPearl event) {
        if (event.getPlayer() != null && strays(event.getPlayer(), event.getTarget())) event.setCanceled(true);
    }

    private static void onChorus(EntityTeleportEvent.ChorusFruit event) {
        if (event.getEntityLiving() instanceof ServerPlayer p && strays(p, event.getTarget())) event.setCanceled(true);
    }

    private static boolean strays(ServerPlayer player, Vec3 target) {
        return InstanceManager.sessionInside(player.getUUID()).map(s -> s.outside(target)).orElse(false);
    }

    /** Someone logs in inside the instance dimension with no fight going on (it ended, or the server restarted). */
    private static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (!(event.getEntity() instanceof ServerPlayer player)) return;
        InstanceData data = InstanceData.get(player.server);
        if (inArena(player.level()) && InstanceManager.sessionInside(player.getUUID()).isEmpty()) {
            InstanceManager.sendBack(player.server, player, data.returns.get(player.getUUID()));
            player.sendSystemMessage(Component.literal("The fight ended while you were away, so you're back where you set out from.").withStyle(ChatFormatting.GRAY));
        }
        if (!inArena(player.level()) && data.returns.remove(player.getUUID()) != null) data.setDirty();
    }

    private static void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        java.util.UUID me = event.getEntity().getUUID();
        InstanceManager.lobbyOf(me).ifPresent(lobby -> {
            if (lobby.host.equals(me)) InstanceManager.lobbies().remove(me);
            else lobby.members.remove(me);
        });
        // Leaving mid-fight: they're out of it, and on their next login they'll be sent back.
        InstanceManager.sessionInside(me).ifPresent(s -> s.inside.remove(me));
    }

    private static void onChangedDimension(PlayerEvent.PlayerChangedDimensionEvent event) {
        if (event.getFrom() != InstanceManager.DIMENSION || !(event.getEntity() instanceof ServerPlayer player)) return;
        InstanceManager.sessionInside(player.getUUID()).ifPresent(s -> s.inside.remove(player.getUUID()));
        InstanceData data = InstanceData.get(player.server);
        if (data.returns.remove(player.getUUID()) != null) data.setDirty();
    }

    private static void onRespawn(PlayerEvent.PlayerRespawnEvent event) {
        if (!(event.getEntity() instanceof ServerPlayer player) || inArena(player.level())) return;
        InstanceData data = InstanceData.get(player.server);
        if (data.returns.remove(player.getUUID()) != null) data.setDirty();
    }

    private InstanceRules() {
    }
}
