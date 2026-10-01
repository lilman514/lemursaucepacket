package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.lifesteal.CraftingOwnership;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.CraftingContainer;
import net.minecraft.world.inventory.CraftingMenu;
import net.minecraft.world.inventory.ResultContainer;
import net.minecraft.world.item.crafting.CraftingRecipe;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.level.Level;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Both vanilla crafting grids share this method. Stamp before the result is synced or compared for merging. */
@Mixin(CraftingMenu.class)
public abstract class CraftingResultMixin {
    @Inject(method = "slotChangedCraftingGrid", at = @At(value = "INVOKE",
            target = "Lnet/minecraft/world/inventory/ResultContainer;setItem(ILnet/minecraft/world/item/ItemStack;)V",
            shift = At.Shift.AFTER), require = 1)
    private static void lsp$prepareOwnership(AbstractContainerMenu menu, Level level, Player player,
            CraftingContainer input, ResultContainer output, RecipeHolder<CraftingRecipe> recipe, CallbackInfo ci) {
        CraftingOwnership.prepare(output.getItem(0), player);
    }
}
