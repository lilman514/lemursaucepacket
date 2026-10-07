package net.lemursaucepacket.fixes.capes;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.suggestion.SuggestionProvider;

import net.lemursaucepacket.fixes.economy.npc.NpcBook;
import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;

/**
 * /capes (the collection; ESC → Capes runs it), /capes wear <cape> and /capes off, and the admin side under /lsp cape:
 * unlock, revoke, flag (quest rewards), award (trial wins), give (just the item), list, and shop (an NPC's "I've lost a
 * cape" button: the collection with a buy button for what that NPC makes).
 */
final class CapeCommands {
    private static final SuggestionProvider<CommandSourceStack> CAPES = (c, b) -> SharedSuggestionProvider.suggest(CapeDefs.all().stream().map(CapeDefs.Def::id), b);

    static void register(CommandDispatcher<CommandSourceStack> d) {
        d.register(Commands.literal("capes")
                .executes(c -> {
                    Capes.open(c.getSource().getPlayerOrException(), -1, "");
                    return 1;
                })
                .then(Commands.literal("wear").then(Commands.argument("cape", StringArgumentType.word()).suggests(CAPES)
                        .executes(c -> Capes.wear(c.getSource().getPlayerOrException(), StringArgumentType.getString(c, "cape")) ? 1 : 0)))
                .then(Commands.literal("off").executes(c -> {
                    ServerPlayer p = c.getSource().getPlayerOrException();
                    boolean off = Capes.takeOff(p);
                    p.sendSystemMessage(Component.literal(off ? "Cape off: it's in your bag." : "You aren't wearing a cape.").withStyle(ChatFormatting.GOLD));
                    return off ? 1 : 0;
                })));

        d.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("cape")
                        .then(Commands.literal("unlock").then(Commands.argument("player", EntityArgument.player()).then(Commands.argument("cape", StringArgumentType.word()).suggests(CAPES)
                                .executes(c -> {
                                    ServerPlayer p = EntityArgument.getPlayer(c, "player");
                                    String id = StringArgumentType.getString(c, "cape");
                                    if (CapeDefs.get(id) == null) return fail(c, "No such cape: " + id);
                                    return Capes.unlock(p, id, false) ? 1 : fail(c, p.getGameProfile().getName() + " has the " + id + " already.");
                                }))))
                        .then(Commands.literal("revoke").then(Commands.argument("player", EntityArgument.player()).then(Commands.argument("cape", StringArgumentType.word()).suggests(CAPES)
                                .executes(c -> Capes.revoke(EntityArgument.getPlayer(c, "player"), StringArgumentType.getString(c, "cape")) ? 1 : fail(c, "They hadn't earned it.")))))
                        // The rest of the line: flags have a colon (chapter:landfall), which a word argument stops at.
                        .then(Commands.literal("flag").then(Commands.argument("player", EntityArgument.player()).then(Commands.argument("flag", StringArgumentType.greedyString())
                                .executes(c -> {
                                    Capes.flag(EntityArgument.getPlayer(c, "player"), StringArgumentType.getString(c, "flag").trim());
                                    return 1;
                                }))))
                        .then(Commands.literal("award").then(Commands.argument("player", EntityArgument.player()).then(Commands.argument("cape", StringArgumentType.word()).suggests(CAPES)
                                .executes(c -> {
                                    String id = StringArgumentType.getString(c, "cape");
                                    if (CapeDefs.get(id) == null) return fail(c, "No such cape: " + id);
                                    Capes.award(EntityArgument.getPlayer(c, "player"), id);
                                    return 1;
                                }))))
                        .then(Commands.literal("give").then(Commands.argument("player", EntityArgument.player()).then(Commands.argument("cape", StringArgumentType.word()).suggests(CAPES)
                                .executes(c -> {
                                    CapeDefs.Def def = CapeDefs.get(StringArgumentType.getString(c, "cape"));
                                    if (def == null) return fail(c, "No such cape.");
                                    return Capes.give(EntityArgument.getPlayer(c, "player"), def) ? 1 : fail(c, "That cape has no item.");
                                }))))
                        .then(Commands.literal("list").then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            ServerPlayer p = EntityArgument.getPlayer(c, "player");
                            CapeData data = Capes.data(p);
                            CapeDefs.Def worn = Capes.worn(p);
                            c.getSource().sendSuccess(() -> Component.literal(p.getGameProfile().getName() + ": wearing " + (worn == null ? "nothing" : worn.id())
                                    + "; earned " + (data.unlocked.isEmpty() ? "none" : String.join(", ", data.unlocked))
                                    + "; flags " + (data.flags.isEmpty() ? "none" : String.join(", ", data.flags))), false);
                            return data.unlocked.size();
                        })))
                        .then(Commands.literal("shop").then(Commands.argument("npc", EntityArgument.entity()).then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            Entity npc = EntityArgument.getEntity(c, "npc");
                            String npcId = npc.getTags().stream().filter(t -> t.startsWith(NpcBook.TAG_PREFIX)).map(t -> t.substring(NpcBook.TAG_PREFIX.length())).findFirst().orElse("");
                            if (npcId.isEmpty()) return fail(c, npc.getName().getString() + " isn't one of the townsfolk.");
                            Capes.open(EntityArgument.getPlayer(c, "player"), npc.getId(), npcId);
                            return 1;
                        }))))));
    }

    private static int fail(CommandContext<CommandSourceStack> c, String message) {
        c.getSource().sendFailure(Component.literal(message));
        return 0;
    }

    private CapeCommands() {
    }
}
