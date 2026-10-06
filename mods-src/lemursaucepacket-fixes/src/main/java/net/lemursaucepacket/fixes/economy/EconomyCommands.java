package net.lemursaucepacket.fixes.economy;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.LongArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;

import net.lemursaucepacket.fixes.economy.npc.NpcBook;
import net.lemursaucepacket.fixes.economy.npc.NpcInteractions;
import net.lemursaucepacket.fixes.economy.shop.Shops;
import net.lemursaucepacket.fixes.economy.trade.Trades;
import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandBuildContext;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.commands.arguments.item.ItemArgument;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

/**
 * Players: /trade <player>, /purse, /worth (the held stack). Admins (/lsp, level 2): coins give|take|set, shop open (what
 * an NPC's "Let's trade" button runs: /lsp shop open @npc-uuid @initiator), npc talk|forget, values get|top.
 */
public final class EconomyCommands {
    static void register(CommandDispatcher<CommandSourceStack> d, CommandBuildContext context) {
        d.register(Commands.literal("trade")
                .then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                    Trades.request(c.getSource().getPlayerOrException(), EntityArgument.getPlayer(c, "player"));
                    return 1;
                })));
        d.register(Commands.literal("purse").executes(c -> {
            ServerPlayer p = c.getSource().getPlayerOrException();
            c.getSource().sendSuccess(() -> Component.literal("Purse: ").withStyle(ChatFormatting.GRAY).append(Coins.text(Coins.purse(p))), false);
            return 1;
        }));
        d.register(Commands.literal("worth").executes(c -> worth(c.getSource(), c.getSource().getPlayerOrException().getMainHandItem())));

        d.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("coins")
                        .then(Commands.literal("give").then(Commands.argument("players", EntityArgument.players()).then(Commands.argument("amount", LongArgumentType.longArg(1))
                                .executes(c -> coins(c, "give")))))
                        .then(Commands.literal("take").then(Commands.argument("players", EntityArgument.players()).then(Commands.argument("amount", LongArgumentType.longArg(1))
                                .executes(c -> coins(c, "take")))))
                        .then(Commands.literal("set").then(Commands.argument("players", EntityArgument.players()).then(Commands.argument("amount", LongArgumentType.longArg(0))
                                .executes(c -> coins(c, "set")))))
                        .then(Commands.literal("balance").then(Commands.argument("players", EntityArgument.players()).executes(c -> {
                            for (ServerPlayer p : EntityArgument.getPlayers(c, "players")) {
                                c.getSource().sendSuccess(() -> Component.literal(p.getGameProfile().getName() + ": ").append(Coins.text(Coins.purse(p))), false);
                            }
                            return 1;
                        }))))
                .then(Commands.literal("shop")
                        .then(Commands.literal("open").then(Commands.argument("npc", EntityArgument.entity()).then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            Entity npcEntity = EntityArgument.getEntity(c, "npc");
                            NpcBook.Npc npc = NpcBook.of(npcEntity);
                            if (npc == null || npc.shop() == null) {
                                c.getSource().sendFailure(Component.literal(npcEntity.getName().getString() + " has no shop (no lsp_npc.<who> tag with a shop in data/*/lsp_npcs)."));
                                return 0;
                            }
                            Shops.open(EntityArgument.getPlayer(c, "player"), npcEntity, npc);
                            return 1;
                        })))))
                .then(Commands.literal("npc")
                        .then(Commands.literal("talk").then(Commands.argument("npc", EntityArgument.entity()).then(Commands.argument("player", EntityArgument.player()).executes(c -> {
                            Entity npcEntity = EntityArgument.getEntity(c, "npc");
                            NpcBook.Npc npc = NpcBook.of(npcEntity);
                            if (npc == null) {
                                c.getSource().sendFailure(Component.literal(npcEntity.getName().getString() + " isn't one of the townsfolk."));
                                return 0;
                            }
                            NpcInteractions.interact(EntityArgument.getPlayer(c, "player"), npcEntity, npc);
                            return 1;
                        }))))
                        .then(Commands.literal("forget").then(Commands.argument("player", EntityArgument.player())
                                .executes(c -> forget(c, null))
                                .then(Commands.argument("who", StringArgumentType.word()).executes(c -> forget(c, StringArgumentType.getString(c, "who"))))))
                        .then(Commands.literal("list").executes(c -> {
                            for (NpcBook.Npc n : NpcBook.all()) {
                                c.getSource().sendSuccess(() -> Component.literal(n.id() + ": " + n.name() + (n.shop() == null ? "" : " (shop, " + n.shop().goods().size() + " goods)") + ", " + n.talks().size() + " talks"), false);
                            }
                            return NpcBook.all().size();
                        })))
                .then(Commands.literal("values")
                        .then(Commands.literal("get").then(Commands.argument("item", ItemArgument.item(context)).executes(c -> {
                            Item item = ItemArgument.getItem(c, "item").getItem();
                            c.getSource().sendSuccess(() -> Component.literal(BuiltInRegistries.ITEM.getKey(item) + " = " + fmt(ItemValues.unit(item)) + " coins, from " + ItemValues.source(item)).withStyle(ChatFormatting.GRAY), false);
                            return worth(c.getSource(), new ItemStack(item));
                        })))
                        .then(Commands.literal("top").executes(c -> {
                            List<Map.Entry<Item, Float>> list = new ArrayList<>(ItemValues.table().values().entrySet());
                            list.sort(Map.Entry.<Item, Float>comparingByValue(Comparator.reverseOrder()));
                            for (int i = 0; i < Math.min(15, list.size()); i++) {
                                var e = list.get(i);
                                c.getSource().sendSuccess(() -> Component.literal(BuiltInRegistries.ITEM.getKey(e.getKey()) + " = " + Coins.exact((long) (float) e.getValue())), false);
                            }
                            return list.size();
                        }))));
    }

    private static int coins(CommandContext<CommandSourceStack> c, String op) throws CommandSyntaxException {
        Collection<ServerPlayer> players = EntityArgument.getPlayers(c, "players");
        long amount = LongArgumentType.getLong(c, "amount");
        for (ServerPlayer p : players) {
            switch (op) {
                case "give" -> Coins.give(p, amount);
                case "take" -> {
                    if (!Coins.take(p, amount)) {
                        c.getSource().sendFailure(Component.literal(p.getGameProfile().getName() + " only has " + Coins.exact(Coins.purse(p)) + " coins."));
                        continue;
                    }
                }
                default -> {
                    long have = Coins.purse(p);
                    if (have > amount) Coins.take(p, have - amount);
                    else Coins.give(p, amount - have);
                }
            }
            c.getSource().sendSuccess(() -> Component.literal(p.getGameProfile().getName() + " now has ").append(Coins.text(Coins.purse(p))), true);
        }
        return players.size();
    }

    private static int forget(CommandContext<CommandSourceStack> c, String who) throws CommandSyntaxException {
        ServerPlayer p = EntityArgument.getPlayer(c, "player");
        int n = NpcInteractions.forget(p, who);
        c.getSource().sendSuccess(() -> Component.literal(p.getGameProfile().getName() + " forgot " + n + " meeting(s)."), true);
        return n;
    }

    private static int worth(CommandSourceStack source, ItemStack stack) {
        if (stack.isEmpty()) {
            source.sendFailure(Component.literal("Hold something to see what vendors pay for it."));
            return 0;
        }
        String why = ItemValues.refusal(stack);
        if (why != null) {
            source.sendFailure(Component.literal(why));
            return 0;
        }
        double each = ItemValues.worth(stack.copyWithCount(1));
        double all = ItemValues.worth(stack);
        source.sendSuccess(() -> Component.empty().append(stack.getHoverName()).append(Component.literal(": ").withStyle(ChatFormatting.GRAY))
                .append(Component.literal(fmt(each) + " each").withStyle(ChatFormatting.GOLD))
                .append(stack.getCount() > 1 ? Component.literal(", " + Coins.exact((long) Math.floor(all + 1e-9)) + " for " + stack.getCount()).withStyle(ChatFormatting.GOLD) : Component.empty()), false);
        return 1;
    }

    static String fmt(double v) {
        if (v >= 100) return Coins.exact((long) Math.floor(v + 1e-9));
        String s = String.format(java.util.Locale.ROOT, "%.2f", v);
        return s.replaceAll("\\.?0+$", "");
    }

    private EconomyCommands() {
    }
}
