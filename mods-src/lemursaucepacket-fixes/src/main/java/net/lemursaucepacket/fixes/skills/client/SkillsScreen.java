package net.lemursaucepacket.fixes.skills.client;

import static net.lemursaucepacket.fixes.skills.client.SkillUi.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import net.lemursaucepacket.fixes.skills.Levels;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.util.FormattedCharSequence;

/**
 * The skills screen (ESC → Skills, or /skills): every skill as a tile in its group's column, like RuneScape's skills
 * tab, with its level and how far it is to the next, and the totals. Hover a skill for what trains it, what every level
 * gives and what it unlocks next; click it for its guide ({@link SkillGuideScreen}), what every level unlocks.
 *
 * <p>Public with a no-argument constructor so FancyMenu's {@code opengui} action can open it from the ESC menu (which it
 * then goes back to).
 */
public final class SkillsScreen extends Screen {
    private static final int TILE_W = 92, TILE_H = 26, GAP_X = 6, GAP_Y = 2, PAD = 10, TILES_TOP = 37;
    private static final ResourceLocation TOTAL_ICON = ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "textures/skills/total_level.png");
    private static final ResourceLocation XP_ICON = ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "textures/skills/experience.png");

    private final Screen parent;
    private final List<Tile> tiles = new ArrayList<>();
    private final Map<String, SkillGuideData.Standing> standings = new HashMap<>();
    private int left, top, w, h, rows;

    /** A skill's tile, or (skill null) one of the totals in a short column. */
    private record Tile(String skill, int total, int x, int y, int colour) {
    }

    public SkillsScreen() {
        this(Minecraft.getInstance().screen instanceof PauseScreen pause ? pause : null);
    }

    public SkillsScreen(Screen parent) {
        super(Component.literal("Skills"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        List<SkillGuideData.Group> groups = SkillGuideData.groups();
        int columns = Math.max(1, groups.size());
        rows = 1;
        for (SkillGuideData.Group g : groups) rows = Math.max(rows, g.skills().size());
        w = PAD * 2 + columns * TILE_W + (columns - 1) * GAP_X;
        h = TILES_TOP + rows * (TILE_H + GAP_Y) - GAP_Y + 34;
        left = (width - w) / 2;
        top = Math.max(2, (height - h) / 2);

        // Each group is a column; the shortest one also shows the totals under its skills.
        tiles.clear();
        int shortest = 0;
        for (int i = 0; i < groups.size(); i++) if (groups.get(i).skills().size() < groups.get(shortest).skills().size()) shortest = i;
        for (int c = 0; c < groups.size(); c++) {
            SkillGuideData.Group g = groups.get(c);
            int x = PAD + c * (TILE_W + GAP_X);
            for (int r = 0; r < g.skills().size(); r++) tiles.add(new Tile(g.skills().get(r), 0, x, TILES_TOP + r * (TILE_H + GAP_Y), g.color()));
            if (c == shortest) {
                int r = g.skills().size();
                for (int total = 1; total <= 3 && r < rows; total++, r++) tiles.add(new Tile(null, total, x, TILES_TOP + r * (TILE_H + GAP_Y) + 6, g.color()));
            }
        }
        addRenderableWidget(Button.builder(Component.literal("Close"), b -> onClose()).bounds(left + w - PAD - 70, top + h - 26, 70, 20).build());
        refresh();
    }

    @Override
    public void tick() {
        refresh();
    }

    private void refresh() {
        for (String skill : SkillGuideData.skills()) standings.put(skill, SkillGuideData.standing(skill));
    }

    private SkillGuideData.Standing standing(String skill) {
        return standings.computeIfAbsent(skill, SkillGuideData::standing);
    }

    // ---------------------------------------------------------------- drawing

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.renderBackground(g, mouseX, mouseY, partialTick);
        panel(g, left, top, w, h);
        g.drawString(font, "Skills", left + PAD, top + 9, GOLD, true);
        var player = Minecraft.getInstance().player;
        if (player != null) {
            String who = player.getGameProfile().getName();
            g.drawString(font, who, left + w - PAD - font.width(who), top + 9, MUTED, false);
        }
        List<SkillGuideData.Group> groups = SkillGuideData.groups();
        for (int c = 0; c < groups.size(); c++) {
            SkillGuideData.Group grp = groups.get(c);
            int x = left + PAD + c * (TILE_W + GAP_X);
            g.drawString(font, grp.name(), x, top + 24, grp.color(), false);
            g.fill(x, top + 34, x + TILE_W, top + 35, (grp.color() & 0x00FFFFFF) | 0x70000000);
        }
        g.drawString(font, "Click a skill to see what every level unlocks.", left + PAD, top + h - 20, HINT, false);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.render(g, mouseX, mouseY, partialTick);
        Tile hovered = null;
        for (Tile t : tiles) {
            int x = left + t.x(), y = top + t.y();
            boolean over = inside(mouseX, mouseY, x, y, TILE_W, TILE_H);
            if (over) hovered = t;
            if (t.skill() == null) drawTotal(g, t, x, y, over);
            else drawSkill(g, t, x, y, over);
        }
        if (hovered != null) g.renderTooltip(font, hovered.skill() == null ? totalTooltip(hovered.total()) : skillTooltip(hovered.skill()), mouseX, mouseY);
    }

    private void drawSkill(GuiGraphics g, Tile t, int x, int y, boolean over) {
        SkillGuideData.Standing s = standing(t.skill());
        g.fill(x, y, x + TILE_W, y + TILE_H, over ? SLOT_HOVER : SLOT);
        if (over) g.renderOutline(x, y, TILE_W, TILE_H, LINE);
        icon(g, t.skill(), x + 4, y + 5, 16);
        g.drawString(font, SkillGuideData.name(t.skill()), x + 24, y + 4, TEXT, false);
        String level = String.valueOf(s.level());
        g.drawString(font, level, x + 24, y + 15, s.max() ? GOOD : GOLD, false);
        int barX = x + 24 + font.width(level) + 4;
        bar(g, barX, y + 17, x + TILE_W - 5 - barX, 3, s.progress(), s.max() ? GOLD : t.colour());
    }

    private void drawTotal(GuiGraphics g, Tile t, int x, int y, boolean over) {
        g.fill(x, y, x + TILE_W, y + TILE_H, over ? SLOT_HOVER : 0x20FFFFFF);
        if (over) g.renderOutline(x, y, TILE_W, TILE_H, LINE);
        switch (t.total()) {
            case 1 -> g.blit(TOTAL_ICON, x + 4, y + 5, 16, 16, 0, 0, 64, 64, 64, 64);
            case 2 -> icon(g, "attack", x + 4, y + 5, 16);
            default -> g.blit(XP_ICON, x + 4, y + 5, 16, 16, 0, 0, 64, 64, 64, 64);
        }
        g.drawString(font, totalLabel(t.total()), x + 24, y + 4, MUTED, false);
        g.drawString(font, totalValue(t.total()), x + 24, y + 15, GOLD, false);
    }

    private static String totalLabel(int total) {
        return switch (total) {
            case 1 -> "Total level";
            case 2 -> "Combat level";
            default -> "Total XP";
        };
    }

    private String totalValue(int total) {
        return switch (total) {
            case 1 -> number(totalLevel());
            case 2 -> {
                var player = Minecraft.getInstance().player;
                yield player == null ? "-" : String.valueOf(Levels.combat(player));
            }
            default -> {
                long xp = 0;
                for (String skill : SkillGuideData.skills()) xp += standing(skill).total();
                yield number(xp);
            }
        };
    }

    private long totalLevel() {
        long sum = 0;
        for (String skill : SkillGuideData.skills()) sum += standing(skill).level();
        return sum;
    }

    // ---------------------------------------------------------------- tooltips

    private List<FormattedCharSequence> skillTooltip(String skill) {
        SkillGuideData.Standing s = standing(skill);
        SkillGuideData.Info info = SkillGuideData.of(skill);
        List<Component> lines = new ArrayList<>();
        lines.add(SkillGuideData.name(skill).copy().withColor(GOLD));
        lines.add(Component.literal("Level " + s.level() + "  ·  " + number(s.total()) + " XP").withColor(TEXT));
        lines.add(s.max() ? Component.literal("The highest level there is").withColor(GOOD)
                : Component.literal(number(s.toNext()) + " XP to level " + (s.level() + 1)).withColor(MUTED));
        if (!info.trainedBy().isEmpty()) lines.add(label("Trained by: ", info.trainedBy(), TEXT));
        if (!info.perLevel().isEmpty()) lines.add(label("Every level: ", info.perLevel(), PERK));
        SkillGuideData.Unlock next = SkillGuideData.next(skill, s.level());
        if (next != null) {
            long xp = SkillGuideData.xpTo(s, next.level());
            String in = xp == Long.MAX_VALUE ? "" : " (" + number(xp) + " XP away)";
            lines.add(label("Next, at " + next.level() + ": ", next.title() + in, GOLD));
        }
        lines.add(Component.literal("Click to see what every level unlocks").withColor(HINT));
        return wrap(lines);
    }

    private List<FormattedCharSequence> totalTooltip(int total) {
        List<Component> lines = new ArrayList<>();
        lines.add(Component.literal(totalLabel(total)).withColor(GOLD));
        int skills = SkillGuideData.skills().size();
        long most = 0;
        for (String skill : SkillGuideData.skills()) most += SkillGuideData.maxLevel(skill);
        lines.add(Component.literal(switch (total) {
            case 1 -> "Every skill's level added up: " + number(totalLevel()) + " of " + number(most) + ", over " + skills + " skills.";
            case 2 -> "Worked out as RuneScape does: a quarter of Defence plus Hitpoints, plus 0.325 times the better of Attack plus Strength or one and a half times Ranged. Some quests and places ask for it.";
            default -> "All the XP you've earned, in every skill.";
        }).withColor(TEXT));
        return wrap(lines);
    }

    private static MutableComponent label(String label, String text, int colour) {
        return Component.literal(label).withColor(MUTED).append(Component.literal(text).withColor(colour));
    }

    private List<FormattedCharSequence> wrap(List<Component> lines) {
        List<FormattedCharSequence> out = new ArrayList<>();
        for (Component line : lines) out.addAll(font.split(line, 230));
        return out;
    }

    // ---------------------------------------------------------------- input

    @Override
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        if (button == 0) for (Tile t : tiles) {
            if (t.skill() != null && inside(mouseX, mouseY, left + t.x(), top + t.y(), TILE_W, TILE_H)) {
                SkillGuideScreen.click();
                minecraft.setScreen(new SkillGuideScreen(t.skill(), this));
                return true;
            }
        }
        return super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public void onClose() {
        minecraft.setScreen(parent);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
