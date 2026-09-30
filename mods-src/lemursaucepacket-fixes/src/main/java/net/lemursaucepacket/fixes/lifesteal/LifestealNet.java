package net.lemursaucepacket.fixes.lifesteal;

import java.util.List;
import java.util.UUID;

import net.lemursaucepacket.fixes.LspFixes;
import net.minecraft.core.BlockPos;
import net.minecraft.core.UUIDUtil;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.ItemStack;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;

/** The packets between the server and the pack's client: the limbo death screen and the compass GUI. */
public final class LifestealNet {
    private static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(LspFixes.MOD_ID, path);
    }

    /** Server -> client: you are (or are no longer) in limbo, with the nonce to confirm and what erasure would touch. */
    public record LimboState(boolean eliminated, String nonce, int blocks, int unloadedChunks, int items) implements CustomPacketPayload {
        public static final Type<LimboState> TYPE = new Type<>(id("limbo_state"));
        public static final StreamCodec<RegistryFriendlyByteBuf, LimboState> CODEC = StreamCodec.composite(
                ByteBufCodecs.BOOL, LimboState::eliminated,
                ByteBufCodecs.STRING_UTF8, LimboState::nonce,
                ByteBufCodecs.VAR_INT, LimboState::blocks,
                ByteBufCodecs.VAR_INT, LimboState::unloadedChunks,
                ByteBufCodecs.VAR_INT, LimboState::items,
                LimboState::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Client -> server: the player went through every warning. */
    public record ConfirmElimination(String nonce) implements CustomPacketPayload {
        public static final Type<ConfirmElimination> TYPE = new Type<>(id("confirm_elimination"));
        public static final StreamCodec<RegistryFriendlyByteBuf, ConfirmElimination> CODEC = StreamCodec.composite(ByteBufCodecs.STRING_UTF8, ConfirmElimination::nonce, ConfirmElimination::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** One row of the compass list. {@code key} is what the client sends back to pick it. */
    public record CompassEntry(String key, ItemStack icon, int count, String dimension, int distance) {
        public static final StreamCodec<RegistryFriendlyByteBuf, CompassEntry> CODEC = StreamCodec.composite(
                ByteBufCodecs.STRING_UTF8, CompassEntry::key,
                ItemStack.OPTIONAL_STREAM_CODEC, CompassEntry::icon,
                ByteBufCodecs.VAR_INT, CompassEntry::count,
                ByteBufCodecs.STRING_UTF8, CompassEntry::dimension,
                ByteBufCodecs.VAR_INT, CompassEntry::distance,
                CompassEntry::new);
    }

    /** Server -> client: open the compass GUI for the compass in that hand. */
    public record CompassList(int hand, boolean seeker, boolean includeAll, String selectedKey, List<CompassEntry> entries) implements CustomPacketPayload {
        public static final Type<CompassList> TYPE = new Type<>(id("compass_list"));
        public static final StreamCodec<RegistryFriendlyByteBuf, CompassList> CODEC = StreamCodec.composite(
                ByteBufCodecs.VAR_INT, CompassList::hand,
                ByteBufCodecs.BOOL, CompassList::seeker,
                ByteBufCodecs.BOOL, CompassList::includeAll,
                ByteBufCodecs.STRING_UTF8, CompassList::selectedKey,
                CompassEntry.CODEC.apply(ByteBufCodecs.list()), CompassList::entries,
                CompassList::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Client -> server: point the compass in that hand at this entry (empty key: stop), and the toggle. */
    public record CompassSelect(int hand, String key, boolean includeAll) implements CustomPacketPayload {
        public static final Type<CompassSelect> TYPE = new Type<>(id("compass_select"));
        public static final StreamCodec<RegistryFriendlyByteBuf, CompassSelect> CODEC = StreamCodec.composite(
                ByteBufCodecs.VAR_INT, CompassSelect::hand,
                ByteBufCodecs.STRING_UTF8, CompassSelect::key,
                ByteBufCodecs.BOOL, CompassSelect::includeAll,
                CompassSelect::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Server -> client: where a compass points now (the needle reads this; the item itself is untouched so it never re-equips). */
    public record CompassTarget(UUID compass, boolean valid, String dimension, BlockPos pos) implements CustomPacketPayload {
        public static final Type<CompassTarget> TYPE = new Type<>(id("compass_target"));
        public static final StreamCodec<RegistryFriendlyByteBuf, CompassTarget> CODEC = StreamCodec.composite(
                UUIDUtil.STREAM_CODEC, CompassTarget::compass,
                ByteBufCodecs.BOOL, CompassTarget::valid,
                ByteBufCodecs.STRING_UTF8, CompassTarget::dimension,
                BlockPos.STREAM_CODEC, CompassTarget::pos,
                CompassTarget::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    static void register(RegisterPayloadHandlersEvent event) {
        PayloadRegistrar registrar = event.registrar(LspFixes.MOD_ID).versioned("1").optional();
        registrar.playToClient(LimboState.TYPE, LimboState.CODEC, (payload, context) -> {
            if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.lifesteal.client.LifestealClient.onLimboState(payload);
        });
        registrar.playToClient(CompassList.TYPE, CompassList.CODEC, (payload, context) -> {
            if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.lifesteal.client.LifestealClient.onCompassList(payload);
        });
        registrar.playToClient(CompassTarget.TYPE, CompassTarget.CODEC, (payload, context) -> {
            if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.lifesteal.client.LifestealClient.onCompassTarget(payload);
        });
        registrar.playToServer(ConfirmElimination.TYPE, ConfirmElimination.CODEC, (payload, context) -> {
            if (context.player() instanceof net.minecraft.server.level.ServerPlayer player) Limbo.confirm(player, payload.nonce());
        });
        registrar.playToServer(CompassSelect.TYPE, CompassSelect.CODEC, (payload, context) -> {
            if (context.player() instanceof net.minecraft.server.level.ServerPlayer player) net.lemursaucepacket.fixes.lifesteal.compass.CompassServer.select(player, payload);
        });
    }

    private LifestealNet() {
    }
}
