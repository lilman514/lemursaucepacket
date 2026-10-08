package net.lemursaucepacket.fixes.mixin.sophisticatedcore;

import net.lemursaucepacket.fixes.compat.BackpackCarriers;
import net.minecraft.world.item.ItemStack;
import net.neoforged.fml.util.thread.EffectiveSide;
import net.p3pp3rf1y.sophisticatedcore.api.IStorageWrapper;
import net.p3pp3rf1y.sophisticatedcore.upgrades.UpgradeWrapperBase;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * A backpack upgrade (Sophisticated Backpacks', Create Backpack Upgrades') works only at the level of whoever carries
 * the backpack, or a placed backpack's operator: the upgrade's own making gate (compat.BackpackCarriers). Every upgrade
 * asks isEnabled before it does anything (ticking, pickup, compacting what goes in), and none overrides it.
 */
@Mixin(value = UpgradeWrapperBase.class, remap = false)
public abstract class UpgradeEnabledMixin {
    @Shadow
    @Final
    protected IStorageWrapper storageWrapper;

    @Shadow
    public abstract ItemStack getUpgradeStack();

    @Inject(method = "isEnabled", at = @At("RETURN"), cancellable = true, remap = false)
    private void lsp$skillGate(CallbackInfoReturnable<Boolean> cir) {
        if (!cir.getReturnValueZ() || !EffectiveSide.get().isServer()) return;
        if (!BackpackCarriers.allows(this.storageWrapper, getUpgradeStack())) cir.setReturnValue(false);
    }
}
