package net.lemursaucepacket.fixes.pmmo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.mojang.blaze3d.systems.RenderSystem;

import harmonised.pmmo.client.events.ClientTickHandler;
import harmonised.pmmo.config.codecs.SkillData;
import harmonised.pmmo.core.Core;
import harmonised.pmmo.storage.Experience;
import net.lemursaucepacket.fixes.hud.HudElement.Box;
import net.lemursaucepacket.fixes.mixin.pmmo.GainEntryAccessor;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.ItemStack;
import net.neoforged.fml.LogicalSide;

/**
 * Project MMO's XP gains as a small tracker, in place of its lines of plain text. Each skill that just gained XP gets a
 * card: its icon and name, the XP so far (counting up as more comes in), its level and a bar towards the next one, or
 * a gold "Level N!" once a gain takes it up a level. Cards fade and slide in, close up as older ones go, and fade out
 * at the end of Project MMO's own timer. Project MMO still decides what shows and for how long
 * ({@code ClientTickHandler.xpGains}: one entry per skill, summed and timed again on every gain); only the drawing is
 * ours.
 *
 * <p>The position is Project MMO's gain-list offset, read as the top centre of the stack, so 0.5 is centred on any
 * screen. The pack puts it at the top centre just below Jade's panel and the boss bar (0.5, 0.14), where four cards
 * still end above the crosshair on the smallest GUI.
 */
