package net.lemursaucepacket.fixes.xpbank;

import java.util.List;

import net.lemursaucepacket.fixes.skills.MachineXp;
import net.minecraft.ChatFormatting;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.component.BlockItemStateProperties;
import net.minecraft.world.level.block.Block;

/** The XP Bank's item: named and drawn by the tier its block state component carries (a broken bank keeps its tier). */
public class XpBankItem extends BlockItem {
    public XpBankItem(Block block, Properties properties) {
        super(block, properties);
    }

    /** The tier this item places (1 unless a broken upgraded bank's). */
    public static int tierOf(ItemStack stack) {
        BlockItemStateProperties props = stack.get(DataComponents.BLOCK_STATE);
        if (props == null) return 1;
        Integer tier = props.get(XpBankBlock.TIER);
        return tier == null ? 1 : tier;
    }

    public static boolean holdsXp(ItemStack stack) {
        BankedXp banked = stack.get(XpBankModule.BANKED.get());
        return banked != null && !banked.isEmpty();
    }

    @Override
    public Component getName(ItemStack stack) {
        int tier = tierOf(stack);
        return tier <= 1 ? super.getName(stack) : Component.translatable("block.lsp_fixes.xp_bank.tier", super.getName(stack), XpBanks.tierName(tier));
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, List<Component> tooltip, TooltipFlag flag) {
        int tier = tierOf(stack);
        tooltip.add(Component.translatable("block.lsp_fixes.xp_bank.tooltip", XpBanks.percent(tier), MachineXp.rules().bankRange(),
                Math.round(MachineXp.rules().playerRange())).withStyle(ChatFormatting.GRAY));
        BankedXp banked = stack.get(XpBankModule.BANKED.get());
        if (banked != null && !banked.isEmpty()) {
            tooltip.add(Component.translatable("block.lsp_fixes.xp_bank.holds", XpBanks.list(banked.payout(banked.topTier()))).withStyle(ChatFormatting.GREEN));
        }
    }
}
