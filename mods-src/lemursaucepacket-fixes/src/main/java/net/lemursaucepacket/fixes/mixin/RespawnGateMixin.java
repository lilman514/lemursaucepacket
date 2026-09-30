package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.lifesteal.Limbo;
import net.minecraft.network.protocol.game.ServerboundClientCommandPacket;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.network.ServerGamePacketListenerImpl;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * A player with no hearts left stays dead: their respawn request is dropped until a revive clears the flag
 * or they confirm elimination ({@link Limbo}). Injected after the packet has been moved to the server
 * thread ({@code ensureRunningOnSameThread} throws to reschedule it, so HEAD would run on the network
 * thread).
 */
@Mixin(ServerGamePacketListenerImpl.class)
public abstract class RespawnGateMixin {
    @Shadow
    public ServerPlayer player;

    @Inject(method = "handleClientCommand", at = @At(value = "INVOKE", target = "Lnet/minecraft/server/level/ServerPlayer;resetLastActionTime()V", shift = At.Shift.AFTER), cancellable = true)
    private void lsp$holdEliminatedPlayers(ServerboundClientCommandPacket packet, CallbackInfo ci) {
        if (packet.getAction() == ServerboundClientCommandPacket.Action.PERFORM_RESPAWN && this.player.getHealth() <= 0.0F && Limbo.shouldBlockRespawn(this.player)) {
            ci.cancel();
        }
    }
}
