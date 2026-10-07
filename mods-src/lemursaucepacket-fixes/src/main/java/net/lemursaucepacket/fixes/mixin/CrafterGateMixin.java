package net.lemursaucepacket.fixes.mixin;

import java.util.Optional;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.item.crafting.CraftingInput;
import net.minecraft.world.item.crafting.CraftingRecipe;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.CrafterBlock;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * The Crafter has nobody to ask for a level, so it won't make what the skill gates list, nor use a recipe that waits on
 * one (skills.Gates): it finds no recipe, shows no result, and clicks as it does for a wrong pattern.
 */
@Mixin(CrafterBlock.class)
public abstract class CrafterGateMixin {
    @Inject(method = "getPotentialResults", at = @At("RETURN"), cancellable = true)
    private static void lsp$skillGate(Level level, CraftingInput input, CallbackInfoReturnable<Optional<RecipeHolder<CraftingRecipe>>> cir) {
        Optional<RecipeHolder<CraftingRecipe>> found = cir.getReturnValue();
        if (found.isEmpty()) return;
        if (!Gates.machineMayUseRecipe(found.get().id()) || !Gates.machineMayMake(found.get().value().getResultItem(level.registryAccess())))
            cir.setReturnValue(Optional.empty());
    }
}
