package net.lemursaucepacket.fixes.capes.client;

import java.util.ArrayList;
import java.util.List;

import com.google.gson.JsonObject;

import net.lemursaucepacket.fixes.capes.CapeDefs;
import net.lemursaucepacket.fixes.capes.CapeNet;
import net.lemursaucepacket.fixes.capes.Capes;
import net.lemursaucepacket.fixes.economy.Coins;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.util.FormattedCharSequence;
import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * The cape collection (ESC → Capes, or /capes): every cape there is, the earned ones lit, grouped by kind. Pick one to
 * see it, how to earn it, its perk, and, once earned, whether you have it and where to get another if it's lost. From
 * the NPC who makes capes ("I've lost a cape") it also sells another of the ones they make.
 */
final class CapeCollectionScreen extends Screen {
    private static final int W = 360, H = 226, CELL = 20, COLUMNS = 7, DETAIL_X = 168;
    private static final int PANEL = 0xE8141820, EDGE = 0xFF6B5A3C, LINE = 0xFFE0AC46, GOLD = 0xFFF8D982, TEXT = 0xFFE5E2D9, MUTED = 0xFFA8A499;
    private static final int GOOD = 0xFF8FD18B, WARN = 0xFFE8B45C, PERK = 0xFF8ED6E0;
    private static final List<String> KINDS = List.of("skill", "quest", "achievement", "legendary", "owner");

    private final int npc;
    private final String npcId;
    private final List<Cell> cells = new ArrayList<>();
    private final List<Header> headers = new ArrayList<>();
    private CapeDefs.Def selected;
    private int left, top;
    private Button wear, buy;

    private record Cell(CapeDefs.Def def, int x, int y) {
    }

    private record Header(String text, int x, int y) {
    }

    CapeCollectionScreen(int npc, String npcId) {
        super(Component.literal("Capes"));
        this.npc = npc;
        this.npcId = npcId;
    }

    private boolean shop() {
        return npc >= 0;
    }

