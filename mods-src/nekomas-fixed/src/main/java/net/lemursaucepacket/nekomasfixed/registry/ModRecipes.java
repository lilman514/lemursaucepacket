package net.lemursaucepacket.nekomasfixed.registry;

import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.recipe.KilnRecipe;
import net.lemursaucepacket.nekomasfixed.recipe.ShapelessTransmuteRecipe;
import net.minecraft.core.registries.Registries;
import net.minecraft.world.item.crafting.RecipeSerializer;
import net.minecraft.world.item.crafting.RecipeType;
import net.minecraft.world.item.crafting.SimpleCookingSerializer;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModRecipes {
    static final DeferredRegister<RecipeType<?>> TYPES = DeferredRegister.create(Registries.RECIPE_TYPE, NekomasFixed.MOD_ID);
    static final DeferredRegister<RecipeSerializer<?>> SERIALIZERS = DeferredRegister.create(Registries.RECIPE_SERIALIZER, NekomasFixed.MOD_ID);

    /** What the kiln cooks. */
    public static final DeferredHolder<RecipeType<?>, RecipeType<KilnRecipe>> KILN = TYPES.register("kiln",
            () -> RecipeType.simple(NekomasFixed.id("kiln")));
    /** {@code "type": "nekomasfixed:kilning"}: the kiln recipe format, same fields as smelting. */
    public static final DeferredHolder<RecipeSerializer<?>, SimpleCookingSerializer<KilnRecipe>> KILNING = SERIALIZERS.register("kilning",
            () -> new SimpleCookingSerializer<>(KilnRecipe::new, KilnRecipe.DEFAULT_COOKING_TIME));
    /** {@code "type": "nekomasfixed:crafting_shapeless_transmute"}: shapeless crafting that keeps the first ingredient's data. */
    public static final DeferredHolder<RecipeSerializer<?>, ShapelessTransmuteRecipe.Serializer> SHAPELESS_TRANSMUTE = SERIALIZERS.register(
            "crafting_shapeless_transmute", ShapelessTransmuteRecipe.Serializer::new);

    private ModRecipes() {
    }
}
