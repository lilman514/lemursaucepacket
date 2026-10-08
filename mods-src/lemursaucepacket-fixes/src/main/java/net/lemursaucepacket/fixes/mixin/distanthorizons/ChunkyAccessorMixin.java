package net.lemursaucepacket.fixes.mixin.distanthorizons;

import net.lemursaucepacket.fixes.compat.ChunkyCheck;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Distant Horizons (3.3.3) hooks into Chunky, so its own world generation pauses while Chunky pre-generates. It binds
 * that hook on the first chunk update it sees, which on a server comes while the spawn chunks load, before Chunky has
 * started (Chunky starts with the server). {@code ChunkyProvider.get()} then throws "Chunky is not loaded." and the
 * server crashes on every start ("Exception during promotion of chunk to FULL status"). Distant Horizons marks the hook
 * bound before trying, so it would never try again either.
 *
 * <p>This holds the setup back until Chunky is up; the next chunk update after that binds the hook as Distant Horizons
 * means to.
 */
@Mixin(targets = "com.seibel.distanthorizons.core.wrapperInterfaces.modAccessor.AbstractChunkyAccessor", remap = false)
public abstract class ChunkyAccessorMixin {
    @Shadow
    private boolean listenerBound;

    @Inject(method = "tryRunFirstTimeSetup", at = @At("HEAD"), cancellable = true)
    private void lsp_fixes$waitForChunky(CallbackInfo ci) {
        if (!this.listenerBound && !ChunkyCheck.isUp()) ci.cancel();
    }
}
