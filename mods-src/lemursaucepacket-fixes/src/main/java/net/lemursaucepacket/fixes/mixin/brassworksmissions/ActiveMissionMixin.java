package net.lemursaucepacket.fixes.mixin.brassworksmissions;

import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Mutable;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import net.lemursaucepacket.fixes.economy.EconomyContent;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.Tag;
import net.minecraft.world.item.ItemStack;
import net.swzo.brassworksmissions.missions.ActiveMission;

/**
 * Brassworks Missions keeps each assigned mission's reward stack in the player's data. Missions assigned while the pack had
 * Numismatics saved bevels; with that mod gone they load as empty stacks, and Brassworks then fails to save or sync the
 * player ("Cannot encode empty ItemStack"), which disconnects them on join. A reward that comes back empty becomes the
 * same number of Coin Pouches (what missions pay now), and an empty stack is written as an empty tag instead of throwing.
 */
@Mixin(ActiveMission.class)
public abstract class ActiveMissionMixin {
    @Shadow
    @Final
    @Mutable
    private ItemStack rewardItemStack;

    @Inject(method = "deserializeNBT", at = @At("RETURN"))
    private static void lsp$pouchesForLostRewards(HolderLookup.Provider provider, CompoundTag tag, CallbackInfoReturnable<ActiveMission> cir) {
        ActiveMission mission = cir.getReturnValue();
        if (mission == null || !mission.getRewardItemStack().isEmpty()) return;
        int count = Math.max(1, Math.min(64, tag.getCompound("rewardItem").getInt("count")));
        ((ActiveMissionMixin) (Object) mission).rewardItemStack = new ItemStack(EconomyContent.COIN_POUCH.get(), count);
    }

    @Redirect(method = "serializeNBT", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/item/ItemStack;save(Lnet/minecraft/core/HolderLookup$Provider;)Lnet/minecraft/nbt/Tag;"))
    private Tag lsp$saveEmptySafely(ItemStack stack, HolderLookup.Provider provider) {
        return stack.isEmpty() ? new CompoundTag() : stack.save(provider);
    }
}
