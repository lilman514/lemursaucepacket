package net.lemursaucepacket.nekomasfixed.recipe;

import net.lemursaucepacket.nekomasfixed.registry.ModBlocks;
import net.lemursaucepacket.nekomasfixed.registry.ModRecipes;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.crafting.AbstractCookingRecipe;
import net.minecraft.world.item.crafting.CookingBookCategory;
import net.minecraft.world.item.crafting.Ingredient;
import net.minecraft.world.item.crafting.RecipeSerializer;

/** A kiln recipe ({@code "type": "nekomasfixed:kilning"}): a cooking recipe like smelting, 100 ticks unless it says otherwise. */
public class KilnRecipe extends AbstractCookingRecipe {
    public static final int DEFAULT_COOKING_TIME = 100;

    public KilnRecipe(String group, CookingBookCategory category, Ingredient ingredient, ItemStack result, float experience, int cookingTime) {
        super(ModRecipes.KILN.get(), group, category, ingredient, result, experience, cookingTime);
    }

    @Override
    public ItemStack getToastSymbol() {
        return new ItemStack(ModBlocks.KILN.get());
    }

    @Override
    public RecipeSerializer<?> getSerializer() {
        return ModRecipes.KILNING.get();
    }
}
