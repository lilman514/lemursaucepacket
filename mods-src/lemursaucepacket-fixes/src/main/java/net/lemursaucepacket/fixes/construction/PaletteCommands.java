package net.lemursaucepacket.fixes.construction;

import com.mojang.brigadier.CommandDispatcher;

import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;

/**
 * /palette buy (a player, by Gerta the Mason: the link her offer gives), and for the server: lsp palette shop &lt;npc&gt;
 * &lt;player&gt; (Gerta's "I've lost my palette" button) and lsp palette give &lt;player&gt;.
 */
final class PaletteCommands {
    static void register(CommandDispatcher<CommandSourceStack> d) {
        d.register(Commands.literal("palette")
                .then(Commands.literal("buy").executes(c -> Palette.buy(c.getSource().getPlayerOrException()) ? 1 : 0)));
        d.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("palette")
                        .then(Commands.literal("shop").then(Commands.argument("npc", EntityArgument.entity()).then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            Palette.offer(EntityArgument.getPlayer(c, "player"), EntityArgument.getEntity(c, "npc"));
                            return 1;
                        }))))
                        .then(Commands.literal("give").then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            ServerPlayer p = EntityArgument.getPlayer(c, "player");
                            Palette.give(p);
                            c.getSource().sendSuccess(() -> Component.literal("Gave " + p.getGameProfile().getName() + " a Mason's Palette"), true);
                            return 1;
                        })))));
    }

    private PaletteCommands() {
    }
}
