package net.lemursaucepacket.fixes.mixin.pmmo;

import net.lemursaucepacket.fixes.pmmo.SkillHud;
import net.minecraft.client.gui.GuiGraphics;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(targets = "harmonised.pmmo.client.gui.XPOverlayGUI")
public abstract class SkillHudMixin {
    @Inject(method = "renderSkillList", at = @At("HEAD"), cancellable = true, require = 1)
    private void lsp$renderSkills(GuiGraphics graphics, double x, double y, CallbackInfo ci) {
        SkillHud.render(graphics, x, y);
        ci.cancel();
    }
}
