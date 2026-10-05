package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.zone.SafeZones;
import net.minecraft.world.entity.LightningBolt;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Lightning striking inside a safe zone with the FIRE flag starts no fires (the bolt itself still strikes). */
@Mixin(LightningBolt.class)
public abstract class LightningZoneMixin {
    @Inject(method = "spawnFire", at = @At("HEAD"), cancellable = true)
    private void lsp$noLightningFire(int extraIgnitions, CallbackInfo ci) {
        LightningBolt self = (LightningBolt) (Object) this;
        if (SafeZones.at(self.level(), self.blockPosition(), SafeZones.Flag.FIRE) != null) ci.cancel();
    }
}
