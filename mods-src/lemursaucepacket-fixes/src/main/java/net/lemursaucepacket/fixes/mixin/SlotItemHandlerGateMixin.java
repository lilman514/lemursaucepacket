package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.Slot;
import net.neoforged.neoforge.items.SlotItemHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Skill gates on Farmer's Delight's cooking pot: its result slot is a NeoForge item-handler slot, with its own mayPickup. */
@Mixin(SlotItemHandler.class)
public abstract class SlotItemHandlerGateMixin {
    private static final String COOKING_POT_RESULT = "vectorwing.farmersdelight.common.block.entity.container.CookingPotResultSlot";

    @Inject(method = "mayPickup", at = @At("HEAD"), cancellable = true)
    private void lsp$skillGate(Player player, CallbackInfoReturnable<Boolean> cir) {
        Slot self = (Slot) (Object) this;
        if (COOKING_POT_RESULT.equals(self.getClass().getName()) && !Gates.mayMake(player, self.getItem())) cir.setReturnValue(false);
    }
}
