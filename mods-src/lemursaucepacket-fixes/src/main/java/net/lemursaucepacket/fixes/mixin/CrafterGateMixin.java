package net.lemursaucepacket.fixes.mixin;

import java.util.Optional;

import net.lemursaucepacket.fixes.skills.Gates;
import net.lemursaucepacket.fixes.skills.MachineXp;
import net.lemursaucepacket.fixes.skills.Operators;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.item.crafting.CraftingInput;
import net.minecraft.world.item.crafting.CraftingRecipe;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.CrafterBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * The Crafter makes what the skill gates list, and uses a recipe that waits on a level, only at its operator's level:
 * whoever placed it or last right-clicked it (skills.Gates, skills.Operators). Below it, it finds no recipe and clicks as
 * it does for a wrong pattern, and its operator is told why. Its menu's preview (no craft) still shows the result.
 */
@Mixin(CrafterBlock.class)
public abstract class CrafterGateMixin {
    @Inject(method = "getPotentialResults", at = @At("RETURN"), cancellable = true)
    private static void lsp$skillGate(Level level, CraftingInput input, CallbackInfoReturnable<Optional<RecipeHolder<CraftingRecipe>>> cir) {
        Optional<RecipeHolder<CraftingRecipe>> found = cir.getReturnValue();
        BlockEntity crafter = Operators.current();
        if (found.isEmpty() || crafter == null) return;
        if (!Gates.machineMayUseRecipe(crafter, found.get().id()) || !Gates.machineMayMake(crafter, found.get().value().getResultItem(level.registryAccess())))
            cir.setReturnValue(Optional.empty());
    }

    /**
     * Machine XP: the recipe a Crafter crafts with on a pulse (inside dispenseFrom, so not its menu's preview) pays its
     * players what making the result by hand would (skills.MachineXp). After the gate above, which returns early when
     * it refuses.
     */
    @Inject(method = "getPotentialResults", at = @At("RETURN"))
    private static void lsp$machineXp(Level level, CraftingInput input, CallbackInfoReturnable<Optional<RecipeHolder<CraftingRecipe>>> cir) {
        Optional<RecipeHolder<CraftingRecipe>> found = cir.getReturnValue();
        BlockEntity crafter = Operators.current();
        if (found.isEmpty() || crafter == null || level.isClientSide()) return;
        try {
            MachineXp.made(level, crafter.getBlockPos(), "crafter", found.get().value().getResultItem(level.registryAccess()));
        } catch (RuntimeException e) {
            // a special recipe with no fixed result: no XP for it
        }
    }

    /** A craft (a redstone pulse): this Crafter is the machine whose operator counts. */
    @Inject(method = "dispenseFrom", at = @At("HEAD"))
    private void lsp$craftStarts(BlockState state, ServerLevel level, BlockPos pos, CallbackInfo ci) {
        Operators.enter(level.getBlockEntity(pos));
    }

    @Inject(method = "dispenseFrom", at = @At("RETURN"))
    private void lsp$craftEnds(BlockState state, ServerLevel level, BlockPos pos, CallbackInfo ci) {
        Operators.leave();
    }
}
