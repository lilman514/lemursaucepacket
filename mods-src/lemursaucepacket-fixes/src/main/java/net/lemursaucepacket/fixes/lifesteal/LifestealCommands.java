package net.lemursaucepacket.fixes.lifesteal;

import java.nio.file.Path;
import java.util.Collection;

import com.mojang.authlib.GameProfile;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;

import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.commands.arguments.GameProfileArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.neoforge.event.RegisterCommandsEvent;

/**
 * Admin commands under {@code /lsp} (the KubeJS scripts add {@code /lsp hearts}, {@code /lsp lifesteal} and
 * {@code /lsp owner} to the same tree; Brigadier merges them).
 */
public final class LifestealCommands {
    static void register(RegisterCommandsEvent event) {
        register(event.getDispatcher());
    }

    private static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("erase")
                        .then(Commands.literal("preview").then(Commands.argument("player", GameProfileArgument.gameProfile()).executes(LifestealCommands::preview))))
                .then(Commands.literal("elimination")
                        .then(Commands.literal("list").executes(LifestealCommands::list))
                        .then(Commands.literal("pause").executes(ctx -> pause(ctx, true)))
                        .then(Commands.literal("resume").executes(ctx -> pause(ctx, false)))
                        .then(Commands.literal("force").then(Commands.argument("player", EntityArgument.player()).executes(LifestealCommands::force))))
                .then(Commands.literal("archive").then(Commands.literal("list").executes(LifestealCommands::archives)))
                .then(Commands.literal("restore")
                        .then(Commands.literal("blocks").then(Commands.argument("file", StringArgumentType.string()).executes(ctx -> restore(ctx, true))))
                        .then(Commands.literal("items").then(Commands.argument("file", StringArgumentType.string()).executes(ctx -> restore(ctx, false)))))
                .then(Commands.literal("purge").then(Commands.literal("sweep").executes(LifestealCommands::sweep))));
    }

    private static int preview(CommandContext<CommandSourceStack> ctx) throws CommandSyntaxException {
        Collection<GameProfile> profiles = GameProfileArgument.getGameProfiles(ctx, "player");
        MinecraftServer server = ctx.getSource().getServer();
        for (GameProfile profile : profiles) {
            ServerPlayer online = server.getPlayerList().getPlayer(profile.getId());
            int generation = online != null ? KubeData.generation(online) : LifestealState.get(server).erasedGeneration(profile.getId()) + 1;
            int[] counts = EraseJob.preview(server, profile.getId(), generation);
            int chunks = LifestealState.get(server).placedChunks(profile.getId()).size();
            ctx.getSource().sendSuccess(() -> Component.literal(profile.getName() + " (life " + (generation + 1) + "): " + counts[0] + " placed blocks in loaded chunks, " + counts[1] + " of " + chunks + " chunks with their blocks not loaded"
                    + (online == null ? "; offline, so the life number is a guess" : "")), false);
        }
        return profiles.size();
    }

    private static int list(CommandContext<CommandSourceStack> ctx) {
        var jobs = LifestealState.get(ctx.getSource().getServer()).jobs();
        if (jobs.isEmpty()) ctx.getSource().sendSuccess(() -> Component.literal("No erasure is running." + (LifestealModule.erasuresPaused ? " (paused)" : "")), false);
        for (EraseJob job : jobs) ctx.getSource().sendSuccess(() -> Component.literal(job.describe() + (LifestealModule.erasuresPaused ? " (paused)" : "")), false);
        return jobs.size();
    }

    private static int pause(CommandContext<CommandSourceStack> ctx, boolean pause) {
        LifestealModule.erasuresPaused = pause;
        LifestealModule.LOGGER.info("Erasures {} by {}", pause ? "paused" : "resumed", ctx.getSource().getTextName());
        ctx.getSource().sendSuccess(() -> Component.literal(pause ? "Erasures paused until the server restarts or /lsp elimination resume." : "Erasures resumed."), true);
        return 1;
    }

    private static int force(CommandContext<CommandSourceStack> ctx) throws CommandSyntaxException {
        ServerPlayer player = EntityArgument.getPlayer(ctx, "player");
        if (!Limbo.isInLimbo(player) || !player.isDeadOrDying()) {
            ctx.getSource().sendFailure(Component.literal(player.getGameProfile().getName() + " is not dead at zero hearts. /lsp lifesteal eliminate <player> first."));
            return 0;
        }
        LifestealModule.LOGGER.info("{} forced the elimination of {}", ctx.getSource().getTextName(), player.getGameProfile().getName());
        Limbo.accept(player);
        return 1;
    }

    private static int archives(CommandContext<CommandSourceStack> ctx) {
        var files = Archive.list(ctx.getSource().getServer());
        if (files.isEmpty()) ctx.getSource().sendSuccess(() -> Component.literal("No archives in " + Archive.directory(ctx.getSource().getServer())), false);
        for (Path file : files) {
            Archive archive = Archive.open(file);
            String line = archive == null ? file.getFileName() + ": unreadable" : file.getFileName() + ": " + archive.player() + ", " + archive.blockCount() + " blocks, " + archive.itemCount() + " item stacks";
            ctx.getSource().sendSuccess(() -> Component.literal(line).withStyle(ChatFormatting.GRAY), false);
        }
        return files.size();
    }

    private static int restore(CommandContext<CommandSourceStack> ctx, boolean blocks) throws CommandSyntaxException {
        String name = StringArgumentType.getString(ctx, "file");
        MinecraftServer server = ctx.getSource().getServer();
        Path file = Archive.directory(server).resolve(name);
        if (!file.normalize().startsWith(Archive.directory(server).normalize())) {
            ctx.getSource().sendFailure(Component.literal("Archive names only."));
            return 0;
        }
        Archive archive = Archive.open(file);
        if (archive == null) {
            ctx.getSource().sendFailure(Component.literal("No archive called " + name + ". /lsp archive list"));
            return 0;
        }
        if (blocks) {
            int[] result = archive.restoreBlocks(server);
            LifestealModule.LOGGER.info("{} restored {} blocks from {} ({} skipped)", ctx.getSource().getTextName(), result[0], name, result[1]);
            ctx.getSource().sendSuccess(() -> Component.literal(result[0] + " blocks put back, " + result[1] + " skipped (something else is there now)."), true);
            return result[0];
        }
        ServerPlayer player = ctx.getSource().getPlayerOrException();
        int n = archive.restoreItems(player);
        LifestealModule.LOGGER.info("{} took {} item stacks from {}", player.getGameProfile().getName(), n, name);
        ctx.getSource().sendSuccess(() -> Component.literal(n + " item stacks handed to " + player.getGameProfile().getName() + " (the overflow is at their feet), with the erased life's ownership removed."), true);
        return n;
    }

    private static int sweep(CommandContext<CommandSourceStack> ctx) {
        int n = Purge.sweepLoaded(ctx.getSource().getServer());
        ctx.getSource().sendSuccess(() -> Component.literal(n + " item stacks of erased lives deleted from what is loaded."), true);
        return n;
    }

    private LifestealCommands() {
    }
}
