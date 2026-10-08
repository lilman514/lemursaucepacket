package net.lemursaucepacket.fixes.hub;

import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.annotation.Nullable;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.QuartPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.biome.BiomeSource;
import net.minecraft.world.level.biome.Climate;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.RandomState;
import net.neoforged.fml.loading.FMLPaths;

/**
 * A brand-new world's spawn in starter land (pack 1.16.0, the owner: "make sure that the spawn area doesnt contain high
 * tier biomes right away, so the player is actually able to play and collect resources and not die"; the first world
 * spawned them among acacias they couldn't chop). config/lemursaucepacket/starter_biomes.json (skills/build.mjs writes
 * it from the wiki's atlas and the chopping levels) sorts the biomes: starter land (temperate forests and plains whose
 * trees anyone can chop), land in the way (any tree that needs a Woodcutting level, snow, desert, savanna, jungle,
 * swamp, mountains, caves) and the rest (treeless plains, rivers, beaches, the sea).
 *
 * <p>Spawn goes to the nearest dry spot in starter land, clear of the towns the world will generate, with nothing in
 * the way within {@code innerRadius}, at least {@code minStarterShare} starter land there, and no more than
 * {@code maxBadShare} in the way within {@code outerRadius}. It's all worked out from the world's noise (no chunks are
 * generated), once, before the capital looks for its site round the new spawn.
 */
final class StarterSpawn {
    /** Rings sampled round a candidate: radius as a share of the inner or outer radius, and how many points. */
    private static final double[][] INNER_RINGS = {{0.375, 8}, {0.75, 12}, {1.0, 16}};
    private static final double[][] OUTER_RINGS = {{0.75, 16}, {1.0, 24}};
    private static final int STEP = 64;
    /** A new world waits for this at most (it runs once, before anyone can join): then the least bad spot so far. */
    private static final long BUDGET_MS = 60_000;

    private enum Land { STARTER, NEITHER, IN_THE_WAY }

    private record Rules(Set<String> starter, Set<String> neither, int inner, int outer, double minStarter, double maxBad, int search) {
    }

    private final ServerLevel level;
    private final ChunkGenerator gen;
    private final RandomState rs;
    private final BiomeSource biomes;
    private final Climate.Sampler sampler;
    private final Rules rules;

    private StarterSpawn(ServerLevel level, Rules rules) {
        this.level = level;
        this.gen = level.getChunkSource().getGenerator();
        this.rs = level.getChunkSource().randomState();
        this.biomes = gen.getBiomeSource();
        this.sampler = rs.sampler();
        this.rules = rules;
    }

    static Path file() {
        return FMLPaths.CONFIGDIR.get().resolve("lemursaucepacket").resolve("starter_biomes.json");
    }

    /**
     * Moves world spawn into starter land, clear of the towns the world will generate (as {@link HubModule} wants).
     * Returns whether spawn is in starter land with nothing in the way now.
     */
    static boolean choose(ServerLevel level) {
        Rules rules = read();
        if (rules == null) return false;
        BlockPos spawn = level.getSharedSpawnPos();
        List<Settlements.Site> towns = Settlements.near(level, spawn.getX(), spawn.getZ(), rules.search() + 1600);
        return new StarterSpawn(level, rules).run(towns);
    }

    @Nullable
    private static Rules read() {
        Path file = file();
        if (!Files.isRegularFile(file)) {
            HubBuilder.LOGGER.warn("No {}: world spawn stays where the world put it", file);
            return null;
        }
        try (Reader reader = Files.newBufferedReader(file)) {
            JsonObject root = JsonParser.parseReader(reader).getAsJsonObject();
            Set<String> starter = new HashSet<>(), neither = new HashSet<>();
            for (JsonElement e : root.getAsJsonArray("starter")) starter.add(e.getAsString());
            for (JsonElement e : root.getAsJsonArray("neutral")) neither.add(e.getAsString());
            return new Rules(starter, neither, root.get("innerRadius").getAsInt(), root.get("outerRadius").getAsInt(),
                    root.get("minStarterShare").getAsDouble(), root.get("maxBadShare").getAsDouble(), root.get("searchRadius").getAsInt());
        } catch (Exception e) {
            HubBuilder.LOGGER.error("Can't read {}: world spawn stays where the world put it", file, e);
            return null;
        }
    }

    /** One sample: the biome at the surface there. */
    private Land land(int x, int z) {
        int top = gen.getBaseHeight(x, z, Heightmap.Types.WORLD_SURFACE_WG, level, rs);
        return land(biomes.getNoiseBiome(QuartPos.fromBlock(x), QuartPos.fromBlock(top), QuartPos.fromBlock(z), sampler));
    }

    private Land land(Holder<Biome> biome) {
        String id = biome.unwrapKey().map(k -> k.location().toString()).orElse("");
        if (rules.starter().contains(id)) return Land.STARTER;
        if (rules.neither().contains(id)) return Land.NEITHER;
        return Land.IN_THE_WAY;
    }

    private String biomeAt(int x, int z) {
        int top = gen.getBaseHeight(x, z, Heightmap.Types.WORLD_SURFACE_WG, level, rs);
        return biomes.getNoiseBiome(QuartPos.fromBlock(x), QuartPos.fromBlock(top), QuartPos.fromBlock(z), sampler)
                .unwrapKey().map(k -> k.location().toString()).orElse("?");
    }

