package net.lemursaucepacket.nekomasfixed.menu;

import net.lemursaucepacket.nekomasfixed.registry.ModMenus;
import net.lemursaucepacket.nekomasfixed.registry.ModRecipes;
import net.minecraft.world.Container;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.AbstractFurnaceMenu;
import net.minecraft.world.inventory.ContainerData;
import net.minecraft.world.inventory.RecipeBookType;

/**
 * The kiln's container: the furnace layout and slot rules, fed kiln recipes. The kiln has no recipe book (its screen
 * shows no book button), so the book type passed here is never used; its recipes show in JEI instead.
 */
public class KilnMenu extends AbstractFurnaceMenu {
    /** The client side, opened from the server's menu packet. */
    public KilnMenu(int id, Inventory inventory) {
        super(ModMenus.KILN.get(), ModRecipes.KILN.get(), RecipeBookType.FURNACE, id, inventory);
    }

    public KilnMenu(int id, Inventory inventory, Container kiln, ContainerData data) {
        super(ModMenus.KILN.get(), ModRecipes.KILN.get(), RecipeBookType.FURNACE, id, inventory, kiln, data);
    }
}
