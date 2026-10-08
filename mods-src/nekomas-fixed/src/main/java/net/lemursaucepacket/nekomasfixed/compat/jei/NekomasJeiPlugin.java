package net.lemursaucepacket.nekomasfixed.compat.jei;

import mezz.jei.api.IModPlugin;
import mezz.jei.api.JeiPlugin;
import mezz.jei.api.registration.IGuiHandlerRegistration;
import mezz.jei.api.registration.IRecipeCatalystRegistration;
import mezz.jei.api.registration.IRecipeCategoryRegistration;
import mezz.jei.api.registration.IRecipeRegistration;
import mezz.jei.api.registration.IRecipeTransferRegistration;
import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.client.KilnScreen;
import net.lemursaucepacket.nekomasfixed.menu.KilnMenu;
import net.lemursaucepacket.nekomasfixed.registry.ModBlocks;
import net.lemursaucepacket.nekomasfixed.registry.ModMenus;
import net.lemursaucepacket.nekomasfixed.registry.ModRecipes;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.ResourceLocation;

/**
 * JEI support: a category for kiln recipes (the kiln has no recipe book), the kiln as its catalyst, the arrow in the
 * kiln screen as a shortcut to it, and moving ingredients in. Only JEI loads this class.
 */
@JeiPlugin
public class NekomasJeiPlugin implements IModPlugin {
    @Override
    public ResourceLocation getPluginUid() {
        return NekomasFixed.id("jei");
    }

    @Override
    public void registerCategories(IRecipeCategoryRegistration registration) {
        registration.addRecipeCategories(new KilnRecipeCategory(registration.getJeiHelpers().getGuiHelper()));
    }

    @Override
    public void registerRecipes(IRecipeRegistration registration) {
        if (Minecraft.getInstance().level == null) return;
        registration.addRecipes(KilnRecipeCategory.TYPE, Minecraft.getInstance().level.getRecipeManager().getAllRecipesFor(ModRecipes.KILN.get()));
    }

    @Override
    public void registerRecipeCatalysts(IRecipeCatalystRegistration registration) {
        registration.addRecipeCatalyst(ModBlocks.KILN.get(), KilnRecipeCategory.TYPE);
    }

    @Override
    public void registerGuiHandlers(IGuiHandlerRegistration registration) {
        registration.addRecipeClickArea(KilnScreen.class, 78, 32, 28, 23, KilnRecipeCategory.TYPE);
    }

    @Override
    public void registerRecipeTransferHandlers(IRecipeTransferRegistration registration) {
        // Furnace layout: slot 0 is the input, then 1 fuel, 2 result, and the player's 36 slots from 3.
        registration.addRecipeTransferHandler(KilnMenu.class, ModMenus.KILN.get(), KilnRecipeCategory.TYPE, 0, 1, 3, 36);
    }
}
