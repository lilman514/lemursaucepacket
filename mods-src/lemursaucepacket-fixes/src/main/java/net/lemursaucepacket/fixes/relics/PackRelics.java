package net.lemursaucepacket.fixes.relics;

import net.lemursaucepacket.fixes.LspFixes;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

/**
 * The relics the pack makes. Loaded only when Relics is installed ({@link RelicsModule}): these classes extend Relics'
 * own. Relics lists them in its creative tab itself (every Relics item adds itself), and the Curios feet tag in this
 * jar's data lets them into Relics' feet slot.
 */
final class PackRelics {
    private static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(LspFixes.MOD_ID);

    static final DeferredItem<ClimbingBootsItem> CLIMBING_BOOTS = ITEMS.register("climbing_boots", ClimbingBootsItem::new);

    static void init(IEventBus modBus) {
        ITEMS.register(modBus);
    }

    private PackRelics() {
    }
}
