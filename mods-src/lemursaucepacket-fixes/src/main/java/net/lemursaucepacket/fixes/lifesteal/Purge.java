package net.lemursaucepacket.fixes.lifesteal;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

import javax.annotation.Nullable;

import net.minecraft.core.BlockPos;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.component.TypedDataComponent;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.Container;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.decoration.ItemFrame;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.BundleContents;
import net.minecraft.world.item.component.ItemContainerContents;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.chunk.LevelChunk;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.capabilities.Capabilities;
import net.neoforged.neoforge.event.entity.EntityJoinLevelEvent;
import net.neoforged.neoforge.event.entity.player.PlayerContainerEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.level.ChunkEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;
import net.neoforged.neoforge.items.IItemHandler;
import net.neoforged.neoforge.items.IItemHandlerModifiable;

/**
 * Deletes items whose owner's life has been erased, wherever they turn up: the erasure can't visit every
 * chest in the world at once, so instead every place items are seen is a checkpoint. Inventories on login
 * and every few seconds, any container menu when it opens, block entities and entities when their chunk
 * loads, dropped items when they appear. Items inside items (shulker boxes, bundles, Create packages,
 * backpacks) are checked too. Everything deleted is written to the erasure's archive first.
 */
public final class Purge {
    private static final ArrayDeque<ChunkTask> CHUNK_QUEUE = new ArrayDeque<>();
    private static int tick;

    private record ChunkTask(ServerLevel level, ChunkPos pos) {
    }

    /** Where a deleted item was, for the archive. */
    public interface Sink {
        void removed(String where, ItemStack stack);
    }

    static boolean enabled() {
        return LifestealConfig.PURGE_ENABLED.get();
    }

    private static Sink sink(MinecraftServer server) {
        return (where, stack) -> EraseJob.archiveItem(server, where, stack);
    }

    /**
     * Cleans one stack in place: deletes it if its owner is dead, otherwise cleans what it contains. Returns
     * the number of item stacks deleted (the stack itself counts as one).
     */
    public static int stack(MinecraftServer server, ItemStack stack, String where, Sink sink) {
        if (stack.isEmpty()) return 0;
        if (Ownership.isDead(server, stack)) {
            sink.removed(where, stack.copy());
            stack.setCount(0);
            return 1;
        }
        int removed = 0;
        // Items that hold items in a component: shulker boxes (minecraft:container), Create packages
        // (create:package_contents is an ItemContainerContents too), bundles.
        List<TypedDataComponent<?>> components = new ArrayList<>();
        for (TypedDataComponent<?> c : stack.getComponents()) components.add(c);
        for (TypedDataComponent<?> c : components) {
            if (c.value() instanceof ItemContainerContents contents) {
                List<ItemStack> list = new ArrayList<>();
                contents.stream().forEach(s -> list.add(s.copy()));
                int before = removed;
                for (ItemStack inner : list) removed += stack(server, inner, where + " > " + stack.getHoverName().getString(), sink);
                if (removed != before) setComponent(stack, c.type(), ItemContainerContents.fromItems(list));
            } else if (c.value() instanceof BundleContents contents) {
                List<ItemStack> list = new ArrayList<>();
                contents.itemCopyStream().forEach(list::add);
                int before = removed;
                for (ItemStack inner : list) removed += stack(server, inner, where + " > bundle", sink);
                if (removed != before) {
                    list.removeIf(ItemStack::isEmpty);
                    setComponent(stack, c.type(), new BundleContents(list));
                }
            }
        }
        // Backpacks: their contents live in the Sophisticated Backpacks world data, reachable by the item's
        // own inventory (the item handler capability reaches the same storage).
        if (ModList.get().isLoaded("sophisticatedbackpacks") && BackpackAccess.isBackpack(stack)) {
            IItemHandler handler = BackpackAccess.contents(stack);
            if (handler != null) removed += handler(server, handler, where + " > " + stack.getHoverName().getString(), sink);
        } else {
            IItemHandler handler = stack.getCapability(Capabilities.ItemHandler.ITEM);
            if (handler != null) removed += handler(server, handler, where + " > " + stack.getHoverName().getString(), sink);
        }
        return removed;
    }

    @SuppressWarnings("unchecked")
    private static <T> void setComponent(ItemStack stack, DataComponentType<?> type, T value) {
        stack.set((DataComponentType<T>) type, value);
    }

    public static int handler(MinecraftServer server, IItemHandler handler, String where, Sink sink) {
        int removed = 0;
        for (int i = 0; i < handler.getSlots(); i++) {
            ItemStack stack = handler.getStackInSlot(i);
            if (stack.isEmpty()) continue;
            if (Ownership.isDead(server, stack)) {
                sink.removed(where, stack.copy());
                clearSlot(handler, i, stack);
                removed++;
            } else {
                ItemStack copy = stack.copy();
                int inner = stack(server, copy, where, sink);
                if (inner > 0) {
                    removed += inner;
                    if (handler instanceof IItemHandlerModifiable modifiable) modifiable.setStackInSlot(i, copy);
                    else stack.applyComponents(copy.getComponentsPatch());
                }
            }
        }
        return removed;
    }

