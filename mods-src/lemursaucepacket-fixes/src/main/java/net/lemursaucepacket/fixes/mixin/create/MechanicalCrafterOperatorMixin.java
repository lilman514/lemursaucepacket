package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.skills.Operators;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * While a mechanical crafter ticks (that's where its grid finishes a craft, in RecipeGridHandler.tryToApplyRecipe), it
 * is the machine whose operator's level counts (skills.Operators): MechanicalCrafterGateMixin asks for it.
 */
@Mixin(targets = "com.simibubi.create.content.kinetics.crafter.MechanicalCrafterBlockEntity", remap = false)
public abstract class MechanicalCrafterOperatorMixin {
    @Inject(method = "tick", at = @At("HEAD"), remap = false)
    private void lsp$skillGate(CallbackInfo ci) {
        Operators.enter((BlockEntity) (Object) this);
    }

    @Inject(method = "tick", at = @At("RETURN"), remap = false)
    private void lsp$skillGateDone(CallbackInfo ci) {
        Operators.leave();
    }
}
