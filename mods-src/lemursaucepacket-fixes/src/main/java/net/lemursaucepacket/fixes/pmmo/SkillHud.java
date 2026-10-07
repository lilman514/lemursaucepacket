package net.lemursaucepacket.fixes.pmmo;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

import harmonised.pmmo.config.Config;
import harmonised.pmmo.config.codecs.SkillData;
import harmonised.pmmo.core.Core;
import harmonised.pmmo.storage.Experience;
import net.lemursaucepacket.fixes.hud.HudElement.Box;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.neoforged.fml.LogicalSide;

/** A compact, stable skill list. Only its rendering changes; PMMO still owns XP and visibility. */
public final class SkillHud {
    private static final int WIDTH = 148, HEADER = 21, ROW = 17, FOOTER = 5;
    private static final List<String> ORDER = List.of("attack", "strength", "defence", "ranged", "hitpoints",
            "mining", "woodcutting", "farming", "fishing", "cooking", "smithing", "crafting", "agility", "enchanting");
    private record Skill(String id, Component name, long level, float progress, int color, ItemStack icon) {}
    private static List<Skill> cached = List.of();
    private static Object cachedPlayer;
    private static long nextRefresh;

    private static List<Skill> skills() {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null) return List.of();
        long now = System.nanoTime();
        if (cachedPlayer == mc.player && now < nextRefresh) return cached;
        cachedPlayer = mc.player;
        nextRefresh = now + 250_000_000L;
        Map<String, Experience> xp = Core.get(LogicalSide.CLIENT).getData().getXpMap(null);
        cached = xp.entrySet().stream()
                .filter(e -> definition(e.getKey()).getShowInList())
                .sorted(Comparator.<Map.Entry<String, Experience>>comparingInt(e -> {
                    int index = ORDER.indexOf(e.getKey());
                    return index < 0 ? ORDER.size() : index;
                }).thenComparing(Map.Entry::getKey))
                .map(e -> {
                    Experience value = e.getValue();
                    long level = value.getLevel().getLevel();
                    long next = value.getLevel().getXpToNext();
                    float progress = level >= definition(e.getKey()).getMaxLevel() ? 1 : next <= 0 ? 0
                            : (float) Math.clamp((double) value.getXp() / next, 0, 1);
                    return new Skill(e.getKey(), Component.translatable("pmmo." + e.getKey()), level, progress,
                            0xFF000000 | definition(e.getKey()).getColor(), new ItemStack(icon(e.getKey())));
                }).toList();
        return cached;
    }

    static SkillData definition(String id) {
        return Config.skills().skills().getOrDefault(id, SkillData.Builder.getDefault());
    }

    static Item icon(String id) {
        return switch (id) {
            case "attack" -> Items.IRON_SWORD;
            case "strength" -> Items.IRON_AXE;
            case "defence" -> Items.SHIELD;
            case "ranged" -> Items.BOW;
            case "hitpoints" -> Items.GOLDEN_APPLE;
            case "mining" -> Items.IRON_PICKAXE;
            case "woodcutting" -> Items.OAK_LOG;
            case "farming" -> Items.WHEAT;
            case "fishing" -> Items.FISHING_ROD;
            case "cooking" -> Items.COOKED_BEEF;
            case "smithing" -> Items.ANVIL;
            case "crafting" -> Items.CRAFTING_TABLE;
            case "agility" -> Items.FEATHER;
            case "enchanting" -> Items.ENCHANTED_BOOK;
            default -> Items.EXPERIENCE_BOTTLE;
        };
    }

    private static int panelHeight() {
        return HEADER + Math.max(1, skills().size()) * ROW + FOOTER;
    }

    public static Box box(double x, double y, int sw, int sh) {
        int fullHeight = panelHeight();
        float scale = Math.min(1F, Math.min(Math.max(1, sw - 4) / (float) WIDTH, Math.max(1, sh - 44) / (float) fullHeight));
        int w = (int) Math.ceil(WIDTH * scale), h = (int) Math.ceil(fullHeight * scale);
        return new Box(Math.clamp((int) (sw * x), 0, Math.max(0, sw - w)),
                Math.clamp((int) (sh * y), 0, Math.max(0, sh - h)), w, h);
    }

    public static void render(GuiGraphics g, double x, double y) {
        renderAt(g, box(x, y, g.guiWidth(), g.guiHeight()));
    }

    /** Shared by the real overlay and the editor, so the draggable box matches the panel. */
    public static void renderAt(GuiGraphics g, Box box) {
        draw(g, box, skills());
    }

    public static void renderPreview(GuiGraphics g, Box box) {
        List<Skill> sample = ORDER.stream().map(id -> new Skill(id, Component.translatable("pmmo." + id),
                12 + ORDER.indexOf(id) * 3, (3 + ORDER.indexOf(id) % 6) / 10F,
                0xFF000000 | definition(id).getColor(), new ItemStack(icon(id)))).toList();
        draw(g, box, sample);
    }

    private static void draw(GuiGraphics g, Box box, List<Skill> rows) {
        var font = Minecraft.getInstance().font;
        int h = HEADER + Math.max(1, rows.size()) * ROW + FOOTER;
        float scale = Math.min(box.w() / (float) WIDTH, box.h() / (float) h);
        g.pose().pushPose();
        g.pose().translate(box.x(), box.y(), 0);
        g.pose().scale(scale, scale, 1);
        g.fill(0, 0, WIDTH, h, 0xDC191C20);
        g.renderOutline(0, 0, WIDTH, h, 0xFF514535);
        g.fill(1, 1, WIDTH - 1, 2, 0xFFE0AC46);
        g.drawString(font, "SKILLS", 7, 7, 0xFFF8D982, false);
        String count = Integer.toString(rows.size());
        g.drawString(font, count, WIDTH - 7 - font.width(count), 7, 0xFF9E998E, false);
        g.fill(6, 18, WIDTH - 6, 19, 0xFF363A3F);
        if (rows.isEmpty()) g.drawString(font, "No skills learned yet", 7, HEADER + 3, 0xFFA8A499, false);
        for (int i = 0; i < rows.size(); i++) {
            Skill skill = rows.get(i);
            int y = HEADER + i * ROW;
            if ((i & 1) == 0) g.fill(3, y, WIDTH - 3, y + ROW, 0x203D4349);
            g.pose().pushPose();
            g.pose().translate(6, y + 1, 0);
            g.pose().scale(0.75F, 0.75F, 1);
            g.renderItem(skill.icon(), 0, 0);
            g.pose().popPose();
            String level = Long.toString(skill.level());
            int levelX = WIDTH - 8 - font.width(level);
            String name = font.plainSubstrByWidth(skill.name().getString(), Math.max(0, levelX - 27));
            g.drawString(font, name, 23, y + 1, 0xFFE5E2D9, false);
            g.drawString(font, level, levelX, y + 1, 0xFFF8D982, false);
            g.fill(23, y + 12, WIDTH - 8, y + 14, 0xFF353B40);
            int end = 23 + Math.round((WIDTH - 31) * skill.progress());
            if (end > 23) g.fill(23, y + 12, end, y + 14, skill.color());
        }
        g.pose().popPose();
    }

    private SkillHud() {}
}
