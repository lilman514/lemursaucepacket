package net.lemursaucepacket.fixes.lifesteal;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

import javax.annotation.Nullable;

import it.unimi.dsi.fastutil.longs.Long2ObjectOpenHashMap;
import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.StringTag;
import net.minecraft.nbt.Tag;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.LevelChunk;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.attachment.AttachmentType;
import net.neoforged.neoforge.attachment.IAttachmentHolder;
import net.neoforged.neoforge.attachment.IAttachmentSerializer;
import net.neoforged.neoforge.common.util.BlockSnapshot;
import net.neoforged.neoforge.common.util.FakePlayer;
import net.neoforged.neoforge.event.level.BlockEvent;
import net.neoforged.neoforge.event.level.ExplosionEvent;
import net.neoforged.neoforge.event.level.PistonEvent;
import net.neoforged.neoforge.registries.DeferredRegister;
import net.neoforged.neoforge.registries.NeoForgeRegistries;

/**
 * Which player placed which block. Stored on the chunk itself (a data attachment saved with the chunk), so it
 * scales with the world and needs no separate database: each chunk keeps a small owner table and a map from
 * block position to (owner, block id). A block placed by hand is recorded; breaking it, blowing it up or
 * pushing it with a piston forgets it. Blocks a machine places (deployers, schematicannons) or a contraption
 * moves are not tracked, by design.
 */
public final class PlacedBlocks {
    public static final DeferredRegister<AttachmentType<?>> ATTACHMENTS = DeferredRegister.create(NeoForgeRegistries.ATTACHMENT_TYPES, net.lemursaucepacket.fixes.LspFixes.MOD_ID);
    public static final Supplier<AttachmentType<Data>> TYPE = ATTACHMENTS.register("placed_blocks",
            () -> AttachmentType.builder(Data::new).serialize(new Serializer()).build());

    public record Entry(String owner, String block) {
    }

    /** One chunk's records. */
    public static final class Data {
        private final List<String> owners = new ArrayList<>();
        private final Long2ObjectOpenHashMap<int[]> entries = new Long2ObjectOpenHashMap<>();
        private final List<String> blocks = new ArrayList<>();

        private int index(List<String> table, String value) {
            int i = table.indexOf(value);
            if (i < 0) {
                table.add(value);
                i = table.size() - 1;
            }
            return i;
        }

        public void put(BlockPos pos, String ownerKey, String blockId) {
            entries.put(pos.asLong(), new int[] {index(owners, ownerKey), index(blocks, blockId)});
        }

        @Nullable
        public Entry get(BlockPos pos) {
            int[] e = entries.get(pos.asLong());
            return e == null ? null : new Entry(owners.get(e[0]), blocks.get(e[1]));
        }

        public boolean remove(BlockPos pos) {
            return entries.remove(pos.asLong()) != null;
        }

        public boolean isEmpty() {
            return entries.isEmpty();
        }

        public int size() {
            return entries.size();
        }

        /** Positions owned by one life. */
        public List<BlockPos> positionsOf(String ownerKey) {
            int owner = owners.indexOf(ownerKey);
            List<BlockPos> out = new ArrayList<>();
            if (owner < 0) return out;
            entries.long2ObjectEntrySet().forEach(e -> {
                if (e.getValue()[0] == owner) out.add(BlockPos.of(e.getLongKey()));
            });
            return out;
        }

        public int countOf(String ownerKey) {
            int owner = owners.indexOf(ownerKey);
            if (owner < 0) return 0;
            int n = 0;
            for (int[] e : entries.values()) if (e[0] == owner) n++;
            return n;
        }

        CompoundTag save() {
            CompoundTag tag = new CompoundTag();
            ListTag ownerList = new ListTag();
            for (String o : owners) ownerList.add(StringTag.valueOf(o));
            tag.put("owners", ownerList);
            ListTag blockList = new ListTag();
            for (String b : blocks) blockList.add(StringTag.valueOf(b));
            tag.put("blocks", blockList);
            long[] positions = new long[entries.size()];
            int[] ownerIndex = new int[entries.size()];
            int[] blockIndex = new int[entries.size()];
            int i = 0;
            for (var e : entries.long2ObjectEntrySet()) {
                positions[i] = e.getLongKey();
                ownerIndex[i] = e.getValue()[0];
                blockIndex[i] = e.getValue()[1];
                i++;
            }
            tag.putLongArray("pos", positions);
            tag.putIntArray("owner", ownerIndex);
            tag.putIntArray("block", blockIndex);
            return tag;
        }

