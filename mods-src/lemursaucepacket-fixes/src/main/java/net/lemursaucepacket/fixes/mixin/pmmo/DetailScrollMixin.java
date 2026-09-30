package net.lemursaucepacket.fixes.mixin.pmmo;

import net.lemursaucepacket.fixes.pmmo.SkillsPanelFixes;
import net.minecraft.client.gui.components.AbstractScrollWidget;
import net.minecraft.network.chat.Component;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Overwrite;

/**
 * Project MMO's DetailScroll: the scrolling list in the inventory skills panel (and the glossary).
 *
 * <p>Its wheel step is {@code Math.min(50, getMaxScrollAmount() / 100)} in integer maths, so any list
 * that overflows by less than about 200 px doesn't scroll at all (a maximised 3440x1440 window at
 * GUI scale 4), and longer ones crawl 1-2 units a notch. Its maximum,
 * {@code Math.max(1, getInnerHeight() - height) / 2}, rounds down and ignores the 1 px scissor inset,
 * so the last row stays partly clipped. See {@link SkillsPanelFixes} for the units.
 */
@Mixin(targets = "harmonised.pmmo.client.gui.glossary.components.DetailScroll")
public abstract class DetailScrollMixin extends AbstractScrollWidget {
    private DetailScrollMixin(int x, int y, int width, int height, Component message) {
        super(x, y, width, height, message);
    }

    /**
     * @author LemurSaucePacket
     * @reason Let the list scroll until its last row is fully in view.
     */
    @Overwrite
    protected int getMaxScrollAmount() {
        return SkillsPanelFixes.maxScroll(this.getInnerHeight(), this.height);
    }

    /**
     * @author LemurSaucePacket
     * @reason One skill row per wheel notch (or arrow key), whatever the list length.
     */
    @Overwrite
    protected double scrollRate() {
        return SkillsPanelFixes.SCROLL_STEP;
    }
}
