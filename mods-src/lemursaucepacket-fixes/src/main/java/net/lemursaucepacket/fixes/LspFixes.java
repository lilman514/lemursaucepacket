package net.lemursaucepacket.fixes;

import net.lemursaucepacket.fixes.lifesteal.LifestealModule;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;

/**
 * LemurSaucePacket Fixes: the pack's own mod for what needs Java rather than KubeJS.
 *
 * <p>The Project MMO skills-panel fixes are mixins only (see {@code lsp_fixes.mixins.json}; mixins live in
 * {@code net.lemursaucepacket.fixes.mixin.<modid>} and only apply when that mod is installed,
 * {@link LspFixesMixinPlugin}; client-only ones go in the config's "client" list). The hearts, graves and
 * elimination system's Java half is {@link LifestealModule}. This class must stay safe to load on a
 * dedicated server.
 */
@Mod(LspFixes.MOD_ID)
public final class LspFixes {
    public static final String MOD_ID = "lsp_fixes";

    public LspFixes(IEventBus modBus, ModContainer container) {
        LifestealModule.init(modBus, container);
    }
}
