package net.lemursaucepacket.nekomasfixed.block;

import com.mojang.serialization.MapCodec;

import net.lemursaucepacket.nekomasfixed.block.entity.KilnBlockEntity;
import net.lemursaucepacket.nekomasfixed.registry.ModBlockEntities;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.stats.Stats;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.AbstractFurnaceBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;

/**
 * The kiln: a furnace for building blocks. It cooks only kiln recipes (glazed terracotta, stone, glass, cracked bricks
 * and so on, see {@code data/nekomasfixed/recipe/*_from_kilning.json}) twice as fast as a furnace, and burns fuel twice
 * as fast, so a fuel item still cooks as many items.
 */
public class KilnBlock extends AbstractFurnaceBlock {
    public static final MapCodec<KilnBlock> CODEC = simpleCodec(KilnBlock::new);

    public KilnBlock(Properties properties) {
        super(properties);
    }

    @Override
    protected MapCodec<KilnBlock> codec() {
        return CODEC;
    }

    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new KilnBlockEntity(pos, state);
    }

    @Override
    public <T extends BlockEntity> BlockEntityTicker<T> getTicker(Level level, BlockState state, BlockEntityType<T> type) {
        return createFurnaceTicker(level, type, ModBlockEntities.KILN.get());
    }

    @Override
    protected void openContainer(Level level, BlockPos pos, Player player) {
        if (level.getBlockEntity(pos) instanceof KilnBlockEntity kiln) {
            player.openMenu(kiln);
            player.awardStat(Stats.INTERACT_WITH_BLAST_FURNACE); // upstream counts it as a blast furnace
        }
    }

    @Override
    public void animateTick(BlockState state, Level level, BlockPos pos, RandomSource random) {
        if (!state.getValue(LIT)) return;
        double x = pos.getX() + 0.5;
        double y = pos.getY();
        double z = pos.getZ() + 0.5;
        if (random.nextDouble() < 0.1) {
            level.playLocalSound(x, y, z, SoundEvents.BLASTFURNACE_FIRE_CRACKLE, SoundSource.BLOCKS, 1.0F, 1.0F, false);
        }
        Direction facing = state.getValue(FACING);
        double across = random.nextDouble() * 0.6 - 0.3;
        double dx = facing.getAxis() == Direction.Axis.X ? facing.getStepX() * 0.52 : across;
        double dy = random.nextDouble() * 9.0 / 16.0;
        double dz = facing.getAxis() == Direction.Axis.Z ? facing.getStepZ() * 0.52 : across;
        level.addParticle(ParticleTypes.SMOKE, x + dx, y + dy, z + dz, 0.0, 0.0, 0.0);
    }
}
