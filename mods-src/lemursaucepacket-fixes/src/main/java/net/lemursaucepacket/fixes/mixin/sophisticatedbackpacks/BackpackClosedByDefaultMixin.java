package net.lemursaucepacket.fixes.mixin.sophisticatedbackpacks;

import net.p3pp3rf1y.sophisticatedbackpacks.settings.BackpackMainSettingsCategory;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyArg;

/**
 * A worn backpack starts closed to other players (the owner's call, 2026-10-08: "lock backpacks"): Sophisticated
 * Backpacks' "Another player can open" setting defaults to off instead of on, so right-clicking someone's back opens
 * nothing unless they switched it on themselves (the backpack's settings, or the Player tab for all of theirs). The
 * server option allowOpeningOtherPlayerBackpacks stays on, so teammates can still choose to share.
 */
@Mixin(value = BackpackMainSettingsCategory.class, remap = false)
public abstract class BackpackClosedByDefaultMixin {
    @ModifyArg(method = "<clinit>", at = @At(value = "INVOKE", target = "Ljava/lang/Boolean;valueOf(Z)Ljava/lang/Boolean;", ordinal = 0), index = 0, remap = false)
    private static boolean lsp_fixes$closedByDefault(boolean open) {
        return false;
    }
}
