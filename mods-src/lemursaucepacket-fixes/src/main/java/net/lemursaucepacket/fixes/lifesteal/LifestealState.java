package net.lemursaucepacket.fixes.lifesteal;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.StringTag;
import net.minecraft.nbt.Tag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.saveddata.SavedData;

/**
 * World-wide lifesteal bookkeeping, saved in the overworld's data folder as {@code lsp_fixes_lifesteal.dat}:
 * which lives have been erased, which chunks hold blocks each player placed, and the erasures still running.
 */
public final class LifestealState extends SavedData {
    private static final String NAME = "lsp_fixes_lifesteal";
    private static final Factory<LifestealState> FACTORY = new Factory<>(LifestealState::new, LifestealState::load, null);

    /** uuid -> highest life number that has been erased. */
    private final Map<UUID, Integer> erased = new HashMap<>();
    /** uuid -> chunk keys ("dimension|cx|cz") where that player placed blocks, any life. */
    private final Map<UUID, Set<String>> placedChunks = new HashMap<>();
    private final List<EraseJob> jobs = new ArrayList<>();

    public static LifestealState get(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(FACTORY, NAME);
    }

    public static String chunkKey(String dimension, int cx, int cz) {
        return dimension + "|" + cx + "|" + cz;
    }

    public boolean isErased(Ownership.Owner owner) {
        Integer gen = erased.get(owner.uuid());
        return gen != null && owner.generation() <= gen;
    }

    /** False until the first erasure ever: the purge checkpoints then cost nothing. */
    public boolean hasErasures() {
        return !erased.isEmpty();
    }

    public int erasedGeneration(UUID uuid) {
        Integer gen = erased.get(uuid);
        return gen == null ? -1 : gen;
    }

    public void markErased(UUID uuid, int generation) {
        erased.merge(uuid, generation, Math::max);
        setDirty();
    }

    public void rememberChunk(UUID uuid, String chunkKey) {
        if (placedChunks.computeIfAbsent(uuid, u -> new LinkedHashSet<>()).add(chunkKey)) setDirty();
    }

    public Set<String> placedChunks(UUID uuid) {
        return placedChunks.getOrDefault(uuid, Set.of());
    }

    public List<EraseJob> jobs() {
        return jobs;
    }

    public void addJob(EraseJob job) {
        jobs.add(job);
        setDirty();
    }

    private static LifestealState load(CompoundTag tag, HolderLookup.Provider provider) {
        LifestealState state = new LifestealState();
        CompoundTag erasedTag = tag.getCompound("erased");
        for (String key : erasedTag.getAllKeys()) {
            try {
                state.erased.put(UUID.fromString(key), erasedTag.getInt(key));
            } catch (IllegalArgumentException ignored) {
            }
        }
        CompoundTag chunksTag = tag.getCompound("placedChunks");
        for (String key : chunksTag.getAllKeys()) {
            try {
                Set<String> set = new LinkedHashSet<>();
                for (Tag t : chunksTag.getList(key, Tag.TAG_STRING)) set.add(t.getAsString());
                state.placedChunks.put(UUID.fromString(key), set);
            } catch (IllegalArgumentException ignored) {
            }
        }
        for (Tag t : tag.getList("jobs", Tag.TAG_COMPOUND)) {
            EraseJob job = EraseJob.load((CompoundTag) t);
            if (job != null) state.jobs.add(job);
        }
        return state;
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider provider) {
        CompoundTag erasedTag = new CompoundTag();
        erased.forEach((uuid, gen) -> erasedTag.putInt(uuid.toString(), gen));
        tag.put("erased", erasedTag);
        CompoundTag chunksTag = new CompoundTag();
        placedChunks.forEach((uuid, set) -> {
            ListTag list = new ListTag();
            for (String key : set) list.add(StringTag.valueOf(key));
            chunksTag.put(uuid.toString(), list);
        });
        tag.put("placedChunks", chunksTag);
        ListTag jobsTag = new ListTag();
        for (EraseJob job : jobs) jobsTag.add(job.save());
        tag.put("jobs", jobsTag);
        return tag;
    }

    @Override
    public boolean isDirty() {
        // The running jobs change every tick; save them with the world regardless.
        return true;
    }
}
