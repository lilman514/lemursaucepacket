package net.lemursaucepacket.fixes.hiscores;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.google.gson.JsonObject;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.LongArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;

import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.server.level.ServerPlayer;

/**
 * /hiscores (anyone): Overall, any skill, activity, boss or collection (/hiscores mining), the lists of them
 * (/hiscores bosses), and a player's whole page (/hiscores player Name). For the server: lsp hiscores count &lt;player&gt;
 * &lt;counter&gt; [n] (trial win commands), record, upload, and keygen.
 */
final class HiscoresCommands {
    private static final String SITE = "https://play.limas.ca/hiscores";
    private static final int TOP = 10;
    private static final List<String> GROUPS = List.of("skills", "bosses", "activities", "collections");

    static void register(CommandDispatcher<CommandSourceStack> d) {
        d.register(Commands.literal("hiscores")
                .executes(c -> table(c, "overall"))
                .then(Commands.literal("player").then(Commands.argument("name", StringArgumentType.word())
                        .suggests((c, b) -> SharedSuggestionProvider.suggest(HiscoresStore.get(c.getSource().getServer()).all().stream().map(e -> e.name).toList(), b))
                        .executes(c -> player(c, StringArgumentType.getString(c, "name")))))
                .then(Commands.argument("table", StringArgumentType.word())
                        .suggests((c, b) -> {
                            List<String> ids = new java.util.ArrayList<>(GROUPS);
                            ids.addAll(Rankings.tables(HiscoresModule.config()).keySet());
                            return SharedSuggestionProvider.suggest(ids, b);
                        })
                        .executes(c -> {
                            String t = StringArgumentType.getString(c, "table").toLowerCase(Locale.ROOT);
                            return GROUPS.contains(t) ? group(c, t) : table(c, t);
                        })));
        d.register(Commands.literal("lsp").requires(s -> s.hasPermission(2))
                .then(Commands.literal("hiscores")
                        .then(Commands.literal("count").then(Commands.argument("player", EntityArgument.player()).then(Commands.argument("counter", StringArgumentType.word())
                                .executes(c -> count(c, 1))
                                .then(Commands.argument("amount", LongArgumentType.longArg(1)).executes(c -> count(c, LongArgumentType.getLong(c, "amount")))))))
                        .then(Commands.literal("record").executes(c -> {
                            int n = HiscoresModule.recordAll(c.getSource().getServer());
                            c.getSource().sendSuccess(() -> Component.literal("Recorded " + n + " player(s) for the hiscores"), true);
                            return n;
                        }))
                        .then(Commands.literal("upload").executes(c -> {
                            boolean ok = HiscoresModule.uploadNow(c.getSource().getServer(), true);
                            c.getSource().sendSuccess(() -> Component.literal(ok ? "Uploading every hiscores record (the log says how it went)" : "Not uploading: no key yet (/lsp hiscores keygen)"), true);
                            return ok ? 1 : 0;
                        }))
                        .then(Commands.literal("keygen").executes(c -> keygen(c, false)).then(Commands.literal("replace").executes(c -> keygen(c, true))))));
    }

    // ---------------------------------------------------------------- tables

    private static int table(CommandContext<CommandSourceStack> c, String id) {
        CommandSourceStack src = c.getSource();
        Map<String, Rankings.Table> tables = Rankings.tables(HiscoresModule.config());
        Rankings.Table t = tables.get(id);
        if (t == null) {
            src.sendFailure(Component.literal("No hiscores table '" + id + "'. Try /hiscores skills, bosses, activities or collections."));
            return 0;
        }
        HiscoresModule.recordOnline(src.getServer());
        List<Rankings.Row> rows = Rankings.rank(HiscoresStore.get(src.getServer()), t);
        UUID me = src.getEntity() instanceof ServerPlayer p ? p.getUUID() : null;
        src.sendSystemMessage(Component.literal("Hiscores · " + t.name()).withStyle(ChatFormatting.GOLD, ChatFormatting.BOLD));
        if (rows.isEmpty()) src.sendSystemMessage(Component.literal("Nobody on this table yet.").withStyle(ChatFormatting.GRAY));
        for (int i = 0; i < Math.min(TOP, rows.size()); i++) src.sendSystemMessage(row(i + 1, rows.get(i), t, me));
        int mine = me == null ? 0 : Rankings.rankOf(rows, me);
        if (mine > TOP) src.sendSystemMessage(row(mine, rows.get(mine - 1), t, me));
        else if (me != null && mine == 0) src.sendSystemMessage(Component.literal("You aren't on this table yet.").withStyle(ChatFormatting.GRAY));
        src.sendSystemMessage(menu(t.id()));
        return rows.size();
    }

