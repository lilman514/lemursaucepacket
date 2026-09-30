package net.lemursaucepacket.fixes.mixin.pmmo;

import net.lemursaucepacket.fixes.pmmo.SkillsPanelFixes;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyArg;

/**
 * Project MMO's inventory skills panel is 130 px wide at x = 0, but the survival inventory starts at
 * (width - 176) / 2, which is only 125 at the smallest 16:9 GUI (427 px wide) and 72 at 4:3. When the
 * panel would reach into the inventory (or into an open recipe book), it starts collapsed to its thin
 * edge tab instead of open (pack config {@code skill_panel_open_by_default = true}). Clicking the tab
 * still opens it. Re-evaluated on every inventory open and window resize.
 */
@Mixin(targets = "harmonised.pmmo.client.gui.skill_side_panel.SkillsSidePanel")
public abstract class SkillsSidePanelMixin {
    // Runs before super(), hence static: rewrites the 'open' argument of
    // super(x, y, PANEL_WIDTH, height, Config.SKILL_PANEL_OPEN_BY_DEFAULT.get()).
    @ModifyArg(
            method = "<init>",
            at = @At(value = "INVOKE", target = "Lharmonised/pmmo/client/gui/glossary/components/CollapsingPanel;<init>(IIIIZ)V"),
            index = 4)
    private static boolean lsp_fixes$startCollapsedWhenCramped(int x, int y, int width, int height, boolean open) {
        return open && SkillsPanelFixes.fitsBesideContainer(x, width);
    }
}
