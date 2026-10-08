package net.lemursaucepacket.fixes.mixin.lithostitched;

import net.lemursaucepacket.fixes.compat.DistantHorizonsRegion;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.WorldGenLevel;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Lithostitched's "in a structure" block predicate (used by this pack's terrain mods to keep features out of
 * structures) looks structures up in the real server world, {@code level.getLevel()}, whatever world it is handed.
 * From Distant Horizons' generator threads every lookup becomes a chunk request that waits on the server's main
 * thread, and asks the server to start (and save) the chunk too: in a pre-build the threads spent much of their time
 * waiting there, one request at a time, and the server fell behind.
 *
 * <p>Distant Horizons builds its distant land without structures, so there the answer is "not in a structure", given
 * at once. Everywhere else the predicate is untouched.
 */
@Mixin(targets = "dev.worldgen.lithostitched.worldgen.blockpredicate.InStructurePredicate", remap = false)
public abstract class InStructurePredicateMixin {
    @Inject(method = "test(Lnet/minecraft/world/level/WorldGenLevel;Lnet/minecraft/core/BlockPos;)Z", at = @At("HEAD"), cancellable = true)
    private void lsp_fixes$noStructuresInDistantLand(WorldGenLevel level, BlockPos pos, CallbackInfoReturnable<Boolean> cir) {
        if (DistantHorizonsRegion.is(level)) cir.setReturnValue(false);
    }
}
