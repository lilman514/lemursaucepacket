package net.lemursaucepacket.fixes.mixin.friendsandfoes;

import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;

/**
 * A marker, applied to Player after Friends & Foes' own mixin (priority 1500 over its 1000): LspFixesMixinPlugin's
 * postApply then puts a skill check at the top of the totem handler Friends & Foes merged into Player
 * ({@code friendsandfoes_tryUseTotems}), so its Totems of Freezing and Illusion wait for their wear level
 * (skills.Gates.friendsAndFoesTotemReady). A plain injector can't target a method another mixin added.
 */
@Mixin(value = Player.class, priority = 1500)
public abstract class FriendsAndFoesTotemHookMixin {
}
