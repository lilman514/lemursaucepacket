package net.lemursaucepacket.nekomasfixed.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.LevelAccessor;
import net.minecraft.world.level.block.ObserverBlock;

/** Redstone Striker: a struck observer fires its pulse, which vanilla keeps private. */
@Mixin(ObserverBlock.class)
public interface ObserverBlockInvoker {
    @Invoker("startSignal")
    void nekomasfixed$startSignal(LevelAccessor level, BlockPos pos);
}
