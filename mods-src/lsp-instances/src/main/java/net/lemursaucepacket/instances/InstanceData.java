package net.lemursaucepacket.instances;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import net.minecraft.core.GlobalPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.NbtOps;
import net.minecraft.nbt.Tag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.saveddata.SavedData;

/**
 * What must outlive a restart (saved with the overworld, {@code data/lsp_instances.dat}): where to send back anyone who
 * logs in inside the instance dimension with no fight running, the things each keeper holds for each player, and which
 * arena each slot has in it (so a slot isn't rebuilt for nothing).
 */
public final class InstanceData extends SavedData {
    /** Where each player inside an instance came from. */
    final Map<UUID, GlobalPos> returns = new HashMap<>();
    /** Per player, per event id: what the event's keeper holds for them. */
    final Map<UUID, Map<String, List<ItemStack>>> kept = new HashMap<>();
    /** Per slot: the arena template id placed there. */
    final Map<Integer, String> slotArena = new HashMap<>();

    static InstanceData get(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(new SavedData.Factory<>(InstanceData::new, InstanceData::load, null), "lsp_instances");
    }

    List<ItemStack> keptFor(UUID player, String event) {
        Map<String, List<ItemStack>> byEvent = kept.get(player);
        List<ItemStack> list = byEvent == null ? null : byEvent.get(event);
        return list == null ? List.of() : list;
    }

    void keep(UUID player, String event, List<ItemStack> stacks) {
        if (stacks.isEmpty()) return;
        kept.computeIfAbsent(player, k -> new HashMap<>()).computeIfAbsent(event, k -> new ArrayList<>()).addAll(stacks);
        setDirty();
    }

    /** Replaces what's kept for this player and event (what didn't fit back in their inventory). */
    void setKept(UUID player, String event, List<ItemStack> left) {
        Map<String, List<ItemStack>> byEvent = kept.computeIfAbsent(player, k -> new HashMap<>());
        if (left.isEmpty()) byEvent.remove(event);
        else byEvent.put(event, new ArrayList<>(left));
        if (byEvent.isEmpty()) kept.remove(player);
        setDirty();
    }

    static InstanceData load(CompoundTag tag, HolderLookup.Provider registries) {
        InstanceData d = new InstanceData();
        CompoundTag returns = tag.getCompound("returns");
        for (String key : returns.getAllKeys()) {
            GlobalPos.CODEC.parse(NbtOps.INSTANCE, returns.get(key)).result().ifPresent(pos -> d.returns.put(UUID.fromString(key), pos));
        }
        CompoundTag kept = tag.getCompound("kept");
        for (String player : kept.getAllKeys()) {
            CompoundTag byEvent = kept.getCompound(player);
            for (String event : byEvent.getAllKeys()) {
                List<ItemStack> stacks = new ArrayList<>();
                for (Tag t : byEvent.getList(event, Tag.TAG_COMPOUND)) {
                    ItemStack s = ItemStack.parseOptional(registries, (CompoundTag) t);
                    if (!s.isEmpty()) stacks.add(s);
                }
                if (!stacks.isEmpty()) d.kept.computeIfAbsent(UUID.fromString(player), k -> new HashMap<>()).put(event, stacks);
            }
        }
        CompoundTag slots = tag.getCompound("slots");
        for (String key : slots.getAllKeys()) d.slotArena.put(Integer.parseInt(key), slots.getString(key));
        return d;
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider registries) {
        CompoundTag returns = new CompoundTag();
        this.returns.forEach((uuid, pos) -> GlobalPos.CODEC.encodeStart(NbtOps.INSTANCE, pos).result().ifPresent(t -> returns.put(uuid.toString(), t)));
        tag.put("returns", returns);
        CompoundTag kept = new CompoundTag();
        this.kept.forEach((uuid, byEvent) -> {
            CompoundTag events = new CompoundTag();
            byEvent.forEach((event, stacks) -> {
                ListTag list = new ListTag();
                for (ItemStack s : stacks) if (!s.isEmpty()) list.add(s.save(registries));
                if (!list.isEmpty()) events.put(event, list);
            });
            if (!events.isEmpty()) kept.put(uuid.toString(), events);
        });
        tag.put("kept", kept);
        CompoundTag slots = new CompoundTag();
        slotArena.forEach((slot, arena) -> slots.putString(Integer.toString(slot), arena));
        tag.put("slots", slots);
        return tag;
    }
}
