package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Create's mechanical crafters have nobody to ask for a level, so they won't make what the skill gates list
 * (skills.Gates): those you make yourself.
 */
@Mixin(targets = "com.simibubi.create.content.kinetics.crafter.RecipeGridHandler", remap = false)
public abstract class MechanicalCrafterGateMixin {
    @Inject(method = "tryToApplyRecipe", at = @At("RETURN"), cancellable = true, remap = false)
    private static void lsp$skillGate(Level level, @Coerce Object items, CallbackInfoReturnable<ItemStack> cir) {
        ItemStack result = cir.getReturnValue();
        if (result != null && !result.isEmpty() && !Gates.machineMayMake(result)) cir.setReturnValue(null);
    }
}
