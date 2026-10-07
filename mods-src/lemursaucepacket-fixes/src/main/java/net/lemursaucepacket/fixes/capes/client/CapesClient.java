package net.lemursaucepacket.fixes.capes.client;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.LspFixes;
import net.lemursaucepacket.fixes.capes.CapeDefs;
import net.lemursaucepacket.fixes.capes.CapeNet;
import net.lemursaucepacket.fixes.capes.Capes;
import net.lemursaucepacket.fixes.capes.CapesModule;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.model.geom.ModelLayerLocation;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.renderer.entity.ArmorStandRenderer;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.decoration.ArmorStand;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.entity.player.ItemTooltipEvent;

/**
 * The client side of capes: the collection screen, what a cape item's tooltip says, and which texture to draw where a
 * player's vanilla cape goes (the cape in their Curios slot, if its "show" toggle is on) or on an armor stand.
 */
public final class CapesClient {
    public static final ModelLayerLocation STAND_CAPE = new ModelLayerLocation(ResourceLocation.fromNamespaceAndPath(LspFixes.MOD_ID, "stand_cape"), "main");

    public static void init(IEventBus modBus) {
        modBus.addListener((EntityRenderersEvent.RegisterLayerDefinitions e) -> e.registerLayerDefinition(STAND_CAPE, StandCapeLayer::createLayer));
        modBus.addListener((EntityRenderersEvent.AddLayers e) -> {
            if (CapesModule.CURIOS && e.getRenderer(EntityType.ARMOR_STAND) instanceof ArmorStandRenderer stand)
                stand.addLayer(new StandCapeLayer(stand, e.getEntityModels()));
        });
        NeoForge.EVENT_BUS.addListener(CapesClient::onTooltip);
        NeoForge.EVENT_BUS.addListener((ClientPlayerNetworkEvent.LoggingOut e) -> {
            Capes.CLIENT.unlocked.clear();
            Capes.CLIENT.flags.clear();
        });
    }

    public static void open(CapeNet.Open payload) {
        Minecraft.getInstance().setScreen(new CapeCollectionScreen(payload.npc(), payload.npcId()));
    }

    /** The texture for a player's cape right now (the frame, for an animated one), or null for none: {@code mixin.CapeSkinMixin}. */
    @Nullable
    public static ResourceLocation playerCape(AbstractClientPlayer p) {
        return capeOn(p);
    }

    @Nullable
    static ResourceLocation standCape(ArmorStand stand) {
        return capeOn(stand);
    }

    @Nullable
    private static ResourceLocation capeOn(LivingEntity e) {
        if (!CapesModule.CURIOS || !Capes.shown(e)) return null;
        CapeDefs.Def def = CapeDefs.of(Capes.wornStack(e));
        return def == null ? null : def.texture(e.level().getGameTime());
    }

    private static void onTooltip(ItemTooltipEvent e) {
        CapeDefs.Def def = CapeDefs.of(e.getItemStack());
        if (def == null) return;
        var lines = e.getToolTip();
        int at = Math.min(1, lines.size());
        lines.add(at++, Component.literal(kindName(def.kind())).withStyle(ChatFormatting.GOLD));
        if (def.perkText() != null) lines.add(at++, Component.literal("Perk: " + def.perkText()).withStyle(ChatFormatting.AQUA));
        if (e.getEntity() != null && !Capes.CLIENT.unlocked.contains(def.id())) {
            lines.add(at++, Component.literal("You haven't earned it: " + def.description()).withStyle(ChatFormatting.RED));
            lines.add(at++, Component.literal("It can still go on an armor stand.").withStyle(ChatFormatting.DARK_GRAY));
        } else {
            lines.add(at++, Component.literal("Right-click to wear it (or the Cape slot, in the Curios panel).").withStyle(ChatFormatting.DARK_GRAY));
            lines.add(at++, Component.literal("Right-click an armor stand to hang it there.").withStyle(ChatFormatting.DARK_GRAY));
        }
    }

    static String kindName(String kind) {
        return switch (kind) {
            case "skill" -> "Skill cape";
            case "quest" -> "Quest cape";
            case "achievement" -> "Achievement cape";
            case "legendary" -> "Legendary cape";
            case "owner" -> "The owner's cape";
            default -> "Cape";
        };
    }

    private CapesClient() {
    }
}
