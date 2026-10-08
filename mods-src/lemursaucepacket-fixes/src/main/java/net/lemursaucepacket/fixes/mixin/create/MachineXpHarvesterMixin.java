package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.compat.MovingBreakers;
import net.minecraft.core.BlockPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Machine XP: a mechanical harvester reaping a crop as its contraption passes is that harvester at work (skills.MachineXp). */
@Mixin(targets = "com.simibubi.create.content.contraptions.actors.harvester.HarvesterMovementBehaviour", remap = false)
public abstract class MachineXpHarvesterMixin {
    @Inject(method = "visitNewPosition", at = @At("HEAD"), remap = false)
    private void lsp$machineXp(@Coerce Object context, BlockPos pos, CallbackInfo ci) {
        MovingBreakers.workStarts(context);
    }

    @Inject(method = "visitNewPosition", at = @At("RETURN"), remap = false)
    private void lsp$machineXpDone(@Coerce Object context, BlockPos pos, CallbackInfo ci) {
        MovingBreakers.workEnds();
    }
}
