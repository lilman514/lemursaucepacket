package net.lemursaucepacket.nekomasfixed.registry;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import net.lemursaucepacket.nekomasfixed.Colour;
import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.block.DyedBedBlock;
import net.lemursaucepacket.nekomasfixed.block.DyedShulkerBoxBlock;
import net.lemursaucepacket.nekomasfixed.block.DyedStainedGlassBlock;
import net.lemursaucepacket.nekomasfixed.block.DyedStainedGlassPaneBlock;
import net.lemursaucepacket.nekomasfixed.block.FloorClockBlock;
import net.lemursaucepacket.nekomasfixed.block.GlowTorchBlock;
import net.lemursaucepacket.nekomasfixed.block.KilnBlock;
import net.lemursaucepacket.nekomasfixed.block.WallClockBlock;
import net.lemursaucepacket.nekomasfixed.block.WallGlowTorchBlock;
import net.minecraft.world.level.block.BedBlock;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.CandleBlock;
import net.minecraft.world.level.block.CandleCakeBlock;
import net.minecraft.world.level.block.ConcretePowderBlock;
import net.minecraft.world.level.block.GlazedTerracottaBlock;
import net.minecraft.world.level.block.RotatedPillarBlock;
import net.minecraft.world.level.block.SlabBlock;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.StairBlock;
import net.minecraft.world.level.block.WallBlock;
import net.minecraft.world.level.block.WoolCarpetBlock;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.properties.BedPart;
import net.minecraft.world.level.block.state.properties.NoteBlockInstrument;
import net.minecraft.world.level.material.MapColor;
import net.minecraft.world.level.material.PushReaction;
import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredRegister;

/** Every block of batch 1. Ids are upstream's, so its blockstates, models and loot tables fit unchanged. */
public final class ModBlocks {
    static final DeferredRegister.Blocks BLOCKS = DeferredRegister.createBlocks(NekomasFixed.MOD_ID);

    /** One of each vanilla dyed block, in a new colour. Candle cakes have no item: a candle on a cake makes one. */
    public record DyeFamily(
            DeferredBlock<Block> wool,
            DeferredBlock<WoolCarpetBlock> carpet,
            DeferredBlock<Block> terracotta,
            DeferredBlock<GlazedTerracottaBlock> glazedTerracotta,
            DeferredBlock<Block> concrete,
            DeferredBlock<ConcretePowderBlock> concretePowder,
            DeferredBlock<DyedStainedGlassBlock> stainedGlass,
            DeferredBlock<DyedStainedGlassPaneBlock> stainedGlassPane,
            DeferredBlock<CandleBlock> candle,
            DeferredBlock<CandleCakeBlock> candleCake,
            DeferredBlock<DyedBedBlock> bed,
            DeferredBlock<DyedShulkerBoxBlock> shulkerBox) {
    }

    /** Dyed bricks with their slab, stairs and wall: vanilla bricks' properties in another map colour. */
    public record BrickSet(
            DeferredBlock<Block> bricks,
            DeferredBlock<SlabBlock> slab,
            DeferredBlock<StairBlock> stairs,
            DeferredBlock<WallBlock> wall) {
    }

    /** The dyed blocks in the four new colours. */
    public static final Map<Colour, DyeFamily> FAMILIES;
    /** Dyed bricks in all 20 colours. */
    public static final Map<Colour, BrickSet> BRICKS;
    /** The 17 new froglights (with vanilla's ochre, verdant and pearlescent that makes 20). Only dyeing a froglight makes them. */
    public static final List<DeferredBlock<RotatedPillarBlock>> FROGLIGHTS;

