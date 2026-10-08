package net.lemursaucepacket.nekomasfixed.client;

import com.mojang.blaze3d.vertex.PoseStack;

import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.block.DyedShulkerBoxBlock;
import net.lemursaucepacket.nekomasfixed.block.entity.DyedShulkerBoxBlockEntity;
import net.minecraft.client.model.ShulkerModel;
import net.minecraft.client.model.geom.ModelLayers;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.Sheets;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderer;
import net.minecraft.client.renderer.blockentity.BlockEntityRendererProvider;
import net.minecraft.client.resources.model.Material;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.block.ShulkerBoxBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;

/**
 * Vanilla's shulker box renderer with our textures ({@code textures/entity/shulker/shulker_<colour>.png}, in the
 * shulker box atlas like vanilla's). Vanilla's picks the texture from the box's borrowed DyeColor.
 */
public class DyedShulkerBoxRenderer implements BlockEntityRenderer<DyedShulkerBoxBlockEntity> {
    private final ShulkerModel<?> model;

    public DyedShulkerBoxRenderer(BlockEntityRendererProvider.Context context) {
        this.model = new ShulkerModel<>(context.bakeLayer(ModelLayers.SHULKER));
    }

    @Override
    public void render(DyedShulkerBoxBlockEntity box, float partialTick, PoseStack poseStack, MultiBufferSource buffer, int packedLight, int packedOverlay) {
        Direction facing = Direction.UP;
        if (box.hasLevel()) {
            BlockState state = box.getLevel().getBlockState(box.getBlockPos());
            if (state.getBlock() instanceof ShulkerBoxBlock) facing = state.getValue(ShulkerBoxBlock.FACING);
        }
        String colour = ((DyedShulkerBoxBlock) box.getBlockState().getBlock()).colour().getSerializedName();
        Material material = new Material(Sheets.SHULKER_SHEET, NekomasFixed.id("entity/shulker/shulker_" + colour));

        float progress = box.getProgress(partialTick);
        poseStack.pushPose();
        poseStack.translate(0.5F, 0.5F, 0.5F);
        poseStack.scale(0.9995F, 0.9995F, 0.9995F);
        poseStack.mulPose(facing.getRotation());
        poseStack.scale(1.0F, -1.0F, -1.0F);
        poseStack.translate(0.0F, -1.0F, 0.0F);
        ModelPart lid = model.getLid();
        lid.setPos(0.0F, 24.0F - progress * 0.5F * 16.0F, 0.0F);
        lid.yRot = 270.0F * progress * ((float) Math.PI / 180.0F);
        model.renderToBuffer(poseStack, material.buffer(buffer, RenderType::entityCutoutNoCull), packedLight, packedOverlay);
        poseStack.popPose();
    }

    /** The open lid reaches half a block out, as vanilla allows for. */
    @Override
    public AABB getRenderBoundingBox(DyedShulkerBoxBlockEntity box) {
        BlockPos pos = box.getBlockPos();
        return new AABB(pos.getX() - 0.5, pos.getY() - 0.5, pos.getZ() - 0.5, pos.getX() + 1.5, pos.getY() + 1.5, pos.getZ() + 1.5);
    }
}
