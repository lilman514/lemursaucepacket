package net.lemursaucepacket.fixes.construction;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import it.unimi.dsi.fastutil.longs.LongOpenHashSet;
import net.lemursaucepacket.fixes.skills.Levels;
import net.minecraft.core.BlockPos;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.neoforged.neoforge.common.util.BlockSnapshot;
import net.neoforged.neoforge.common.util.FakePlayer;
import net.neoforged.neoforge.event.level.BlockEvent;

/**
 * Construction, the sixteenth skill: XP for building, RuneScape style (the fancier the block, the more it pays), and a
 * chance, growing with the level, that a block you place isn't used up. A block pays once it has stood for a minute, and
 * a spot pays once until the server restarts, so placing and breaking earns nothing. The Builder's Wand's blocks pay too
 * ({@link #placedByWand}); the Mason's Palette's never do.
 */
public final class Construction {
    /** True while the Mason's Palette places: those blocks are free, pay nothing and aren't saved. */
    static final ThreadLocal<Boolean> PALETTE = ThreadLocal.withInitial(() -> false);
    private static final long WAIT = 60 * 20;
    private static final int PAID_CAP = 1_000_000;

    private record Pending(UUID player, ResourceKey<Level> level, long pos, Block block, int xp, long due) {
    }

    private static final ArrayDeque<Pending> PENDING = new ArrayDeque<>();
    private static final Map<ResourceKey<Level>, LongOpenHashSet> PAID = new HashMap<>();
    private static int paidCount;
    /** Blocks the saving perk gives back, on the next tick: NeoForge sets the placing stack's count after the place event. */
    private static final List<Runnable> GIVE_BACK = new ArrayList<>();

    // ---------------------------------------------------------------- placing

    static void onPlaced(BlockEvent.EntityPlaceEvent e) {
        if (e.isCanceled() || !(e.getLevel() instanceof ServerLevel level)) return;
        List<BlockPos> spots = spots(e);
        if (PALETTE.get()) {
            for (BlockPos pos : spots) FreeBlocks.mark(level, pos, level.getBlockState(pos).getBlock());
            return;
        }
        for (BlockPos pos : spots) FreeBlocks.onRealPlace(level, pos, level.getBlockState(pos).getBlock());
        if (!(e.getEntity() instanceof ServerPlayer p) || p instanceof FakePlayer || p.isCreative() || p.isSpectator()) return;
        Block block = e.getPlacedBlock().getBlock();
        int xp = BuildRules.xp(block);
        if (xp > 0) queue(p, level, e.getPos(), block, xp);
        if (BuildRules.saveEligible(block) && p.getRandom().nextDouble() < BuildRules.saveChance(Levels.of(p, "construction"))) save(p, level, block, spots);
    }

    private static List<BlockPos> spots(BlockEvent.EntityPlaceEvent e) {
        if (e instanceof BlockEvent.EntityMultiPlaceEvent multi) {
            List<BlockPos> out = new ArrayList<>();
            for (BlockSnapshot s : multi.getReplacedBlockSnapshots()) out.add(s.getPos());
            return out;
        }
        return List.of(e.getPos());
    }

    /**
     * The saving perk: the block goes back in the bag (one of the stack it came from, so a stack with anything on it comes
     * back as it was), and the one placed is free (it drops nothing if broken).
     */
    private static void save(ServerPlayer p, ServerLevel level, Block block, List<BlockPos> spots) {
        ItemStack back = ItemStack.EMPTY;
        for (InteractionHand hand : InteractionHand.values()) {
            ItemStack held = p.getItemInHand(hand);
            if (held.is(block.asItem())) {
                back = held.copyWithCount(1);
                break;
            }
        }
        if (back.isEmpty()) back = new ItemStack(block.asItem());
        ItemStack give = back;
        GIVE_BACK.add(() -> {
            if (!p.getInventory().add(give)) p.drop(give, false);
            p.playNotifySound(SoundEvents.ITEM_PICKUP, SoundSource.PLAYERS, 0.25f, 1.7f);
        });
        for (BlockPos pos : spots) FreeBlocks.mark(level, pos, level.getBlockState(pos).getBlock());
    }

    /** The Builder's Wand (kubejs gear.js) sets its blocks directly: each pays as if placed by hand. */
    public static void placedByWand(ServerPlayer p, BlockPos pos) {
        if (p instanceof FakePlayer || p.isCreative()) return;
        ServerLevel level = p.serverLevel();
        Block block = level.getBlockState(pos).getBlock();
        FreeBlocks.onRealPlace(level, pos, block);
        int xp = BuildRules.xp(block);
        if (xp > 0) queue(p, level, pos, block, xp);
    }

    private static void queue(ServerPlayer p, ServerLevel level, BlockPos pos, Block block, int xp) {
        LongOpenHashSet paid = PAID.get(level.dimension());
        if (paid != null && paid.contains(pos.asLong())) return;
        PENDING.add(new Pending(p.getUUID(), level.dimension(), pos.asLong(), block, xp, level.getGameTime() + WAIT));
    }

    // ---------------------------------------------------------------- paying

    /** Once a second: the blocks that have stood for a minute pay, one sum a player. */
    static void tick(MinecraftServer server) {
        if (!GIVE_BACK.isEmpty()) {
            List<Runnable> now = List.copyOf(GIVE_BACK);
            GIVE_BACK.clear();
            now.forEach(Runnable::run);
        }
        if (server.getTickCount() % 20 != 7 || PENDING.isEmpty()) return;
        Map<ServerPlayer, Integer> sums = new HashMap<>();
        while (!PENDING.isEmpty()) {
            Pending next = PENDING.peek();
            ServerLevel level = server.getLevel(next.level());
            if (level != null && next.due() > level.getGameTime()) break;
            PENDING.poll();
            if (level == null) continue;
            BlockPos pos = BlockPos.of(next.pos());
            if (level.isLoaded(pos) && level.getBlockState(pos).getBlock() != next.block()) continue;
            if (paidCount > PAID_CAP) {
                PAID.clear();
                paidCount = 0;
            }
            if (!PAID.computeIfAbsent(next.level(), k -> new LongOpenHashSet()).add(next.pos())) continue;
            paidCount++;
            ServerPlayer p = server.getPlayerList().getPlayer(next.player());
            if (p != null) sums.merge(p, next.xp(), Integer::sum);
        }
        sums.forEach((p, xp) -> Levels.addXp(p, "construction", xp));
    }

    private Construction() {
    }
}
