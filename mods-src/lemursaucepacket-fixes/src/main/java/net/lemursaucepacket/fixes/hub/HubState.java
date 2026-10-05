package net.lemursaucepacket.fixes.hub;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.saveddata.SavedData;

/**
 * Whether this world's spawn city has been decided ({@code lsp_fixes_hub.dat}): built (and where), or skipped
 * because the world already existed when the pack first ran. The builder never runs twice on its own.
 */
public final class HubState extends SavedData {
    private static final String NAME = "lsp_fixes_hub";
    private static final Factory<HubState> FACTORY = new Factory<>(HubState::new, HubState::load, null);

    public enum Status { UNDECIDED, BUILDING, BUILT, SKIPPED }

    private Status status = Status.UNDECIDED;
    private BlockPos centre = BlockPos.ZERO;
    private int planVersion;

    public static HubState get(MinecraftServer server) {
        return server.overworld().getDataStorage().computeIfAbsent(FACTORY, NAME);
    }

    public Status status() {
        return status;
    }

    public BlockPos centre() {
        return centre;
    }

    public int planVersion() {
        return planVersion;
    }

    public void set(Status status, BlockPos centre, int planVersion) {
        this.status = status;
        this.centre = centre;
        this.planVersion = planVersion;
        setDirty();
    }

    private static HubState load(CompoundTag tag, HolderLookup.Provider registries) {
        HubState s = new HubState();
        try {
            s.status = Status.valueOf(tag.getString("status"));
        } catch (IllegalArgumentException e) {
            s.status = Status.UNDECIDED;
        }
        int[] c = tag.getIntArray("centre");
        if (c.length == 3) s.centre = new BlockPos(c[0], c[1], c[2]);
        s.planVersion = tag.getInt("planVersion");
        return s;
    }

    @Override
    public CompoundTag save(CompoundTag tag, HolderLookup.Provider registries) {
        tag.putString("status", status.name());
        tag.putIntArray("centre", new int[] {centre.getX(), centre.getY(), centre.getZ()});
        tag.putInt("planVersion", planVersion);
        return tag;
    }
}
