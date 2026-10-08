# Porting plan: Nekoma's Fixed → LemurSaucePacket (NeoForge 21.1.252, Minecraft 1.21.1)

This is a plan only, written 2026-10-08. Nothing under `C:\Create+Modpack` was changed.

**Sources read:**
- **Upstream repo (`GreenJAB/nekomas-fixed`):**
  - `main` @83d3a8e (0.5.4, MC 26.3)
  - branch `1.21.11` @df36f47 (0.5.2/0.5.3)
  - branch `1.21.1` @16878fc (an unreleased Fabric 1.21.1 backport)
  - the mod's own wiki export (0.5.3, `nekoma-wiki.txt`)
  - its Modrinth version history
- **Our pack:**
  - `pack/mods/*.pw.toml`
  - the jars in `C:\LemurSaucePacket-Server\mods` and the player instance
  - `PACK_DESIGN.md`, `quests/book.mjs`, `skills/`, `gear/`
- **NeoForge 21.1.252 + MC 1.21.1:** the sources and resources from `mods-src/lemursaucepacket-fixes/build/moddev`.

---

## 1. Overview

### 1.1 What the mod is
Nekoma's Fixed (MIT, Modrinth `nekomas-fixed`, about 33.6k downloads) builds the ideas from YouTuber Nekoma's videos as a vanilla-style content mod. It has about 60 features:
- blocks: clams, nautilus "pet carrier", placeable clocks, edible melons, cakes, five new cauldrons, kiln, pyrotechnics table
- a colour suite: 4 dyes and about 240 coloured blocks
- weapons: slingshot, sickles, wildfire shield and trident
- mobs: moobloom, suspicious spider, three zombie/skeleton variants, termites, a target dummy, the Wildfire boss
- worldgen: baobab trees, termite mounds, clams, geysers, ghost peppers, ocean pillager patrols, a fortress boss room, village houses
- about 20 vanilla mechanic tweaks

It ships for Fabric only:

| Minecraft | Mod versions |
|---|---|
| 1.21.10 | 0.2.x |
| 1.21.11 | 0.3 – 0.5.3 |
| 26.1.2 / 26.2 / 26.3 | 0.5.1 – 0.5.4 |

Size of main (0.5.4):

| What | Count |
|---|---|
| Java | 341 files / 25.6k lines |
| Mixins | 94 (67 common, 27 client) |
| Textures | 722 |
| Block models | 808 |
| Blockstates | 323 |
| Item model definitions | 426 |
| Recipes | 640 |
| Loot tables | 280 |
| English lang keys | 503 (13 languages) |
| Structure NBTs | 5 |
| Sounds | none |

### 1.2 Which code to port from (surprise: there is a 1.21.1 branch)

| Source | Version | MC | Names | Use it for |
|---|---|---|---|---|
| branch **`1.21.1`** (2026-08-21 → 2026-09-29, by Strikey5852) | 0.5.2-1.21.1, unreleased | **1.21.1** (Fabric) | **Mojang + Parchment 2024.11.17, the same as lsp_fixes** | The main base. About a third of the features are already ported (each row in §2–§4 says how far it got), and all its JSON is in 1.21.1 format (398 generated recipes). Its Fabric API use is thin (registration, client hooks, datagen), so on NeoForge only registration and hooks change. Mixins carry over with the same names. |
| branch `1.21.11` | 0.5.2 / 0.5.3 | 1.21.11 (closest to the 1.21.10 builds; there is no 1.21.10 branch) | Yarn | Its JSON is already in the 1.21.x layout: `configured_feature`, loot `functions`, the compilable termite mound, fallen trees, mob loot tables. |
| `main` | 0.5.4 | 26.3 | Mojang (26.x is unobfuscated) | The newest numbers and fixes. Also the 0.5.4-only features: flower crowns, ghost pepper, corrupted beacon, ocelot allies, stripped hollow logs, spotted slabs/stairs. |

**Port order for each feature:** the 1.21.1 branch first, then the 1.21.11 JSON, then main.

**Bugs in the 1.21.1 branch to fix while porting:**
- **Clams:** worldgen and the first loot roll crash (fishing loot is built without `TOOL`), and a leftover sand is duplicated.
- **Sickles:** they never lose durability, and they can't take Fire Aspect, Looting, Knockback or Leeching.
- **Trade tag:** it writes `#minecraft:tradable`; the 1.21.1 tag is `tradeable`.
- **Blocks:**
  - Terracotta and concrete have no mineable tags, so they drop nothing.
  - Carpets aren't `WoolCarpetBlock`.
  - New beds have a 0.75 jump factor.
  - New candles on a cake throw an NPE.
  - Recolouring a shulker box wipes its contents.
  - Vanilla recipes are disabled with `minecraft:air` results, which fail to parse.
  - A clock with a bell loses the bell when broken.
- **Target dummy:** it calls `EntityDataSerializers.registerSerializer`, which throws on NeoForge.

**The 1.21.1 branch also merges a different mod.** Ectoluminescence (Technicman69, MIT) is a sister mod, not part of Nekoma's Fixed (§5).

### 1.3 How to build it
- **A new jar `lsp_nekoma` in `mods-src/lsp-nekoma/`.** Build it exactly like lsp_fixes: ModDevGradle 2.0.147, NeoForge 21.1.252, Parchment 2024.11.17, Java 21, installed on clients and the server. It will have about 1,000 registry entries and about 2,000 asset and data files, too much for lsp_fixes. A separate jar also keeps the MIT notice in one place and can be switched off as a unit.
- **Our own namespace `lsp_nekoma`.** Rename `nekomasfixed:` everywhere (JSON, lang keys, asset paths) with a script. Main registers several things in the **`minecraft` namespace**: six data components (`stored_time`, `clam_state`, `animal`, `termites`, `combo_multiplier`, `cushion_mod_color`), the `number` particle, both creative tabs, and `minecraft:clock`/`wall_clock`. It also replaces `minecraft:melon` and the `minecraft:clock` item. Register all of these under our namespace instead.
- **Registration:** DeferredRegister for every registry:
  - blocks, items, block entities, entities, menus
  - recipe types and serializers, mob effects, potions, particles, data components
  - trunk placers, tree decorators, features, sensor types
  - POI types, professions, loot functions, creative tabs
  - entity data serializers, via `NeoForgeRegistries.Keys.ENTITY_DATA_SERIALIZERS`
- **Events before mixins.** Several pack mods mix into the same vanilla methods (§1.6.2). Use a NeoForge event wherever one exists. Keep mixins only where there is no hook; they carry over 1:1 from the 1.21.1 branch, and MixinExtras ships with NeoForge.
- **`META-INF/accesstransformer.cfg`:** carry over the access-widener entries that still apply, for example:
  - `Bee#setHasNectar`
  - `Ocelot#isTrusting` / `setTrusting`
  - `LivingEntity#attackStrengthTicker` / `detectEquipmentUpdates`
  - `ObserverBlock#startSignal`
  - `BrewingStandBlockEntity#items`
- **`enumextensions.json`:**
  - `Boat.Type`: baobab, plus pale oak for Big/Huge boats.
  - `HumanoidModel.ArmPose`: the slingshot pose.
  - Optional: `RecipeBookType` and `RecipeBookCategories` for a kiln recipe book.
- **Config:** a `ModConfigSpec` (common/server) instead of the Cloth Config screen, which upstream never saves. Settings:
  - nether food rot
  - fox tool use
  - patrols on/off
  - spawn weights
  - horn glow radius
  - (optional) copper lightning buff
- **Data:**
  - **Copy the 1.21.1-branch JSON** where it exists.
  - **Convert the rest** with a small 26.x → 1.21.1 converter:

    | Data | 26.x (main) | 1.21.1 |
    |---|---|---|
    | Loot modifiers | `"modifier"` | `"functions"` |
    | Loot condition | single `"condition"` | `"conditions"` array |
    | Block match | `match_block` | `block_state_property` |
    | Recipe ingredients | plain strings | `{"item"}` / `{"tag"}` |
    | Advancement trigger | `recipe_unlocked.recipes` | `recipe` |
    | Worldgen folder | `worldgen/feature` | `worldgen/configured_feature`, with the `config` wrapper and `simple_state_provider` |
    | Item models | `assets/*/items/*.json` definitions | `models/item` + `overrides` |
    | Armour | `equipment/*.json` | `ArmorMaterial` + `textures/models/armor` |

  - **Disabling vanilla recipes:** use `"neoforge:conditions":[{"type":"neoforge:false"}]`, not barrier or air results.
  - **Mob spawns and features:** `data/lsp_nekoma/neoforge/biome_modifier/*.json`.
  - **Loot additions:** global loot modifiers (`neoforge:add_table`) or `LootTableLoadEvent`.
  - **Pool additions:** Lithostitched `add_template_pool_elements` modifiers (`data/lsp_nekoma/lithostitched/worldgen_modifier/`; Lithostitched 1.8.0 is in the pack). Never overwrite vanilla pool files.
- **Client:**
  - Renderers and models use 1.21.1's `setupAnim(entity, …)`, with no render states. Register them with `EntityRenderersEvent`.
  - Item renderers (BEWLR) go through `IClientItemExtensions` via `RegisterClientExtensionsEvent`: wildfire shield and trident, new beds and shulkers.
  - Other client hooks:
    - `ItemProperties` in `FMLClientSetupEvent`
    - `RegisterClientTooltipComponentFactoriesEvent`
    - `RegisterParticleProvidersEvent`
    - `RegisterColorHandlersEvent`
    - `RegisterMenuScreensEvent`
    - `render_type` in models
- **Optional dependencies, compile-only:**
  - Vanilla Backport (§1.5), `ordering = "AFTER"` so our data sits above its files.
  - JEI, for kiln, soup and pyrotechnics categories and info pages.

### 1.4 Stages and effort

| Stage | Features | S (≤1 day) | M (a few days) | L (a week+) | Rough total* |
|---|---|---|---|---|---|
| 1. Blocks, items, tweaks | 38 | 23 | 14 | 1 | 45–90 working days |
| 2. Mobs and entities | 8 | 5 | 2 | 1 | 12–23 working days |
| 3. Worldgen and Wildfire | 14 | 6 | 6 | 2 | 25–50 working days |
| **Total** | **60** | **34** | **22** | **4** | |

\*Assumes S = ½–1 day, M = 2–4 days, L = 5–10 days. Rows marked "S–M" are counted as M.

The 1.21.1 branch already covers roughly 40% of Stage 1, and its ratings already account for that. The real work is in:
- Stage 1: the pyrotechnist, the soup cauldron, kiln, nautilus block, messy beds, sickles and slingshot.
- Stage 2: the Big/Huge boats.
- Stage 3: patrols and the Wildfire's brain.

**Decisions the owner should make before Stage 2:**
- the duplicate mobs and the baobab wood (§1.6.1)
- where the Wildfire arena goes, given YUNG's fortresses (Stage 3, row 13)
- our namespace
- which global vanilla changes to keep (§1.6.3)
- whether to add the Vanilla Backport extras (harness and bundle colours)

### 1.5 What Vanilla Backport covers
Vanilla Backport 1.1.7.10 (`pack/mods/vanillabackport.pw.toml`) is in the pack with all six of its drops switched on in `config/vanillabackport-common.toml`:
- Bundles of Bravery
- The Garden Awakens
- Spring to Life
- Chase the Skies
- Hot as Lava
- Chaos Cubed

It registers everything under **vanilla ids (`minecraft:…`)**: 71 blocks, 44 further items and 5 entities (creaking, happy_ghast, pale_oak_boat, pale_oak_chest_boat, sulfur_cube). It also ships vanilla-format data under `data/minecraft`:
- recipes and loot
- tags `#minecraft:eggs`, `#minecraft:bundles`, `#minecraft:harnesses`, `#minecraft:pale_oak_logs`, `#c:eggs`, and resin in `#minecraft:trim_materials`
- the 1.21.5 `minecraft:fallen_tree` feature with its `fallen_*_tree` configured features

So the `minecraft:` ids in main's JSON resolve unchanged when Vanilla Backport is loaded.

**What that unlocks for the port:**

| Nekoma needs | Vanilla Backport has it? | Result |
|---|---|---|
| `minecraft:resin_clump` (slingshot ammo), `minecraft:resin_brick` (kiln recipe, crown trim material) | yes | portable |
| `minecraft:open_eyeblossom` / `closed_eyeblossom` (2 flower crowns, 1 moobloom variant) | yes | portable: 16 crowns, 15 variants. Upstream has no texture for the eyeblossom moobloom, so it needs new art. |
| `minecraft:pale_oak_log` / `planks` / `boat` (2 hollow logs, Big/Huge pale oak boats) | yes. Its boats are separate entity types, so our boats need our own pale-oak `Boat.Type` entry. | portable |
| fallen trees (`minecraft:fallen_{oak,birch,super_birch,jungle,spruce}_tree`) | yes, in 1.21.5 format | portable: override those 5 files with hollow-log trunks (`fallen_poplar` dropped) |
| blue/brown eggs, `#minecraft:eggs` (cake recipes) | yes (NeoForge also has `#c:eggs`) | portable |
| dyed bundles, `#minecraft:bundles` (4 new-dye bundles) | yes (`BundleColoring`, modern bundle renderer) | optional extra, S–M; needs Vanilla Backport's bundle models and conventions |
| harnesses, happy ghast, dried ghast, `#minecraft:harnesses` (4 new-dye harnesses) | yes (`HarnessItem`, `GhastHarnessHandler`) | optional extra, M. Check how its ghast layer picks the texture; if it's tied to `DyeColor`, our 4 need a small layer or mixin |
| leaf litter, wildflowers, firefly bush, cactus flower, bush, dry grass, pale garden, creaking, sulfur/cinnabar, sulfur cube, sulfur-spring geysers | yes | not used by Nekoma. The only overlap is the word "geyser" (Stage 3, row 8). The stray `sulfur_lantern` lang key in 5 of Nekoma's languages belongs to no block. |

