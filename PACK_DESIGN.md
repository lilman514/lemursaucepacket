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

FTB Quests, built from `quests/book.mjs`: 29 chapters and about 435 quests. Quests never lock content; they're a road map that pays out in XP, Gold Coins and loot. Every quest has a **tier** (1 Settler, 2 Engineer, 3 Artisan, 4 Master, 5 Legend) that sets its XP (25 to 1,000), its coins (80 to 5,120) and one roll on the tier's reward table (`reward_tables/*.snbt`: ingots and torches at tier 1, cogs and casings at 2, brass and precision mechanisms at 3, enchanted books, relics and gear tools at 4, loot-only gear, waystones and netherite at 5), so a hard quest pays like one. Chapter finales add a fixed prize (a gear piece, a relic roll, a warp stone, a cape flag) so the whole line is worth finishing. Objectives are the mods' real advancements wherever one exists, not checkmarks. Progression mode is *flexible*: a biome visited early still counts later, so no one has to repeat exploration.

Beyond the Ages below: **Industry** (Factory Floor, Railway Company, The Foundry, The Enchanter, Arcane Works, The Warehouse, Grand Kitchen), **Expeditions** (Cartographer, Deep Dark, Beyond the Dragon, Village Life, Relic Hunter with all 20 relics and collector quests), **Field Guides** (Backpack Workshop, Homestead, Bestiary, Atlas, Commerce, Armory, Hearts & Graves) and **Mastery**: a *Skills* chapter with every skill's 10/25/50/75/99 milestones and a total-level ladder up to Maxed, plus *Contracts* for Brassworks missions. Milestones are custom tasks completed by `server_scripts/quest_milestones.js` (every 10 s, and after login) from Project MMO levels, with per-skill prizes at 50 and 75 and a relic, 40,000 coins and Hoard rolls at 99.

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

**Missions.** Create: Brassworks Missions gives each player six random missions a week, many of them Create jobs such as pressing, mixing or crushing. Each pays 5–12 Coin Pouches (`rewardItem = lsp_fixes:coin_pouch`; a pouch opens into 100 coins and rerolls cost pouches), so a week's missions are worth roughly 3,000–7,000 coins. Missions assigned in the Numismatics days saved bevels: the `brassworksmissions.ActiveMissionMixin` loads those as the same number of pouches, because an empty reward stack made Brassworks disconnect the player on join.

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
- **Utility tools** that each remove one tedious job: the Lumber Axe (FallingTree, whitelisted to this one item; `forceToolUsage` stays off, or nothing else could break a log, not even a fist), the Excavator's 3×3, the Prospector's auto-smelting pickaxe, the Harvester's Scythe, the Builder's Wand.
- **Nothing is easy or infinite.** Recipes are Create mechanical crafting and compacting with brass, sturdy sheets and precision mechanisms; every piece has a Project MMO level gate; the best pieces are **loot-only** (LootJS) or need a loot-only pattern.
- Tooltips carry the stats and a "How to get" line, JEI has the same text on each item's information page (KubeJS 7 registers it through `RecipeViewerEvents.addInformation`, not the old `JEIEvents`), and the quest book's *Armory* chapter walks players through the line.

Rules for adding gear: one clear job per item, no duplicate of a Relics purpose, and always add the quest, the "How to get" tooltip/JEI text and the wiki row (the build does the last two from `howToGet`).

JEI hides what can't be obtained in survival (1.4.1, `kubejs/client_scripts/jei_hidden.js`, 421 items). These are spawn eggs, operator and creative items, technical blocks, and items whose only source this pack switches off (configs, scripts). The list came from a check of every recipe, loot table, loot modifier and structure in the pack. Items the game hands out in code stay visible (Create's package styles, fluid and mob buckets, bug-net catches, feasts): hiding a real item is worse than showing a creative one. Each id is hidden on its own, so a renamed or removed item can't stop the rest; unknown ids are logged. Redo the check after changing mods.

