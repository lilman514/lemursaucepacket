package net.lemursaucepacket.instances;

import java.util.ArrayList;
import java.util.List;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;

import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.commands.arguments.ResourceLocationArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;

/**
 * {@code /instance leave} for anyone in a fight; {@code /instances list|start|end|open|keeper} for admins (and tests:
 * {@code open} shows a player an event's window as if they'd spoken to its NPC, minus the NPC).
 */
final class InstanceCommands {
    static void register(CommandDispatcher<CommandSourceStack> d) {
        d.register(Commands.literal("instance").then(Commands.literal("leave").executes(c -> {
            ServerPlayer p = c.getSource().getPlayerOrException();
            if (!InstanceManager.leave(p)) {
                c.getSource().sendFailure(Component.literal("You're not in an event."));
                return 0;
            }
            p.sendSystemMessage(Component.literal("You leave the fight.").withStyle(ChatFormatting.GRAY));
            return 1;
        })));
        d.register(Commands.literal("instances").requires(s -> s.hasPermission(2))
                .then(Commands.literal("list").executes(c -> {
                    var server = c.getSource().getServer();
                    List<String> lines = new ArrayList<>();
                    InstanceManager.sessions().values().forEach(s -> lines.add("Run " + s.id + ": " + s.event + " in slot " + s.slot + ", "
                            + s.inside.size() + "/" + s.members.size() + " inside, " + (s.wonAt >= 0 ? "won" : (server.getTickCount() - s.started) / 20 + " s in")));
                    InstanceManager.lobbies().values().forEach(l -> lines.add("Co-op fight for " + l.event + ": " + l.members.size() + " waiting"));
                    if (lines.isEmpty()) lines.add("Nothing running. Events: " + String.join(", ", EventLoader.all().keySet().stream().map(ResourceLocation::toString).toList()));
                    lines.forEach(line -> c.getSource().sendSuccess(() -> Component.literal(line), false));
                    return InstanceManager.sessions().size();
                }))
                .then(Commands.literal("start").then(Commands.argument("event", ResourceLocationArgument.id())
                        .suggests((c, b) -> SharedSuggestionProvider.suggestResource(EventLoader.all().keySet(), b))
                        .then(Commands.argument("players", EntityArgument.players()).executes(c -> {
                            ResourceLocation id = ResourceLocationArgument.getId(c, "event");
                            EventDef def = EventLoader.get(id);
                            if (def == null) {
                                c.getSource().sendFailure(Component.literal("No such event: " + id));
                                return 0;
                            }
                            List<ServerPlayer> party = new ArrayList<>(EntityArgument.getPlayers(c, "players"));
                            party.removeIf(p -> InstanceManager.sessionInside(p.getUUID()).isPresent());
                            return InstanceManager.start(c.getSource().getServer(), id, def, party).map(s -> {
                                c.getSource().sendSuccess(() -> Component.literal("Started run " + s.id + " of " + id + " for " + party.size()), true);
                                return 1;
                            }).orElse(0);
                        }))))
                .then(Commands.literal("end").then(Commands.argument("run", IntegerArgumentType.integer(1)).executes(c -> {
                    var s = InstanceManager.sessions().get(IntegerArgumentType.getInteger(c, "run"));
                    if (s == null) {
                        c.getSource().sendFailure(Component.literal("No such run."));
                        return 0;
                    }
                    InstanceManager.end(c.getSource().getServer(), s, "An admin ended the fight.");
                    return 1;
                })))
                .then(Commands.literal("open").then(Commands.argument("event", ResourceLocationArgument.id())
                        .suggests((c, b) -> SharedSuggestionProvider.suggestResource(EventLoader.all().keySet(), b))
                        .then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            InstanceManager.open(EntityArgument.getPlayer(c, "player"), ResourceLocationArgument.getId(c, "event"), null, InstanceNet.OPEN);
                            return 1;
                        }))))
                .then(Commands.literal("keeper").then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                    ServerPlayer p = EntityArgument.getPlayer(c, "player");
                    var kept = InstanceData.get(c.getSource().getServer()).kept.get(p.getUUID());
                    if (kept == null || kept.isEmpty()) {
                        c.getSource().sendSuccess(() -> Component.literal("Nothing kept for " + p.getGameProfile().getName()), false);
                        return 0;
                    }
                    kept.forEach((event, stacks) -> c.getSource().sendSuccess(() -> Component.literal(event + ": " + stacks.size() + " stack(s): "
                            + String.join(", ", stacks.stream().map(s -> s.getCount() + " " + s.getHoverName().getString()).toList())), false));
                    return kept.values().stream().mapToInt(List::size).sum();
                }))));
    }

    private InstanceCommands() {
    }
}
