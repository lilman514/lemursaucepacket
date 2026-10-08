package net.lemursaucepacket.nekomasfixed.compat.jei;

import mezz.jei.api.gui.builder.IRecipeLayoutBuilder;
import mezz.jei.api.gui.placement.HorizontalAlignment;
import mezz.jei.api.gui.placement.VerticalAlignment;
import mezz.jei.api.gui.widgets.IRecipeExtrasBuilder;
import mezz.jei.api.helpers.IGuiHelper;
import mezz.jei.api.recipe.IFocusGroup;
import mezz.jei.api.recipe.RecipeType;
import mezz.jei.api.recipe.category.AbstractRecipeCategory;
import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.recipe.KilnRecipe;
import net.lemursaucepacket.nekomasfixed.registry.ModBlocks;
import net.minecraft.client.Minecraft;
import net.minecraft.core.RegistryAccess;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.crafting.RecipeHolder;

/** The kiln's recipes in JEI, laid out like JEI's furnace categories. */
public class KilnRecipeCategory extends AbstractRecipeCategory<RecipeHolder<KilnRecipe>> {
    public static final RecipeType<RecipeHolder<KilnRecipe>> TYPE = RecipeType.createRecipeHolderType(NekomasFixed.id("kiln"));
    private static final int GREY = 0xFF808080;

    public KilnRecipeCategory(IGuiHelper gui) {
        super(TYPE, Component.translatable("block.nekomasfixed.kiln"), gui.createDrawableItemLike(ModBlocks.KILN.get()), 82, 54);
    }

    @Override
    public void setRecipe(IRecipeLayoutBuilder builder, RecipeHolder<KilnRecipe> holder, IFocusGroup focuses) {
        KilnRecipe recipe = holder.value();
        RegistryAccess registries = Minecraft.getInstance().level == null ? RegistryAccess.EMPTY : Minecraft.getInstance().level.registryAccess();
        builder.addInputSlot(1, 1).setStandardSlotBackground().addIngredients(recipe.getIngredients().getFirst());
        builder.addOutputSlot(61, 19).setOutputSlotBackground().addItemStack(recipe.getResultItem(registries));
    }

    @Override
    public void createRecipeExtras(IRecipeExtrasBuilder builder, RecipeHolder<KilnRecipe> holder, IFocusGroup focuses) {
        KilnRecipe recipe = holder.value();
        builder.addAnimatedRecipeFlameWidget(300).setPosition(1, 20);
        builder.addAnimatedRecipeArrowWidget(recipe.getCookingTime()).setPosition(26, 17);
        if (recipe.getExperience() > 0) {
            builder.addText(Component.translatable("gui.jei.category.smelting.experience", recipe.getExperience()), getWidth() - 20, 10)
                    .setPosition(0, 0, getWidth(), getHeight(), HorizontalAlignment.RIGHT, VerticalAlignment.TOP)
                    .setColor(GREY);
        }
        builder.addText(Component.translatable("gui.jei.category.smelting.time.seconds", recipe.getCookingTime() / 20), getWidth() - 20, 10)
                .setPosition(0, 0, getWidth(), getHeight(), HorizontalAlignment.RIGHT, VerticalAlignment.BOTTOM)
                .setColor(GREY);
    }
}
