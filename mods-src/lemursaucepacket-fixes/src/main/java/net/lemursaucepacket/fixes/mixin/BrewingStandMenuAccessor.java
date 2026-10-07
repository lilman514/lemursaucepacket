package net.lemursaucepacket.fixes.mixin;

import net.minecraft.world.Container;
import net.minecraft.world.inventory.BrewingStandMenu;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/** The stand behind a brewing stand menu (skills: a stand remembers who last used it). */
@Mixin(BrewingStandMenu.class)
public interface BrewingStandMenuAccessor {
    @Accessor("brewingStand")
    Container lsp$stand();
}
