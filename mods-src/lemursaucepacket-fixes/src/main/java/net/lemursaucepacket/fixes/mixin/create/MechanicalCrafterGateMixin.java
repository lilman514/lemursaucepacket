package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.skills.Gates;
import net.lemursaucepacket.fixes.skills.Operators;
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
 * Create's mechanical crafters make what the skill gates list, and use a recipe that waits on a level, only at their
 * operator's level: whoever placed the crafter that finishes the craft, or last right-clicked it (skills.Gates,
 * skills.Operators; MechanicalCrafterOperatorMixin says which crafter is crafting).
 */
@Mixin(targets = "com.simibubi.create.content.kinetics.crafter.RecipeGridHandler", remap = false)
public abstract class MechanicalCrafterGateMixin {
    @Inject(method = "tryToApplyRecipe", at = @At("RETURN"), cancellable = true, remap = false)
    private static void lsp$skillGate(Level level, @Coerce Object items, CallbackInfoReturnable<ItemStack> cir) {
        ItemStack result = cir.getReturnValue();
        if (result != null && !result.isEmpty() && !level.isClientSide() && !Gates.machineMayMake(Operators.current(), result)) cir.setReturnValue(null);
    }

    /** A recipe that waits on a level (Construction's alternate recipes) is one the grid may use at its operator's level. */
    @Inject(method = "isRecipeAllowed", at = @At("RETURN"), cancellable = true, remap = false)
    private static void lsp$skillGate(RecipeHolder<CraftingRecipe> recipe, CraftingInput input, CallbackInfoReturnable<Boolean> cir) {
        if (cir.getReturnValueZ() && !Gates.machineMayUseRecipe(Operators.current(), recipe.id())) cir.setReturnValue(false);
    }
}
