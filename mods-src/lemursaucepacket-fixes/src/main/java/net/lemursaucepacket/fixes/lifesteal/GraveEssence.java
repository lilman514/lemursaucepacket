package net.lemursaucepacket.fixes.lifesteal;

import java.util.ArrayList;
import java.util.List;

import de.maxhenkel.gravestone.corelib.death.Death;
import net.minecraft.ChatFormatting;
import net.minecraft.core.NonNullList;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.items.IItemHandler;

/**
 * A grave costs a Grave Essence. Called from {@code DeathEventsMixin} at the head of the Gravestone mod's
 * grave handler, when the player's drops have already been gathered into the {@link Death}: the essence is
 * looked for in those (inventory, armour, off-hand, Curios) and inside any backpack among them, and one is
 * used up. Only loaded when the Gravestone mod is (the mixin plugin gates the mixin).
 */
public final class GraveEssence {
    public static final ResourceLocation ITEM = ResourceLocation.fromNamespaceAndPath("lemursaucepacket", "grave_essence");

    /** True when the grave may be placed (an essence was found and taken). */
    public static boolean allowGrave(Death death, ServerPlayer player) {
        if (!LifestealConfig.GRAVES_REQUIRE_ESSENCE.get()) return true;
        List<NonNullList<ItemStack>> lists = new ArrayList<>();
        lists.add(death.getMainInventory());
        lists.add(death.getArmorInventory());
        lists.add(death.getOffHandInventory());
        lists.add(death.getAdditionalItems());
        lists.add(death.getEquipment());
        for (NonNullList<ItemStack> list : lists) {
            if (list == null) continue;
            for (ItemStack stack : list) {
                if (isEssence(stack)) {
                    stack.shrink(1);
                    tell(player, true);
                    return true;
                }
            }
        }
        if (ModList.get().isLoaded("sophisticatedbackpacks")) {
            for (NonNullList<ItemStack> list : lists) {
                if (list == null) continue;
                for (ItemStack stack : list) {
                    if (!BackpackAccess.isBackpack(stack)) continue;
                    IItemHandler contents = BackpackAccess.contents(stack);
                    if (contents == null) continue;
                    for (int i = 0; i < contents.getSlots(); i++) {
                        if (isEssence(contents.getStackInSlot(i))) {
                            contents.extractItem(i, 1, false);
                            tell(player, true);
                            return true;
                        }
                    }
                }
            }
        }
        tell(player, false);
        LifestealModule.LOGGER.info("No grave for {}: no Grave Essence", player.getGameProfile().getName());
        return false;
    }

    private static boolean isEssence(ItemStack stack) {
        return !stack.isEmpty() && BuiltInRegistries.ITEM.getKey(stack.getItem()).equals(ITEM);
    }

    private static void tell(ServerPlayer player, boolean grave) {
        player.sendSystemMessage(grave
                ? Component.literal("A Grave Essence was used: your items wait in a grave.").withStyle(ChatFormatting.GRAY)
                : Component.literal("No Grave Essence: your items are on the ground where you died.").withStyle(ChatFormatting.RED));
    }

    private GraveEssence() {
    }
}
