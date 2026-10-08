package net.lemursaucepacket.fixes.mixin.sophisticatedbackpacks;

import net.lemursaucepacket.fixes.skills.Operators;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.p3pp3rf1y.sophisticatedbackpacks.backpack.BackpackBlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * While a placed backpack ticks its upgrades, it is the machine whose operator's level counts (whoever placed it or last
 * opened it: skills.Operators), so its upgrades work at that player's level even while nobody carries it.
 */
@Mixin(value = BackpackBlockEntity.class, remap = false)
public abstract class PlacedBackpackOperatorMixin {
    @Inject(method = "serverTick", at = @At("HEAD"), remap = false)
    private static void lsp$skillGate(Level level, BlockPos pos, BackpackBlockEntity backpack, CallbackInfo ci) {
        Operators.enter(backpack);
    }

    @Inject(method = "serverTick", at = @At("RETURN"), remap = false)
    private static void lsp$tickDone(Level level, BlockPos pos, BackpackBlockEntity backpack, CallbackInfo ci) {
        Operators.leave();
    }
}
