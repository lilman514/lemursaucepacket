package net.lemursaucepacket.fixes.skills.client;

import static net.lemursaucepacket.fixes.skills.client.SkillUi.*;

import java.util.ArrayList;
import java.util.List;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.util.FormattedCharSequence;
import org.lwjgl.glfw.GLFW;

/**
 * A skill's guide, like RuneScape's skill guides: every level that unlocks something, down a track, each unlock with
 * its item, what it is and what sort (wield, make, machine, perk...), lit once you have the level, with a marker where
 * you are and how far it is to the next. Opened from the skills screen, from a skill in the inventory's skills panel, or
 * with /skills &lt;skill&gt;; the strip along the bottom switches skill.
 */
public final class SkillGuideScreen extends Screen {
    private static final int PAD = 8, HEADER = 72, FOOTER = 28, ROW = 18, LEVEL_GAP = 5, MARKER = 16, SCROLLBAR = 4;
    /** Inside the list: the track's middle, the unlock's icon and its text. */
    private static final int TRACK = 15, ICON_X = 32, TEXT_X = 54, CHIP_AREA = 54;
    private static final int LOCKED = 0xFF4A4F57, TRACK_OFF = 0xFF2C3037;

    private final Screen parent;
    private String skill;
    private SkillGuideData.Standing standing;
    private final List<Level> levels = new ArrayList<>();
    private int left, top, w, h, listX, listY, listW, listH, content, markerY, tabCell;
    private double scroll;
    private boolean dragging;
    private double dragFrom, dragScroll;

    private record Row(SkillGuideData.Unlock unlock, List<FormattedCharSequence> lines, int y, int h) {
    }

    /** Everything one level unlocks, at its place down the track. */
    private record Level(int level, int y, int h, List<Row> rows) {
    }

    public SkillGuideScreen(String skill, Screen parent) {
        super(SkillGuideData.name(skill));
        this.skill = skill;
        this.parent = parent;
    }