    private static void clearSlot(IItemHandler handler, int slot, ItemStack stack) {
        if (handler instanceof IItemHandlerModifiable modifiable) {
            modifiable.setStackInSlot(slot, ItemStack.EMPTY);
            return;
        }
        ItemStack left = handler.extractItem(slot, stack.getCount(), false);
        if (left.getCount() < stack.getCount() && !handler.getStackInSlot(slot).isEmpty()) {
            // A handler that refuses extraction: empty the stack object itself.
            handler.getStackInSlot(slot).setCount(0);
        }
    }

    public static int container(MinecraftServer server, Container container, String where, Sink sink) {
        int removed = 0;
        for (int i = 0; i < container.getContainerSize(); i++) {
            ItemStack stack = container.getItem(i);
            if (stack.isEmpty()) continue;
            int n = stack(server, stack, where, sink);
            if (n > 0) {
                removed += n;
                if (stack.isEmpty()) container.setItem(i, ItemStack.EMPTY);
                container.setChanged();
            }
        }
        return removed;
    }

    /** A player's inventory, cursor, ender chest, Curios slots and carried backpacks. */
    public static int player(ServerPlayer player) {
        if (!enabled()) return 0;
        MinecraftServer server = player.getServer();
        if (server == null) return 0;
        Sink sink = sink(server);
        String where = "player " + player.getGameProfile().getName();
        int removed = container(server, player.getInventory(), where, sink);
        removed += container(server, player.getEnderChestInventory(), where + " (ender chest)", sink);
        ItemStack carried = player.containerMenu.getCarried();
        if (!carried.isEmpty() && stack(server, carried, where + " (cursor)", sink) > 0 && carried.isEmpty()) player.containerMenu.setCarried(ItemStack.EMPTY);
        if (ModList.get().isLoaded("curios")) {
            IItemHandler curios = CuriosAccess.equipped(player);
            if (curios != null) removed += handler(server, curios, where + " (curios)", sink);
        }
        return removed;
    }

    public static int blockEntity(ServerLevel level, BlockEntity be) {
        if (!enabled()) return 0;
        MinecraftServer server = level.getServer();
        BlockPos pos = be.getBlockPos();
        // Never loads a chunk: this runs for chunks that just loaded (SafeItems).
        IItemHandler handler = SafeItems.of(level, be, false);
        String where = "block " + PlacedBlocks.dimension(level) + " " + pos.getX() + " " + pos.getY() + " " + pos.getZ() + " " + PlacedBlocks.blockId(be.getBlockState());
        int removed;
        if (handler != null) removed = handler(server, handler, where, sink(server));
        else return 0;
        if (removed > 0) be.setChanged();
        return removed;
    }

    public static int entity(ServerLevel level, Entity entity) {
        if (!enabled()) return 0;
        MinecraftServer server = level.getServer();
        Sink sink = sink(server);
        String where = "entity " + PlacedBlocks.dimension(level) + " " + entity.blockPosition().toShortString() + " " + entity.getType().toShortString();
        int removed = 0;
        if (entity instanceof ItemEntity item) {
            ItemStack stack = item.getItem();
            removed = stack(server, stack, "ground " + PlacedBlocks.dimension(level) + " " + entity.blockPosition().toShortString(), sink);
            if (stack.isEmpty()) item.discard();
            else if (removed > 0) item.setItem(stack);
            return removed;
        }
        if (entity instanceof ItemFrame frame) {
            ItemStack stack = frame.getItem();
            removed = stack(server, stack, where, sink);
            if (removed > 0) frame.setItem(stack.isEmpty() ? ItemStack.EMPTY : stack);
            return removed;
        }
        if (entity instanceof ServerPlayer) return 0;
        if (entity instanceof LivingEntity living) {
            for (var slot : net.minecraft.world.entity.EquipmentSlot.values()) {
                ItemStack stack = living.getItemBySlot(slot);
                if (stack.isEmpty()) continue;
                int n = stack(server, stack, where, sink);
                if (n > 0) {
                    removed += n;
                    if (stack.isEmpty()) living.setItemSlot(slot, ItemStack.EMPTY);
                }
            }
        }
        IItemHandler handler = entity.getCapability(Capabilities.ItemHandler.ENTITY);
        if (handler != null) removed += handler(server, handler, where, sink);
        return removed;
    }

