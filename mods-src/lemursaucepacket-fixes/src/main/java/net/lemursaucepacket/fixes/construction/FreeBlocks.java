package net.lemursaucepacket.fixes.construction;

import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;

import it.unimi.dsi.fastutil.longs.Long2ObjectOpenHashMap;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SlabBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.piston.PistonStructureResolver;
import net.minecraft.world.level.block.state.properties.SlabType;
import net.minecraft.world.level.chunk.LevelChunk;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.event.level.BlockDropsEvent;
import net.neoforged.neoforge.event.level.BlockEvent;
import net.neoforged.neoforge.event.level.ExplosionEvent;
import net.neoforged.neoforge.event.level.PistonEvent;

/**
 * Blocks that cost nothing: the Mason's Palette's, and the ones Construction's saving perk gave back. They're kept per
 * chunk (a chunk attachment) with the block that was put there, and they never become items: breaking one drops nothing
 * (by hand, by water, by a lost support), an explosion takes them without drops, pistons and Create's contraptions won't
 * move them, Create's drills and saws break them without drops (mixin.create.DrillFreeBlockMixin), and an airship that
 * lifts them carries the record along (mixin.sable.SableCarryFreeBlocksMixin).
 */
public final class FreeBlocks {
    /** One chunk's free blocks: packed position to the block placed there. */
    public static final class Chunk {
        final Long2ObjectOpenHashMap<ResourceLocation> blocks = new Long2ObjectOpenHashMap<>();

        private record Entry(long pos, ResourceLocation block) {
        }

        private static final Codec<Entry> ENTRY = RecordCodecBuilder.create(i -> i.group(
                Codec.LONG.fieldOf("p").forGetter(Entry::pos),
                ResourceLocation.CODEC.fieldOf("b").forGetter(Entry::block)).apply(i, Entry::new));

        public static final Codec<Chunk> CODEC = ENTRY.listOf().xmap(list -> {
            Chunk c = new Chunk();
            for (Entry e : list) c.blocks.put(e.pos(), e.block());
            return c;
        }, c -> {
            List<Entry> out = new ArrayList<>(c.blocks.size());
            for (var e : c.blocks.long2ObjectEntrySet()) out.add(new Entry(e.getLongKey(), e.getValue()));
            return out;
        });
    }

    // ---------------------------------------------------------------- the record

    private static LevelChunk loaded(Level level, BlockPos pos) {
        if (!(level instanceof ServerLevel server)) return null;
        return server.getChunkSource().getChunkNow(pos.getX() >> 4, pos.getZ() >> 4);
    }

    /** Whether there's a free block at pos (whatever it is). */
    public static boolean isFree(Level level, BlockPos pos) {
        LevelChunk chunk = loaded(level, pos);
        return chunk != null && chunk.hasData(ConstructionModule.FREE) && chunk.getData(ConstructionModule.FREE).blocks.containsKey(pos.asLong());
    }

    /** Whether the block at pos is the free block that was put there. */
    public static boolean isFree(Level level, BlockPos pos, Block block) {
        LevelChunk chunk = loaded(level, pos);
        if (chunk == null || !chunk.hasData(ConstructionModule.FREE)) return false;
        ResourceLocation id = chunk.getData(ConstructionModule.FREE).blocks.get(pos.asLong());
        return id != null && id.equals(BuiltInRegistries.BLOCK.getKey(block));
    }

    public static void mark(Level level, BlockPos pos, Block block) {
        LevelChunk chunk = loaded(level, pos);
        if (chunk == null) return;
        chunk.getData(ConstructionModule.FREE).blocks.put(pos.asLong(), BuiltInRegistries.BLOCK.getKey(block));
        chunk.setUnsaved(true);
    }

    public static void clear(Level level, BlockPos pos) {
        LevelChunk chunk = loaded(level, pos);
        if (chunk == null || !chunk.hasData(ConstructionModule.FREE)) return;
        if (chunk.getData(ConstructionModule.FREE).blocks.remove(pos.asLong()) != null) chunk.setUnsaved(true);
    }

    /** Clears the record if this was the free block there; returns whether it was. */
    public static boolean take(Level level, BlockPos pos, Block block) {
        if (!isFree(level, pos, block)) return false;
        clear(level, pos);
        return true;
    }

    /**
     * A block placed the ordinary way: a free one's record there is stale unless it's the same block (a slab merged onto a
     * free half stays free, so the pair can't break into two real slabs).
     */
    static void onRealPlace(Level level, BlockPos pos, Block block) {
        if (!isFree(level, pos)) return;
        BlockState state = level.getBlockState(pos);
        boolean merged = state.getBlock() instanceof SlabBlock && state.getValue(SlabBlock.TYPE) == SlabType.DOUBLE && isFree(level, pos, block);
        if (!merged) clear(level, pos);
    }

    // ---------------------------------------------------------------- keeping them out of item form

    /**
     * Breaking one drops nothing and no XP: by hand, water, a lost support or a command (vanilla's drops), and by Create's
     * drills and saws, which post this event for their own drop list and drop nothing when it's cancelled.
     */
    static void onDrops(BlockDropsEvent e) {
        if (!take(e.getLevel(), e.getPos(), e.getState().getBlock())) return;
        e.getDrops().clear();
        e.setDroppedExperience(0);
        e.setCanceled(true);
    }

