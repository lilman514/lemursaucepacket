package net.lemursaucepacket.nekomasfixed.recipe;

import com.mojang.serialization.Codec;
import com.mojang.serialization.DataResult;
import com.mojang.serialization.MapCodec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

import net.lemursaucepacket.nekomasfixed.registry.ModRecipes;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.NonNullList;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.crafting.CraftingBookCategory;
import net.minecraft.world.item.crafting.CraftingInput;
import net.minecraft.world.item.crafting.Ingredient;
import net.minecraft.world.item.crafting.RecipeSerializer;
import net.minecraft.world.item.crafting.ShapelessRecipe;

/**
 * Shapeless crafting whose result keeps everything the item matching the first ingredient carried: dyeing a shulker
 * box keeps its contents and name. (1.21.2 added {@code crafting_transmute} for this; 1.21.1 doesn't have it, and
 * upstream's plain shapeless recipe emptied the box.) Same JSON as {@code minecraft:crafting_shapeless}.
 */
public class ShapelessTransmuteRecipe extends ShapelessRecipe {
    public ShapelessTransmuteRecipe(String group, CraftingBookCategory category, ItemStack result, NonNullList<Ingredient> ingredients) {
        super(group, category, result, ingredients);
    }

    @Override
    public ItemStack assemble(CraftingInput input, HolderLookup.Provider registries) {
        ItemStack result = getResultItem(registries);
        Ingredient source = getIngredients().getFirst();
        for (ItemStack stack : input.items()) {
            if (!stack.isEmpty() && source.test(stack)) return stack.transmuteCopy(result.getItem(), result.getCount());
        }
        return result.copy();
    }

    @Override
    public RecipeSerializer<?> getSerializer() {
        return ModRecipes.SHAPELESS_TRANSMUTE.get();
    }

    public static class Serializer implements RecipeSerializer<ShapelessTransmuteRecipe> {
        private static final MapCodec<ShapelessTransmuteRecipe> CODEC = RecordCodecBuilder.mapCodec(instance -> instance.group(
                Codec.STRING.optionalFieldOf("group", "").forGetter(ShapelessRecipe::getGroup),
                CraftingBookCategory.CODEC.fieldOf("category").orElse(CraftingBookCategory.MISC).forGetter(ShapelessRecipe::category),
                ItemStack.STRICT_CODEC.fieldOf("result").forGetter(recipe -> recipe.getResultItem(null)),
                Ingredient.CODEC_NONEMPTY.listOf().fieldOf("ingredients").flatXmap(
                        list -> list.isEmpty() || list.size() > 9
                                ? DataResult.<NonNullList<Ingredient>>error(() -> "A shapeless transmute recipe needs 1 to 9 ingredients")
                                : DataResult.success(NonNullList.of(Ingredient.EMPTY, list.toArray(Ingredient[]::new))),
                        DataResult::success).forGetter(ShapelessRecipe::getIngredients)
        ).apply(instance, ShapelessTransmuteRecipe::new));

        private static final StreamCodec<RegistryFriendlyByteBuf, ShapelessTransmuteRecipe> STREAM_CODEC = StreamCodec.composite(
                ByteBufCodecs.STRING_UTF8, ShapelessRecipe::getGroup,
                CraftingBookCategory.STREAM_CODEC, ShapelessRecipe::category,
                ItemStack.STREAM_CODEC, recipe -> recipe.getResultItem(null),
                Ingredient.CONTENTS_STREAM_CODEC.apply(ByteBufCodecs.list()).map(
                        list -> NonNullList.of(Ingredient.EMPTY, list.toArray(Ingredient[]::new)), list -> list),
                ShapelessRecipe::getIngredients,
                ShapelessTransmuteRecipe::new);

        @Override
        public MapCodec<ShapelessTransmuteRecipe> codec() {
            return CODEC;
        }

        @Override
        public StreamCodec<RegistryFriendlyByteBuf, ShapelessTransmuteRecipe> streamCodec() {
            return STREAM_CODEC;
        }
    }
}
