package net.lemursaucepacket.instances;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import net.minecraft.network.FriendlyByteBuf;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;

/** The event window's packets: its contents (server to client) and its buttons (client to server). */
public final class InstanceNet {
    public static final int OPEN = 0, REFRESH = 1, CLOSE = 2;
    public static final int SOLO = 0, HOST = 1, JOIN = 2, LEAVE = 3, BEGIN = 4, RECLAIM = 5;

    /** One co-op fight waiting for players, as the window lists it. */
    public record LobbyView(UUID host, String hostName, List<String> members, int max) {
        static void write(FriendlyByteBuf buf, LobbyView v) {
            buf.writeUUID(v.host);
            buf.writeUtf(v.hostName);
            buf.writeCollection(v.members, FriendlyByteBuf::writeUtf);
            buf.writeVarInt(v.max);
        }

        static LobbyView read(FriendlyByteBuf buf) {
            return new LobbyView(buf.readUUID(), buf.readUtf(), buf.readList(FriendlyByteBuf::readUtf), buf.readVarInt());
        }
    }

    /**
     * Server to client: open, refresh (only if it's open) or close an event's window.
     *
     * @param npc       the entity the player spoke to (sent back with every button, and checked)
     * @param canStart  whether this player may start the fight (alone or as a host)
     * @param startNote why not, when they may not
     * @param mine      the co-op fight this player is in, if any
     * @param kept      how many stacks the keeper holds for this player
     */
    public record Window(int mode, ResourceLocation event, int npc, String title, List<String> lines, boolean canStart,
                         String startNote, List<LobbyView> lobbies, Optional<LobbyView> mine, boolean hosting, int kept,
                         String keeper) implements CustomPacketPayload {
        public static final Type<Window> TYPE = new Type<>(LspInstances.id("window"));
        public static final StreamCodec<RegistryFriendlyByteBuf, Window> CODEC = StreamCodec.of((buf, w) -> {
            buf.writeVarInt(w.mode);
            buf.writeResourceLocation(w.event);
            buf.writeVarInt(w.npc);
            buf.writeUtf(w.title);
            buf.writeCollection(w.lines, FriendlyByteBuf::writeUtf);
            buf.writeBoolean(w.canStart);
            buf.writeUtf(w.startNote);
            buf.writeCollection(w.lobbies, LobbyView::write);
            buf.writeOptional(w.mine, LobbyView::write);
            buf.writeBoolean(w.hosting);
            buf.writeVarInt(w.kept);
            buf.writeUtf(w.keeper);
        }, buf -> new Window(buf.readVarInt(), buf.readResourceLocation(), buf.readVarInt(), buf.readUtf(),
                buf.readList(FriendlyByteBuf::readUtf), buf.readBoolean(), buf.readUtf(), buf.readList(LobbyView::read),
                buf.readOptional(LobbyView::read), buf.readBoolean(), buf.readVarInt(), buf.readUtf()));

        static Window close(ResourceLocation event) {
            return new Window(CLOSE, event, -1, "", List.of(), false, "", List.of(), Optional.empty(), false, 0, "");
        }

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Client to server: a button in the window. {@code target} is the host for {@link #JOIN}. */
    public record Action(ResourceLocation event, int npc, int action, UUID target) implements CustomPacketPayload {
        public static final Type<Action> TYPE = new Type<>(LspInstances.id("action"));
        public static final StreamCodec<RegistryFriendlyByteBuf, Action> CODEC = StreamCodec.of((buf, a) -> {
            buf.writeResourceLocation(a.event);
            buf.writeVarInt(a.npc);
            buf.writeVarInt(a.action);
            buf.writeUUID(a.target);
        }, buf -> new Action(buf.readResourceLocation(), buf.readVarInt(), buf.readVarInt(), buf.readUUID()));

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    static void register(RegisterPayloadHandlersEvent event) {
        PayloadRegistrar registrar = event.registrar(LspInstances.MOD_ID).versioned("1");
        registrar.playToClient(Window.TYPE, Window.CODEC, (payload, context) -> {
            if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.instances.client.InstancesClient.window(payload);
        });
        registrar.playToServer(Action.TYPE, Action.CODEC, (payload, context) -> {
            if (context.player() instanceof ServerPlayer player) InstanceManager.onAction(player, payload);
        });
    }

    private InstanceNet() {
    }
}
