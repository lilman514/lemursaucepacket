package net.lemursaucepacket.fixes;

import net.lemursaucepacket.fixes.capes.CapesModule;
import net.lemursaucepacket.fixes.economy.EconomyModule;
import net.lemursaucepacket.fixes.lifesteal.LifestealModule;
import net.lemursaucepacket.fixes.pits.PitsModule;
import net.lemursaucepacket.fixes.quests.QuestModule;
import net.lemursaucepacket.fixes.skills.SkillsModule;
import net.lemursaucepacket.fixes.hub.HubModule;
import net.lemursaucepacket.fixes.towns.TownModule;
import net.lemursaucepacket.fixes.zone.SafeZoneModule;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.loading.FMLEnvironment;

/**
 * LemurSaucePacket Fixes: the pack's own mod for what needs Java rather than KubeJS.
 *
 * <p>The Project MMO skills-panel fixes are mixins only (see {@code lsp_fixes.mixins.json}; mixins live in
 * {@code net.lemursaucepacket.fixes.mixin.<modid>} and only apply when that mod is installed,
 * {@link LspFixesMixinPlugin}; client-only ones go in the config's "client" list). The hearts, graves and
 * elimination system's Java half is {@link LifestealModule}; safe zones are {@link SafeZoneModule} and the spawn city that uses one is {@link HubModule}; Gold Coins, vendors' shops and player trading are {@link EconomyModule}; RuneScape-style quest steps, Crandor and Elvarg are {@link QuestModule}; the Kilnfolk, Kiln Hollow and the Fight Pits' and the Inferno's bosses are {@link PitsModule}; capes, worn in their own Curios slot, are {@link CapesModule}; the RuneScape-style skill gates (making, brewing, drops, the combat level) are {@link SkillsModule}. The HUD layout editor (client only) is
 * {@code hud.HudLayoutClient}. This class must stay safe to load on a dedicated server.
 */
@Mod(LspFixes.MOD_ID)
public final class LspFixes {
    public static final String MOD_ID = "lsp_fixes";

    public LspFixes(IEventBus modBus, ModContainer container) {
        LifestealModule.init(modBus, container);
        SafeZoneModule.init();
        HubModule.init();
        TownModule.init();
        EconomyModule.init(modBus);
        QuestModule.init();
        PitsModule.init();
        CapesModule.init(modBus);
        SkillsModule.init(modBus);
        if (FMLEnvironment.dist.isClient()) net.lemursaucepacket.fixes.hud.HudLayoutClient.init(modBus, container);
    }
}
