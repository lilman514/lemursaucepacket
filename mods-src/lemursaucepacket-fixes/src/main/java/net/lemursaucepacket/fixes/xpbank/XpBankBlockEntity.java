package net.lemursaucepacket.fixes.xpbank;

import java.util.Map;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.component.DataComponentMap;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.NbtOps;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;

/** An XP Bank's store: what it caught ({@link BankedXp}), saved with the block and carried by its item when broken. */
public class XpBankBlockEntity extends BlockEntity {
    private static final String KEY = "banked";
    private BankedXp banked = BankedXp.EMPTY;

    public XpBankBlockEntity(BlockPos pos, BlockState state) {
        super(XpBankModule.XP_BANK_BE.get(), pos, state);
    }

    public int tier() {
        return getBlockState().getValue(XpBankBlock.TIER);
    }

    public BankedXp banked() {
        return banked;
    }

    /** Machine XP nobody was near to get (skills.MachineXp): kept at this bank's tier now. */
    public void deposit(Map<String, Long> xp) {
        banked = banked.plus(tier(), xp);
        setChanged();
        refreshFull();
    }

    /** Empties the bank and says what it held. */
    public BankedXp takeAll() {
        BankedXp was = banked;
        banked = BankedXp.EMPTY;
        setChanged();
        refreshFull();
        return was;
    }

    /** Lights the window while it holds anything. */
    void refreshFull() {
        if (level == null || level.isClientSide) return;
        BlockState state = getBlockState();
        boolean full = !banked.isEmpty();
        if (state.getValue(XpBankBlock.FULL) != full) level.setBlock(worldPosition, state.setValue(XpBankBlock.FULL, full), Block.UPDATE_ALL);
    }

    @Override
    public void onLoad() {
        super.onLoad();
        if (level instanceof ServerLevel server) XpBanks.loaded(server, worldPosition);
    }

    @Override
    public void setRemoved() {
        super.setRemoved();
        if (level instanceof ServerLevel server) XpBanks.unloaded(server, worldPosition);
    }

    @Override
    public void onChunkUnloaded() {
        super.onChunkUnloaded();
        if (level instanceof ServerLevel server) XpBanks.unloaded(server, worldPosition);
    }

    @Override
    protected void saveAdditional(CompoundTag tag, HolderLookup.Provider registries) {
        super.saveAdditional(tag, registries);
        if (!banked.isEmpty()) BankedXp.CODEC.encodeStart(NbtOps.INSTANCE, banked).result().ifPresent(t -> tag.put(KEY, t));
    }

    @Override
    protected void loadAdditional(CompoundTag tag, HolderLookup.Provider registries) {
        super.loadAdditional(tag, registries);
        banked = tag.contains(KEY) ? BankedXp.CODEC.parse(NbtOps.INSTANCE, tag.get(KEY)).result().orElse(BankedXp.EMPTY) : BankedXp.EMPTY;
    }

    // The item carries what the bank held (the loot table copies the component; placing the item sets it back).

    @Override
    protected void applyImplicitComponents(DataComponentInput input) {
        super.applyImplicitComponents(input);
        banked = input.getOrDefault(XpBankModule.BANKED.get(), BankedXp.EMPTY);
    }

    @Override
    protected void collectImplicitComponents(DataComponentMap.Builder components) {
        super.collectImplicitComponents(components);
        if (!banked.isEmpty()) components.set(XpBankModule.BANKED.get(), banked);
    }

    @Override
    public void removeComponentsFromTag(CompoundTag tag) {
        super.removeComponentsFromTag(tag);
        tag.remove(KEY);
    }
}
