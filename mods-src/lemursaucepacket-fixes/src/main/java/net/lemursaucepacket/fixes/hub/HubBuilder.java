package net.lemursaucepacket.fixes.hub;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import net.lemursaucepacket.fixes.zone.SafeZones;
import net.minecraft.commands.arguments.blocks.BlockStateParser;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.QuartPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.tags.BiomeTags;
import net.minecraft.tags.BlockTags;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.biome.Climate;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.RandomState;
import net.minecraft.world.level.levelgen.structure.templatesystem.BlockIgnoreProcessor;
import net.minecraft.world.level.levelgen.structure.templatesystem.JigsawReplacementProcessor;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate;
import net.neoforged.neoforge.common.Tags;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds the capital from {@link HubPlan}, a little each server tick: picks a dry, flat site a short way from world
 * spawn (out of sight, a few minutes' walk) in the kind of land a plains city belongs in, clear of the towns the world
 * will generate (from the noise and the structure sets, so nothing is generated for the search), loads the chunks,
 * reads what the land there is made of (sand, snow, podzol...) and lays the city out in that {@link CityStyle},
 * levels the ground and eases it back into the land around (gently, unevenly, in the land's own ground), paves the
 * streets, places every building, sets up the waystone and the lodestone the travellers' compass points at, and makes
 * the city a safe zone.
 */
public final class HubBuilder {
    static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/hub");
    private static final long BUDGET_NANOS = 20_000_000L; // per tick (doubled while nobody is online)
    private static final int FLAGS = Block.UPDATE_CLIENTS | Block.UPDATE_KNOWN_SHAPE;

    enum Phase { FIND, LOAD, SURVEY, TERRAIN, PAVE, PLACE, BLOCKS, COMMANDS, FINISH, DONE, FAILED }
    /** The widest the slope from the city back to the land gets (where the land lies far above or below it). */
    private static final int MAX_BLEND = 56;
    /** What a site in the wrong kind of land (desert, snow, sea, jungle...) costs, all of it unsuited. */
    private static final double UNSUITED = 90;

    private final MinecraftServer server;
    private final ServerLevel level;
    private final HubPlan plan;
    private final RandomSource random = RandomSource.create(20261005L);
    private Phase phase = Phase.FIND;
    private BlockPos centre;
    private int baseY;
    private int cursor;
    private int loadTicks;
    private final List<long[]> forced = new ArrayList<>();
    private final BlockPos requested;
    private long started = System.currentTimeMillis();
    private CityStyle style = CityStyle.PLAINS;
    /** Where along the city's edge the slope back to the land is wider or narrower (so it isn't a neat ring). */
    private final double[] edgePhase = {random.nextDouble() * 2 * Math.PI, random.nextDouble() * 2 * Math.PI, random.nextDouble() * 2 * Math.PI};

    /** @param at null to search near world spawn, or a fixed centre (the admin's /lsp hub build here). */
    HubBuilder(MinecraftServer server, HubPlan plan, BlockPos at) {
        this.server = server;
        this.level = server.overworld();
        this.plan = plan;
        this.requested = at;
    }

    public Phase phase() {
        return phase;
    }

    public String status() {
        int total = switch (phase) {
            case TERRAIN -> side() * side();
            case PAVE -> plan.paving().size();
            case PLACE -> plan.placements().size();
            case BLOCKS -> plan.blocks().size();
            case COMMANDS -> plan.commands().size();
            default -> 0;
        };
        return phase.name().toLowerCase() + (total > 0 ? " " + cursor + "/" + total : "") + (centre != null ? " at " + centre.toShortString() : "");
    }

    /** Runs for up to the tick budget. Returns true when finished (built or failed). */
    public boolean tick() {
        long until = System.nanoTime() + (server.getPlayerCount() == 0 ? 2 * BUDGET_NANOS : BUDGET_NANOS);
        try {
            while (System.nanoTime() < until) {
                switch (phase) {
                    case FIND -> find();
                    case LOAD -> {
                        if (!loaded()) return false;
                    }
                    case SURVEY -> survey();
                    case TERRAIN -> terrainStep();
                    case PAVE -> paveStep();
                    case PLACE -> placeStep();
                    case BLOCKS -> blockStep();
                    case COMMANDS -> commandStep();
                    case FINISH -> finish();
                    case DONE, FAILED -> {
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            LOGGER.error("Building the city failed in phase {}", phase, e);
            phase = Phase.FAILED;
            release();
            HubState.get(server).set(HubState.Status.SKIPPED, centre == null ? BlockPos.ZERO : centre, plan.version());
            return true;
        }
        return phase == Phase.DONE || phase == Phase.FAILED;
    }

    // ---------------------------------------------------------------- site

    private int side() {
        return 2 * (plan.flatRadius() + MAX_BLEND) + 1;
    }

    /** Search state: candidate centres for the current ring, and the best site so far. */
    private final List<int[]> candidates = new ArrayList<>();
    private int candidateAt;
    private int searchRadius = -1;
    private double bestScore = Double.MAX_VALUE;
    private BlockPos bestSite;
    private int bestGround;
    /** Towns the world will generate around spawn (worked out once, when the search starts). */
    private List<Settlements.Site> towns = List.of();
    /** A site this good (flat, dry, near spawn) ends the search early: after the ring, or at once if excellent. */
    private static final double GOOD_ENOUGH = 20;
    private static final double EXCELLENT = 8;
    /** Worse than this after the first ring (coast, island, mountains): look further out. Otherwise stay near. */
    private static final double WIDEN_ABOVE = 35;
    private static final int MAX_SEARCH = 1536;

    /**
     * Scores sites around world spawn from the noise alone (no chunks generated): flat, dry, not too low or high,
     * near spawn. One candidate per call, so the work spreads over ticks (each costs ~50 noise lookups, a few
     * milliseconds each with this pack's world generation). Starts within the plan's radius and widens (doubling,
     * up to 1536 blocks) until a good dry site turns up: some seeds spawn you on a coast or an island.
     */
    private void find() {
        ChunkGenerator gen = level.getChunkSource().getGenerator();
        RandomState rs = level.getChunkSource().randomState();
        int sea = gen.getSeaLevel();
        BlockPos spawn = requested != null ? requested : level.getSharedSpawnPos();
        if (searchRadius < 0) {
            searchRadius = requested != null ? 0 : plan.searchRadius();
            if (requested == null) {
                towns = Settlements.near(level, spawn.getX(), spawn.getZ(), MAX_SEARCH + 1000);
                LOGGER.info("{} towns planned within {} blocks of spawn ({} capitals)", towns.size(), MAX_SEARCH + 1000, towns.stream().filter(Settlements.Site::capital).count());
            }
            // Not at spawn: from minDistance out (out of sight), the nearest good site first.
            ring(spawn, requested != null ? 0 : plan.minDistance(), searchRadius, requested != null ? 1 : Math.max(32, plan.searchStep()));
        }
        if (candidateAt < candidates.size() && bestScore > EXCELLENT) {
            int[] c = candidates.get(candidateAt++);
            score(gen, rs, sea, spawn, c[0], c[1]);
            return;
        }
        // Ring done: stop if good enough (or nowhere left to look), else look further out.
        if (bestScore > (searchRadius <= plan.searchRadius() ? WIDEN_ABOVE : GOOD_ENOUGH) && requested == null && searchRadius < MAX_SEARCH) {
            int inner = searchRadius;
            searchRadius = Math.min(MAX_SEARCH, searchRadius * 2);
            LOGGER.info("No good site within {} blocks of spawn (best score {}); looking out to {}", inner, String.format("%.0f", bestScore), searchRadius);
            ring(spawn, inner, searchRadius, Math.max(64, searchRadius / 6));
            return;
        }
        centre = new BlockPos(bestSite.getX(), bestGround, bestSite.getZ());
        baseY = bestGround;
        LOGGER.info("City site: {} (score {}, ground y {})", centre.toShortString(), String.format("%.1f", bestScore), baseY);
        // Keep every chunk of the site loaded while we work.
        int reach = plan.flatRadius() + MAX_BLEND + 16;
        for (int cx = (centre.getX() - reach) >> 4; cx <= (centre.getX() + reach) >> 4; cx++)
            for (int cz = (centre.getZ() - reach) >> 4; cz <= (centre.getZ() + reach) >> 4; cz++) {
                level.setChunkForced(cx, cz, true);
                forced.add(new long[] {cx, cz});
            }
        HubState.get(server).set(HubState.Status.BUILDING, centre, plan.version());
        phase = Phase.LOAD;
    }

    /** Candidate centres on a grid between two distances from spawn (a square ring). */
    private void ring(BlockPos spawn, int inner, int outer, int step) {
        candidates.clear();
        candidateAt = 0;
        for (int ox = -outer; ox <= outer; ox += step)
            for (int oz = -outer; oz <= outer; oz += step)
                if (Math.max(Math.abs(ox), Math.abs(oz)) >= inner || inner == 0) candidates.add(new int[] {spawn.getX() + ox, spawn.getZ() + oz});
        // Nearest first, so an early good site is also a near one.
        candidates.sort((a, b) -> Double.compare(Math.hypot(a[0] - spawn.getX(), a[1] - spawn.getZ()), Math.hypot(b[0] - spawn.getX(), b[1] - spawn.getZ())));
    }

    private void score(ChunkGenerator gen, RandomState rs, int sea, BlockPos spawn, int cx, int cz) {
        int half = plan.flatRadius();
        List<Integer> heights = new ArrayList<>();
        List<Integer> levelAt = new ArrayList<>();
        Climate.Sampler sampler = rs.sampler();
        int water = 0;
        int unsuited = 0;
        int samples = 0;
        for (int i = -2; i <= 2; i++)
            for (int k = -2; k <= 2; k++) {
                int x = cx + i * half / 2;
                int z = cz + k * half / 2;
                int floor = gen.getBaseHeight(x, z, Heightmap.Types.OCEAN_FLOOR_WG, level, rs);
                int top = gen.getBaseHeight(x, z, Heightmap.Types.WORLD_SURFACE_WG, level, rs);
                samples++;
                if (top > floor + 1) water++;
                if (!suits(gen.getBiomeSource().getNoiseBiome(QuartPos.fromBlock(x), QuartPos.fromBlock(floor), QuartPos.fromBlock(z), sampler))) unsuited++;
                heights.add(floor);
                // The city's level: the edge counts twice (the walls meet the land there), so a city on a rise
                // isn't left standing on a plinth above the land around it.
                levelAt.add(floor);
                if (Math.abs(i) == 2 || Math.abs(k) == 2) levelAt.add(floor);
            }
        double mean = heights.stream().mapToInt(Integer::intValue).average().orElse(sea);
        double var = heights.stream().mapToDouble(h -> (h - mean) * (h - mean)).average().orElse(0);
        levelAt.sort(Integer::compare);
        int median = levelAt.get(levelAt.size() / 2);
        double wet = water / (double) samples;
        double away = Math.max(0, Math.hypot(cx - spawn.getX(), cz - spawn.getZ()) - plan.minDistance());
        double score = Math.sqrt(var) + wet * 200 + (wet > 0.12 ? 500 : 0) + away / 64.0 + UNSUITED * unsuited / samples
                + (median < sea + 2 ? 60 : 0) + Math.max(0, median - sea - 30) + townPenalty(cx, cz);
        if (score < bestScore) {
            bestScore = score;
            bestSite = new BlockPos(cx, median, cz);
            bestGround = Math.max(median, sea + 2);
        }
    }

    /**
     * Land a plains city belongs in: temperate and green, not desert or badlands, snow, sea or river, jungle, swamp or
     * mushroom isle. (It can still end up elsewhere when nothing suits within reach; {@link #survey} then dresses it
     * for the land it's in.)
     */
    static boolean suits(Holder<Biome> b) {
        float t = b.value().getBaseTemperature();
        if (t < 0.15f || t > 1.2f || !b.value().hasPrecipitation()) return false;
        return !(b.is(BiomeTags.IS_OCEAN) || b.is(BiomeTags.IS_DEEP_OCEAN) || b.is(BiomeTags.IS_RIVER) || b.is(BiomeTags.IS_BEACH) || b.is(BiomeTags.IS_JUNGLE)
                || b.is(Tags.Biomes.IS_SWAMP) || b.is(Tags.Biomes.IS_MUSHROOM) || b.is(Tags.Biomes.IS_DESERT) || b.is(Tags.Biomes.IS_SNOWY));
    }

    /**
     * Keeps the city off other towns (a town under the walls would be cut in half by the flattening) and well apart
     * from the other grand capitals (Lemurton is one of them, in the plains style).
     */
    private double townPenalty(int cx, int cz) {
        double p = 0;
        for (Settlements.Site t : towns) {
            double d = t.distance(cx, cz);
            if (d < Settlements.keepAway(t) + plan.flatRadius()) p += 1000;
            else if (t.capital() && d < 700) p += 60 * (700 - d) / 700;
        }
        return p;
    }

    private boolean loaded() {
        loadTicks++;
        for (long[] c : forced) {
            if (!level.hasChunk((int) c[0], (int) c[1])) {
                if (loadTicks % 100 == 0) LOGGER.info("Waiting for the city's chunks to load ({} ticks)", loadTicks);
                return false;
            }
        }
        phase = Phase.SURVEY;
        cursor = 0;
        return true;
    }

    /**
     * What the land under the city is made of, from one column in six each way: sand, red sand, snow, mycelium, or
     * grass in a taiga, swamp or jungle. The most common decides the {@link CityStyle} the city is laid out in.
     */
    private void survey() {
        int r = plan.flatRadius();
        Map<String, Integer> counts = new HashMap<>();
        BlockPos.MutableBlockPos p = new BlockPos.MutableBlockPos();
        for (int dx = -r; dx <= r; dx += 6)
            for (int dz = -r; dz <= r; dz += 6) {
                int x = centre.getX() + dx;
                int z = centre.getZ() + dz;
                int y = level.getHeight(Heightmap.Types.WORLD_SURFACE, x, z) - 1;
                boolean snow = false;
                while (y > level.getMinBuildHeight() && !ground(level.getBlockState(p.set(x, y, z)))) {
                    if (level.getBlockState(p).is(Blocks.SNOW)) snow = true;
                    y--;
                }
                BlockState s = level.getBlockState(p.set(x, y, z));
                Holder<Biome> b = level.getBiome(p.set(x, y + 1, z));
                String kind = snow || s.is(Blocks.SNOW_BLOCK) || s.is(Blocks.POWDER_SNOW) ? "snowy"
                        : s.is(Blocks.RED_SAND) || s.is(BlockTags.TERRACOTTA) ? "badlands"
                        : s.is(BlockTags.SAND) || s.is(Blocks.SANDSTONE) ? "desert"
                        : s.is(Blocks.MYCELIUM) ? "mushroom"
                        : s.is(Blocks.PODZOL) || b.is(BiomeTags.IS_TAIGA) ? "taiga"
                        : s.is(Blocks.MUD) || b.is(Tags.Biomes.IS_SWAMP) ? "swamp"
                        : b.is(BiomeTags.IS_JUNGLE) ? "jungle" : "plains";
                counts.merge(kind, 1, Integer::sum);
            }
        String kind = counts.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("plains");
        style = CityStyle.of(kind);
        LOGGER.info("The land under the city: {}; laying it out in the {} style", counts, style.label());
        phase = Phase.TERRAIN;
        cursor = 0;
    }

    // ---------------------------------------------------------------- terrain

    private static boolean ground(BlockState s) {
        if (s.isAir() || !s.getFluidState().isEmpty() || s.is(BlockTags.LOGS) || s.is(BlockTags.LEAVES) || s.is(BlockTags.REPLACEABLE)) return false;
        return s.is(BlockTags.DIRT) || s.is(BlockTags.BASE_STONE_OVERWORLD) || s.is(BlockTags.SAND) || s.is(Blocks.GRAVEL) || s.is(BlockTags.TERRACOTTA) || s.is(Blocks.CLAY) || s.is(Blocks.SANDSTONE) || s.is(Blocks.SNOW_BLOCK) || s.is(Blocks.PACKED_ICE);
    }

    /** A block the land is topped with (grass, sand, podzol, snow...), as opposed to bare rock. */
    private static boolean topsoil(BlockState s) {
        return s.is(BlockTags.DIRT) || s.is(BlockTags.SAND) || s.is(Blocks.GRAVEL) || s.is(BlockTags.TERRACOTTA) || s.is(Blocks.SNOW_BLOCK) || s.is(Blocks.CLAY) || s.is(Blocks.SANDSTONE) || s.is(Blocks.RED_SANDSTONE);
    }

    /** 0 to 1 round the city's edge, smooth: where the slope back to the land is narrower or wider. */
    private double edge(double angle) {
        return 0.5 + 0.25 * Math.sin(3 * angle + edgePhase[0]) + 0.15 * Math.sin(5 * angle + edgePhase[1]) + 0.1 * Math.sin(8 * angle + edgePhase[2]);
    }

    /**
     * One column: flat at baseY inside the city, easing back to the land outside it. The way back is round at the
     * corners, never steeper than about one block in three (so it reaches further where the land lies far above or
     * below the city), and wider or narrower along the edge, and it is laid in the land's own ground, so the city
     * sits in the land rather than on a plinth.
     */
    private void terrainStep() {
        int side = side();
        if (cursor >= side * side) {
            phase = Phase.PAVE;
            cursor = 0;
            return;
        }
        int reach = plan.flatRadius() + MAX_BLEND;
        int dx = cursor % side - reach;
        int dz = cursor / side - reach;
        cursor++;
        int x = centre.getX() + dx;
        int z = centre.getZ() + dz;
        int top = level.getHeight(Heightmap.Types.WORLD_SURFACE, x, z) - 1;
        // Natural ground: the first ground block below any trees or water.
        int natural = top;
        BlockPos.MutableBlockPos p = new BlockPos.MutableBlockPos(x, top, z);
        while (natural > level.getMinBuildHeight() && !ground(level.getBlockState(p.setY(natural)))) natural--;
        // How far outside the city's square this column is, measured round the corners (0 inside).
        int ox = Math.max(0, Math.abs(dx) - plan.flatRadius());
        int oz = Math.max(0, Math.abs(dz) - plan.flatRadius());
        double d = Math.sqrt(ox * ox + oz * oz);
        int target;
        if (d == 0) target = baseY;
        else {
            double width = Math.min(MAX_BLEND, Math.max(plan.blend(), Math.abs(natural - baseY) * 3.0)) * (0.75 + 0.5 * edge(Math.atan2(dz, dx)));
            if (d >= width) return; // the land here is left as it is
            double t = d / width;
            t = t * t * (3 - 2 * t);
            target = (int) Math.round(baseY + (natural - baseY) * t);
        }
        // The ground this column is topped with carries on over its new surface (sand in a desert, grass in a
        // meadow); inside the city, or where the land here is bare rock, the city's style decides.
        BlockState naturalTop = level.getBlockState(p.setY(natural));
        BlockState naturalUnder = level.getBlockState(p.setY(natural - 1));
        boolean snowed = level.getBlockState(p.setY(natural + 1)).is(Blocks.SNOW);
        BlockState surface = d > 0 && topsoil(naturalTop) ? naturalTop : style.cover();
        BlockState under = d > 0 && topsoil(naturalUnder) ? naturalUnder : style.under();
        // Inside the city, and wherever the slope lowers the ground, everything above the new surface goes. Where the
        // slope keeps or raises it (natural ground at or under the new surface), trees and plants stay.
        boolean clear = d == 0 || natural > target;
        if (clear)
            for (int y = Math.max(top, target + 1); y > target; y--) {
                BlockState s = level.getBlockState(p.setY(y));
                if (!s.isAir()) level.setBlock(p, Blocks.AIR.defaultBlockState(), FLAGS);
            }
        if (!clear && natural == target) return; // already the right height: leave its own ground and plants
        // Fill down to real ground (rivers, ponds, dips), at most 24 blocks: the topsoil, its subsoil, then rock.
        level.setBlock(p.setY(target), surface, FLAGS);
        for (int y = target - 1; y >= target - 24; y--) {
            BlockState s = level.getBlockState(p.setY(y));
            if (ground(s) && y < target - 3) break;
            if (!ground(s)) level.setBlock(p, y >= target - 3 ? under : style.deep(), FLAGS);
        }
        // Snow settles back where it lay (inside the city, the paving lays it).
        if (d > 0 && snowed && level.getBlockState(p.setY(target + 1)).isAir()) level.setBlock(p, Blocks.SNOW.defaultBlockState(), FLAGS);
    }

    // ---------------------------------------------------------------- streets, buildings, single blocks

    private BlockState parse(String s) throws Exception {
        return BlockStateParser.parseForBlock(level.holderLookup(Registries.BLOCK), s, false).blockState();
    }

    private void paveStep() throws Exception {
        if (cursor >= plan.paving().size()) {
            phase = Phase.PLACE;
            cursor = 0;
            return;
        }
        HubPlan.Paving pv = plan.paving().get(cursor++);
        // In the city's style: its grass becomes this land's ground, and snow lies on it where the land is snowy.
        List<BlockState> states = new ArrayList<>();
        List<Boolean> soil = new ArrayList<>();
        for (String s : pv.states()) {
            BlockState planned = parse(s);
            states.add(style.swap(planned));
            soil.add(style.ground(planned));
        }
        int total = pv.weights().stream().mapToInt(Integer::intValue).sum();
        BlockPos.MutableBlockPos p = new BlockPos.MutableBlockPos();
        for (int x = Math.min(pv.x1(), pv.x2()); x <= Math.max(pv.x1(), pv.x2()); x++)
            for (int z = Math.min(pv.z1(), pv.z2()); z <= Math.max(pv.z1(), pv.z2()); z++) {
                int roll = random.nextInt(total);
                int i = 0;
                while (roll >= pv.weights().get(i)) roll -= pv.weights().get(i++);
                p.set(centre.getX() + x, baseY + pv.y(), centre.getZ() + z);
                level.setBlock(p, states.get(i), FLAGS);
                // Snow on the ground between the streets; none on the streets (a street paves over earlier snow).
                BlockState above = level.getBlockState(p.move(0, 1, 0));
                if (soil.get(i) && style.snow()) {
                    if (above.isAir()) level.setBlock(p, Blocks.SNOW.defaultBlockState(), FLAGS);
                } else if (above.is(Blocks.SNOW)) level.setBlock(p, Blocks.AIR.defaultBlockState(), FLAGS);
            }
    }

    private void placeStep() {
        if (cursor >= plan.placements().size()) {
            phase = Phase.BLOCKS;
            cursor = 0;
            return;
        }
        HubPlan.Placement pl = plan.placements().get(cursor++);
        Optional<StructureTemplate> t = server.getStructureManager().get(ResourceLocation.parse(pl.template()));
        if (t.isEmpty()) {
            LOGGER.warn("City plan names a template that isn't in the pack: {}", pl.template());
            return;
        }
        BlockPos at = centre.offset(pl.x(), pl.y(), pl.z()).atY(baseY + pl.y());
        // Other mods' village pieces: jigsaw blocks become their final state (as when a village is assembled, so no
        // villagers or jigsaw blocks), and the structure blocks some leave in a corner are skipped.
        StructurePlaceSettings settings = new StructurePlaceSettings().setRotation(pl.rotation()).setIgnoreEntities(false).setKnownShape(true)
                .addProcessor(JigsawReplacementProcessor.INSTANCE).addProcessor(BlockIgnoreProcessor.STRUCTURE_BLOCK);
        t.get().placeInWorld(level, at, at, settings, random, Block.UPDATE_CLIENTS);
    }

    private void blockStep() throws Exception {
        if (cursor >= plan.blocks().size()) {
            phase = Phase.COMMANDS;
            cursor = 0;
            return;
        }
        HubPlan.Single b = plan.blocks().get(cursor++);
        level.setBlock(new BlockPos(centre.getX() + b.x(), baseY + b.y(), centre.getZ() + b.z()), style.swap(parse(b.state())), Block.UPDATE_ALL);
    }

    /** One plan command (trees from vanilla features and the like), run as the server from the city's centre. */
    private void commandStep() {
        if (cursor >= plan.commands().size()) {
            phase = Phase.FINISH;
            return;
        }
        String cmd = trees(plan.commands().get(cursor++));
        if (cmd.isEmpty()) return;
        net.minecraft.commands.CommandSourceStack source = server.createCommandSourceStack().withLevel(level)
                .withPosition(net.minecraft.world.phys.Vec3.atBottomCenterOf(centre)).withPermission(4).withSuppressedOutput();
        server.getCommands().performPrefixedCommand(source, cmd);
    }

    /**
     * A plan command in the city's style: "place feature minecraft:oak ..." plants this land's tree instead (a palm,
     * a spruce...), or nothing. A tree this pack's mods don't have stays as planned.
     */
    private String trees(String cmd) {
        if (!cmd.startsWith("place feature ")) return cmd;
        String[] parts = cmd.split(" ", 4);
        String swap = style.trees().get(parts[2]);
        if (swap == null) return cmd;
        if (swap.isEmpty()) return "";
        ResourceLocation id = ResourceLocation.tryParse(swap);
        if (id == null || !server.registryAccess().registryOrThrow(Registries.CONFIGURED_FEATURE).containsKey(id)) return cmd;
        return "place feature " + swap + (parts.length > 3 ? " " + parts[3] : "");
    }

    // ---------------------------------------------------------------- finishing

    private void finish() {
        HubPlan.Waystone w = plan.waystone();
        BlockPos ws = new BlockPos(centre.getX() + w.x(), baseY + w.y(), centre.getZ() + w.z());
        placeWaystone(ws, w.name(), w.facing());
        // The travellers' compass points at a lodestone under the waystone (out of sight; the city is a safe zone).
        level.setBlock(HubModule.lodestone(plan, centre), Blocks.LODESTONE.defaultBlockState(), Block.UPDATE_ALL);
        HubPlan.Zone z = plan.zone();
        SafeZones.get(server).put(new SafeZones.Zone(z.name(), level.dimension().location().toString(), centre.getX() + Math.min(z.x1(), z.x2()), level.getMinBuildHeight(),
                centre.getZ() + Math.min(z.z1(), z.z2()), centre.getX() + Math.max(z.x1(), z.x2()), level.getMaxBuildHeight() - 1, centre.getZ() + Math.max(z.z1(), z.z2()), EnumSet.allOf(SafeZones.Flag.class)));
        release();
        HubState.get(server).set(HubState.Status.BUILT, centre, plan.version());
        long secs = (System.currentTimeMillis() - started) / 1000;
        BlockPos spawn = level.getSharedSpawnPos();
        LOGGER.info("{} is built at {} in {} s ({} buildings), {} blocks from world spawn.", plan.name(), centre.toShortString(), secs, plan.placements().size(),
                (int) Math.hypot(centre.getX() - spawn.getX(), centre.getZ() - spawn.getZ()));
        for (ServerPlayer player : server.getPlayerList().getPlayers()) HubModule.welcome(player, plan, centre);
        phase = Phase.DONE;
    }


    private void release() {
        for (long[] c : forced) level.setChunkForced((int) c[0], (int) c[1], false);
        forced.clear();
    }

    /** The city's waystone: named and visible to everyone (GLOBAL). */
    private void placeWaystone(BlockPos pos, String name, String facing) {
        Waystones.place(level, pos, name, facing, true);
    }
}
