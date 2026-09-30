package net.lemursaucepacket.fixes.lifesteal;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import javax.annotation.Nullable;

import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.StringTag;
import net.minecraft.nbt.Tag;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.Containers;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.LevelChunk;
import net.neoforged.neoforge.items.IItemHandler;
import net.neoforged.neoforge.items.IItemHandlerModifiable;

/**
 * One erasure: every block a life placed comes down, chunk by chunk, loaded ones first and the rest loaded a
 * few per second; containers among them drop what belongs to others. Items are not hunted here: marking the
 * life as erased makes {@link Purge} delete them wherever they are next seen. The job is saved with the
 * world and resumes after a restart. Everything removed goes into an {@link Archive}.
 */
public final class EraseJob {
    private static Archive lateArchive;

    final UUID uuid;
    final String name;
    final int generation;
    final boolean dryRun;
    final String ownerKey;
    final ArrayDeque<String> pending = new ArrayDeque<>();
    final String archiveFile;
    int blocksRemoved;
    int stale;
    int chunksDone;
    boolean finished;
    private transient Archive archive;
    private transient int loadBudget;

    private EraseJob(UUID uuid, String name, int generation, boolean dryRun, String archiveFile) {
        this.uuid = uuid;
        this.name = name;
        this.generation = generation;
        this.dryRun = dryRun;
        this.ownerKey = new Ownership.Owner(uuid, generation).key();
        this.archiveFile = archiveFile;
    }

    /** Starts erasing one life. The caller has already given the player their next life number. */
    public static EraseJob start(MinecraftServer server, UUID uuid, String name, int generation) {
        boolean dryRun = LifestealConfig.ELIMINATION_DRY_RUN.get();
        LifestealState state = LifestealState.get(server);
        Archive archive = Archive.create(server, uuid, name, generation, dryRun);
        archive.flush();
        EraseJob job = new EraseJob(uuid, name, generation, dryRun, archive.file().getFileName().toString());
        job.archive = archive;
        job.pending.addAll(state.placedChunks(uuid));
        if (!dryRun) state.markErased(uuid, generation);
        state.addJob(job);
        LifestealModule.LOGGER.info("Erasure of {} (life {}) started: {} chunks to visit{}", name, generation + 1, job.pending.size(), dryRun ? " [dry run]" : "");
        // Whatever is loaded right now goes first: online inventories, dropped items, containers.
        if (!dryRun) {
            int items = Purge.sweepLoaded(server);
            LifestealModule.LOGGER.info("Erasure of {}: {} item stacks deleted from what was loaded", name, items);
        }
        return job;
    }

    static void tick(MinecraftServer server) {
        if (lateArchive != null && server.getTickCount() % 1200 == 0) lateArchive.flush();
        LifestealState state = LifestealState.get(server);
        if (state.jobs().isEmpty()) return;
        int chunkBudget = LifestealConfig.ERASE_CHUNKS_PER_TICK.get();
        boolean loadTick = server.getTickCount() % 20 == 0;
        for (EraseJob job : new ArrayList<>(state.jobs())) {
            if (job.finished) continue;
            if (loadTick) job.loadBudget = LifestealConfig.ERASE_LOADS_PER_SECOND.get();
            int processed = 0;
            int checked = 0;
            int size = job.pending.size();
            while (processed < chunkBudget && checked < size && !job.pending.isEmpty()) {
                checked++;
                String key = job.pending.poll();
                ServerLevel level = levelOf(server, key);
                ChunkPos pos = chunkPosOf(key);
                if (level == null || pos == null) continue;
                LevelChunk chunk = level.getChunkSource().getChunkNow(pos.x, pos.z);
                if (chunk == null) {
                    if (job.loadBudget <= 0) {
                        job.pending.add(key);
                        continue;
                    }
                    job.loadBudget--;
                    chunk = level.getChunk(pos.x, pos.z);
                }
                job.process(server, level, chunk);
                processed++;
            }
            if (job.pending.isEmpty()) job.finish(server);
        }
        state.jobs().removeIf(j -> j.finished);
    }

