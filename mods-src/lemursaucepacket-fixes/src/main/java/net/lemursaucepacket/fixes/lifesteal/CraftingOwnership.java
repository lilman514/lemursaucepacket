package net.lemursaucepacket.fixes.lifesteal;

import java.util.function.BiConsumer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;

/** Server scripts supply their existing ownership policy, including its reloadable config and exclusions. */
public final class CraftingOwnership {
    private static BiConsumer<ItemStack, Player> stamper;

    public static void setStamper(BiConsumer<ItemStack, Player> policy) {
        stamper = policy;
    }

    public static void prepare(ItemStack stack, Player player) {
        if (!stack.isEmpty() && !player.level().isClientSide && stamper != null) stamper.accept(stack, player);
    }

    private CraftingOwnership() {}
}