    public static int menu(ServerPlayer player, AbstractContainerMenu menu) {
        if (!enabled()) return 0;
        MinecraftServer server = player.getServer();
        if (server == null) return 0;
        Sink sink = sink(server);
        int removed = 0;
        for (Slot slot : menu.slots) {
            ItemStack stack = slot.getItem();
            if (stack.isEmpty()) continue;
            int n = stack(server, stack, "menu of " + player.getGameProfile().getName(), sink);
            if (n > 0) {
                removed += n;
                if (stack.isEmpty()) slot.set(ItemStack.EMPTY);
                else slot.setChanged();
            }
        }
        return removed;
    }

    public static int chunk(ServerLevel level, LevelChunk chunk) {
        int removed = 0;
        for (BlockEntity be : List.copyOf(chunk.getBlockEntities().values())) {
            try {
                removed += blockEntity(level, be);
            } catch (Exception e) {
                LifestealModule.LOGGER.warn("Purge: block entity at {} failed: {}", be.getBlockPos(), e.toString());
            }
        }
        return removed;
    }

    public static void forEachLoadedChunk(ServerLevel level, Consumer<LevelChunk> consumer) {
        for (var holder : ((net.lemursaucepacket.fixes.mixin.ChunkMapAccessor) level.getChunkSource().chunkMap).lsp$getChunks()) {
            LevelChunk chunk = holder.getTickingChunk();
            if (chunk != null) consumer.accept(chunk);
        }
    }

    /** Sweeps everything loaded right now: online players, entities and block entities. */
    public static int sweepLoaded(MinecraftServer server) {
        int removed = 0;
        for (ServerPlayer player : server.getPlayerList().getPlayers()) removed += player(player);
        for (ServerLevel level : server.getAllLevels()) {
            for (Entity entity : List.copyOf(iterable(level.getAllEntities()))) removed += entity(level, entity);
            List<LevelChunk> chunks = new ArrayList<>();
            forEachLoadedChunk(level, chunks::add);
            for (LevelChunk chunk : chunks) removed += chunk(level, chunk);
        }
        return removed;
    }

    private static <T> List<T> iterable(Iterable<T> it) {
        List<T> list = new ArrayList<>();
        it.forEach(list::add);
        return list;
    }

    // ---- observation events (NeoForge.EVENT_BUS) ----

    @SubscribeEvent
    public static void onChunkLoad(ChunkEvent.Load event) {
        if (!(event.getLevel() instanceof ServerLevel level) || event.isNewChunk() || !(event.getChunk() instanceof LevelChunk chunk)) return;
        CHUNK_QUEUE.add(new ChunkTask(level, chunk.getPos()));
    }

    @SubscribeEvent
    public static void onEntityJoin(EntityJoinLevelEvent event) {
        if (!(event.getLevel() instanceof ServerLevel level)) return;
        Entity entity = event.getEntity();
        if (entity instanceof ServerPlayer) return;
        try {
            if (LifestealState.get(level.getServer()).hasErasures()) entity(level, entity);
        } catch (Exception e) {
            LifestealModule.LOGGER.warn("Purge: entity {} failed: {}", entity, e.toString());
        }
        if (entity instanceof ItemEntity item && !item.isRemoved()) net.lemursaucepacket.fixes.lifesteal.compass.LostItemIndex.onJoin(level, item);
    }

    @SubscribeEvent
    public static void onContainerOpen(PlayerContainerEvent.Open event) {
        if (event.getEntity() instanceof ServerPlayer player && LifestealState.get(player.server).hasErasures()) menu(player, event.getContainer());
    }

    @SubscribeEvent
    public static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (event.getEntity() instanceof ServerPlayer player && LifestealState.get(player.server).hasErasures()) player(player);
    }

    @SubscribeEvent
    public static void onTick(ServerTickEvent.Post event) {
        MinecraftServer server = event.getServer();
        tick++;
        // Chunks that loaded: a few per tick, only when there is anything to purge or index.
        int budget = LifestealConfig.INDEX_CHUNKS_PER_TICK.get();
        boolean purge = LifestealState.get(server).hasErasures();
        while (budget-- > 0 && !CHUNK_QUEUE.isEmpty()) {
            ChunkTask task = CHUNK_QUEUE.poll();
            LevelChunk chunk = task.level().getChunkSource().getChunkNow(task.pos().x, task.pos().z);
            if (chunk == null) continue;
            try {
                if (purge) chunk(task.level(), chunk);
                net.lemursaucepacket.fixes.lifesteal.compass.ContainerIndex.scanChunk(task.level(), chunk);
                EraseJob.chunkLoaded(server, task.level(), chunk);
            } catch (Exception e) {
                LifestealModule.LOGGER.warn("Purge: chunk {} failed: {}", task.pos(), e.toString());
            }
        }
        if (purge && tick % 100 == 0) {
            for (ServerPlayer player : server.getPlayerList().getPlayers()) player(player);
        }
    }

    @Nullable
    public static String describe(ServerLevel level, BlockPos pos) {
        return PlacedBlocks.dimension(level) + " " + pos.getX() + " " + pos.getY() + " " + pos.getZ();
    }

    private Purge() {
    }
}