    /** How a candidate scores: what's in the way near and far, how much starter land is near. */
    private record Score(int x, int z, int badInner, double starterInner, double badOuter) {
        boolean good(Rules r) {
            return badInner == 0 && starterInner >= r.minStarter() && badOuter <= r.maxBad();
        }

        /** Lower is better, for when nothing is good. */
        double cost() {
            return badInner * 10.0 + badOuter * 20 + (1 - starterInner) * 5;
        }
    }

    /** Scores the spot, or null if it isn't dry starter land itself. Stops early once something near is in the way. */
    @Nullable
    private Score score(int x, int z) {
        // Most spots fail on their own biome: look at it before the second height lookup.
        int top = gen.getBaseHeight(x, z, Heightmap.Types.WORLD_SURFACE_WG, level, rs);
        if (land(biomes.getNoiseBiome(QuartPos.fromBlock(x), QuartPos.fromBlock(top), QuartPos.fromBlock(z), sampler)) != Land.STARTER) return null;
        int floor = gen.getBaseHeight(x, z, Heightmap.Types.OCEAN_FLOOR_WG, level, rs);
        if (top > floor + 1 || floor < gen.getSeaLevel()) return null; // under water
        int bad = 0, starter = 1, n = 1;
        for (double[] ring : INNER_RINGS) {
            int count = (int) ring[1];
            double r = rules.inner() * ring[0];
            for (int k = 0; k < count; k++) {
                double a = 2 * Math.PI * k / count;
                Land l = land(x + (int) Math.round(Math.cos(a) * r), z + (int) Math.round(Math.sin(a) * r));
                n++;
                if (l == Land.IN_THE_WAY) bad++;
                else if (l == Land.STARTER) starter++;
            }
            if (bad > 2) return new Score(x, z, bad, (double) starter / n, 1); // no use looking further out
        }
        double starterShare = (double) starter / n;
        int outerBad = 0, outerN = 0;
        for (double[] ring : OUTER_RINGS) {
            int count = (int) ring[1];
            double r = rules.inner() + (rules.outer() - rules.inner()) * ring[0];
            for (int k = 0; k < count; k++) {
                double a = 2 * Math.PI * (k + 0.5) / count;
                outerN++;
                if (land(x + (int) Math.round(Math.cos(a) * r), z + (int) Math.round(Math.sin(a) * r)) == Land.IN_THE_WAY) outerBad++;
            }
        }
        return new Score(x, z, bad, starterShare, (double) outerBad / outerN);
    }

    private boolean run(List<Settlements.Site> towns) {
        BlockPos spawn = level.getSharedSpawnPos();
        long started = System.currentTimeMillis();
        Score best = null;
        int tried = 0;
        // Rings outward from where the world put spawn, nearest first.
        for (int r = 0; r <= rules.search(); r += STEP) {
            int count = r == 0 ? 1 : (int) Math.ceil(2 * Math.PI * r / STEP);
            for (int k = 0; k < count; k++) {
                double a = 2 * Math.PI * k / count + r * 0.003;
                int x = spawn.getX() + (int) Math.round(Math.cos(a) * r);
                int z = spawn.getZ() + (int) Math.round(Math.sin(a) * r);
                if (!towns.stream().allMatch(t -> t.distance(x, z) >= Settlements.keepAway(t))) continue;
                Score s = score(x, z);
                tried++;
                if (s == null) continue;
                if (s.good(rules)) return settle(spawn, s, tried, started);
                if (best == null || s.cost() < best.cost()) best = s;
            }
            if (System.currentTimeMillis() - started > BUDGET_MS) break;
        }
        if (best != null) {
            HubBuilder.LOGGER.warn("No spawn in starter land with nothing in the way turned up within {} blocks ({} spots in {} ms); using the least bad",
                    rules.search(), tried, System.currentTimeMillis() - started);
            settle(spawn, best, tried, started);
            return false;
        }
        HubBuilder.LOGGER.warn("No dry starter land within {} blocks of spawn ({} spots): leaving spawn at {} in {}", rules.search(), tried, spawn.toShortString(), biomeAt(spawn.getX(), spawn.getZ()));
        return false;
    }

    private boolean settle(BlockPos was, Score s, int tried, long started) {
        int y = gen.getBaseHeight(s.x(), s.z(), Heightmap.Types.WORLD_SURFACE_WG, level, rs);
        BlockPos at = new BlockPos(s.x(), y, s.z());
        String from = biomeAt(was.getX(), was.getZ());
        level.setDefaultSpawnPos(at, 0.0F);
        HubBuilder.LOGGER.info("World spawn is in starter land: {} at {} ({} blocks from where the world put it, in {}; {} in the way within {} blocks, {}% starter land there, {}% in the way within {}; {} spots in {} ms)",
                biomeAt(s.x(), s.z()), at.toShortString(), (int) Math.hypot(s.x() - was.getX(), s.z() - was.getZ()), from, s.badInner(), rules.inner(),
                Math.round(s.starterInner() * 100), Math.round(s.badOuter() * 100), rules.outer(), tried, System.currentTimeMillis() - started);
        return true;
    }
}
