package net.lemursaucepacket.fixes.capes.client;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;

import net.minecraft.client.model.ArmorStandArmorModel;
import net.minecraft.client.model.geom.EntityModelSet;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

/**
 * A cape hanging from an armor stand's shoulders: the vanilla cape's box and texture layout (64x32), still, following the
 * stand's body pose, a little further out over a chestplate. Not over an elytra, as on a player.
 */
final class StandCapeLayer extends RenderLayer<ArmorStand, ArmorStandArmorModel> {
    private final ModelPart cape;

    StandCapeLayer(RenderLayerParent<ArmorStand, ArmorStandArmorModel> parent, EntityModelSet models) {
        super(parent);
        this.cape = models.bakeLayer(CapesClient.STAND_CAPE).getChild("cape");
    }

    static LayerDefinition createLayer() {
        MeshDefinition mesh = new MeshDefinition();
        mesh.getRoot().addOrReplaceChild("cape", CubeListBuilder.create().texOffs(0, 0).addBox(-5.0F, 0.0F, -1.0F, 10.0F, 16.0F, 1.0F), PartPose.ZERO);
        return LayerDefinition.create(mesh, 64, 32);
    }

    @Override
    public void render(PoseStack pose, MultiBufferSource buffers, int light, ArmorStand stand, float limbSwing, float limbSwingAmount, float partialTick,
            float ageInTicks, float netHeadYaw, float headPitch) {
        ResourceLocation texture = CapesClient.standCape(stand);
        if (texture == null) return;
        ItemStack chest = stand.getItemBySlot(EquipmentSlot.CHEST);
        if (chest.is(Items.ELYTRA)) return;
        pose.pushPose();
        if (getParentModel().young) {
            // A small stand: the body as the model draws it (HumanoidModel's baby body).
            pose.scale(0.5F, 0.5F, 0.5F);
            pose.translate(0.0F, 1.5F, 0.0F);
        }
        getParentModel().body.translateAndRotate(pose);
        pose.translate(0.0F, chest.isEmpty() ? 0.0F : -0.053125F, chest.isEmpty() ? 0.125F : 0.1875F);
        pose.mulPose(Axis.XP.rotationDegrees(6.0F));
        pose.mulPose(Axis.YP.rotationDegrees(180.0F));
        cape.render(pose, buffers.getBuffer(RenderType.entitySolid(texture)), light, OverlayTexture.NO_OVERLAY);
        pose.popPose();
    }
}
