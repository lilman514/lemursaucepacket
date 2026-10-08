package net.lemursaucepacket.nekomasfixed.registry;

import java.util.function.Function;

import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.block.entity.ClockBlockEntity;
import net.lemursaucepacket.nekomasfixed.block.entity.DyedBedBlockEntity;
import net.lemursaucepacket.nekomasfixed.block.entity.DyedShulkerBoxBlockEntity;
import net.lemursaucepacket.nekomasfixed.block.entity.KilnBlockEntity;
import net.minecraft.core.registries.Registries;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModBlockEntities {
    static final DeferredRegister<BlockEntityType<?>> BLOCK_ENTITIES = DeferredRegister.create(Registries.BLOCK_ENTITY_TYPE, NekomasFixed.MOD_ID);

    @SuppressWarnings("DataFlowIssue") // a null data fixer type is how every modded block entity is built
    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<ClockBlockEntity>> CLOCK = BLOCK_ENTITIES.register("clock",
            () -> BlockEntityType.Builder.of(ClockBlockEntity::new, ModBlocks.CLOCK.get(), ModBlocks.WALL_CLOCK.get()).build(null));

    @SuppressWarnings("DataFlowIssue")
    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<KilnBlockEntity>> KILN = BLOCK_ENTITIES.register("kiln",
            () -> BlockEntityType.Builder.of(KilnBlockEntity::new, ModBlocks.KILN.get()).build(null));

    /** The four new-colour beds (see {@code DyedBedBlockEntity} for why they don't share vanilla's type). */
    @SuppressWarnings("DataFlowIssue")
    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<DyedBedBlockEntity>> BED = BLOCK_ENTITIES.register("bed",
            () -> BlockEntityType.Builder.of(DyedBedBlockEntity::new, familyBlocks(ModBlocks.DyeFamily::bed)).build(null));

    @SuppressWarnings("DataFlowIssue")
    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<DyedShulkerBoxBlockEntity>> SHULKER_BOX = BLOCK_ENTITIES.register("shulker_box",
            () -> BlockEntityType.Builder.of(DyedShulkerBoxBlockEntity::new, familyBlocks(ModBlocks.DyeFamily::shulkerBox)).build(null));

    private static Block[] familyBlocks(Function<ModBlocks.DyeFamily, DeferredBlock<?>> pick) {
        return ModBlocks.FAMILIES.values().stream().map(pick).map(DeferredBlock::get).toArray(Block[]::new);
    }

    private ModBlockEntities() {
    }
}
