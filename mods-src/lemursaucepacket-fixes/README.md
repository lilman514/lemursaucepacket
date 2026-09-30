# LemurSaucePacket Fixes (`lsp_fixes`)

The pack's own NeoForge mod (Minecraft 1.21.1, NeoForge 21.1.252) for what needs Java rather than KubeJS. It is one small jar in `pack/mods/`, installed on clients and the server. The mixins only apply when the mod they patch is installed.

## Hearts, graves and elimination (the Java half)

The system is described for players in `docs/lifesteal.md`; the hearts themselves (death drops a Heart, right-click uses one, ownership stamps, `/hearts`, `/revive`) are KubeJS, in `pack/kubejs/server_scripts/lifesteal.js`. This mod adds what scripts can't (`net.lemursaucepacket.fixes.lifesteal`):

- **Graves cost a Grave Essence.** `mixin/gravestone/DeathEventsMixin` returns from the Gravestone mod's grave handler before it places anything when `GraveEssence.allowGrave` finds no essence in the death's items (inventory, armour, off-hand, Curios, and inside carried backpacks); the drops then fall as in vanilla. One essence is used up otherwise.
- **Limbo.** A player the scripts marked `lsp_eliminated` stays dead: `mixin/RespawnGateMixin` drops their respawn packet (`Limbo`). The client (`client/EliminationScreens`) turns the death screen's Respawn button into a three-step confirmation; the nonce comes back in `ConfirmElimination` and `Limbo.accept` erases the life and respawns the player with the same state keys the scripts use (`KubeData`, read through KubeJS's `kjs$getPersistentData` by reflection, no compile dependency).
- **Erasure.** `PlacedBlocks` records who placed which block in a data attachment on the chunk (owner table plus position map, forgotten on break, explosion or piston push); `LifestealState` keeps which chunks each player touched. `EraseJob` visits those chunks (loaded ones first, then a few loads per second), removes the life's blocks, empties its containers (its own items deleted, others' dropped) and resumes after a restart. Items are not hunted: the life is marked erased and `Purge` deletes its items wherever they are next seen (inventories on login and every 5 s, any container menu on open, block entities and entities when a chunk loads, dropped items when they appear; shulker boxes, bundles, Create packages and backpacks inside).
- **Archive.** Everything removed is written first to `<world>/lsp_fixes/archive/<name>_life<N>_<time>.nbt` (`Archive`); `/lsp archive list`, `/lsp restore blocks <file>` (only into empty spots) and `/lsp restore items <file>` (to the admin, with the dead stamp removed) put it back. Items deleted after a job finished go to a `late_purges` file.
- **Compasses.** `compass/LostItemIndex` (owned items on the ground, world-wide, saved data) and `compass/ContainerIndex` (owned items in containers as last seen at chunk load/unload, container close and a slow rolling scan; offline pockets at logout). `compass/CompassServer` opens the list on right-click, binds the compass (custom data + the vanilla lodestone tracker), and streams the live position once a second to the client's needle cache so the held item never re-equips. `client/CompassScreen` is the GUI, `client/LifestealClient` registers the `angle` model property for the two KubeJS items.
- **Config** `config/lsp_fixes-common.toml`: `graves.requireEssence`, `elimination.enabled` (off: zero hearts respawn with one heart), `elimination.dryRun` (archive only, remove nothing), throttles, `ownership.purgeErased`, `ownership.tooltip`, `compass.enabled`. Runtime kill switch: `/lsp elimination pause|resume`. Admin: `/lsp erase preview <player>`, `/lsp elimination list|force`, `/lsp purge sweep`.

Compile-only dependencies from Modrinth's Maven (never bundled): GraveStone Mod, Sophisticated Backpacks + Core, Curios, Project MMO.

## HUD layout editor (client)

