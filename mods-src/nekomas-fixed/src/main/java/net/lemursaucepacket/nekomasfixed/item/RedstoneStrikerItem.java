package net.lemursaucepacket.nekomasfixed.item;

import net.lemursaucepacket.nekomasfixed.redstone.StruckRedstone;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.level.Level;

/**
 * The Redstone Striker: strike a block to power that spot at 15 for 16 ticks (1 tick when sneaking), like a
 * flint and steel for redstone. It makes no fire, so unlike upstream it isn't a {@code FlintAndSteelItem} (other mods
 * would treat it as a fire starter). 64 uses.
 */
public class RedstoneStrikerItem extends Item {
    public RedstoneStrikerItem(Properties properties) {
        super(properties);
    }

    @Override
    public InteractionResult useOn(UseOnContext context) {
        Level level = context.getLevel();
        BlockPos pos = context.getClickedPos();
        Player player = context.getPlayer();
        level.playSound(player, pos, SoundEvents.FLINTANDSTEEL_USE, SoundSource.BLOCKS, 1.0F, level.getRandom().nextFloat() * 0.4F + 0.8F);
        if (level instanceof ServerLevel server) {
            StruckRedstone.strike(server, pos, player != null && player.isShiftKeyDown() ? 1 : 16);
            if (player != null) context.getItemInHand().hurtAndBreak(1, player, LivingEntity.getSlotForHand(context.getHand()));
        }
        return InteractionResult.sidedSuccess(level.isClientSide);
    }
}