    /** A chunk loaded on its own: any job waiting for it takes it now. */
    static void chunkLoaded(MinecraftServer server, ServerLevel level, LevelChunk chunk) {
        LifestealState state = LifestealState.get(server);
        if (state.jobs().isEmpty()) return;
        String key = LifestealState.chunkKey(PlacedBlocks.dimension(level), chunk.getPos().x, chunk.getPos().z);
        for (EraseJob job : state.jobs()) {
            if (!job.finished && job.pending.remove(key)) job.process(server, level, chunk);
        }
    }

    private void process(MinecraftServer server, ServerLevel level, LevelChunk chunk) {
        chunksDone++;
        if (!chunk.hasData(PlacedBlocks.TYPE)) return;
        PlacedBlocks.Data data = chunk.getData(PlacedBlocks.TYPE);
        List<BlockPos> positions = data.positionsOf(ownerKey);
        if (positions.isEmpty()) return;
        positions.sort(Comparator.comparingInt((BlockPos p) -> p.getY()).reversed());
        Archive archive = archive(server);
        for (BlockPos pos : positions) {
            PlacedBlocks.Entry entry = data.get(pos);
            if (entry == null) continue;
            BlockState state = level.getBlockState(pos);
            if (!PlacedBlocks.blockId(state).equals(entry.block())) {
                stale++;
                data.remove(pos);
                continue;
            }
            BlockEntity be = level.getBlockEntity(pos);
            archive.block(level, pos, state, be);
            blocksRemoved++;
            if (dryRun) continue;
            try {
                if (be != null) emptyContainer(server, level, pos, be, archive);
                level.removeBlock(pos, false);
            } catch (Exception e) {
                LifestealModule.LOGGER.warn("Erasure of {}: block at {} not removed: {}", name, pos, e.toString());
            }
            data.remove(pos);
        }
        chunk.setUnsaved(true);
        if (blocksRemoved % 500 == 0) archive.flush();
    }

    /** What is the dead life's is deleted (archived); everything else inside drops on the floor. */
    private void emptyContainer(MinecraftServer server, ServerLevel level, BlockPos pos, BlockEntity be, Archive archive) {
        // The block's own items: a chest is only its own half, since the other half may not be the dead life's.
        IItemHandler handler = SafeItems.of(level, be, true);
        if (handler == null) return;
        String where = "block " + PlacedBlocks.dimension(level) + " " + pos.getX() + " " + pos.getY() + " " + pos.getZ();
        for (int i = 0; i < handler.getSlots(); i++) {
            ItemStack stack = handler.getStackInSlot(i);
            if (stack.isEmpty()) continue;
            ItemStack copy = stack.copy();
            if (Ownership.isDead(server, copy)) {
                archive.item(level.registryAccess(), where, copy);
            } else {
                Purge.stack(server, copy, where, (w, s) -> archive.item(level.registryAccess(), w, s));
                if (!copy.isEmpty()) Containers.dropItemStack(level, pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5, copy);
            }
            if (handler instanceof IItemHandlerModifiable modifiable) modifiable.setStackInSlot(i, ItemStack.EMPTY);
            else {
                handler.extractItem(i, stack.getCount(), false);
                if (!handler.getStackInSlot(i).isEmpty()) handler.getStackInSlot(i).setCount(0);
            }
        }
    }

    private void finish(MinecraftServer server) {
        finished = true;
        Archive archive = archive(server);
        archive.flush();
        String summary = String.format("%s (life %d): %d blocks%s removed in %d chunks, %d gone already, archive %s", name, generation + 1, blocksRemoved, dryRun ? " would be" : "", chunksDone, stale, archiveFile);
        LifestealModule.LOGGER.info("Erasure finished: {}", summary);
        server.getPlayerList().broadcastSystemMessage(Component.literal("What " + name + " built in their last life is gone: " + blocksRemoved + " blocks" + (dryRun ? " (dry run: nothing was removed)" : "") + ".").withStyle(ChatFormatting.GRAY), false);
    }

