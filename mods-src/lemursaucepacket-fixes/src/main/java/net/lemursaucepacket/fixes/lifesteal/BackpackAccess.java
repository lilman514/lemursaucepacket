package net.lemursaucepacket.fixes.lifesteal;

import javax.annotation.Nullable;

import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.items.IItemHandler;
import net.p3pp3rf1y.sophisticatedbackpacks.backpack.BackpackItem;
import net.p3pp3rf1y.sophisticatedbackpacks.backpack.wrapper.BackpackWrapper;

/** Sophisticated Backpacks: only loaded when that mod is (callers check {@code ModList}). */
final class BackpackAccess {
    static boolean isBackpack(ItemStack stack) {
        return stack.getItem() instanceof BackpackItem;
    }

    /** The backpack's main inventory, straight from its world storage. */
    @Nullable
    static IItemHandler contents(ItemStack stack) {
        try {
            return BackpackWrapper.fromStack(stack).getInventoryHandler();
        } catch (Exception e) {
            LifestealModule.LOGGER.warn("Backpack contents unreadable: {}", e.toString());
            return null;
        }
    }

    private BackpackAccess() {
    }
}
