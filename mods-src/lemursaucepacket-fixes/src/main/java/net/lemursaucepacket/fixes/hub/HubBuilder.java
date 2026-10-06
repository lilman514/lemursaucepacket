package net.lemursaucepacket.fixes.hub;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

import net.lemursaucepacket.fixes.zone.SafeZones;
import net.minecraft.commands.arguments.blocks.BlockStateParser;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.tags.BlockTags;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.GameRules;
import net.minecraft.world.level.ServerLevelAccessor;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds the spawn city from {@link HubPlan}, a little each server tick: picks a dry, flat site near world
 * spawn (from the noise, so nothing is generated for the search), loads the chunks, flattens the ground with a
 * blended edge, paves the streets, places every building, sets up the waystone, moves world spawn to the plaza
 * and makes the city a safe zone.
 */
public final class HubBuilder {
    static final Logger LOGGER = LoggerFactory.getLogger("lsp_fixes/hub");
    private static final long BUDGET_NANOS = 20_000_000L; // per tick (doubled while nobody is online)
    private static final int FLAGS = Block.UPDATE_CLIENTS | Block.UPDATE_KNOWN_SHAPE;

    enum Phase { FIND, LOAD, TERRAIN, PAVE, PLACE, BLOCKS, COMMANDS, FINISH, DONE, FAILED }

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
        return 2 * (plan.flatRadius() + plan.blend()) + 1;
    }

    /** Search state: candidate centres for the current ring, and the best site so far. */
    private final List<int[]> candidates = new ArrayList<>();
    private int candidateAt;
    private int searchRadius = -1;
    private double bestScore = Double.MAX_VALUE;
    private BlockPos bestSite;
    private int bestGround;
    /** A site this good (flat, dry, near spawn) ends the search early. */
    private static final double GOOD_ENOUGH = 20;
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
            ring(spawn, 0, searchRadius, requested != null ? 1 : Math.max(32, plan.searchStep() * 2));
        }
        if (candidateAt < candidates.size()) {
            int[] c = candidates.get(candidateAt++);
            score(gen, rs, sea, spawn, c[0], c[1]);
            return;
        }
        // Ring done: stop if good enough (or nowhere left to look), else look further out.
        if (bestScore > GOOD_ENOUGH && requested == null && searchRadius < MAX_SEARCH) {
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
        int reach = plan.flatRadius() + plan.blend() + 16;
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
        int water = 0;
        int samples = 0;
        for (int i = -2; i <= 2; i++)
            for (int k = -2; k <= 2; k++) {
                int x = cx + i * half / 2;
                int z = cz + k * half / 2;
                int floor = gen.getBaseHeight(x, z, Heightmap.Types.OCEAN_FLOOR_WG, level, rs);
                int top = gen.getBaseHeight(x, z, Heightmap.Types.WORLD_SURFACE_WG, level, rs);
                samples++;
                if (top > floor + 1) water++;
                heights.add(floor);
            }
        heights.sort(Integer::compare);
        double mean = heights.stream().mapToInt(Integer::intValue).average().orElse(sea);
        double var = heights.stream().mapToDouble(h -> (h - mean) * (h - mean)).average().orElse(0);
        int median = heights.get(heights.size() / 2);
        double wet = water / (double) samples;
        double score = Math.sqrt(var) + wet * 200 + (wet > 0.12 ? 500 : 0) + Math.hypot(cx - spawn.getX(), cz - spawn.getZ()) / 64.0
                + (median < sea + 2 ? 60 : 0) + Math.max(0, median - sea - 30);
        if (score < bestScore) {
            bestScore = score;
            bestSite = new BlockPos(cx, median, cz);
            bestGround = Math.max(median, sea + 2);
        }
    }

    private boolean loaded() {
        loadTicks++;
        for (long[] c : forced) {
            if (!level.hasChunk((int) c[0], (int) c[1])) {
                if (loadTicks % 100 == 0) LOGGER.info("Waiting for the city's chunks to load ({} ticks)", loadTicks);
                return false;
            }
        }
        phase = Phase.TERRAIN;
        cursor = 0;
        return true;
    }

    // ---------------------------------------------------------------- terrain

    private static boolean ground(BlockState s) {
        if (s.isAir() || !s.getFluidState().isEmpty() || s.is(BlockTags.LOGS) || s.is(BlockTags.LEAVES) || s.is(BlockTags.REPLACEABLE)) return false;
        return s.is(BlockTags.DIRT) || s.is(BlockTags.BASE_STONE_OVERWORLD) || s.is(BlockTags.SAND) || s.is(Blocks.GRAVEL) || s.is(BlockTags.TERRACOTTA) || s.is(Blocks.CLAY) || s.is(Blocks.SANDSTONE) || s.is(Blocks.SNOW_BLOCK) || s.is(Blocks.PACKED_ICE);
    }

    /** One column: flat at baseY inside the city, easing back to the natural ground across the blend ring. */
    private void terrainStep() {
        int side = side();
        if (cursor >= side * side) {
            phase = Phase.PAVE;
            cursor = 0;
            return;
        }
        int reach = plan.flatRadius() + plan.blend();
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
        int d = Math.max(Math.abs(dx), Math.abs(dz));
        int target;
        if (d <= plan.flatRadius()) target = baseY;
        else {
            double t = (d - plan.flatRadius()) / (double) plan.blend();
            t = t * t * (3 - 2 * t);
            target = (int) Math.round(baseY + (natural - baseY) * t);
        }
        for (int y = Math.max(top, target + 1); y > target; y--) {
            BlockState s = level.getBlockState(p.setY(y));
            if (!s.isAir()) level.setBlock(p, Blocks.AIR.defaultBlockState(), FLAGS);
        }
        // Fill down to real ground (rivers, ponds, dips), at most 24 blocks; grass on top, dirt, then stone.
        level.setBlock(p.setY(target), Blocks.GRASS_BLOCK.defaultBlockState(), FLAGS);
        for (int y = target - 1; y >= target - 24; y--) {
            BlockState s = level.getBlockState(p.setY(y));
            if (ground(s) && y < target - 3) break;
            if (!ground(s)) level.setBlock(p, (y >= target - 3 ? Blocks.DIRT : Blocks.STONE).defaultBlockState(), FLAGS);
        }
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
        List<BlockState> states = new ArrayList<>();
        for (String s : pv.states()) states.add(parse(s));
        int total = pv.weights().stream().mapToInt(Integer::intValue).sum();
        BlockPos.MutableBlockPos p = new BlockPos.MutableBlockPos();
        for (int x = Math.min(pv.x1(), pv.x2()); x <= Math.max(pv.x1(), pv.x2()); x++)
            for (int z = Math.min(pv.z1(), pv.z2()); z <= Math.max(pv.z1(), pv.z2()); z++) {
                int roll = random.nextInt(total);
                int i = 0;
                while (roll >= pv.weights().get(i)) roll -= pv.weights().get(i++);
                p.set(centre.getX() + x, baseY + pv.y(), centre.getZ() + z);
                level.setBlock(p, states.get(i), FLAGS);
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
        level.setBlock(new BlockPos(centre.getX() + b.x(), baseY + b.y(), centre.getZ() + b.z()), parse(b.state()), Block.UPDATE_ALL);
    }

    /** One plan command (trees from vanilla features and the like), run as the server from the city's centre. */
    private void commandStep() {
        if (cursor >= plan.commands().size()) {
            phase = Phase.FINISH;
            return;
        }
        String cmd = plan.commands().get(cursor++);
        net.minecraft.commands.CommandSourceStack source = server.createCommandSourceStack().withLevel(level)
                .withPosition(net.minecraft.world.phys.Vec3.atBottomCenterOf(centre)).withPermission(4).withSuppressedOutput();
        server.getCommands().performPrefixedCommand(source, cmd);
    }

    // ---------------------------------------------------------------- finishing

    private void finish() {
        HubPlan.Waystone w = plan.waystone();
        BlockPos ws = new BlockPos(centre.getX() + w.x(), baseY + w.y(), centre.getZ() + w.z());
        placeWaystone(ws, w.name(), w.facing());
        int[] sp = plan.spawn();
        BlockPos spawn = new BlockPos(centre.getX() + sp[0], baseY + sp[1], centre.getZ() + sp[2]);
        level.setDefaultSpawnPos(spawn, 0.0F);
        server.getGameRules().getRule(GameRules.RULE_SPAWN_RADIUS).set(0, server);
        HubPlan.Zone z = plan.zone();
        SafeZones.get(server).put(new SafeZones.Zone(z.name(), level.dimension().location().toString(), centre.getX() + Math.min(z.x1(), z.x2()), level.getMinBuildHeight(),
                centre.getZ() + Math.min(z.z1(), z.z2()), centre.getX() + Math.max(z.x1(), z.x2()), level.getMaxBuildHeight() - 1, centre.getZ() + Math.max(z.z1(), z.z2()), EnumSet.allOf(SafeZones.Flag.class)));
        release();
        HubState.get(server).set(HubState.Status.BUILT, centre, plan.version());
        long secs = (System.currentTimeMillis() - started) / 1000;
        LOGGER.info("{} is built at {} in {} s ({} buildings). World spawn is its plaza.", plan.name(), centre.toShortString(), secs, plan.placements().size());
        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            player.sendSystemMessage(Component.literal("§6" + plan.name() + " §7is ready. Welcome!"));
            player.teleportTo(level, spawn.getX() + 0.5, spawn.getY(), spawn.getZ() + 0.5, player.getYRot(), player.getXRot());
        }
        phase = Phase.DONE;
    }

    private void release() {
        for (long[] c : forced) level.setChunkForced((int) c[0], (int) c[1], false);
        forced.clear();
    }

    /**
     * Places a waystone and registers it like a village one, named and visible to everyone (GLOBAL). The
     * Waystones mod has no API for that, so this goes through reflection; without the mod it's just skipped.
     */
    private void placeWaystone(BlockPos pos, String name, String facing) {
        try {
            BlockState lower = parse("waystones:waystone[half=lower,facing=" + facing + "]");
            BlockState upper = parse("waystones:waystone[half=upper,facing=" + facing + "]");
            level.setBlock(pos, lower, Block.UPDATE_ALL);
            level.setBlock(pos.above(), upper, Block.UPDATE_ALL);
            BlockEntity be = level.getBlockEntity(pos);
            if (be == null) {
                LOGGER.warn("The waystone at {} has no block entity", pos.toShortString());
                return;
            }
            Class<?> originCls = Class.forName("net.blay09.mods.waystones.api.WaystoneOrigin");
            Class<?> visCls = Class.forName("net.blay09.mods.waystones.api.WaystoneVisibility");
            Object village = enumValue(originCls, "VILLAGE");
            be.getClass().getMethod("initializeWaystone", ServerLevelAccessor.class, net.minecraft.world.entity.LivingEntity.class, originCls).invoke(be, level, null, village);
            Object waystone = be.getClass().getMethod("getWaystone").invoke(be);
            waystone.getClass().getMethod("setName", Component.class).invoke(waystone, Component.literal(name));
            waystone.getClass().getMethod("setVisibility", visCls).invoke(waystone, enumValue(visCls, "GLOBAL"));
            Class<?> mgrCls = Class.forName("net.blay09.mods.waystones.core.WaystoneManagerImpl");
            Class<?> apiWaystone = Class.forName("net.blay09.mods.waystones.api.Waystone");
            Object mgr = mgrCls.getMethod("get", MinecraftServer.class).invoke(null, server);
            mgrCls.getMethod("updateWaystone", apiWaystone).invoke(mgr, waystone);
            Class.forName("net.blay09.mods.waystones.core.WaystoneSyncManager").getMethod("sendWaystoneUpdateToAll", MinecraftServer.class, apiWaystone).invoke(null, server, waystone);
            be.setChanged();
            LOGGER.info("Waystone '{}' at {}", name, pos.toShortString());
        } catch (ClassNotFoundException e) {
            LOGGER.info("Waystones isn't installed; no waystone in the city");
        } catch (Exception e) {
            LOGGER.warn("Couldn't set up the city's waystone", e);
        }
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Object enumValue(Class<?> cls, String name) {
        return Enum.valueOf((Class<Enum>) cls, name);
    }
}
