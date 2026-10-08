package net.lemursaucepacket.fixes.skills.client;

import java.text.NumberFormat;
import java.util.Locale;

import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;

/** What the skill screens share: the pack's panel colours (as the cape collection's) and a few drawing helpers. */
final class SkillUi {
    static final int PANEL = 0xE8141820, EDGE = 0xFF6B5A3C, LINE = 0xFFE0AC46, GOLD = 0xFFF8D982, TEXT = 0xFFE5E2D9, MUTED = 0xFFA8A499;
    static final int GOOD = 0xFF8FD18B, PERK = 0xFF8ED6E0, HINT = 0xFF7D7367, SLOT = 0x38FFFFFF, SLOT_HOVER = 0x58FFFFFF, DARK = 0xFF0C0E12;

    /** The panel: dark glass, a brass edge and a bright line along its top. */
    static void panel(GuiGraphics g, int x, int y, int w, int h) {
        g.fill(x, y, x + w, y + h, PANEL);
        g.renderOutline(x, y, w, h, EDGE);
        g.fill(x + 1, y + 1, x + w - 1, y + 2, LINE);
    }

    /** A skill's icon (the pack's 64-pixel art), at any size. */
    static void icon(GuiGraphics g, String skill, int x, int y, int size) {
        int s = SkillGuideData.iconSize(skill);
        g.blit(SkillGuideData.icon(skill), x, y, size, size, 0, 0, s, s, s, s);
    }

    /** A progress bar: a dark groove, filled in the skill group's colour, with a lighter top edge. */
    static void bar(GuiGraphics g, int x, int y, int w, int h, float progress, int colour) {
        g.fill(x, y, x + w, y + h, 0xFF050608);
        int fill = Math.round(w * Math.max(0, Math.min(1, progress)));
        if (fill > 0) {
            g.fill(x, y, x + fill, y + h, colour);
            g.fill(x, y, x + fill, y + 1, lighter(colour));
        }
    }

    /** A small label in a box: a kind of unlock, a skill group. */
    static int chip(GuiGraphics g, Font font, String text, int x, int y, int colour, boolean dim) {
        int w = font.width(text) + 6;
        int c = dim ? mix(colour, 0xFF14181F, 0.55F) : colour;
        g.fill(x, y, x + w, y + 11, (c & 0x00FFFFFF) | 0x30000000);
        g.renderOutline(x, y, w, 11, c);
        g.drawString(font, text, x + 3, y + 2, c, false);
        return w;
    }

    static int lighter(int colour) {
        return mix(colour, 0xFFFFFFFF, 0.35F);
    }

    static int mix(int a, int b, float t) {
        int r = Math.round(((a >> 16) & 0xFF) * (1 - t) + ((b >> 16) & 0xFF) * t);
        int gr = Math.round(((a >> 8) & 0xFF) * (1 - t) + ((b >> 8) & 0xFF) * t);
        int bl = Math.round((a & 0xFF) * (1 - t) + (b & 0xFF) * t);
        return 0xFF000000 | r << 16 | gr << 8 | bl;
    }

    static String number(long n) {
        return NumberFormat.getIntegerInstance(Locale.US).format(n);
    }

    static boolean inside(double mx, double my, int x, int y, int w, int h) {
        return mx >= x && mx < x + w && my >= y && my < y + h;
    }

    private SkillUi() {
    }
}
