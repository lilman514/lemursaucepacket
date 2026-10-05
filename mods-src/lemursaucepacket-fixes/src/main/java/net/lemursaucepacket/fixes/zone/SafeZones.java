package net.lemursaucepacket.fixes.zone;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.Tag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.phys.AABB;

/**
 * The protected areas (the spawn city and any others an admin adds), saved with the world as
 * {@code lsp_fixes_zones.dat}. A zone is a box in one dimension (usually full build height) with flags for what
 * it protects; {@link ZoneEvents} enforces them. A fresh world has none until the hub is placed.
 */
public final class SafeZones extends SavedData {
    private static final String NAME = "lsp_fixes_zones";
    private static final Factory<SafeZones> FACTORY = new Factory<>(SafeZones::new, SafeZones::load, null);

    /** What a zone protects. All on for a new zone. */
    public enum Flag {
        /** No breaking or placing blocks, no buckets, fire or tool-changes on blocks, no trampling, no mob griefing. */
        BUILD,
        /** Players can't hurt players (or their pets). */
        PVP,
        /** No hostile mobs spawn, and any that wander in are removed. */
        MOBS,
        /** Explosions don't break blocks or hurt players and peaceful mobs inside. */
        EXPLOSIONS,
        /** Fire doesn't spread or burn blocks, lightning doesn't start fires. */
        FIRE,
        /** Lava and water can't make cobblestone, obsidian or fire inside. */
        FLUIDS,
        /** Item frames, armour stands, paintings and peaceful mobs can't be hurt or changed. */
        DECOR;

        public String id() {
            return name().toLowerCase(Locale.ROOT);
        }

        public static Flag parse(String id) {
            return valueOf(id.toUpperCase(Locale.ROOT));
        }
    }

    public record Zone(String name, String dimension, int minX, int minY, int minZ, int maxX, int maxY, int maxZ, Set<Flag> flags) {
        public boolean contains(String dim, double x, double y, double z) {
            return dimension.equals(dim) && x >= minX && x < maxX + 1 && y >= minY && y < maxY + 1 && z >= minZ && z < maxZ + 1;
        }

        public boolean contains(String dim, BlockPos pos) {
            return contains(dim, pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5);
        }

        public AABB box() {
            return new AABB(minX, minY, minZ, maxX + 1, maxY + 1, maxZ + 1);
        }

        CompoundTag save() {
            CompoundTag tag = new CompoundTag();
            tag.putString("name", name);
            tag.putString("dimension", dimension);
            tag.putIntArray("min", new int[] {minX, minY, minZ});
            tag.putIntArray("max", new int[] {maxX, maxY, maxZ});
            ListTag fl = new ListTag();
            for (Flag f : flags) fl.add(net.minecraft.nbt.StringTag.valueOf(f.id()));
            tag.put("flags", fl);
            return tag;
        }

        static Zone load(CompoundTag tag) {
            int[] min = tag.getIntArray("min");
            int[] max = tag.getIntArray("max");
            Set<Flag> flags = EnumSet.noneOf(Flag.class);
            for (Tag t : tag.getList("flags", Tag.TAG_STRING)) {
                try {
                    flags.add(Flag.parse(t.getAsString()));
                } catch (IllegalArgumentException ignored) {
                    // a flag from a newer version: drop it
                }
            }
            return new Zone(tag.getString("name"), tag.getString("dimension"), min[0], min[1], min[2], max[0], max[1], max[2], flags);
        }
    }

    private final List<Zone> zones = new ArrayList<>();

    /** The zones; cached per server so the hot event paths never touch the data storage. */
    private static SafeZones cached;
    private static MinecraftServer cachedFor;

    public static SafeZones get(MinecraftServer server) {
        if (cachedFor != server || cached == null) {
            cached = server.overworld().getDataStorage().computeIfAbsent(FACTORY, NAME);
            cachedFor = server;
        }
        return cached;
    }

    /** The first zone at this position that has the flag, or null. Cheap: a handful of box checks. */
    public static Zone at(Level level, BlockPos pos, Flag flag) {
        return at(level, pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5, flag);
    }

    public static Zone at(Level level, double x, double y, double z, Flag flag) {
        if (level.isClientSide() || level.getServer() == null) return null;
        String dim = level.dimension().location().toString();
        for (Zone zone : get(level.getServer()).zones) if (zone.flags().contains(flag) && zone.contains(dim, x, y, z)) return zone;
        return null;
    }

    public List<Zone> all() {
        return List.copyOf(zones);
    }

    public Zone named(String name) {
        for (Zone z : zones) if (z.name().equalsIgnoreCase(name)) return z;
        return null;
    }

    /** Adds or replaces the zone with this name. */
    public void put(Zone zone) {
        zones.removeIf(z -> z.name().equalsIgnoreCase(zone.name()));
        zones.add(zone);
        setDirty();
    }

    public boolean remove(String name) {
        boolean removed = zones.removeIf(z -> z.name().equalsIgnoreCase(name));
        if (removed) setDirty();
        return removed;
    }

    private static SafeZones load(CompoundTag tag, HolderLookup.Provider registries) {
        SafeZones data = new SafeZones();
        for (Tag t : tag.getList("zones", Tag.TAG_COMPOUND)) data.zones.add(Zone.load((CompoundTag) t));
        return data;
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider registries) {
        ListTag list = new ListTag();
        for (Zone z : zones) list.add(z.save());
        tag.put("zones", list);
        return tag;
    }
}
