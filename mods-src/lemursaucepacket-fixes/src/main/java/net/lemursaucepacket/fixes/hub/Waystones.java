package net.lemursaucepacket.fixes.hub;

import net.minecraft.commands.arguments.blocks.BlockStateParser;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/**
 * Places a named waystone from code. The Waystones mod has no API for that, so this goes through reflection; without
 * the mod it's just skipped. Used for Lemurton's (global: everyone can travel there) and the Crandor memorial's (found
 * and activated like any other).
 */
public final class Waystones {
    /** Places the waystone with its lower half at {@code pos} and registers it like a village one. True if it worked. */
    public static boolean place(ServerLevel level, BlockPos pos, String name, String facing, boolean global) {
        MinecraftServer server = level.getServer();
        try {
            BlockState lower = parse(level, "waystones:waystone[half=lower,facing=" + facing + "]");
            BlockState upper = parse(level, "waystones:waystone[half=upper,facing=" + facing + "]");
            level.setBlock(pos, lower, Block.UPDATE_ALL);
            level.setBlock(pos.above(), upper, Block.UPDATE_ALL);
            BlockEntity be = level.getBlockEntity(pos);
            if (be == null) {
                HubBuilder.LOGGER.warn("The waystone at {} has no block entity", pos.toShortString());
                return false;
            }
            Class<?> originCls = Class.forName("net.blay09.mods.waystones.api.WaystoneOrigin");
            Class<?> visCls = Class.forName("net.blay09.mods.waystones.api.WaystoneVisibility");
            Object village = enumValue(originCls, "VILLAGE");
            be.getClass().getMethod("initializeWaystone", ServerLevelAccessor.class, net.minecraft.world.entity.LivingEntity.class, originCls).invoke(be, level, null, village);
            Object waystone = be.getClass().getMethod("getWaystone").invoke(be);
            waystone.getClass().getMethod("setName", Component.class).invoke(waystone, Component.literal(name));
            if (global) waystone.getClass().getMethod("setVisibility", visCls).invoke(waystone, enumValue(visCls, "GLOBAL"));
            Class<?> mgrCls = Class.forName("net.blay09.mods.waystones.core.WaystoneManagerImpl");
            Class<?> apiWaystone = Class.forName("net.blay09.mods.waystones.api.Waystone");
            Object mgr = mgrCls.getMethod("get", MinecraftServer.class).invoke(null, server);
            mgrCls.getMethod("updateWaystone", apiWaystone).invoke(mgr, waystone);
            Class.forName("net.blay09.mods.waystones.core.WaystoneSyncManager").getMethod("sendWaystoneUpdateToAll", MinecraftServer.class, apiWaystone).invoke(null, server, waystone);
            be.setChanged();
            HubBuilder.LOGGER.info("Waystone '{}' at {}{}", name, pos.toShortString(), global ? " (global)" : "");
            return true;
        } catch (ClassNotFoundException e) {
            HubBuilder.LOGGER.info("Waystones isn't installed; no waystone '{}'", name);
        } catch (Exception e) {
            HubBuilder.LOGGER.warn("Couldn't set up the waystone '{}'", name, e);
        }
        return false;
    }

    private static BlockState parse(ServerLevel level, String s) throws Exception {
        return BlockStateParser.parseForBlock(level.holderLookup(Registries.BLOCK), s, false).blockState();
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Object enumValue(Class<?> cls, String name) {
        return Enum.valueOf((Class<Enum>) cls, name);
    }

    private Waystones() {
    }
}
