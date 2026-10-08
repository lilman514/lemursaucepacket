package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.compat.Fans;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Machine XP: an air current ticking is its fan at work, paid where the fan is (compat.Fans, MachineXpFanSmeltMixin). */
@Mixin(targets = "com.simibubi.create.content.kinetics.fan.AirCurrent", remap = false)
public abstract class MachineXpFanMixin {
    @Inject(method = "tick", at = @At("HEAD"), remap = false)
    private void lsp$machineXp(CallbackInfo ci) {
        Fans.workStarts(this);
    }

    @Inject(method = "tick", at = @At("RETURN"), remap = false)
    private void lsp$machineXpDone(CallbackInfo ci) {
        Fans.workEnds();
    }
}
