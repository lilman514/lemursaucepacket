package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Brewing's gate at the stand's ingredient slot: a player can't put in what their level won't brew (skills.Gates). */
@Mixin(targets = "net.minecraft.world.inventory.BrewingStandMenu$IngredientsSlot")
public abstract class BrewingIngredientMixin {
    @Inject(method = "mayPlace", at = @At("HEAD"), cancellable = true)
    private void lsp$skillGate(ItemStack stack, CallbackInfoReturnable<Boolean> cir) {
        if (!Gates.mayBrewWith(stack)) cir.setReturnValue(false);
    }
}
