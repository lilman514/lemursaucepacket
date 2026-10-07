package net.lemursaucepacket.fixes.lifesteal;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import net.minecraft.ChatFormatting;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.Level;
import net.neoforged.neoforge.network.PacketDistributor;

/**
 * The death screen of a player with no hearts left. The KubeJS core sets {@code lsp_eliminated} when the
 * last heart goes; from then on the respawn packet is ignored ({@code RespawnGateMixin}) until either a
 * friend's {@code /revive} clears the flag, or the player walks through the confirmation on the death screen
 * and the client sends back the nonce it was given. Then the life is erased and the player respawns fresh.
 */
public final class Limbo {
    private static final Map<UUID, String> NONCES = new HashMap<>();
    private static final Map<UUID, Long> LAST_SENT = new HashMap<>();

    public static boolean isInLimbo(ServerPlayer player) {
        return KubeData.isEliminated(player);
    }

    /** Called by the respawn gate on the server thread for every respawn request. */
    public static boolean shouldBlockRespawn(ServerPlayer player) {
        if (!isInLimbo(player)) return false;
        if (!LifestealConfig.ELIMINATION_ENABLED.get()) {
            CompoundTag data = KubeData.of(player);
            data.putBoolean(KubeData.ELIMINATED, false);
            data.putInt(KubeData.HEARTS, data.getInt(KubeData.HEARTS) + 1);
            data.remove(KubeData.LAST_KILLER);
            LifestealModule.LOGGER.info("Elimination is off: {} respawns with one heart", player.getGameProfile().getName());
            player.sendSystemMessage(Component.literal("Elimination is switched off on this server. You get one heart back.").withStyle(ChatFormatting.GRAY));
            return false;
        }
        send(player, true);
        return true;
    }

    static void tick(MinecraftServer server) {
        if (server.getTickCount() % 20 != 0) return;
        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            if (player.isDeadOrDying() && isInLimbo(player)) {
                send(player, false);
            } else if (LAST_SENT.containsKey(player.getUUID())) {
                // Revived (or respawned): the client gets its normal death screen back.
                LAST_SENT.remove(player.getUUID());
                NONCES.remove(player.getUUID());
                if (player.connection.hasChannel(LifestealNet.LimboState.TYPE)) PacketDistributor.sendToPlayer(player, new LifestealNet.LimboState(false, "", 0, 0, 0));
            }
        }
    }

    private static void send(ServerPlayer player, boolean force) {
        if (!player.connection.hasChannel(LifestealNet.LimboState.TYPE)) return;
        long now = System.currentTimeMillis();
        Long last = LAST_SENT.get(player.getUUID());
        if (!force && last != null && now - last < 5000) return;
        LAST_SENT.put(player.getUUID(), now);
        String nonce = NONCES.computeIfAbsent(player.getUUID(), u -> UUID.randomUUID().toString());
        int[] preview = EraseJob.preview(player.server, player.getUUID(), KubeData.generation(player));
        PacketDistributor.sendToPlayer(player, new LifestealNet.LimboState(true, nonce, preview[0], preview[1], knownItems(player)));
    }

    /** Items known to be the player's right now: a floor, not a full count. */
    private static int knownItems(ServerPlayer player) {
        int n = 0;
        for (var stack : player.getInventory().items) if (Ownership.isOwnedBy(stack, player.getUUID())) n++;
        n += net.lemursaucepacket.fixes.lifesteal.compass.LostItemIndex.get(player.server).count(player.getUUID());
        n += net.lemursaucepacket.fixes.lifesteal.compass.ContainerIndex.get(player.server).count(player.getUUID());
        return n;
    }

    /** The client finished the confirmation. */
    public static void confirm(ServerPlayer player, String nonce) {
        String expected = NONCES.get(player.getUUID());
        if (!isInLimbo(player) || expected == null || !expected.equals(nonce) || !player.isDeadOrDying()) {
            LifestealModule.LOGGER.warn("Ignored an elimination confirmation from {} (in limbo: {}, nonce ok: {})", player.getGameProfile().getName(), isInLimbo(player), expected != null && expected.equals(nonce));
            return;
        }
        NONCES.remove(player.getUUID());
        accept(player);
    }

    /** Erases the current life and starts the next one. Also behind {@code /lsp elimination force}. */
    public static void accept(ServerPlayer player) {
        MinecraftServer server = player.server;
        CompoundTag data = KubeData.of(player);
        int generation = data.getInt(KubeData.GENERATION);
        String name = player.getGameProfile().getName();
        LifestealModule.LOGGER.info("{} accepted elimination (life {})", name, generation + 1);
        EraseJob.start(server, player.getUUID(), name, generation);
        // The next life: the same keys kubejs/server_scripts/lifesteal.js writes in lsNewLife().
        data.putInt(KubeData.GENERATION, generation + 1);
        data.putInt(KubeData.HEARTS, 0);
        data.putBoolean(KubeData.ELIMINATED, false);
        data.putBoolean(KubeData.PROTECT_OFF, false);
        data.putInt(KubeData.PROTECT_UNTIL, data.getInt(KubeData.PLAYTIME) + LifestealModule.newcomerProtectionTicks());
        data.remove(KubeData.LAST_KILLER);
        data.remove(KubeData.LAST_KILLER_TIME);
        data.putBoolean(KubeData.NEW_LIFE, true);
        player.setRespawnPosition(Level.OVERWORLD, null, 0.0F, false, false);
        server.getPlayerList().broadcastSystemMessage(Component.literal(name + " accepted elimination and starts over.").withStyle(ChatFormatting.RED), false);
        ServerPlayer next = player;
        if (player.isDeadOrDying()) {
            ServerPlayer respawned = server.getPlayerList().respawn(player, false, Entity.RemovalReason.KILLED);
            respawned.connection.player = respawned;
            if (respawned.connection.hasChannel(LifestealNet.LimboState.TYPE)) {
                PacketDistributor.sendToPlayer(respawned, new LifestealNet.LimboState(false, "", 0, 0, 0));
            }
            next = respawned;
        }
        // Earned capes outlive a life (docs/lifesteal.md): the new one gets their items again.
        net.lemursaucepacket.fixes.capes.Capes.newLife(next);
    }

    static void forget(UUID uuid) {
        NONCES.remove(uuid);
        LAST_SENT.remove(uuid);
    }

    private Limbo() {
    }
}
