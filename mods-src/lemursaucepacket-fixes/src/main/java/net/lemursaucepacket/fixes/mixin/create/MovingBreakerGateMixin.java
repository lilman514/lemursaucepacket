package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.compat.MovingBreakers;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Drills and saws on a moving contraption break a block only at their operator's levels: the operator saved with the
 * actor's block when the contraption was put together (compat.MovingBreakers). visitNewPosition is where an actor picks
 * the block it will break, through canBreak; the saw's and the drill's own versions call these.
 */
@Mixin(targets = "com.simibubi.create.content.kinetics.base.BlockBreakingMovementBehaviour", remap = false)
public abstract class MovingBreakerGateMixin {
    @Inject(method = "visitNewPosition", at = @At("HEAD"), remap = false)
    private void lsp$visitStarts(@Coerce Object context, BlockPos pos, CallbackInfo ci) {
        MovingBreakers.enter(context);
    }

    @Inject(method = "visitNewPosition", at = @At("RETURN"), remap = false)
    private void lsp$visitDone(@Coerce Object context, BlockPos pos, CallbackInfo ci) {
        MovingBreakers.leave();
    }

    @Inject(method = "canBreak(Lnet/minecraft/world/level/Level;Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/state/BlockState;)Z", at = @At("RETURN"), cancellable = true, remap = false)
    private void lsp$skillGate(Level level, BlockPos pos, BlockState state, CallbackInfoReturnable<Boolean> cir) {
        if (cir.getReturnValueZ() && !level.isClientSide() && !MovingBreakers.mayBreak(level, pos, state)) cir.setReturnValue(false);
    }
}
