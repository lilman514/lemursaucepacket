package net.lemursaucepacket.fixes.construction;

import java.util.function.Supplier;

import net.lemursaucepacket.fixes.LspFixes;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Rarity;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.event.lifecycle.FMLCommonSetupEvent;
import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.attachment.AttachmentType;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.BuildCreativeModeTabContentsEvent;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.TagsUpdatedEvent;
import net.neoforged.neoforge.event.level.BlockDropsEvent;
import net.neoforged.neoforge.event.level.BlockEvent;
import net.neoforged.neoforge.event.level.ExplosionEvent;
import net.neoforged.neoforge.event.level.PistonEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;
import net.neoforged.neoforge.registries.NeoForgeRegistries;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Construction, the building skill (docs/skills.md, data in skills/unlocks.mjs): XP for building ({@link Construction}),
 * the saving perk, the blocks that cost nothing and must never become items ({@link FreeBlocks}), and the Construction
 * Cape's Mason's Palette ({@link MasonsPaletteItem}, {@link Palette}). Its alternate recipes are skill gates
 * (skills.Gates#mayUseRecipe).
 */
public final class ConstructionModule {
    public static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/construction");

    private static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(LspFixes.MOD_ID);
    private static final DeferredRegister.DataComponents COMPONENTS = DeferredRegister.createDataComponents(Registries.DATA_COMPONENT_TYPE, LspFixes.MOD_ID);
    private static final DeferredRegister<AttachmentType<?>> ATTACHMENTS = DeferredRegister.create(NeoForgeRegistries.ATTACHMENT_TYPES, LspFixes.MOD_ID);

    /** The block a Mason's Palette places. */
    public static final DeferredHolder<DataComponentType<?>, DataComponentType<ResourceLocation>> PALETTE_BLOCK = COMPONENTS.registerComponentType("palette_block",
            b -> b.persistent(ResourceLocation.CODEC).networkSynchronized(ResourceLocation.STREAM_CODEC));
    public static final DeferredItem<MasonsPaletteItem> MASONS_PALETTE = ITEMS.registerItem("masons_palette", MasonsPaletteItem::new, new Item.Properties().stacksTo(1).rarity(Rarity.EPIC));
    /** On chunks: the free blocks there (the palette's, and the ones the saving perk gave back). */
    public static final Supplier<AttachmentType<FreeBlocks.Chunk>> FREE = ATTACHMENTS.register("free_blocks",
            () -> AttachmentType.builder(FreeBlocks.Chunk::new).serialize(FreeBlocks.Chunk.CODEC).build());

    public static void init(IEventBus modBus) {
        ITEMS.register(modBus);
        COMPONENTS.register(modBus);
        ATTACHMENTS.register(modBus);
        modBus.addListener(PaletteNet::register);
        modBus.addListener((FMLCommonSetupEvent e) -> e.enqueueWork(FreeBlocks::registerWithCreate));
        modBus.addListener((BuildCreativeModeTabContentsEvent e) -> {
            if (e.getTabKey() == CreativeModeTabs.TOOLS_AND_UTILITIES) e.accept(MASONS_PALETTE.get());
        });
        // Last, so a safe zone or a claim has cancelled the placement already if it's going to.
        NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, (BlockEvent.EntityPlaceEvent e) -> Construction.onPlaced(e));
        NeoForge.EVENT_BUS.addListener((BlockDropsEvent e) -> FreeBlocks.onDrops(e));
        NeoForge.EVENT_BUS.addListener(EventPriority.LOWEST, (BlockEvent.BreakEvent e) -> {
            if (!e.isCanceled()) FreeBlocks.onBreak(e);
        });
        NeoForge.EVENT_BUS.addListener((ExplosionEvent.Detonate e) -> FreeBlocks.onExplosion(e));
        NeoForge.EVENT_BUS.addListener((PistonEvent.Pre e) -> FreeBlocks.onPiston(e));
        NeoForge.EVENT_BUS.addListener((ServerTickEvent.Post e) -> Construction.tick(e.getServer()));
        NeoForge.EVENT_BUS.addListener((ServerStartedEvent e) -> {
            BuildRules.invalidate();
            BuildRules.palette();
        });
        NeoForge.EVENT_BUS.addListener((TagsUpdatedEvent e) -> {
            if (e.getUpdateCause() == TagsUpdatedEvent.UpdateCause.SERVER_DATA_LOAD) BuildRules.invalidate();
        });
        NeoForge.EVENT_BUS.addListener((RegisterCommandsEvent e) -> PaletteCommands.register(e.getDispatcher()));
        if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.construction.client.PaletteClient.init();
    }

    private ConstructionModule() {
    }
}