    static {
        Map<Colour, DyeFamily> families = new EnumMap<>(Colour.class);
        for (Colour colour : Colour.NEW) families.put(colour, family(colour));
        FAMILIES = Collections.unmodifiableMap(families);

        Map<Colour, BrickSet> bricks = new EnumMap<>(Colour.class);
        for (Colour colour : Colour.values()) bricks.put(colour, bricks(colour));
        BRICKS = Collections.unmodifiableMap(bricks);

        List<DeferredBlock<RotatedPillarBlock>> froglights = new ArrayList<>();
        froglights.add(froglight("clear", MapColor.SNOW, 15));
        froglights.add(froglight("cloudy", MapColor.COLOR_LIGHT_GRAY, 15));
        froglights.add(froglight("cascading", MapColor.COLOR_GRAY, 15));
        froglights.add(froglight("cloudburst", MapColor.COLOR_BLACK, 10));
        froglights.add(froglight("chamoisee", MapColor.COLOR_BROWN, 15));
        froglights.add(froglight("sanguine", MapColor.NETHER, 15));
        froglights.add(froglight("vermilion", MapColor.COLOR_RED, 15));
        froglights.add(froglight("mandarin", MapColor.COLOR_ORANGE, 15));
        froglights.add(froglight("lemon", MapColor.COLOR_YELLOW, 15));
        froglights.add(froglight("kiwi", MapColor.COLOR_LIGHT_GREEN, 15));
        froglights.add(froglight("seafoam", MapColor.WARPED_NYLIUM, 15));
        froglights.add(froglight("teal", MapColor.COLOR_CYAN, 15));
        froglights.add(froglight("cerulean", MapColor.COLOR_LIGHT_BLUE, 15));
        froglights.add(froglight("navy", MapColor.COLOR_BLUE, 15));
        froglights.add(froglight("lavender", MapColor.WARPED_HYPHAE, 15));
        froglights.add(froglight("thulian", MapColor.COLOR_MAGENTA, 15));
        froglights.add(froglight("sakura", MapColor.COLOR_PINK, 15));
        FROGLIGHTS = Collections.unmodifiableList(froglights);
    }

    /** The underwater torch: lit (light 13) only while waterlogged. */
    public static final DeferredBlock<GlowTorchBlock> GLOW_TORCH = BLOCKS.registerBlock("glow_torch", GlowTorchBlock::new, glowTorch());
    public static final DeferredBlock<WallGlowTorchBlock> GLOW_WALL_TORCH = BLOCKS.register("glow_wall_torch",
            () -> new WallGlowTorchBlock(glowTorch().dropsLike(GLOW_TORCH.get())));

    /** The vanilla clock, placed. It has no item of its own: the vanilla clock places it and is what it drops. */
    public static final DeferredBlock<FloorClockBlock> CLOCK = BLOCKS.registerBlock("clock", FloorClockBlock::new, clock());
    public static final DeferredBlock<WallClockBlock> WALL_CLOCK = BLOCKS.register("wall_clock",
            () -> new WallClockBlock(clock().dropsLike(CLOCK.get())));

    public static final DeferredBlock<KilnBlock> KILN = BLOCKS.registerBlock("kiln", KilnBlock::new, BlockBehaviour.Properties.of()
            .mapColor(MapColor.COLOR_LIGHT_GRAY)
            .instrument(NoteBlockInstrument.BASEDRUM)
            .sound(SoundType.GILDED_BLACKSTONE)
            .requiresCorrectToolForDrops()
            .strength(3.5F)
            .lightLevel(state -> state.getValue(KilnBlock.LIT) ? 13 : 0)); // like a lit furnace (upstream's gives no light)

    private static DyeFamily family(Colour colour) {
        String name = colour.getSerializedName();
        var concrete = BLOCKS.registerBlock(name + "_concrete", Block::new, like(Blocks.WHITE_CONCRETE).mapColor(colour.base));
        var candle = BLOCKS.registerBlock(name + "_candle", CandleBlock::new, like(Blocks.WHITE_CANDLE).mapColor(candleMapColour(colour)));
        return new DyeFamily(
                BLOCKS.registerBlock(name + "_wool", Block::new, like(Blocks.WHITE_WOOL).mapColor(colour.base)),
                BLOCKS.registerBlock(name + "_carpet", p -> new WoolCarpetBlock(colour.base, p), like(Blocks.WHITE_CARPET).mapColor(colour.base)),
                BLOCKS.registerBlock(name + "_terracotta", Block::new, like(Blocks.WHITE_TERRACOTTA).mapColor(terracottaMapColour(colour))),
                BLOCKS.registerBlock(name + "_glazed_terracotta", GlazedTerracottaBlock::new, like(Blocks.WHITE_GLAZED_TERRACOTTA).mapColor(colour.base)),
                concrete,
                BLOCKS.registerBlock(name + "_concrete_powder", p -> new ConcretePowderBlock(concrete.get(), p), like(Blocks.WHITE_CONCRETE_POWDER).mapColor(colour.base)),
                BLOCKS.registerBlock(name + "_stained_glass", p -> new DyedStainedGlassBlock(colour, p),
                        BlockBehaviour.Properties.ofFullCopy(Blocks.WHITE_STAINED_GLASS).mapColor(colour.base)),
                BLOCKS.registerBlock(name + "_stained_glass_pane", p -> new DyedStainedGlassPaneBlock(colour, p), like(Blocks.WHITE_STAINED_GLASS_PANE)),
                candle,
                // The constructor files the cake under its candle, so a candle put on a cake finds it (upstream crashed here).
                BLOCKS.registerBlock(name + "_candle_cake", p -> new CandleCakeBlock(candle.get(), p), like(Blocks.WHITE_CANDLE_CAKE)),
                BLOCKS.registerBlock(name + "_bed", p -> new DyedBedBlock(colour, p), like(Blocks.WHITE_BED)
                        .mapColor(state -> state.getValue(BedBlock.PART) == BedPart.FOOT ? colour.base.getMapColor() : MapColor.WOOL)),
                BLOCKS.registerBlock(name + "_shulker_box", p -> new DyedShulkerBoxBlock(colour, p),
                        BlockBehaviour.Properties.ofFullCopy(Blocks.WHITE_SHULKER_BOX).mapColor(colour.base)));
    }

