package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.item.crafting.Recipe;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Create's basin (the mixer's shapeless crafting and brewing, the press's compacting, and other mods' cooking in it)
 * runs a recipe that makes something gated, or brews with a gated ingredient, only at its operator's level: whoever
 * placed it or last right-clicked it (skills.Gates, skills.Operators). Both the basin's check (match) and its making
 * (apply) come through here.
 */
@Mixin(targets = "com.simibubi.create.content.processing.basin.BasinRecipe", remap = false)
public abstract class BasinGateMixin {
    @Inject(method = "apply(Lcom/simibubi/create/content/processing/basin/BasinBlockEntity;Lnet/minecraft/world/item/crafting/Recipe;Z)Z",
            at = @At("HEAD"), cancellable = true, remap = false)
    private static void lsp$skillGate(@Coerce BlockEntity basin, Recipe<?> recipe, boolean test, CallbackInfoReturnable<Boolean> cir) {
        if (basin.getLevel() != null && !basin.getLevel().isClientSide() && !Gates.basinMayRun(basin, recipe)) cir.setReturnValue(false);
    }
}
