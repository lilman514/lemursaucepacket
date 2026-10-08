package net.lemursaucepacket.fixes.mixin.create;

import net.lemursaucepacket.fixes.skills.MachineXp;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Machine XP: a still drill or saw breaking a block is that machine at work (skills.MachineXp), so the players near it
 * are paid for the block (MachineXpBlockHelperMixin). The saw's own onBlockBroken, which fells the rest of the tree,
 * is MachineXpSawMixin.
 */
@Mixin(targets = "com.simibubi.create.content.kinetics.base.BlockBreakingKineticBlockEntity", remap = false)
public abstract class MachineXpBreakerMixin {
    @Inject(method = "onBlockBroken(Lnet/minecraft/world/level/block/state/BlockState;)V", at = @At("HEAD"), remap = false)
    private void lsp$machineXp(BlockState state, CallbackInfo ci) {
        BlockEntity be = (BlockEntity) (Object) this;
        MachineXp.enter(be.getLevel(), be.getBlockPos(), be.getBlockState().getBlock().getDescriptionId());
    }

    @Inject(method = "onBlockBroken(Lnet/minecraft/world/level/block/state/BlockState;)V", at = @At("RETURN"), remap = false)
    private void lsp$machineXpDone(BlockState state, CallbackInfo ci) {
        MachineXp.leave();
    }
}
