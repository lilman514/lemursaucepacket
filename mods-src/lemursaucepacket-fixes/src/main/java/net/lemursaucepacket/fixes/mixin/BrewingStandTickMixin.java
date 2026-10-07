package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BrewingStandBlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Brewing's gate for stands that hoppers feed: a stand only brews a gated ingredient if whoever last used it had the
 * level (skills.Gates). Otherwise it waits, ingredient and fuel untouched.
 */
@Mixin(BrewingStandBlockEntity.class)
public abstract class BrewingStandTickMixin {
    @Inject(method = "serverTick", at = @At("HEAD"), cancellable = true)
    private static void lsp$skillGate(Level level, BlockPos pos, BlockState state, BrewingStandBlockEntity stand, CallbackInfo ci) {
        if (!Gates.standMayBrew(stand, stand.getItem(3))) ci.cancel();
    }
}
