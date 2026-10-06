package net.lemursaucepacket.fixes.economy;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

import com.mojang.serialization.Codec;

import net.lemursaucepacket.fixes.LspFixes;
import net.lemursaucepacket.fixes.economy.shop.ShopMenu;
import net.lemursaucepacket.fixes.economy.trade.TradeMenu;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.attachment.AttachmentType;
import net.neoforged.neoforge.common.extensions.IMenuTypeExtension;
import net.neoforged.neoforge.event.BuildCreativeModeTabContentsEvent;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;
import net.neoforged.neoforge.registries.NeoForgeRegistries;

/** Everything the economy registers: the coin items, the amount a coin stack holds, the shop and trade menus, what NPCs remember. */
public final class EconomyContent {
    private static final DeferredRegister.DataComponents COMPONENTS = DeferredRegister.createDataComponents(Registries.DATA_COMPONENT_TYPE, LspFixes.MOD_ID);
    private static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(LspFixes.MOD_ID);
    private static final DeferredRegister<MenuType<?>> MENUS = DeferredRegister.create(Registries.MENU, LspFixes.MOD_ID);
    private static final DeferredRegister<AttachmentType<?>> ATTACHMENTS = DeferredRegister.create(NeoForgeRegistries.ATTACHMENT_TYPES, LspFixes.MOD_ID);

    /** How many coins one Gold Coins stack holds. A stack is always one item: the amount lives here, without a cap. */
    public static final DeferredHolder<DataComponentType<?>, DataComponentType<Long>> COIN_AMOUNT = COMPONENTS.registerComponentType("coin_amount",
            b -> b.persistent(Codec.LONG.validate(n -> n > 0 ? com.mojang.serialization.DataResult.success(n) : com.mojang.serialization.DataResult.error(() -> "coin amount must be positive: " + n)))
                    .networkSynchronized(ByteBufCodecs.VAR_LONG));

    /** On a shop's display copy of a good: its price, so the client can put the cost at the bottom of the tooltip. Never saved. */
    public static final DeferredHolder<DataComponentType<?>, DataComponentType<Long>> SHOP_COST = COMPONENTS.registerComponentType("shop_cost",
            b -> b.networkSynchronized(ByteBufCodecs.VAR_LONG));

    /** Marks a shop or trade window's buttons and panes, whose tooltips the client trims to their own lines. Never saved. */
    public static final DeferredHolder<DataComponentType<?>, DataComponentType<net.minecraft.util.Unit>> DISPLAY = COMPONENTS.registerComponentType("display",
            b -> b.networkSynchronized(net.minecraft.network.codec.StreamCodec.unit(net.minecraft.util.Unit.INSTANCE)));

    public static final DeferredItem<CoinItem> GOLD_COINS = ITEMS.registerItem("gold_coins", CoinItem::new, new Item.Properties().stacksTo(1));
    /** Missions pay these (Brassworks hands out a reward item by count): each opens into {@link Coins#POUCH_COINS} coins. */
    public static final DeferredItem<CoinPouchItem> COIN_POUCH = ITEMS.registerItem("coin_pouch", CoinPouchItem::new, new Item.Properties().stacksTo(64));

    public static final DeferredHolder<MenuType<?>, MenuType<ShopMenu>> SHOP_MENU = MENUS.register("shop", () -> IMenuTypeExtension.create(ShopMenu::client));
    public static final DeferredHolder<MenuType<?>, MenuType<TradeMenu>> TRADE_MENU = MENUS.register("trade", () -> IMenuTypeExtension.create(TradeMenu::client));

    /** Which townsfolk a player has met and which of their talks they've heard ("who" and "who/dialog"), kept through death. */
    public static final Supplier<AttachmentType<Set<String>>> NPC_MEMORY = ATTACHMENTS.register("npc_memory",
            () -> AttachmentType.<Set<String>>builder(() -> new HashSet<>())
                    .serialize(Codec.STRING.listOf().xmap(list -> (Set<String>) new HashSet<>(list), set -> List.copyOf(set)))
                    .copyOnDeath()
                    .build());

    static void register(IEventBus modBus) {
        COMPONENTS.register(modBus);
        ITEMS.register(modBus);
        MENUS.register(modBus);
        ATTACHMENTS.register(modBus);
        modBus.addListener(EconomyContent::onCreativeTabs);
    }

    private static void onCreativeTabs(BuildCreativeModeTabContentsEvent event) {
        if (event.getTabKey() != CreativeModeTabs.INGREDIENTS) return;
        event.accept(Coins.stack(1));
        event.accept(Coins.stack(1000));
        event.accept(COIN_POUCH.get());
    }

    private EconomyContent() {
    }
}
