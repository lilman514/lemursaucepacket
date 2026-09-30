package net.lemursaucepacket.fixes.mixin.pmmo;

import net.lemursaucepacket.fixes.hardness.HardnessUseGate;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ClickType;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * The Hardness use-gate for menus: a click that would put a material the player can't mine yet into a recipe,
 * a machine or a container other than a chest is dropped ({@link HardnessUseGate}). Lives in the pmmo package
 * because the gate reads the Mining level from Project MMO, so it only applies when that mod is installed.
 */
@Mixin(AbstractContainerMenu.class)
public abstract class UseGateMixin {
    @Inject(method = "clicked", at = @At("HEAD"), cancellable = true)
    private void lsp$refuseGatedMaterials(int slotId, int button, ClickType clickType, Player player, CallbackInfo ci) {
        AbstractContainerMenu self = (AbstractContainerMenu) (Object) this;
        ItemStack blocked = HardnessUseGate.blocked(self, slotId, button, clickType, player);
        if (!blocked.isEmpty()) {
            HardnessUseGate.refuse(self, player, blocked);
            ci.cancel();
        }
    }
}
