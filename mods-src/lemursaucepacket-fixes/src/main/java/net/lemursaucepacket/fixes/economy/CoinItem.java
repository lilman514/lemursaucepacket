package net.lemursaucepacket.fixes.economy;

import java.util.List;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.SlotAccess;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.ClickAction;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;

/**
 * Gold Coins: one stack of any size (see {@link Coins}). In a container, clicking coins onto coins merges them; right-click
 * puts down or picks up one coin, and right-click with an empty hand takes half. The client shows the amount compactly in
 * the slot (2.3k) and exactly in the tooltip.
 */
public class CoinItem extends Item {
    public CoinItem(Properties properties) {
        super(properties);
    }

    @Override
    public Component getName(ItemStack stack) {
        return Component.translatable(getDescriptionId(stack)).withStyle(ChatFormatting.GOLD);
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, List<Component> tooltip, TooltipFlag flag) {
        long amount = Coins.value(stack);
        tooltip.add(Component.literal("Amount: ").withStyle(ChatFormatting.GRAY).append(Component.literal(Coins.exact(amount)).withStyle(ChatFormatting.GOLD)));
        tooltip.add(Component.empty());
        tooltip.add(Component.literal("The coin of the realm. Every vendor").withStyle(ChatFormatting.GRAY));
        tooltip.add(Component.literal("takes it, and buys anything for it.").withStyle(ChatFormatting.GRAY));
        tooltip.add(Component.empty());
        tooltip.add(Component.literal("Right-click: take half").withStyle(ChatFormatting.DARK_GRAY));
        tooltip.add(Component.literal("Shift + right-click: take an exact amount").withStyle(ChatFormatting.DARK_GRAY));
    }

    /** These coins are carried and clicked onto a slot. */
    @Override
    public boolean overrideStackedOnOther(ItemStack carried, Slot slot, ClickAction action, Player player) {
        if (!slot.allowModification(player)) return false;
        ItemStack target = slot.getItem();
        long have = Coins.value(carried);
        if (target.isEmpty()) {
            // Right-click on an empty slot puts down one coin (vanilla would put the whole stack, since it is one item).
            if (action != ClickAction.SECONDARY || have <= 1 || !slot.mayPlace(carried)) return false;
            slot.setByPlayer(Coins.stack(1));
            Coins.set(carried, have - 1);
            return true;
        }
        if (!Coins.is(target) || !slot.mayPlace(carried)) return false;
        long there = Coins.value(target);
        if (action == ClickAction.PRIMARY) {
            slot.setByPlayer(Coins.stack(there + have));
            Coins.set(carried, 0);
        } else {
            slot.setByPlayer(Coins.stack(there + 1));
            Coins.set(carried, have - 1);
        }
        return true;
    }

    /** Something (or nothing) is clicked onto these coins in a slot. */
    @Override
    public boolean overrideOtherStackedOnMe(ItemStack mine, ItemStack other, Slot slot, ClickAction action, Player player, SlotAccess carried) {
        if (!other.isEmpty() || action != ClickAction.SECONDARY || !slot.allowModification(player) || !slot.mayPickup(player)) return false;
        long have = Coins.value(mine);
        if (have <= 1) return false;
        // Take half, rounded up like vanilla.
        long take = (have + 1) / 2;
        slot.setByPlayer(Coins.stack(have - take));
        carried.set(Coins.stack(take));
        return true;
    }
}
