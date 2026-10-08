package net.lemursaucepacket.nekomasfixed.registry;

import net.lemursaucepacket.nekomasfixed.NekomasFixed;
import net.lemursaucepacket.nekomasfixed.menu.KilnMenu;
import net.minecraft.core.registries.Registries;
import net.minecraft.world.flag.FeatureFlags;
import net.minecraft.world.inventory.MenuType;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModMenus {
    static final DeferredRegister<MenuType<?>> MENUS = DeferredRegister.create(Registries.MENU, NekomasFixed.MOD_ID);

    public static final DeferredHolder<MenuType<?>, MenuType<KilnMenu>> KILN = MENUS.register("kiln",
            () -> new MenuType<>(KilnMenu::new, FeatureFlags.DEFAULT_FLAGS));

    private ModMenus() {
    }
}
