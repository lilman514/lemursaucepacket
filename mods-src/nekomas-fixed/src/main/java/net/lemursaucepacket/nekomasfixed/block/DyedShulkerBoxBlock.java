package net.lemursaucepacket.nekomasfixed.block;

import net.lemursaucepacket.nekomasfixed.Colour;
import net.lemursaucepacket.nekomasfixed.block.entity.DyedShulkerBoxBlockEntity;
import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.ShulkerBoxBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.entity.ShulkerBoxBlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/**
 * A shulker box in one of the new colours: the vanilla box with its colour's {@link Colour#base} DyeColor and our own
 * block entity type (for our renderer). The overrides below are the three places vanilla names the vanilla type or
 * the vanilla box of that DyeColor.
 */
public class DyedShulkerBoxBlock extends ShulkerBoxBlock {
    private final Colour colour;

    public DyedShulkerBoxBlock(Colour colour, Properties properties) {
        super(colour.base, properties);
        this.colour = colour;
    }

    public Colour colour() {
        return colour;
    }

    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new DyedShulkerBoxBlockEntity(pos, state);
    }

    @Override
    public <T extends BlockEntity> BlockEntityTicker<T> getTicker(Level level, BlockState state, BlockEntityType<T> type) {
        return createTickerHelper(type, ModBlockEntities.SHULKER_BOX.get(), ShulkerBoxBlockEntity::tick);
    }

    @Override
    public BlockState playerWillDestroy(Level level, BlockPos pos, BlockState state, Player player) {
        // In creative, vanilla drops a full box as the vanilla box of the same DyeColor (amber would come back yellow).
        // Drop ours, then empty the box so the vanilla code finds nothing left to drop.
        if (!level.isClientSide && player.isCreative() && level.getBlockEntity(pos) instanceof ShulkerBoxBlockEntity box && !box.isEmpty()) {
            ItemStack stack = new ItemStack(this);
            stack.applyComponents(box.collectComponents());
            ItemEntity drop = new ItemEntity(level, pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5, stack);
            drop.setDefaultPickUpDelay();
            level.addFreshEntity(drop);
            box.clearContent();
        }
        return super.playerWillDestroy(level, pos, state, player);
    }

    @Override
    public ItemStack getCloneItemStack(LevelReader level, BlockPos pos, BlockState state) {
        ItemStack stack = new ItemStack(this);
        level.getBlockEntity(pos, ModBlockEntities.SHULKER_BOX.get()).ifPresent(box -> box.saveToItem(stack, level.registryAccess()));
        return stack;
    }
}
