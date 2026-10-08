package net.lemursaucepacket.fixes.mixin.create;

import java.util.function.Consumer;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.skills.MachineXp;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Machine XP: every block Create's machines break goes through BlockHelper.destroyBlockAs with no player. While a
 * machine is at work (the other MachineXp mixins), the players near it are paid Project MMO's break XP for the block,
 * worked out here while it's still in the world (skills.MachineXp.breaking). Breaks by a player (a deployer's fake one
 * included) are Project MMO's own.
 */
@Mixin(targets = "com.simibubi.create.foundation.utility.BlockHelper", remap = false)
public abstract class MachineXpBlockHelperMixin {
    @Inject(method = "destroyBlockAs", at = @At("HEAD"), remap = false)
    private static void lsp$machineXp(Level level, BlockPos pos, @Nullable Player player, ItemStack usedTool, float effectChance, Consumer<ItemStack> droppedItemCallback, CallbackInfo ci) {
        if (player == null && !level.isClientSide()) MachineXp.breaking(level, pos);
    }
}
