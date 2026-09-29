# LemurSaucePacket: pack design

Why the pack is built the way it is. The README covers how to run it.

## Pillars

1. **Create is the spine.** Every stage of progress runs through Create machines. Other mods either feed Create (ore veins, crops, coins) or give it a reason to exist (structures to reach, a server economy, airships to fly). There are no tech mods that compete with Create (no Mekanism, no AE2) and no magic mods.
2. **It still feels like Minecraft.** Vanilla UI, the vanilla crafting grid, vanilla mobs and biomes. Mods enhance these rather than replace them. New mobs, biomes and structures look like things Mojang could have added.
3. **Exploration has a purpose.** Structures are built from Create blocks and hold Create parts. Infinite ore veins are something to find and claim. The Atlas and Banners quest chapters pay for going out and looking.
4. **A fair SMP.** PvP is on, so the rules protect builders:
   - land and airship claims;
   - graves for your items;
   - no minimap radar or cave maps;
   - backpacks that don't replace chests.
5. **It runs well.** Client performance mirrors [Fabulously Optimized](https://modrinth.com/modpack/fabulously-optimized), and the server stays light enough for a home PC.

## Progression: the quest book

FTB Quests, built from `quests/book.mjs`. Quests never lock content; they're a road map that pays out in Numismatics coins. Progression mode is *flexible*: a biome visited early still counts later, so no one has to repeat exploration.

**The Ages** (the main line)

| Chapter | What it covers | Milestone |
|---|---|---|
| Landfall | Rules, claims, first tools, first backpack, a village | A wrench |
| First Rotation | Andesite age: water and wind power, presses, fans, belts, contraptions, zinc, ore veins | 32 andesite casing |
| Brass Age | Blaze burners, mixing, brass, precision mechanisms, arms, crafters, steam, electricity | Rotation speed controller |
| Banners of the Overworld | Outposts, raids, the Illager fort and Invoker, Create ruins (lost station, sky-pirate airship, quarry, castle) | Raise your banner |
| Iron Roads | Track, stations, schedules, signals, departure boards, parcels, stock keeping, factory gauges | Connect two towns |
| Skyward | Create Aeronautics: propellers, envelopes, burners, levitite, steering, ship claims | Maiden voyage |
| Crown of Fire | Fortresses, bastions, piglin castes, blaze cakes, netherite | The Wither |
| Legacy | Stronghold, the End, the dragon, elytra, enchantment industry, crushing wheels, banking | Build your legacy |

**Field Guides** (side books): Backpack Workshop, Homestead (Farmer's Delight, Slice & Dice, happy ghast), Bestiary, Atlas (15 biomes and structures), and Coin & Commerce.

Each chapter opens with a painted crest and an info card. The card says what the chapter is for and what it unlocks (Bestiary and Atlas list their rewards instead). The lemur mascot and the chapter crests come from one Higgsfield sheet (see the README).

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

**Ore veins (Create Ore Excavation):** veins are infinite and hidden per chunk, which gives prospecting a purpose. Diamond, emerald and netherite veins are removed, because infinite diamonds would flatten both progression and villager trading (`ore_veins.js`).

**Travel:** no waystones and no teleport commands. Distance is solved with trains, airships, horses and the happy ghast. That keeps the rail network, the Iron Roads chapter and airships meaningful.

**PvP fairness:**
- Xaero's minimap and world map run in fair-play mode (no entity radar, no cave maps), enforced by Xaero's server profiles in `pack/config/xaero/*/server_profiles/`.
- Open Parties and Claims protects land, and Aeroclaims protects airships.
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
- Sophisticated Backpacks' Create integration
- KubeJS with KubeJS Create

**Worldgen and structures:**
- Terrain and biomes: Terralith, Tectonic, Lithostitched, Nullscape.
- Structures: YUNG's (11 mods), Structory and Structory Towers, Towns and Towers, Dungeons and Taverns.
- Create-built structures: Create: Structures Arise, Let the Adventure Begin, Rustic Structures.
- Support: Sparse Structures keeps structures from crowding, and Structure Layout Optimizer keeps generation fast.

**Vanilla+ mobs:**
- Friends & Foes, Naturalist, Creeper Overhaul, Variants & Ventures
- Illager Invasion, Piglin Proliferation, Guard Villagers
- Vanilla Backport (happy ghast, pale garden, creaking), with its compatibility patch

**SMP:** Open Parties and Claims, Aeroclaims, Simple Voice Chat (proximity voice), Gravestone, Xaero's Minimap and World Map, FTB Quests (with FTB Library and Teams).

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

**Quality of life:** Mouse Tweaks, Just Zoom, Controlling, Searchables, Chat Heads, Shulker Box Tooltip, Inventory Essentials, and Controlify (controller support, off by default).

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

## Known quirks

- **Harmless log errors:**
  - Create: Connected and Create Enchantment Industry loot tables for blocks from mods that aren't installed;
  - a Sable physics tag that names a block from another mod;
  - two advancements a mod adds under the minecraft namespace (`give_quest_trader_trade`, `wander_add_map`);
  - the broken recipe files that `fixes.js` replaces (the jars still contain them; the replacements load fine).
- **Create trains through Nether portals:** trains can cross them, but riders can get kicked. Send freight across unmanned (the Iron Roads chapter says so).
- **Chat verification toast:** it only appears on offline-mode test servers.

## Credits

- **[Fabulously Optimized](https://github.com/Fabulously-Optimized/fabulously-optimized)** (BSD-3-Clause), whose mod selection the performance list mirrors with NeoForge builds.
- Every mod author in the pack; the launcher's Mods page links each mod's Modrinth page.
- Art generated for this pack with Higgsfield (GPT Image 2.5).