    /** From a skill in Project MMO's inventory panel: its guide, going back to the inventory. */
    public static void openFromPanel(String skill) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || !mc.player.containerMenu.getCarried().isEmpty()) return;
        if (!SkillGuideData.skills().contains(skill)) return;
        mc.setScreen(new SkillGuideScreen(skill, mc.screen));
    }

    private static String hoverSkill;
    private static long hoverSince;

    /** Each frame for each skill row in that panel: after a moment over one, a tooltip says a click opens its guide. */
    public static void panelHover(String skill, boolean hovered) {
        if (!hovered) {
            if (skill.equals(hoverSkill)) hoverSkill = null;
            return;
        }
        long now = net.minecraft.Util.getMillis();
        if (!skill.equals(hoverSkill)) {
            hoverSkill = skill;
            hoverSince = now;
            return;
        }
        Screen screen = Minecraft.getInstance().screen;
        if (now - hoverSince < 400 || screen == null || !SkillGuideData.skills().contains(skill)) return;
        screen.setTooltipForNextRenderPass(List.of(Component.literal("Click: what every level unlocks").withColor(GOLD).getVisualOrderText()));
    }

    static void click() {
        Minecraft.getInstance().getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, 1));
    }

    @Override
    protected void init() {
        w = Math.min(width - 12, 430);
        h = Math.min(height - 8, 320);
        left = (width - w) / 2;
        top = (height - h) / 2;
        listX = left + PAD;
        listY = top + HEADER;
        listW = w - PAD * 2 - SCROLLBAR - 3;
        listH = h - HEADER - FOOTER;
        int bw = 50;
        addRenderableWidget(Button.builder(Component.literal("Back"), b -> onClose()).bounds(left + w - PAD - bw * 2 - 4, top + h - 24, bw, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Close"), b -> closeAll()).bounds(left + w - PAD - bw, top + h - 24, bw, 20).build());
        int room = w - PAD * 2 - bw * 2 - 12;
        tabCell = Math.max(10, Math.min(18, room / Math.max(1, SkillGuideData.skills().size())));
        show(skill, true);
    }

    private void show(String next, boolean keepScroll) {
        boolean same = next.equals(skill) && keepScroll && !levels.isEmpty();
        skill = next;
        standing = SkillGuideData.standing(skill);
        layout();
        if (!same) scroll = markerY - listH / 3.0;
        scroll = clampScroll(scroll);
    }

    /** Lays the unlocks out down the track, a level at a time, with the marker before the first level you haven't reached. */
    private void layout() {
        levels.clear();
        int textW = listW - TEXT_X - CHIP_AREA - 4;
        List<SkillGuideData.Unlock> all = SkillGuideData.of(skill).unlocks();
        int y = 4;
        markerY = -1;
        for (int i = 0; i < all.size(); ) {
            int level = all.get(i).level();
            if (markerY < 0 && level > standing.level()) {
                markerY = y;
                y += MARKER + LEVEL_GAP;
            }
            List<Row> rows = new ArrayList<>();
            int from = y;
            for (; i < all.size() && all.get(i).level() == level; i++) {
                SkillGuideData.Unlock u = all.get(i);
                List<FormattedCharSequence> lines = font.split(Component.literal(u.title()), textW);
                int rh = Math.max(ROW, lines.size() * 10 + 8);
                rows.add(new Row(u, lines, y, rh));
                y += rh;
            }
            levels.add(new Level(level, from, y - from, List.copyOf(rows)));
            y += LEVEL_GAP;
        }
        if (markerY < 0) {
            markerY = y;
            y += MARKER + LEVEL_GAP;
        }
        content = y;
    }

    private double maxScroll() {
        return Math.max(0, content - listH);
    }

    private double clampScroll(double s) {
        return Math.max(0, Math.min(maxScroll(), s));
    }

    @Override
    public void tick() {
        SkillGuideData.Standing now = SkillGuideData.standing(skill);
        if (now.level() != standing.level()) {
            // Levelled up with the guide open: lay it out again, the marker one step on.
            standing = now;
            layout();
            scroll = clampScroll(scroll);
        } else {
            standing = now;
        }
    }

    // ---------------------------------------------------------------- drawing

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.renderBackground(g, mouseX, mouseY, partialTick);
        panel(g, left, top, w, h);
        renderHeader(g);
    }

    private void renderHeader(GuiGraphics g) {
        SkillGuideData.Group group = SkillGuideData.group(skill);
        SkillGuideData.Info info = SkillGuideData.of(skill);
        int x = left + PAD, y = top + 8;
        g.fill(x, y, x + 36, y + 36, DARK);
        g.renderOutline(x, y, 36, 36, EDGE);
        icon(g, skill, x + 2, y + 2, 32);

        int tx = x + 44;
        g.pose().pushPose();
        g.pose().translate(tx, y + 1, 0);
        g.pose().scale(2, 2, 1);
        g.drawString(font, SkillGuideData.name(skill), 0, 0, GOLD, true);
        g.pose().popPose();
        if (!group.name().isEmpty()) {
            int cw = font.width(group.name()) + 6;
            chip(g, font, group.name(), left + w - PAD - cw, y + 2, group.color(), false);
        }

        int max = SkillGuideData.maxLevel(skill);
        g.drawString(font, "Level " + standing.level() + " of " + max + "  ·  " + number(standing.total()) + " XP", tx, y + 20, TEXT, false);
        String toNext = standing.max() ? "The highest level there is" : number(standing.toNext()) + " XP to level " + (standing.level() + 1);
        g.drawString(font, toNext, left + w - PAD - font.width(toNext), y + 20, standing.max() ? GOOD : MUTED, false);
        bar(g, tx, y + 31, left + w - PAD - tx, 4, standing.progress(), standing.max() ? GOLD : group.color());

        int iy = top + 49;
        if (!info.trainedBy().isEmpty()) firstLine(g, Component.literal("Trained by: ").withColor(MUTED).append(Component.literal(info.trainedBy()).withColor(TEXT)), x, iy);
        if (!info.perLevel().isEmpty()) firstLine(g, Component.literal("Every level: ").withColor(MUTED).append(Component.literal(info.perLevel()).withColor(PERK)), x, iy + 10);
        g.fill(left + PAD, top + HEADER - 3, left + w - PAD, top + HEADER - 2, 0x50FFFFFF);
    }

    private void firstLine(GuiGraphics g, Component text, int x, int y) {
        List<FormattedCharSequence> lines = font.split(text, w - PAD * 2);
        if (!lines.isEmpty()) g.drawString(font, lines.get(0), x, y, TEXT, false);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.render(g, mouseX, mouseY, partialTick);
        Row hovered = renderList(g, mouseX, mouseY);
        String tab = renderTabs(g, mouseX, mouseY);
        if (hovered != null) g.renderTooltip(font, rowTooltip(hovered), mouseX, mouseY);
        else if (tab != null) {
            SkillGuideData.Standing s = SkillGuideData.standing(tab);
            g.renderTooltip(font, List.of(SkillGuideData.name(tab).copy().withColor(GOLD).getVisualOrderText(),
                    Component.literal("Level " + s.level()).withColor(TEXT).getVisualOrderText()), mouseX, mouseY);
        }
    }

    /** The track, the levels and their unlocks, and the marker; returns the unlock under the mouse. */
    private Row renderList(GuiGraphics g, int mouseX, int mouseY) {
        SkillGuideData.Group group = SkillGuideData.group(skill);
        int base = listY - (int) Math.round(scroll);
        int trackX = listX + TRACK;
        boolean overList = inside(mouseX, mouseY, listX, listY, listW, listH);
        Row hovered = null;
        Level next = null;
        for (Level lv : levels) if (lv.level() > standing.level()) {
            next = lv;
            break;
        }

        g.enableScissor(listX, listY, listX + listW, listY + listH);
        if (!levels.isEmpty()) {
            // The track: lit in the group's colour as far as you've got.
            int first = base + nodeMiddle(levels.get(0)), last = base + nodeMiddle(levels.get(levels.size() - 1));
            int you = Math.max(first, Math.min(last, base + markerY + MARKER / 2));
            if (you > first) g.fill(trackX - 1, first, trackX + 1, you, group.color());
            if (last > you) g.fill(trackX - 1, you, trackX + 1, last, TRACK_OFF);
        }
        for (Level lv : levels) {
            int ly = base + lv.y();
            if (ly > listY + listH || ly + lv.h() < listY) continue;
            boolean reached = lv.level() <= standing.level();
            for (Row r : lv.rows()) {
                int ry = base + r.y();
                if (ry > listY + listH || ry + r.h() < listY) continue;
                boolean over = overList && inside(mouseX, mouseY, listX + ICON_X - 4, ry, listW - ICON_X + 4, r.h());
                if (over) {
                    hovered = r;
                    g.fill(listX + ICON_X - 4, ry, listX + listW, ry + r.h(), 0x1CFFFFFF);
                }
                renderRow(g, r, ry, reached);
            }
            // The level's badge on the track, by its first unlock.
            int ny = ly + nodeMiddle(lv) - lv.y() - 6;
            int border = reached ? GOOD : lv == next ? GOLD : LOCKED;
            int fill = reached ? 0xFF1C2A1C : lv == next ? 0xFF2D2615 : 0xFF181B20;
            g.fill(trackX - 12, ny, trackX + 12, ny + 12, fill);
            g.renderOutline(trackX - 12, ny, 24, 12, border);
            String n = String.valueOf(lv.level());
            g.drawString(font, n, trackX - font.width(n) / 2, ny + 2, reached ? GOOD : lv == next ? GOLD : MUTED, false);
        }
        renderMarker(g, base + markerY, trackX, next);

        // Fades where the list runs on past its edges.
        if (scroll > 0) g.fillGradient(listX, listY, listX + listW, listY + 8, 0xE0141820, 0x00141820);
        if (scroll < maxScroll()) g.fillGradient(listX, listY + listH - 8, listX + listW, listY + listH, 0x00141820, 0xE0141820);
        g.disableScissor();

        if (maxScroll() > 0) {
            int sx = listX + listW + 3;
            g.fill(sx, listY, sx + SCROLLBAR, listY + listH, 0x50000000);
            int thumb = Math.max(14, (int) ((long) listH * listH / Math.max(1, content)));
            int ty = listY + (int) Math.round((listH - thumb) * scroll / maxScroll());
            boolean overBar = inside(mouseX, mouseY, sx - 2, listY, SCROLLBAR + 4, listH);
            g.fill(sx, ty, sx + SCROLLBAR, ty + thumb, dragging || overBar ? LINE : EDGE);
        }
        return hovered;
    }

    private int nodeMiddle(Level lv) {
        return lv.y() + (lv.rows().isEmpty() ? ROW : lv.rows().get(0).h()) / 2;
    }

    private void renderRow(GuiGraphics g, Row r, int ry, boolean reached) {
        int ix = listX + ICON_X, iy = ry + (r.h() - 16) / 2;
        SkillGuideData.Unlock u = r.unlock();
        g.fill(ix - 1, iy - 1, ix + 17, iy + 17, reached ? 0x30FFFFFF : 0x40000000);
        if (!u.icon().isEmpty()) g.renderItem(u.icon(), ix, iy);
        else icon(g, skill, ix, iy, 16);
        if (!reached) {
            g.pose().pushPose();
            g.pose().translate(0, 0, 300);
            g.fill(ix - 1, iy - 1, ix + 17, iy + 17, 0x9A101418);
            g.pose().popPose();
        }
        int ty = ry + (r.h() - r.lines().size() * 10) / 2 + 1;
        for (FormattedCharSequence line : r.lines()) {
            g.drawString(font, line, listX + TEXT_X, ty, reached ? TEXT : MUTED, false);
            ty += 10;
        }
        String kind = kindName(u.kind());
        int cw = font.width(kind) + 6;
        chip(g, font, kind, listX + listW - 4 - cw, ry + (r.h() - 11) / 2, kindColour(u.kind()), !reached);
    }

    /** Where you are: a line across the track, your level, and how far it is to the next unlock. */
    private void renderMarker(GuiGraphics g, int my, int trackX, Level next) {
        if (my > listY + listH || my + MARKER < listY) return;
        int mid = my + MARKER / 2;
        g.fill(listX + 2, mid, listX + listW - 2, mid + 1, 0x908FD18B);
        String you = standing.max() ? "Level " + standing.level() + ": done!" : "You: level " + standing.level();
        int lw = font.width(you) + 8;
        int lx = Math.max(listX + 2, trackX - 12);
        g.fill(lx, my + 2, lx + lw, my + 14, 0xFF16261A);
        g.renderOutline(lx, my + 2, lw, 12, GOOD);
        g.drawString(font, you, lx + 4, my + 4, GOOD, false);
        if (next != null) {
            long xp = SkillGuideData.xpTo(standing, next.level());
            String text = "Next unlock at " + next.level() + (xp == Long.MAX_VALUE ? "" : ": " + number(xp) + " XP to go");
            int tx = lx + lw + 6, tw = font.width(text) + 6;
            g.fill(tx - 3, my + 2, tx + tw - 3, my + 14, 0xFF141820);
            g.drawString(font, text, tx, my + 4, GOLD, false);
        }
    }

    /** The skills along the bottom, the one shown picked out; returns the one under the mouse. */
    private String renderTabs(GuiGraphics g, int mouseX, int mouseY) {
        List<String> skills = SkillGuideData.skills();
        int y = top + h - 23, size = tabCell - 2;
        String hovered = null;
        for (int i = 0; i < skills.size(); i++) {
            String s = skills.get(i);
            int x = left + PAD + i * tabCell;
            boolean over = inside(mouseX, mouseY, x, y, tabCell, size + 2);
            if (over) hovered = s;
            g.fill(x, y, x + size + 2, y + size + 2, s.equals(skill) ? SLOT_HOVER : over ? 0x48FFFFFF : SLOT);
            icon(g, s, x + 1, y + 1, size);
            if (s.equals(skill)) g.renderOutline(x - 1, y - 1, size + 4, size + 4, LINE);
        }
        return hovered;
    }

    private List<FormattedCharSequence> rowTooltip(Row r) {
        SkillGuideData.Unlock u = r.unlock();
        List<Component> lines = new ArrayList<>();
        lines.add(Component.literal(u.title()).withColor(GOLD));
        if (!u.icon().isEmpty() && !u.kind().equals("quest") && !u.kind().equals("perk")) lines.add(u.icon().getHoverName().copy().withColor(MUTED));
        boolean reached = u.level() <= standing.level();
        if (reached) lines.add(Component.literal("Unlocked: " + SkillGuideData.name(skill).getString() + " " + u.level()).withColor(GOOD));
        else {
            long xp = SkillGuideData.xpTo(standing, u.level());
            MutableComponent need = Component.literal("Needs " + SkillGuideData.name(skill).getString() + " " + u.level()).withColor(0xFFE8B45C);
            if (xp != Long.MAX_VALUE) need.append(Component.literal(": " + number(xp) + " XP to go").withColor(MUTED));
            lines.add(need);
        }
        String about = kindAbout(u.kind());
        if (!about.isEmpty()) lines.add(Component.literal(about).withColor(HINT));
        List<FormattedCharSequence> out = new ArrayList<>();
        for (Component line : lines) out.addAll(font.split(line, 230));
        return out;
    }

    private static String kindName(String kind) {
        return switch (kind) {
            case "wield" -> "Wield";
            case "wear" -> "Wear";
            case "use" -> "Use";
            case "make" -> "Make";
            case "machine" -> "Machine";
            case "plant" -> "Plant";
            case "chop" -> "Chop";
            case "brew" -> "Brew";
            case "catch" -> "Catch";
            case "perk" -> "Perk";
            case "quest" -> "Quest";
            case "cape" -> "Cape";
            default -> kind.isEmpty() ? "" : Character.toUpperCase(kind.charAt(0)) + kind.substring(1);
        };
    }

    private static int kindColour(String kind) {
        return switch (kind) {
            case "wield", "wear", "use", "place" -> 0xFF9DBEE0;
            case "make" -> 0xFFE0AC46;
            case "machine" -> 0xFFD9925A;
            case "plant", "chop", "catch" -> 0xFF8FC44A;
            case "brew" -> 0xFFC29BE8;
            case "perk" -> PERK;
            case "quest" -> 0xFFE8B45C;
            case "cape" -> GOLD;
            default -> MUTED;
        };
    }

    private static String kindAbout(String kind) {
        return switch (kind) {
            case "wield" -> "A weapon you can fight with from this level; before it, it gives you Weakness.";
            case "wear" -> "Armour you can wear from this level; before it, it gives you Slowness.";
            case "use" -> "Gear you can use from this level.";
            case "make" -> "Something you can make from this level; before it, the result stays in the grid.";
            case "machine" -> "A Create machine you can make from this level. Anyone can use one someone else made.";
            case "plant" -> "A crop you can plant from this level.";
            case "chop" -> "Trees you can chop from this level.";
            case "brew" -> "A potion you can brew from this level.";
            case "catch" -> "What you can catch from this level.";
            case "perk" -> "What the skill's own bonus adds up to by this level.";
            case "quest" -> "A quest that asks for this level (it may want other skills too).";
            case "cape" -> "The skill's cape, for reaching the top.";
            default -> "";
        };
    }

    // ---------------------------------------------------------------- input

    @Override
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        if (button == 0) {
            List<String> skills = SkillGuideData.skills();
            int y = top + h - 23;
            for (int i = 0; i < skills.size(); i++) {
                if (inside(mouseX, mouseY, left + PAD + i * tabCell, y, tabCell, tabCell)) {
                    if (!skills.get(i).equals(skill)) {
                        click();
                        show(skills.get(i), false);
                    }
                    return true;
                }
            }
            if (maxScroll() > 0 && inside(mouseX, mouseY, listX + listW + 1, listY, SCROLLBAR + 4, listH)) {
                dragging = true;
                int thumb = Math.max(14, (int) ((long) listH * listH / Math.max(1, content)));
                int ty = listY + (int) Math.round((listH - thumb) * scroll / maxScroll());
                // Grabbing the thumb drags it from where it is; clicking the groove jumps it there.
                if (mouseY < ty || mouseY >= ty + thumb) scroll = clampScroll((mouseY - listY - thumb / 2.0) / (listH - thumb) * maxScroll());
                dragFrom = mouseY;
                dragScroll = scroll;
                return true;
            }
        }
        return super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public boolean mouseDragged(double mouseX, double mouseY, int button, double dragX, double dragY) {
        if (dragging) {
            int thumb = Math.max(14, (int) ((long) listH * listH / Math.max(1, content)));
            scroll = clampScroll(dragScroll + (mouseY - dragFrom) / Math.max(1, listH - thumb) * maxScroll());
            return true;
        }
        return super.mouseDragged(mouseX, mouseY, button, dragX, dragY);
    }

    @Override
    public boolean mouseReleased(double mouseX, double mouseY, int button) {
        dragging = false;
        return super.mouseReleased(mouseX, mouseY, button);
    }

    @Override
    public boolean mouseScrolled(double mouseX, double mouseY, double scrollX, double scrollY) {
        scroll = clampScroll(scroll - scrollY * 20);
        return true;
    }

    @Override
    public boolean keyPressed(int key, int scanCode, int modifiers) {
        switch (key) {
            case GLFW.GLFW_KEY_UP -> scroll = clampScroll(scroll - 20);
            case GLFW.GLFW_KEY_DOWN -> scroll = clampScroll(scroll + 20);
            case GLFW.GLFW_KEY_PAGE_UP -> scroll = clampScroll(scroll - (listH - 20));
            case GLFW.GLFW_KEY_PAGE_DOWN -> scroll = clampScroll(scroll + (listH - 20));
            case GLFW.GLFW_KEY_HOME -> scroll = 0;
            case GLFW.GLFW_KEY_END -> scroll = maxScroll();
            case GLFW.GLFW_KEY_LEFT, GLFW.GLFW_KEY_RIGHT -> {
                List<String> skills = SkillGuideData.skills();
                int i = skills.indexOf(skill);
                if (i < 0 || skills.isEmpty()) return true;
                show(skills.get(Math.floorMod(i + (key == GLFW.GLFW_KEY_LEFT ? -1 : 1), skills.size())), false);
            }
            default -> {
                return super.keyPressed(key, scanCode, modifiers);
            }
        }
        return true;
    }

    /** Back where it was opened from: the skills screen, the inventory, or (from a command) the skills screen. */
    @Override
    public void onClose() {
        minecraft.setScreen(parent != null ? parent : new SkillsScreen(null));
    }

    /** All the way out; from the inventory, closing it too. */
    private void closeAll() {
        if (parent instanceof AbstractContainerScreen<?> && minecraft.player != null) minecraft.player.closeContainer();
        else minecraft.setScreen(null);
    }

    /** The skill shown, which the strip along the bottom changes (for narration). */
    @Override
    public Component getTitle() {
        return SkillGuideData.name(skill);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
