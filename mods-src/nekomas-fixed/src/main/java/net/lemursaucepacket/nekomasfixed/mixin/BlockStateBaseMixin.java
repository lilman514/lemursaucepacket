package net.lemursaucepacket.nekomasfixed.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import net.lemursaucepacket.nekomasfixed.redstone.StruckRedstone;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.block.state.BlockBehaviour;

/**
 * Redstone Striker: a struck solid block gives off 15. Upstream hooks the level's getSignal; this hooks the block
 * state's, which the level's calls too, and so does Lithium's faster redstone dust (in the pack), which skips the level's.
 */
@Mixin(BlockBehaviour.BlockStateBase.class)
public abstract class BlockStateBaseMixin {
    @Inject(method = "getSignal(Lnet/minecraft/world/level/BlockGetter;Lnet/minecraft/core/BlockPos;Lnet/minecraft/core/Direction;)I", at = @At("HEAD"), cancellable = true)
    private void nekomasfixed$struckConductor(BlockGetter level, BlockPos pos, Direction direction, CallbackInfoReturnable<Integer> cir) {
        if (StruckRedstone.isStruck(level, pos) && ((BlockBehaviour.BlockStateBase) (Object) this).isRedstoneConductor(level, pos)) {
            cir.setReturnValue(15);
        }
    }
}
