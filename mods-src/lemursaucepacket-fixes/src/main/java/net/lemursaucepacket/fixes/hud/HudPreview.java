package net.lemursaucepacket.fixes.hud;

import net.lemursaucepacket.fixes.hud.HudElement.Box;
import net.lemursaucepacket.fixes.pmmo.GainHud;
import net.lemursaucepacket.fixes.pmmo.SkillHud;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

/** Sample content within the same measured bounds used to save each overlay's position. */
final class HudPreview {
    static void render(GuiGraphics g, String id, Box b) {
        if (id.equals("pmmo_skills")) {
            SkillHud.renderPreview(g, b);
            return;
        }
        if (id.equals("pmmo_gains")) {
            GainHud.renderPreview(g, b);
            return;
        }
        g.pose().pushPose();
        g.pose().translate(b.x(), b.y(), 0);
        switch (id) {
            case "xaero_minimap" -> minimap(g, b.w(), b.h());
            case "jade" -> {
                scale(g, b, 130, 30);
                panel(g, 130, 30);
                item(g, Items.OAK_LOG, 5, 7, 1);
                text(g, "Oak Log", 26, 5, 0xFFFFFFFF);
                text(g, "Minecraft", 26, 17, 0xFF8080FF);
            }
            case "voice_icon" -> {
                scale(g, b, 16, 16);
                g.fill(6, 1, 10, 9, 0xFFFFFFFF);
                g.fill(3, 6, 5, 11, 0xFFFFFFFF);
                g.fill(11, 6, 13, 11, 0xFFFFFFFF);
                g.fill(4, 11, 12, 13, 0xFFFFFFFF);
                g.fill(7, 12, 9, 15, 0xFFFFFFFF);
                g.fill(5, 15, 11, 16, 0xFFFFFFFF);
            }
            case "voice_group" -> {
                boolean vertical = b.h() > b.w();
                scale(g, b, vertical ? 16 : 52, vertical ? 52 : 16);
                for (int i = 0; i < 3; i++) {
                    int x = vertical ? 0 : i * 18, y = vertical ? i * 18 : 0;
                    g.fill(x, y, x + 16, y + 16, i == 0 ? 0xFF65D885 : 0xFFBBBBBB);
                    g.fill(x + 2, y + 2, x + 14, y + 14, 0xFFC59573);
                    g.fill(x + 2, y + 2, x + 14, y + 5, 0xFF543928);
                    g.fill(x + 4, y + 7, x + 6, y + 9, 0xFF292F3A);
                    g.fill(x + 10, y + 7, x + 12, y + 9, 0xFF292F3A);
                }
            }
            case "create_goggles" -> {
                scale(g, b, 120, 36);
                panel(g, 120, 36);
                text(g, "Kinetic Stats", 5, 4, 0xFFE0AC46);
                text(g, "Speed: 64 RPM", 5, 15, 0xFFF1E4C2);
                text(g, "Stress: 32 / 256su", 5, 26, 0xFF8DDBAA);
            }
            case "ftb_pinned" -> {
                scale(g, b, 168, 46);
                text(g, "Getting Started", 3, 2, 0xFFE0AC46);
                item(g, Items.IRON_INGOT, 3, 15, 0.75F);
                text(g, "Collect Iron", 19, 15, 0xFFFFFFFF);
                text(g, "8 / 16", 126, 15, 0xFFBBBBBB);
                g.fill(19, 28, 160, 31, 0xA0303030);
                g.fill(19, 28, 89, 31, 0xFF64AD68);
                text(g, "Build a Water Wheel", 19, 36, 0xFFDDDDDD);
            }
            case "effects" -> {
                var textures = Minecraft.getInstance().getMobEffectTextures();
                var effects = java.util.List.of(MobEffects.MOVEMENT_SPEED, MobEffects.DIG_SPEED, MobEffects.WEAKNESS);
                for (int i = 0; i < effects.size(); i++) {
                    int x = b.w() - (i == 2 ? 25 : (i + 1) * 25), y = i == 2 ? 26 : 0;
                    g.fill(x, y, x + 24, y + 24, 0xB0404040);
                    g.renderOutline(x, y, 24, 24, 0xFF909090);
                    g.blit(x + 3, y + 3, 0, 18, 18, textures.get(effects.get(i)));
                }
            }
            case "boss_bar" -> {
                scale(g, b, 182, 16);
                text(g, "Wither", (182 - Minecraft.getInstance().font.width("Wither")) / 2, 0, 0xFFFFFFFF);
                g.fill(0, 10, 182, 15, 0xFF26122D);
                g.fill(1, 11, 136, 14, 0xFFB84BD2);
                g.fill(1, 11, 136, 12, 0xFFE589F3);
            }
        }
        g.pose().popPose();
    }

    private static void minimap(GuiGraphics g, int w, int h) {
        int size = Math.min(w, h);
        g.fill(0, 0, size, size, 0xFF706B4A);
        for (int y = 2; y < size - 2; y += 4) {
            for (int x = 2; x < size - 2; x += 4) {
                int color = ((x * 13 + y * 7) % 23 < 10) ? 0xFF49683D : 0xFF62874C;
                if (Math.abs(x - size / 2 - (int) (Math.sin(y * .09) * size * .14)) < size * .1) color = 0xFF4D83A3;
                g.fill(x, y, Math.min(size - 2, x + 4), Math.min(size - 2, y + 4), color);
            }
        }
        g.renderOutline(0, 0, size, size, 0xFFB9AB8D);
        g.fill(size / 2 - 2, size / 2 - 2, size / 2 + 2, size / 2 + 3, 0xFFFFFFFF);
        text(g, "N", size / 2 - 3, 3, 0xFFFFFFFF);
        if (h >= size + 10) text(g, "124, 64, -32", 2, size + 1, 0xFFFFFFFF);
    }

    private static void scale(GuiGraphics g, Box b, int w, int h) {
        g.pose().scale(b.w() / (float) w, b.h() / (float) h, 1);
    }

    private static void panel(GuiGraphics g, int w, int h) {
        g.fill(0, 0, w, h, 0xE019171B);
        g.renderOutline(0, 0, w, h, 0xFF695B83);
    }

    private static void text(GuiGraphics g, String s, int x, int y, int color) {
        g.drawString(Minecraft.getInstance().font, s, x, y, color, true);
    }

    private static void item(GuiGraphics g, Item item, int x, int y, float scale) {
        g.pose().pushPose();
        g.pose().translate(x, y, 0);
        g.pose().scale(scale, scale, 1);
        g.renderItem(new ItemStack(item), 0, 0);
        g.pose().popPose();
    }

    private HudPreview() {}
}
