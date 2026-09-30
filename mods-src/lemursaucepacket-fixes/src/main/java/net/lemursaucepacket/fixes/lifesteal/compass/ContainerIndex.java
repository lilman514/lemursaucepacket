package net.lemursaucepacket.fixes.lifesteal.compass;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import net.lemursaucepacket.fixes.lifesteal.LifestealConfig;
import net.lemursaucepacket.fixes.lifesteal.LifestealState;
import net.lemursaucepacket.fixes.lifesteal.Ownership;
import net.lemursaucepacket.fixes.lifesteal.PlacedBlocks;
import net.lemursaucepacket.fixes.lifesteal.Purge;
import net.lemursaucepacket.fixes.lifesteal.SafeItems;
import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.chunk.LevelChunk;
import net.minecraft.world.level.saveddata.SavedData;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.event.entity.player.PlayerContainerEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.level.ChunkEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import net.neoforged.neoforge.items.IItemHandler;

/**
 * Where owned items sit inside containers, as last seen: a chunk's containers are read when the chunk loads
 * or unloads, when a player closes a container in it, and by a slow rolling scan of everything loaded. Offline
 * players' pockets are recorded at logout. The Seeker's Compass points at these. Never exact for a busy
 * factory, always exact for anything nobody is touching. Saved as {@code lsp_fixes_containers.dat}.
 */
public final class ContainerIndex extends SavedData {
    private static final String NAME = "lsp_fixes_containers";
    private static final Factory<ContainerIndex> FACTORY = new Factory<>(ContainerIndex::new, ContainerIndex::load, null);

    /** An owned stack inside something. {@code holder} is a player uuid for pockets, null for blocks. */
    public record Entry(UUID owner, String dimension, BlockPos pos, String item, int count, UUID holder) {
        public String key() {
            return holder != null ? "p:" + holder + ":" + item : "c:" + dimension + ":" + pos.asLong() + ":" + item;
        }
    }

    /** chunk key -> entries in that chunk's block entities. */
    private final Map<String, List<Entry>> chunks = new HashMap<>();
    /** player uuid -> entries in that (offline) player's inventory. */
    private final Map<UUID, List<Entry>> pockets = new HashMap<>();
    private transient Iterator<ServerLevel> levelCursor;
    private transient Iterator<LevelChunk> chunkCursor;

    public static ContainerIndex get(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(FACTORY, NAME);
    }

    /**
     * Reads every item handler in the chunk and replaces the chunk's records. Never loads a chunk
     * ({@link SafeItems}): a container that can only be read through its capability while a neighbouring chunk
     * is unloaded keeps its previous records.
     */
    public static void scanChunk(ServerLevel level, LevelChunk chunk) {
        if (!LifestealConfig.COMPASS_ENABLED.get()) return;
        ContainerIndex index = get(level.getServer());
        String key = LifestealState.chunkKey(PlacedBlocks.dimension(level), chunk.getPos().x, chunk.getPos().z);
        List<Entry> previous = index.chunks.getOrDefault(key, List.of());
        List<Entry> found = new ArrayList<>();
        for (BlockEntity be : List.copyOf(chunk.getBlockEntities().values())) {
            if (!SafeItems.readableWithoutLoading(level, be)) {
                BlockPos pos = be.getBlockPos();
                for (Entry e : previous) if (e.pos().equals(pos)) found.add(e);
                continue;
            }
            IItemHandler handler = SafeItems.of(level, be, false);
            if (handler == null) continue;
            Map<String, Entry> merged = new HashMap<>();
            for (int i = 0; i < handler.getSlots(); i++) {
                ItemStack stack = handler.getStackInSlot(i);
                Ownership.Owner owner = Ownership.of(stack);
                if (owner == null) continue;
                String item = BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();
                String k = owner.uuid() + "/" + item;
                Entry old = merged.get(k);
                merged.put(k, new Entry(owner.uuid(), PlacedBlocks.dimension(level), be.getBlockPos().immutable(), item, (old == null ? 0 : old.count()) + stack.getCount(), null));
            }
            found.addAll(merged.values());
        }
        if (found.isEmpty()) {
            if (index.chunks.remove(key) != null) index.setDirty();
        } else {
            index.chunks.put(key, found);
            index.setDirty();
        }
    }

    public static void scanPlayer(ServerPlayer player) {
        ContainerIndex index = get(player.server);
        Map<String, Entry> merged = new HashMap<>();
        for (ItemStack stack : player.getInventory().items) {
            Ownership.Owner owner = Ownership.of(stack);
            if (owner == null || owner.uuid().equals(player.getUUID())) continue;
            String item = BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();
            String k = owner.uuid() + "/" + item;
            Entry old = merged.get(k);
            merged.put(k, new Entry(owner.uuid(), PlacedBlocks.dimension(player.serverLevel()), player.blockPosition(), item, (old == null ? 0 : old.count()) + stack.getCount(), player.getUUID()));
        }
        if (merged.isEmpty()) index.pockets.remove(player.getUUID());
        else index.pockets.put(player.getUUID(), new ArrayList<>(merged.values()));
        index.setDirty();
    }

    public List<Entry> of(UUID owner, boolean includePockets) {
        List<Entry> out = new ArrayList<>();
        for (List<Entry> list : chunks.values()) for (Entry e : list) if (e.owner().equals(owner)) out.add(e);
        if (includePockets) for (List<Entry> list : pockets.values()) for (Entry e : list) if (e.owner().equals(owner)) out.add(e);
        return out;
    }

