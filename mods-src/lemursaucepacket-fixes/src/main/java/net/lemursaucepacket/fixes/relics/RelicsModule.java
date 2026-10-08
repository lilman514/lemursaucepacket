package net.lemursaucepacket.fixes.relics;

import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModList;

/** Relics of the pack's own for the Relics mod (the Climbing Boots), when Relics is installed. */
public final class RelicsModule {
    public static void init(IEventBus modBus) {
        if (ModList.get().isLoaded("relics")) PackRelics.init(modBus);
    }

    private RelicsModule() {
    }
}
