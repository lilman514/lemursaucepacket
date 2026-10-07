package net.lemursaucepacket.fixes.mixin.pmmo;

import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** The skill and amount of one Project MMO XP gain (both private), for the gain tracker ({@code pmmo.GainHud}). */
@Mixin(targets = "harmonised.pmmo.client.events.ClientTickHandler$GainEntry")
public interface GainEntryAccessor {
    @Accessor("skill")
    String lsp$skill();

    @Accessor("value")
    long lsp$value();
}
