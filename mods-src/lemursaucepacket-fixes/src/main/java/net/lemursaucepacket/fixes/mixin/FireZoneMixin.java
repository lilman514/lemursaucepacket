package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.zone.SafeZones;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.FireBlock;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Safe zones with the FIRE flag (the spawn city: thatch roofs burn): fire there goes out on its first tick
 * instead of spreading, and fire next to a zone can't burn the blocks inside. Fire spread has no event.
 */
@Mixin(FireBlock.class)
public abstract class FireZoneMixin {
    @Inject(method = "tick", at = @At("HEAD"), cancellable = true)
    private void lsp$noFireInZones(BlockState state, ServerLevel level, BlockPos pos, RandomSource random, CallbackInfo ci) {
        if (SafeZones.at(level, pos, SafeZones.Flag.FIRE) != null) {
            level.removeBlock(pos, false);
            ci.cancel();
        }
    }

    @Inject(method = "checkBurnOut", at = @At("HEAD"), cancellable = true)
    private void lsp$noBurningInZones(Level level, BlockPos pos, int chance, RandomSource random, int age, Direction face, CallbackInfo ci) {
        if (SafeZones.at(level, pos, SafeZones.Flag.FIRE) != null) ci.cancel();
    }
}