public final class GainHud {
    public static final int WIDTH = 136, ROW = 20, GAP = 2;
    private static final int MAX_ROWS = 4, PREVIEW_ROWS = 3, FADE_OUT_TICKS = 15;
    private static final long FADE_IN = 150_000_000L, PULSE = 300_000_000L, FLASH = 700_000_000L;
    /** How long "Level N!" stays before the bar comes back (the card may live on while the XP keeps coming). */
    private static final long LEVEL_SHOWN = 4_000_000_000L;
    private static final int PANEL = 0x15191E, TEXT = 0xEDE8DC, GOLD = 0xFFD45C, MUTED = 0xA9A397, TRACK = 0x2C3238;
    private static final ResourceLocation LEVEL_UP = ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "textures/skills/level_up.png");

    /** One card as drawn: worked out each frame, or made up for the HUD editor's preview. */
    private record Card(String skill, String name, int color, long amount, long level, float bar, boolean levelled,
                        float alpha, float y, float pulse, float flash) {}

    /** Per skill, what the animations carry from frame to frame. */
    private static final class Motion {
        final String skill;
        long value = -1, level = -1;
        /** The GUI tick its entry runs out at (Project MMO's countdown), to tell a new run of gains from this one. */
        long expires;
        double shown;
        float y = Float.NaN, bar = -1;
        long born, bumped, levelled;
        // This frame's.
        float alpha;
        boolean levelShown;

        Motion(String skill, long born) {
            this.skill = skill;
            this.born = born;
        }
    }

    private static final Map<String, Motion> MOTION = new HashMap<>();
    private static final Map<ResourceLocation, Boolean> TEXTURES = new HashMap<>();
    private static long lastFrame;

    public static void render(GuiGraphics g, double x, double y) {
        long now = System.nanoTime();
        float dt = lastFrame == 0 ? 0 : Math.min(0.1F, (now - lastFrame) / 1e9F);
        lastFrame = now;
        float ease = 1 - (float) Math.exp(-dt * 14);
        float partial = Minecraft.getInstance().getTimer().getGameTimeDeltaPartialTick(false);
        int tick = Minecraft.getInstance().gui.getGuiTicks();
        Map<String, Experience> xp = Core.get(LogicalSide.CLIENT).getData().getXpMap(null);
        List<ClientTickHandler.GainEntry> gains = ClientTickHandler.xpGains;
        List<Motion> rows = new ArrayList<>();
        Set<String> live = new HashSet<>();
        for (int i = Math.max(0, gains.size() - MAX_ROWS); i < gains.size(); i++) {
            ClientTickHandler.GainEntry entry = gains.get(i);
            GainEntryAccessor gain = (GainEntryAccessor) (Object) entry;
            String skill = gain.lsp$skill();
            if (!live.add(skill)) continue;
            long value = gain.lsp$value();
            Motion m = MOTION.get(skill);
            // A new card, or a new run of gains after this skill's last card ran out (counted in ticks, not frames,
            // so a slow frame never restarts a card).
            if (m == null || value < m.value || tick > m.expires) {
                m = new Motion(skill, now);
                MOTION.put(skill, m);
            }
            m.expires = tick + entry.duration;
            if (value > m.value) {
                if (m.value >= 0) m.bumped = now;
                m.value = value;
            }
            m.shown = value - m.shown < 1 ? value : m.shown + (value - m.shown) * Math.max(ease, 0.05F);

            Experience exp = xp.get(skill);
            long level = exp == null ? 0 : exp.getLevel().getLevel();
            long next = exp == null ? 0 : exp.getLevel().getXpToNext();
            long into = exp == null ? 0 : exp.getXp();
            boolean max = level >= SkillHud.definition(skill).getMaxLevel();
            float progress = max ? 1 : next <= 0 ? 0 : (float) Math.clamp((double) into / next, 0, 1);
            if (m.level >= 0 && level > m.level) {
                m.levelled = now;
                m.bar = 0;
            } else if (m.level < 0 && !max && exp != null && value > into) {
                m.levelled = now; // its first gain already went past a level
            }
            m.level = level;
            m.bar = m.bar < 0 ? progress : m.bar + (progress - m.bar) * ease;
            float in = Math.min(1, (now - m.born) / (float) FADE_IN);
            float out = Math.clamp((entry.duration - partial) / FADE_OUT_TICKS, 0, 1);
            m.alpha = Math.min(in, out);
            m.levelShown = m.levelled != 0 && now - m.levelled < LEVEL_SHOWN;
            rows.add(m);
        }
        MOTION.keySet().retainAll(live);
        // Cards keep the order they came in: Project MMO moves a skill to the end of its list on every gain, and a card
        // sliding down past the others each time it grows would be hard to follow.
        rows.sort(Comparator.comparingLong(r -> r.born));
        List<Card> cards = new ArrayList<>();
        for (Motion m : rows) {
            float slot = cards.size() * (ROW + GAP);
            m.y = Float.isNaN(m.y) ? slot - 6 : m.y + (slot - m.y) * ease;
            cards.add(new Card(m.skill, name(m.skill), color(m.skill), Math.round(m.shown), m.level, m.bar, m.levelShown,
                    m.alpha, m.y, fade(now, m.bumped, PULSE), fade(now, m.levelled, FLASH)));
        }
        Box at = box(x, y, g.guiWidth(), g.guiHeight(), Math.max(1, cards.size()));
        draw(g, at.x(), at.y(), cards);
    }

    /** The stack's place: Project MMO's offset is its top centre. */
    public static Box box(double x, double y, int sw, int sh, int rows) {
        int h = rows * ROW + (rows - 1) * GAP;
        return new Box(Math.clamp((int) (sw * x) - WIDTH / 2, 0, Math.max(0, sw - WIDTH)),
                Math.clamp((int) (sh * y), 0, Math.max(0, sh - h)), WIDTH, h);
    }

    /** The HUD editor's box: room for three cards. */
    public static Box editorBox(double x, double y, int sw, int sh) {
        return box(x, y, sw, sh, PREVIEW_ROWS);
    }

    public static void renderPreview(GuiGraphics g, Box box) {
        draw(g, box.x(), box.y(), List.of(
                new Card("mining", name("mining"), color("mining"), 24, 12, 0.45F, false, 1, 0, 0, 0),
                new Card("woodcutting", name("woodcutting"), color("woodcutting"), 12, 8, 0.7F, false, 1, ROW + GAP, 0, 0),
                new Card("crafting", name("crafting"), color("crafting"), 8, 6, 0.05F, true, 1, 2 * (ROW + GAP), 0, 0)));
    }

    private static void draw(GuiGraphics g, int left, int top, List<Card> cards) {
        Font font = Minecraft.getInstance().font;
        RenderSystem.enableBlend();
        for (Card c : cards) {
            int a = Math.round(c.alpha() * 255);
            if (a < 8) continue;
            g.pose().pushPose();
            g.pose().translate(left, top + c.y(), 0);
            // The panel, with its corners cut for a rounder look, and the skill's colour down its left edge.
            int panel = argb(mix(PANEL, 0x5A4514, c.flash()), Math.round(0xE0 * c.alpha()));
            g.fill(1, 0, WIDTH - 1, ROW, panel);
            g.fill(0, 1, 1, ROW - 1, panel);
            g.fill(WIDTH - 1, 1, WIDTH, ROW - 1, panel);
            g.fill(1, 1, 3, ROW - 1, argb(c.color(), a));
            icon(g, c.skill(), 6, 2, 16, c.alpha());

            String amount = "+" + String.format(Locale.US, "%,d", c.amount());
            int amountWidth = font.width(amount);
            g.drawString(font, font.plainSubstrByWidth(c.name(), WIDTH - 37 - amountWidth), 26, 2, argb(TEXT, a), true);
            // The amount pops a little each time it goes up.
            float pop = 1 + 0.2F * c.pulse();
            g.pose().pushPose();
            g.pose().translate(WIDTH - 5, 6, 0);
            g.pose().scale(pop, pop, 1);
            g.drawString(font, amount, -amountWidth, -4, argb(mix(GOLD, 0xFFFFFF, 0.6F * c.pulse()), a), true);
            g.pose().popPose();

            if (c.levelled()) {
                int textX = 26;
                if (texture(LEVEL_UP)) {
                    blit(g, LEVEL_UP, 26, 10, 9, 64, c.alpha());
                    textX = 38;
                }
                g.drawString(font, "Level " + c.level() + "!", textX, 11, argb(GOLD, a), true);
            } else {
                String level = "Lv " + c.level();
                int levelWidth = font.width(level);
                int barEnd = WIDTH - 9 - levelWidth;
                g.fill(26, 13, barEnd, 16, argb(TRACK, a));
                int fill = 26 + Math.round((barEnd - 26) * Math.clamp(c.bar(), 0, 1));
                if (fill > 26) g.fill(26, 13, fill, 16, argb(c.color(), a));
                g.drawString(font, level, WIDTH - 5 - levelWidth, 11, argb(MUTED, a), true);
            }
            g.pose().popPose();
        }
    }

    /** The skill's own icon from Project MMO's skill config, or an item when the pack has none for it. */
    private static void icon(GuiGraphics g, String skill, int x, int y, int size, float alpha) {
        SkillData data = SkillHud.definition(skill);
        ResourceLocation icon = data.getIcon();
        if (icon != null && texture(icon)) {
            blit(g, icon, x, y, size, Math.max(1, data.getIconSize()), alpha);
            return;
        }
        g.pose().pushPose();
        g.pose().translate(x, y, 0);
        g.pose().scale(size / 16F, size / 16F, 1);
        g.renderItem(new ItemStack(SkillHud.icon(skill)), 0, 0);
        g.pose().popPose();
    }

    private static void blit(GuiGraphics g, ResourceLocation texture, int x, int y, int size, int textureSize, float alpha) {
        g.setColor(1, 1, 1, alpha);
        g.blit(texture, x, y, size, size, 0, 0, textureSize, textureSize, textureSize, textureSize);
        g.setColor(1, 1, 1, 1);
    }

    private static boolean texture(ResourceLocation id) {
        return TEXTURES.computeIfAbsent(id, t -> Minecraft.getInstance().getResourceManager().getResource(t).isPresent());
    }

    private static String name(String skill) {
        return Component.translatable("pmmo." + skill).getString();
    }

    private static int color(String skill) {
        return SkillHud.definition(skill).getColor() & 0xFFFFFF;
    }

    /** 1 just after {@code since}, down to 0 over {@code length}; 0 if it never happened. */
    private static float fade(long now, long since, long length) {
        return since == 0 ? 0 : Math.max(0, 1 - (now - since) / (float) length);
    }

    private static int argb(int rgb, int alpha) {
        return Math.clamp(alpha, 0, 255) << 24 | rgb & 0xFFFFFF;
    }

    private static int mix(int from, int to, float t) {
        if (t <= 0) return from;
        int r = Math.round(((from >> 16) & 0xFF) + (((to >> 16) & 0xFF) - ((from >> 16) & 0xFF)) * t);
        int gr = Math.round(((from >> 8) & 0xFF) + (((to >> 8) & 0xFF) - ((from >> 8) & 0xFF)) * t);
        int b = Math.round((from & 0xFF) + ((to & 0xFF) - (from & 0xFF)) * t);
        return r << 16 | gr << 8 | b;
    }

    private GainHud() {}
}
