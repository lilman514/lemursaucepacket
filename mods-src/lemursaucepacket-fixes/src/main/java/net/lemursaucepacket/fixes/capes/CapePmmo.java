package net.lemursaucepacket.fixes.capes;

import harmonised.pmmo.api.APIUtils;
import harmonised.pmmo.api.events.XpEvent;
import net.minecraft.world.entity.player.Player;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.common.NeoForge;

/** Project MMO for the capes: skill levels for unlocks, and the perks that add XP. Only touched when the mod is installed. */
final class CapePmmo {
    private static final boolean LOADED = ModList.get().isLoaded("pmmo");

    static void init() {
        // Enchanting Cape: a fifth more Enchanting XP. The event comes before the XP is applied, and the amount is a field.
        NeoForge.EVENT_BUS.addListener((XpEvent e) -> {
            if (!"enchanting".equals(e.skill) || e.getEntity() == null) return;
            CapeDefs.Def def = Capes.worn(e.getEntity());
            if (def != null && "enchant_xp".equals(Capes.special(def))) e.amountAwarded = Math.round(e.amountAwarded * 1.2);
        });
    }

    static long level(Player p, String skill) {
        return LOADED ? APIUtils.getLevel(skill, p) : 0;
    }

    static void addXp(Player p, String skill, long xp) {
        if (LOADED) APIUtils.addXp(skill, p, xp);
    }

    private CapePmmo() {
    }
}
