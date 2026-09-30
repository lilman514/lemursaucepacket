package net.lemursaucepacket.fixes.hud;

import net.neoforged.neoforge.common.ModConfigSpec;

/**
 * {@code config/lsp_fixes-client.toml}: where the HUD layout editor keeps what has no config of its own.
 * The pack never ships this file, so the launcher never overwrites it.
 *
 * <p>The vanilla parts (status effects, boss bar) are moved by this mod, so their positions live here. The
 * {@code remember} section is a copy of positions saved into configs the pack does ship (Project MMO's
 * {@code pmmo-client.toml}): when a pack update replaces that file, the copy is written back on the next join.
 */
public final class HudConfig {
    public static final ModConfigSpec SPEC;
    /** Status effect icons. x >= 0: left edge at x. x < 0: right edge at (screen width + x + 1), so -1 is vanilla. */
    public static final ModConfigSpec.IntValue EFFECTS_X;
    /** Status effect icons: pixels down from vanilla's row (0 = vanilla). */
    public static final ModConfigSpec.IntValue EFFECTS_Y;
    /** Boss bars: pixels right of vanilla's centred position. */
    public static final ModConfigSpec.IntValue BOSS_BAR_X;
    /** Boss bars: pixels down from vanilla's position. */
    public static final ModConfigSpec.IntValue BOSS_BAR_Y;
    public static final ModConfigSpec.DoubleValue PMMO_GAIN_X;
    public static final ModConfigSpec.DoubleValue PMMO_GAIN_Y;
    public static final ModConfigSpec.DoubleValue PMMO_SKILLS_X;
    public static final ModConfigSpec.DoubleValue PMMO_SKILLS_Y;

    static {
        ModConfigSpec.Builder b = new ModConfigSpec.Builder();
        b.comment("HUD layout (Esc > HUD Layout, /hudlayout). Positions in GUI pixels.").push("hud");
        b.comment("Vanilla parts this mod moves.").push("vanilla");
        EFFECTS_X = b.comment("Status effect icons, horizontal. 0 or more: left edge that many pixels from the left.",
                "Negative: anchored right, -1 is vanilla's place, -11 is 10 pixels further left.").defineInRange("effectsX", -1, -10000, 10000);
        EFFECTS_Y = b.comment("Status effect icons, pixels down from vanilla's place.").defineInRange("effectsY", 0, -10000, 10000);
        BOSS_BAR_X = b.comment("Boss bars, pixels right of the centre (negative: left).").defineInRange("bossBarX", 0, -10000, 10000);
        BOSS_BAR_Y = b.comment("Boss bars, pixels down from vanilla's place.").defineInRange("bossBarY", 0, -10000, 10000);
        b.pop();
        b.comment("Copies of positions saved into Project MMO's pmmo-client.toml, which the pack ships. If a pack update",
                "replaces that file, these are written back when you join a world. -1 means the editor never moved it.").push("remember");
        PMMO_GAIN_X = b.defineInRange("pmmoGainListX", -1.0, -1.0, 1.0);
        PMMO_GAIN_Y = b.defineInRange("pmmoGainListY", -1.0, -1.0, 1.0);
        PMMO_SKILLS_X = b.defineInRange("pmmoSkillListX", -1.0, -1.0, 1.0);
        PMMO_SKILLS_Y = b.defineInRange("pmmoSkillListY", -1.0, -1.0, 1.0);
        b.pop();
        b.pop();
        SPEC = b.build();
    }

    private HudConfig() {
    }
}
