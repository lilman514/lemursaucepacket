package net.lemursaucepacket.nekomasfixed.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import net.lemursaucepacket.nekomasfixed.redstone.StruckRedstone;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.SignalGetter;

/** Redstone Striker: a struck component (lamp, door, dispenser, TNT...) sees a signal (see {@link StruckRedstone}). */
@Mixin(SignalGetter.class)
public interface SignalGetterMixin {
    @Inject(method = "hasNeighborSignal", at = @At("HEAD"), cancellable = true)
    private void nekomasfixed$struckComponent(BlockPos pos, CallbackInfoReturnable<Boolean> cir) {
        if (StruckRedstone.isStruck((BlockGetter) this, pos)) cir.setReturnValue(true);
    }
}
