package net.lemursaucepacket.fixes.xpbank;

import java.util.List;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;

/** An XP Bank upgrade: used on a placed bank of the tier below, it makes it this tier (XpBankBlock.useItemOn). */
public class XpBankUpgradeItem extends Item {
    private final int tier;

    public XpBankUpgradeItem(int tier, Properties properties) {
        super(properties);
        this.tier = tier;
    }

    public int tier() {
        return tier;
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, List<Component> tooltip, TooltipFlag flag) {
        tooltip.add(Component.translatable("item.lsp_fixes.xp_bank_upgrade.tooltip", XpBanks.tierName(tier - 1), XpBanks.tierName(tier), XpBanks.percent(tier))
                .withStyle(ChatFormatting.GRAY));
    }
}
