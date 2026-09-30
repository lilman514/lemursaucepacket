package net.lemursaucepacket.fixes.lifesteal;

import javax.annotation.Nullable;

import net.minecraft.world.entity.LivingEntity;
import net.neoforged.neoforge.items.IItemHandler;
import top.theillusivec4.curios.api.CuriosApi;

/** Curios: only loaded when that mod is (callers check {@code ModList}). */
final class CuriosAccess {
    /** Every equipped curio (the worn backpack lives in the back slot). */
    @Nullable
    static IItemHandler equipped(LivingEntity entity) {
        try {
            return CuriosApi.getCuriosInventory(entity).map(inv -> (IItemHandler) inv.getEquippedCurios()).orElse(null);
        } catch (Exception e) {
            LifestealModule.LOGGER.warn("Curios slots unreadable: {}", e.toString());
            return null;
        }
    }

    private CuriosAccess() {
    }
}
