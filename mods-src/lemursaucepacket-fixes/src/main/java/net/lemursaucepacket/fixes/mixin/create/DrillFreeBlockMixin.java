package net.lemursaucepacket.fixes.mixin.create;

import java.util.ArrayList;
import java.util.List;

import net.lemursaucepacket.fixes.construction.FreeBlocks;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/**
 * Create's drills and saws (BlockHelper.destroyBlockAs) work out their drops themselves and hand them out whatever the
 * drops event says, so a free block (the Mason's Palette's, the saving perk's) gets an empty list here
 * (construction.FreeBlocks). The drops event they post after still clears its record.
 */
@Mixin(targets = "com.simibubi.create.foundation.utility.BlockHelper", remap = false)
public abstract class DrillFreeBlockMixin {
    @Redirect(method = "destroyBlockAs", at = @At(value = "INVOKE",
            target = "Lnet/minecraft/world/level/block/Block;getDrops(Lnet/minecraft/world/level/block/state/BlockState;Lnet/minecraft/server/level/ServerLevel;Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/entity/BlockEntity;Lnet/minecraft/world/entity/Entity;Lnet/minecraft/world/item/ItemStack;)Ljava/util/List;"),
            remap = false)
    private static List<ItemStack> lsp$freeBlocks(BlockState state, ServerLevel level, BlockPos pos, BlockEntity blockEntity, Entity breaker, ItemStack tool) {
        if (FreeBlocks.dropsNothing(level, pos, state)) return new ArrayList<>();
        return Block.getDrops(state, level, pos, blockEntity, breaker, tool);
    }
}
