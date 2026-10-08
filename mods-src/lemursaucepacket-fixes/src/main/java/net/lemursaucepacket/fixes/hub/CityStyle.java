package net.lemursaucepacket.fixes.hub;

import java.util.Map;

import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.SnowyDirtBlock;
import net.minecraft.world.level.block.state.BlockState;

/**
 * The capital's ground and trees, suited to the land it stands in. The city plan is written in the plains' style
 * (grass with patches of coarse dirt, oaks and birches); in a desert the same plan is laid in sand with palms, in the
 * snow it lies under snow among spruces, and so on, so the city looks as if it grew where it stands instead of
 * arriving on a green mat. {@link HubBuilder} picks one from what the land under the site is made of.
 *
 * @param cover  what the plan's grass becomes (the ground between the streets)
 * @param patch  what its coarse dirt becomes (null: coarse dirt)
 * @param under  the few blocks under the surface where the ground is built up
 * @param deep   further down, where a dip is filled
 * @param snow   lay snow over the ground (not the streets)
 * @param dry    no moss on the cobbles
 * @param trees  the plan's tree features swapped for this land's ("" leaves the tree out)
 */
record CityStyle(String label, BlockState cover, BlockState patch, BlockState under, BlockState deep, boolean snow, boolean dry, Map<String, String> trees) {

    static final CityStyle PLAINS = new CityStyle("plains", Blocks.GRASS_BLOCK.defaultBlockState(), null, Blocks.DIRT.defaultBlockState(), Blocks.STONE.defaultBlockState(), false, false, Map.of());
    static final CityStyle DESERT = new CityStyle("desert", Blocks.SAND.defaultBlockState(), Blocks.SANDSTONE.defaultBlockState(), Blocks.SAND.defaultBlockState(), Blocks.SANDSTONE.defaultBlockState(), false, true,
            Map.of("minecraft:oak", "regions_unexplored:tree/palm", "minecraft:birch", "regions_unexplored:tree/palm", "minecraft:fancy_oak", "regions_unexplored:tree/tall_palm"));
    static final CityStyle BADLANDS = new CityStyle("badlands", Blocks.RED_SAND.defaultBlockState(), Blocks.TERRACOTTA.defaultBlockState(), Blocks.RED_SAND.defaultBlockState(), Blocks.TERRACOTTA.defaultBlockState(), false, true,
            Map.of("minecraft:oak", "minecraft:patch_dead_bush", "minecraft:birch", "", "minecraft:fancy_oak", "minecraft:acacia"));
    static final CityStyle SNOWY = new CityStyle("snowy", Blocks.GRASS_BLOCK.defaultBlockState().setValue(SnowyDirtBlock.SNOWY, true), null, Blocks.DIRT.defaultBlockState(), Blocks.STONE.defaultBlockState(), true, false,
            Map.of("minecraft:oak", "minecraft:spruce", "minecraft:birch", "minecraft:spruce", "minecraft:fancy_oak", "minecraft:pine"));
    static final CityStyle TAIGA = new CityStyle("taiga", Blocks.GRASS_BLOCK.defaultBlockState(), Blocks.PODZOL.defaultBlockState(), Blocks.DIRT.defaultBlockState(), Blocks.STONE.defaultBlockState(), false, false,
            Map.of("minecraft:oak", "minecraft:spruce", "minecraft:birch", "minecraft:spruce", "minecraft:fancy_oak", "minecraft:mega_spruce"));
    static final CityStyle MUSHROOM = new CityStyle("mushroom", Blocks.MYCELIUM.defaultBlockState(), Blocks.DIRT.defaultBlockState(), Blocks.DIRT.defaultBlockState(), Blocks.STONE.defaultBlockState(), false, false,
            Map.of("minecraft:oak", "minecraft:huge_red_mushroom", "minecraft:birch", "minecraft:huge_brown_mushroom", "minecraft:fancy_oak", "minecraft:huge_red_mushroom"));
    static final CityStyle SWAMP = new CityStyle("swamp", Blocks.GRASS_BLOCK.defaultBlockState(), Blocks.MUD.defaultBlockState(), Blocks.DIRT.defaultBlockState(), Blocks.STONE.defaultBlockState(), false, false,
            Map.of("minecraft:oak", "minecraft:swamp_oak", "minecraft:birch", "minecraft:swamp_oak", "minecraft:fancy_oak", "minecraft:swamp_oak"));
    static final CityStyle JUNGLE = new CityStyle("jungle", Blocks.GRASS_BLOCK.defaultBlockState(), Blocks.MOSS_BLOCK.defaultBlockState(), Blocks.DIRT.defaultBlockState(), Blocks.STONE.defaultBlockState(), false, false,
            Map.of("minecraft:oak", "minecraft:jungle_bush", "minecraft:birch", "minecraft:jungle_tree_no_vine", "minecraft:fancy_oak", "minecraft:jungle_tree"));

    static CityStyle of(String label) {
        return switch (label) {
            case "desert" -> DESERT;
            case "badlands" -> BADLANDS;
            case "snowy" -> SNOWY;
            case "taiga" -> TAIGA;
            case "mushroom" -> MUSHROOM;
            case "swamp" -> SWAMP;
            case "jungle" -> JUNGLE;
            default -> PLAINS;
        };
    }

    /** One of the plan's block states in this style: its grass and coarse dirt, and in dry land its mossy cobbles. */
    BlockState swap(BlockState s) {
        if (s.is(Blocks.GRASS_BLOCK)) return cover;
        if (s.is(Blocks.COARSE_DIRT)) return patch != null ? patch : s;
        if (dry && s.is(Blocks.MOSSY_COBBLESTONE)) return Blocks.COBBLESTONE.defaultBlockState();
        return s;
    }

    /** Whether a plan state is the ground between the streets (which takes the snow), not a street. */
    boolean ground(BlockState planState) {
        return planState.is(Blocks.GRASS_BLOCK) || planState.is(Blocks.COARSE_DIRT);
    }
}
