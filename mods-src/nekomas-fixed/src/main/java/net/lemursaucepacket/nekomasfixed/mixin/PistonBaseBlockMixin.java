package net.lemursaucepacket.nekomasfixed.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import net.lemursaucepacket.nekomasfixed.redstone.StruckRedstone;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.SignalGetter;
import net.minecraft.world.level.block.piston.PistonBaseBlock;

/** Redstone Striker: pistons check their own power, not hasNeighborSignal, so a struck piston needs its own hook. */
@Mixin(PistonBaseBlock.class)
public abstract class PistonBaseBlockMixin {
    @Inject(method = "getNeighborSignal", at = @At("HEAD"), cancellable = true)
    private void nekomasfixed$struckPiston(SignalGetter level, BlockPos pos, Direction facing, CallbackInfoReturnable<Boolean> cir) {
        if (StruckRedstone.isStruck(level, pos)) cir.setReturnValue(true);
    }
}
