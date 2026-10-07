package net.lemursaucepacket.fixes.capes;

import java.util.List;

import net.lemursaucepacket.fixes.LspFixes;
import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;

/** The capes' packets: a player's own capes for their client, opening the collection screen, and what its buttons do. */
public final class CapeNet {
    public static final int WEAR = 0, TAKE_OFF = 1, BUY = 2;

    private static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(LspFixes.MOD_ID, path);
    }

    /** Server -> client: the capes this player has earned, and their cape flags (for the Completionist's count). */
    public record State(List<String> unlocked, List<String> flags) implements CustomPacketPayload {
        public static final Type<State> TYPE = new Type<>(id("cape_state"));
        public static final StreamCodec<FriendlyByteBuf, State> CODEC = StreamCodec.composite(
                ByteBufCodecs.STRING_UTF8.apply(ByteBufCodecs.list()), State::unlocked,
                ByteBufCodecs.STRING_UTF8.apply(ByteBufCodecs.list()), State::flags,
                State::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Server -> client: open the collection. {@code npc} is the entity id of the NPC who makes capes (-1 if none). */
    public record Open(int npc, String npcId) implements CustomPacketPayload {
        public static final Type<Open> TYPE = new Type<>(id("cape_open"));
        public static final StreamCodec<FriendlyByteBuf, Open> CODEC = StreamCodec.composite(
                ByteBufCodecs.VAR_INT, Open::npc,
                ByteBufCodecs.STRING_UTF8, Open::npcId,
                Open::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Client -> server: wear a cape from the bag, take the worn one off, or buy another from the NPC. */
    public record Act(int action, String cape, int npc) implements CustomPacketPayload {
        public static final Type<Act> TYPE = new Type<>(id("cape_act"));
        public static final StreamCodec<FriendlyByteBuf, Act> CODEC = StreamCodec.composite(
                ByteBufCodecs.VAR_INT, Act::action,
                ByteBufCodecs.STRING_UTF8, Act::cape,
                ByteBufCodecs.VAR_INT, Act::npc,
                Act::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    static void register(RegisterPayloadHandlersEvent event) {
        PayloadRegistrar registrar = event.registrar(LspFixes.MOD_ID).versioned("1");
        registrar.playToClient(State.TYPE, State.CODEC, (payload, context) -> {
            Capes.CLIENT.unlocked.clear();
            Capes.CLIENT.unlocked.addAll(payload.unlocked());
            Capes.CLIENT.flags.clear();
            Capes.CLIENT.flags.addAll(payload.flags());
        });
        registrar.playToClient(Open.TYPE, Open.CODEC, (payload, context) -> {
            if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.capes.client.CapesClient.open(payload);
        });
        registrar.playToServer(Act.TYPE, Act.CODEC, (payload, context) -> {
            if (!(context.player() instanceof ServerPlayer p)) return;
            switch (payload.action()) {
                case WEAR -> Capes.wear(p, payload.cape());
                case TAKE_OFF -> Capes.takeOff(p);
                case BUY -> Capes.buy(p, payload.cape(), payload.npc());
                default -> {
                }
            }
        });
    }

    private CapeNet() {
    }
}