    private static BrickSet bricks(Colour colour) {
        String name = colour.getSerializedName();
        MapColor mapColour = colour.base.getMapColor();
        var bricks = BLOCKS.registerBlock(name + "_bricks", Block::new, like(Blocks.BRICKS).mapColor(mapColour));
        return new BrickSet(
                bricks,
                BLOCKS.registerBlock(name + "_brick_slab", SlabBlock::new, like(Blocks.BRICK_SLAB).mapColor(mapColour)),
                BLOCKS.registerBlock(name + "_brick_stairs", p -> new StairBlock(bricks.get().defaultBlockState(), p), like(Blocks.BRICK_STAIRS).mapColor(mapColour)),
                BLOCKS.registerBlock(name + "_brick_wall", WallBlock::new, like(Blocks.BRICK_WALL).mapColor(mapColour)));
    }

    private static DeferredBlock<RotatedPillarBlock> froglight(String name, MapColor mapColour, int light) {
        return BLOCKS.registerBlock(name + "_froglight", RotatedPillarBlock::new,
                like(Blocks.OCHRE_FROGLIGHT).mapColor(mapColour).lightLevel(state -> light));
    }

    /** Upstream's map colours for terracotta, which uses the earthy terracotta tones. */
    private static MapColor terracottaMapColour(Colour colour) {
        return switch (colour) {
            case AMBER -> MapColor.TERRACOTTA_YELLOW;
            case AQUA -> MapColor.TERRACOTTA_LIGHT_BLUE;
            case INDIGO -> MapColor.TERRACOTTA_BLUE;
            default -> MapColor.TERRACOTTA_RED;
        };
    }

    /** Upstream's map colours for candles. */
    private static MapColor candleMapColour(Colour colour) {
        return switch (colour) {
            case AMBER -> MapColor.COLOR_YELLOW;
            case AQUA -> MapColor.WARPED_NYLIUM;
            case INDIGO -> MapColor.ICE;
            default -> MapColor.CRIMSON_HYPHAE;
        };
    }

    private static BlockBehaviour.Properties glowTorch() {
        return BlockBehaviour.Properties.of()
                .noCollission()
                .instabreak()
                .lightLevel(state -> state.getValue(GlowTorchBlock.WATERLOGGED) ? 13 : 0)
                .sound(SoundType.WOOD)
                .pushReaction(PushReaction.DESTROY);
    }

    private static BlockBehaviour.Properties clock() {
        return BlockBehaviour.Properties.of()
                .noCollission()
                .mapColor(MapColor.COLOR_YELLOW)
                .strength(0.2F)
                .sound(SoundType.METAL)
                .pushReaction(PushReaction.DESTROY);
    }

    /**
     * The properties of a vanilla block of the same kind (strength, sound, tool, light, push reaction...), the way vanilla
     * builds its own coloured variants. It doesn't copy the loot table, so each block keeps its own.
     */
    @SuppressWarnings("deprecation")
    private static BlockBehaviour.Properties like(Block vanilla) {
        return BlockBehaviour.Properties.ofLegacyCopy(vanilla);
    }

    private ModBlocks() {
    }
}
