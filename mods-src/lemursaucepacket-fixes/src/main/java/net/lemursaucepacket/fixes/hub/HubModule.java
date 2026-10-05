package net.lemursaucepacket.fixes.hub;

import java.nio.file.Files;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;

import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

/**
 * The spawn city (docs/world.md): on a brand-new world the server builds it from config/lemursaucepacket/
 * hub_plan.json as soon as it starts, then remembers that it did. An existing world is never touched: it is
 * marked SKIPPED the first time this version runs. Ops can build one anyway with {@code /lsp hub build}.
 */
public final class HubModule {
    /** A world younger than this (in ticks) when the server starts counts as brand new. */
    private static final long NEW_WORLD_TICKS = 1200;
    private static HubBuilder running;

    private HubModule() {
    }

    public static void init() {
        NeoForge.EVENT_BUS.addListener(HubModule::onStarted);
        NeoForge.EVENT_BUS.addListener(HubModule::onTick);
        NeoForge.EVENT_BUS.addListener(HubModule::onLogin);
        NeoForge.EVENT_BUS.addListener(HubModule::onCommands);
    }

    private static void onStarted(ServerStartedEvent event) {
        MinecraftServer server = event.getServer();
        running = null;
        HubState state = HubState.get(server);
        if (state.status() != HubState.Status.UNDECIDED && state.status() != HubState.Status.BUILDING) return;
        if (!Files.isRegularFile(HubPlan.file())) return;
        long age = server.overworld().getGameTime();
        if (state.status() == HubState.Status.UNDECIDED && age > NEW_WORLD_TICKS) {
            state.set(HubState.Status.SKIPPED, BlockPos.ZERO, 0);
            HubBuilder.LOGGER.info("This world existed before the spawn city did ({} ticks old): not building one. /lsp hub build makes one by hand.", age);
            return;
        }
        // A brand-new world, or a build that was interrupted by a restart: (re)build.
        start(server, null);
    }

    private static boolean start(MinecraftServer server, BlockPos at) {
        try {
            running = new HubBuilder(server, HubPlan.read(), at);
            HubBuilder.LOGGER.info("Building the spawn city{}", at == null ? " near world spawn" : " at " + at.toShortString());
            return true;
        } catch (Exception e) {
            HubBuilder.LOGGER.error("Can't read {}", HubPlan.file(), e);
            return false;
        }
    }

    private static void onTick(ServerTickEvent.Post event) {
        if (running != null && running.tick()) running = null;
    }

    private static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (running != null && event.getEntity() instanceof ServerPlayer p)
            p.sendSystemMessage(Component.literal("§6The city is being built §7(" + running.status() + "). You'll be taken there when it's ready."));
    }

    private static void onCommands(RegisterCommandsEvent event) {
        CommandDispatcher<CommandSourceStack> d = event.getDispatcher();
        d.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("hub")
                        .then(Commands.literal("status").executes(HubModule::status))
                        .then(Commands.literal("build")
                                .then(Commands.literal("here").executes(ctx -> build(ctx, true)))
                                .then(Commands.literal("near_spawn").executes(ctx -> build(ctx, false))))));
    }

    private static int status(CommandContext<CommandSourceStack> ctx) {
        HubState s = HubState.get(ctx.getSource().getServer());
        String now = running != null ? "building: " + running.status() : s.status().name().toLowerCase() + (s.status() == HubState.Status.BUILT ? " at " + s.centre().toShortString() : "");
        ctx.getSource().sendSuccess(() -> Component.literal("Spawn city: " + now), false);
        return 1;
    }

    private static int build(CommandContext<CommandSourceStack> ctx, boolean here) {
        if (running != null) {
            ctx.getSource().sendFailure(Component.literal("Already building: " + running.status()));
            return 0;
        }
        BlockPos at = here ? BlockPos.containing(ctx.getSource().getPosition()) : null;
        boolean ok = start(ctx.getSource().getServer(), at);
        ctx.getSource().sendSuccess(() -> Component.literal(ok ? "Building the spawn city" + (here ? " here" : " near world spawn") + ". It takes a minute or two." : "Couldn't read the city plan (see the log)."), true);
        return ok ? 1 : 0;
    }
}
