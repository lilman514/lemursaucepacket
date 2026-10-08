package net.lemursaucepacket.fixes.mixin;

import net.minecraft.client.KeyMapping;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Replay Mod's (ReForgedPlay's) replay-viewer keys sit on everyday keys: B, Q, M, H, I, O and more. Replay Mod already
 * takes them out of play everywhere but the replay viewer, yet the Controls screen marked every one of those keys as
 * clashing. A replay-viewer key and an everyday key no longer count as the same key; two of either kind still do.
 *
 * <p>Only the Controls screen asks {@code same} (it decides the red marks), so nothing in play changes. Replay Mod's
 * settings key works everywhere, so it isn't one of them.
 */
@Mixin(KeyMapping.class)
public abstract class KeyMappingSameMixin {
    @Inject(method = "same", at = @At("HEAD"), cancellable = true)
    private void lsp_fixes$replayKeysApart(KeyMapping other, CallbackInfoReturnable<Boolean> cir) {
        if (lsp_fixes$inReplayOnly((KeyMapping) (Object) this) != lsp_fixes$inReplayOnly(other)) cir.setReturnValue(false);
    }

    private static boolean lsp_fixes$inReplayOnly(KeyMapping mapping) {
        String name = mapping.getName();
        return name.startsWith("key.replaymod.") && !name.equals("key.replaymod.settings");
    }
}
