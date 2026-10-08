package net.lemursaucepacket.fixes.mixin.pmmo;

import harmonised.pmmo.api.client.PanelWidget;
import net.lemursaucepacket.fixes.skills.client.SkillGuideScreen;
import net.minecraft.client.gui.GuiGraphics;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * A skill's row in Project MMO's inventory skills panel (and its glossary): clicking it opens that skill's guide, what
 * every level unlocks ({@link SkillGuideScreen}), and hovering it says so.
 *
 * <p>The panel already hands each row its clicks (moved into the scrolled list's own space); a click on a row ends in
 * ReactiveWidget.onClick, which this overrides for skill rows. The list marks the row under the mouse as focused each
 * frame before drawing it, so focus is hover here.
 */
@Mixin(targets = "harmonised.pmmo.client.gui.glossary.components.parts.PlayerSkillWidget")
public abstract class PlayerSkillWidgetMixin extends PanelWidget {
    @Shadow
    @Final
    private String skillName;

    private PlayerSkillWidgetMixin(int color, int width) {
        super(color, width);
    }

    @Override
    public void onClick(double mouseX, double mouseY) {
        super.onClick(mouseX, mouseY);
        SkillGuideScreen.openFromPanel(skillName);
    }

    @Inject(method = "renderWidget", at = @At("TAIL"))
    private void lsp_fixes$guideHint(GuiGraphics g, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
        SkillGuideScreen.panelHover(skillName, isFocused());
    }
}