`net.lemursaucepacket.fixes.hud`. The ESC menu's *HUD Layout* button (FancyMenu `opengui;net.lemursaucepacket.fixes.hud.HudLayoutScreen`, written by `art/hub.mjs`), `/hudlayout` and the unbound *Edit HUD layout* key open `HudLayoutScreen`: one draggable box per HUD part over the live game. Save writes each part into its own mod's config (`HudElements`, one class per part; the table is in PACK_DESIGN.md, *HUD layout editor*). The mods are reached by reflection, so there is no compile dependency; a part whose mod is missing or renamed something is logged and left out.

Our own `config/lsp_fixes-client.toml` holds the two vanilla parts this mod moves (status effects, boss bars: a translate around their NeoForge GUI layers) and a copy of the Project MMO positions, written back on join if a pack update replaced `pmmo-client.toml`.

After updating Xaero's Minimap, Jade, Simple Voice Chat, Create, Project MMO or FTB Quests: open the editor and check the log for "HUD layout: leaving out"; the names each part uses are in `HudElements`.

## What it fixes (Project MMO)

Project MMO 2.10.47, inventory skills panel:

- **The mouse wheel did nothing or crawled.** PMMO's list (`DetailScroll`) derives its step from the list length in integer maths, `min(50, maxScroll / 100)`. That's 0 for short lists (for example a maximised 3440x1440 window at GUI scale 4) and 1–2 units otherwise. Now one wheel notch or arrow key moves the list by one skill row (24 px).
- **The end of the list was slightly cut off.** The limit rounded down and ignored the scroll box's 1 px clip. Now the last row ends fully in view.
- **The panel covered the inventory on small screens.** The panel is 130 px wide and sits at the left edge. The survival inventory starts at 125 px on the smallest 16:9 GUI (427x240, e.g. 1280x720 at scale 3) and at 72 px on 4:3. When the panel would overlap the inventory or an open recipe book, it now starts collapsed to its edge tab. Click the tab to open it.

`DetailScroll` moves its rows 2 px per unit of scroll: once through its own layout and once through vanilla's scroll translation. The limits in `SkillsPanelFixes` use those units, the same way PMMO's own `/ 2` does.

## Build

You need a JDK 17 or newer to run Gradle. Gradle finds an installed Java 21 for compiling, or downloads one. The first build downloads Minecraft and NeoForge, which takes a few minutes.

```bash
./gradlew build          # Windows: gradlew.bat build  ->  build/libs/lsp_fixes-<version>.jar
./gradlew copyToPack     # replaces pack/mods/lsp_fixes-*.jar with the new jar
```

Then publish as usual (`node publish/publish.mjs`, or push). packwiz picks the jar up as a plain file and exports it as a shared override, so the launcher installs it on both clients and the server. Bump `mod_version` in `gradle.properties` when you change the mod.

`./gradlew runClient` starts a dev game with this mod and Project MMO.

Project MMO is a compile-only dependency from Modrinth's Maven, the same file as `pack/mods/project-mmo.pw.toml`. It is never bundled.

## Adding a fix

1. Put the mixin in `src/main/java/net/lemursaucepacket/fixes/mixin/<modid>/`. The package name is the rule: the mixin only applies when `<modid>` is installed (`LspFixesMixinPlugin`).
2. List it in `src/main/resources/lsp_fixes.mixins.json`, under `client` if it touches client-only classes (screens, rendering), otherwise under `mixins`. The mod also runs on the dedicated server.
3. Add the target mod as `compileOnly "maven.modrinth:<project id>:<version id>"` (the ids are in its `.pw.toml`).

NeoForge 1.21.1 runs with Mojang names, so no refmap is needed.

## When Project MMO updates

The mixins replace `DetailScroll.getMaxScrollAmount()` and `scrollRate()`, and change the `open` argument that `SkillsSidePanel`'s constructor passes to `CollapsingPanel`. The mixin config is not `required`: if PMMO renames these, the fix switches itself off (Mixin logs a warning) instead of crashing. After updating PMMO:

- update `pmmo_modrinth_version`;
- check that the panel still scrolls one row per notch and reaches its last row;
- check that `DetailScroll.renderContents()` still sets `padding top = -scrollAmount`. If PMMO stops doing that, set `PIXELS_PER_SCROLL_UNIT` to 1.
