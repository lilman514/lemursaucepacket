package net.lemursaucepacket.fixes.hub;

import java.util.ArrayList;
import java.util.List;

import net.minecraft.core.Holder;
import net.minecraft.core.HolderSet;
import net.minecraft.core.QuartPos;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.tags.StructureTags;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.biome.BiomeSource;
import net.minecraft.world.level.biome.Climate;
import net.minecraft.world.level.chunk.ChunkGeneratorStructureState;
import net.minecraft.world.level.levelgen.structure.Structure;
import net.minecraft.world.level.levelgen.structure.StructureSet;

/**
 * Where villages and capitals will generate, worked out from the world's seed and structure sets (nothing is
 * generated): the same checks the game makes per chunk (placement, then the structure whose biomes include the
 * biome there). Used to keep world spawn out of towns and Lemurton away from other capitals.
 */
public final class Settlements {
    /** A planned town: its structure, the middle of its start chunk, and whether it's one of the grand capitals. */
    public record Site(ResourceLocation structure, int x, int z, boolean capital) {
        public double distance(int bx, int bz) {
            return Math.hypot(x - bx, z - bz);
        }
    }

    private Settlements() {
    }

    /**
     * Every planned town within `radius` blocks of (bx, bz). The vanilla village structures are the grand
     * capitals here (Luki's Grand Capitals replaces them); other mods' villages count as villages.
     */
    public static List<Site> near(ServerLevel level, int bx, int bz, int radius) {
        List<Site> out = new ArrayList<>();
        ChunkGeneratorStructureState state = level.getChunkSource().getGeneratorState();
        Registry<Structure> registry = level.registryAccess().registryOrThrow(Registries.STRUCTURE);
        HolderSet<Structure> villages = registry.getTag(StructureTags.VILLAGE).map(t -> (HolderSet<Structure>) t).orElse(HolderSet.<Structure>direct());
        BiomeSource biomes = level.getChunkSource().getGenerator().getBiomeSource();
        Climate.Sampler sampler = level.getChunkSource().randomState().sampler();
        int qy = QuartPos.fromBlock(level.getSeaLevel() + 8);
        int cr = (radius >> 4) + 1;
        int ccx = bx >> 4;
        int ccz = bz >> 4;
        for (Holder<StructureSet> holder : state.possibleStructureSets()) {
            StructureSet set = holder.value();
            if (set.structures().stream().noneMatch(e -> villages.contains(e.structure()))) continue;
            for (int cx = ccx - cr; cx <= ccx + cr; cx++)
                for (int cz = ccz - cr; cz <= ccz + cr; cz++) {
                    if (!set.placement().isStructureChunk(state, cx, cz)) continue;
                    int x = (cx << 4) + 8;
                    int z = (cz << 4) + 8;
                    if (Math.hypot(x - bx, z - bz) > radius) continue;
                    Holder<Biome> biome = biomes.getNoiseBiome(QuartPos.fromBlock(x), qy, QuartPos.fromBlock(z), sampler);
                    for (StructureSet.StructureSelectionEntry e : set.structures()) {
                        if (!villages.contains(e.structure()) || !e.structure().value().biomes().contains(biome)) continue;
                        ResourceLocation id = e.structure().unwrapKey().map(k -> k.location()).orElse(ResourceLocation.withDefaultNamespace("village"));
                        out.add(new Site(id, x, z, isCapital(id)));
                        break;
                    }
                }
        }
        return out;
    }

    /** The grand capitals are the vanilla village structures, which Luki's Grand Capitals replaces. */
    public static boolean isCapital(ResourceLocation structure) {
        return structure.getNamespace().equals("minecraft") && structure.getPath().startsWith("village_");
    }

    /** How close world spawn or Lemurton may come to a town of this kind (from its start chunk), in blocks. */
    public static int keepAway(Site s) {
        return s.capital() ? 260 : 150;
    }
}
