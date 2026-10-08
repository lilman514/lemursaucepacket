package net.lemursaucepacket.fixes.xpbank;

import net.lemursaucepacket.fixes.LspFixes;
import net.minecraft.client.renderer.item.ClampedItemPropertyFunction;
import net.minecraft.client.renderer.item.ItemProperties;
import net.minecraft.resources.ResourceLocation;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.event.lifecycle.FMLClientSetupEvent;

/**
 * The bank's item looks like the bank it places: lsp_fixes:tier is 0, 0.5 or 1 for tiers I to III and lsp_fixes:full is
 * 1 while it holds XP (models/item/xp_bank.json picks the model).
 */
final class XpBankClient {
    private XpBankClient() {
    }

    static void init(IEventBus modBus) {
        modBus.addListener((FMLClientSetupEvent e) -> e.enqueueWork(() -> {
            ItemProperties.register(XpBankModule.XP_BANK_ITEM.get(), ResourceLocation.fromNamespaceAndPath(LspFixes.MOD_ID, "tier"),
                    (ClampedItemPropertyFunction) (stack, level, entity, seed) -> (XpBankItem.tierOf(stack) - 1) / 2f);
            ItemProperties.register(XpBankModule.XP_BANK_ITEM.get(), ResourceLocation.fromNamespaceAndPath(LspFixes.MOD_ID, "full"),
                    (ClampedItemPropertyFunction) (stack, level, entity, seed) -> XpBankItem.holdsXp(stack) ? 1f : 0f);
        }));
    }
}
