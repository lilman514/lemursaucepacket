package net.lemursaucepacket.nekomasfixed.clock;

import java.util.ArrayList;
import java.util.List;

import net.lemursaucepacket.nekomasfixed.registry.ModBlocks;
import net.lemursaucepacket.nekomasfixed.registry.ModComponents;
import net.minecraft.advancements.CriteriaTriggers;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.component.DataComponents;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.ItemInteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.pattern.BlockInWorld;
import net.minecraft.world.level.gameevent.GameEvent;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.common.util.BlockSnapshot;
import net.neoforged.neoforge.event.EventHooks;
import net.neoforged.neoforge.event.entity.player.PlayerInteractEvent;
import net.neoforged.neoforge.event.entity.player.UseItemOnBlockEvent;

/**
 * What the vanilla clock item gains. The item itself stays vanilla (upstream swaps it for a block item); these events
 * add the two uses:
 * <ul>
 * <li>Used on a block, it places our floor or wall clock, the way a torch places (and goes through NeoForge's place
 * event, so claims and safe zones apply).</li>
 * <li>Used in the air, it records the time of day, or forgets it again. A clock with a recorded time glints, shows the
 * time in its tooltip and, once placed, pulses at that time every day.</li>
 * </ul>
 */
public final class ClockItemEvents {
    public static void init() {
        NeoForge.EVENT_BUS.addListener(ClockItemEvents::onUseOnBlock);
        NeoForge.EVENT_BUS.addListener(ClockItemEvents::onUseInAir);
    }

    private static void onUseOnBlock(UseItemOnBlockEvent event) {
        // After the block had its say (chests still open), like any block item.
        if (event.getUsePhase() != UseItemOnBlockEvent.UsePhase.ITEM_AFTER_BLOCK || !event.getItemStack().is(Items.CLOCK)) return;
        Player player = event.getPlayer();
        ItemStack stack = event.getItemStack();
        if (player != null && !player.getAbilities().mayBuild
                && !stack.canPlaceOnBlockInAdventureMode(new BlockInWorld(event.getLevel(), event.getPos(), false))) {
            return;
        }
        InteractionResult result = place(new BlockPlaceContext(event.getUseOnContext()));
        // A clock that can't go here does nothing else either (like a block item), rather than recording the time.
        event.cancelWithResult(result.consumesAction() ? ItemInteractionResult.sidedSuccess(event.getLevel().isClientSide) : ItemInteractionResult.FAIL);
    }

    private static void onUseInAir(PlayerInteractEvent.RightClickItem event) {
        ItemStack stack = event.getItemStack();
        if (!stack.is(Items.CLOCK)) return;
        Level level = event.getLevel();
        if (!level.isClientSide) {
            if (stack.has(ModComponents.STORED_TIME.get())) {
                stack.remove(ModComponents.STORED_TIME.get());
                stack.remove(DataComponents.ENCHANTMENT_GLINT_OVERRIDE);
            } else {
                stack.set(ModComponents.STORED_TIME.get(), new StoredTime(StoredTime.timeOfDay(level)));
                stack.set(DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true);
            }
        }
        event.setCancellationResult(InteractionResult.sidedSuccess(level.isClientSide));
        event.setCanceled(true);
    }

    private static InteractionResult place(BlockPlaceContext context) {
        if (!context.canPlace()) return InteractionResult.FAIL;
        BlockState state = placementState(context);
        if (state == null) return InteractionResult.FAIL;
        // The client places it too, as a prediction, the way vanilla block items do; the server's word is final.
        return context.getLevel() instanceof ServerLevel level ? placeWithEvent(level, context, state) : setClock(context, state);
    }

    /** {@code StandingAndWallBlockItem}'s choice: the floor clock when looking down, else a wall clock on the wall looked at. */
    private static BlockState placementState(BlockPlaceContext context) {
        BlockState wall = ModBlocks.WALL_CLOCK.get().getStateForPlacement(context);
        Level level = context.getLevel();
        BlockPos pos = context.getClickedPos();
        for (Direction direction : context.getNearestLookingDirections()) {
            if (direction == Direction.UP) continue;
            BlockState candidate = direction == Direction.DOWN ? ModBlocks.CLOCK.get().getStateForPlacement(context) : wall;
            if (candidate != null && candidate.canSurvive(level, pos)) {
                return level.isUnobstructed(candidate, pos, CollisionContext.empty()) ? candidate : null;
            }
        }
        return null;
    }

    /**
     * What {@code CommonHooks.onPlaceItemIntoWorld} does for a block item on the server: record the change, post the
     * place event, and undo the change (and give the clock back) when a listener cancels it.
     */
    private static InteractionResult placeWithEvent(ServerLevel level, BlockPlaceContext context, BlockState state) {
        ItemStack stack = context.getItemInHand();
        int count = stack.getCount();
        InteractionResult result;
        level.captureBlockSnapshots = true;
        try {
            result = setClock(context, state);
        } finally {
            level.captureBlockSnapshots = false;
        }
        List<BlockSnapshot> snapshots = new ArrayList<>(level.capturedBlockSnapshots);
        level.capturedBlockSnapshots.clear();
        if (!result.consumesAction() || snapshots.isEmpty()) return result;

        BlockSnapshot snapshot = snapshots.getFirst();
        if (EventHooks.onBlockPlace(context.getPlayer(), snapshot, context.getClickedFace())) {
            level.restoringBlockSnapshots = true;
            snapshot.restore(snapshot.getFlags() | Block.UPDATE_CLIENTS);
            level.restoringBlockSnapshots = false;
            stack.setCount(count);
            return InteractionResult.FAIL;
        }
        // Capturing held back the block updates; send them now.
        BlockState placed = level.getBlockState(snapshot.getPos());
        placed.onPlace(level, snapshot.getPos(), snapshot.getState(), false);
        level.markAndNotifyBlock(snapshot.getPos(), level.getChunkAt(snapshot.getPos()), snapshot.getState(), placed, snapshot.getFlags(), 512);
        return result;
    }

    /** {@code BlockItem.place} for the clock: set the block, hand it the item's recorded time, sound, consume the clock. */
    private static InteractionResult setClock(BlockPlaceContext context, BlockState state) {
        Level level = context.getLevel();
        BlockPos pos = context.getClickedPos();
        Player player = context.getPlayer();
        ItemStack stack = context.getItemInHand();
        if (!level.setBlock(pos, state, Block.UPDATE_ALL_IMMEDIATE)) return InteractionResult.FAIL;

        BlockItem.updateCustomBlockEntityTag(level, player, pos, stack);
        BlockEntity clock = level.getBlockEntity(pos);
        if (clock != null) {
            clock.applyComponentsFromItemStack(stack);
            clock.setChanged();
        }
        state.getBlock().setPlacedBy(level, pos, state, player, stack);
        if (player instanceof ServerPlayer serverPlayer) CriteriaTriggers.PLACED_BLOCK.trigger(serverPlayer, pos, stack);

        SoundType sound = state.getSoundType(level, pos, player);
        level.playSound(player, pos, sound.getPlaceSound(), SoundSource.BLOCKS, (sound.getVolume() + 1.0F) / 2.0F, sound.getPitch() * 0.8F);
        level.gameEvent(GameEvent.BLOCK_PLACE, pos, GameEvent.Context.of(player, state));
        stack.consume(1, player);
        return InteractionResult.sidedSuccess(level.isClientSide);
    }

    private ClockItemEvents() {
    }
}
