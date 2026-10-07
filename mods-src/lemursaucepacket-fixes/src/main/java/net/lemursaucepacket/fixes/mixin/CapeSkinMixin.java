package net.lemursaucepacket.fixes.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import net.lemursaucepacket.fixes.capes.client.CapesClient;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.resources.PlayerSkin;
import net.minecraft.resources.ResourceLocation;

/**
 * A player wearing a cape in their Curios cape slot shows it where the vanilla cape goes (the cape layer, and the elytra
 * as vanilla capes do), in place of any cape their account has.
 */
@Mixin(AbstractClientPlayer.class)
public abstract class CapeSkinMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void lsp$wornCape(CallbackInfoReturnable<PlayerSkin> cir) {
        ResourceLocation cape = CapesClient.playerCape((AbstractClientPlayer) (Object) this);
        if (cape == null) return;
        PlayerSkin skin = cir.getReturnValue();
        cir.setReturnValue(new PlayerSkin(skin.texture(), skin.textureUrl(), cape, null, skin.model(), skin.secure()));
    }
}