    private Archive archive(MinecraftServer server) {
        if (archive == null) {
            Archive reopened = Archive.open(Archive.directory(server).resolve(archiveFile));
            archive = reopened != null ? reopened : Archive.create(server, uuid, name, generation, dryRun);
        }
        return archive;
    }

    /** Items {@link Purge} deletes go into their life's archive, or a shared "late" file once the job is done. */
    static void archiveItem(MinecraftServer server, String where, ItemStack stack) {
        Ownership.Owner owner = Ownership.of(stack);
        if (owner != null) {
            for (EraseJob job : LifestealState.get(server).jobs()) {
                if (!job.finished && job.uuid.equals(owner.uuid()) && job.generation == owner.generation()) {
                    job.archive(server).item(server.registryAccess(), where, stack);
                    return;
                }
            }
        }
        if (lateArchive == null) lateArchive = Archive.create(server, new UUID(0, 0), "late_purges", -1, false);
        lateArchive.item(server.registryAccess(), where, stack);
    }

    static void flushAll(MinecraftServer server) {
        for (EraseJob job : LifestealState.get(server).jobs()) if (job.archive != null) job.archive.flush();
        if (lateArchive != null) lateArchive.flush();
    }

    /** [blocks in loaded chunks, chunks not loaded] a player's erasure would touch. */
    public static int[] preview(MinecraftServer server, UUID uuid, int generation) {
        String key = new Ownership.Owner(uuid, generation).key();
        int blocks = 0;
        int unloaded = 0;
        for (String chunkKey : LifestealState.get(server).placedChunks(uuid)) {
            ServerLevel level = levelOf(server, chunkKey);
            ChunkPos pos = chunkPosOf(chunkKey);
            if (level == null || pos == null) continue;
            PlacedBlocks.Data data = PlacedBlocks.loaded(level, pos);
            if (data == null) unloaded++;
            else blocks += data.countOf(key);
        }
        return new int[] {blocks, unloaded};
    }

    public String describe() {
        return name + " life " + (generation + 1) + ": " + blocksRemoved + " blocks, " + pending.size() + " chunks left" + (dryRun ? " (dry run)" : "");
    }

    public String name() {
        return name;
    }

    public UUID uuid() {
        return uuid;
    }

    @Nullable
    static ServerLevel levelOf(MinecraftServer server, String chunkKey) {
        int bar = chunkKey.indexOf('|');
        if (bar < 0) return null;
        ResourceLocation id = ResourceLocation.tryParse(chunkKey.substring(0, bar));
        return id == null ? null : server.getLevel(ResourceKey.create(Registries.DIMENSION, id));
    }

    @Nullable
    static ChunkPos chunkPosOf(String chunkKey) {
        String[] parts = chunkKey.split("\\|");
        if (parts.length != 3) return null;
        try {
            return new ChunkPos(Integer.parseInt(parts[1]), Integer.parseInt(parts[2]));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    CompoundTag save() {
        CompoundTag tag = new CompoundTag();
        tag.putUUID("uuid", uuid);
        tag.putString("name", name);
        tag.putInt("generation", generation);
        tag.putBoolean("dryRun", dryRun);
        tag.putString("archive", archiveFile);
        tag.putInt("blocksRemoved", blocksRemoved);
        tag.putInt("stale", stale);
        tag.putInt("chunksDone", chunksDone);
        ListTag list = new ListTag();
        for (String key : pending) list.add(StringTag.valueOf(key));
        tag.put("pending", list);
        return tag;
    }

    @Nullable
    static EraseJob load(CompoundTag tag) {
        if (!tag.hasUUID("uuid")) return null;
        EraseJob job = new EraseJob(tag.getUUID("uuid"), tag.getString("name"), tag.getInt("generation"), tag.getBoolean("dryRun"), tag.getString("archive"));
        job.blocksRemoved = tag.getInt("blocksRemoved");
        job.stale = tag.getInt("stale");
        job.chunksDone = tag.getInt("chunksDone");
        for (Tag t : tag.getList("pending", Tag.TAG_STRING)) job.pending.add(t.getAsString());
        return job;
    }
}
