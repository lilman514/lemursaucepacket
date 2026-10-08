package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.skills.Operators;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * While a spout looks at an item on the belt or depot below it (when it arrives, and each tick it's held), it is the
 * machine whose operator's level counts (skills.Operators): SpoutGateMixin asks for it.
 */
@Mixin(targets = "com.simibubi.create.content.fluids.spout.SpoutBlockEntity", remap = false)
public abstract class SpoutOperatorMixin {
    @Inject(method = "onItemReceived", at = @At("HEAD"), remap = false)
    private void lsp$skillGate(@Coerce Object transported, @Coerce Object handler, CallbackInfoReturnable<?> cir) {
        Operators.enter((BlockEntity) (Object) this);
    }

    @Inject(method = "onItemReceived", at = @At("RETURN"), remap = false)
    private void lsp$receivedDone(@Coerce Object transported, @Coerce Object handler, CallbackInfoReturnable<?> cir) {
        Operators.leave();
    }

    @Inject(method = "whenItemHeld", at = @At("HEAD"), remap = false)
    private void lsp$heldStarts(@Coerce Object transported, @Coerce Object handler, CallbackInfoReturnable<?> cir) {
        Operators.enter((BlockEntity) (Object) this);
    }

    @Inject(method = "whenItemHeld", at = @At("RETURN"), remap = false)
    private void lsp$heldDone(@Coerce Object transported, @Coerce Object handler, CallbackInfoReturnable<?> cir) {
        Operators.leave();
    }
}
