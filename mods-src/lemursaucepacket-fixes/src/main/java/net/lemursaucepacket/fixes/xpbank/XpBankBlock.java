package net.lemursaucepacket.fixes.xpbank;

import javax.annotation.Nullable;

import com.mojang.serialization.MapCodec;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.ItemInteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.BaseEntityBlock;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.IntegerProperty;
import net.minecraft.world.phys.BlockHitResult;

/**
 * The XP Bank. Its tier (1 to 3) is in its block state, so a broken bank's item keeps it (the loot table copies it) and
 * places back as the same tier; {@link #FULL} lights its window while it holds anything. Right-click with an empty hand
 * takes what it holds, sneak-right-click shows it, and an upgrade in hand fits the next tier.
 */
public class XpBankBlock extends BaseEntityBlock {
    public static final MapCodec<XpBankBlock> CODEC = simpleCodec(XpBankBlock::new);
    public static final IntegerProperty TIER = IntegerProperty.create("tier", 1, 3);
    public static final BooleanProperty FULL = BooleanProperty.create("full");

    public XpBankBlock(Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any().setValue(TIER, 1).setValue(FULL, false));
    }

    @Override
    protected MapCodec<? extends BaseEntityBlock> codec() {
        return CODEC;
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(TIER, FULL);
    }

    @Override
    protected RenderShape getRenderShape(BlockState state) {
        return RenderShape.MODEL;
    }

    @Nullable
    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new XpBankBlockEntity(pos, state);
    }

    /** A bank placed from an item that held XP lights up straight away. */
    @Override
    public void setPlacedBy(Level level, BlockPos pos, BlockState state, @Nullable LivingEntity placer, ItemStack stack) {
        super.setPlacedBy(level, pos, state, placer, stack);
        if (!level.isClientSide && level.getBlockEntity(pos) instanceof XpBankBlockEntity bank) bank.refreshFull();
    }

    @Override
    protected ItemInteractionResult useItemOn(ItemStack stack, BlockState state, Level level, BlockPos pos, Player player, InteractionHand hand, BlockHitResult hit) {
        if (!(stack.getItem() instanceof XpBankUpgradeItem upgrade)) return ItemInteractionResult.PASS_TO_DEFAULT_BLOCK_INTERACTION;
        if (!level.isClientSide && player instanceof ServerPlayer p && level.getBlockEntity(pos) instanceof XpBankBlockEntity bank) XpBanks.upgrade(p, bank, stack, upgrade);
        return ItemInteractionResult.sidedSuccess(level.isClientSide);
    }

    @Override
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
        if (!level.isClientSide && player instanceof ServerPlayer p && level.getBlockEntity(pos) instanceof XpBankBlockEntity bank) {
            if (player.isShiftKeyDown()) XpBanks.show(p, bank);
            else XpBanks.take(p, bank);
        }
        return InteractionResult.sidedSuccess(level.isClientSide);
    }

    /** A comparator reads what it holds at its own tier's share: 1 for anything, 1 more per 1,000 XP, up to 15. */
    @Override
    protected boolean hasAnalogOutputSignal(BlockState state) {
        return true;
    }

    @Override
    protected int getAnalogOutputSignal(BlockState state, Level level, BlockPos pos) {
        if (!(level.getBlockEntity(pos) instanceof XpBankBlockEntity bank)) return 0;
        long held = 0;
        for (long v : bank.banked().payout(state.getValue(TIER)).values()) held += v;
        return held <= 0 ? 0 : (int) Math.min(15, 1 + held / 1000);
    }
}
