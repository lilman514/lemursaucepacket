package net.lemursaucepacket.fixes.lifesteal.compass;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.annotation.Nullable;

import net.lemursaucepacket.fixes.lifesteal.Ownership;
import net.lemursaucepacket.fixes.lifesteal.PlacedBlocks;
import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.level.saveddata.SavedData;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.neoforge.event.entity.EntityLeaveLevelEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

/**
 * Every owned item lying on the ground, anywhere: recorded when the item entity appears in a level (spawned
 * or loaded with its chunk), dropped when it is picked up or despawns, kept with its last position while its
 * chunk is unloaded. Saved as {@code lsp_fixes_lost_items.dat} so the Lost Item Compass sees the whole world.
 */
public final class LostItemIndex extends SavedData {
    private static final String NAME = "lsp_fixes_lost_items";
    private static final Factory<LostItemIndex> FACTORY = new Factory<>(LostItemIndex::new, LostItemIndex::load, null);

    /** One dropped stack. */
    public record Entry(UUID entity, UUID owner, String dimension, BlockPos pos, String item, int count, long seen) {
        public String key() {
            return "g:" + entity;
        }
    }

    private final Map<UUID, Entry> entries = new HashMap<>();

    public static LostItemIndex get(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(FACTORY, NAME);
    }

    public static void onJoin(ServerLevel level, ItemEntity item) {
        Ownership.Owner owner = Ownership.of(item.getItem());
        LostItemIndex index = get(level.getServer());
        if (owner == null) {
            index.remove(item.getUUID());
            return;
        }
        index.put(new Entry(item.getUUID(), owner.uuid(), PlacedBlocks.dimension(level), item.blockPosition(),
                BuiltInRegistries.ITEM.getKey(item.getItem().getItem()).toString(), item.getItem().getCount(), System.currentTimeMillis()));
    }

    @SubscribeEvent
    public static void onLeave(EntityLeaveLevelEvent event) {
        if (!(event.getLevel() instanceof ServerLevel level) || !(event.getEntity() instanceof ItemEntity item)) return;
        Entity.RemovalReason reason = item.getRemovalReason();
        if (reason == null || reason == Entity.RemovalReason.UNLOADED_TO_CHUNK || reason == Entity.RemovalReason.UNLOADED_WITH_PLAYER || reason == Entity.RemovalReason.CHANGED_DIMENSION) {
            LostItemIndex index = get(level.getServer());
            Entry old = index.entries.get(item.getUUID());
            if (old != null) index.put(new Entry(old.entity(), old.owner(), PlacedBlocks.dimension(level), item.blockPosition(), old.item(), item.getItem().getCount(), System.currentTimeMillis()));
            return;
        }
        get(level.getServer()).remove(item.getUUID());
    }

    /** Every few seconds the positions of loaded entries are refreshed and vanished ones dropped. */
    @SubscribeEvent
    public static void onTick(ServerTickEvent.Post event) {
        MinecraftServer server = event.getServer();
        if (server.getTickCount() % 100 != 0) return;
        LostItemIndex index = get(server);
        if (index.entries.isEmpty()) return;
        for (Entry entry : new ArrayList<>(index.entries.values())) {
            ServerLevel level = CompassServer.level(server, entry.dimension());
            if (level == null) continue;
            Entity entity = level.getEntity(entry.entity());
            if (entity instanceof ItemEntity item) {
                if (item.isRemoved()) {
                    index.remove(entry.entity());
                } else if (!item.blockPosition().equals(entry.pos()) || item.getItem().getCount() != entry.count()) {
                    index.put(new Entry(entry.entity(), entry.owner(), entry.dimension(), item.blockPosition(), entry.item(), item.getItem().getCount(), System.currentTimeMillis()));
                }
            } else if (level.getChunkSource().getChunkNow(entry.pos().getX() >> 4, entry.pos().getZ() >> 4) != null) {
                // The chunk is loaded and the item is not there any more.
                index.remove(entry.entity());
            }
        }
    }

    private void put(Entry entry) {
        entries.put(entry.entity(), entry);
        setDirty();
    }

    private void remove(UUID entity) {
        if (entries.remove(entity) != null) setDirty();
    }

    @Nullable
    public Entry entry(UUID entity) {
        return entries.get(entity);
    }

    public List<Entry> of(UUID owner) {
        List<Entry> out = new ArrayList<>();
        for (Entry e : entries.values()) if (e.owner().equals(owner)) out.add(e);
        return out;
    }

    public int count(UUID owner) {
        int n = 0;
        for (Entry e : entries.values()) if (e.owner().equals(owner)) n++;
        return n;
    }

    private static LostItemIndex load(CompoundTag tag, HolderLookup.Provider provider) {
        LostItemIndex index = new LostItemIndex();
        for (Tag t : tag.getList("entries", Tag.TAG_COMPOUND)) {
            CompoundTag e = (CompoundTag) t;
            if (!e.hasUUID("entity") || !e.hasUUID("owner")) continue;
            index.entries.put(e.getUUID("entity"), new Entry(e.getUUID("entity"), e.getUUID("owner"), e.getString("dim"),
                    new BlockPos(e.getInt("x"), e.getInt("y"), e.getInt("z")), e.getString("item"), e.getInt("count"), e.getLong("seen")));
        }
        return index;
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider provider) {
        ListTag list = new ListTag();
        for (Entry entry : entries.values()) {
            CompoundTag e = new CompoundTag();
            e.putUUID("entity", entry.entity());
            e.putUUID("owner", entry.owner());
            e.putString("dim", entry.dimension());
            e.putInt("x", entry.pos().getX());
            e.putInt("y", entry.pos().getY());
            e.putInt("z", entry.pos().getZ());
            e.putString("item", entry.item());
            e.putInt("count", entry.count());
            e.putLong("seen", entry.seen());
            list.add(e);
        }
        tag.put("entries", list);
        return tag;
    }
}