    public int count(UUID owner) {
        int n = 0;
        for (List<Entry> list : chunks.values()) for (Entry e : list) if (e.owner().equals(owner)) n += e.count();
        for (List<Entry> list : pockets.values()) for (Entry e : list) if (e.owner().equals(owner)) n += e.count();
        return n;
    }

    // ---- events ----

    @SubscribeEvent
    public static void onChunkUnload(ChunkEvent.Unload event) {
        // Not while stopping: the server unloads every chunk then, and the records from the last scan stand.
        if (event.getLevel() instanceof ServerLevel level && level.getServer().isRunning() && event.getChunk() instanceof LevelChunk chunk) scanChunk(level, chunk);
    }

    @SubscribeEvent
    public static void onContainerClose(PlayerContainerEvent.Close event) {
        if (!(event.getEntity() instanceof ServerPlayer player)) return;
        for (var slot : event.getContainer().slots) {
            if (slot.container instanceof BlockEntity be && be.getLevel() instanceof ServerLevel level) {
                LevelChunk chunk = level.getChunkSource().getChunkNow(be.getBlockPos().getX() >> 4, be.getBlockPos().getZ() >> 4);
                if (chunk != null) scanChunk(level, chunk);
                return;
            }
        }
    }

    @SubscribeEvent
    public static void onLogout(PlayerEvent.PlayerLoggedOutEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) scanPlayer(player);
    }

    @SubscribeEvent
    public static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) {
            ContainerIndex index = get(player.server);
            if (index.pockets.remove(player.getUUID()) != null) index.setDirty();
        }
    }

    /** The rolling scan of loaded chunks: a few chunks per tick, round and round. */
    @SubscribeEvent
    public static void onTick(ServerTickEvent.Post event) {
        if (!LifestealConfig.COMPASS_ENABLED.get()) return;
        MinecraftServer server = event.getServer();
        if (server.getPlayerCount() == 0) return;
        ContainerIndex index = get(server);
        int budget = LifestealConfig.INDEX_CHUNKS_PER_TICK.get();
        while (budget > 0) {
            if (index.chunkCursor == null || !index.chunkCursor.hasNext()) {
                if (index.levelCursor == null || !index.levelCursor.hasNext()) {
                    List<ServerLevel> levels = new ArrayList<>();
                    server.getAllLevels().forEach(levels::add);
                    index.levelCursor = levels.iterator();
                    if (!index.levelCursor.hasNext()) return;
                }
                ServerLevel level = index.levelCursor.next();
                List<LevelChunk> chunks = new ArrayList<>();
                Purge.forEachLoadedChunk(level, chunks::add);
                index.chunkCursor = chunks.iterator();
                continue;
            }
            LevelChunk chunk = index.chunkCursor.next();
            if (chunk.getLevel() instanceof ServerLevel level && level.getChunkSource().getChunkNow(chunk.getPos().x, chunk.getPos().z) == chunk) scanChunk(level, chunk);
            budget--;
        }
    }

    private static ContainerIndex load(CompoundTag tag, HolderLookup.Provider provider) {
        ContainerIndex index = new ContainerIndex();
        CompoundTag chunksTag = tag.getCompound("chunks");
        for (String key : chunksTag.getAllKeys()) index.chunks.put(key, readEntries(chunksTag.getList(key, Tag.TAG_COMPOUND)));
        CompoundTag pocketsTag = tag.getCompound("pockets");
        for (String key : pocketsTag.getAllKeys()) {
            try {
                index.pockets.put(UUID.fromString(key), readEntries(pocketsTag.getList(key, Tag.TAG_COMPOUND)));
            } catch (IllegalArgumentException ignored) {
            }
        }
        return index;
    }

    private static List<Entry> readEntries(ListTag list) {
        List<Entry> out = new ArrayList<>();
        for (Tag t : list) {
            CompoundTag e = (CompoundTag) t;
            if (!e.hasUUID("owner")) continue;
            out.add(new Entry(e.getUUID("owner"), e.getString("dim"), new BlockPos(e.getInt("x"), e.getInt("y"), e.getInt("z")), e.getString("item"), e.getInt("count"), e.hasUUID("holder") ? e.getUUID("holder") : null));
        }
        return out;
    }

    private static ListTag writeEntries(List<Entry> entries) {
        ListTag list = new ListTag();
        for (Entry entry : entries) {
            CompoundTag e = new CompoundTag();
            e.putUUID("owner", entry.owner());
            e.putString("dim", entry.dimension());
            e.putInt("x", entry.pos().getX());
            e.putInt("y", entry.pos().getY());
            e.putInt("z", entry.pos().getZ());
            e.putString("item", entry.item());
            e.putInt("count", entry.count());
            if (entry.holder() != null) e.putUUID("holder", entry.holder());
            list.add(e);
        }
        return list;
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider provider) {
        CompoundTag chunksTag = new CompoundTag();
        chunks.forEach((key, list) -> chunksTag.put(key, writeEntries(list)));
        tag.put("chunks", chunksTag);
        CompoundTag pocketsTag = new CompoundTag();
        pockets.forEach((uuid, list) -> pocketsTag.put(uuid.toString(), writeEntries(list)));
        tag.put("pockets", pocketsTag);
        return tag;
    }
}
