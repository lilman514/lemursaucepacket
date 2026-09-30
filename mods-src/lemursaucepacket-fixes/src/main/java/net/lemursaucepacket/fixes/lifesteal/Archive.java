package net.lemursaucepacket.fixes.lifesteal;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import javax.annotation.Nullable;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.registries.Registries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.NbtAccounter;
import net.minecraft.nbt.NbtIo;
import net.minecraft.nbt.NbtUtils;
import net.minecraft.nbt.Tag;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.LevelResource;

/**
 * Everything an erasure removes is written to {@code <world>/lsp_fixes/archive/<name>_life<N>_<time>.nbt}
 * before it goes: every block (state and block entity) and every item (with where it was). An admin can put
 * it back with {@code /lsp restore}. Written in batches so a crash mid-erasure loses little.
 */
public final class Archive {
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final int FLUSH_EVERY = 200;

    private final Path file;
    private final CompoundTag root;
    private final ListTag blocks;
    private final ListTag items;
    private int unflushed;

    private Archive(Path file, CompoundTag root) {
        this.file = file;
        this.root = root;
        this.blocks = root.getList("blocks", Tag.TAG_COMPOUND);
        this.items = root.getList("items", Tag.TAG_COMPOUND);
        root.put("blocks", blocks);
        root.put("items", items);
    }

    public static Path directory(MinecraftServer server) {
        return server.getWorldPath(LevelResource.ROOT).resolve("lsp_fixes").resolve("archive");
    }

    /** A new archive for one erasure. */
    public static Archive create(MinecraftServer server, UUID uuid, String name, int generation, boolean dryRun) {
        Path dir = directory(server);
        Path file = dir.resolve(name + "_life" + (generation + 1) + "_" + LocalDateTime.now().format(STAMP) + (dryRun ? "_dryrun" : "") + ".nbt");
        CompoundTag root = new CompoundTag();
        root.putString("player", name);
        root.putString("uuid", uuid.toString());
        root.putInt("generation", generation);
        root.putLong("time", System.currentTimeMillis());
        root.putBoolean("dryRun", dryRun);
        return new Archive(file, root);
    }

    /** Reopens an archive file to keep appending after a restart, or to restore from it. */
    @Nullable
    public static Archive open(Path file) {
        try {
            return new Archive(file, NbtIo.readCompressed(file, NbtAccounter.unlimitedHeap()));
        } catch (IOException e) {
            LifestealModule.LOGGER.warn("Cannot read archive {}: {}", file, e.toString());
            return null;
        }
    }

    public Path file() {
        return file;
    }

    public int blockCount() {
        return blocks.size();
    }

    public int itemCount() {
        return items.size();
    }

    public String player() {
        return root.getString("player");
    }

    public void block(ServerLevel level, BlockPos pos, BlockState state, @Nullable BlockEntity blockEntity) {
        CompoundTag tag = new CompoundTag();
        tag.putString("dim", PlacedBlocks.dimension(level));
        tag.putInt("x", pos.getX());
        tag.putInt("y", pos.getY());
        tag.putInt("z", pos.getZ());
        tag.put("state", NbtUtils.writeBlockState(state));
        if (blockEntity != null) {
            try {
                tag.put("be", blockEntity.saveWithFullMetadata(level.registryAccess()));
            } catch (Exception e) {
                LifestealModule.LOGGER.warn("Archive: block entity at {} not saved: {}", pos, e.toString());
            }
        }
        blocks.add(tag);
        touched();
    }

    public void item(HolderLookup.Provider provider, String where, ItemStack stack) {
        CompoundTag tag = new CompoundTag();
        tag.putString("where", where);
        tag.put("stack", stack.save(provider));
        items.add(tag);
        touched();
    }

    private void touched() {
        if (++unflushed >= FLUSH_EVERY) flush();
    }

    public void flush() {
        unflushed = 0;
        try {
            Files.createDirectories(file.getParent());
            NbtIo.writeCompressed(root, file);
        } catch (IOException e) {
            LifestealModule.LOGGER.error("Archive {} not written: {}", file, e.toString());
        }
    }

    // ---- restore ----

    public static List<Path> list(MinecraftServer server) {
        Path dir = directory(server);
        if (!Files.isDirectory(dir)) return List.of();
        try (Stream<Path> files = Files.list(dir)) {
            return files.filter(p -> p.getFileName().toString().endsWith(".nbt")).sorted().toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    /** Puts the archived blocks back where the spot is still empty. Returns [restored, skipped]. */
    public int[] restoreBlocks(MinecraftServer server) {
        int restored = 0;
        int skipped = 0;
        for (Tag t : blocks) {
            CompoundTag tag = (CompoundTag) t;
            ServerLevel level = server.getLevel(ResourceKey.create(Registries.DIMENSION, ResourceLocation.parse(tag.getString("dim"))));
            if (level == null) {
                skipped++;
                continue;
            }
            BlockPos pos = new BlockPos(tag.getInt("x"), tag.getInt("y"), tag.getInt("z"));
            BlockState current = level.getBlockState(pos);
            if (!current.isAir() && !current.canBeReplaced()) {
                skipped++;
                continue;
            }
            BlockState state = NbtUtils.readBlockState(level.holderLookup(Registries.BLOCK), tag.getCompound("state"));
            level.setBlock(pos, state, 3);
            if (tag.contains("be", Tag.TAG_COMPOUND)) {
                BlockEntity be = level.getBlockEntity(pos);
                if (be != null) {
                    try {
                        be.loadWithComponents(tag.getCompound("be"), level.registryAccess());
                        be.setChanged();
                    } catch (Exception e) {
                        LifestealModule.LOGGER.warn("Restore: block entity at {} not loaded: {}", pos, e.toString());
                    }
                }
            }
            restored++;
        }
        return new int[] {restored, skipped};
    }

    /**
     * Hands the archived items to a player (overflow drops at their feet), with the erased life's stamp
     * removed so the purge leaves them alone. Returns the count of stacks.
     */
    public int restoreItems(ServerPlayer player) {
        int n = 0;
        List<ItemStack> stacks = new ArrayList<>();
        for (Tag t : items) {
            CompoundTag tag = (CompoundTag) t;
            ItemStack.parse(player.registryAccess(), tag.getCompound("stack")).ifPresent(stacks::add);
        }
        for (ItemStack stack : stacks) {
            ItemStack copy = stack.copy();
            CustomData.update(DataComponents.CUSTOM_DATA, copy, c -> {
                c.remove(Ownership.OWNER_KEY);
                c.remove(Ownership.GEN_KEY);
            });
            player.getInventory().placeItemBackInInventory(copy);
            n++;
        }
        return n;
    }
}
