package net.lemursaucepacket.fixes.xpbank;

import java.util.function.Supplier;

import net.lemursaucepacket.fixes.LspFixes;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.registries.Registries;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Rarity;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.material.MapColor;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.event.BuildCreativeModeTabContentsEvent;
import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

/**
 * The XP Bank (pack 1.16.0, the owner's idea): a block that, set by Create machines, keeps a share of the XP their work
 * earns while nobody is near enough to get it (skills.MachineXp). Three tiers, 10%, 25% and 50% (skill_gates.json
 * "machineXp"); the second and third are upgrades fitted to a placed bank. A player takes from a bank at the tier
 * they can make themselves, and not at all before they can make one (XpBanks).
 */
public final class XpBankModule {
    private static final DeferredRegister.Blocks BLOCKS = DeferredRegister.createBlocks(LspFixes.MOD_ID);
    private static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(LspFixes.MOD_ID);
    private static final DeferredRegister<BlockEntityType<?>> BLOCK_ENTITIES = DeferredRegister.create(Registries.BLOCK_ENTITY_TYPE, LspFixes.MOD_ID);
    private static final DeferredRegister.DataComponents COMPONENTS = DeferredRegister.createDataComponents(Registries.DATA_COMPONENT_TYPE, LspFixes.MOD_ID);

    public static final DeferredBlock<XpBankBlock> XP_BANK = BLOCKS.register("xp_bank", () -> new XpBankBlock(BlockBehaviour.Properties.of()
            .mapColor(MapColor.COLOR_ORANGE).strength(3.0F, 6.0F).sound(SoundType.COPPER)
            .lightLevel(state -> state.getValue(XpBankBlock.FULL) ? 5 : 0)));
    public static final DeferredItem<XpBankItem> XP_BANK_ITEM = ITEMS.register("xp_bank", () -> new XpBankItem(XP_BANK.get(), new Item.Properties()));
    public static final DeferredItem<XpBankUpgradeItem> UPGRADE_2 = ITEMS.register("xp_bank_upgrade_2", () -> new XpBankUpgradeItem(2, new Item.Properties().rarity(Rarity.UNCOMMON)));
    public static final DeferredItem<XpBankUpgradeItem> UPGRADE_3 = ITEMS.register("xp_bank_upgrade_3", () -> new XpBankUpgradeItem(3, new Item.Properties().rarity(Rarity.RARE)));

    public static final Supplier<BlockEntityType<XpBankBlockEntity>> XP_BANK_BE = BLOCK_ENTITIES.register("xp_bank",
            () -> BlockEntityType.Builder.of(XpBankBlockEntity::new, XP_BANK.get()).build(null));

    /** What a bank holds, on the bank and on its item once broken. */
    public static final Supplier<DataComponentType<BankedXp>> BANKED = COMPONENTS.registerComponentType("banked_xp",
            b -> b.persistent(BankedXp.CODEC).networkSynchronized(BankedXp.STREAM_CODEC));

    private XpBankModule() {
    }

    public static void init(IEventBus modBus) {
        BLOCKS.register(modBus);
        ITEMS.register(modBus);
        BLOCK_ENTITIES.register(modBus);
        COMPONENTS.register(modBus);
        modBus.addListener((BuildCreativeModeTabContentsEvent e) -> {
            if (e.getTabKey() != CreativeModeTabs.FUNCTIONAL_BLOCKS) return;
            e.accept(XP_BANK_ITEM.get());
            e.accept(UPGRADE_2.get());
            e.accept(UPGRADE_3.get());
        });
        if (FMLEnvironment.dist.isClient()) XpBankClient.init(modBus);
    }

    /** The item a tier's bank is made with: the bank itself for tier 1, its upgrades for 2 and 3. */
    public static Item piece(int tier) {
        return switch (tier) {
            case 2 -> UPGRADE_2.get();
            case 3 -> UPGRADE_3.get();
            default -> XP_BANK_ITEM.get();
        };
    }
}
