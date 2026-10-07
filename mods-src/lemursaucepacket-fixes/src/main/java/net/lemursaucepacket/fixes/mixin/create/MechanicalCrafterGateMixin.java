package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.crafting.CraftingInput;
import net.minecraft.world.item.crafting.CraftingRecipe;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Create's mechanical crafters have nobody to ask for a level, so they won't make what the skill gates list, nor use a
 * recipe that waits on one (skills.Gates): those you make yourself.
 */
@Mixin(targets = "com.simibubi.create.content.kinetics.crafter.RecipeGridHandler", remap = false)
public abstract class MechanicalCrafterGateMixin {
    @Inject(method = "tryToApplyRecipe", at = @At("RETURN"), cancellable = true, remap = false)
    private static void lsp$skillGate(Level level, @Coerce Object items, CallbackInfoReturnable<ItemStack> cir) {
        ItemStack result = cir.getReturnValue();
        if (result != null && !result.isEmpty() && !Gates.machineMayMake(result)) cir.setReturnValue(null);
    }

    /** A recipe that waits on a level isn't one the grid may use (Construction's alternate recipes). */
    @Inject(method = "isRecipeAllowed", at = @At("RETURN"), cancellable = true, remap = false)
    private static void lsp$skillGate(RecipeHolder<CraftingRecipe> recipe, CraftingInput input, CallbackInfoReturnable<Boolean> cir) {
        if (cir.getReturnValueZ() && !Gates.machineMayUseRecipe(recipe.id())) cir.setReturnValue(false);
    }
}
