package net.lemursaucepacket.fixes.mixin.create;

import java.util.Optional;

import net.lemursaucepacket.fixes.skills.Gates;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.common.CommonHooks;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

/**
 * Create's crafting blueprint crafts straight from the inventory of whoever clicks it: what it would make, it only makes
 * for someone with the level (skills.Gates). Refused, it finds no result, and puts back what it took. The blueprint sets
 * the crafting player while it works, which is how this knows who's asking.
 */
@Mixin(targets = "com.simibubi.create.content.equipment.blueprint.BlueprintEntity", remap = false)
public abstract class BlueprintGateMixin {
    @Redirect(method = "interactAt", at = @At(value = "INVOKE", target = "Ljava/util/Optional;orElse(Ljava/lang/Object;)Ljava/lang/Object;"), remap = false)
    private Object lsp$skillGate(Optional<Object> made, Object none) {
        Object result = made.orElse(none);
        if (result instanceof ItemStack stack && !stack.isEmpty()) {
            Player player = CommonHooks.getCraftingPlayer();
            if (player != null && !Gates.mayMake(player, stack)) return ItemStack.EMPTY;
        }
        return result;
    }
}
