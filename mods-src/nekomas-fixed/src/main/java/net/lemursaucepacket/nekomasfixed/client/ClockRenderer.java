package net.lemursaucepacket.nekomasfixed.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;

import it.unimi.dsi.fastutil.HashCommon;
import net.lemursaucepacket.nekomasfixed.block.FloorClockBlock;
import net.lemursaucepacket.nekomasfixed.block.WallClockBlock;
import net.lemursaucepacket.nekomasfixed.block.entity.ClockBlockEntity;
import net.lemursaucepacket.nekomasfixed.clock.StoredTime;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderer;
import net.minecraft.client.renderer.blockentity.BlockEntityRendererProvider;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.ItemDisplayContext;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.RotationSegment;
import net.minecraft.world.phys.AABB;

/**
 * Draws a placed clock from items, as upstream does: the vanilla clock (its face animates with the time of day), a
 * spruce fence gate as the stand and a bell on alarm clocks. Above it floats the HH:MM label or the alarm countdown,
 * and a ringing floor clock shakes.
 */
public class ClockRenderer implements BlockEntityRenderer<ClockBlockEntity> {
    private static final ItemStack CLOCK = new ItemStack(Items.CLOCK);
    private static final ItemStack STAND = new ItemStack(Items.SPRUCE_FENCE_GATE);
    private static final ItemStack BELL = new ItemStack(Items.BELL);

    public ClockRenderer(BlockEntityRendererProvider.Context context) {
    }

    @Override
    public void render(ClockBlockEntity clock, float partialTick, PoseStack poseStack, MultiBufferSource buffer, int packedLight, int packedOverlay) {
        BlockState state = clock.getBlockState();
        boolean wall = state.getBlock() instanceof WallClockBlock;
        float yaw = wall
                ? RotationSegment.convertToDegrees(RotationSegment.convertToSegment(state.getValue(WallClockBlock.FACING).getOpposite()))
                : RotationSegment.convertToDegrees(state.getValue(FloorClockBlock.ROTATION));
        int seed = HashCommon.long2int(clock.getBlockPos().asLong());

        poseStack.pushPose();
        Component label = label(clock);
        if (label != null) renderLabel(label, wall, yaw, poseStack, buffer, packedLight);

        poseStack.translate(0.5F, 0.5F, 0.5F);
        int timer = clock.getTimer();
        if (!wall && timer > ClockBlockEntity.IDLE && timer < 0) {
            poseStack.mulPose(Axis.YP.rotationDegrees(timer % 2 == 0 ? 10 : -10)); // ringing
        }

        // The face. Rendering it for the player makes the vanilla clock's "time" property tick (it shows 12:00 without an entity).
        poseStack.pushPose();
        poseStack.mulPose(Axis.YP.rotationDegrees(-yaw));
        poseStack.translate(0.0F, wall ? 0.0F : -0.15F, wall ? 0.46875F : -0.1F);
        if (!wall) poseStack.mulPose(Axis.XP.rotationDegrees(30));
        float scale = wall ? 1.0F : 0.8F;
        poseStack.scale(scale, scale, scale);
        Minecraft minecraft = Minecraft.getInstance();
        minecraft.getItemRenderer().renderStatic(minecraft.player, CLOCK, ItemDisplayContext.FIXED, false, poseStack, buffer,
                clock.getLevel(), packedLight, packedOverlay, seed);
        poseStack.popPose();

        if (!wall) {
            poseStack.pushPose();
            poseStack.mulPose(Axis.YP.rotationDegrees(-yaw));
            poseStack.translate(0.0F, -0.35F, 0.2F);
            poseStack.mulPose(Axis.XP.rotationDegrees(-30));
            poseStack.scale(1.0F, 1.6F, 1.0F);
            renderItem(STAND, clock, poseStack, buffer, packedLight, packedOverlay, seed + 1);
            poseStack.popPose();

            if (clock.hasBell()) {
                poseStack.pushPose();
                poseStack.mulPose(Axis.YP.rotationDegrees(-yaw));
                poseStack.translate(0.0F, 0.35F, 0.1F);
                poseStack.mulPose(Axis.ZP.rotationDegrees(180));
                poseStack.scale(0.5F, 0.5F, 0.5F);
                renderItem(BELL, clock, poseStack, buffer, packedLight, packedOverlay, seed + 1);
                poseStack.popPose();
            }
        }
        poseStack.popPose();
    }

    /** The time of day when the label is on, else the alarm countdown while it runs, else nothing. */
    private static Component label(ClockBlockEntity clock) {
        if (clock.showsTime() && !clock.hasBell() && clock.getLevel() != null) {
            return Component.literal(StoredTime.format(StoredTime.timeOfDay(clock.getLevel())));
        }
        int timer = clock.getTimer();
        if (timer <= 0) return null;
        int seconds = (timer + 19) / 20; // rounded up, so it reads 0:01 until it rings
        return Component.translatable("block.nekomasfixed.clock.alarm", String.format("%d:%02d", seconds / 60, seconds % 60));
    }

    private static void renderLabel(Component label, boolean wall, float yaw, PoseStack poseStack, MultiBufferSource buffer, int packedLight) {
        double radians = Math.toRadians(yaw);
        poseStack.pushPose();
        if (wall) {
            poseStack.translate(-0.4 * Math.sin(radians) + 0.5, 1.0, 0.4 * Math.cos(radians) + 0.5);
        } else {
            poseStack.translate(0.5, 1.0, 0.5);
        }
        // Face the camera, like a name tag.
        poseStack.mulPose(Minecraft.getInstance().getEntityRenderDispatcher().cameraOrientation());
        poseStack.scale(0.025F, -0.025F, 0.025F);
        Font font = Minecraft.getInstance().font;
        font.drawInBatch(label, -font.width(label) / 2.0F, 0.0F, 0xFFFFFFFF, true, poseStack.last().pose(), buffer,
                Font.DisplayMode.NORMAL, 0, packedLight);
        poseStack.popPose();
    }

    private static void renderItem(ItemStack stack, ClockBlockEntity clock, PoseStack poseStack, MultiBufferSource buffer, int packedLight, int packedOverlay, int seed) {
        Minecraft.getInstance().getItemRenderer().renderStatic(stack, ItemDisplayContext.FIXED, packedLight, packedOverlay, poseStack, buffer,
                clock.getLevel(), seed);
    }

    /** Taller than the block, for the label above it. */
    @Override
    public AABB getRenderBoundingBox(ClockBlockEntity clock) {
        return new AABB(clock.getBlockPos()).expandTowards(0.0, 1.0, 0.0);
    }
}