    private static MutableComponent row(int rank, Rankings.Row r, Rankings.Table t, UUID me) {
        boolean self = r.uuid().equals(me);
        MutableComponent line = Component.literal(String.format("%3d. ", rank)).withStyle(ChatFormatting.DARK_GRAY)
                .append(link(r.name(), "/hiscores player " + r.name(), "See " + r.name() + "'s hiscores", self ? ChatFormatting.YELLOW : ChatFormatting.WHITE))
                .append(Component.literal("  "));
        String value = switch (t.kind()) {
            case OVERALL -> "Total " + r.level() + "  ·  " + num(r.value()) + " XP";
            case SKILL -> "Level " + r.level() + "  ·  " + num(r.value()) + " XP";
            case COMBAT -> "Combat " + r.value();
            default -> num(r.value());
        };
        return line.append(Component.literal(value).withStyle(ChatFormatting.GRAY));
    }

    private static MutableComponent menu(String table) {
        MutableComponent m = Component.literal("");
        for (String g : GROUPS) m.append(link("[" + cap(g) + "]", "/hiscores " + g, "Every " + g.replaceAll("s$", "") + " table", ChatFormatting.AQUA)).append(Component.literal(" "));
        return m.append(url("[On the website]", SITE + "?table=" + table));
    }

    private static int group(CommandContext<CommandSourceStack> c, String group) {
        HiscoresConfig cfg = HiscoresModule.config();
        MutableComponent line = Component.literal(cap(group) + ": ").withStyle(ChatFormatting.GOLD);
        boolean first = true;
        for (Rankings.Table t : Rankings.tables(cfg).values()) {
            boolean in = switch (group) {
                case "skills" -> t.kind() == Rankings.Kind.SKILL || t.kind() == Rankings.Kind.OVERALL || t.kind() == Rankings.Kind.COMBAT;
                case "bosses" -> t.kind() == Rankings.Kind.BOSS;
                case "activities" -> t.kind() == Rankings.Kind.ACTIVITY;
                default -> t.kind() == Rankings.Kind.COLLECTION;
            };
            if (!in) continue;
            if (!first) line.append(Component.literal(" · ").withStyle(ChatFormatting.DARK_GRAY));
            line.append(link(t.name(), "/hiscores " + t.id(), "The " + t.name() + " table", ChatFormatting.WHITE));
            first = false;
        }
        c.getSource().sendSystemMessage(line);
        return 1;
    }

    // ---------------------------------------------------------------- a player's page

    private static int player(CommandContext<CommandSourceStack> c, String name) {
        CommandSourceStack src = c.getSource();
        HiscoresModule.recordOnline(src.getServer());
        HiscoresStore store = HiscoresStore.get(src.getServer());
        HiscoresStore.Entry e = store.findByName(name);
        if (e == null || e.record == null || !e.record.has("skills")) {
            src.sendFailure(Component.literal("Nobody called " + name + " is on the hiscores."));
            return 0;
        }
        Map<String, Rankings.Table> tables = Rankings.tables(HiscoresModule.config());
        JsonObject r = e.record;
        src.sendSystemMessage(Component.literal("Hiscores · " + e.name).withStyle(ChatFormatting.GOLD, ChatFormatting.BOLD));
        JsonObject total = r.getAsJsonObject("total");
        src.sendSystemMessage(Component.literal("Overall #" + rank(store, tables.get("overall"), e.uuid) + "  ·  Total " + Rankings.num(total, "level") + "  ·  "
                + num(Rankings.num(total, "xp")) + " XP  ·  Combat " + Rankings.num(r, "combat")).withStyle(ChatFormatting.YELLOW));
        MutableComponent skills = Component.literal("");
        boolean first = true;
        for (Rankings.Table t : tables.values()) {
            if (t.kind() != Rankings.Kind.SKILL) continue;
            if (!first) skills.append(Component.literal("  ").withStyle(ChatFormatting.DARK_GRAY));
            long level = Rankings.num(r.getAsJsonObject("skills").getAsJsonObject(t.id()), "level");
            skills.append(link(t.name() + " " + level, "/hiscores " + t.id(), t.name() + ": rank " + rank(store, t, e.uuid), ChatFormatting.WHITE));
            first = false;
        }
        src.sendSystemMessage(skills);
        sendCounts(src, store, tables, e, Rankings.Kind.BOSS, "Bosses", r.getAsJsonObject("bosses"));
        sendCounts(src, store, tables, e, Rankings.Kind.ACTIVITY, "Activities", r.getAsJsonObject("activities"));
        sendCounts(src, store, tables, e, Rankings.Kind.COLLECTION, "Collections", r.getAsJsonObject("collections"));
        src.sendSystemMessage(url("[On the website]", SITE + "?player=" + e.name));
        return 1;
    }

