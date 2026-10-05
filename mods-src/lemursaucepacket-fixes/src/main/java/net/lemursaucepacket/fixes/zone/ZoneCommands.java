package net.lemursaucepacket.fixes.zone;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.stream.Collectors;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.BoolArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;

import net.lemursaucepacket.fixes.zone.SafeZones.Flag;
import net.lemursaucepacket.fixes.zone.SafeZones.Zone;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.commands.arguments.coordinates.BlockPosArgument;
import net.minecraft.commands.arguments.coordinates.ColumnPosArgument;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ColumnPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.neoforge.event.RegisterCommandsEvent;

/**
 * /lsp zone ... (ops): list, add a box or a full-height column, remove, switch a flag, bypass for yourself.
 * The hub placement script adds the city with {@code /lsp zone addcolumn hub <x1 z1> <x2 z2>}.
 */
public final class ZoneCommands {
    private ZoneCommands() {
    }

    static void register(RegisterCommandsEvent event) {
        register(event.getDispatcher());
    }

    private static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
        dispatcher.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("zone")
                        .then(Commands.literal("list").executes(ZoneCommands::list))
                        .then(Commands.literal("here").executes(ZoneCommands::here))
                        .then(Commands.literal("bypass").executes(ZoneCommands::bypass))
                        .then(Commands.literal("add").then(Commands.argument("name", StringArgumentType.word())
                                .then(Commands.argument("from", BlockPosArgument.blockPos()).then(Commands.argument("to", BlockPosArgument.blockPos()).executes(ZoneCommands::addBox)))))
                        .then(Commands.literal("addcolumn").then(Commands.argument("name", StringArgumentType.word())
                                .then(Commands.argument("from", ColumnPosArgument.columnPos()).then(Commands.argument("to", ColumnPosArgument.columnPos()).executes(ZoneCommands::addColumn)))))
                        .then(Commands.literal("remove").then(Commands.argument("name", StringArgumentType.word()).suggests(ZoneCommands::suggestZones).executes(ZoneCommands::remove)))
                        .then(Commands.literal("flag").then(Commands.argument("name", StringArgumentType.word()).suggests(ZoneCommands::suggestZones)
                                .then(Commands.argument("flag", StringArgumentType.word())
                                        .suggests((ctx, b) -> SharedSuggestionProvider.suggest(Arrays.stream(Flag.values()).map(Flag::id), b))
                                        .then(Commands.argument("on", BoolArgumentType.bool()).executes(ZoneCommands::flag)))))));
    }

    private static java.util.concurrent.CompletableFuture<com.mojang.brigadier.suggestion.Suggestions> suggestZones(CommandContext<CommandSourceStack> ctx, com.mojang.brigadier.suggestion.SuggestionsBuilder b) {
        return SharedSuggestionProvider.suggest(SafeZones.get(ctx.getSource().getServer()).all().stream().map(Zone::name), b);
    }

    private static String describe(Zone z) {
        String flags = z.flags().stream().map(Flag::id).collect(Collectors.joining(","));
        return z.name() + " in " + z.dimension() + " from " + z.minX() + " " + z.minY() + " " + z.minZ() + " to " + z.maxX() + " " + z.maxY() + " " + z.maxZ() + " [" + (flags.isEmpty() ? "nothing" : flags) + "]";
    }

    private static int list(CommandContext<CommandSourceStack> ctx) {
        var zones = SafeZones.get(ctx.getSource().getServer()).all();
        if (zones.isEmpty()) ctx.getSource().sendSuccess(() -> Component.literal("No safe zones."), false);
        for (Zone z : zones) ctx.getSource().sendSuccess(() -> Component.literal(describe(z)), false);
        return zones.size();
    }

    private static int here(CommandContext<CommandSourceStack> ctx) {
        var src = ctx.getSource();
        String dim = src.getLevel().dimension().location().toString();
        var pos = src.getPosition();
        int n = 0;
        for (Zone z : SafeZones.get(src.getServer()).all()) {
            if (!z.contains(dim, pos.x, pos.y, pos.z)) continue;
            n++;
            src.sendSuccess(() -> Component.literal("Inside " + describe(z)), false);
        }
        if (n == 0) src.sendSuccess(() -> Component.literal("Not inside any safe zone."), false);
        return n;
    }

    private static int bypass(CommandContext<CommandSourceStack> ctx) throws CommandSyntaxException {
        ServerPlayer player = ctx.getSource().getPlayerOrException();
        boolean on = !ZoneEvents.BYPASS.remove(player.getUUID());
        if (on) ZoneEvents.BYPASS.add(player.getUUID());
        ctx.getSource().sendSuccess(() -> Component.literal(on ? "Safe zones no longer stop you (until you log out or run this again)." : "Safe zones apply to you again (creative mode still bypasses)."), false);
        return 1;
    }

    private static int addBox(CommandContext<CommandSourceStack> ctx) throws CommandSyntaxException {
        BlockPos a = BlockPosArgument.getBlockPos(ctx, "from");
        BlockPos b = BlockPosArgument.getBlockPos(ctx, "to");
        return add(ctx, Math.min(a.getX(), b.getX()), Math.min(a.getY(), b.getY()), Math.min(a.getZ(), b.getZ()), Math.max(a.getX(), b.getX()), Math.max(a.getY(), b.getY()), Math.max(a.getZ(), b.getZ()));
    }

    private static int addColumn(CommandContext<CommandSourceStack> ctx) {
        ColumnPos a = ColumnPosArgument.getColumnPos(ctx, "from");
        ColumnPos b = ColumnPosArgument.getColumnPos(ctx, "to");
        ServerLevel level = ctx.getSource().getLevel();
        return add(ctx, Math.min(a.x(), b.x()), level.getMinBuildHeight(), Math.min(a.z(), b.z()), Math.max(a.x(), b.x()), level.getMaxBuildHeight() - 1, Math.max(a.z(), b.z()));
    }

    private static int add(CommandContext<CommandSourceStack> ctx, int x0, int y0, int z0, int x1, int y1, int z1) {
        String name = StringArgumentType.getString(ctx, "name");
        SafeZones data = SafeZones.get(ctx.getSource().getServer());
        Zone old = data.named(name);
        Zone zone = new Zone(name, ctx.getSource().getLevel().dimension().location().toString(), x0, y0, z0, x1, y1, z1, old != null ? old.flags() : EnumSet.allOf(Flag.class));
        data.put(zone);
        ctx.getSource().sendSuccess(() -> Component.literal((old != null ? "Moved " : "Added ") + describe(zone)), true);
        return 1;
    }

    private static int remove(CommandContext<CommandSourceStack> ctx) {
        String name = StringArgumentType.getString(ctx, "name");
        boolean removed = SafeZones.get(ctx.getSource().getServer()).remove(name);
        ctx.getSource().sendSuccess(() -> Component.literal(removed ? "Removed safe zone " + name : "No safe zone called " + name), true);
        return removed ? 1 : 0;
    }

    private static int flag(CommandContext<CommandSourceStack> ctx) {
        String name = StringArgumentType.getString(ctx, "name");
        SafeZones data = SafeZones.get(ctx.getSource().getServer());
        Zone z = data.named(name);
        Flag flag;
        try {
            flag = Flag.parse(StringArgumentType.getString(ctx, "flag"));
        } catch (IllegalArgumentException e) {
            ctx.getSource().sendFailure(Component.literal("Flags: " + Arrays.stream(Flag.values()).map(Flag::id).collect(Collectors.joining(", "))));
            return 0;
        }
        if (z == null) {
            ctx.getSource().sendFailure(Component.literal("No safe zone called " + name));
            return 0;
        }
        EnumSet<Flag> flags = z.flags().isEmpty() ? EnumSet.noneOf(Flag.class) : EnumSet.copyOf(z.flags());
        if (BoolArgumentType.getBool(ctx, "on")) flags.add(flag);
        else flags.remove(flag);
        Zone updated = new Zone(z.name(), z.dimension(), z.minX(), z.minY(), z.minZ(), z.maxX(), z.maxY(), z.maxZ(), flags);
        data.put(updated);
        ctx.getSource().sendSuccess(() -> Component.literal("Now " + describe(updated)), true);
        return 1;
    }
}