**Not covered by Vanilla Backport, so these stay blocked:**
- spears (Lunge, spear components)
- copper golem, copper armour, tools, nuggets, torch and chain (1.21.9). Copper nuggets come from Create instead: `create:copper_nugget`, `#c:nuggets/copper`.
- shelves
- nautilus and zombie-nautilus mobs (Vanilla Backport only carries unused spawn-egg textures for them)
- cushions
- poplar
- wool and concrete slabs/stairs
- data-driven trades and the trial-spawner registry
- the 1.21.2+ data formats (item definitions, equipment assets, `crafting_transmute`)

**How to use it:**
- **Java:** there is no `Items.RESIN_CLUMP` in 1.21.1. Look items up by id (`BuiltInRegistries.ITEM.get(ResourceLocation.withDefaultNamespace("resin_clump"))`) lazily, or go through our own tags with `required: false` entries.
- **JSON:** reference the `minecraft:` ids directly and guard recipes and loot entries with `neoforge:mod_loaded vanillabackport`, so `lsp_nekoma` still loads without it.
- **Load order:** declare an optional dependency with `ordering = "AFTER"`, so our fallen-tree overrides sit above Vanilla Backport's (check with `/datapack list`).

### 1.6 Overlaps with the pack

#### 1.6.1 The same content from another mod (owner decisions)

| Nekoma feature | Already in the pack | Clash | Recommendation |
|---|---|---|---|
| Moobloom (14–15 flower variants) | Friends & Foes `friendsandfoes:moobloom` (buttercup; flower forest, cherry grove, meadow, sunflower plains). Quest "meet a moobloom" (`quests/book.mjs` ~4023). | Two "Moobloom" mobs in the same biomes | Port ours. Set F&F `enableMoobloomSpawn=false` (keep its entity registered so nothing breaks) and let the quest accept either. |
| Wildfire boss + crowns | F&F `friendsandfoes:wildfire` in its Nether **Citadel**, dropping wildfire crown fragments → Wildfire Crown. Quests "A Fortress? No, a Citadel" and "Wildfire" (~2105, ~4003); `skills/modded.mjs` gates the Wildfire Crown at Defence 45. Our own gear has the loot-only Ember Crown. | Two "Wildfire" bosses and three crown lines | **Keep F&F's** (quests and gates depend on it). Port ours as a separate fortress boss with a distinct in-game name (for example "Fortress Wildfire"). Our crowns are Iron/Golden/Diamond/Netherite Crown, so the names don't collide. |
| Rime (snowy zombie, slowness snowballs) | Variants & Ventures **Gelid** (frozen-biome zombie that throws snowballs) | Same niche | Port ours, but at a reduced weight. Nekoma adds its own spawn entry at weight 100, group 4 (vanilla zombies are 95), which roughly doubles zombie-type spawns there, while V&V already turns 80% of the vanilla zombies into gelids. Suggest 25–40. Keep V&V: quest ~3979 kills a gelid, murk and thicket. |
| Derelict (jungle zombie, poison cloud) | V&V **Thicket** (jungle zombie variant) | Same niche | As above. |
| Drenched (ocean skeleton) + Anchor | V&V **Murk** (skeleton in lukewarm and warm oceans) | Same niche in warm oceans | Port it (it covers all oceans and rivers and adds the Anchor); keep V&V. |
| Baobab wood set + hollow baobab tree | Regions Unexplored: full baobab wood set (log … boats), `baobab_savanna` with `mega_baobab`/`ultra_baobab` trees. `skills/modded.mjs` gates RU baobab logs at Woodcutting 40. Every Compat already makes RU-wood variants. | Two baobab wood sets ("Baobab Planks" twice in JEI; Every Compat would add about 90 more blocks for ours, as it does for each of RU's 18 woods) and two baobab tree styles | **Reuse RU's baobab blocks.** Build Nekoma's hollow tree from `regions_unexplored:baobab_log`/`leaves`; hang fruit and rope from RU's leaves through a tag; make the hollow baobab log from RU's log. Place the tree in vanilla and Terralith savannas, plus RU's steppe and dry_bushland, but not `baobab_savanna`. Skip our baobab boats, or build the Big/Huge baobab boats on RU's boat. (The alternative is porting Nekoma's own textures under a different name.) |
| Termite mounds | Naturalist ant hills (`#minecraft:is_jungle`, `#minecraft:is_savanna`) | Two insect mounds in savannas | Keep both. Mounds are rare (1 in 50 chunks). Ours also cover deserts. |
| Clam block (pearls) | Naturalist's **clam mob** (all oceans, clam meat) | Same English name | Rename ours "Pearl Clam" (display only). |
| Fortress boss room | **YUNG's Better Nether Fortresses** with "Disable Vanilla Nether Fortresses" = true | Vanilla `CastleEntrance` pieces never generate, so Nekoma's mixin never runs | Stage 3, row 13: our own arena structure, injected into YUNG's pools or placed as a standalone Nether structure. |
| Pyrotechnist village houses | **Luki's Grand Capitals** overrides all five vanilla village structures with its own start pool (`revampedvillages:start`). Towns and Towers villages use their own pools. | Vanilla house pools are unused in our worlds | Stage 3, row 11: inject into T&T's and vanilla's pools with Lithostitched, or place pyrotechnics tables in our towns. |
| Baobab rope | Farmer's Delight `farmersdelight:rope`, Create rope (pulley) | Name | Call ours "Baobab Rope". |
| Soup cauldron | Farmer's Delight cooking pot (+ Central Kitchen, Slice & Dice) | Similar purpose, different mechanic | Keep. Award Cooking XP. Special Stew is a new item, so no existing gate is bypassed. |
| Dyed bricks | Create Deco "Blue Bricks", "Red Bricks" (`createdeco:`) | Display names | Name ours "Dyed Blue Bricks", and so on. |
| Clock block | Create cuckoo clock | Concept only | Keep. |
| Goat-horn pet glow | Illager Invasion "Horn of Sight" | Concept only | Keep, with a radius (§1.6.3). |
| Nether geyser | Vanilla Backport sulfur-spring geysers (overworld) | Word only | Keep. |

#### 1.6.2 Mixin overlaps
These come from a scan of every mixin class in the 139 server jars and the 43 client-only jars that references a vanilla class Nekoma patches.

