package net.lemursaucepacket.instances;

import com.mojang.serialization.MapCodec;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureProcessor;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureProcessorType;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate;

/** Leaves out every block that holds items (chests, barrels, hoppers...): an arena placed each run mustn't refill loot. */
public final class StripContainers extends StructureProcessor {
    public static final StripContainers INSTANCE = new StripContainers();
    public static final MapCodec<StripContainers> CODEC = MapCodec.unit(INSTANCE);

    @Override
    public StructureTemplate.StructureBlockInfo processBlock(LevelReader level, BlockPos offset, BlockPos pos, StructureTemplate.StructureBlockInfo original,
                                                             StructureTemplate.StructureBlockInfo current, StructurePlaceSettings settings) {
        if (current.nbt() != null && (current.nbt().contains("Items") || current.nbt().contains("LootTable"))) {
            return new StructureTemplate.StructureBlockInfo(current.pos(), Blocks.AIR.defaultBlockState(), null);
        }
        return current;
    }

    @Override
    protected StructureProcessorType<?> getType() {
        return LspInstances.STRIP_CONTAINERS.get();
    }
}
