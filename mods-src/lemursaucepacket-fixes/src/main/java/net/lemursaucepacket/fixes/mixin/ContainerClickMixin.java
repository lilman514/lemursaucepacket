package net.lemursaucepacket.fixes.mixin;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ClickType;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Who is clicking, for slots that only see the item (the brewing stand's ingredient slot, skills.Gates). */
@Mixin(AbstractContainerMenu.class)
public abstract class ContainerClickMixin {
    @Inject(method = "clicked", at = @At("HEAD"))
    private void lsp$clickStart(int slotId, int button, ClickType clickType, Player player, CallbackInfo ci) {
        Gates.CLICKING.set(player);
    }

    @Inject(method = "clicked", at = @At("RETURN"))
    private void lsp$clickEnd(int slotId, int button, ClickType clickType, Player player, CallbackInfo ci) {
        Gates.CLICKING.remove();
    }
}
