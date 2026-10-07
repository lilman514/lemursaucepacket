package net.lemursaucepacket.instances;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.mojang.serialization.MapCodec;

import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.tags.TagKey;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureProcessor;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureProcessorType;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate;

/**
 * An event's {@code replace} rules while its arena is placed: within each rule's radius of the arena's centre (across,
 * not up), its blocks become another (a clearing round a boss: trees gone, the ground scorched). Built per run in code,
 * never read from data, so its codec carries nothing.
 */
public final class ArenaReplace extends StructureProcessor {
    public static final MapCodec<ArenaReplace> CODEC = MapCodec.unit(() -> new ArenaReplace(List.of(), BlockPos.ZERO));

    private record Rule(Set<Block> blocks, List<TagKey<Block>> tags, BlockState with, double radius) {
        boolean matches(BlockState state) {
            if (blocks.contains(state.getBlock())) return true;
            for (TagKey<Block> tag : tags) if (state.is(tag)) return true;
            return false;
        }
    }

    private final List<Rule> rules;
    private final BlockPos centre;

    private ArenaReplace(List<Rule> rules, BlockPos centre) {
        this.rules = rules;
        this.centre = centre;
    }

    static ArenaReplace of(List<EventDef.Replace> specs, BlockPos centre) {
        List<Rule> rules = new ArrayList<>();
        for (EventDef.Replace spec : specs) {
            Set<Block> blocks = new HashSet<>();
            List<TagKey<Block>> tags = new ArrayList<>();
            for (String id : spec.blocks()) {
                if (id.startsWith("#")) {
                    ResourceLocation tag = ResourceLocation.tryParse(id.substring(1));
                    if (tag != null) tags.add(TagKey.create(Registries.BLOCK, tag));
                } else {
                    ResourceLocation rl = ResourceLocation.tryParse(id);
                    if (rl != null) BuiltInRegistries.BLOCK.getOptional(rl).ifPresentOrElse(blocks::add, () -> LspInstances.LOGGER.warn("Arena replace: no block {}", id));
                }
            }
            ResourceLocation with = ResourceLocation.tryParse(spec.with());
            BlockState state = with == null ? Blocks.AIR.defaultBlockState()
                    : BuiltInRegistries.BLOCK.getOptional(with).map(Block::defaultBlockState).orElseGet(() -> {
                        LspInstances.LOGGER.warn("Arena replace: no block {}, using air", spec.with());
                        return Blocks.AIR.defaultBlockState();
                    });
            rules.add(new Rule(blocks, tags, state, spec.radius()));
        }
        return new ArenaReplace(rules, centre);
    }

    @Override
    public StructureTemplate.StructureBlockInfo processBlock(LevelReader level, BlockPos offset, BlockPos pos, StructureTemplate.StructureBlockInfo original,
                                                             StructureTemplate.StructureBlockInfo current, StructurePlaceSettings settings) {
        if (current == null) return null;
        double dx = current.pos().getX() - centre.getX(), dz = current.pos().getZ() - centre.getZ();
        double d2 = dx * dx + dz * dz;
        for (Rule rule : rules) {
            if (d2 <= rule.radius() * rule.radius() && rule.matches(current.state())) {
                return new StructureTemplate.StructureBlockInfo(current.pos(), rule.with(), null);
            }
        }
        return current;
    }

    @Override
    protected StructureProcessorType<?> getType() {
        return LspInstances.ARENA_REPLACE.get();
    }
}