    private static void sendCounts(CommandSourceStack src, HiscoresStore store, Map<String, Rankings.Table> tables, HiscoresStore.Entry e, Rankings.Kind kind, String title, JsonObject values) {
        MutableComponent line = Component.literal(title + ": ").withStyle(ChatFormatting.GOLD);
        boolean any = false;
        for (Rankings.Table t : tables.values()) {
            if (t.kind() != kind) continue;
            long n = Rankings.num(values, t.id());
            if (n <= 0) continue;
            if (any) line.append(Component.literal(" · ").withStyle(ChatFormatting.DARK_GRAY));
            String text = t.name() + " " + num(n);
            if (kind == Rankings.Kind.COLLECTION) text += "/" + HiscoresModule.collectionSize(t.id());
            line.append(link(text, "/hiscores " + t.id(), t.name() + ": rank " + rank(store, t, e.uuid), ChatFormatting.WHITE));
            any = true;
        }
        if (!any) line.append(Component.literal("none yet").withStyle(ChatFormatting.GRAY));
        src.sendSystemMessage(line);
    }

    private static int rank(HiscoresStore store, Rankings.Table t, UUID uuid) {
        return Rankings.rankOf(Rankings.rank(store, t), uuid);
    }

    // ---------------------------------------------------------------- the server's

    private static int count(CommandContext<CommandSourceStack> c, long amount) throws com.mojang.brigadier.exceptions.CommandSyntaxException {
        ServerPlayer p = EntityArgument.getPlayer(c, "player");
        String counter = StringArgumentType.getString(c, "counter");
        long now = Hiscores.count(p, counter, amount);
        c.getSource().sendSuccess(() -> Component.literal(p.getGameProfile().getName() + "'s " + counter + " is now " + now), false);
        return (int) Math.min(Integer.MAX_VALUE, now);
    }

    private static int keygen(CommandContext<CommandSourceStack> c, boolean replace) {
        if (!replace && java.nio.file.Files.isRegularFile(Uploader.privateKey())) {
            c.getSource().sendFailure(Component.literal("This server has a hiscores key already (public: " + Uploader.publicKeyText() + "). /lsp hiscores keygen replace makes a new one."));
            return 0;
        }
        try {
            String pub = Uploader.keygen();
            HiscoresModule.LOGGER.info("Hiscores key made. Public key, for the website: {}", pub);
            c.getSource().sendSuccess(() -> Component.literal("Hiscores key made. The public key (also in the log and in config/lemursaucepacket/hiscores-public.key) goes in the website's list: " + pub), true);
            return 1;
        } catch (Exception ex) {
            c.getSource().sendFailure(Component.literal("Couldn't make a key: " + ex));
            return 0;
        }
    }

    // ---------------------------------------------------------------- text

    private static MutableComponent link(String text, String command, String hover, ChatFormatting colour) {
        return Component.literal(text).withStyle(s -> s.withColor(colour).withClickEvent(new ClickEvent(ClickEvent.Action.RUN_COMMAND, command))
                .withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, Component.literal(hover))));
    }

    private static MutableComponent url(String text, String url) {
        return Component.literal(text).withStyle(s -> s.withColor(ChatFormatting.GREEN).withUnderlined(true).withClickEvent(new ClickEvent(ClickEvent.Action.OPEN_URL, url))
                .withHoverEvent(new HoverEvent(HoverEvent.Action.SHOW_TEXT, Component.literal(url))));
    }

    private static String num(long n) {
        return NumberFormat.getIntegerInstance(Locale.UK).format(n);
    }

    private static String cap(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private HiscoresCommands() {
    }
}
