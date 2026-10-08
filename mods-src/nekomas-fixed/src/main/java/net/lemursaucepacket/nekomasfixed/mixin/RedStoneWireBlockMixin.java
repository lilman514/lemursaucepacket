package net.lemursaucepacket.nekomasfixed.mixin;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;

import net.lemursaucepacket.nekomasfixed.redstone.StruckRedstone;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.RedStoneWireBlock;

/**
 * Redstone Striker: struck dust reads 15 (1.21.1 has no wire evaluator to hook). This wraps the call rather than the
 * method, because Lithium (in the pack) replaces the method's body from its head.
 */
@Mixin(RedStoneWireBlock.class)
public abstract class RedStoneWireBlockMixin {
    @WrapOperation(method = "updatePowerStrength", at = @At(value = "INVOKE",
            target = "Lnet/minecraft/world/level/block/RedStoneWireBlock;calculateTargetStrength(Lnet/minecraft/world/level/Level;Lnet/minecraft/core/BlockPos;)I"))
    private int nekomasfixed$struckWire(RedStoneWireBlock wire, Level level, BlockPos pos, Operation<Integer> original) {
        return StruckRedstone.isStruck(level, pos) ? 15 : original.call(wire, level, pos);
    }
}
