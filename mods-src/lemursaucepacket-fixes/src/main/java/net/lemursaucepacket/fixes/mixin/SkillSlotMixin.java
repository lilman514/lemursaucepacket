package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ResultContainer;
import net.minecraft.world.inventory.ResultSlot;
import net.minecraft.world.inventory.Slot;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Skill gates on making things (skills.Gates): a crafting grid's result (the crafting table's and the inventory's) can't
 * be taken, by a click or a shift-click, without the level the item needs, or the level its recipe needs (Construction's
 * alternate recipes). ResultSlot inherits this method.
 */
@Mixin(Slot.class)
public abstract class SkillSlotMixin {
    @Inject(method = "mayPickup", at = @At("HEAD"), cancellable = true)
    private void lsp$skillGate(Player player, CallbackInfoReturnable<Boolean> cir) {
        Slot self = (Slot) (Object) this;
        if (!(self instanceof ResultSlot) || self.getItem().isEmpty()) return;
        if (!Gates.mayMake(player, self.getItem())) {
            cir.setReturnValue(false);
            return;
        }
        if (self.container instanceof ResultContainer results && results.getRecipeUsed() != null && !Gates.mayUseRecipe(player, results.getRecipeUsed().id()))
            cir.setReturnValue(false);
    }
}
