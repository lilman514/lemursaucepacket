package net.lemursaucepacket.nekomasfixed.client;

import java.util.HashMap;
import java.util.Map;

import com.mojang.blaze3d.vertex.PoseStack;

import net.lemursaucepacket.nekomasfixed.block.DyedBedBlock;
import net.lemursaucepacket.nekomasfixed.block.DyedShulkerBoxBlock;
import net.lemursaucepacket.nekomasfixed.block.entity.DyedBedBlockEntity;
import net.lemursaucepacket.nekomasfixed.block.entity.DyedShulkerBoxBlockEntity;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.BlockEntityWithoutLevelRenderer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.core.BlockPos;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemDisplayContext;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;

/**
 * Draws the new beds and shulker boxes as items (their item models are {@code builtin/entity}, like vanilla's).
 * Vanilla's item renderer would draw them with their borrowed DyeColor; this one renders a display block entity of
 * our own through our block entity renderers.
 */
public class DyedBlockItemRenderer extends BlockEntityWithoutLevelRenderer {
    private final Map<Item, BlockEntity> displays = new HashMap<>();

    public DyedBlockItemRenderer() {
        super(Minecraft.getInstance().getBlockEntityRenderDispatcher(), Minecraft.getInstance().getEntityModels());
    }

    @Override
    public void renderByItem(ItemStack stack, ItemDisplayContext context, PoseStack poseStack, MultiBufferSource buffer, int packedLight, int packedOverlay) {
        BlockEntity display = displays.computeIfAbsent(stack.getItem(), DyedBlockItemRenderer::display);
        if (display != null) Minecraft.getInstance().getBlockEntityRenderDispatcher().renderItem(display, poseStack, buffer, packedLight, packedOverlay);
    }

    private static BlockEntity display(Item item) {
        Block block = Block.byItem(item);
        if (block instanceof DyedBedBlock) return new DyedBedBlockEntity(BlockPos.ZERO, block.defaultBlockState());
        if (block instanceof DyedShulkerBoxBlock) return new DyedShulkerBoxBlockEntity(BlockPos.ZERO, block.defaultBlockState());
        return null;
    }
}
