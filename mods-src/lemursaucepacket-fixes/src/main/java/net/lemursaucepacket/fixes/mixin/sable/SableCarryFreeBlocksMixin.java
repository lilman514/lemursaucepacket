package net.lemursaucepacket.fixes.mixin.sable;

import net.lemursaucepacket.fixes.construction.FreeBlocks;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Coerce;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Sable moving blocks into an airship (Create Aeronautics' assembly) or back out: the Mason's Palette's free blocks keep
 * their record in the new spot, so they still drop nothing (construction.FreeBlocks#carry).
 */
@Mixin(targets = "dev.ryanhcode.sable.api.SubLevelAssemblyHelper", remap = false)
public abstract class SableCarryFreeBlocksMixin {
    @Inject(method = "moveBlocks", at = @At("RETURN"), remap = false)
    private static void lsp$freeBlocks(ServerLevel level, @Coerce Object transform, Iterable<BlockPos> positions, CallbackInfo ci) {
        FreeBlocks.carry(level, transform, positions);
    }
}
