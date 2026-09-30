package net.lemursaucepacket.fixes.mixin.gravestone;

import de.maxhenkel.gravestone.corelib.death.PlayerDeathEvent;
import de.maxhenkel.gravestone.events.DeathEvents;
import net.lemursaucepacket.fixes.lifesteal.GraveEssence;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Graves need a Grave Essence. The Gravestone mod's handler for its own {@code PlayerDeathEvent} (posted at
 * LOWEST priority from the {@code LivingDropsEvent}, not cancellable) places the grave and then clears the
 * drop list. Leaving it before it does either keeps the drops, so the player's items fall on the ground as
 * in vanilla. Its only other early exits are keepInventory and "no space", which behave the same way.
 */
@Mixin(value = DeathEvents.class, remap = false)
public abstract class DeathEventsMixin {
    @Inject(method = "playerDeath(Lde/maxhenkel/gravestone/corelib/death/PlayerDeathEvent;)V", at = @At("HEAD"), cancellable = true)
    private void lsp$requireGraveEssence(PlayerDeathEvent event, CallbackInfo ci) {
        if (!GraveEssence.allowGrave(event.getDeath(), event.getPlayer())) {
            // Still remembered for the mod's /restore command, which admins may want after a bug.
            event.storeDeath();
            ci.cancel();
        }
    }
}
