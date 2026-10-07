package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.SmithingMenu;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Skill gates on the smithing table: netherite (and the pack's compacted netherite) waits on Smithing. */
@Mixin(SmithingMenu.class)
public abstract class SmithingGateMixin {
    @Inject(method = "mayPickup", at = @At("RETURN"), cancellable = true)
    private void lsp$skillGate(Player player, boolean hasStack, CallbackInfoReturnable<Boolean> cir) {
        if (cir.getReturnValueZ() && !Gates.mayMake(player, ((ItemCombinerMenuAccessor) this).lsp$results().getItem(0))) cir.setReturnValue(false);
    }
}
