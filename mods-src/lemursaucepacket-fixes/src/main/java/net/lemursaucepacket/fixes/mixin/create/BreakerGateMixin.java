package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.skills.Gates;
import net.lemursaucepacket.fixes.skills.Operators;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * A mechanical drill or saw breaks a block only at its operator's levels (skills.Operators: whoever placed it or last
 * right-clicked it): a log past their Woodcutting chop level stays standing, as it would for their axe, and they're told
 * why. The saw's own canBreak calls this one, so one hook covers both.
 */
@Mixin(targets = "com.simibubi.create.content.kinetics.base.BlockBreakingKineticBlockEntity", remap = false)
public abstract class BreakerGateMixin {
    @Shadow(remap = false)
    protected BlockPos breakingPos;

    @Inject(method = "canBreak(Lnet/minecraft/world/level/block/state/BlockState;F)Z", at = @At("RETURN"), cancellable = true, remap = false)
    private void lsp$skillGate(BlockState state, float hardness, CallbackInfoReturnable<Boolean> cir) {
        if (!cir.getReturnValueZ() || breakingPos == null) return;
        BlockEntity be = (BlockEntity) (Object) this;
        Level level = be.getLevel();
        if (level == null || level.isClientSide()) return;
        // Create also asks about other states (its own block's, now and then): only the block in front is gated.
        if (level.getBlockState(breakingPos) != state) return;
        boolean saw = be.getClass().getName().endsWith("SawBlockEntity");
        if (!Gates.breakerMayBreak(level, breakingPos, state, Operators.of(be), be.getBlockState().getBlock().getName().getString(), be.getBlockPos(), saw ? "cut" : "break")) {
            cir.setReturnValue(false);
        }
    }
}
