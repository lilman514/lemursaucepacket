package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.compat.MovingBreakers;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Machine XP: a drill, saw, plough or roller on a moving contraption breaks blocks in tickBreaker (a saw fells the rest
 * of the tree there too): that actor at work, paid where it is (skills.MachineXp, compat.MovingBreakers).
 */
@Mixin(targets = "com.simibubi.create.content.kinetics.base.BlockBreakingMovementBehaviour", remap = false)
public abstract class MachineXpMovingMixin {
    @Inject(method = "tickBreaker", at = @At("HEAD"), remap = false)
    private void lsp$machineXp(@Coerce Object context, CallbackInfo ci) {
        MovingBreakers.workStarts(context);
    }

    @Inject(method = "tickBreaker", at = @At("RETURN"), remap = false)
    private void lsp$machineXpDone(@Coerce Object context, CallbackInfo ci) {
        MovingBreakers.workEnds();
    }
}
