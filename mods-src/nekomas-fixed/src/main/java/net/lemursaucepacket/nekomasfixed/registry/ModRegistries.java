package net.lemursaucepacket.nekomasfixed.registry;

import net.neoforged.bus.api.IEventBus;

/** Hooks every deferred register of the mod onto the mod event bus. */
public final class ModRegistries {
    public static void register(IEventBus modBus) {
        ModBlocks.BLOCKS.register(modBus);
        ModItems.ITEMS.register(modBus);
        ModBlockEntities.BLOCK_ENTITIES.register(modBus);
        ModMenus.MENUS.register(modBus);
        ModRecipes.TYPES.register(modBus);
        ModRecipes.SERIALIZERS.register(modBus);
        ModComponents.COMPONENTS.register(modBus);
        ModCreativeTab.TABS.register(modBus);
    }

    private ModRegistries() {
    }
}
