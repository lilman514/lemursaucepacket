package net.lemursaucepacket.fixes.mixin.farmersdelight;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.item.crafting.Recipe;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Farmer's Delight's cooking pot, fed and emptied by hoppers, cooks a gated meal only if whoever last used it had the
 * level (skills.Gates), as a brewing stand does. Otherwise it waits, ingredients untouched.
 */
@Mixin(targets = "vectorwing.farmersdelight.common.block.entity.CookingPotBlockEntity", remap = false)
public abstract class CookingPotGateMixin {
    @Inject(method = "canCook", at = @At("RETURN"), cancellable = true, remap = false)
    private void lsp$skillGate(@Coerce Object recipe, CallbackInfoReturnable<Boolean> cir) {
        if (!cir.getReturnValueZ()) return;
        BlockEntity pot = (BlockEntity) (Object) this;
        if (pot.getLevel() != null && recipe instanceof Recipe<?> r && !Gates.potMayCook(pot, r.getResultItem(pot.getLevel().registryAccess())))
            cir.setReturnValue(false);
    }
}
