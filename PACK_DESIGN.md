# LemurSaucePacket: pack design

Why the pack is built the way it is. The README covers how to run it.

## Pillars

1. **Create is the spine.** Every stage of progress runs through Create machines. Other mods either feed Create (ore veins, crops, coins) or give it a reason to exist (structures to reach, a server economy, airships to fly). There are no tech mods that compete with Create (no Mekanism, no AE2) and no magic mods.
2. **It still feels like Minecraft.** The vanilla crafting grid, vanilla mobs and biomes, vanilla screens (re-skinned in one brass-and-iron kit, not replaced). Mods enhance these rather than replace them. New mobs, biomes and structures look like things Mojang could have added.
3. **Exploration has a purpose.** Structures are built from Create blocks and hold Create parts. Infinite ore veins are something to find and claim. The Atlas and Banners quest chapters pay for going out and looking.
4. **A fair SMP.** PvP is on, so the rules protect builders:
   - no land claims (the owner's call): what you build is yours to defend, so bases go where you can watch them;
   - graves for your items;
   - no minimap radar or cave maps;
   - backpacks that don't replace chests.
5. **It runs well.** Client performance mirrors [Fabulously Optimized](https://modrinth.com/modpack/fabulously-optimized), and the server stays light enough for a home PC.

## Progression: the quest book

FTB Quests, built from `quests/book.mjs`. Quests never lock content; they're a road map that pays out in Numismatics coins and XP. XP is 10 plus the coin value, tripled for milestones: 10 to 3,102 XP a quest, about 12,400 over the whole book. Progression mode is *flexible*: a biome visited early still counts later, so no one has to repeat exploration.

**The Ages** (the main line)

| Chapter | What it covers | Milestone |
|---|---|---|
| Landfall | Rules, first tools, first backpack, a village | A wrench |
| First Rotation | Andesite age: water and wind power, presses, fans, belts, contraptions, zinc, ore veins | 32 andesite casing |
| Brass Age | Blaze burners, mixing, brass, precision mechanisms, arms, crafters, steam, electricity | Rotation speed controller |
| Banners of the Overworld | Outposts, raids, the Illager fort and Invoker, Create ruins (lost station, sky-pirate airship, quarry, castle) | Raise your banner |
| Iron Roads | Track, stations, schedules, signals, departure boards, parcels, stock keeping, factory gauges | Connect two towns |
| Skyward | Create Aeronautics: propellers, envelopes, burners, levitite, steering | Maiden voyage |
| Crown of Fire | Fortresses, bastions, piglin castes, blaze cakes, netherite | The Wither |
| Legacy | Stronghold, the End, the dragon, elytra, enchantment industry, crushing wheels, banking | Build your legacy |

**Field Guides** (side books): Backpack Workshop, Homestead (Farmer's Delight, Slice & Dice, happy ghast), Bestiary, Atlas (15 biomes and structures), and Coin & Commerce.

Each chapter opens with a painted crest and an info card. The card says what the chapter is for and what it unlocks (Bestiary and Atlas list their rewards instead). The lemur mascot and the chapter crests come from one Higgsfield sheet (see the README).

## Progression: RuneScape-style skills

The server owner asked for a full RPG layer in the style of RuneScape, combat stats included. Project MMO runs it, configured from `skills/build.mjs`.

**Levels.** There are 13 skills, each levelling 1–99 on RuneScape's own XP table: level 50 takes 101,333 XP and level 99 takes 13,034,431. XP comes from doing the thing:
- Combat: 4 XP per point of damage to the style used, as in RuneScape.
- Mining and woodcutting: ores (scaled by rarity), stone and logs.
- Farming: harvests.
- Fishing: catches.
- Cooking: food from furnaces and smokers, and bread, pies and stews.
- Smithing: ingots, and crafted tools or armour.
- Crafting: anything crafted.
- Agility: sprinting and jumping.
- Quest XP is vanilla XP and doesn't count towards skills.
- Create's machines earn nobody skill XP.
- Deaths cost no skill XP.

| Skill | What it does |
|---|---|
| Attack | Needed to wield weapons. Adds melee damage (+0.04 per level, +2 at 50) and bow or crossbow damage (+0.4% per level) |
| Strength | Melee crit chance, 0.3% per level (15% at 50): 1.5× damage |
| Ranged | Ranged crit chance for arrows, tridents and rockets, 0.3% per level: 1.5× damage |
| Defence | Needed to wear armour. +0.02 armour per level |
| Hitpoints | +1 heart per 10 levels. Deliberately expensive: Hitpoints earns a third of normal XP, and only in combat |
| Mining / Woodcutting / Farming | Needed for pickaxes and shovels, axes, and hoes. +0.5% dig speed per level with the matching tool |
| Fishing, Cooking, Smithing, Crafting | XP and level-up rewards |
| Agility | Needed to wear an elytra (30). Up to +10% speed and −50% fall damage |

**Level requirements**, the way RuneScape gates its metals:

| Tier | Level |
|---|---|
| Wood, leather | 1 |
| Stone | 5 |
| Gold, chainmail | 10 |
| Iron | 15 |
| Diamond | 30 |
| Netherite | 50 |

- The tier level applies to swords, axes, pickaxes, shovels and hoes, each gated by its own skill, and to armour, gated by Defence.
- Crossbow needs Attack 15, the Create potato cannon Attack 20, trident Attack 40 and mace Attack 50.
- Create's diving gear needs Defence 5 (copper) or 50 (netherite), and the turtle shell Defence 20.
- A weapon you can't wield does fist damage. Armour or a sword you're not skilled enough for gives Slowness or Weakness while worn or held.
- Tooltips show the requirement.

Every 10 levels sets off fireworks and lists what the new level unlocks. Crits are rolled in `kubejs/server_scripts/skills.js`, which also switches off Project MMO's "builtin/default" datapack. That datapack would add requirements for Project MMO's own skills.

**Missions.** Create: Brassworks Missions gives each player six random missions a week, many of them Create jobs such as pressing, mixing or crushing. Each pays 5–12 bevels (40–96 coins), so a week's missions are worth roughly 250–575 coins.

**Dungeons.** When Dungeons Arise adds 30+ large dungeons. Its loot includes three enchantments of its own. Lootr gives every player their own copy of each loot chest, so nobody gets beaten to one.

**The ESC menu is a hub** (see "Look and feel" below for how it's drawn).
- **Adventure panel:** Map, Quests, Missions, Waypoints, and where you are (coordinates, time, biome).
- **Player panel:** your character, Skills (the inventory's skills panel; item tooltips show what each level needs), Backpack, Team, Voice.
- **Game Menu panel:** every vanilla and mod button, moved in but never removed; "Options" reads "Settings".
- It's a FancyMenu layout (`config/fancymenu/customization/lemursaucepacket_pause.txt`, written by `art/hub.mjs`). Its buttons press the matching keys, so the pack sets a key layout without clashes:
  - `options.txt` for new installs;
  - `kubejs/client_scripts/keybinds.js`, which moves keys once on existing installs, only where a key is still on a default that clashes.
- Keys:

  | Key | Opens |
  |---|---|
  | M | Map |
  | H | Missions |
  | E | Skills (inventory panel) |
  | B | Backpack |
  | ; | Team |
  | U | Waypoints |
  | V | Voice chat |

## Gear: SkyBlock-style items, Create-made

The pack has its own line of gear (`gear/gear.mjs`; the player-facing version is `docs/gear.md`), built so it never overlaps the Relics mod, which covers trinkets and single-purpose accessories:

- **Armour sets** with a theme, per-piece stats, single-piece perks that work alone (a helmet with a headlamp, boots that cancel fall damage) and a **full-set bonus**. Some sets have a **synergy** with one Relics item, roguelike-style: the set plus that relic is stronger than either.
- **Weapons** with real stat lines (damage, attack speed, crit chance, crit damage, knockback) that plug into the skills' crit roll.
- **Utility tools** that each remove one tedious job: the Lumber Axe (FallingTree, whitelisted to this one item), the Excavator's 3×3, the Prospector's auto-smelting pickaxe, the Harvester's Scythe, the Builder's Wand.
- **Nothing is easy or infinite.** Recipes are Create mechanical crafting and compacting with brass, sturdy sheets and precision mechanisms; every piece has a Project MMO level gate; the best pieces are **loot-only** (LootJS) or need a loot-only pattern.
- Tooltips carry the stats and a "How to get" line, JEI has the same text on each item's information page (KubeJS 7 registers it through `RecipeViewerEvents.addInformation`, not the old `JEIEvents`), and the quest book's *Armory* chapter walks players through the line.

Rules for adding gear: one clear job per item, no duplicate of a Relics purpose, and always add the quest, the "How to get" tooltip/JEI text and the wiki row (the build does the last two from `howToGet`).

The same idea covers the other mods' loot: `publish/sources.mjs` reads every mod jar's loot tables (and Relics' code) and writes a "Found in …" JEI information page and tooltip line for each loot-only modded item, plus `docs/where-to-find.md`, so JEI, the tooltips and the wiki answer "where do I get this?" for the whole pack. Run it by hand after adding or removing mods; its output is committed.

## Capes: earned, never crafted

Capes are cosmetics with a story (`capes/capes.mjs`; players read `docs/capes.md`). They are unlocks, not items, so they can't be traded, lost or duped:

- **Skill capes** at level 99, one per skill, each with a small perk (crit, armour, luck, speed, mending, extra XP).
- **Quest capes** for finishing a chapter: the chapter's last quest runs `lsp cape flag {p} chapter:<key>`.
- **Achievement capes** for vanilla feats (Adventuring Time, Hero of the Village, a full beacon, an elytra).
- **Legendary capes**, animated: every skill at 99, every chapter done, the dragon killed.
- **The Lemur Cape**: the owner's, by command.

How it works: the server keeps who unlocked and wears what (persistent data, `/capes` wardrobe, `/lsp cape` admin commands) and tells every client who wears which cape; the client script gives each player a texture slot through CapeJS and swaps the texture behind it, frame by frame for animated capes. Art: two Higgsfield sheets of cape fronts, composed into Minecraft's cape layout at 8× by `art/process.mjs`, with generated shimmer frames.

## Look and feel: one kit everywhere

Everything a player looks at outside the world — the launcher, the loading screen, the title screen, the ESC menu, the options screens, the quest book, the skills screen — is built from one kit, so it reads as one designer's work:

- **Materials:** dark riveted iron plates, polished brass bands with corner rivets, parchment text, amber for hover. The palette is sampled from the logo (`art/pixel-kit.mjs` has the hex values).
- **Widgets:** the pack replaces the vanilla button, slider, tab, text field, checkbox and scrollbar sprites and the menu backgrounds with pixel-drawn brass versions (a resource pack in `kubejs/assets`). Anything that uses vanilla widgets — the options screens, FTB Quests, most mod screens — inherits the look. The launcher draws its buttons, fields and cards from the same sprites at 3×.
- **Icons:** the ESC menu, the launcher pages and the 13 skills use icons painted in the same style as the quest emblems (Higgsfield sheets in `art/generated`), so the quest book, the skills screen and the menu share symbols (the quest book's book, the backpack, the atlas).
- **The ESC menu** is a riveted board with three recessed panels: *Adventure* (Map, Quests, Missions, Waypoints, plus where you are), *Game Menu* (the vanilla pause buttons, moved into the panel; "Options" is renamed "Settings") and *Player* (your character, Skills, Backpack, Team, Voice). Buttons added by other mods land in free slots or a tray under Disconnect, so nothing disappears. The vanilla "Game Menu" title is blanked through a language override.

Not skinned, on purpose: inventories and machine GUIs (Create's own look is part of the pack's identity), Brassworks Missions, Xaero's map screens and JEI. They sit inside the brass-framed screens rather than fighting them.

## Balance

**Sophisticated Backpacks: useful, not a chest replacement**
- Each tier is crafted from its age's Create parts:
  - copper: copper sheets and andesite alloy;
  - iron: iron sheets and andesite casing;
  - gold: golden sheets and brass casing;
  - diamond: diamonds and precision mechanisms.

  So backpacks follow Create progress instead of skipping it (`pack/kubejs/server_scripts/backpacks.js`).
- Slots are about two thirds of the defaults (leather 18 up to netherite 90), with 1–4 upgrade slots.
- Upgrades only run on the backpack worn in the Curios back slot. Carrying more than 3 backpacks slows you down.
- At most one stack upgrade per backpack, and only up to tier 2 (4×). Tier 3, tier 4 and omega are disabled.
- Disabled upgrades:
  - inception (backpacks in backpacks);
  - pump, battery and mob catcher, because Create does those jobs;
  - infinity.
- No backpacks in loot chests or on mobs. Magnet range is 4. XP pump mending is off.
- Create Backpack Upgrades adds a pressing and a mixing upgrade that run Create recipes inside the backpack, without rotational power. This was the server owner's call. Their recipes need the real machines: a mechanical press, depot and brass casing, or a mixer, basin, fluid tank and blaze burner. So they're a Brass-age convenience rather than a way around building the machines.

**Ore veins (Create Ore Excavation):** veins are infinite and hidden per chunk, which gives prospecting a purpose. Diamond, emerald and netherite veins are removed, because infinite diamonds would flatten both progression and villager trading (`ore_veins.js`).

**Travel:** no waystones and no teleport commands. Distance is solved with trains, airships, horses and the happy ghast. That keeps the rail network, the Iron Roads chapter and airships meaningful.

**PvP fairness:**
- Xaero's minimap and world map run in fair-play mode (no entity radar, no cave maps), enforced by Xaero's server profiles in `pack/config/xaero/*/server_profiles/`.
- No land-claim mod, by the owner's decision; graves and the rules in the Landfall chapter are the safety net.
- Gravestone keeps your items where you died.

**Economy:** quest rewards are Numismatics coins (spur 1, bevel 8, sprocket 16, cog 64, crown 512, sun 4096), not items. Coins buy things from other players' shops, so progress feeds trade instead of skipping it.

## Mods by role

**Create and its family:**
- Create
- Create Aeronautics (with Sable)
- Crafts & Additions
- Create Enchantment Industry
- Create Deco, Copycats+, Create: Connected
- Railways Navigator
- Numismatics
- Farmer's Delight with Slice & Dice and Central Kitchen
- Create Ore Excavation
- Sophisticated Backpacks' Create integration, and Create Backpack Upgrades (pressing and mixing upgrades)
- KubeJS with KubeJS Create

**Worldgen and structures:**
- Terrain and biomes: Terralith, Tectonic, Lithostitched, Nullscape.
- New trees: Regions Unexplored. It adds about 18 woods, among them maple, redwood, willow, magnolia, baobab, cypress and blackwood, in forests that turn up between Terralith's biomes. In a 1,600-point sample of the biome map, about 7% was Regions Unexplored, 31% Terralith and the rest vanilla, mostly ocean. It's by the author of Tectonic and Lithostitched, and version 0.6 places its biomes through Lithostitched.
- Structures: YUNG's (11 mods), Structory and Structory Towers, Towns and Towers, Dungeons and Taverns.
- Create-built structures: Create: Structures Arise, Let the Adventure Begin, Rustic Structures.
- Support: Sparse Structures keeps structures from crowding, and Structure Layout Optimizer keeps generation fast.

**Vanilla+ mobs:**
- Friends & Foes, Naturalist, Creeper Overhaul, Variants & Ventures
- Illager Invasion, Piglin Proliferation, Guard Villagers
- Vanilla Backport (happy ghast, pale garden, creaking), with its compatibility patch

**SMP:** Simple Voice Chat (proximity voice), Gravestone, Xaero's Minimap and World Map, FTB Quests (with FTB Library and Teams).

**RPG layer:** Project MMO (skills), Create: Brassworks Missions, When Dungeons Arise, Lootr, Relics (with OctoLib and Curios), LootJS (loot-only gear), FallingTree (the Lumber Axe), CapeJS (capes), Patchouli (the in-game guide), Sable Assembly Fix.

**Look and feel.** Minecraft Legends is a third-person strategy game with chunky, painterly visuals. The pack moves toward that without leaving Minecraft's look:
- Animation: Fresh Animations (with EMF and ETF), Not Enough Animations.
- Camera: Shoulder Surfing, where F5 gives an over-the-shoulder camera, first person by default.
- Atmosphere: Subtle Effects, Particle Rain, Falling Leaves, Visuality, AmbientSounds.
- Players: Wavey Capes, 3D Skin Layers, dynamic lights.
- Interface: Legendary Tooltips, and a painted title and loading screen made with FancyMenu and Drippy.
- Shaders: Complementary Reimagined with Iris, off by default and one toggle away in the launcher.

**Information:**
- JEI with Create JEI Compat (paged sequenced-assembly recipes), JEI World Gen (ore heights), Just Enough Professions, Just Enough Breeding and JEED.
- Jade with Jade Addons.
- Create: Cyber Goggles (exact numbers when wearing goggles).
- Enchantment Descriptions, Better Advanced Tooltips, AppleSkin.

**Building:**
- Macaw's Furniture: chairs, tables, desks, counters, wardrobes.
- Woodworks: vanilla-style chests, bookshelves, ladders, beehives and boards in every wood, plus a sawmill.
- Every Compat makes each wood in the pack available for:
  - those two mods;
  - Create's windows;
  - Farmer's Delight's cabinets.

  It adds about 1,700 blocks for Regions Unexplored's woods.

**Quality of life:**
- Sorting: Sophisticated Inventory Interactions adds sort, sort-mode, search and transfer-all buttons to chests, barrels, shulker boxes and your own inventory, matching the backpacks' controls.
- Mouse Tweaks, Inventory Essentials, Searchables, Shulker Box Tooltip.
- Just Zoom, Controlling, Chat Heads, and Controlify (controller support, off by default).

**Performance.** These mirror Fabulously Optimized where NeoForge builds exist:
- Rendering: Sodium, Sodium Extra, Reese's Sodium Options, ImmediatelyFast.
- Culling: Entity Culling, More Culling, Better Block Entities, Sodium Shadowy Path Blocks.
- Game logic and memory: Lithium, FerriteCore, ModernFix, BadOptimizations.
- Idle and input: Dynamic FPS, Ixeris.
- Create-specific: Create NoWheel.
- Server: Clumps, Packet Fixer, spark (profiling), Chunky (pre-generation).
- Support: Crash Assistant, NetherPortalFix.

Launcher toggles: 18 client mods are optional on the launcher's Mods page. Shaders, first-person model and controller support start off; everything else starts on.

## Deliberately left out

- **Seamless portals.** Immersive Portals' official NeoForge build conflicts with Sodium 0.8 and Sable. The community fork (Immersive Portals CE 6.0.9, built for Sable 2.0.5) was tested and then dropped at the server owner's call.
- **Waystones and teleport commands:** see *Travel* above.
- **EMI:** the Create-specific JEI add-ons (Create JEI Compat, JEI World Gen) are JEI-only.
- **OptiFine:** incompatible with this stack. Sodium, Iris, EMF and ETF cover what it did.
- **Quark, Supplementaries and similar big content mods:** they change the vanilla feel more than they add to a Create server.
- **Create Aeronautics Structures** (beta, an undeclared dependency, and a login message it sends by default) and **villager mods that sell Create parts**: they undercut exploration and progression.
- **Diamond, emerald and netherite ore veins:** see *Ore veins* above.

## Fixes shipped in the pack

`pack/kubejs/server_scripts/fixes.js` restores recipes that ship broken in mod jars:
- Piglin Proliferation 2.0.16's ten fire-ring recipes are empty stubs; they're restored from the mod's 1.20.6 sources.
- Create Deco 2.1.3's "wash a placard with white dye" recipe uses an ingredient format 1.21 rejects.

Remove an entry when the mod fixes it upstream.

**Sable Assembly Fix** closes an airship duplication exploit.
- When Sable 2.0.5 assembles blocks into a ship, it copies each block entity onto the ship, then removes the original block.
- Block entities that don't implement Minecraft's `Clearable` keep their contents, so the removed original drops them too.
- Tested in this pack, that duplicated items on weighted ejectors, mechanical arms and andesite, brass and copper table cloths.
- Backpacks, Numismatics vendors, vaults, toolboxes, copycats and the other storage blocks tested were already safe.
- The mod clears every such block entity first. It crashes at startup, rather than failing silently, if a Sable update moves the code it patches.
- Sable's own `sable:silent_assembly_removal` block tag is the fallback if the mod ever lags behind Sable.

## Known quirks

- **Harmless log errors:**
  - Create: Connected and Create Enchantment Industry loot tables for blocks from mods that aren't installed;
  - a Sable physics tag that names a block from another mod;
  - two advancements a mod adds under the minecraft namespace (`give_quest_trader_trade`, `wander_add_map`);
  - the broken recipe files that `fixes.js` replaces (the jars still contain them; the replacements load fine).
- **Create trains through Nether portals:** trains can cross them, but riders can get kicked. Send freight across unmanned (the Iron Roads chapter says so).
- **Chat verification toast:** it only appears on offline-mode test servers.
- **Project MMO's glossary is off-limits** (its key is unbound and nothing links to it). Opening it builds every section on a thread pool and registers a `textures/biome/<id>.png` texture per biome off the render thread; with Terralith, Regions Unexplored and Nullscape that's hundreds of missing textures racing the texture manager, and Sodium crashes (`DynamicTexture cannot be cast to TextureAtlasAccessor`). PMMO 2.10.47 is the latest at the time of writing. The skills panel in the inventory is the skills screen; item tooltips show level requirements.

## Credits

- **[Fabulously Optimized](https://github.com/Fabulously-Optimized/fabulously-optimized)** (BSD-3-Clause), whose mod selection the performance list mirrors with NeoForge builds.
- Every mod author in the pack; the launcher's Mods page links each mod's Modrinth page.
- Art generated for this pack with Higgsfield (GPT Image 2.5).
