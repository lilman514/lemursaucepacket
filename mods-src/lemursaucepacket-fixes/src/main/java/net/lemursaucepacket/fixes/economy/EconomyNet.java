package net.lemursaucepacket.fixes.economy;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import net.lemursaucepacket.fixes.LspFixes;
import net.lemursaucepacket.fixes.economy.trade.Trades;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;
import net.neoforged.neoforge.network.registration.PayloadRegistrar;

/** The economy's packets: the value table for the client, and the coin amount box (trade offers, exact splits). */
public final class EconomyNet {
    public static final int PURPOSE_TRADE = 0;
    public static final int PURPOSE_SPLIT = 1;

    private static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(LspFixes.MOD_ID, path);
    }

    /** Server -> client: every item's value, the items vendors refuse, and the enchantment rate. */
    public record Values(Map<Item, Float> values, List<Item> unsellable, float enchantRate) implements CustomPacketPayload {
        public static final Type<Values> TYPE = new Type<>(id("item_values"));
        public static final StreamCodec<RegistryFriendlyByteBuf, Values> CODEC = StreamCodec.composite(
                ByteBufCodecs.map(HashMap::new, ByteBufCodecs.registry(Registries.ITEM), ByteBufCodecs.FLOAT), Values::values,
                ByteBufCodecs.registry(Registries.ITEM).apply(ByteBufCodecs.list()), Values::unsellable,
                ByteBufCodecs.FLOAT, Values::enchantRate,
                Values::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }

        public static Values of(ItemValues.Table table) {
            return new Values(table.values(), List.copyOf(table.unsellable()), table.enchantRate());
        }

        public ItemValues.Table table() {
            return new ItemValues.Table(Map.copyOf(values), new HashSet<>(unsellable), enchantRate);
        }
    }

    /** Server -> client: ask for a coin amount (up to {@code max}; {@code current} pre-filled). */
    public record OpenCoinInput(int purpose, long max, long current) implements CustomPacketPayload {
        public static final Type<OpenCoinInput> TYPE = new Type<>(id("open_coin_input"));
        public static final StreamCodec<RegistryFriendlyByteBuf, OpenCoinInput> CODEC = StreamCodec.composite(
                ByteBufCodecs.VAR_INT, OpenCoinInput::purpose,
                ByteBufCodecs.VAR_LONG, OpenCoinInput::max,
                ByteBufCodecs.VAR_LONG, OpenCoinInput::current,
                OpenCoinInput::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    /** Client -> server: the amount typed. For a split, which slot of the open menu to take it from. */
    public record CoinInput(int purpose, long amount, int containerId, int slot) implements CustomPacketPayload {
        public static final Type<CoinInput> TYPE = new Type<>(id("coin_input"));
        public static final StreamCodec<RegistryFriendlyByteBuf, CoinInput> CODEC = StreamCodec.composite(
                ByteBufCodecs.VAR_INT, CoinInput::purpose,
                ByteBufCodecs.VAR_LONG, CoinInput::amount,
                ByteBufCodecs.VAR_INT, CoinInput::containerId,
                ByteBufCodecs.VAR_INT, CoinInput::slot,
                CoinInput::new);

        @Override
        public Type<? extends CustomPacketPayload> type() {
            return TYPE;
        }
    }

    static void register(RegisterPayloadHandlersEvent event) {
        PayloadRegistrar registrar = event.registrar(LspFixes.MOD_ID).versioned("1");
        registrar.playToClient(Values.TYPE, Values.CODEC, (payload, context) -> ItemValues.install(payload.table()));
        registrar.playToClient(OpenCoinInput.TYPE, OpenCoinInput.CODEC, (payload, context) -> {
            if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.economy.client.EconomyClient.openCoinInput(payload);
        });
        registrar.playToServer(CoinInput.TYPE, CoinInput.CODEC, (payload, context) -> {
            if (context.player() instanceof ServerPlayer player) onCoinInput(player, payload);
        });
    }

    private static void onCoinInput(ServerPlayer player, CoinInput input) {
        if (input.purpose() == PURPOSE_TRADE) {
            Trades.setCoins(player, input.amount());
            return;
        }
        if (input.purpose() != PURPOSE_SPLIT) return;
        AbstractContainerMenu menu = player.containerMenu;
        if (menu.containerId != input.containerId() || input.slot() < 0 || input.slot() >= menu.slots.size()) return;
        if (!menu.getCarried().isEmpty()) return;
        Slot slot = menu.getSlot(input.slot());
        ItemStack stack = slot.getItem();
        if (!Coins.is(stack) || !slot.mayPickup(player) || !slot.allowModification(player)) return;
        long have = Coins.value(stack);
        long take = Math.min(have, input.amount());
        if (take <= 0) return;
        if (take == have) {
            slot.set(ItemStack.EMPTY);
            menu.setCarried(Coins.stack(take));
        } else {
            slot.set(Coins.stack(have - take));
            menu.setCarried(Coins.stack(take));
        }
        menu.broadcastChanges();
    }

    private EconomyNet() {
    }
}
