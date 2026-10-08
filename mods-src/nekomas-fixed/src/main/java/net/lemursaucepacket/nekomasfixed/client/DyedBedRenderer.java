package net.lemursaucepacket.nekomasfixed.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;

import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.block.DyedBedBlock;
import net.lemursaucepacket.nekomasfixed.block.entity.DyedBedBlockEntity;
import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.minecraft.client.model.geom.ModelLayers;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.Sheets;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderer;
import net.minecraft.client.renderer.blockentity.BlockEntityRendererProvider;
import net.minecraft.client.renderer.blockentity.BrightnessCombiner;
import net.minecraft.client.resources.model.Material;
import net.minecraft.core.Direction;
import net.minecraft.world.level.block.BedBlock;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.DoubleBlockCombiner;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.BedPart;

/**
 * Vanilla's bed renderer with our bed textures ({@code textures/entity/bed/<colour>.png}, stitched into the bed atlas
 * like vanilla's). Vanilla's picks the texture from the DyeColor, which for our beds is only borrowed.
 */
public class DyedBedRenderer implements BlockEntityRenderer<DyedBedBlockEntity> {
    private final ModelPart headRoot;
    private final ModelPart footRoot;

    public DyedBedRenderer(BlockEntityRendererProvider.Context context) {
        this.headRoot = context.bakeLayer(ModelLayers.BED_HEAD);
        this.footRoot = context.bakeLayer(ModelLayers.BED_FOOT);
    }

    static Material material(BlockState state) {
        String colour = ((DyedBedBlock) state.getBlock()).colour().getSerializedName();
        return new Material(Sheets.BED_SHEET, NekomasFixed.id("entity/bed/" + colour));
    }

    @Override
    public void render(DyedBedBlockEntity bed, float partialTick, PoseStack poseStack, MultiBufferSource buffer, int packedLight, int packedOverlay) {
        BlockState state = bed.getBlockState();
        Material material = material(state);
        if (bed.getLevel() == null) {
            // An item (see DyedBlockItemRenderer): both halves, facing south.
            renderPiece(poseStack, buffer, headRoot, Direction.SOUTH, material, packedLight, packedOverlay, false);
            renderPiece(poseStack, buffer, footRoot, Direction.SOUTH, material, packedLight, packedOverlay, true);
            return;
        }
        // Light the bed as one piece, from both halves (as vanilla does).
        int light = DoubleBlockCombiner.combineWithNeigbour(ModBlockEntities.BED.get(), BedBlock::getBlockType, BedBlock::getConnectedDirection,
                        ChestBlock.FACING, state, bed.getLevel(), bed.getBlockPos(), (level, pos) -> false)
                .apply(new BrightnessCombiner<>()).get(packedLight);
        ModelPart part = state.getValue(BedBlock.PART) == BedPart.HEAD ? headRoot : footRoot;
        renderPiece(poseStack, buffer, part, state.getValue(BedBlock.FACING), material, light, packedOverlay, false);
    }

    private static void renderPiece(PoseStack poseStack, MultiBufferSource buffer, ModelPart part, Direction facing, Material material,
                                    int packedLight, int packedOverlay, boolean foot) {
        poseStack.pushPose();
        poseStack.translate(0.0F, 0.5625F, foot ? -1.0F : 0.0F);
        poseStack.mulPose(Axis.XP.rotationDegrees(90.0F));
        poseStack.translate(0.5F, 0.5F, 0.5F);
        poseStack.mulPose(Axis.ZP.rotationDegrees(180.0F + facing.toYRot()));
        poseStack.translate(-0.5F, -0.5F, -0.5F);
        part.render(poseStack, material.buffer(buffer, RenderType::entitySolid), packedLight, packedOverlay);
        poseStack.popPose();
    }
}
