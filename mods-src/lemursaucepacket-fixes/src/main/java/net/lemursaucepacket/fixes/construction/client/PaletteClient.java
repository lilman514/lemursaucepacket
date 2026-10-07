package net.lemursaucepacket.fixes.construction.client;

import net.lemursaucepacket.fixes.construction.ConstructionModule;
import net.lemursaucepacket.fixes.construction.PaletteNet;
import net.minecraft.client.Minecraft;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.neoforged.neoforge.client.event.InputEvent;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.network.PacketDistributor;

/** The Mason's Palette on the client: its picker, and middle-click (pick block) choosing the block you're looking at. */
public final class PaletteClient {
    public static void init() {
        NeoForge.EVENT_BUS.addListener(PaletteClient::onInteraction);
    }

    public static void open(PaletteNet.Open payload) {
        Minecraft.getInstance().setScreen(new PaletteScreen(payload));
    }

    private static void onInteraction(InputEvent.InteractionKeyMappingTriggered e) {
        if (!e.isPickBlock()) return;
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || mc.hitResult == null || mc.hitResult.getType() != HitResult.Type.BLOCK) return;
        boolean holding = false;
        for (InteractionHand hand : InteractionHand.values()) holding |= mc.player.getItemInHand(hand).is(ConstructionModule.MASONS_PALETTE.get());
        if (!holding) return;
        PacketDistributor.sendToServer(new PaletteNet.Pick(((BlockHitResult) mc.hitResult).getBlockPos()));
        e.setCanceled(true);
        e.setSwingHand(false);
    }

    private PaletteClient() {
    }
}