The same idea covers the other mods' loot: `publish/sources.mjs` reads every mod jar's loot tables (and Relics' code) and writes a "Found in …" JEI information page and tooltip line for each loot-only modded item, plus `docs/where-to-find.md`, so JEI, the tooltips and the wiki answer "where do I get this?" for the whole pack. Run it by hand after adding or removing mods; its output is committed.

## Capes: earned, never crafted

Capes are cosmetics with a story (`capes/capes.mjs`; players read `docs/capes.md`). They are unlocks, not items, so they can't be traded, lost or duped:

- **Skill capes** at level 99, one per skill, each with a small perk (crit, armour, luck, speed, mending, extra XP).
- **Quest capes** for finishing a chapter: the chapter's last quest runs `lsp cape flag {p} chapter:<key>`.
- **Achievement capes** for vanilla feats (Adventuring Time, Hero of the Village, a full beacon, an elytra).
- **Legendary capes**, animated: every skill at 99, every chapter done, the dragon killed.
- **The Lemur Cape**: the owner's, by command.

How they look: the static capes are woven cloth drawn in code at Minecraft's own 64x32 cape size (`art/capes-px.mjs`): a dyed field with fold shading, a band near the hem and a small stitched emblem for skill capes (the Old School RuneScape idea), heraldic patterns for the rest (rails for Iron Roads, a beacon beam, a crimson saltire for the Armory, ring-tail bands for the Lemur). An earlier version framed a painted picture on each cape; it looked like wearing a poster, so only the three animated legendary capes keep painted art.

How it works: the server keeps who unlocked and wears what (persistent data, `/capes` wardrobe, `/lsp cape` admin commands) and tells every client who wears which cape; the client script gives each player a texture slot through CapeJS and swaps the texture behind it, frame by frame for animated capes. Art: two Higgsfield sheets of cape fronts, composed into Minecraft's cape layout at 8× by `art/process.mjs`, with generated shimmer frames.

## Enchanting: caps that grow, and Hardness

Enchanting is the fourteenth skill (`enchanting/enchanting.mjs`, built by `enchanting/build.mjs`; players read `docs/enchanting.md`). The table trains it, and it decides how far an enchantment can go:

- **Raised caps.** Every enchantment whose effect keeps scaling is raised to X (a few stop earlier where the effect does); single-level ones (Mending, Infinity, Silk Touch, the curses) are untouched. The allowed level is vanilla max plus a share of the extra levels that grows with the skill, so everything reaches its cap at 99. Above your level an item does nothing and armour slows you (Project MMO's own use-gate idea). Table costs stay linear (1.21 allows nothing else) and the table's third slot scales with the skill; Enchantment Industry's super enchanting is told not to go past the caps.
- **Telekinesis** (one level, tools and weapons): drops go straight to the inventory. Rolls at the table and shows up in loot like anything else.
- **Hardness** (the OSRS mining-level idea): a pickaxe tier alone doesn't break the good stuff. Tier I is iron, zinc and lapis; II gold and redstone; III diamond, emerald and obsidian; IV ancient debris; V reinforced deepslate and budding amethyst, each needing a Mining level (10/20/30/40/50) to work. Hardness is an enchanted-book *tome* applied at the anvil: tier I from a crafting table (andesite, copper, a book: iron sits behind it, and every Create machine needs iron or zinc, so a mechanical recipe there would have been circular), the rest by mechanical crafting from lower-tier materials. Tier II is the first real wall by design: the Mechanical Crafter needs brass and an electron tube, so the routes are a drill contraption (machines break up to tier II, through `create:non_breakable`), Ore Excavation veins (diamond, emerald and netherite veins are removed), witches and loot, and a Nether trip through a portal cast in place. Obsidian sits at III so an enchanting table and sturdy sheets don't wait for Mining 40.
- **The use-gate** (the owner's call: TNT, other players' chests and loot are "no biggie", the item just can't be used). A material from a gated block (`HARDNESS.materials`: raw ores, lapis, redstone, diamonds, obsidian, ancient debris; emeralds and ingots are free) can be carried, kept in a chest, barrel, shulker box or ender chest, placed or dropped, but recipes, machines and every other container refuse it until the Mining level reaches its tier. Two hooks: the companion mod's `UseGateMixin` checks every menu click (`AbstractContainerMenu#clicked`, so crafting grids, furnaces, anvils, hoppers, backpacks and every mod's machine menu are covered, and the client never predicts a refused move), and `server_scripts/enchanting.js` denies right-clicking a machine block with the item. Automation is exempt, so a funnel can still feed a diamond off the floor into a machine.
- **Tooltips** show the gate on every enchantment line: needs Enchanting N, the next level's unlock, the cap; Hardness lines show the Mining level and the blocks.

Rules for changing it: edit `enchanting.mjs` only (tiers, unlock levels, recipes, which enchantments are raised) and rebuild; the scripts read `config/lemursaucepacket/enchanting.json`, and the wiki page is generated.

## Hearts, graves and elimination (lifesteal)

A lifesteal layer for the PvP server (`docs/lifesteal.md` for players; numbers in `config/lemursaucepacket/lifesteal.json`, switches in `config/lsp_fixes-common.toml`):

- **Hearts** are the player's own health bar: 10, plus Hitpoints (one per ten levels), plus Hearts used, minus deaths. Gear, capes and potions never count. A death costs one and drops a **Heart** item (invulnerable, never despawns, never in the grave); right-click to gain one, or hand it to someone. Each Heart has a serial and works once, so a duped one crumbles. Every death counts from the first minute (the owner turned the two-hour newcomer window off, `newcomerProtectionHours: 0`); only a repeat kill by the same player within 30 minutes costs nothing. New Hearts are a late-game sequenced assembly (Heart of the Sea, nether star, liquid XP, a totem).
- **Graves need Grave Essence.** The Gravestone mod only places a grave when the dead player carried one (inventory, Curios or a backpack); otherwise the items drop as in vanilla. A companion-mod mixin cancels the mod's handler before it places anything.
- **Ownership:** an item is stamped with its first owner when it first enters an inventory (not Hearts, coins or books).
- **Elimination** at zero hearts: the death screen asks the player to confirm, several times, typing ERASE and holding. Their placed blocks and owned items are then erased everywhere, chunk by chunk and throttled, with a full archive first (`/lsp restore`), a dry-run mode and an off switch. Friends can `/revive` them with a Heart, even offline. They restart at spawn with 10 hearts and keep their skills.
- **Compasses:** the Lost Item Compass points at your own dropped items; the Seeker's Compass points at containers or players last seen holding a chosen item, without saying which.

KubeJS does the rules (`lifesteal.js`, `lifesteal_recipes.js`); the companion mod (`mods-src/lemursaucepacket-fixes`, package `lifesteal`) does what scripts can't: the grave veto, holding the respawn, the erasure and its archive, the compass GUI and index.

**Never load a chunk to read a container** (`SafeItems`). NeoForge's item capability for a chest asks vanilla for the double chest, which reads the neighbouring block and loads its chunk if needed. The first version read containers that way from chunk load and unload events, so chunks loaded each other: the world kept loading outward from chests on chunk edges, and the server never finished stopping (found with `jstack` on a scratch server stuck after "Stopping the server"). Plain containers are now read directly, a chest as its own half, and the capability only when the 3x3 chunks around the block are loaded.

## Travel: waystones you find before you can make

Waystones (with Balm) are in for fast travel, on the owner's terms: found in the world first, expensive to build.

- **Finding them:** Towers of the Wild: Modded adds tall towers with a waystone on top; Towns and Towers, Structory Towers and Dungeons and Taverns carry their own waystone compat that switches on when Waystones is present; the mod's wild waystones spawn too, and `pack/kubejs/data/waystones/tags/worldgen/biome` extends that to the Terralith and Regions Unexplored biomes the mod's tags don't list. Found waystones are breakable, so a player can take one home (Silk Touch keeps its name).
- **Making them:** `pack/kubejs/server_scripts/waystones.js` replaces all of the mod's recipes. Warp dust comes from heated mixing (ender pearl + amethyst), a warp stone from mechanical crafting with a precision mechanism, and a waystone from mechanical crafting with an ender eye, a precision mechanism, sturdy sheets and a brass casing; scrolls, sharestones, portstones and warp plates follow the same pattern. Consumables stay affordable; placeable waystones are the expensive part.
- **Maps:** Xaero's Minimap shows activated waystones as waypoints natively and the world map reads them; no extra mod.
- **Airships:** Waystones + Sable compat so a waystone on a ship teleports correctly.
- Travel costs are the mod's defaults (XP points by distance, capped); `warpRequirements` is the knob if it ever feels too free.

## The capital and the RuneScape layer (in progress, 1.2.8 to 1.4.0)

The owner's direction (2026-10-05): a mashup of Create, Old School RuneScape and Hypixel SkyBlock. A fresh world at launch spawns everyone in a city, the tier-1 trading hub, with a waystone, shops, and NPCs giving RuneScape-style questlines. Some questlines unlock item types (OSRS-style gating). QOL items speed up tedious jobs. The owner chose a fresh world for launch and a safe-zone city.

- **Buildings** are Luki's Grand Capitals' (in the pack since 1.3.0; the owner picked it from a showroom comparison of Towns and Towers, Luki's, Integrated Villages and CTOV). On 2026-10-06 the owner called our generated buildings ugly, and asked for a library of real ones.
  - The city places Luki's templates straight from the mod's jar (`revampedvillages:plains/...`). The mod is all rights reserved, so its files are never copied into this repository; `structures/external.mjs` only records what the layout needs (sizes, entrances, which way they face, shopkeeper and market-stall spots, the market's waystone) in `structures/external.json`, reading the jar the pack pins.
  - Some Luki pieces include workstations from More Villagers, Villagers Plus and Bountiful (not in the pack). Those load as air; the plan puts a vanilla stand-in in each spot (a brewing stand for an alchemy table, and so on).
  - HubBuilder places every template with `JigsawReplacementProcessor` (jigsaw blocks become their final state, so no villagers and no jigsaw blocks) and skips the structure blocks Luki left in a corner of each piece.
  - Luki's also overrides the vanilla villages (plains, desert, savanna, snowy, taiga), so the world's villages are grand capitals in the same style. Dungeons and Taverns overrides the taiga one too; Luki's wins (checked with `/place structure minecraft:village_taiga`).
  - Ours: the curtain wall (1.4.1, structures/lib/walls.mjs, after the owner found the old square walls ugly). It's a loop with rounded corners (radius 46) round the city, with five towers a quarter nudged in and out, a slight bend in every run, and a gatehouse on each avenue. The wall has a battered foot, buttresses, arrow slits, a corbelled crenellated parapet (machicolations), a walkway with a rail and lanterns, and a stone mix that changes block by block. Towers are round in two sizes, crenellated or under conical timber roofs with red flags, with the walkway passing through them. Gatehouses have twin square towers, an arch with the portcullis raised, banners, a lantern, and stairs up to the walkway. It's drawn in city coordinates and baked as four quarter pieces (structures/buildings/60-walls.mjs) that are placed unturned at their offsets. Outskirts buildings are kept inside the rounded corners. Our own house kit stays in the repo, but hub.mjs ships only the templates the city uses.
  - Every NPC has a Hypixel SkyBlock nametag (1.4.1): two text displays with fixed UUIDs over its head, the name in its colour and a bold yellow CLICK. The vanilla nametag is hidden by the `lsp_npcs` team, which also turns collisions off.
- **Lemurton**, the city (structures/hub.mjs writes `config/lemursaucepacket/hub_plan.json`):
  - Layout: walls at plus or minus 86. In the middle, Luki's big market (stalls round a great tree, with the waystone) is the town square, with a paved ring, wells, benches and planters. Round it: the inner ring street, with the seven shops, the cathedral (Luki's taiga church) and the church looking onto the market. Then a band of houses with the fountain square on the south avenue, the outer ring road, cottages, farms, stables and three wizard towers, and four gates.
  - Since 1.4.0 (owner's request, 2026-10-06) the capital isn't at world spawn: it's built 400 to 700 blocks away, out of sight (the server view distance is 160 blocks) but a few minutes' walk. New players get a lodestone compass to it (`lsp_capital_compass` tag, once; the lodestone sits under the waystone) and a chat line with distance and direction; `/lsp hub goto|compass [players]` for ops. Walking in sets `q_lemurton_found`, the welcome questline's first step.
  - The arrival point (the plan's `arrival`, where the compass and goto lead) is on the open paving just south of the market. Never under the great tree's canopy: with no open sky above, the respawn logic puts players on top of it.
  - About 90 buildings plus the wall and tower pieces; 61 to 118 s to build on the test PC.
  - `lsp_fixes`' **HubBuilder** builds it the first time the server starts on a brand-new world (one to two minutes). Existing worlds are marked skipped and never touched. `/lsp hub build here|near_spawn` builds one by hand.
  - The build happens a little each tick, in steps:
    1. A noise-only site search in a ring 400 to 700 blocks from world spawn (nearest good site first). It needs flat, dry land clear of the towns the world will generate (worked out from the seed by `Settlements`), and keeps away from other grand capitals. Only if nothing decent turns up does it widen, up to 1536 blocks.
    2. Forceloading.
    3. Flattening, with a blended ring.
    4. Paving.
    5. Templates.
    6. Single blocks.
    7. Commands (vanilla tree features).
    8. A GLOBAL waystone (named through reflection on the Waystones classes), the compass lodestone, the safe zone, and compasses for anyone online.
  - Before the build, on a brand-new world, world spawn moves if a town would generate on it (to the nearest dry spot clear of every planned town).
- **Towns and their names** (`lsp_fixes` package `towns`, 1.4.0): walking into a town shows its name as a title (and logs it). Grand capitals (the vanilla village structures, Luki's) and other mods' villages (`#minecraft:village`) get a name the first time anyone enters, kept in `lsp_towns` saved data, unique, from word lists by style (plains English, taiga and snowy Norse, desert like Al Kharid, savanna, swamp, jungle, alpine, eastern). Capitals stay at least 1,100 blocks apart: Luki's village set is spacing 50 / separation 35 chunks and Sparse Structures doubles every set. `/lsp towns list|goto <n>` for ops.
- **Safe zones** (`lsp_fixes` package `zone`; `/lsp zone list|here|add|addcolumn|remove|flag|bypass`):
  - Boxes saved with the world, with flags build, pvp, mobs, explosions, fire, fluids and decor.
  - Ops bypass in creative or after `/lsp zone bypass`.
  - Fire spread has no event, so `FireZoneMixin` and `LightningZoneMixin` cover it.
  - Hostile mobs are cancelled on spawn and swept every 5 s. Exempt: those tagged `lsp_zone_allowed`, named mobs, and anything from `easy_npc`.
  - Tested 9/9 on 2026-10-05: break, place, bucket, zombie, tagged zombie, TNT, op in creative.
- **People and quests (1.2.9):**
  - NPCs are Easy NPC Core and Config UI 7.14 presets. `npcs/build.mjs` writes them from `npcs/npcs.mjs` into `kubejs/data/lemursaucepacket/easy_npc/preset/<model>/`, checking every item against the registry dump.
  - hub.mjs puts one at every `npc` mark (8 stalls, 7 shops), plus the mayor by the waystone, 8 gate guards and 5 townsfolk: 29 in all. They are placed by `/easy_npc preset import data <preset> <pos> <uuid>` commands in the plan, with fixed UUIDs (sha1 of the spot).
  - Every NPC is invulnerable, can't be pushed or knocked back, looks at nearby players, and is tagged `lsp_zone_allowed` and `lemurton_npc`.
  - Shops (1.5.0) are the lsp_fixes economy's, not Easy NPC trading: see **Economy** below.
  - Questlines are FTB Quests chapters in a Lemurton group (quests/book.mjs). Each step is a `gamestage` task on a vanilla player tag that an NPC sets: a dialog button runs `/tag @initiator add <stage>`, or a shop purchase does (Bessa's `onBuy`). Dialogs choose themselves from the same tags (PLAYER_TAG conditions, highest priority first), so the mayor's lines follow the quest. NPC quests set `auto` on their rewards (the pack's default is manual claiming).
  - The first chapter, Welcome to Lemurton: meet the mayor, buy from Bessa at the market, report back. Tested end to end on 2026-10-05: dialog and trade screens, auto-paid rewards.
  - Gotcha: a dialog or trade screen forced open (`/easy_npc dialog open`) before the player's client has the NPC entity disconnects that player (an NPE in Easy NPC's DialogScreen), so only open them for players standing next to the NPC.
- **Next:**
  - More questlines (easy and hard, short and long) in the same pattern.
  - Quest-gated wearing and use: hidden Project MMO skills granted by `pmmo:levelreward`. Crafting: the crafting-result mixin.
  - Settlements in worldgen (jigsaw structures from the same templates); special buildings (bank, inn, church, guild hall, castle keep); custom NPC skins.

## Main quests and dragons (1.6.0)

**RuneScape-style quests** (lsp_fixes package `quests`, players' guide docs/quests.md#main-quests). The quest book's Main Quests group holds one chapter per quest; each chapter's first quest is `invisible` (FTB: hidden until done) on its start stage, and the rest are `hidden` (until the step before is done), so a quest appears only once an NPC has given it to you and its steps unfold one at a time. FTB hides a chapter (and its group) while none of its quests are visible.
- `npcs/quests.mjs`: the stage tags, quest items (vanilla items with a name, lore and `custom_data.lsp_quest`) and hand-in steps; npcs/build.mjs writes the steps to `data/lemursaucepacket/lsp_quests/<quest>.json`. A step (what a dialog button runs: `/lsp quest step @initiator <quest> <step> @npc-uuid`) checks stages it needs and lacks, takes items (by id, or by quest-item key) and coins, gives items, sets a stage, runs commands and opens the NPC's `ok` dialog, or says what's missing and opens `missing`. The NPCs' dialogs (npcs/npcs.mjs) choose themselves by stage tags and priority, as the mayor's always have; vendors with a quest line (Brann, Lucan) also get a `talks` entry so it plays first, and the quest shows in their shop.
- The quests: Cook's Assistant (the Cook: milk, an egg, Create flour), The Knight's Sword (Squire Asrol and Brann: brass, a precision mechanism, iron), Dragon Slayer I (Guildmaster Greaves, needing those two and Welcome to Lemurton; Oziach; the mayor's Anti-dragon Shield; map pieces from Lucan for 10,000 coins, Wizard Traiborn for a ghast tear, blaze rod and amethyst, and the Guild's kill trial; the Map to Crandor; Elvarg; her head). The five new NPCs stand at worker buildings' npc marks (AT_BUILDING).
- **Crandor** (`quests/Crandor`): the nearest structure in `#lemursaucepacket:crandor` (Ice and Fire's fire dragon roost) to Lemurton's centre, found once with `findNearestMapStructure` (about 300 ms) and saved (`lsp_crandor`). The map is a compass with a lodestone tracker on it. Every 5 s, a player with `q_ds_map` within 72 blocks wakes Elvarg if she isn't there: a stage-four fire dragon (80 days, aging off, red, homed on the roost, tagged `lsp_elvarg`), topped up to full health after the summon (327). Her fall is caught both from the death event (highest priority, cancelled or not) and from her health reaching zero after damage, once (`lsp_elvarg_slain` on the body): Ice and Fire keeps dead dragons as lootable bodies, and its `/kill` only removes them. Everyone with the map within 160 blocks gets the stage and the head. She can come back five minutes after a death, for others still on that step. `/lsp crandor where|map|goto|spawn` for ops.
- **Dragon gear** (`quests/DragonGear`): armour in `#lemursaucepacket:dragonslayer_armor` (48 dragonscale and 12 dragonsteel pieces) comes straight off a player without `q_ds_done` (creative excepted); the Anti-dragon Shield in either hand cuts `iceandfire:dragon_fire|ice|lightning` damage to a fifth.
- Tested 2026-10-06 on a fresh world: 17/17 (every step, the NPCs placed, Elvarg's spawn, health and death credit, the armour gate, the shield).

**Ice and Fire CE 2.0** (with Uranus and Jupiter), dragons only, by the owner's choice: `config/iceandfire/iaf-common.json` turns off griefing (wild and tamed), digging when stuck, and every other creature's spawns and every non-dragon structure; the biome tags those use (`kubejs/data/iceandfire/tags/worldgen/biome/{entity_gen,ore_gen,structure_gen}/*`) are emptied as well. Dragon caves and roosts keep their default chances and never generate within 1,000 blocks of spawn. Silver and sapphire stay (ice dragon dens hold them). JEI hides the switched-off creatures' items (client_scripts/jei_hidden_iceandfire.js, 205), and Every Compat leaves Ice and Fire's dreadwood alone.

## Look and feel: one kit everywhere

Everything a player looks at outside the world — the launcher, the loading screen, the title screen, the ESC menu, the options screens, the quest book, the skills screen — is built from one kit, so it reads as one designer's work:

- **Materials:** dark riveted iron plates, polished brass bands with corner rivets, parchment text, amber for hover. The palette is sampled from the logo (`art/pixel-kit.mjs` has the hex values).
- **Widgets:** the pack replaces the vanilla button, slider, tab, text field, checkbox and scrollbar sprites and the menu backgrounds with pixel-drawn brass versions (a resource pack in `kubejs/assets`). Anything that uses vanilla widgets — the options screens, FTB Quests, most mod screens — inherits the look. The launcher draws its buttons, fields and cards from the same sprites at 3×.
- **Tooltips** follow Hypixel SkyBlock's layout on every item (`pack/kubejs/client_scripts/tooltips.js`, and `gear/build.mjs` for the pack's own gear): the name in its rarity colour, a stat block (Damage, Attack Speed, Defense, Health… with the value coloured by stat, built from the item's real attribute modifiers, which vanilla's own attribute lines no longer duplicate), gold section headers for abilities and set bonuses, Project MMO requirements as "❣ Requires Mining 35" in red until met and green with a tick after, a "Hold Shift for details" hint that reveals skill XP, the "How to get"/"Found in" hints and set-bonus text, and a bold "UNCOMMON HELMET"-style footer. Create items keep Create's own Shift summary; Relics items keep their research hold. Project MMO's own tooltip lines are switched off in the shipped client config.
- **Item art:** the pack's own items are 16x16 pixel art in the style of the Relics mod (`art/items.mjs`, drawn in code): coloured outlines instead of black, hue-shifted shading, small sparkles, and Relics' shimmer animation (a long still frame, then a quick light sweep, with the pause varied per item). Vanilla armour and tool sprites give the silhouettes so a helmet still reads as a helmet; the unusual items (scythe, wand, pattern, crown) are hand-placed pixels. The two Relics status-effect icons Relics 0.12.8 ships without (Flight, Tremor) are drawn the same way into `assets/relics`. The lifesteal compasses get 32 needle frames of their own, vanilla's compass frames recoloured by role (casing, face, needle) with one colour table so the needle never flickers as it turns; their frame models are static files next to the textures.
- **Icons:** the ESC menu, the launcher pages and the 14 skills use icons painted in the same style as the quest emblems (Higgsfield sheets in `art/generated`), so the quest book, the skills screen and the menu share symbols (the quest book's book, the backpack, the atlas).
- **The ESC menu** is a riveted board with three recessed panels: *Adventure* (Map, Quests, Missions, Waypoints, plus where you are), *Game Menu* (the vanilla pause buttons, moved into the panel; "Options" is renamed "Settings") and *Player* (your character, Skills, Backpack, Team, Voice). Buttons added by other mods land in free slots or a tray under Disconnect, so nothing disappears. *HUD Layout* sits at the right end of that bottom row (see *HUD layout editor* under *Fixes shipped in the pack*). The vanilla "Game Menu" title is blanked through a language override.

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

**Economy (1.5.0, lsp_fixes package `economy`; players' guide docs/economy.md).** One currency, Gold Coins, replacing Numismatics (removed in 1.5.0; quest rewards went to Gold Coins at 10 per spur, a crown to 5,000 and a sun to 40,000).
- **The coin** (`lsp_fixes:gold_coins`): one item, max stack 1, its amount in the `lsp_fixes:coin_amount` long component, so there's no cap. A count above one means amount × count (Coins.value). The purse is every coin stack in the inventory; a player tick folds them into one stack, and coins walked over merge into it (ItemEntityPickupEvent), so a full inventory still picks coins up. In containers, carried coins clicked on coins merge; right-click puts one down or takes half (Item.overrideStackedOnOther/OtherStackedOnMe); shift + right-click opens an amount box (client screen, payload CoinInput) that puts an exact amount in the cursor.
- **The client** draws the amount where vanilla draws a count (IItemDecorator): `2.3k`, `45k`, `1.2M`, rounded down, three-quarter size beyond two characters, in RuneScape's stack colours (yellow, white from 100k, green from 10M). The icon is a pile that grows with the amount like RuneScape's (ten sprites from `art/coins.mjs`, the `lsp_fixes:pile` item property). The tooltip has the exact amount.
- **Coin Pouch** (`lsp_fixes:coin_pouch`, stacks to 64): what Brassworks pays (it hands out one item by count, which a no-cap coin can't be). Right-click opens the stack into 100 coins each.
- **Values** (ItemValues): `data/*/lsp_economy/*.json` (ours: `npcs/values.mjs`) prices raw materials by id, tag or regex; every recipe in the server's RecipeManager (crafting, smelting, Create's machines: about 11,000) prices what it makes as the cheapest input cost (min over recipes, a fixpoint, so crafting never prints money; container remainders subtracted; inputs that are only tools cost nothing); what nothing prices gets a rarity default (0.5, 8, 32, 128); and no vendor buys back anything it sells for more than `vendorShare` (half) of its price. 9,196 items priced in about 160 ms at start and on /reload. A stack's worth is value × count, less wear, plus 8 × anvil cost × level per enchantment. The table goes to every client on join and reload (payload Values), so the shop's tooltips use the same numbers. Never bought: coins, pouches, Hearts, backpacks (contents live elsewhere), spawn eggs, Easy NPC items, full containers.
- **Vendors** (`data/*/lsp_npcs/<who>.json`, written by `npcs/build.mjs`; an Easy NPC is one when tagged `lsp_npc.<who>`): PlayerInteractEvent.EntityInteract on such an NPC is cancelled and decided in Java. A waiting *talk* plays first, alone: the greeting on a first meeting (`intro`), or a dialog whose stage tags line up (`when`/`unless`), each once per player (the `npc_memory` attachment, kept through death). Otherwise a vendor opens their shop and anyone else says their usual line (`/easy_npc dialog open`). The dialogs' "Let's trade" runs `/lsp shop open @npc-uuid @initiator`.
- **The shop** is a custom chest-style menu (MenuType `lsp_fixes:shop`, vanilla ContainerScreen) whose client half ignores clicks, so nothing flickers into the cursor while the server decides. Goods sit in a bordered 7-wide grid (a lot per click, a stack per shift-click; the price rides on a display-only `shop_cost` component that the client turns into Hypixel-style "Cost / Click to buy!" lines at the bottom of the tooltip). Clicking an item in your own inventory sells it, shift-click sells every stack like it, and a sale of 1,000+ coins or of anything enchanted, named or rare needs a second click within 4 s. The bottom row: purse, Talk to <name>, buyback (the last five sales, LIFO, at what was paid), Quests (the vendor's quest lines from `npcs.mjs` QUESTS, done steps struck through and the current one highlighted: the shop doubles as the quest journal) and Close. Purchases can run `onBuy` commands.
- **Trading** (Trades): `/trade <player>` or sneak + right-click with an empty hand; asking back opens a 6-row window for both (your 4×4 offer left, theirs right, coins via the amount box, held in escrow while on offer). Any change resets both acceptances and starts a 3 s deal timer. Completion checks free slots, then swaps; closing, logging out, dying (LivingDeathEvent, highest priority, before the grave takes the inventory), changing dimension or walking 64 blocks apart cancels and returns everything. Every trade and sale is logged on `lsp_fixes/economy`.
- **Stages for the quest book:** `econ_sold`, `econ_bought`, `econ_traded`, `econ_purse_1k|10k|100k|1m` (the Coin & Commerce chapter, and Millionaire in Legacy).
- **Commands:** `/purse`, `/worth`, `/trade`; ops: `/lsp coins give|take|set|balance`, `/lsp values get|top`, `/lsp npc list|talk|forget`, `/lsp shop open`.
- Gone with Numismatics: offline player shops (vendors and depositors) and bank cards. Create's table cloths still sell while you're away, priced in any item.

## Mods by role

**Create and its family:**
- Create
- Create Aeronautics (with Sable)
- Crafts & Additions
- Create Enchantment Industry
- Create Deco, Copycats+, Create: Connected
- Railways Navigator
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
- Shaders: Iris is always installed with shaders off, so K turns them on in game (Balanced by default) and I picks a pack (Iris's default O is the pack's mute key; client_scripts/keybinds.js moves it for older installs). The launcher's Settings page (Graphics) offers presets: Lite (MakeUp Ultra Fast), Balanced (Complementary Reimagined) and Fancy (Complementary Unbound). Iris's config/iris.properties is the truth: the launcher writes it only on a first launch (off, default pack ready) and on the next Play after a pick in Settings, so K and O keep working; the presets live in publish/feed.json (feed `shaderPresets`). Iris costs nothing visible with shaders off (300-500 fps on a test scene of 100 turning cogwheels), apart from switching off Sodium Extra's sky and fog options. The pack does not ship iris.properties.

**Information:**
- JEI with Create JEI Compat (paged sequenced-assembly recipes), JEI World Gen (ore heights), Just Enough Professions, Just Enough Breeding and JEED.
- Jade with Jade Addons.
- Create: Cyber Goggles (exact numbers when wearing goggles).
- Enchantment Descriptions, Better Advanced Tooltips, AppleSkin.

**Building:**
- Macaw's Furniture: chairs, tables, desks, counters, wardrobes.
- Macaw's building set (1.2.7, for the RuneScape-style city and settlements, see structures/): Roofs (thatch, slate,
  tile, wood and stone in five pitches), Windows (frames, shutters, arrow slits, gothic windows, parapets,
  curtains), Doors (cottage, stable, barn, portcullis), Trapdoors, Fences and Walls, Lights and Lamps (lanterns,
  chandeliers, street lamps), Paths and Pavings, Bridges, and Stairs and Balconies.
- Woodworks: vanilla-style chests, bookshelves, ladders, beehives and boards in every wood, plus a sawmill.
- Every Compat makes each wood in the pack available for:
  - Macaw's Furniture and Woodworks;
  - Create's windows;
  - Farmer's Delight's cabinets.

  It adds about 1,700 blocks for Regions Unexplored's woods. The nine Macaw's building mods are on Every Compat's
  module blacklist (config/everycomp-hazardous.toml): they would add about 2,300 more blocks, and the city only
  uses vanilla woods. That file is the only switch that stops the blocks being registered (everycomp-entries.toml
  only hides them from tabs and recipes). Never blacklist a module whose blocks are already in the world: they
  vanish.

**Quality of life:**
- Sorting: Inventory Profiles Next (client-side, works on any server) puts Sort / Sort in columns / Sort in rows
  buttons on your inventory and every container, and Move All buttons (take all from the container, deposit all
  into it; the hotbar stays unless you hold the include-hotbar key). Shipped config
  (config/inventoryprofilesnext/inventoryprofiles.json): Move All moves everything (`always_move_all`; holding the
  modifier moves only matching items), the profile system, its UI and the update check are off, and Auto Refill
  stays on (refills an emptied hotbar stack, swaps tools before they break) without its marker on every slot.
  Tested 2026-10-05 against a server with the Hardness use-gate: sort, take all and deposit all all land on the
  server, gated materials included (chests are allowed). It replaced Sophisticated Inventory Interactions at the
  owner's request (2026-10-05). Sophisticated Backpacks keep their own sort buttons.
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

Launcher toggles: 17 client mods are optional on the launcher's Mods page. First-person model and controller support start off; everything else starts on.

## Deliberately left out

- **Seamless portals.** Immersive Portals' official NeoForge build conflicts with Sodium 0.8 and Sable. The community fork (Immersive Portals CE 6.0.9, built for Sable 2.0.5) was tested and then dropped at the server owner's call.
- **Teleport commands** (`/home`, `/tpa`, `/spawn`): waystones cover fast travel on the owner's terms, see *Travel* above.
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
- Backpacks, vaults, toolboxes, copycats and the other storage blocks tested were already safe (so were Numismatics vendors, while the pack had them).
- The mod clears every such block entity first. It crashes at startup, rather than failing silently, if a Sable update moves the code it patches.
- Sable's own `sable:silent_assembly_removal` block tag is the fallback if the mod ever lags behind Sable.

**LemurSaucePacket Fixes** (`mods-src/lemursaucepacket-fixes`, mod id `lsp_fixes`, shipped as `pack/mods/lsp_fixes-*.jar` on both sides) is the pack's own companion mod for what scripts can't reach:
- Project MMO 2.10.47's inventory skills panel couldn't be scrolled at larger interface sizes (its scroll step was the overflow divided by 100 in whole numbers, so it rounded to zero under 200 px of overflow, and it crawled 1–2 px per notch otherwise). A mixin gives it one row per notch and the full range.
- The same panel is 130 px wide and overlapped the inventory at the minimum interface width (427 px); it now starts collapsed when it would reach into the inventory or the recipe book.
- The Hardness use-gate's menu half (`UseGateMixin` on `AbstractContainerMenu#clicked`, see *Enchanting*) and the Java half of the lifesteal system (see *Hearts, graves and elimination*).
- Its mixins only apply when the target mod is present and switch off with a warning instead of crashing if a mod update renames what they patch. Build: `./gradlew build` then `./gradlew copyToPack`.
- The HUD layout editor (below).

**HUD layout editor** (`lsp_fixes` 1.3.0, package `hud`, client only). The ESC menu's *HUD Layout* button opens `HudLayoutScreen` with FancyMenu's `opengui` action (`art/hub.mjs` writes it), so it needs no key. `/hudlayout` (a client command) and the *Edit HUD layout* key (unbound by default) open it too. While the editor is open, the live HUD is suppressed and every part shows representative sample content, including the full skill panel, so the measured boxes match what is being placed. Drag (snaps to the edges and centre lines within 4 px, Shift for none), arrow keys nudge, `H` or *Show/Hide* stages visibility, right-click or *Reset* restores a mod default, *Save* writes, and *Cancel* discards changes. Nothing is stored by our mod unless the part has no setting of its own: each position and visibility setting goes into that mod's config through its own API or config object, so it applies at once and keeps working without `lsp_fixes`.

| Part | Written to | How |
|---|---|---|
| Xaero's Minimap | `config/xaerohud.txt`, line `module;id=xaerominimap:minimap` (`x`, `y`, `centered`, `fromRight`, `fromBottom`) | `HudModule.setTransform` + `ModSettings.saveSettings`, as Xaero's own Edit HUD screen does |
| Jade | `config/jade/jade.json`, `overlay.overlayPosX/Y` (screen fractions, Y from the bottom) and `overlay.overlayAnchorX/Y` | Jade's config object, anchors picked with Jade's own rule, `Jade.CONFIG.save()` |
| Voice chat icon | `config/voicechat/voicechat-client.properties`, `hud_icon_pos_x/y` (negative = from the right/bottom) | the voice chat's `ConfigEntry.set().save()` |
| Voice group heads | same file, `group_player_icon_pos_x/y` | same |
| Create goggle info | `config/create-client.toml`, `[client.goggleOverlay] overlayOffsetX/Y` (pixels from the centre) | NeoForge config value set + save |
| Project MMO XP gains | `config/pmmo-client.toml`, `[Client.GUI] "Gain List Xoffset"/"Gain List Yoffset"` (screen fractions) | same, plus a copy in `lsp_fixes-client.toml` (below) |
| Project MMO skill list | same file, `"Skill List Xoffset"/"Skill List Yoffset"` | same |
| Pinned quests | `config/ftbquests-client.snbt`, `pinned.pinned_quests_pos` (eight edges/corners) and `pinned_quests_inset_x/y` | FTB Library's config values + `ConfigManager.save("ftbquests-client")`; the box settles on the nearest edge |
| Status effects, boss bars | `config/lsp_fixes-client.toml`, `[hud.vanilla] effectsX/effectsY`, `bossBarX/bossBarY` | our own: a pose translate around NeoForge's `effects`/`boss_overlay` GUI layers (`RenderGuiLayerEvent`, lowest priority so a cancelled layer never leaves the pose pushed), clamped on screen |

Every integration is optional and reached by reflection (no compile dependency): it is built only when its mod is loaded, and if a mod renames a class, field or setting, that one part is logged ("HUD layout: leaving out …") and left out of the editor. Xaero's Minimap normally dodges the effect icons and boss bars at their vanilla places (its push boxes); while either is moved, those push boxes are switched off after the layer draws. Known limits: Jade's "push below the boss bar" still assumes the vanilla boss-bar place; the voice group box is sized for three members; the editor's boxes are estimates for parts that aren't on screen (Jade, Create and pinned quests use their last drawn size when there is one).

**Why the Project MMO copy.** The launcher re-applies a shipped config file whenever the pack's copy of that file changes (player edits survive only until then; `launcher/src/core/sync.ts`, step 3). Of the files above, the pack ships only `pmmo-client.toml`, so an edit to it in a pack update would reset the player's XP-gain and skill-list positions. The editor also stores them under `[hud.remember]` in `lsp_fixes-client.toml`, which the pack never ships, and writes them back on the next world join if they differ. Don't ship `xaerohud.txt`, `jade/jade.json`, `voicechat/voicechat-client.properties`, `create-client.toml`, `ftbquests-client.snbt` or `lsp_fixes-client.toml` in `pack/config`, or give them the same treatment.

**Script gotchas this KubeJS build (2101.7) taught us:** KubeJS's bean properties shadow same-named vanilla methods (`player.level`, `level.dimension`, `server.overworld` are properties, so `player.level()` fails); some vanilla methods aren't reachable from scripts at all (`getUUID`, use `player.uuid`; `closeContainer`/`openMenu`; `getSharedSpawnPos`); overloaded Java methods whose arguments KubeJS can convert several ways are "ambiguous" (`Style.withColor`, use `component.color(...)`; the two-argument Curios `getItemStackSlots`; and any method with String and UUID overloads, since KubeJS converts a string into a UUID: call the one you mean by signature, `cache['get(java.lang.String)'](name)`); and `net.neoforged.fml` classes are blocked by the class filter (Project MMO's `LogicalSide` comes from `Core.get(level).getSide()` instead). Headless tests catch these; the Node tooltip harness doesn't.

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