        static Data load(CompoundTag tag) {
            Data data = new Data();
            for (Tag t : tag.getList("owners", Tag.TAG_STRING)) data.owners.add(t.getAsString());
            for (Tag t : tag.getList("blocks", Tag.TAG_STRING)) data.blocks.add(t.getAsString());
            long[] positions = tag.getLongArray("pos");
            int[] ownerIndex = tag.getIntArray("owner");
            int[] blockIndex = tag.getIntArray("block");
            for (int i = 0; i < positions.length && i < ownerIndex.length && i < blockIndex.length; i++) {
                if (ownerIndex[i] < data.owners.size() && blockIndex[i] < data.blocks.size()) {
                    data.entries.put(positions[i], new int[] {ownerIndex[i], blockIndex[i]});
                }
            }
            return data;
        }
    }

    private static final class Serializer implements IAttachmentSerializer<CompoundTag, Data> {
        @Override
        public Data read(IAttachmentHolder holder, CompoundTag tag, HolderLookup.Provider provider) {
            return Data.load(tag);
        }

        @Override
        @Nullable
        public CompoundTag write(Data attachment, HolderLookup.Provider provider) {
            return attachment.isEmpty() ? null : attachment.save();
        }
    }

    public static String blockId(BlockState state) {
        return BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString();
    }

    public static String dimension(ServerLevel level) {
        return level.dimension().location().toString();
    }

    public static String chunkKey(ServerLevel level, BlockPos pos) {
        return LifestealState.chunkKey(dimension(level), pos.getX() >> 4, pos.getZ() >> 4);
    }

    /** The chunk's data if the chunk is loaded, else null (never loads a chunk). */
    @Nullable
    public static Data loaded(ServerLevel level, ChunkPos chunk) {
        LevelChunk c = level.getChunkSource().getChunkNow(chunk.x, chunk.z);
        return c == null || !c.hasData(TYPE) ? null : c.getData(TYPE);
    }

    public static void record(ServerLevel level, BlockPos pos, ServerPlayer player, BlockState state) {
        LevelChunk chunk = level.getChunkAt(pos);
        Ownership.Owner owner = new Ownership.Owner(player.getUUID(), KubeData.generation(player));
        chunk.getData(TYPE).put(pos.immutable(), owner.key(), blockId(state));
        chunk.setUnsaved(true);
        LifestealState.get(level.getServer()).rememberChunk(player.getUUID(), chunkKey(level, pos));
    }

    public static void forget(ServerLevel level, BlockPos pos) {
        LevelChunk chunk = level.getChunkSource().getChunkNow(pos.getX() >> 4, pos.getZ() >> 4);
        if (chunk == null || !chunk.hasData(TYPE)) return;
        if (chunk.getData(TYPE).remove(pos)) chunk.setUnsaved(true);
    }

    // ---- events (NeoForge.EVENT_BUS) ----

    @SubscribeEvent
    public static void onPlace(BlockEvent.EntityPlaceEvent event) {
        if (!(event.getLevel() instanceof ServerLevel level) || !(event.getEntity() instanceof ServerPlayer player) || player instanceof FakePlayer) return;
        if (event instanceof BlockEvent.EntityMultiPlaceEvent multi) {
            for (BlockSnapshot snapshot : multi.getReplacedBlockSnapshots()) {
                record(level, snapshot.getPos(), player, level.getBlockState(snapshot.getPos()));
            }
        } else {
            record(level, event.getPos(), player, event.getPlacedBlock());
        }
    }

    @SubscribeEvent
    public static void onBreak(BlockEvent.BreakEvent event) {
        if (event.getLevel() instanceof ServerLevel level) forget(level, event.getPos());
    }

    @SubscribeEvent
    public static void onExplosion(ExplosionEvent.Detonate event) {
        if (!(event.getLevel() instanceof ServerLevel level)) return;
        for (BlockPos pos : event.getAffectedBlocks()) forget(level, pos);
    }

    /** Before the piston moves: the blocks about to move stop being tracked (their new spots are not). */
    @SubscribeEvent
    public static void onPiston(PistonEvent.Pre event) {
        if (!(event.getLevel() instanceof ServerLevel level)) return;
        var resolver = event.getStructureHelper();
        if (resolver == null || !resolver.resolve()) return;
        for (BlockPos pos : resolver.getToPush()) forget(level, pos);
        for (BlockPos pos : resolver.getToDestroy()) forget(level, pos);
    }

    private PlacedBlocks() {
    }
}
