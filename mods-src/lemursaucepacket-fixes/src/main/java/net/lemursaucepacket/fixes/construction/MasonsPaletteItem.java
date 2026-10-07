package net.lemursaucepacket.fixes.construction;

import java.util.List;

import net.minecraft.ChatFormatting;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.level.Level;

/**
 * The Mason's Palette, the Construction Cape's: right-click a block to place the chosen block there without using any
 * up, right-click the air to choose, pick-block (middle-click) a block to choose that one. Construction 99 to use.
 * The server does the placing ({@link Palette}).
 */
public class MasonsPaletteItem extends Item {
    public MasonsPaletteItem(Properties properties) {
        super(properties);
    }

    @Override
    public InteractionResult useOn(UseOnContext ctx) {
        if (ctx.getPlayer() == null) return InteractionResult.PASS;
        if (ctx.getLevel().isClientSide()) return InteractionResult.SUCCESS;
        return Palette.place((ServerPlayer) ctx.getPlayer(), ctx);
    }

    @Override
    public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
        if (!level.isClientSide()) Palette.open((ServerPlayer) player);
        return InteractionResultHolder.sidedSuccess(player.getItemInHand(hand), level.isClientSide());
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, List<Component> lines, TooltipFlag flag) {
        ResourceLocation id = stack.get(ConstructionModule.PALETTE_BLOCK.get());
        var block = id == null ? null : BuiltInRegistries.BLOCK.getOptional(id).orElse(null);
        lines.add(block == null ? Component.literal("No block chosen yet").withStyle(ChatFormatting.GRAY)
                : Component.literal("Places ").withStyle(ChatFormatting.GRAY).append(block.getName().copy().withStyle(ChatFormatting.GOLD)));
        lines.add(Component.literal("Right-click a block: place one, using none up").withStyle(ChatFormatting.DARK_GRAY));
        lines.add(Component.literal("Right-click the air: choose a block").withStyle(ChatFormatting.DARK_GRAY));
        lines.add(Component.literal("Middle-click a block: choose that kind").withStyle(ChatFormatting.DARK_GRAY));
        lines.add(Component.literal("Needs Construction " + BuildRules.paletteLevel() + ". What it places drops nothing.").withStyle(ChatFormatting.DARK_GRAY));
    }
}