    @Override
    protected void init() {
        left = (width - W) / 2;
        top = Math.max(2, (height - H) / 2);
        cells.clear();
        headers.clear();
        int y = 26;
        for (String kind : KINDS) {
            List<CapeDefs.Def> list = CapeDefs.all().stream().filter(d -> d.kind().equals(kind)).toList();
            if (list.isEmpty()) continue;
            long earned = list.stream().filter(this::earned).count();
            headers.add(new Header(kindTitle(kind) + "  " + earned + "/" + list.size(), 10, y));
            y += 11;
            for (int i = 0; i < list.size(); i++) cells.add(new Cell(list.get(i), 10 + (i % COLUMNS) * CELL, y + (i / COLUMNS) * CELL));
            y += ((list.size() + COLUMNS - 1) / COLUMNS) * CELL + 3;
        }
        if (selected == null) selected = cells.stream().map(Cell::def).filter(this::earned).findFirst().orElse(cells.isEmpty() ? null : cells.get(0).def());

        // Wear and Close share the bottom row; at a cape maker's, the buy button gets a row above them.
        int bx = left + DETAIL_X, bw = W - 10 - DETAIL_X, half = (bw - 4) / 2;
        wear = addRenderableWidget(Button.builder(Component.literal("Wear it"), b -> {
            if (selected == null) return;
            boolean on = selected == wornDef();
            PacketDistributor.sendToServer(new CapeNet.Act(on ? CapeNet.TAKE_OFF : CapeNet.WEAR, selected.id(), -1));
        }).bounds(bx, top + H - 28, half, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Close"), b -> onClose()).bounds(bx + half + 4, top + H - 28, bw - half - 4, 20).build());
        if (shop()) {
            buy = addRenderableWidget(Button.builder(Component.literal("Another"), b -> {
                if (selected != null) PacketDistributor.sendToServer(new CapeNet.Act(CapeNet.BUY, selected.id(), npc));
            }).bounds(bx, top + H - 52, bw, 20).build());
        }
        updateButtons();
    }

    @Override
    public void tick() {
        updateButtons();
    }

    /** Labels follow what's in your bag and slot (the server moves the items; their sync updates them here). */
    private void updateButtons() {
        if (wear == null) return;
        CapeDefs.Def d = selected;
        boolean earned = d != null && earned(d);
        boolean on = d != null && d == wornDef();
        boolean bag = d != null && inBag(d);
        wear.setMessage(Component.literal(on ? "Take off" : "Wear it"));
        wear.active = earned && (on || bag);
        wear.setTooltip(d == null || wear.active ? null : Tooltip.create(Component.literal(earned ? "It isn't in your bag." : "You haven't earned it yet.")));
        if (buy != null) {
            CapeDefs.Reclaim r = d == null ? null : d.reclaim();
            boolean here = r != null && r.coins() > 0 && r.npc().equals(npcId);
            buy.setMessage(Component.literal(here ? "Another one: " + Coins.exact(r.coins()) + " coins" : "Not made here"));
            buy.active = here && earned;
            buy.setTooltip(Tooltip.create(Component.literal(!here ? (r == null || r.where().isEmpty() ? "Nobody makes this cape." : r.where() + " makes this cape.")
                    : earned ? "Have another made for " + Coins.exact(r.coins()) + " coins." : "Only someone who has earned it can have one made.")));
        }
    }

    // ---------------------------------------------------------------- what the client knows

    private boolean earned(CapeDefs.Def d) {
        return Capes.CLIENT.unlocked.contains(d.id());
    }

    private CapeDefs.Def wornDef() {
        LocalPlayer p = Minecraft.getInstance().player;
        return p == null ? null : CapeDefs.of(Capes.wornStack(p));
    }

    private boolean inBag(CapeDefs.Def d) {
        LocalPlayer p = Minecraft.getInstance().player;
        if (p == null) return false;
        var inv = p.getInventory();
        for (int i = 0; i < inv.getContainerSize(); i++) if (inv.getItem(i).is(d.item())) return true;
        return false;
    }

    /** How far along an unearned cape is, where the client can tell. */
    private String progress(CapeDefs.Def d) {
        LocalPlayer p = Minecraft.getInstance().player;
        JsonObject u = d.unlock();
        String type = u.has("type") ? u.get("type").getAsString() : "";
        try {
            return switch (type) {
                case "skill" -> "Your " + cap(u.get("skill").getAsString()) + ": " + Capes.skillLevel(p, u.get("skill").getAsString()) + " / " + u.get("level").getAsInt();
                case "all_skills" -> "Skills at " + u.get("level").getAsInt() + ": " + Capes.skillsAt(p, u.get("level").getAsInt()) + " / " + Capes.skillCount();
                case "flags_prefix" -> "So far: " + Capes.CLIENT.flagsStartingWith(u.get("prefix").getAsString()) + " / " + u.get("count").getAsInt();
                case "command" -> "Not something you can earn.";
                default -> "";
            };
        } catch (Exception e) {
            return "";
        }
    }

    private static String cap(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String kindTitle(String kind) {
        return switch (kind) {
            case "skill" -> "Skill capes";
            case "quest" -> "Quest capes";
            case "achievement" -> "Achievements";
            case "legendary" -> "Legendary";
            default -> "The owner's";
        };
    }

    private String lostText(CapeDefs.Def d) {
        CapeDefs.Reclaim r = d.reclaim();
        if (r == null || r.where().isEmpty()) return "Lost it? Ask the server owner.";
        String text = "Lost it? " + r.where() + (r.coins() > 0 ? " makes another for " + Coins.exact(r.coins()) + " coins." : ".");
        return r.note().isEmpty() ? text : text + " " + r.note();
    }

    // ---------------------------------------------------------------- drawing

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.renderBackground(g, mouseX, mouseY, partialTick);
        g.fill(left, top, left + W, top + H, PANEL);
        g.renderOutline(left, top, W, H, EDGE);
        g.fill(left + 1, top + 1, left + W - 1, top + 2, LINE);
        g.fill(left + DETAIL_X - 8, top + 24, left + DETAIL_X - 7, top + H - 8, 0x60FFFFFF);
        String heading = shop() ? npcName() + ": capes" : "Capes";
        g.drawString(font, heading, left + 10, top + 9, GOLD, false);
        long earned = CapeDefs.all().stream().filter(this::earned).count();
        String count = earned + " of " + CapeDefs.all().size() + " earned";
        g.drawString(font, count, left + W - 10 - font.width(count), top + 9, MUTED, false);
    }

    private String npcName() {
        var level = Minecraft.getInstance().level;
        var e = level == null ? null : level.getEntity(npc);
        return e == null ? "Capes" : e.getName().getString();
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.render(g, mouseX, mouseY, partialTick);
        for (Header h : headers) g.drawString(font, h.text(), left + h.x(), top + h.y(), MUTED, false);
        CapeDefs.Def worn = wornDef();
        Cell hovered = null;
        for (Cell c : cells) {
            int x = left + c.x(), y = top + c.y();
            boolean earned = earned(c.def());
            g.fill(x, y, x + 18, y + 18, earned ? 0x38FFFFFF : 0x50000000);
            ItemStack stack = c.def().stack();
            if (!stack.isEmpty()) g.renderItem(stack, x + 1, y + 1);
            if (!earned) {
                g.pose().pushPose();
                g.pose().translate(0, 0, 300);
                g.fill(x, y, x + 18, y + 18, 0xB4101418);
                g.pose().popPose();
            }
            if (c.def() == worn) {
                g.pose().pushPose();
                g.pose().translate(0, 0, 310);
                g.renderOutline(x, y, 18, 18, GOOD);
                g.pose().popPose();
            }
            if (c.def() == selected) {
                g.pose().pushPose();
                g.pose().translate(0, 0, 320);
                g.renderOutline(x - 1, y - 1, 20, 20, LINE);
                g.pose().popPose();
            }
            if (mouseX >= x && mouseX < x + 18 && mouseY >= y && mouseY < y + 18) hovered = c;
        }
        if (selected != null) renderDetail(g, selected, worn);
        if (hovered != null) {
            g.renderTooltip(font, List.of(Component.literal(hovered.def().name()).withColor(GOLD),
                    Component.literal(earned(hovered.def()) ? "Earned" : "Not earned yet").withColor(earned(hovered.def()) ? GOOD : MUTED)), java.util.Optional.empty(), mouseX, mouseY);
        }
    }

    private void renderDetail(GuiGraphics g, CapeDefs.Def d, CapeDefs.Def worn) {
        int px = left + DETAIL_X, py = top + 26, width = W - 10 - DETAIL_X;
        // The cape's design as people see it on your back: the 10x16 front of its texture, four times over.
        g.fill(px, py, px + 44, py + 68, 0xFF0C0E12);
        g.renderOutline(px, py, 44, 68, EDGE);
        var level = Minecraft.getInstance().level;
        g.blit(d.texture(level == null ? 0 : level.getGameTime()), px + 2, py + 2, 40, 64, 1, 1, 10, 16, 64, 32);

        int tx = px + 52, tw = width - 52, y = py;
        for (FormattedCharSequence line : font.split(Component.literal(d.name()), tw)) {
            g.drawString(font, line, tx, y, GOLD, false);
            y += 10;
        }
        g.drawString(font, CapesClient.kindName(d.kind()) + (d.animated() ? ", animated" : ""), tx, y, MUTED, false);
        y += 12;
        boolean earned = earned(d);
        String status;
        int colour;
        if (!earned) {
            status = "Not earned yet";
            colour = MUTED;
        } else if (d == worn) {
            status = "Earned: you're wearing it";
            colour = GOOD;
        } else if (inBag(d)) {
            status = "Earned: it's in your bag";
            colour = GOOD;
        } else {
            status = "Earned: not with you";
            colour = WARN;
        }
        for (FormattedCharSequence line : font.split(Component.literal(status), tw)) {
            g.drawString(font, line, tx, y, colour, false);
            y += 10;
        }
        if (!earned) {
            String progress = progress(d);
            if (!progress.isEmpty()) for (FormattedCharSequence line : font.split(Component.literal(progress), tw)) {
                g.drawString(font, line, tx, y, MUTED, false);
                y += 10;
            }
        }

        y = Math.max(y + 4, py + 74);
        int bottom = top + H - (shop() ? 56 : 32);
        y = paragraph(g, "How to earn it: " + d.description(), px, y, width, TEXT, bottom);
        if (d.perkText() != null) y = paragraph(g, "Perk: " + d.perkText() + ".", px, y, width, PERK, bottom);
        // Where to get another; at the NPC who makes it, the buy button says it already.
        boolean madeHere = shop() && d.reclaim() != null && d.reclaim().npc().equals(npcId);
        if (earned && !madeHere) paragraph(g, lostText(d), px, y, width, d != worn && !inBag(d) ? WARN : MUTED, bottom);
    }

    private int paragraph(GuiGraphics g, String text, int x, int y, int width, int colour, int bottom) {
        for (FormattedCharSequence line : font.split(Component.literal(text), width)) {
            if (y + 9 > bottom) return y;
            g.drawString(font, line, x, y, colour, false);
            y += 10;
        }
        return y + 4;
    }

    @Override
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        for (Cell c : cells) {
            int x = left + c.x(), y = top + c.y();
            if (mouseX >= x && mouseX < x + 18 && mouseY >= y && mouseY < y + 18) {
                selected = c.def();
                updateButtons();
                return true;
            }
        }
        return super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
