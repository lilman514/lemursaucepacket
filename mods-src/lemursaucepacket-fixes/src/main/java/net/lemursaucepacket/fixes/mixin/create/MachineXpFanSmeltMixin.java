package net.lemursaucepacket.fixes.mixin.create;

import java.util.List;

import net.lemursaucepacket.fixes.skills.MachineXp;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Machine XP: a fan's blasting (smelting and blasting recipes) and smoking turn a stack into what a furnace or smoker
 * would, so the fan's players are paid what that furnace pays its owner, item by item (skills.MachineXp.smelted).
 * Washing and haunting are Create's own, with no XP by hand to match.
 */
@Mixin(targets = {
        "com.simibubi.create.content.kinetics.fan.processing.AllFanProcessingTypes$BlastingType",
        "com.simibubi.create.content.kinetics.fan.processing.AllFanProcessingTypes$SmokingType"
}, remap = false)
public abstract class MachineXpFanSmeltMixin {
    @Inject(method = "process(Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/level/Level;)Ljava/util/List;", at = @At("RETURN"), remap = false)
    private void lsp$machineXp(ItemStack stack, Level level, CallbackInfoReturnable<List<ItemStack>> cir) {
        if (!level.isClientSide()) MachineXp.smelted(level, stack, cir.getReturnValue());
    }
}
