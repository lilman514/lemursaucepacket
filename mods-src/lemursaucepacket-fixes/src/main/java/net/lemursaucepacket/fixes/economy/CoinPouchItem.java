package net.lemursaucepacket.fixes.economy;

import java.util.List;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.level.Level;

/** A Coin Pouch, as Brassworks missions pay: right-click opens the whole stack into Gold Coins. They stack, so mission rerolls (paid in pouches) still work. */
public class CoinPouchItem extends Item {
    public CoinPouchItem(Properties properties) {
        super(properties);
    }

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);
        if (!level.isClientSide) {
            int pouches = stack.getCount();
            long coins = pouches * Coins.POUCH_COINS;
            stack.setCount(0);
            Coins.give(player, coins);
            player.displayClientMessage(Component.literal("You open " + (pouches == 1 ? "the pouch" : pouches + " pouches") + ": ").withStyle(ChatFormatting.GRAY).append(Coins.text(coins)), true);
            level.playSound(null, player.blockPosition(), SoundEvents.ARMOR_EQUIP_LEATHER.value(), SoundSource.PLAYERS, 0.8f, 1.2f);
            Coins.coinSound(player);
        }
        return InteractionResultHolder.sidedSuccess(stack, level.isClientSide);
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, List<Component> tooltip, TooltipFlag flag) {
        tooltip.add(Component.literal("Holds ").withStyle(ChatFormatting.GRAY).append(Coins.text(Coins.POUCH_COINS)).append(Component.literal(".").withStyle(ChatFormatting.GRAY)));
        tooltip.add(Component.literal("Right-click to open the stack.").withStyle(ChatFormatting.DARK_GRAY));
        if (stack.getCount() > 1) tooltip.add(Component.literal("This stack: ").withStyle(ChatFormatting.DARK_GRAY).append(Coins.text(stack.getCount() * Coins.POUCH_COINS)));
    }
}