    /** A break with no drops to stop (in creative, or without the tool the block needs): just forget it. */
    static void onBreak(BlockEvent.BreakEvent e) {
        Player p = e.getPlayer();
        if (p == null || !(e.getLevel() instanceof Level level)) return;
        if (p.isCreative() || !p.hasCorrectToolForDrops(e.getState(), level, e.getPos())) clear(level, e.getPos());
    }

    /** Create's drills and saws (BlockHelper.destroyBlockAs) hand out their own drop list: none for a free block. */
    public static boolean dropsNothing(Level level, BlockPos pos, BlockState state) {
        return isFree(level, pos, state.getBlock());
    }

    /** An explosion takes free blocks without their drops. */
    static void onExplosion(ExplosionEvent.Detonate e) {
        Level level = e.getLevel();
        e.getAffectedBlocks().removeIf(pos -> {
            BlockState state = level.getBlockState(pos);
            if (!take(level, pos, state.getBlock())) return false;
            level.setBlock(pos, state.getFluidState().createLegacyBlock(), 3);
            return true;
        });
    }

    /** Pistons won't push or pull them: they'd leave the record behind. */
    static void onPiston(PistonEvent.Pre e) {
        if (!(e.getLevel() instanceof Level level)) return;
        PistonStructureResolver structure = e.getStructureHelper();
        if (structure == null || !structure.resolve()) return;
        for (BlockPos pos : structure.getToPush()) {
            if (isFree(level, pos)) {
                e.setCanceled(true);
                return;
            }
        }
    }

    private static Method transformApply, transformLevel;

    /**
     * Sable has moved blocks into an airship, or back (SubLevelAssemblyHelper.moveBlocks): the free records follow their
     * blocks. Where the new spot's chunk can't be found, the moved block goes rather than ride on as a real one.
     * {@code transform} is Sable's AssemblyTransform.
     */
    public static void carry(Level from, Object transform, Iterable<BlockPos> positions) {
        try {
            if (transformApply == null) {
                transformApply = transform.getClass().getMethod("apply", BlockPos.class);
                transformLevel = transform.getClass().getMethod("getLevel");
            }
            Level to = (Level) transformLevel.invoke(transform);
            for (BlockPos pos : positions) {
                LevelChunk chunk = loaded(from, pos);
                if (chunk == null || !chunk.hasData(ConstructionModule.FREE)) continue;
                ResourceLocation id = chunk.getData(ConstructionModule.FREE).blocks.get(pos.asLong());
                if (id == null) continue;
                clear(from, pos);
                BlockPos dest = (BlockPos) transformApply.invoke(transform, pos);
                Block block = BuiltInRegistries.BLOCK.getOptional(id).orElse(null);
                if (block == null || to.getBlockState(dest).getBlock() != block) continue;
                if (loaded(to, dest) != null) {
                    mark(to, dest, block);
                } else {
                    to.setBlock(dest, to.getFluidState(dest).createLegacyBlock(), 3);
                    ConstructionModule.LOGGER.warn("A free block at {} couldn't follow its airship, so it went", dest.toShortString());
                }
            }
        } catch (ReflectiveOperationException | ClassCastException ex) {
            ConstructionModule.LOGGER.warn("Couldn't carry free blocks with an airship", ex);
        }
    }

    /** Create's contraptions (bearings, pistons, gantries, carts) won't take a free block along. */
    static void registerWithCreate() {
        if (!ModList.get().isLoaded("create")) return;
        try {
            ClassLoader loader = FreeBlocks.class.getClassLoader();
            Class<?> api = Class.forName("com.simibubi.create.api.contraption.BlockMovementChecks", true, loader);
            Class<?> check = Class.forName("com.simibubi.create.api.contraption.BlockMovementChecks$MovementAllowedCheck", true, loader);
            @SuppressWarnings({"unchecked", "rawtypes"})
            Class<? extends Enum> result = (Class<? extends Enum>) Class.forName("com.simibubi.create.api.contraption.BlockMovementChecks$CheckResult", true, loader);
            @SuppressWarnings("unchecked")
            Object fail = Enum.valueOf(result, "FAIL"), pass = Enum.valueOf(result, "PASS");
            Object proxy = Proxy.newProxyInstance(loader, new Class<?>[] {check}, (self, method, args) -> switch (method.getName()) {
                case "isMovementAllowed" -> args[1] instanceof Level level && args[2] instanceof BlockPos pos && isFree(level, pos) ? fail : pass;
                case "hashCode" -> System.identityHashCode(self);
                case "equals" -> self == args[0];
                case "toString" -> "lsp_fixes free blocks";
                default -> pass;
            });
            api.getMethod("registerMovementAllowedCheck", check).invoke(null, proxy);
            ConstructionModule.LOGGER.info("Create's contraptions won't move free blocks");
        } catch (ReflectiveOperationException | LinkageError ex) {
            ConstructionModule.LOGGER.error("Couldn't tell Create's contraptions to leave free blocks be", ex);
        }
    }

    private FreeBlocks() {
    }
}
