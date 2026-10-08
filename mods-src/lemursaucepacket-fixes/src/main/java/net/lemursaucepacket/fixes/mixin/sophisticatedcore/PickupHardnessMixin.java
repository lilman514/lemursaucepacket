package net.lemursaucepacket.fixes.mixin.sophisticatedcore;

import net.lemursaucepacket.fixes.hardness.HardnessUseGate;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.p3pp3rf1y.sophisticatedcore.upgrades.UpgradeHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * A backpack's pickup upgrades don't take a material its carrier's Mining level can't use yet (the Hardness use-gate:
 * no containers but a chest): it goes into the inventory as a normal pickup instead. Otherwise a pickup upgrade with an
 * auto-smelting one would turn raw ores into ingots past the gate.
 */
@Mixin(targets = "net.p3pp3rf1y.sophisticatedcore.util.InventoryHelper", remap = false)
public abstract class PickupHardnessMixin {
    @Inject(method = "runPickupOnPickupResponseUpgrades(Lnet/minecraft/world/level/Level;Lnet/minecraft/world/entity/player/Player;Lnet/p3pp3rf1y/sophisticatedcore/upgrades/UpgradeHandler;Lnet/minecraft/world/item/ItemStack;Z)Lnet/minecraft/world/item/ItemStack;",
            at = @At("HEAD"), cancellable = true, remap = false)
    private static void lsp$skillGate(Level level, Player player, UpgradeHandler upgrades, ItemStack stack, boolean simulate, CallbackInfoReturnable<ItemStack> cir) {
        if (player == null || HardnessUseGate.mayUse(player, stack)) return;
        if (!simulate) HardnessUseGate.tellBackpack(player, stack);
        cir.setReturnValue(stack);
    }
}
