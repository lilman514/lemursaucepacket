package net.lemursaucepacket.fixes.skills;

import net.minecraft.world.entity.player.Player;
import net.neoforged.fml.ModList;

/**
 * Skill levels for the gates: Project MMO's (on the client, the player's own as Project MMO syncs them), and the combat
 * level, worked out as RuneScape does from the combat skills (no Prayer or Magic here, so it tops out at 113).
 */
public final class Levels {
    private static final boolean PMMO = ModList.get().isLoaded("pmmo");

    /** A skill's level; "combat" is the combat level, and "a|b" the better of a and b. */
    public static int of(Player player, String skill) {
        if (skill.contains("|")) {
            int best = 0;
            for (String s : skill.split("\\|")) best = Math.max(best, of(player, s));
            return best;
        }
        if (skill.equals("combat")) return combat(player);
        if (!PMMO) return 0;
        try {
            return (int) harmonised.pmmo.api.APIUtils.getLevel(skill, player);
        } catch (RuntimeException | NoClassDefFoundError e) {
            return 0;
        }
    }

    /**
     * RuneScape's combat level: a quarter of Defence plus Hitpoints, plus 0.325 of the better of Attack plus Strength or
     * one and a half times Ranged.
     */
    public static int combat(Player player) {
        double base = 0.25 * (of(player, "defence") + of(player, "hitpoints"));
        double melee = 0.325 * (of(player, "attack") + of(player, "strength"));
        double ranged = 0.325 * Math.floor(of(player, "ranged") * 1.5);
        return Math.max(1, (int) Math.floor(base + Math.max(melee, ranged)));
    }

    /** Project MMO's requirement to break the block at a position (the pack's chop levels on logs): skill → level. */
    public static java.util.Map<String, Integer> toBreak(net.minecraft.world.level.Level level, net.minecraft.core.BlockPos pos) {
        if (!PMMO) return java.util.Map.of();
        try {
            java.util.Map<String, Long> req = harmonised.pmmo.api.APIUtils.getRequirementMap(pos, level, harmonised.pmmo.api.enums.ReqType.BREAK);
            if (req == null || req.isEmpty()) return java.util.Map.of();
            java.util.Map<String, Integer> out = new java.util.HashMap<>();
            req.forEach((skill, lv) -> {
                if (lv != null && lv > 0) out.put(skill, (int) Math.min(Integer.MAX_VALUE, lv));
            });
            return out;
        } catch (RuntimeException | NoClassDefFoundError e) {
            return java.util.Map.of();
        }
    }

    /** Project MMO XP, for what lsp_fixes awards itself (Brewing). */
    public static void addXp(Player player, String skill, long xp) {
        if (!PMMO || xp <= 0) return;
        try {
            harmonised.pmmo.api.APIUtils.addXp(skill, player, xp);
        } catch (RuntimeException | NoClassDefFoundError e) {
            SkillsModule.LOGGER.warn("Couldn't add {} {} XP: {}", xp, skill, e.toString());
        }
    }

    /** "Crafting", "Combat level", "Attack or Ranged". */
    public static String name(String skill) {
        if (skill.equals("combat")) return "Combat level";
        StringBuilder out = new StringBuilder();
        for (String s : skill.split("\\|")) {
            if (out.length() > 0) out.append(" or ");
            out.append(Character.toUpperCase(s.charAt(0))).append(s.substring(1));
        }
        return out.toString();
    }

    private Levels() {
    }
}
