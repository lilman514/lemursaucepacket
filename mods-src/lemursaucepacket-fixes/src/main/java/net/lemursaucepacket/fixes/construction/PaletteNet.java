package net.lemursaucepacket.fixes.construction;

import java.util.List;

import net.lemursaucepacket.fixes.LspFixes;
import net.minecraft.core.BlockPos;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;

/** The Mason's Palette's packets: opening the picker with the palette's blocks, and choosing one (from it or the world). */
public final class PaletteNet {
    private static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(LspFixes.MOD_ID, path);
    }

    /** One of the picker's categories: its name, the item drawn for it, and its blocks' ids. */
    public record Category(String name, String icon, List<String> blocks) {
        static final StreamCodec<FriendlyByteBuf, Category> CODEC = StreamCodec.composite(
                ByteBufCodecs.STRING_UTF8, Category::name,
                ByteBufCodecs.STRING_UTF8, Category::icon,
                ByteBufCodecs.STRING_UTF8.apply(ByteBufCodecs.list()), Category::blocks,
                Category::new);
    }

    /** Server -> client: open the picker. {@code usable}: the player has the level ({@code need}; they have {@code have}). */
    public record Open(List<Category> categories, String selected, boolean usable, int need, int have) implements CustomPacketPayload {
        public static final Type<Open> TYPE = new Type<>(id("palette_open"));
        public static final StreamCodec<FriendlyByteBuf, Open> CODEC = StreamCodec.composite(
                Category.CODEC.apply(ByteBufCodecs.list()), Open::categories,
                ByteBufCodecs.STRING_UTF8, Open::selected,
                ByteBufCodecs.BOOL, Open::usable,
                ByteBufCodecs.VAR_INT, Open::need,
                ByteBufCodecs.VAR_INT, Open::have,
                Open::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Client -> server: the palette in hand places this block from now on. */
    public record Select(String block) implements CustomPacketPayload {
        public static final Type<Select> TYPE = new Type<>(id("palette_select"));
        public static final StreamCodec<FriendlyByteBuf, Select> CODEC = StreamCodec.composite(ByteBufCodecs.STRING_UTF8, Select::block, Select::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Client -> server: middle-clicked a block with the palette in hand. */
    public record Pick(BlockPos pos) implements CustomPacketPayload {
        public static final Type<Pick> TYPE = new Type<>(id("palette_pick"));
        public static final StreamCodec<FriendlyByteBuf, Pick> CODEC = StreamCodec.composite(BlockPos.STREAM_CODEC, Pick::pos, Pick::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    static void register(RegisterPayloadHandlersEvent event) {
        PayloadRegistrar registrar = event.registrar(LspFixes.MOD_ID).versioned("1");
        registrar.playToClient(Open.TYPE, Open.CODEC, (payload, context) -> {
            if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.construction.client.PaletteClient.open(payload);
        });
        registrar.playToServer(Select.TYPE, Select.CODEC, (payload, context) -> {
            if (context.player() instanceof ServerPlayer p) Palette.select(p, payload.block());
        });
        registrar.playToServer(Pick.TYPE, Pick.CODEC, (payload, context) -> {
            if (context.player() instanceof ServerPlayer p) Palette.pick(p, payload.pos());
        });
    }

    private PaletteNet() {
    }
}