| Vanilla class Nekoma patches | Pack mods that also patch or reference it | Our approach |
|---|---|---|
| `PatrolSpawner` | Friends & Foes (2), Illager Invasion | Our own spawner via **`ModifyCustomSpawnersEvent`**; don't touch `PatrolSpawner` |
| `Raider`, `Pillager` | F&F, Easy NPC, Lithium | `EntityTickEvent`; a goal edit in `EntityJoinLevelEvent` |
| `Boat` | Lithium, Vanilla Backport (leash), Platform (renderer) | Big/Huge boats as our own subclasses; vanilla-boat mixins kept narrow (rotation and seat hooks only) |
| `HopperBlockEntity` | Lithium (4), Lootr | No mixin: our boat implements `Container` with chest-gated `canPlaceItem`/`canTakeItem` |
| `FarmBlock` | Farmer's Delight (rich soil), Create Connected, Subtle Effects | `BlockEvent.FarmlandTrampleEvent` |
| `Fox` | Naturalist, Easy NPC | `EntityTickEvent.Post` |
| `Sheep`, `EatBlockGoal` | Vanilla Backport (SheepMixin, SheepRendererMixin), Subtle Effects; Regions Unexplored and Sable (EatBlockGoal) | Keep the small 1.21.1-branch mixins with `@ModifyExpressionValue`/`@ModifyArg` (no `@ModifyArgs`), and test together |
| `LightningRodBlock`, `LightningBolt` | F&F (3, oxidising rods), More Culling; our **lsp_fixes LightningZoneMixin** (it only cancels the bolt's fire inside safe zones; the bolt still strikes) | Keep the HEAD inject on `onLightningStrike`. The Lightning potion calls real bolts, so its effect must skip safe zones and respect the city's no-PvP rule. |
| `BrewingStandBlockEntity` | Lithium; our **lsp_fixes BrewingStandTickMixin** (Brewing gate: a stand only brews a gated ingredient for someone with the level) | Only touch the item list. A lightning strike fills the bottles without brewing, so it bypasses that gate: add the Lightning potion to `skills/unlocks.mjs` (`POTION_LEVEL`) and check the level in the rod handler (for example against the stand's last user). |
| `SmithingMenu` | Create; our **lsp_fixes SmithingGateMixin** | Keep the turtle "no trim" check as a HEAD guard; add the crown, wildfire-gear and boat-upgrade recipes to the CRAFT gates |
| `CarvedPumpkinBlock#trySpawnGolem` | F&F (copper and tuff golem building) | Act only when the block below is a hay bale |
| `NoteBlock` | Blueprint, Piglin Proliferation | `NoteBlockEvent.Play` or the 1-line `getCustomSoundId` mixin (`NoteBlockInstrument` is not extensible on NeoForge 21.1) |
| `Bee`, `BeehiveBlockEntity` | F&F (4), Moonlight, Subtle Effects | Keep `Bee#registerGoals` (moobloom) and the honey-release hook small |
| `AbstractArrow`, `Snowball`, `SmallFireball` | Sable, V&V, YUNG's Ocean Monuments, F&F, Subtle Effects | Branch arrow mixin (verified targets) or `ProjectileImpactEvent`; the Wildfire's fireballs and snowballs as subclasses or in its own `hurt` |
| `Zombie`, `Skeleton` | Blueprint, LootJS, Naturalist, V&V (4), YUNG's Desert Temples | Conversions in `EntityTickEvent` with `EventHooks.canLivingConvert`/`onLivingConvert` |
| `RedStoneWireBlock`, `PistonBaseBlock` | Lithium | The branch's 4 striker mixins with an early return when nothing is struck (hot redstone path; Create) |
| `FallingBlockEntity` | Create, Lootr, Sable, KubeJS, Architectury, Blueprint, Create Dragons Plus, Subtle Effects | Chainmail sieve as a narrow inject, or `EntityTickEvent` |
| Client: `MinecartRenderer`, `MinecartModel` | Better Block Entities (MinecartRendererMixin), EMF | Test the 3D minecart with BBE and Fresh Animations |
| Client: `HumanoidModel`, `ItemInHandRenderer` | Create, Not Enough Animations, EMF, Relics, Moonlight, Piglin Proliferation, 3D Skin Layers, Subtle Effects | No pose mixins: use `ArmPose` enum extension + `IClientItemExtensions#getArmPose` and `applyForgeHandTransform` |
| Client: `ParticleEngine` | about 10 mods | `RegisterParticleProvidersEvent` (or draw the damage numbers in the renderer, as the branch does) |

#### 1.6.3 Changes to vanilla behaviour (decide and document)
Main changes these for everyone, not only for its own content. Keep each one as a deliberate choice, and note it in the docs:
- **Pillagers:** every pillager gets crossbow range 8 → 12 and hold-ground 10 → 15. Optional.
- **Tipped arrows:** they leave clouds (the feature), and picking up any fired arrow gives a plain arrow, so the potion is lost. Decide.
- **Recipes:**
  - Vanilla cake becomes uncraftable; the "Vanilla Cake" takes its place.
  - The torchflower → orange and pitcher → cyan dye recipes are disabled.
  - Vanilla wool dye recipes become transmutes.
  - Keep all of these, but disable with `neoforge:false`.
- **Melon:** `minecraft:melon` is replaced by the 8-corner melon block (256 states). The alternative swaps it to our own partial block on first bite.
- **The clock item** places blocks. Use `UseItemOnBlockEvent`; don't swap the vanilla item.
- **Tooltips:** every item with a container component gets a bundle-style grid, and vanilla's shulker-box text disappears. Scope this to our items; Shulker Box Tooltip is in the pack.
- **Bows:** the slingshot's arm pose applies to every bow user. Make it slingshot-only.
- **Fall damage:** Feather Falling boots on farmland also cancel fall damage (a bug). The event fixes it.
- **Goat horns:** blowing any horn makes every tamed animal **in the whole dimension** glow for 30 s, whoever owns it. On a PvP server this is an information leak, so use a radius and only the blower's own pets.
- **Griefing:**
  - Foxes with flint and steel replace blocks with fire; foxes with buckets delete fluid.
  - Wildfire fire bombs and its melee place fire regardless of mobGriefing.
  - Geysers ignite.
  - Respect mobGriefing for the foxes; Lemurton's safe zone already blocks griefing inside the city.
- **Ocelots:** monsters flee trusting ocelots.
- **Sniffers:** sniffer finds depend on biome, and torchflower seeds now only come from desert sniffing.
- **Turtle helmet:** the vanilla turtle helmet is renamed "Turtle Headgear" and its worn texture replaced.
- **Performance:**
  - The fox mixin creates `new Random()` every tick.
  - The horn scans every entity in the dimension.
  - The dolphin's 5000-block warm-ocean search runs on the server thread. Biome lookups are slow with Terralith and Tectonic: our notes measured about 3 ms per noise lookup.
  - Cap, cache or move each of these off-thread.

#### 1.6.4 Pack systems to wire up (in the same change as each feature)
- **Project MMO and our gates** (`skills/unlocks.mjs`, `skills/modded.mjs`, `skills/autovalues.json`, `enchanting/enchanting.mjs`):

  | Skill | What needs a rule |
  |---|---|
  | Attack | sickles by tier, Anchor, Wildfire Trident |
  | Ranged | slingshot (Ranged took bows from Attack) |
  | Defence | turtle pieces, crowns, Wildfire Shield |
  | Woodcutting | baobab (RU's gate already covers RU logs) |
  | Farming | ghost pepper, baobab fruit |
  | Cooking | soup, cakes |
  | Brewing | Lightning potion |
  | Smithing (CRAFT gates) | crowns, wildfire gear, boat upgrades |
  | Enchanting | Leeching, Shatter (`ENCHANT_SKILL`) |

  **The target dummy must not be a combat-XP or hiscore farm.** Its hits must never reach PMMO's damage events. Test this.
- **Economy:** `ItemValues` for new items (pearl, heart of the nether, crowns and so on).
- **Lifesteal purge:** clams store items in the container component, and nautilus blocks store an animal. Check that `Purge` sees both; ownership stamps apply as for other containers.
- **Docs and info:**
  - Rule: every player-facing feature updates `docs/` in the same commit.
  - The wiki atlas (`atlas.json`) gains new creatures and structures.
  - `publish/sources.mjs` "Found in" pages pick up the new loot tables (clam, patrol boat, wildfire, sniffer, shipwreck template).
  - JEI info pages and categories: kiln, soup, pyrotechnics, clam odds, nautilus block.
  - Optional new quests.
- **Other mods:**
  - **FallingTree:** test it on the hollow baobab trunk.
  - **Every Compat:** a new wood type would add about 90 blocks; another reason to reuse RU's baobab.
  - **Lootr:** shipwreck loot injection works unchanged.
- **Existing worlds:** Stage 3 worldgen only appears in chunks generated after it ships. The live world was created 2026-10-07, and `server/pregen` pre-builds Distant Horizons' far land out to 10,000 blocks. Check whether that pre-build writes real chunks (region files). If it does, baobabs, mounds, clams, geysers and boss rooms only appear in land generated after the update, so ship Stage 3 before a large pre-build, or accept that.

### 1.7 1.21.1 blockers by Minecraft version
| Version | Content or API used by Nekoma | Effect on the port |
|---|---|---|
| 1.21.2 | One boat entity type per wood | Use `Boat.Type` (extensible on NeoForge) |
| 1.21.2 | Dyed bundles (`#bundles`) | Vanilla Backport (optional extra) |
| 1.21.2 | Components CONSUMABLE / EQUIPPABLE / USE_REMAINDER / DAMAGE_RESISTANT / ENCHANTABLE / REPAIRABLE | Use FoodProperties, ArmorItem, overrides |
| 1.21.2 | `crafting_transmute`, string ingredients | Custom recolour recipe |
| 1.21.2 | `ToolMaterial` / `#*_tool_materials` | Use `Tier` |
| 1.21.2 | Render states | Old-style renderers |
| 1.21.2 | `charged_creeper` loot table | Use `LivingDropsEvent` |
| 1.21.2 | Recipe-book registry | Use `RecipeBookType` enums |
| 1.21.4 | Pale oak, eyeblossoms, resin | Vanilla Backport |
| 1.21.4 | Item model definitions, special model renderers, equipment assets | Use `models/item` + overrides, BEWLR, ArmorMaterial |
| 1.21.5 | Fallen trees, blue/brown eggs | Vanilla Backport |
| 1.21.5 | `#edible_for_sheep`, `tinted_leaves` particle, `checkSurfaceMonstersSpawnRules` | Drop or copy |
| 1.21.5 | Components WEAPON / BLOCKS_ATTACKS / BREAK_SOUND / TOOLTIP_DISPLAY | Use ShieldItem, TieredItem, overrides |
| 1.21.5 | Data-driven trial-spawner configs | Inline NBT |
| 1.21.6 | Harnesses, happy ghast, dried ghast | Vanilla Backport (optional) |
| 1.21.9 | Copper armour, tools, nuggets, torch; `chain` → `iron_chain` | Copper crown, copper buff and copper sconce **dropped**; Create's nugget for ammo; custom copper `Tier` for the sickle |
| 1.21.9 | Shelves (+ SHELF sounds) | Baobab shelf **dropped**; clam sounds substituted |
| 1.21.11 | Spears, Lunge, PIERCING_WEAPON / KINETIC_WEAPON / MINIMUM_ATTACK_CHARGE | Spear trap, Dismount, pillager spears and lunge glass-smash **dropped** (§5) |
| 1.21.11 | Nautilus mob | Drenched jockey **dropped** |
| 26.x | Cushions, poplar, wool and concrete slabs/stairs | **Dropped** |
| 26.x | Data-driven villager trades, `block_transformer`, `worldgen/feature` folder, Cushion entity, render pipeline (`SubmitNodeCollector`), `ValueInput`/`ValueOutput`, `Avatar`, `TypedEntityData` | Re-implemented with 1.21.1 APIs |

### 1.8 Fabric API → NeoForge 1.21.1 (what the 1.21.1 branch uses)

| Fabric | NeoForge 21.1.252 |
|---|---|
| `Registry.register` in static init, FabricItemGroup | DeferredRegister (incl. creative tabs) |
| FabricDefaultAttributeRegistry | `EntityAttributeCreationEvent` |
| BiomeModifications / BiomeSelectors | biome modifier JSON (`neoforge:add_features`, `neoforge:add_spawns`) |
| `SpawnPlacements.register` | `RegisterSpawnPlacementsEvent` |
| LootTableEvents | global loot modifiers / `LootTableLoadEvent` |
| StrippableBlockRegistry, block_transformer | `neoforge:strippables` data map or `BlockEvent.BlockToolModificationEvent` |
| `FireBlock.setFlammable` | same, in common setup |
| BlockEntityType accessor (`validBlocks`) | `BlockEntityTypeAddBlocksEvent` |
| UseBlock / UseItem / UseEntity / AttackEntity callbacks | `PlayerInteractEvent.*`, `UseItemOnBlockEvent`, `AttackEntityEvent` |
| ServerEntityEvents.ENTITY_LOAD | `EntityJoinLevelEvent` |
| PayloadTypeRegistry, Server/ClientPlayNetworking | `RegisterPayloadHandlersEvent` |
| BlockRenderLayerMap | `"render_type"` in model JSON |
| EntityModelLayerRegistry, EntityRendererRegistry, BlockEntityRenderers | `EntityRenderersEvent.RegisterLayerDefinitions` / `RegisterRenderers` |
| ColorProviderRegistry | `RegisterColorHandlersEvent` |
| TooltipComponentCallback | `RegisterClientTooltipComponentFactoriesEvent` |
| ParticleFactoryRegistry | `RegisterParticleProvidersEvent` |
| `ItemProperties` via accessor | `ItemProperties.register` in `FMLClientSetupEvent` |
| `EntityDataSerializers.registerSerializer` | `NeoForgeRegistries.Keys.ENTITY_DATA_SERIALIZERS` |
| Fabric datagen | `GatherDataEvent`, or copy the generated JSON |
| `FabricLoader.isModLoaded` | `ModList.get().isLoaded` / `LoadingModList` |
| access widener | access transformer |

---

## 2. Stage 1: self-contained blocks, items and mechanic tweaks

**Path abbreviations** (main branch):
- `J/` = `src/main/java/net/greenjab/nekomasfixed/`
- `C/` = `src/client/java/net/greenjab/nekomasfixed/`
- `R/` = `src/main/resources/`
- `G/` = `src/main/generated/`

**Other conventions:**
- "br." = the 1.21.1 branch.
- Asset counts are main's unless the cell says otherwise.
- Effort is S ≤1 day, M = a few days, L = a week or more.

| Feature | What it does | Implementation notes | Assets | 1.21.1 blockers / substitutes | Effort |
|---|---|---|---|---|---|
| **1. Four new dyes**: amber, aqua, indigo, maroon (the wiki's "Crimson" is `maroon_dye`) | Torchflower → 2 maroon; pitcher plant → 2 indigo; maroon + white → 2 amber; indigo + white → 2 aqua. The vanilla torchflower → orange and pitcher → cyan recipes are disabled. Colours #E0AF0B / #A6CEC7 / #453C8F / #A62D10. They recolour sign text and work in firework stars (named colours) and the pyrotechnics table. Amber dye is a 30/100 sniffer find. No effect on sheep, leather or banners. | `J/util/AllDyes` (20-value enum), `util/ModColors`, `util/ModDyeItems`.<br>Mixins: `DyeItem#tryApplyToSign` (RETURN), `FireworkStarRecipe#assemble` (WrapOp IntList.add), `FireworkExplosion#getColorName` (HEAD).<br>Port: a plain `Item implements SignApplicator`. **Not** `DyeItem`: its 1.21.1 constructor overwrites `DyeItem.byColor`, which breaks lamb colours and trades. **Not in `#c:dyes`**, or NeoForge's shulker colouring would match. MixinExtras on the `instanceof DyeItem` checks in both firework star recipes; tag `c:dyes/<colour>` only.<br>br.: partial (plain items + recipes; no signs or fireworks). | `R/assets/nekomasfixed/textures/item/<c>_dye.png` ×4, 4 item models, 4 recipes + 4 advancements, `advancement/husbandry/ancient_dyes`; lang: 4 items + 4 `item.minecraft.firework_star.<c>` + 2 | `DyeColor` isn't extensible on NeoForge 21.1, so each dye borrows a vanilla colour for block logic: amber → YELLOW, aqua → LIGHT_BLUE, indigo → MAGENTA, maroon → RED. `crafting_transmute` → shapeless. | S |
| **2. New-dye block families**: 44 blocks (wool, carpet, terracotta, glazed terracotta, concrete, concrete powder, stained glass, glass pane, candle, bed, shulker box) | Vanilla-equivalent blocks in the 4 colours. Recipes:<br>• dye + 8 terracotta / glass / panes → 8<br>• dye + 4 sand + 4 gravel → 8 powder<br>• glazed by smelting (and in the kiln)<br>• 2 wool → 3 carpet<br>• 3 wool + 3 planks → bed<br>• dye + candle<br>• dye + shulker box (keeps contents), bed, wool or carpet → recolour | `J/registry/registries/BlockRegistry` (`registerStainedGlass*`, `registerShulkerBoxBlock`, `registerBedBlock`), `util/BlockDyeMap`; mixin `BlockEntityTypes#<clinit>` → `BlockEntityTypeAddBlocksEvent`.<br>Client: br.'s `BedRendererMixin` and `ShulkerBoxRendererMixin` texture swaps; items via the br.'s `BedItemBlockEntityMixin`/`BlockEntityWithoutLevelRendererMixin`, or an `IClientItemExtensions` BEWLR.<br>Port extras:<br>• bring back a `RecolourRecipe` that uses `transmuteCopy` (keeps shulker contents and names)<br>• 4 `CandleCakeBlock`s (fixes the NPE)<br>• shulker washing in a water cauldron and dispenser placement<br>• wool flammability, mineable tags, `WoolCarpetBlock` for llama decor<br>br.: complete for the 44 blocks (b054e96f, 61517e46), with the bugs in §1.2. | br.: 44 blockstates, 88 block models, 44 item models; textures 40 block + 4 `entity/bed` + 4 `entity/shulker` + 4 item; 44 loot tables, 52 recipes; lang 44 | Main's 26.x block-model beds → 1.21.1 `BedRenderer` textures. Bundles (1.21.2) and harnesses (1.21.6) → optional rows 38/39 on Vanilla Backport. Cushions and wool/concrete slabs & stairs → §5. | M |
| **3. Dyed bricks**: 20 colours × bricks, slab, stairs, wall (80 blocks) | 8 vanilla bricks, brick slabs, stairs or walls around 1 dye → 8 dyed. 3 → 6 slabs, 6 → 4 stairs, 6 → 6 walls. Stonecutter: 1 dyed brick → 2 slabs, 1 stairs or 1 wall. Already-dyed bricks can only be recoloured with a brush. | `BlockRegistry` WHITE_BRICKS … MAROON_BRICK_WALL with `ofFullCopy(Blocks.BRICKS …)` and the borrowed map colour; datagen `C/datagen/ModRecipeProvider`.<br>Port: copy br. (3ee0c681) JSON; add `requiresCorrectToolForDrops` + `mineable/pickaxe` (br. lets them break by hand). Main has no loot for the 20 full blocks (bug). | 20 textures (one per colour), 80 blockstates, 200 block models, 80 item models, 200 recipes, 80 loot tables; lang 80 | None (format only). Name clash with Create Deco's "Blue Bricks"/"Red Bricks", so use "Dyed Blue Bricks" and so on. | S |
| **4. Froglights in every colour**: 17 new | Clear, cloudy, cascading, cloudburst, chamoisee, sanguine, vermilion, mandarin, lemon, kiwi, seafoam, teal, cerulean, navy, lavender, thulian, sakura. With vanilla ochre, verdant and pearlescent that makes 20. The only way to get them is to recolour any froglight with a dye (1:1) or a brush; frogs still only make the vanilla 3. Light 15 (cloudburst 10), strength 0.3. A challenge advancement asks you to hold all 20. | Plain `RotatedPillarBlock`s plus 20 recolour recipes. br.: complete (a11f40b5) with shapeless recipes; copy as-is. | 34 textures (side/top), 17 blockstates, 34 block models; lang 19; 21 advancements | `crafting_transmute` → shapeless (done in br.) | S |
| **5. Dyed brushes**: 20 colours | 8 dyes around a vanilla brush → 1 dyed brush (64 durability, 1 per block, stack 1). Right-clicking a block in `#can_be_dyed_with_brush` repaints it to the brush colour and keeps its properties:<br>• terracotta and glazed terracotta (keeps facing)<br>• the bricks family<br>• glass and panes<br>• wool and carpet, spotted wool and carpet<br>• candles (keeps count and lit)<br>• concrete and powder<br>• froglights (keeps axis)<br>• shulker boxes (keeps items and name)<br>• beds (both halves)<br>Dispensers paint the block in front. It can't brush suspicious blocks. | `J/registry/item/DyedBrushItem#useOn`, `registry/other/DyedBrushBehaviour` (dispenser; register in `FMLCommonSetupEvent.enqueueWork`), `util/BlockDyeMap` (24 maps), `util/ItemDyeMap`.<br>Fix main's bugs:<br>• 160 recipes ask for wool where a dye belongs (1.21.11 has the right dyes)<br>• the dispenser swaps the slab and stairs helpers, which crashes<br>• repainting with the same colour still costs durability<br>br.: not ported. | 20 textures, 20 item models, 20 recipes; lang 20 | The 26.x BlockTags (CONCRETE, WOOL_SLABS, …) → own tags or `c:concretes`. `hurtAndBreak` and swing API signatures differ. Drop the 26.x wool/concrete slab targets. | S–M |
| **6. Spotted sheep and spotted wool**: 20 colours × wool, carpet, slab, stairs (80) | A sheared sheep that eats mycelium (which turns to dirt) regrows spotted wool; eating grass while sheared makes it plain again. Spotted sheep drop `<colour>_spotted_wool` (sheared and on death) and render a tinted spotted fleece. They never spawn naturally and lambs aren't spotted. Recipes: dye + spotted X → recolour; 2 wool → 3 carpet; 3 → 6 slabs; 6 → 4 stairs. | Mixins:<br>• `Sheep#defineSynchedData` and save/load (flag "Spotted")<br>• `EatBlockGoal#canUse`/`#tick` (WrapOp `BlockState#is`)<br>• `Entity#spawnAtLocation` (swaps the wool)<br>• client `SheepFurLayer#render` (texture swap)<br>br.: full for sheep, wool and carpet (484b56fd, b7f09213); slabs and stairs not ported. Use `@ModifyArg`/`@ModifyExpressionValue`, not `@ModifyArgs`. | `textures/entity/sheep/sheep_wool_spotted.png`, 20 block textures, 80 blockstates, 160 block models, 40 item models, 140 recipes; lang 80 | Render states → the fur layer. Overlap: Vanilla Backport's Sheep mixins, Subtle Effects, and RU/Sable `EatBlockGoal` mixins (§1.6.2), so test together. | S |
| **7. Placeable clock** | The vanilla clock places on the floor (16 rotations) or a wall. Right-click toggles an HH:MM label.<br>**Stored time:** right-click air with a clock to store the current time (glint + "Recorded Time" tooltip). Once a day at that tick the placed clock gives a 15 strong-power pulse for 3 s into the block below or behind.<br>**Alarm (floor clock):** add a bell to make an alarm clock. Click +5 s, sneak +1 min, up to 10 min. At 0 it rings every 5 t and pulses for 3 s. Shears remove the bell.<br>**Comparator:** the current 12-hour hour. | `J/registry/block/AbstractClockBlock`, `FloorClockBlock`, `WallClockBlock`, `block/entity/ClockBlockEntity`, `network/UpdateClockPayload`, `registry/other/StoredTimeComponent`. Main swaps `Items.CLOCK` into a `StandingAndWallBlockItem` (ItemsMixin) and registers `minecraft:clock`/`wall_clock`.<br>Port:<br>• br. classes (fcc57f63) under our ids<br>• place through `UseItemOnBlockEvent` on `Items.CLOCK`<br>• store the time through `RightClickItem`<br>• `ENCHANTMENT_GLINT_OVERRIDE`, `ItemTooltipEvent`<br>• block-entity update packets on change instead of a 1 Hz payload<br>Fix: the bell isn't dropped (br.); main's clock has no loot (bug). | 2 blockstates, 2 particle-only models (the renderer draws the vanilla clock item, a spruce stand and the bell); lang 2 | None | S–M |
| **8. Edible melon blocks and glistering melon** | Right-click a melon block with an empty hand while hungry: it eats the corner you are looking at (8 corners; +1 hunger, +0.2 saturation each). The last corner removes the block, so you can carve "vertical slabs". Glistering melon (3×3 glistering slices) also heals 0.5 HP and sparkles. Drops: Silk Touch on a whole block gives the block; otherwise 3–7 slices (+Fortune, max 9), capped by the corners left. The wiki's "slices are edible too" has no code behind it. | `J/registry/block/MelonBlock` (`corner_1..8`, 256 cached shapes); mixin `Blocks#<clinit>` replaces `minecraft:melon`; R loot overrides.<br>br.: full (48ae8820).<br>Alternative that avoids swapping the vanilla block: on `RightClickBlock`, turn a full melon into an `lsp_nekoma:melon_partial`. | 2 blockstates (one overrides `minecraft:melon`), 20 block models, 6 textures; lang 1 | None | S |
| **9. Cakes and stacked cakes** | 7 flavours, plus a "Vanilla Cake" that replaces the vanilla recipe: sweet berry, pan cake (honey), glow berry, apple, cookie, chocolate (cocoa), beetroot, vanilla (milk).<br>Recipe: `A D A / B E B / C C C` (A milk bucket, B sugar, C wheat, E egg, D the flavour).<br>Food: every slice is +2 hunger, 0.1 saturation, with no flavour effects; 7 slices per cake.<br>**Stacking:** right-click a full top with any cake item to add a layer, up to 3 (drawn at 80% / 60% scale, 21 slices, eaten from the top). Candles + flint and steel light it. Comparator = slices. | `J/registry/block/StackedCakeBlock` (SLICES 1–21), `block/entity/StackedCakeBlockEntity`, `C/render/block/entity/StackedCakeBlockEntityRenderer`; R `recipe/*_cake.json` and the `minecraft/recipe/cake.json` override.<br>br.: full (b5c7d393, uses `minecraft:egg`). Disable the vanilla recipe with `neoforge:false`, not an air result. | 28 textures, about 50 block models, 10 blockstates (2 stale), 8 item models; lang 8 | `#minecraft:eggs` (1.21.5) → `#c:eggs` (NeoForge), or Vanilla Backport's `#minecraft:eggs` (includes blue and brown eggs) | S |
| **10. Soup cauldron and Special Stew** | Put a full water cauldron over fire or a campfire and add up to 4 different ingredients. There are 33 valid ones: potions, apples (incl. golden), melon slices, berries, chorus fruit, carrots, potatoes, beetroot, kelp, raw and cooked meat and fish, milk, honey, baobab fruit. An empty hand takes back the last ingredient.<br>Stir with a stick (fire still below): the ingredients become their smelting results and the water takes their blended colour. A bowl takes one Special Stew (stack 1).<br>**Eating** (32 t), for each ingredient:<br>• potion effects at 50% duration<br>• ceil(n/2) hunger<br>• the ingredient's own effects (golden apple, chorus teleport, milk clears, honey cures)<br>Comparator = Σ ceil(nutrition/2). | Main: `AbstractCauldronBlock#useItemOn` HEAD mixin; `J/registry/block/cauldron/SoupCauldronBlock`, `block/entity/SoupCauldronBlockEntity`, `util/SoupCauldronAnimator`, `registry/item/SpecialSoupItem`, client renderer + water tint.<br>Port:<br>• entries in the `CauldronInteraction.WATER` map instead of the mixin (wrap the POTION entry so bottle refills still work)<br>• FoodProperties-based eating with hand-coded chorus, milk and honey<br>• `RegisterColorHandlersEvent`, tooltip factory<br>Fix: the saturation formula effectively maxes saturation.<br>br.: not ported. | 1 blockstate (vanilla full-cauldron model), 1 item model + `special_soup_overlay.png`; lang 1 | CONSUMABLE / USE_REMAINDER → `FoodProperties` + `usingConvertsTo` + code. Overlap: Farmer's Delight cooking pot (different mechanic); give Cooking XP. | M |
| **11. Honey, slime, magma and ice cauldrons** | **Honey:** a honey bottle into an empty cauldron starts it (levels 1–4; bottles in and out). An empty hand at level 4 takes a honey block. Entities inside get Slowness I for 3 s. A full hive up to 4 blocks above adds a level for each honey-carrying bee it releases.<br>**Slime:** slime balls → up to level 4 → slime block.<br>**Magma:** magma cream → up to level 4 → magma block; entities inside take lava damage.<br>**Ice:** a full water cauldron under snow freezes. Take an ice block from it; it is standable and freezes entities like powder snow. | `J/registry/block/cauldron/{Honey,Slime,Magma,Ice}CauldronBlock`, `CauldronBehaviour`; mixins `LayeredCauldronBlock#handlePrecipitation` (ice) and `BeehiveBlockEntity#releaseOccupant` (honey).<br>Port: `CauldronInteraction.newInteractionMap` + `EMPTY.map()` entries in common setup. Keep the two small mixins, but only fill on a successful release. Upstream's own self-filling `tick()` code is dead. | 4 blockstates, 13 models (vanilla textures) | `InsideBlockEffectType` → `isEntityInsideContent` / `lavaHurt` / `setIsInPowderSnow`. Overlap: Subtle Effects' cauldron particles (client). | S–M |
| **12. Kiln** | `### / #D# / CCC` (5 mud bricks, a furnace, 3 terracotta). A furnace-like block that cooks 39 building recipes in 100 t (twice as fast as a furnace) for 0.4 XP; fuel burns half as long, so items per fuel are the same. The recipes:<br>• 20 terracotta → glazed<br>• cobblestone → stone → smooth stone; cobbled deepslate → deepslate<br>• 5 cracked bricks<br>• sand → glass; smooth sandstone, red sandstone, quartz and basalt<br>• clay → terracotta; clay ball → brick; netherrack → nether brick<br>• wet sponge → sponge; chorus fruit → popped chorus<br>• resin clump → resin brick | `J/registry/block/KilnBlock`, `block/entity/KilnBlockEntity`, `registry/recipe/KilnRecipe` (type `kiln`, serializer `kilning`), `screen/KilnMenu`, `C/screen/KilnScreen`; mixins on RecipeManager, RecipeSerializers and ClientRecipeBook.<br>Port:<br>• `AbstractCookingRecipe` + `SimpleCookingSerializer(…, 100)`<br>• recipe book: `RecipeBookType`/`RecipeBookCategories` enum extensions + `RegisterRecipeBookCategoriesEvent`, or no book<br>• a JEI category<br>• light 13 when lit (main gives none)<br>br.: not ported. | 1 blockstate, 2 models, 6 textures + 2 `.mcmeta`, 2 GUI textures; lang 3; 39 recipes | Resin (1.21.4) → Vanilla Backport (`minecraft:resin_clump`, `minecraft:resin_brick`), or drop that 1 recipe. The 1.21.2 recipe-book registry → enums. | M |
| **13. Pyrotechnics table and the Pyrotechnist** (the village houses are Stage 3, row 11) | Table recipe `DD / ## / ##` (2 gunpowder, 4 planks).<br>**Star mode:**<br>• up to 5 colour + 5 fade dyes<br>• a shape: fire charge = large ball, gold nugget = star, feather = burst, creeper banner pattern = creeper (not used up)<br>• glowstone = twinkle, diamond = trail<br>• gunpowder → 1 star<br>**Rocket mode:** up to 5 stars + 1–3 gunpowder (flight) + paper → **5** rockets (vanilla makes 3). 7 animated preview buttons show the shapes.<br>**Pyrotechnist villager** (job site: the table) has 2 random trades per level out of 21. Examples:<br>• L1: 4 gunpowder → 1 emerald<br>• L2: 1 emerald → Redstone Striker<br>• L3: 2 emeralds → random rocket; 8 emeralds → creeper banner pattern<br>• L4: 3 blaze rods → 1 emerald<br>• L5: 4 emeralds → TNT; 7 → TNT minecart; 12 + crossbow → crossbow loaded with a firework; 2 → 4 wind charges | `J/registry/block/PyrotechnicsTableBlock`, `screen/PyrotechnicsMenu` (14 inputs + output, buttons 0–7), `C/screen/PyrotechnicsTableScreen`, `registry/registries/VillagerRegistry`; loot functions `util/RandomFireworkModifier`, `LoadedCrossbowModifier`, `RandomDyeModifier`; datagen in `C/datagen/villager/*` (26.x data-driven trades).<br>Port:<br>• DeferredRegister for Block, MenuType, PoiType, VillagerProfession and `LootItemFunctionType`<br>• `RegisterMenuScreensEvent`<br>• **trades in `VillagerTradesEvent`** (ItemCost / MerchantOffer)<br>• POI tag `acquirable_job_site`, a profession lang key, the zombie-villager texture path<br>br.: not ported (1.21.11 has the table without the villager). | 6 block textures, 1 blockstate, 1 model; GUI 1 + 22 sprites (8 animated); 2 villager textures; lang about 14 | Data-driven trades (26.x) → `VillagerTradesEvent`. 26.x GUI API → `GuiGraphics`. `DataComponents.DYE` → item checks. | L |
| **14. Messy beds** | Right-clicking a clean, empty bed at night or in a thunderstorm marks both halves messy, even when sleep fails. Sneak with an empty hand to tidy it. Messy beds aren't villager HOME POIs: villagers can't claim, path to or sleep in them, and existing claims are dropped. Applies to all 20 bed colours. | Mixins: `BedBlock` constructor and `createBlockStateDefinition` (adds the property), `PoiTypes#forState` (messy → none). Use/tidy logic through `RightClickBlock`. Client: `BedRenderer` material swap to `entity/bed/<colour>_messy` (1.21.11's `BedBlockEntityRendererMixin` already does this).<br>br.: not ported. | 20 `textures/entity/bed/<colour>_messy.png`. Main's 140 bed block textures and 40 models are 26.x-only. | 26.x block-model beds → the 1.21.1 `BedRenderer` | M |
| **15. Goat horns: wall horn, sconces, horn buffs, pet glow** | **Wall horn:** right-click a sturdy face with a goat horn to mount it (strength 0.2, waterloggable; drops the horn with its instrument).<br>**Sconce:** add a torch: torch 15, soul torch 10, redstone torch 15 (no power), underwater torch 10 (only lit under water). Shears remove it. A redstone rising edge plays the horn (volume 3).<br>**Blowing a horn:** every tamed animal glows for 30 s. With Bad Omen or Raid Omen, iron golems get a 60 s effect depending on the horn: Ponder Resistance, Sing Instant Health, Seek Strength, Feel Absorption, Admire Regeneration, Call Speed, Yearn Strength, Dream Invisibility. | Placement mixin `BlockBehaviour#useItemOn` → `UseItemOnBlockEvent` (prefer sneak-to-place so blowing still works). `J/registry/block/GoatHornBlock`, enums `GoatHornType`/`GoatHornTorchType`. Buffs: `InstrumentItem#use` mixin → `RightClickItem`.<br>**Fix:** main scans the whole dimension, every owner. Use a radius (for example 48) and the blower's own pets only (§1.6.3).<br>br.: partial (cb65c7d9: the block, no buffs). | 1 blockstate (28 variants), 7 models, 1 texture | Copper-torch sconce (1.21.9) → dropped. `InstrumentComponent` → `Holder<Instrument>`. | S |
| **16. Foxes use what they hold** | Each tick there is a 1/10 chance (about twice a second) to act on the held item:<br>• hoe: tills the dirt below (−1 durability)<br>• shears: shears a sheep in reach (−1)<br>• flint and steel: sets a neighbouring block on fire (soul fire on soul soil; it **replaces** the block)<br>• potion: the fox drinks it and keeps the bottle<br>• bucket: scoops water or lava ahead-below, leaving air | `Fox#tick` HEAD mixin → `EntityTickEvent.Post`, server side only.<br>Port: lower the rate; only place fire into air; only scoop source blocks; respect mobGriefing and our safe zones. | none | None. Overlap: Naturalist's and Easy NPC's Fox mixins. | S |
| **17. Ocelot allies** (0.5.4) | Every monster except creepers flees trusting ocelots (8 blocks, speed 1.0/1.3). Trusting ocelots follow the nearest player within 16 blocks until 3 blocks away (speed 1.1). Kittens born from breeding are trusting. | Main: the `ENTITY_LOAD` handler, mixin `Ocelot#registerGoals`/`#getBreedOffspring`, `J/registry/entity/goal/FollowPlayerIfTrustedGoal`.<br>Port: `EntityJoinLevelEvent` + `BabyEntitySpawnEvent` + an access transformer for `isTrusting`/`setTrusting`. Main only. | none | None | S |
| **18. Flower crowns**: 16 (0.5.4) | A ring of 8 of one flower → a crown worn on the head (3D on players, armour stands and mobs). When a player hits someone wearing one, the **wearer** has a 50% chance to get the crown's effect for 5 s:<br>• torchflower, poppy: Night Vision<br>• blue orchid, dandelion: Saturation<br>• wither rose: Wither<br>• cornflower: Jump Boost<br>• lily of the valley: Poison<br>• the 4 tulips: Weakness<br>• allium: Fire Resistance<br>• azure bluet, open eyeblossom: Blindness<br>• oxeye daisy: Regeneration<br>• closed eyeblossom: Nausea<br>This looks inverted for the harmful crowns; decide which side should get it. | `J/registry/item/FlowerCrownItem`, `util/FlowerCrownVariants`, a `Player#attack` mixin; client `FlowerCrownLayer`/`Model` and renderer mixins.<br>Port: an `ArmorItem` with a 0-defence material + `IClientItemExtensions#getHumanoidArmorModel`; the effect in `AttackEntityEvent`/`LivingDamageEvent`. | 16 item + 16 entity textures, 16 models, 16 recipes; lang 16 | EQUIPPABLE (1.21.2) → ArmorItem. Eyeblossoms (1.21.4) → Vanilla Backport; without it, 14 crowns. | M |
| **19. 3D minecarts** (client) | Every minecart uses a 128×64 3D cart: slanted sides, front bar, chain and hook, and 4 wheels that turn 360° per block. | `C/render/entity/model/CustomMinecartModel`; mixins `MinecartModel#createBodyLayer` (HEAD) and the minecart renderer's model and texture. Check the offsets of chest, furnace, TNT and hopper carts and Create's minecart contraptions. | `textures/entity/minecart/new_minecart.png` (in the minecraft namespace upstream; move it to ours) | Render states. Overlap: Better Block Entities' `MinecartRendererMixin`, EMF / Fresh Animations, so test. | S |
| **20. Slingshot and Shatter** | Recipe `" X" / "#$"` (string, stick, leather); 384 durability. It reaches full draw in 12 t (a bow takes 20) and only fires at full draw.<br>**Ammo** (`#slingshot_projectiles`):<br>• copper nugget 2, gold nugget 3, iron nugget 4 damage, at speed 2.0 (⅔ of a bow)<br>• amethyst shard 2 damage, bounces off blocks, speed 1.5<br>• resin clump 1 damage + a Slowness V cloud (radius 3, 3 s), speed 1.5<br>**Enchantments:** Power +1 damage per level, Punch 0.6 per level, Multishot. **Shatter I** (exclusive with Multishot and Piercing) splits the shot into 5 copies on first impact. | `J/registry/item/SlingshotItem` (`ProjectileWeaponItem`), `registry/entity/SlingshotProjectile`.<br>Port:<br>• enchantment rules by overriding `supportsEnchantment`/`isPrimaryItemFor` (replaces the Enchantment mixin)<br>• the projectile in `#minecraft:arrows` and `#impact_projectiles` (Punch needs it)<br>• `ItemProperties` pull/pulling with pre-merged frame + band textures<br>• a slingshot-only `ArmPose` via `IClientItemExtensions` (main re-poses every bow user)<br>br.: partial (no pull animation, can only take Shatter, not in `#arrows`). | 5 item textures, 5 models; `R/data/nekomasfixed/enchantment/shatter.json` + tags; lang 3 | Copper nugget (1.21.9) → Create's `#c:nuggets/copper`. Resin (1.21.4) → Vanilla Backport. Item model definitions / composite models → overrides. Pack: Ranged gate. | M |
| **21. Sickles, combo, dual wielding and Leeching** | **Tiers:** 7 (`" XX" / "X X" / "#  "`; netherite by smithing). Damage: wood 2, stone 2.5, copper 2.15, iron 3, gold 4, diamond 5.5, netherite 6. Speed 1.6. They never sweep, and only attack at full charge.<br>**Combo:** each hit within 1.5 s of the last adds a stack, up to 10. Bonus = base × stacks × (10 − tier bonus)%: wood/gold 10%, stone/copper 9%, iron 8%, diamond 7%, netherite 6% per stack. Taking damage resets it.<br>**Dual wield:** with a sickle in both hands, right-clicking a mob attacks with the off-hand (12 t cooldown), and i-frames are bypassed so both hits land.<br>**Enchantments:** anything a diamond sword takes except level-5 enchantments and Sweeping Edge, so Knockback, Fire Aspect, Looting, Unbreaking, Mending and Leeching.<br>**Leeching I–III:** heals 2.5% / 3.75% / 5% of the pre-armour damage; exclusive with Mending; found in loot, trades, and as a 50% stronghold-library book. | `J/registry/item/SickleItem`, `registry/other/ComboComponent`, `util/ModItemSettings`; `PlayerMixin` (combo, i-frames, `baseDamageScaleFactor`); client `MinecraftMixin`; `LivingEntityMixin` (leeching).<br>Port:<br>• `TieredItem` + Tier records (a custom copper tier: 190 uses, enchantability 13)<br>• `getAttackDamageBonus` override for the combo (no mixin), combo state in a data attachment<br>• `AttackEntityEvent` for the full-charge gate; `EntityInteract` for the off-hand attack<br>• Leeching JSON on our own tag (swords + sickles), heal in `LivingDamageEvent.Post`, stronghold book via a GLM<br>• access transformer for `attackStrengthTicker`<br>br.: partial (no durability loss, enchant rules missing, the `tradable` typo). | 7 textures, 7 models, 7 recipes; `enchantment/leeching.json`; lang 10 | `ToolMaterial` and `#*_tool_materials` (1.21.2), and the WEAPON / MINIMUM_ATTACK_CHARGE components (1.21.5 / 1.21.11) → TieredItem + events. Copper tier → custom Tier. `#enchantable/melee_weapon` → own tag. Pack: Attack gates per tier; the dual-wield i-frame bypass needs a PvP balance check. | M |
| **22. Feather knockback** | Hitting a mob with a feather knocks it back (0.4, plus sprint knockback) with no damage, sound or i-frames. | `Player#attack` wrap → `AttackEntityEvent`: knock back, set `hurtMarked` for player targets, cancel. br.: full. | none | `hurtOrSimulate` → `hurt` | S |
| **23. Feather Falling stops trampling** | Boots with any level of Feather Falling never trample farmland. | Main cancels all of `FarmBlock#fallOn`, which also removes fall damage (bug). Port: cancel `BlockEvent.FarmlandTrampleEvent`. br.: full (with the bug). | none | None. The event avoids the Farmer's Delight, Create Connected and Subtle Effects FarmBlock mixins. | S |
| **24. Tipped arrows leave a cloud** | Any potion arrow, including Stray and Bogged arrows, spawns one cloud at the entity it hits or where it sticks: radius 2 shrinking to 0 over 5 s, 5 t wait. Side effect upstream: picking up a fired arrow gives a plain arrow (§1.6.3). | `AbstractArrow#doPostHurtEffects` / `#onHitBlock` HEAD, `#tryPickup`. br.: full (all targets verified). Alternative: `ProjectileImpactEvent`. | none | None. Overlap: V&V, Sable and YUNG's arrow mixins. | S |
| **25. Redstone Striker** | Recipe `RG / FR` (redstone, gold ingot, flint); 64 durability. Right-click a block: for 16 t (1 t when sneaking) that spot counts as powered at 15. Dust reads 15, a conductor outputs 15, components see a signal and observers pulse. No fire. Also sold by the Pyrotechnist. | `J/registry/item/RedstoneStrikerItem` + mixins `SignalGetter#getSignal`/`#hasNeighborSignal`, `RedStoneWireBlock` (1.21.1 has no RedstoneWireEvaluator), `PistonBaseBlock#getNeighborSignal`, and an `ObserverBlock#startSignal` accessor. Expiry in `LevelTickEvent`; a per-level, server-only map; return early when nothing is struck (hot path with Create and Lithium). br.: full. | 1 texture, 1 model; lang 1 | Experimental `RedstoneWireEvaluator` → 1.21.1 `RedStoneWireBlock` | S |
| **26. Lightning in a bottle** | Put an upward lightning rod on a brewing stand. When it is struck, glass bottles in the stand become Potions of Lightning. Drinking one, or being hit by the splash, lingering or tipped-arrow form (all made the vanilla way), calls a bolt onto the target if it can see the sky. | `LightningRodBlock#onLightningStrike` HEAD mixin (there is no event); `MobEffect` + `Potion` via DeferredRegister; glint via `hasFoil`. br.: partial (no copper part).<br>Pack: Brewing gate (`POTION_LEVEL`); our `LightningZoneMixin` only stops lightning fires in safe zones, so the Lightning effect itself must skip safe zones and the city's no-PvP rule (a splash potion is otherwise a way round it); check F&F's oxidising rods (they subclass the rod). | lang (effect + 4 potion names) | The copper-armour buff and the lightning magnet need copper armour (1.21.9) → §5 | S |
| **27. Armour-stand quick swap** | Sneak + right-click an armour stand: each armour slot swaps with yours when either side holds matching armour. | `ArmorStand#interactAt` → `PlayerInteractEvent.EntityInteractSpecific`. br.: full. | none | None | S |
| **28. Enderman head** | An enderman killed by a charged creeper drops its head (one per creeper). Place it on the floor or a wall.<br>**Looking at it:** a player within 45 blocks who looks at it (and isn't wearing a pumpkin or enderman head) makes it angry: the jaw opens and it screams. It then gives redstone power `clamp((48 − d)/3, 1, 15)`, with strong power into its block.<br>**Worn:** endermen stay calm.<br>**On a note block:** plays the enderman sound. | `J/registry/block/{AbstractEndermanHeadBlock, Floor/WallEndermanHeadHead}`, `block/entity/EndermanHeadBlockEntity` (raycast every 10 t), client renderer and models.<br>Port:<br>• note block: `NoteBlock#getCustomSoundId` mixin or `NoteBlockEvent.Play` (`NoteBlockInstrument` isn't extensible)<br>• drop: `LivingDropsEvent` with `Creeper#canDropMobsSkull`/`increaseDroppedSkulls`<br>• item: a `StandingAndWallBlockItem` subclass with `isEnderMask` and the HEAD slot<br>br.: partial (no drop, not wearable). | 2 blockstates, item texture and model (the block reuses vanilla enderman textures), 2 loot tables; lang 1 | `gaze_disguise_equipment` / EQUIPPABLE → `isEnderMask`. The 1.21.2 `charged_creeper` loot table → event. Overlap: Blueprint's and Piglin Proliferation's NoteBlock mixins; check that Creeper Overhaul's creepers count. | M |
| **29. Turtle armour**: Turtle Shell, Knee Pads, Flippers; vanilla helmet changed | Recipes from scutes: chestplate 8, leggings 7, boots 4. Turtle material: armour 6/5/2, durability 400/375/325.<br>• **Helmet:** fully blocks mace smash attacks, costing durability equal to the damage.<br>• **Chestplate:** hits from behind (more than 90°) are halved, or fully blocked while sneaking; +1 or +3 durability from melee.<br>• **Leggings:** no off-ground mining penalty with eyes underwater.<br>• **Boots:** Dolphin's Grace 10 s, refreshed while on land; hover without sinking underwater.<br>The new pieces can't be trimmed or upgraded. | Main: `LivingEntity#hurtServer`/`#travelInWater`, `Player#tick`/`#getDestroySpeed`/`#hurtServer`, `SmithingMenu#createResult`, client equipment layer.<br>Port:<br>• `LivingIncomingDamageEvent` for chestplate and helmet (mace smash = holding a `MaceItem` and `canSmashAttack`)<br>• `PlayerEvent.BreakSpeed` ×5 for the leggings<br>• `PlayerTickEvent` for the boots<br>• one mixin on `LivingEntity#travel` for the hover<br>• `ArmorItem(ArmorMaterials.TURTLE)` + `textures/models/armor/turtle_layer_1/2`<br>Fix: the helmet passes the CHEST slot.<br>br.: ported, but its material is 3/3/1. | 3 item textures and models, 2 armour layer textures (main overrides the vanilla turtle helmet layer); lang 3 (+ renames the vanilla helmet "Turtle Headgear") | Equipment assets, `mace_smash` damage type, `travelInWater` → covered in the notes. Pack: Defence gates; also SmithingMenu (lsp_fixes, Create). | S–M |
| **30. Underwater torch** | A glow ink sac over a stick → 4. It gives light 13 only when waterlogged (it looks like an unlit redstone torch when dry), only places inside water, and gives off glow particles. | `J/registry/block/GlowTorchBlock`, `WallGlowTorchBlock`. br.: full (a32c4504); add the `wall_post_override` tag. | 2 blockstates, 4 models, 2 textures; lang 2 | None. LambDynamicLights may still light a held one in air (cosmetic). | S |
| **31. Nautilus block**: regular, zombie, coral | 4 nautilus shells → block. Adding rotten flesh makes the zombie variant, then coral the coral variant; the animal inside is kept.<br>**Store:** right-click with a leashed small animal (under 1.0 wide, under 1.5 tall) within about 3 blocks; the lead drops.<br>**Release:** right-click again; it comes out in front. Holding a lead re-leashes it.<br>It breaks by hand and keeps the animal. The tooltip shows "Holding: …" with a live 3D preview. If the item is destroyed (lava, cactus) the animal is released. Comparator 15 when occupied. | `J/registry/block/NautilusBlock`, `block/entity/NautilusBlockEntity`, `enums/NautilusBlockType`, `registry/other/AnimalComponent`.<br>Port:<br>• no mixins: a `NautilusBlockItem` with `onDestroyed`, `appendHoverText` and `getTooltipImage`, plus the tooltip factory event<br>• entity saved as a CompoundTag and restored with `EntityType.loadEntityRecursive`<br>• a custom shapeless copy-components recipe<br>• cache the preview entity (main rebuilds it every frame)<br>br.: not ported. | 3 blockstates, 6 models, 21 textures, 3 recipes, 3 loot tables; lang 4 | `crafting_transmute`, `TypedEntityData`, `Leashable.leashableInArea` → 1.21.1 equivalents (in the notes). Pack: lifesteal purge and ownership. | M |
| **32. Dolphins lead to coral reefs** | Feed a dolphin a tropical fish: it looks for the nearest warm ocean (up to 5000 blocks) and swims there, leaving glow particles. | Dolphin mixins → `EntityInteract` + a goal added in `EntityJoinLevelEvent` + a saved attachment (main never saves the flag). **Cap or cache the biome search, or run it off-thread**: it runs on the server thread and is slow with Terralith and Tectonic. | none | None | S |
| **33. Nether food rots** | In a `#is_nether` biome, there is a 1/300 chance per tick (about every 15 s) that a random inventory slot holding one of 32 vanilla foods loses one item and gains a rotten flesh. That works out to about 1 item per stack per 10 minutes. Golden foods, stews and modded foods are exempt. | `PlayerTickEvent.Post` on the server side + `ModConfigSpec`; tag `food_items`. Optional: `#c:foods` minus `#c:foods/golden`, but that would hit Farmer's Delight foods too. | 1 tag | None | S |
| **34. Magma blocks leave lava** | Mining a magma block with a pickaxe without Silk Touch leaves a lava source and drops nothing; the loot override means it drops only with Silk Touch. | `BlockDropsEvent`, or the `Block#playerDestroy` HEAD mixin; loot override in 1.21.1 format. | none | None | S |
| **35. Corrupted beacon** (0.5.4) | Light-15 block with a magenta beam. Every 80 t it gives every monster within 30 blocks Speed II, Strength II and Absorption II for 5 s. A pickaxe breaks it for 50–100 XP and no item. **Upstream it is creative-only**: no recipe, loot or structure. | `J/registry/block/CorruptedBeaconBlock` + block entity; our block-entity renderer calls `BeaconRenderer.renderBeaconBeam`. Decide where it appears (dungeon prop, boss room?) or keep it creative-only. | 1 blockstate, 1 model, 1 animated texture; lang 2 | `BeaconBeamOwner` (26.x) → own renderer | S |
| **36. Sniffer finds by biome** | Sniffers also dig sand and red sand, and what they find depends on the biome at their head:<br>• **snowy** (temperature ≤ 0.15): snowball 40, snow block 20, packed ice 15, blue ice 5, powder snow bucket 5; +50% bonus of spruce sapling or sweet berries<br>• **desert** (biome id contains "des"): sand 40, copper nugget 20, burn sherd 15, torchflower seeds 15, diamond 5, string 4, dune trim 1; +50% bonus of string or sand<br>• **badlands** (id contains "badlands"): red sand, wooden sickle, burn sherd, gold nugget, string (20% each)<br>• **default**: amber dye 30, pitcher pod 20, wheat 10, wheat seeds 10, heart sherd 10, green dye 10, prize sherd 5, lead 5<br>Torchflower seeds now only come from desert sniffing. | `Sniffer#dropSeed` HEAD-cancel mixin + `SnifferAccessor`; overrides `minecraft:gameplay/sniffer_digging` and adds 3 new tables; tag `sniffer_diggable_block`. The mixin carries over 1:1. Main and 1.21.11 are identical. br.: not ported. | 4 loot tables, 1 tag | Copper nugget (1.21.9) → `create:copper_nugget`. The substring match also catches Terralith's and RU's desert/badlands biomes; check RU's joshua_desert, saguaro_desert and outback. | S |
| **37. Chainmail sieve** (undocumented) | Sand or gravel (`#sievable_blocks`) falling onto a player wearing a chainmail helmet breaks into its loot (gravel can give flint), and the helmet loses 1 durability. | `FallingBlockEntity#tick` HEAD mixin. 8 pack mods also mix `FallingBlockEntity`, so keep the inject narrow or use `EntityTickEvent`. | 1 tag | None | S |
| **38. Bundles and harnesses in the 4 dyes** (optional, needs Vanilla Backport) | 4 dyed bundles (dye + any bundle) and 4 dyed harnesses for the happy ghast, matching Vanilla Backport's 16 vanilla colours. | Bundles: vanilla `BundleItem`; Vanilla Backport's mixins add the modern behaviour; we add models matching its open/closed convention. Harnesses: compile-only against Vanilla Backport's `HarnessItem`; check how `GhastHarnessHandler` picks the texture and add a small layer if it is tied to `DyeColor`. | 4 + 4 item textures; harness entity textures 4 | Dyed bundles (1.21.2) and harnesses (1.21.6) are only in the pack through Vanilla Backport | M |

---

## 3. Stage 2: new mobs and entities (including their spawning)

| Feature | What it does | Implementation notes | Assets | 1.21.1 blockers / substitutes | Effort |
|---|---|---|---|---|---|
| **1. Target dummy** | **Summon:** place a carved pumpkin or jack o'lantern on a hay bale (like building a golem; it faces the pumpkin).<br>**Equip:** right-click with armour, heads, elytra or a held item; an empty hand takes the item under the cursor.<br>**Variants:** a zombie head, skeleton skull or rotten flesh makes a zombie dummy (Smite applies). A name tag or player head gives it that player's skin. A hay bale resets it.<br>**Hits:** a player's hit shows a floating damage number, counting crits, enchantments, Smite, its own armour and Protection. It loses no health and shakes for 5 t. On a weighted pressure plate it outputs min(last damage, 15).<br>**Removal:** shears (drops itself + equipment; dispensers work too), explosions (equipment only), or two quick hits in creative. | Main: `J/registry/entity/TargetDummy` (extends 26.x `Avatar`), `registry/item/TargetDummyItem`; mixins `CarvedPumpkinBlock#trySpawnGolem`, `WeightedPressurePlateBlock#getSignalStrength`, `Enchantment#applyEffects` (Smite via a stand-in zombie), `ServerExplosion` knockback; client particle and name-tag hacks.<br>Port from br. (mostly complete; numbers drawn by the renderer from synced data):<br>• a `LivingEntity` base; the `EXPLOSION_KNOCKBACK_RESISTANCE` attribute replaces the explosion mixin<br>• keep the 3 mixins, with one cached stand-in zombie per level<br>• sync the skin as STRING + OPTIONAL_UUID (br.'s `registerSerializer` throws on NeoForge)<br>• add `CustomHeadLayer` and `WingsLayer`; pick slots by position in `interactAt` | 2 entity textures (64×64), item texture and model; the base plate uses the vanilla armour-stand wood; lang 2 | `Avatar`, the `RESOLVABLE_PROFILE` serializer and particle groups (26.x) → LivingEntity + synced strings + renderer text.<br>Pack: **hits must not give Project MMO combat XP** (test); F&F also hooks the golem pumpkin check, so only act on hay bales. | M |
| **2. Moobloom** (§1.6.1: F&F has one) | Flower cows in 15 variants (14 without the eyeblossom one), each a flower → stew effect:<br>• torchflower: Night Vision\*<br>• blue orchid, dandelion, open eyeblossom\*: Saturation<br>• wither rose: Wither\*<br>• cornflower: Jump Boost<br>• lily of the valley: Poison<br>• orange, pink, red and white tulip: Weakness<br>• allium: Fire Resistance<br>• poppy: Strength<br>• azure bluet: Blindness<br>• oxeye daisy: Regeneration<br>(\* never spawn naturally)<br>**Spawning:** flower forest, sunflower plains, meadow (weight 30, group 1–2). Cow stats.<br>**Breeding:** tempted and bred with the 15 flowers. A calf gets 35%/35% one parent's variant and 15%/15% the variant of each parent's last-eaten flower.<br>**Interactions:** shears drop 1 flower (regrows in 5 min); a bowl gives a 15 s suspicious stew (unlimited); a bucket gives milk; bees take nectar from unsheared mooblooms within 8 blocks. | `Moobloom` (extends Cow), `MoobloomVariants`, `PollinatingMoobloomGoal`; mixins `Bee#registerGoals` and `Animal#mobInteract`. Replace the Animal mixin by overriding `usePlayerItem`, which also fixes the last-flower bug.<br>br.: full (f91c46d9; CREATURE, cow size). Register a spawn placement (main has none) and use the CREATURE category (main uses AMBIENT). | 42 entity textures (14 × base / baby / sheared; the eyeblossom variant has no texture upstream), spawn egg; lang 2; tag `moobloom_flowers` | Open eyeblossom (1.21.4) → Vanilla Backport, or 14 variants. Render states → classic renderer. | S |
| **3. Suspicious spider** | A spider (16 HP, 2 damage, 1×1) in dripstone caves and in caves under plains (weight 30, group 1–2; never under open sky). Each spawns with at least one infinite buff: Speed 40%, Strength 20%, Regeneration 20%, Invisibility 20% (its eyes still glow). Every bite has a 25% chance each of Weakness II, Blindness II, Poison II or Wither II for 10 s. No drops upstream. | `SuspiciousSpider` (extends Spider), renderer + EyesLayer + model (vanilla mesh + mushroom planes).<br>Port: a `SpiderModel` subclass; spawn placement ON_GROUND with `checkMonsterSpawnRules && (spawner or can't see sky)`. Add spider drops and `#arthropod` (Bane) ourselves. br.: not ported. | 2 textures (64×64), spawn egg; lang 2 | None | S |
| **4. Derelict** (jungle zombie; §1.6.1: V&V Thicket) | A zombie in `#is_jungle` (weight 100, group 4, as much as all vanilla zombies), surface spawns under open sky. When a living attacker hurts it, it releases a Poison I cloud (radius 2.5, 3 s; 2 s cooldown). Drops 0–2 rotten flesh; turns into a Drowned underwater like any zombie. | `Derelict` (extends Zombie, `hurt` override), a renderer with a Drowned-style outer layer.<br>Port: `AbstractZombieRenderer` + `DrownedModel` layers; a spawn check copied from the Husk's; drop the baby model and textures and `ArmorModelSet`. | 4 entity textures (2 baby), spawn egg, loot table; lang 2 | `checkSurfaceMonstersSpawnRules` (1.21.5) → Husk-style rule. Baby models (1.21.2) → young scaling. Lower the weight (§1.6.1). | S |
| **5. Rime** (snowy zombie; §1.6.1: V&V Gelid) | A zombie in 8 snowy biomes (weight 100, group 4), immune to freezing. It alternates melee with snowballs (every 40 t, range 15). A snowball hit gives Slowness II for 5 s, +1 damage and the frost overlay. A plain zombie that stands in powder snow for 22.5 s turns into a Rime. Drops 0–2 rotten flesh. | `Rime` (Zombie + RangedAttackMob), `SlownessSnowball`. Fix: main's projectile is really a vanilla snowball, because Snowball's constructor hard-codes the type. The `Zombie#tick` conversion → `EntityTickEvent` + `EventHooks.canLivingConvert`/`onLivingConvert`. Spawn tag `spawns_rime` → `#c:is_snowy` (picks up Terralith and RU). | 4 entity textures, spawn egg, loot table, tags; lang 2 | As for the Derelict. `ConversionParams` → `convertTo(type, true)`. | S |
| **6. Drenched + Anchor** (§1.6.1: V&V Murk) | **Drenched:** a drowned-like skeleton with 3 skins (purple, red, yellow) in `#is_ocean` and rivers (weight 5 each, group 1–2; drowned spawn rules).<br>• 10% hold an **Anchor**: melee only, +12 damage, 0.5 attacks/s, +1.5 reach, 2500 durability; 8.5% drop chance.<br>• 3% hold an empty clam (always dropped).<br>• It burns in daylight and swims. It hunts players at night or in water, plus villagers, golems, axolotls and baby turtles.<br>• A skeleton with its eyes underwater for 45 s turns into one.<br>• Drops 0–2 bones. | `Drenched` (AbstractSkeleton + goals + move control); `AnchorItem` (an empty subclass in main) → an Item subclass with `postHurtEnemy` durability, enchantability 15, prismarine repair and a full-charge gate in `AttackEntityEvent`. `SkeletonMixin` conversion → `EntityTickEvent`. `HumanoidMobRenderer` + skeleton armour layers; `travel(Vec3)` like 1.21.1's Drowned. Save the variant (main forgets it on reload). | 3 entity textures (128×128), anchor and spawn-egg textures, 3 models, loot table; lang 3 | The nautilus jockey (1.21.11) → dropped. WEAPON / MINIMUM_ATTACK_CHARGE → item code. Pack: Attack gate for the Anchor. | M |
| **7. Big and Huge boats + Boat Upgrade Template** | **Crafting** (smithing): template + boat + planks → **Big Boat** (3 seats, 2 with a chest). Template + Big Boat + planks → **Huge Boat** (4 seats, 3 with a chest).<br>**Chest:** add with a chest (permanent; hoppers only work with one). **Banner:** goes on the mast for extra speed; shears remove it.<br>**Speed:** s = 0.4 + 0.1 per rower + 0.15 with a banner (Big), or 0.3 + 0.1 per rower + 0.2 (Huge). Top speed is about 1.2·s² blocks/tick (Huge with 4 rowers and a banner ≈ 0.97, vanilla 0.4). Rowers are players, villagers and raiders.<br>**Handling:** turning ×0.6 / ×0.4; damage taken ×0.8 / ×0.48. Two invisible hitbox entities extend the hull.<br>**Template:** 50% per shipwreck treasure chest, always in a patrol captain's chest. Copy: 7 diamonds + planks + template → 2. | Main: `BigBoat`/`HugeBoat` (26.x `AbstractChestBoat`), `FakeBoat`, 24 entity types; mixins on AbstractBoat (`controlBoat`, `positionRider`, `clampRotation`, `floatBoat`, `tick`), `BodyRotationControl`, `HopperBlockEntity`, client `MultiPlayerGameMode`.<br>Port:<br>• 3 entity types (`BigBoat extends ChestBoat`, `HugeBoat`, `FakeBoat`) keyed by `Boat.Type`, plus enum-extended baobab and pale-oak types<br>• a custom BoatItem<br>• narrow `Boat` mixins (Lithium, Vanilla Backport and Platform also mix Boat)<br>• no hopper mixin: `canPlaceItem`/`canTakeItem` require a chest<br>• shared model layers with per-type textures; `NoopRenderer` for the fakes; sync the fake's owner<br>• shipwreck loot via a GLM<br>Fix: the boat drops 3 chests (dupe); add mangrove and baobab recipes. br.: not ported. | 24 entity textures (128×128), 24 item textures and models, template texture + 2 slot sprites, 21 recipes; lang 51 | Per-wood boat entity types (1.21.2) → `Boat.Type`. Pale oak → Vanilla Backport planks and boat item + our own type. Poplar (26.x) → dropped (9 vanilla woods + pale oak + baobab). Smithing slot icons → `empty_slot_*` textures. | L |
| **8. Spawning for the new mobs** | Spawn entries and placements for the Moobloom (CREATURE), Suspicious spider, Derelict, Rime and Drenched. Termites (hives) and the Wildfire (arena spawner) have no natural spawns. | One `neoforge:add_spawns` JSON per mob + `RegisterSpawnPlacementsEvent`. Retarget explicit vanilla biomes to tags so Terralith and RU biomes count:<br>• Rime → `#c:is_snowy` (overworld)<br>• Derelict → `#minecraft:is_jungle`<br>• Drenched → `#minecraft:is_ocean` + rivers<br>• Moobloom → flower biomes incl. RU's flower_fields, poppy_fields and clover_plains<br>Set reduced weights (§1.6.1) in config. | none | `checkSurfaceMonstersSpawnRules` → own predicate | S |

---

## 4. Stage 3: worldgen, the Wildfire boss and the fortress room

| Feature | What it does | Implementation notes | Assets | 1.21.1 blockers / substitutes | Effort |
|---|---|---|---|---|---|
| **1. Baobab wood** (§1.6.1: Regions Unexplored already has it) | A full wood set: log, wood, 2 stripped, planks, stairs, slab, fence, gate, door, trapdoor, pressure plate, button, sign, hanging sign, leaves, sapling, boat, chest boat. Recipes like vanilla woods: the hanging sign uses unstripped logs; the chest boat recipe is buggy (chest + planks). Leaves drop saplings at 10–20% with Fortune (the stick drop is broken in main). | `J/registry/registries/BlockRegistry` (WoodType / BlockSetType). br.: full except the shelf.<br>Port: DeferredRegister; `Sheets.addWoodType`; `BlockEntityTypeAddBlocksEvent` for the signs; `Boat.Type` enum extension; the `neoforge:strippables` data map; `setFlammable`.<br>**Recommended instead:** don't register a second baobab wood. Use `regions_unexplored:baobab_*` for rows 2, 3 and 5 through tags; RU's Woodcutting 40 gate and Every Compat already cover it. | 20 textures (13 block, 2 entity, 5 item) + sign, hanging-sign and GUI textures, 20 blockstates, about 61 block models; lang about 23 | Shelf (1.21.9) → dropped. Per-wood boats → `Boat.Type`. `iron_chain` → `chain`. | M (S if we reuse RU) |
| **2. Baobab tree** | Hollow trunk 15–18 tall (a ring with radius about 3.5 narrowing to 2), roots showing on slopes, 5–6 branches with acacia-style canopies. 50% of natural trees hold 3 layers of water inside. About 6% of savanna chunks (vanilla savanna, plateau, windswept). Grows from a 2×2 sapling (dark-oak rules). | `J/registry/worldgen/tree/BaobabTrunkPlacer`, `BaobabTreeDecorator`, worldgen JSON. br.: full (weights 10:1 there, 15:1 in main).<br>Port: DeferredRegister for `TRUNK_PLACER_TYPE` and `TREE_DECORATOR_TYPE`; a `neoforge:add_features` biome modifier on `#c:is_savanna` **minus `regions_unexplored:baobab_savanna`** (it has its own mega and ultra baobabs). That covers Terralith's savannas and RU's steppe and dry_bushland. Test FallingTree on the hollow trunk. | sapling textures and models (in row 1) | 26.x trunk-placer API and JSON (`soil_beneath_tree`, `would_survive`) → 1.21.1 forms | S |
| **3. Baobab fruit, rope and seeds** | **Fruit:** hangs under baobab leaves and grows downward on a rope chain: 4–8 ropes, about 7 steps, about 16 min at main's 1/2 chance per random tick (br.: 1/5). Bone meal ripens it. A ripe fruit is food 4 / 0.3 and drops 1–3 seeds; an unripe one drops 1 seed. Seeds used on any leaves start a new fruit.<br>**Rope:** climbable, no collision, needs support above, breaks in a cascade. Right-click a rope to extend it downward (upside-down scaffolding). Rope only comes from fruit growth and worldgen. | `BaobabFruitBlock`, `RopeBlock`, `RopeItem`, `BaobabSeedsItem`. br.: full; use cutout `render_type`. If we reuse RU's wood, the fruit's support check uses a tag that includes `regions_unexplored:baobab_leaves`. | fruit: 1 blockstate, 3 models, 1 texture; seeds 1; rope: 1 blockstate, 2 models, 2 textures; lang 4 | None. Name clash with Farmer's Delight's and Create's rope → "Baobab Rope". | S |
| **4. Termite mounds, hives and termites** | **Mounds:** in savannas and deserts, 1 in 50 chunks. Termite blocks in 4–5 layers up to 7×7, with about 8 hives per mound, each starting with 1–2 termites.<br>**Hives:** hold 2 termites. They leave after 30 s and work by day: each check has a 1/40 chance to walk to a log within 16 blocks and turn it into a **hollow log**. They go home at night. Breaking a hive without Silk Touch, explosions and fire release them, angry.<br>**Termite:** a 0.5×0.5 monster, 20 HP, 2 damage, no drops. | `TermiteMoundFeature` (main's doesn't compile; use 1.21.11's), `TermitehiveBlock` + block entity (rewrite the storage like 1.21.1's `BeehiveBlockEntity.Occupant`), `Termite` (`HierarchicalModel` + keyframe animation, termite_state serializer via `ENTITY_DATA_SERIALIZERS`).<br>Fix: the log-search timeout bug and the missing hive tooltip key. Biomes: `#c:is_savanna` + `#c:is_desert` (Terralith and RU). br.: not ported. | 2 blockstates, 3 block models, 5 textures; lang 4 | `TypedEntityData`, `ValueInput`/`ValueOutput`, render states → 1.21.1 equivalents. Overlap: Naturalist's ant hills in savannas (§1.6.1). | M |
| **5. Hollow logs** | A hollow version of every log: oak, spruce, birch, jungle, acacia, dark oak, mangrove, cherry, bamboo block, crimson, warped, baobab, and pale oak with Vanilla Backport. Each has a stripped version (24–26 blocks). Made by termites and fallen trees. 1 hollow log → 1 plank; an axe strips them.<br>**Storage:** each holds one full block or one small item: flowers, flower pots (it pots pottable flowers), torches, lanterns. A vertical log becomes solid with a block inside, and the log gives off the stored block's light. Water is removed unless it holds glass; shears pop the item out. | `HollowLogBlock`, `HollowLogBlockEntity`, `HollowLogType`, renderer. br.: full, with main's wrong mappings fixed. Note the id mismatch: br. uses `stripped_<wood>_hollow_log`, main `stripped_hollow_<wood>_log`; pick one. Replace the accessor with `FlowerPotBlock#getFullPotsView`. | 28 blockstates, 29 block models, no textures (vanilla ones); lang 28 | Pale oak → Vanilla Backport. Poplar → dropped. | S |
| **6. Fallen trees become hollow** | The fallen-log decorations for oak, birch, super birch, jungle and spruce use hollow logs for the trunk. | Main overrides `minecraft:fallen_*_tree`. 1.21.1 has no fallen trees, but **Vanilla Backport adds them under the same ids**, using its `minecraft:fallen_tree` feature in the 1.21.5 format. Override its five `data/minecraft/worldgen/configured_feature/fallen_*_tree.json` with hollow-log trunk providers, loading after Vanilla Backport. | 5 JSON | Fallen trees (1.21.5) → Vanilla Backport. `fallen_poplar` → dropped. | S |
| **7. Clams, pearls and pearl blocks** (rename "Pearl Clam") | **Worldgen:** warm-ocean floor, 1 in 3 chunks, 4 tries, on sand. 4 colours: regular 56%, blue 25%, pink 12.5%, purple 6.25%.<br>**Use:** right-click opens or closes it (sneak if holding an item). It holds one stack like a shelf, and a comparator reads how full it is.<br>**Loot** (fishing-style, luck 0–3 by colour): coal / pearl / heart of the sea 58.8 / 39.2 / 2.0% for regular, up to 26.8 / 65.0 / 8.1% for purple.<br>**Random ticks** (waterlogged, on sand, gravel or dirt): open and empty, it grows a stack of the block below; closed with sand inside, it eats it with a 1/16 loot chance.<br>**Redstone:** holds it open and launches entities and items on top at √signal/4.<br>**Other:** breaks by hand and keeps its contents (grid tooltip). Pearl block: 2×2 pearls. Fisherman level-3 trade: 3 pearls → 1 emerald. Drenched may carry one. | `ClamBlock`, `ClamBlockEntity` (renderer; textures on the chest atlas), `ClamType`, `ClamFeature`, loot `gameplay/clam`.<br>Port from br.:<br>• fix the missing-TOOL crash and the sand dupe<br>• a `ClamItem` for the air toggle and tooltip (no mixins)<br>• `ItemProperties` for the open state<br>• `VillagerTradesEvent`, biome modifier<br>• scope the grid tooltip to our own items<br>Biomes: `minecraft:warm_ocean` + `terralith:deep_warm_ocean` (optionally lukewarm and RU's rocky_reef). | 4 entity (chest) textures, 13 item textures, pearl block texture, 5 blockstates, 13 item models, 6 loot tables; lang 6 | Shelf sounds (1.21.9) → chiseled bookshelf sounds. Data-driven trade → event. Name clash with Naturalist's clam mob. | M |
| **8. Geysers** | In crimson forests and nether wastes, 20 tries per chunk, y 20–110, at the foot of walls. Standing on one launches you about 8 blocks up (vertical speed set to 1.2 each tick) and sets you on fire for 3 s. Light 15. Mining it without Silk Touch leaves a lava source. | `GeyserBlock`, `GeyserBlockFeature`. br.: full. Biome modifier; optionally add RU's nether biomes. | 1 blockstate, 1 model, 1 texture; lang 1 | None. Word clash with Vanilla Backport's sulfur-spring geysers (overworld). | S |
| **9. Ghost peppers and Spicy** (0.5.4) | **Shrub:** grows on soul sand or soul soil in soul sand valleys, in 32-try patches. Ages 0–4 (about 23 min to ripe). Harvest gives 1–2 peppers (+1 at age 4) and resets it.<br>**Pepper:** food 2 / 0.1 and Spicy for 10 s: your hits set targets on fire for 4 s × (level + 1). A Spicy potion is registered, but upstream has no brewing recipe for it. | `GhostPepperShrubBlock` (BushBlock), `SpicyEffect`; the `LivingEntity#actuallyHurt` mixin → `LivingDamageEvent.Post`; a `random_patch` feature; optional `RegisterBrewingRecipesEvent`. | 1 blockstate, 5 models, 6 textures + effect icon; lang 3 | `VegetationBlock`, CONSUMABLE, `block_interact` loot, offset placement → 1.21.1 forms. Pack: Farming and Brewing gates. | S |
| **10. Ocean illager patrols** | Patrol checks keep vanilla timing. Over `#is_ocean` there is a 1/3 chance (instead of 1/5) of a boat patrol, if no raider is within 100 blocks and a 16×6×16 box is all air and water.<br>**Fleet:** ceil(effective difficulty) + 1 boats (Easy 2–3, Normal 3–5, Hard 4–8), all one wood.<br>**Captain:** a Huge boat on Hard, otherwise Big, with an ominous banner, 1–3 pillagers and a chest (`chests/patrol_boat`): always a Boat Upgrade Template and an ominous bottle, plus a crossbow, food, logs, XP bottles, arrows, iron, an enchanted book and a goat horn.<br>**Escorts:** vanilla boats with 1 pillager.<br>**Steering:** raiders steer boats toward targets or patrol points (the captain picks points within 50 blocks).<br>**Global:** every pillager gets crossbow range 8 → 12 and hold-ground 10 → 15. | Main: `PatrolSpawnerMixin`, `RaiderMixin`, `MobMixin`, `PillagerMixin` + the boat mixins.<br>Port:<br>• our own `CustomSpawner` through **`ModifyCustomSpawnersEvent`**; F&F and Illager Invasion both mix `PatrolSpawner`<br>• raider steering in `EntityTickEvent.Post`<br>• no `MobMixin` (our spawner skips that check)<br>• the pillager range change through goals in `EntityJoinLevelEvent` (optional, it's global) | `patrol_boat` loot table (boats are in Stage 2) | `EntitySpawnReason` → `MobSpawnType`; ominous banner helper name | L (needs Stage 2 boats) |
| **11. Pyrotechnist village houses** | One pyrotechnist house per village type (plains, desert, savanna, snowy, taiga; about 2–3% per house roll), with the table, a bed, chests (`chests/village/pyrotechnist_loot`) and an upward dispenser full of rockets. | Main **overwrites** the 5 vanilla `village/*/houses` pools (weight 2).<br>Port:<br>• Lithostitched `add_template_pool_elements` modifiers<br>• **convert the 5 NBTs**: they are 26.x (DataVersion 5023, palette `id`/`properties`); 1.21.1 needs `Name`/`Properties` and DataVersion 3955, plus remapped ids. The `structures/` bake toolkit can re-save them.<br>Pack: Luki's replaces all five vanilla villages, so these pools never generate there. Add the house to Towns and Towers' house pools too, or just place pyrotechnics tables in our towns. Owner choice. | 5 structure NBTs, 2 loot tables | 26.x structure format → convert | M |
| **12. Wildfire boss** (§1.6.1: keep F&F's; name ours differently) | **Stats:** a blaze-like boss with 150 HP, then another 150 in its soul phase. Speed 0.5, follow range 48. Immune to fire, lava and falls; 5× freeze damage; hurt by water and rain; snowballs deal 3.<br>**Shields:** clamp(floor(5·HP/max), 0, 4). While it isn't attacking, arrows, tridents and wind charges bounce off with chance shields/4. It heals 1 HP/s in fire and rests at fire between attacks.<br>**Attacks:**<br>• fireball volley: 40 t charge, about 10 fireballs, +2 projectile damage<br>• spinning-shield melee (only with 2+ shields): 4 damage every 4 t within 1.5 blocks; leaves fire<br>• jump to the room centre, then 6 fire bombs: power-1 explosions that never break blocks but start fires<br>**Soul phase:** on the first lethal hit it revives (totem effect) as a soul-fire Wildfire with faster attacks: fireballs every 2 t, melee 6, up to 10 bombs. Boss bar.<br>**Drops** (player kill): Heart of the Nether or the Jewel trim template (50/50), plus 50 XP. | `WildfireEntity`, `WildfireAi` (Brain), 5 tasks, a sensor, `FireBomb`; mixins for the revive (`checkTotemDeathProtection`), `LongJumpUtil` gravity, `SmallFireball` damage, `Snowball` damage.<br>Port:<br>• Brain modelled on 1.21.1's `BreezeAi` (every memory it uses exists in 1.21.1); SensorType DeferredRegister<br>• revive via `die()`/`hurt` overrides<br>• copy the LongJumpUtil maths; a `SmallFireball` subclass<br>• `HierarchicalModel` renderer; soul flames via `displayFireAnimation`<br>• spawn egg<br>br.: not ported. | 2 entity textures (default, soul), spawn egg; lang 2 (all sounds are vanilla) | 26.x Brain and entity APIs → 1.21.1 equivalents | L |
| **13. Wildfire arena and the Bad Omen fight** | **Arena:** main turns the fortress "lava well" room into a 17×15×17 arena: magma floor, plus-shaped lava, 4 corner braziers, and a trial spawner under the lava. It spawns 1 Wildfire when a player within 14 blocks can see it, and ejects nothing.<br>**Bad Omen:** with Bad Omen or Trial Omen (15 min per level), the spawner turns ominous: 2 Wildfires plus ominous item drops. After both die, each player gets a Heart of the Nether, a Netherite Scrap and a Crown Smithing Template. Then a 30-minute cooldown (vanilla trial-spawner defaults). | Main: mixin on `NetherFortressPieces$CastleEntrance` (`createPiece`, `addChildren`, `postProcess`) + 2 trial-spawner configs + loot tables.<br>Port: 1.21.1 has no `trial_spawner` registry, so write `normal_config`/`ominous_config` inline in the spawner's NBT.<br>**YUNG's Better Nether Fortresses disables vanilla fortresses in our pack, so the mixin target never generates.** Options:<br>(a) build the arena with our `structures/` toolkit and inject it into YUNG's fortress pools (keep or halls) with Lithostitched<br>(b) a standalone Nether structure (own structure set)<br>(c) turn vanilla fortresses back on (not recommended)<br>Recommend (a) if a 17×15×17 piece fits YUNG's jigsaws, otherwise (b). | none (vanilla blocks); 2 loot tables | Trial-spawner registry (1.21.5) → inline NBT | M |
| **14. Wildfire rewards**: Heart of the Nether, Wildfire Shield and Trident, Jewel trim, Crowns | **Heart of the Nether** (a smithing template): Heart + shield + netherite ingot → **Wildfire Shield**:<br>• vanilla shield stats; rare, fireproof, repaired with netherite; soul texture at half durability<br>• blocking a melee attacker sets it on fire for 1 s, or 3 s + knockback when you're at 6 HP or less<br>Heart + trident + netherite ingot → **Wildfire Trident**:<br>• durability 1000; riptide also works while you're on fire<br>• flame trail; sets targets on fire for 3 s<br>**Jewel armour trim:** template from the Wildfire; copy with 7 diamonds + a blaze rod.<br>**Crowns:** Crown Smithing Template (from the Bad Omen fight; copy with diamonds + gold) + a helmet + a Heart → Iron / Golden / Diamond / Netherite Crown. Same stats as that helmet; cosmetic and trimmable.<br>All rewards are fire- and explosion-proof. | `WildfireShieldItem`, `WildfireTridentItem`, `WildfireTrident` entity; the `LivingEntity#blockUsingItem` mixin → `LivingShieldBlockEvent`; item renderers via BEWLR with vanilla `ShieldModel`/`TridentModel`; trim pattern data with `template_item`; crowns as `ArmorItem` with vanilla materials + `getArmorTexture` + trim overrides (40 models). | Heart 1, shield 2 entity textures, trident 2, jewel trim 3 (+ atlas entry), crowns 6 item + 8 layer textures, about 60 models; lang about 15 | Copper crown (copper helmet, 1.21.9) → dropped. Resin trim material → Vanilla Backport. BLOCKS_ATTACKS / WEAPON / DAMAGE_RESISTANT → `ShieldItem` / `TridentItem` + `canBeHurtBy`. Pack: Smithing CRAFT gates; Attack and Defence gates; names next to F&F's Wildfire Crown and our Ember Crown. | M |

---

## 5. Features to leave out (and why)
1. **Spear dispenser trap.** Spears are 1.21.11 content; neither Vanilla Backport nor any other pack mod adds them. A possible replacement is a "weapon trap" where swords, axes or tridents attack through a FakePlayer (M), if wanted.
2. **Pillagers spawning with spears**, and the illager spear pose. Same reason.
3. **Spear "lunge" glass smashing** (undocumented): sprinting into glass or ice with a spear smashes it. Same reason.
4. **Dismount enchantment** as designed: it only goes on `#spears`. Retargeting it to tridents with a custom enchantment entity effect calling `stopRiding`/`ejectPassengers` is S, if the owner wants it.
5. **Copper-armour lightning buff and the "lightning magnet":**
   - Struck players get Speed N for 3N s and Instant Health N.
   - Thunderstorms aim at players wearing copper.

   Copper armour is 1.21.9. Create's copper diving gear could stand in through a tag, but that is effectively a PvP lightning weapon, so it's the owner's call.
6. **Copper crown:** the copper helmet is 1.21.9. The other four crowns stay.
7. **Copper-torch sconce on the goat horn:** the copper torch is 1.21.9.
8. **Baobab shelf:** shelves are 1.21.9. The clam's shelf sounds get substitutes.
9. **Drenched riding nautiluses:** the nautilus mob is 1.21.11.
10. **Cushions in the 4 dyes:** cushions are a 26.x vanilla entity.
11. **Wool and concrete slabs/stairs in the 4 dyes (16 blocks):** these extend 26.x vanilla families. On 1.21.1 they would be the only coloured wool and concrete slabs. (The spotted wool slabs/stairs don't depend on them and stay in Stage 1.)
12. **Poplar hollow logs, Big/Huge poplar boats, the fallen poplar tree:** poplar is a 26.x wood.
13. **Goat milking with a cooldown.** It is on the wiki, but no branch, and no commit in the 900-commit history, has any code for it. It's a 1-hour add (S) if wanted, but it isn't part of the mod.
14. **Goat-horn helmets** (7 tiers): upstream work in progress, never registered.
15. **26.x / 1.21.2+ data formats**, re-implemented rather than ported:
    - data-driven villager trades and trade sets
    - trial-spawner configs
    - `block_transformer`
    - the `worldgen/feature` folder
    - item model definitions and equipment assets
    - `crafting_transmute`
16. **The Cloth Config / ModMenu screen:** client-only, never saved; replaced by `ModConfigSpec`.
17. **Alternate Current compatibility:** only a stub upstream, and the mod isn't in the pack.
18. **Datagen-only and dead code:**
    - `TrimPatternMixin`, `EquipmentAssetProviderMixin`
    - the goat-horn "village particles" in `ItemMixin`, and the magma "1-in-5" branch
    - `enchantment_effect/*.json`, the `pig_crown` texture, the unused crown `equipment` JSON, the stray `gold_crown.json`
    - `bugs.txt`
    - the stray `sulfur_lantern` translation key (5 languages; no such block)
    - 11 unused access-widener entries
19. **Vanilla overrides done the risky way**, kept in function but implemented safely (§1.3, §1.6.3):
    - overwritten village pools
    - barrier/air recipe results
    - the global container tooltip and shulker-text removal
    - the every-bow arm pose
    - the dimension-wide horn glow
    - the "Turtle Headgear" rename (optional)
    - the plain-arrow pickup (owner's call)
20. **Ectoluminescence**, merged only into the unreleased 1.21.1 branch. It is a separate MIT mod by Technicman69, not Nekoma's Fixed. It adds:
    - glowing or hidden-cloth banners and signs, glowing decorated-pot sherds, banner effects on shields
    - glowing sheep
    - animated "echoing" armour trims
    - clear item frames
    - 6 sounds, GlowInkPlus and JEI hooks

    Port it separately if wanted, with its own MIT notice. The branch doesn't include that notice.

---

## 6. Credits and licence
- **Licence:** Nekoma's Fixed is MIT-licensed (`LICENSE` in all three branches). The copyright line reads exactly `Copyright (c) [2025] [Joshua Baikie]`; the brackets are in the file. The MIT terms: anyone may use, copy, modify, merge, publish, distribute, sublicense and sell copies. The **copyright notice and permission notice must be included in all copies or substantial portions**, and the software is provided "as is", without warranty.
  - **What we must do:** ship the full MIT text with that copyright line in our jar, as `META-INF/licenses/nekomas-fixed-LICENSE.txt` or in our mod's own licence file. Keep it in `mods-src/lsp-nekoma/`.
  - **Textures:** VelocyBlue's textures are part of the MIT repository, so the same notice covers them.
  - **Vanilla-derived art:** the overridden `minecraft:` textures (armour-stand wood, minecart, turtle layers) are derivatives of Mojang assets, as usual for mods.
- **Credits list** (the mod's wiki):
  - Nekoma: ideas and original videos (YouTube @Nekoma7)
  - Green_Jab: owner and lead developer
  - CyberModder: developer
  - Akshaj: developer
  - VelocyBlue: textures
  - Gear: developer
  - Engholm: developer (contributor)
- **Also credited:**
  - `readme.md`: "Based on the ideas of Youtuber Nekoma" (Developers CyberMODDER, Gear, Akshaj, engholm; Textures velocyblue).
  - `fabric.mod.json`: author Green_Jab.
  - The 1.21.1 backport we build on: Strikey5852.
  - Git authors: cybersage005-netizen, joshua, Strikey5852, kesavan17, Ethan, AkshajxGit, VelocyBlue, Technicman, CyberModder.
- **Presentation:** call ours an unofficial NeoForge port inside LemurSaucePacket (for example "LemurSaucePacket: Nekoma's Fixed"), credit the team and Nekoma in the mod description and on its wiki page, and don't use their branding as our own.
- **If Ectoluminescence is ever ported:** add its own MIT notice (Technicman69).
