package net.lemursaucepacket.fixes.lifesteal;

import net.neoforged.neoforge.common.ModConfigSpec;

/**
 * config/lsp_fixes-common.toml: the switches for the destructive parts. The numbers of the hearts system
 * themselves (starting hearts, cooldowns) are KubeJS's, in config/lemursaucepacket/lifesteal.json.
 */
public final class LifestealConfig {
    public static final ModConfigSpec SPEC;
    public static final ModConfigSpec.BooleanValue GRAVES_REQUIRE_ESSENCE;
    public static final ModConfigSpec.BooleanValue ELIMINATION_ENABLED;
    public static final ModConfigSpec.BooleanValue ELIMINATION_DRY_RUN;
    public static final ModConfigSpec.IntValue ERASE_CHUNKS_PER_TICK;
    public static final ModConfigSpec.IntValue ERASE_LOADS_PER_SECOND;
    public static final ModConfigSpec.BooleanValue PURGE_ENABLED;
    public static final ModConfigSpec.BooleanValue OWNER_TOOLTIP;
    public static final ModConfigSpec.BooleanValue COMPASS_ENABLED;
    public static final ModConfigSpec.IntValue INDEX_CHUNKS_PER_TICK;

    static {
        ModConfigSpec.Builder b = new ModConfigSpec.Builder();
        b.comment("Hearts, graves and elimination: the Java half. Numbers live in config/lemursaucepacket/lifesteal.json.").push("graves");
        GRAVES_REQUIRE_ESSENCE = b.comment("A grave is only placed when the dead player carried a Grave Essence (one is used up). Off: graves as the Gravestone mod ships them.")
                .define("requireEssence", true);
        b.pop();
        b.push("elimination");
        ELIMINATION_ENABLED = b.comment("A player at zero hearts stays on the death screen until revived or until they confirm elimination, which erases their placed blocks and owned items.",
                "Off: nobody is ever erased; a player at zero hearts respawns with one heart instead (logged).").define("enabled", true);
        ELIMINATION_DRY_RUN = b.comment("Dry run: an elimination still restarts the player and writes the archive of what WOULD be removed, but removes nothing.").define("dryRun", false);
        ERASE_CHUNKS_PER_TICK = b.comment("Already-loaded chunks an erasure processes per tick.").defineInRange("chunksPerTick", 2, 1, 32);
        ERASE_LOADS_PER_SECOND = b.comment("Unloaded chunks an erasure loads per second to clean them (each load is synchronous).").defineInRange("chunkLoadsPerSecond", 4, 1, 40);
        b.pop();
        b.push("ownership");
        PURGE_ENABLED = b.comment("Items owned by an erased life are deleted whenever they are seen (inventories, containers, chunks that load, dropped items). Off: the erasure of items stops; blocks are still removed.").define("purgeErased", true);
        OWNER_TOOLTIP = b.comment("Show \"Belongs to <name>\" in item tooltips when advanced tooltips (F3+H) are on.").define("tooltip", true);
        b.pop();
        b.push("compass");
        COMPASS_ENABLED = b.comment("The Lost Item Compass and Seeker's Compass GUI and needle.").define("enabled", true);
        INDEX_CHUNKS_PER_TICK = b.comment("Loaded chunks whose containers are re-scanned per tick for the Seeker's Compass index.").defineInRange("indexChunksPerTick", 4, 1, 64);
        b.pop();
        SPEC = b.build();
    }

    private LifestealConfig() {
    }
}
