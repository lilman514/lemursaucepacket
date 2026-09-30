package net.lemursaucepacket.fixes.lifesteal;

import javax.annotation.Nullable;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.Container;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.neoforged.neoforge.capabilities.Capabilities;
import net.neoforged.neoforge.items.IItemHandler;
import net.neoforged.neoforge.items.wrapper.InvWrapper;

/**
 * A block entity's items, read without loading chunks.
 *
 * <p>NeoForge's item-handler capability for a chest asks vanilla for the whole double chest, which reads the
 * neighbouring block, and a neighbour in an unloaded chunk gets that chunk loaded, synchronously. Called from
 * chunk load and unload events, that turned into chunks loading each other without end: a server that kept
 * loading the world outward from any chest on a chunk edge, and never finished stopping (it unloads chunks until
 * none are left). So a plain {@link Container} is read directly (a chest is then only its own half, which is
 * what every caller wants), and the capability is only asked when all 3x3 chunks around the block are loaded.
 */
public final class SafeItems {
    private SafeItems() {
    }

    /**
     * The block entity's items, or null when it has none, or when only the capability could read them and
     * {@code mayLoadChunks} is false while a neighbouring chunk isn't loaded.
     */
    @Nullable
    public static IItemHandler of(ServerLevel level, BlockEntity be, boolean mayLoadChunks) {
        if (be instanceof Container container) return new InvWrapper(container);
        if (!mayLoadChunks && !neighbourhoodLoaded(level, be.getBlockPos())) return null;
        try {
            return level.getCapability(Capabilities.ItemHandler.BLOCK, be.getBlockPos(), be.getBlockState(), be, null);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Whether the capability of a block entity here can be read without loading a chunk. */
    public static boolean readableWithoutLoading(ServerLevel level, BlockEntity be) {
        return be instanceof Container || neighbourhoodLoaded(level, be.getBlockPos());
    }

    /** The chunk of {@code pos} and the eight around it are all loaded. */
    public static boolean neighbourhoodLoaded(ServerLevel level, BlockPos pos) {
        int cx = pos.getX() >> 4;
        int cz = pos.getZ() >> 4;
        for (int dx = -1; dx <= 1; dx++) {
            for (int dz = -1; dz <= 1; dz++) {
                if (level.getChunkSource().getChunkNow(cx + dx, cz + dz) == null) return false;
            }
        }
        return true;
    }
}
