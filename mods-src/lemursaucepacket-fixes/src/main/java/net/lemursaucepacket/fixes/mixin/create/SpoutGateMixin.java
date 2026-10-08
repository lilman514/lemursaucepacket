package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.skills.Gates;
import net.lemursaucepacket.fixes.skills.Operators;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.neoforged.neoforge.fluids.FluidStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * A spout fills an item into something the skill gates list (a cake, a chocolate pie) only at its operator's level:
 * whoever placed it or last right-clicked it (skills.Gates, skills.Operators; SpoutOperatorMixin says which spout is
 * asking). Below it the spout treats the item as one it can't fill and lets it pass, so nothing is spent.
 */
@Mixin(targets = "com.simibubi.create.content.fluids.spout.FillingBySpout", remap = false)
public abstract class SpoutGateMixin {
    @Shadow(remap = false)
    public static ItemStack fillItem(Level world, int requiredAmount, ItemStack stack, FluidStack availableFluid) {
        throw new AssertionError();
    }

    @Inject(method = "getRequiredAmountForItem", at = @At("RETURN"), cancellable = true, remap = false)
    private static void lsp$skillGate(Level level, ItemStack stack, FluidStack fluid, CallbackInfoReturnable<Integer> cir) {
        int amount = cir.getReturnValueI();
        BlockEntity spout = Operators.current();
        if (amount < 0 || spout == null || level.isClientSide()) return;
        // What the fill would make: the same call the spout makes when it's done, on copies.
        ItemStack result;
        try {
            result = fillItem(level, amount, stack.copy(), fluid.copy());
        } catch (RuntimeException e) {
            return;
        }
        if (result != null && !result.isEmpty() && !Gates.machineMayMake(spout, result)) cir.setReturnValue(-1);
    }
}
