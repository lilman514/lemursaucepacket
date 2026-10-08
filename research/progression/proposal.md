# LemurSaucePacket: progression proposal for modded items

A proposal only: nothing under the pack was changed. Built 2026-10-08 from the pack's gate tables (`skills/unlocks.mjs`, `skills/build.mjs`, `enchanting/enchanting.mjs`, `gear/gear.mjs`, the Project MMO rules under `pack/kubejs/data`), the registry dump of 2026-09-29 and the server's mod jars. The per-item list (class, current gate, proposed gate for all 8428 items) is in `progression-items.csv`; the machine-readable proposal is `progression-proposal.json`.

## What was counted

- **8428 modded items**: the dump's 6821 ids minus vanilla and minus Numismatics (62 ids; the mod has since been removed), plus 2960 items read from the jars of mods added after the dump and 42 KubeJS items registered after it. Vanilla Backport's 110 additions use `minecraft:` ids and are counted as modded.
- **Mods missing from the registry dump** (their items were read from `assets/<mod>/models/item` and `lang/en_us.json`): Ice and Fire CE 2.0; the nine Macaw's building mods (Bridges, Doors, Fences and Walls, Lights and Lamps, Paths and Pavings, Roofs, Stairs, Trapdoors, Windows); Easy NPC Core and Config UI; and `lsp_fixes` (the companion mod: Climbing Boots, Mason's Palette, coins). Also newer than the dump: the KubeJS hand-made parts (Prospector's Plating, Aeronaut's Rigging, Duelist's Filigree, Diamond Lattice), the five lifesteal items and the 33 cape items. Create: Let The Adventure Begin and Dungeons and Taverns register no items (their keys, maps and potions are vanilla items with components).
- **By class:** decoration/building block 4731, storage/logistics 1695, technical/creative-only 573, crafting material 269, transport 210, utility block 187, light source 185, machine/automation 150, armour 146, food 138, magic/enchanting 65, tool 60, weapon 19.

## The tier logic

Levels follow the RuneScape curve the pack already uses (level 50 is under 1% of the XP to 99, so the 1 to 50 range is where most play happens) and sit next to the anchors already in the tables, so a new gate always lands beside something of the same power:

| Band | Levels | What lives there (existing anchors in bold) |
|---|---|---|
| Settler | 1 to 15 | Day-one conveniences: **leather 5, gold gear Smithing 10, iron gear Smithing 15, the drill/saw/harvester Mining/Woodcutting/Farming 15**. Proposed: copper backpacks, pickup upgrades, toolboxes, pine trees, the smelting upgrade. |
| Andesite and iron | 15 to 30 | **Anvils and hoppers Smithing 20, crossbows 20, the encased fan Cooking 20, Climbing Boots**. Proposed: item vaults, mechanical arms, iron backpacks, silver gear, elevators, return scrolls, the slicer, organic compost, willows. |
| Brass and Nether | 30 to 45 | **Diamond gear Crafting 30, mechanical crafters 30, steam engines Smithing 35, trains Agility 35, the blaze enchanter Enchanting 35, the enchanting table Crafting 40**. Proposed: gold backpacks, magnets and compacting, electricity (the capacitor), portstones and warp plates, the happy ghast harness, the stock-keeping network, the alchemy upgrade, maples. |
| End prep | 45 to 60 | **Ender chests Crafting 50, netherite Smithing 50, the printer Enchanting 50, the eye of ender Brewing 55, end crystals Crafting 60**. Proposed: waystones 45, the warp stone 50, diamond backpacks and ender linkers 50, sharestones 55, dragonbone gear 55, the blaze forger 55, netherite backpacks 55, the Chorus Staff and Clot of Time, dragonscale armour 60. |
| End and dragons | 60 to 80 | **Shulker boxes Crafting 65, compacted netherite Smithing 65, the mace Smithing 70, conduits 70, beacons Crafting 75, respawn anchors 80**. Proposed: the imbuing table 65, summoning crystals 65, the Glitchy and Ghostly Mantles, dragon eggs and the dragonforge 70, redwoods 70, dragonsteel weapons and tools 75, dragonsteel making Smithing 80. |
| Mastery | 80 to 99 | **The netherite drill head Mining 80, capes 99**. Nothing new is proposed above 80: the top of each skill stays the cape. |

Which skill a gate uses follows what the item does, the way the existing tables do (the train station sits on Agility, the encased fan on Cooking):

- **Crafting**: storage, logistics, electronics and the finer magical things (backpacks, vaults, the stock network, capacitors, summoning crystals). **Smithing**: metal gear, forges and metalwork in a backpack. **Cooking** and **Brewing**: dishes, kitchen machines, potions and potion devices. **Enchanting**: experience and enchanting machines. **Construction**: building tools and base defences.
- **Agility**: everything that moves you (waystones, scrolls, mounts, mobility relics). **Mining**, **Woodcutting**, **Farming**: their tools, prospecting, trees (the CHOP ladder), husbandry (dragon eggs). **Attack**: weapons by tier; **Defence**: armour, shields and defensive relics; **Ranged**: bows and cannons.
- **Strength** and **Hitpoints** unlock nothing today but their perks and quest steps; they get the damage relics and heavy weapons (Strength) and the survival relics and totems (Hitpoints). Fishing has nothing new to gate.

## Kinds of gate, and what each needs

| Kind | Meaning | Enforced by | Count |
|---|---|---|---|
| craft | Making it at a crafting grid, smithing table, cooking pot, Create's blueprint or the backpack crafting upgrade | A `CRAFT` entry (`machine: true` for Create-style machines): works today | 71 |
| wear | Wearing it (armour, curios, or held for totems) | Project MMO `WEAR` (+ Slowness). Relics need a `RELIC_WEAR` entry and an ability check in lsp_fixes like the Climbing Boots', or they keep working | 20 |
| hold | Hitting with it | Project MMO `WEAPON` (+ `WEAR` for the held penalty), as the vanilla swords | 13 |
| use | Using it (right-click, mining with it, placing an egg) | Project MMO `USE` / `TOOL` | 22 |
| place | Placing the block | Project MMO `PLACE` on the block: new in `skills/build.mjs` (only crops use PLACE today) | 5 |
| chop | Breaking the logs | A `CHOP` entry (Project MMO `BREAK`): works today | 13 |
| brew | Using it as a brewing ingredient | A `BREW` entry; the potion-level map (`POTION_LEVEL`) is keyed `minecraft:<id>`, so modded potions (`friendsandfoes:reaching`, `illagerinvasion:berserking`) need their own ids for the XP | 2 |

## Rules kept

- **The machine rule.** Mechanical crafters, the Crafter and basins never make a gated item, so nothing that only a mechanical crafter makes gets a `craft` gate (it would lock it for everyone). Those get a `place` or `use` gate (waystones, the warp stone, the wand of symmetry, the extendo grip, the mounted potato cannon), or the gear sets' trick: a crafting-table part carries the gate (the capacitor for electric motors and tesla coils). Machines with no player that make something (the dragonforge, the slicer, sprinklers, the blaze forger) are gated on being built.
- **Open on purpose:** the press, mixer, blaze burner and deployer, airships (Aeronautics, Simulated, Offroad wheels), and anything only a machine makes (Create's foods, the enchanting templates). No land-claim mods.
- **No double gates.** Items that already have a gate keep it and get nothing of the same kind (checked by the generator). Dragonscale and dragonsteel armour keep their quest gate (Dragon Slayer I) for wearing and only gain a making gate; a Defence level on top is left as an option.
- **Free by design:** ingots (dragonsteel and silver included), emeralds, decoration and building blocks, plain materials, and everyday food.

## Summary

146 proposed gates over 451 items, 5 Hardness additions (10 items) and 9 gate skips to fix.

| Skill | Gates | Items |
|---|---|---|
| Attack | 11 | 22 |
| Strength | 4 | 4 |
| Defence | 8 | 14 |
| Ranged | 2 | 2 |
| Hitpoints | 3 | 3 |
| Mining | 7 | 17 |
| Woodcutting | 18 | 100 |
| Farming | 7 | 21 |
| Cooking | 9 | 12 |
| Smithing | 15 | 53 |
| Crafting | 30 | 153 |
| Enchanting | 5 | 5 |
| Brewing | 5 | 14 |
| Construction | 3 | 3 |
| Agility | 19 | 72 |

**The 20 with the most effect on play:**

1. Waystones (all ten styles): place Agility 45 (Waystones)
2. The warp stone: use Agility 50 (Waystones)
3. Ghostly Mantle: wear Hitpoints 70 (Relics)
4. Dragon eggs (placing one to hatch it): use Farming 70 (Ice and Fire CE)
5. Dragonsteel swords and axes (to hit with): hold Attack 75 (Ice and Fire CE)
6. Dragonsteel tools, weapons and armour: craft Smithing 80 (Ice and Fire CE)
7. Item vaults: craft Crafting 20 (Create)
8. Magnet, compacting and advanced pickup/filter upgrades: craft Crafting 30 (Sophisticated Backpacks)
9. Gold backpacks: craft Crafting 35 (Sophisticated Backpacks)
10. Harnesses (to ride a happy ghast): craft Agility 40 (Vanilla Backport (minecraft: ids))
11. Stock tickers, redstone requesters and factory gauges: craft Crafting 45 (Create)
12. Diamond backpacks: craft Crafting 50 (Sophisticated Backpacks)
13. Blaze forgers: craft Enchanting 55 (machine) (Create: Enchantment Industry)
14. Netherite backpacks (smithing table): craft Smithing 55 (Sophisticated Backpacks)
15. Sharestones: place Agility 55 (Waystones)
16. Chorus Staff: use Agility 55 (Relics)
17. Ring of the Seven Deadly Sins: wear Strength 55 (Relics)
18. Clot of Time: use Agility 60 (Relics)
19. Midnight Mantle: wear Strength 60 (Relics)
20. Glitchy Mantle: wear Agility 65 (Relics)

## Decisions for the owner

- **Create Backpack Upgrades** (pressing 30, mixing 35): the owner asked for this mod by name (2026-09-29) and said not to nerf it without asking.
- **Dragon armour**: wearing it stays quest-gated (Dragon Slayer I). A Defence level on top (60 for dragonscale, 75 for dragonsteel) would be the RuneScape way, but it is a second gate on the same act, so it is not proposed.
- **Totems**: the Friends & Foes totems are proposed; the vanilla Totem of Undying (ungated today) would fit at Hitpoints 50.
- **Create's ore stones**: the optional Hardness entries below narrow a machine route the design leaves open on purpose.

## How to apply (once agreed)

1. `skills/unlocks.mjs`: the `craft` rows become `CRAFT` entries (`machine: true` where marked); the `chop` rows `CHOP` entries; the `brew` rows `BREW` entries (and `POTION_LEVEL` needs to accept modded potion ids, since `skills/build.mjs` writes `minecraft:<id>`); the relic rows `RELIC_WEAR` entries.
2. `skills/build.mjs`: `hold` rows become `{ WEAPON, WEAR }` requirements with Weakness (as the tier swords), `use` rows `{ TOOL, USE }`, `wear` rows `{ WEAR }` with Slowness, and `place` rows a new block rule `{ PLACE }` per block (the way the PLANT rules are written). Add them to `writeGuideData` so the skill screens list them.
3. Relics: Project MMO alone only slows the wearer; the abilities need a check like the Climbing Boots' (`SkillGates.wear`), hooked where Relics ticks or triggers an ability.
4. `enchanting/enchanting.mjs` `HARDNESS`: add the blocks to `tiers` and the materials to `materials` as listed below.
5. The skips below: extend the machine rule to Create's spout, deployer and sequenced assembly (or remove those recipes), and test the backpack smithing and anvil tabs, the imbuing table and the blaze forger against the gates.
6. Check the server log line `Skill gates in: …` after a rebuild, and rerun the skills test kit (crafting refusals) on the scratch server.

## Per mod

Each table lists the proposals first, then what is already gated, then the rest by class with the reason it stays free.

### Create (`create`)

699 items: 419 decoration/building block, 75 storage/logistics, 66 machine/automation, 53 crafting material, 28 technical/creative-only, 17 utility block, 14 transport, 11 armour, 8 tool, 5 food, 2 weapon, 1 light source.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `item_vault` | storage/logistics | none | **craft Crafting 20** | A vault block holds 20 stacks and vaults join into one big inventory (up to 3x3 across): far past a chest. The shipping containers of Create Deco and the item silo of Create Connected are the same storage from their own recipes, so they share this gate. |
| `mechanical_arm` | machine/automation | none | **craft Crafting 25** | Moves items between many inventories with no belts: the core of brass-age automation. Between the crossbow (20) and the mechanical crafter (30). |
| `elevator_pulley` | transport | none | **craft Agility 25 (machine)** | A call-anywhere lift for players. Travel sits on Agility (elytra 30, train stations 35). |
| `factory_gauge`, `redstone_requester`, `stock_ticker` | storage/logistics | none | **craft Crafting 45** | Create 6's stock keeping: order anything in a vault network from one counter and let gauges keep production topped up. The pack's answer to AE2, so it comes after the enchanting table (40). Packagers, frogports and postboxes stay open. |
| `wand_of_symmetry` | tool | none | **use Construction 40** | Mirrors every block you place across up to three planes. Made only by mechanical crafters, so the gate is on using it (a Project MMO USE rule, like the Builder's Wand). |
| `extendo_grip` | tool | none | **hold Attack 40** | Greatly increases reach for whatever is in the main hand, swords included: a PvP edge. Made only by mechanical crafters, so it is a held-item rule (Project MMO WEAR with Weakness, as swords have). Attack 40 matches the Brass Duelist set. |
| `black_toolbox`, `blue_toolbox`, `brown_toolbox`, `cyan_toolbox`, `gray_toolbox` and 11 more | storage/logistics | none | **craft Crafting 15** | A carried store that also hands tools to players nearby: an early convenience, gated like the shield (15). |
| `controls`, `track_station` | transport | craft: agility 35 (machine) | keep | Already gated: no second gate. |
| `copper_backtank`, `copper_diving_boots`, `copper_diving_helmet` | armour | pmmo: WEAR defence 5 | keep | Already gated: no second gate. |
| `deepslate_zinc_ore`, `zinc_ore` | crafting material | hardness 1 (mining 10) use-gate; hardness 1 block (mining 10) | keep | Already gated: no second gate. |
| `encased_fan` | machine/automation | craft: cooking 20 (machine) | keep | Already gated: no second gate. |
| `mechanical_crafter` | machine/automation | craft: crafting 30 (machine) | keep | Already gated: no second gate. |
| `mechanical_drill` | machine/automation | craft: mining 15 (machine) | keep | Already gated: no second gate. |
| `mechanical_harvester`, `mechanical_plough` | machine/automation | craft: farming 15 (machine) | keep | Already gated: no second gate. |
| `mechanical_saw` | machine/automation | craft: woodcutting 15 (machine) | keep | Already gated: no second gate. |
| `netherite_backtank`, `netherite_diving_boots`, `netherite_diving_helmet` | armour | pmmo: WEAR defence 50 | keep | Already gated: no second gate. |
| `potato_cannon` | weapon | use/weapon: ranged 20; pmmo: USE ranged 20, WEAPON ranged 20 | keep | Already gated: no second gate. |
| `raw_zinc`, `raw_zinc_block` | crafting material, decoration/building block | hardness 1 (mining 10) use-gate | keep | Already gated: no second gate. |
| `schematicannon` | machine/automation | craft: construction 30 (machine) | keep | Already gated: no second gate. |
| `steam_engine` | machine/automation | craft: smithing 35 (machine) | keep | Already gated: no second gate. |
| 418 items: `acacia_window`, `acacia_window_pane`, `andesite_alloy_block`, `andesite_bars` and 414 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 57 items: `adjustable_chain_gearshift`, `analog_lever`, `basin`, `blaze_burner` and 53 more | machine/automation | none | none | Kinetics, contraption parts, redstone and the open machines (press, mixer, blaze burner, deployer, millstone, crushing wheels). Create's own progression covers them; more gates would be 'too crazy'. |
| 55 items: `andesite_funnel`, `andesite_tunnel`, `black_postbox`, `blue_postbox` and 51 more | storage/logistics | none | none | Belts, funnels, tunnels, pipes, tanks, packagers, frogports and postboxes: basic logistics, open. |
| 50 items: `andesite_alloy`, `attribute_filter`, `belt_connector`, `blaze_cake` and 46 more | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 28 items: `andesite_encased_cogwheel`, `andesite_encased_large_cogwheel`, `andesite_encased_shaft`, `brass_encased_cogwheel` and 24 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 17 items: `black_seat`, `blue_seat`, `brown_seat`, `cyan_seat` and 13 more | utility block | none | none | Cheap utility blocks with no power to gate. |
| 11 items: `cart_assembler`, `chest_minecart_contraption`, `controller_rail`, `furnace_minecart_contraption` and 7 more | transport | none | none | Track, signals, minecart contraptions: the gate is the train station and controls (Agility 35). |
| 6 items: `clipboard`, `crafting_blueprint`, `linked_controller`, `schedule` and 2 more | tool | none | none | Wrench, clipboard, schedule, blueprint, super glue, linked controller: everyday Create tools. |
| 5 items: `bar_of_chocolate`, `builders_tea`, `chocolate_glazed_berries`, `honeyed_apple`, `sweet_roll` | food | none | none | Machine-made foods (spout and mixer), which only a machine makes: a gate would lock them for everyone. |
| 5 items: `cardboard_boots`, `cardboard_chestplate`, `cardboard_helmet`, `cardboard_leggings`, `goggles` | armour | none | none | Goggles and cardboard disguise armour (no protection). |
| 1 item: `cardboard_sword` | weapon | none | none | Cardboard sword (knockback toy). |
| 1 item: `rose_quartz_lamp` | light source | none | none | Light sources are decoration. |

### Create: Connected (`create_connected`)

84 items: 27 crafting material, 26 technical/creative-only, 24 machine/automation, 5 storage/logistics, 2 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `item_silo` | storage/logistics | none | **craft Crafting 20** | Same storage as the item vault from its own recipe (iron sheet and barrel): it would skip the vault gate otherwise. |
| 27 items: `black_fan_dyeing_catalyst`, `blue_fan_dyeing_catalyst`, `brown_fan_dyeing_catalyst`, `control_chip` and 23 more | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 26 items: `andesite_encased_cross_connector`, `brass_encased_cross_connector`, `copycat_beam`, `copycat_block` and 22 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 24 items: `brake`, `brass_gearbox`, `centrifugal_clutch`, `charged_kinetic_battery` and 20 more | machine/automation | none | none | Gearboxes, clutches, brakes, crank wheels, kinetic batteries, links: kinetics, open. |
| 4 items: `brass_chute`, `fluid_vessel`, `inventory_access_port`, `inventory_bridge` | storage/logistics | none | none | Fluid vessel, brass chute, inventory access port and bridge: logistics, open. |
| 2 items: `music_disc_elevator`, `music_disc_interlude` | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Create Deco (`createdeco`)

402 items: 356 decoration/building block, 24 light source, 16 storage/logistics, 6 crafting material.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `black_shipping_container`, `blue_shipping_container`, `brown_shipping_container`, `cyan_shipping_container`, `gray_shipping_container` and 11 more | storage/logistics | none | **craft Crafting 20** | Create Deco makes these from a barrel, dye and an iron sheet, no vault needed, so they would skip the vault gate. |
| 356 items: `andesite_bars`, `andesite_bars_overlay`, `andesite_catwalk`, `andesite_catwalk_railing` and 352 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 24 items: `blue_andesite_lamp`, `blue_brass_lamp`, `blue_copper_lamp`, `blue_industrial_iron_lamp` and 20 more | light source | none | none | Light sources are decoration. |
| 6 items: `andesite_sheet`, `industrial_iron_ingot`, `industrial_iron_nugget`, `industrial_iron_sheet` and 2 more | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |

### Create: Copycats+ (`copycats`)

45 items: 45 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 45 items: `copycat_beam`, `copycat_block`, `copycat_board`, `copycat_box` and 41 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Create Crafts & Additions (`createaddition`)

46 items: 26 crafting material, 9 machine/automation, 2 decoration/building block, 2 food, 2 technical/creative-only, 2 tool, 2 light source, 1 utility block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `capacitor` | crafting material | none | **craft Crafting 35** | Electricity is a second power network: electric motors turn stored power back into rotation anywhere and tesla coils charge gear and shock mobs. Motors and coils come only from mechanical crafters, so the crafting-table capacitor every one of them needs carries the gate, the way the gear sets' hand-made parts do. After the mechanical crafter (30), with the steam engine (Smithing 35). |
| `barbed_wire` | utility block | none | **craft Construction 25** | Hurts anything that walks through it: base defence on a PvP server with no land claims. |
| 25 items: `bioethanol_bucket`, `biomass`, `biomass_pellet`, `brass_rod` and 21 more | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 9 items: `alternator`, `connector`, `electric_motor`, `large_connector` and 5 more | machine/automation | none | none | Alternator, rolling mill, connectors, relays, portable energy interface, and the motor, accumulator and tesla coil (gated through the capacitor). |
| 2 items: `biomass_pellet_block`, `electrum_block` | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 2 items: `chocolate_cake`, `honey_cake` | food | none | none | Everyday food. |
| 2 items: `creative_energy`, `digital_adapter` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 2 items: `diamond_grit_sandpaper`, `electrum_amulet` | tool | none | none | Diamond-grit sandpaper and the pale gold amulet (recharges items): small conveniences. |
| 2 items: `festive_spool`, `small_light_connector` | light source | none | none | Lights on wires. |

### Create: Enchantment Industry (`create_enchantment_industry`)

17 items: 6 magic/enchanting, 5 crafting material, 3 technical/creative-only, 3 food.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `mechanical_grindstone` | magic/enchanting | none | **craft Enchanting 20 (machine)** | Automated disenchanting into liquid experience, the fuel for blaze enchanters, printers and new Hearts. |
| `experience_lantern` | magic/enchanting | none | **craft Enchanting 25** | Absorbs experience from orbs and from players standing near it (on contraptions too): an XP bank and the end of an XP farm. |
| `blaze_forger` | magic/enchanting | none | **craft Enchanting 55 (machine)** | An anvil with no repair cost that also applies and strips enchanting templates; fed Cake o' Enchanting it super-enchants, merging conflicting enchantments and passing the vanilla caps. Past the printer (50). The pack's super_enchanting data map should hold the level caps; check it does here too. |
| `blaze_enchanter`, `classic_blaze_enchanter` | magic/enchanting, technical/creative-only | craft: enchanting 35 (machine) | keep | Already gated: no second gate. |
| `printer` | magic/enchanting | craft: enchanting 50 (machine) | keep | Already gated: no second gate. |
| 5 items: `enchanting_template`, `experience_bucket`, `super_enchanting_template`, `super_experience_block`, `super_experience_nugget` | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 3 items: `experience_cake`, `experience_cake_base`, `experience_cake_slice` | food | none | none | Everyday food. |
| 2 items: `blazes_enchanting_handbook`, `grindstone_drain` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 1 item: `experience_hatch` | magic/enchanting | none | none | The experience hatch (machine-made): open. |

### Create: Dragons Plus (`create_dragons_plus`)

23 items: 18 crafting material, 3 storage/logistics, 2 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 18 items: `black_dye_bucket`, `blaze_upgrade_smithing_template`, `blue_dye_bucket`, `brown_dye_bucket` and 14 more | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 3 items: `fluid_hatch`, `fragile_fluid_tank`, `levitite_fragile_fluid_tank` | storage/logistics | none | none | Fluid hatches and fragile tanks: fluid logistics, open. |
| 2 items: `rare_blaze_package`, `rare_marble_gate_package` | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Create Ore Excavation (`createoreexcavation`)

11 items: 6 machine/automation, 2 technical/creative-only, 2 tool, 1 crafting material.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `vein_atlas`, `vein_finder` | tool | none | **craft Mining 35** | Prospecting for infinite veins. Drilling them already waits for Mining 50 (the drill head), so scouting comes a little earlier. |
| `raw_redstone` | crafting material | none | **Hardness 2 (Mining 20)**: use-gate | Raw redstone from Ore Excavation's redstone veins mills and crushes into redstone (tier II). Machines feeding it stay exempt; a player hand-milling it should not be. |
| `raw_diamond` | technical/creative-only | none | **Hardness 3 (Mining 30)**: use-gate | Raw diamond from Ore Excavation: its vein is removed, but if it ever returns it is a raw diamond. (Raw emerald stays free, like emeralds.) |
| `diamond_drill` | machine/automation | craft: mining 65 (machine) | keep | Already gated: no second gate. |
| `drill` | machine/automation | craft: mining 50 (machine) | keep | Already gated: no second gate. |
| `netherite_drill` | machine/automation | craft: mining 80 (machine) | keep | Already gated: no second gate. |
| 3 items: `drilling_machine`, `extractor`, `sample_drill` | machine/automation | none | none | The drilling machine, extractor and sample drill are mechanical-crafted; the drill heads carry the gate (Mining 50/65/80). |
| 1 item: `raw_emerald` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Create Railways Navigator (`createrailwaysnavigator`)

10 items: 9 utility block, 1 transport.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 9 items: `advanced_display`, `advanced_display_block`, `advanced_display_half_panel`, `advanced_display_panel` and 5 more | utility block | none | none | Station displays and clocks: information. |
| 1 item: `navigator` | transport | none | none | The navigator plans train routes: information, no power. |

### Create Slice & Dice (`sliceanddice`)

4 items: 3 machine/automation, 1 crafting material.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `slicer` | machine/automation | none | **craft Cooking 25 (machine)** | Automates the cutting board (slicing, butchery, bark) for Create kitchens: the next Cooking machine after the encased fan (20). |
| `floor_sprinkler`, `sprinkler` | machine/automation | none | **craft Farming 30 (machine)** | Waters and fertilises an area so crops grow faster: the next Farming machine after the harvester and plough (15). |
| 1 item: `fertilizer_bucket` | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |

### Create Backpack Upgrades (`createbackpackupgrades`)

2 items: 2 storage/logistics.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `pressing_upgrade` | storage/logistics | none | **craft Crafting 30** | A press in the backpack with no rotation. The owner asked for this mod by name, so confirm before gating it. |
| `mixing_upgrade` | storage/logistics | none | **craft Crafting 35** | A mixer in the backpack with no rotation or basin. The owner asked for this mod by name, so confirm before gating it. |

### Create Aeronautics (`aeronautics`)

46 items: 23 transport, 16 technical/creative-only, 4 crafting material, 1 armour, 1 weapon, 1 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `mounted_potato_cannon` | weapon | none | **place Ranged 30** | A cannon on an airship. The handheld potato cannon needs Ranged 20; this one is mechanical-crafted, so the gate is on placing it (a Project MMO PLACE rule). The rest of Aeronautics stays open, as decided in 1.13.0. |
| 23 items: `adjustable_burner`, `andesite_propeller`, `black_envelope`, `blue_envelope` and 19 more | transport | none | none | Airships stay open by design (pack 1.13.0: the physics assembler and flight parts are not gated). |
| 16 items: `black_envelope_encased_shaft`, `blue_envelope_encased_shaft`, `brown_envelope_encased_shaft`, `cyan_envelope_encased_shaft` and 12 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 4 items: `end_stone_powder`, `levitite`, `levitite_blend_bucket`, `pearlescent_levitite` | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 1 item: `aviators_goggles` | armour | none | none | Aviator's goggles: Create goggles with leather, cosmetic. |
| 1 item: `music_disc_cloud_skipper` | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Simulated (Aeronautics bundle) (`simulated`)

86 items: 65 transport, 13 machine/automation, 6 crafting material, 1 technical/creative-only, 1 tool.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 65 items: `auger_cog`, `auger_shaft`, `black_handle`, `black_nameplate` and 61 more | transport | none | none | Airship and contraption parts stay open by design (pack 1.13.0). |
| 13 items: `altitude_sensor`, `analog_transmission`, `directional_gearshift`, `directional_linked_receiver` and 9 more | machine/automation | none | none | Sensors and transmissions for contraptions: open with the airships. |
| 6 items: `contraption_diagram`, `engine_assembly`, `gyroscopic_mechanism`, `honey_glue` and 2 more | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 1 item: `creative_physics_staff` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 1 item: `laser_pointer` | tool | none | none | A laser pointer for sensors: no power. |

### Offroad (Aeronautics bundle) (`offroad`)

7 items: 5 transport, 2 machine/automation.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `borehead_bearing`, `rockcutting_wheel` | machine/automation | none | **craft Mining 40 (machine)** | A tunnel-boring head that cuts a wide face as it turns: the step past the drill (Mining 15). Like every machine it still only breaks up to Hardness II. |
| 5 items: `large_tire`, `monstrous_tire`, `small_tire`, `tire`, `wheel_mount` | transport | none | none | Vehicle wheels: open, like the airships they ship with. |

### Sophisticated Backpacks (`sophisticatedbackpacks`)

71 items: 52 storage/logistics, 18 technical/creative-only, 1 crafting material.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `copper_backpack` | storage/logistics | none | **craft Crafting 10** | The backpack ladder (leather stays free): each tier adds rows and upgrade slots. |
| `iron_backpack` | storage/logistics | none | **craft Crafting 20** | Backpack ladder, Andesite age. |
| `gold_backpack` | storage/logistics | none | **craft Crafting 35** | Backpack ladder, Brass age (brass casings in the recipe). |
| `diamond_backpack` | storage/logistics | none | **craft Crafting 50** | Backpack ladder: with the ender chest (50). |
| `netherite_backpack` | storage/logistics | none | **craft Smithing 55** | Backpack ladder: a netherite upgrade at the smithing table, after netherite gear (50). |
| `filter_upgrade`, `pickup_upgrade` | storage/logistics | none | **craft Crafting 5** | The first upgrades: small conveniences. |
| `crafting_upgrade`, `stack_upgrade_starter_tier` | storage/logistics | none | **craft Crafting 15** | A crafting grid on your back (its results still obey the making gates) and the first stack bonus. |
| `deposit_upgrade`, `refill_upgrade`, `restock_upgrade` | storage/logistics | none | **craft Crafting 20** | Empty into or fill from any container with a sneak-click, and keep a hotbar stack topped up. |
| `stack_upgrade_starter_tier_to_tier_1_conversion`, `stack_upgrade_tier_1`, `tank_upgrade`, `tool_swapper_upgrade`, `void_upgrade` | storage/logistics | none | **craft Crafting 25** | Mid-tier conveniences: delete junk, pick the right tool by itself, carry fluids, 2x stacks. |
| `advanced_filter_upgrade`, `advanced_pickup_upgrade`, `compacting_upgrade`, `magnet_upgrade` | storage/logistics | none | **craft Crafting 30** | Pulls in drops from a distance and packs ores and crops into blocks as you go: big quality-of-life, Brass age. |
| `advanced_deposit_upgrade`, `advanced_refill_upgrade`, `advanced_restock_upgrade`, `advanced_tool_swapper_upgrade`, `advanced_void_upgrade` and 3 more | storage/logistics | none | **craft Crafting 40** | The advanced versions add filters and remote picking; stack tier 2 (4x, the pack's cap) already needs brass casings. |
| `advanced_compacting_upgrade`, `advanced_magnet_upgrade` | storage/logistics | none | **craft Crafting 45** | Wider pull with filters, and 3x3 compacting: the strongest everyday upgrades. |
| `stonecutter_upgrade` | storage/logistics | none | **craft Construction 10** | A stonecutter on your back for builders. |
| `smelting_upgrade` | storage/logistics | none | **craft Smithing 15** | A furnace on your back, with iron (15). |
| `anvil_upgrade`, `blasting_upgrade` | storage/logistics | none | **craft Smithing 25** | A blast furnace and an anvil on your back; the anvil block itself is Smithing 20. |
| `auto_smelting_upgrade` | storage/logistics | none | **craft Smithing 40** | Smelts what you pick up with no menu at all. Note: with a pickup upgrade it can turn raw ores into free ingots past the Hardness use-gate (see the skips list). |
| `auto_blasting_upgrade` | storage/logistics | none | **craft Smithing 45** | The faster ore version of auto-smelting. |
| `smithing_upgrade` | storage/logistics | none | **craft Smithing 50** | A smithing table on your back, for netherite upgrades in the field (netherite gear is Smithing 50). Check its result slot obeys the smithing gate. |
| `smoking_upgrade` | storage/logistics | none | **craft Cooking 15** | A smoker on your back. |
| `feeding_upgrade` | storage/logistics | none | **craft Cooking 25** | Eats for you from the backpack. |
| `advanced_feeding_upgrade`, `auto_smoking_upgrade` | storage/logistics | none | **craft Cooking 40** | Cooks what you pick up; eats by your own rules. |
| `alchemy_upgrade` | storage/logistics | none | **craft Brewing 45** | Drinks potions and effect foods for you, the moment they help: strong in PvP. |
| `advanced_alchemy_upgrade` | storage/logistics | none | **craft Brewing 60** | Alchemy with effect filters: with the stronger (glowstone) potions at Brewing 60. |
| 18 items: `advanced_mob_catcher_upgrade`, `advanced_pump_upgrade`, `battery_upgrade`, `inception_upgrade` and 14 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 8 items: `advanced_jukebox_upgrade`, `backpack`, `everlasting_upgrade`, `jukebox_upgrade` and 4 more | storage/logistics | none | none | The leather backpack (day one), jukebox upgrades (music), stack downgrades, the everlasting upgrade (already behind an end crystal, Crafting 60, and a nether star) and the XP pump (needs the switched-off pump upgrade, so it cannot be made). |
| 1 item: `upgrade_base` | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |

### Sophisticated Core (`sophisticatedcore`)

2 items: 1 storage/logistics, 1 crafting material.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `ender_linker` | storage/logistics | none | **craft Crafting 50** | Links storages into one shared group, ender-chest style: with the ender chest (50). |
| 1 item: `xp_bucket` | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |

### Waystones (`waystones`)

55 items: 51 transport, 4 crafting material.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `blackstone_waystone`, `deepslate_waystone`, `end_stone_waystone`, `mossy_waystone`, `mud_bricks_waystone` and 5 more | transport | none | **place Agility 45** | Your own fast-travel point. They come only from mechanical crafters (and found ones are taken home), so the gate is on placing one; the city's global waystone stays usable for everyone. |
| `black_sharestone`, `blue_sharestone`, `brown_sharestone`, `cyan_sharestone`, `gray_sharestone` and 10 more | transport | none | **place Agility 55** | Every sharestone of a colour links for everyone: a public network. |
| `black_portstone`, `blue_portstone`, `brown_portstone`, `cyan_portstone`, `gray_portstone` and 11 more | transport | none | **place Agility 35** | Send-only stones (nothing can warp to them): cheaper and weaker than a waystone. |
| `warp_plate` | transport | none | **place Agility 40** | Paired teleport pads. |
| `warp_stone` | transport | none | **use Agility 50** | A reusable teleport to any waystone you have found, from anywhere: the strongest travel item. |
| `return_scroll` | transport | none | **craft Agility 20** | One-use teleports, made at a crafting table. |
| `warp_scroll` | transport | none | **craft Agility 30** | A one-use teleport to any waystone you have found. |
| `portal_scroll` | transport | none | **craft Agility 40** | The costliest scroll (an ender eye in the recipe). |
| 5 items: `attuned_shard`, `blank_scroll`, `bound_scroll`, `crumbling_attuned_shard`, `twinbound_feather` | transport | none | none | Blank and bound scrolls, attuned shards and the twinbound feather: cheap or made in the world from gated things. |
| 4 items: `deepslate_shard`, `dormant_shard`, `epitaph`, `warp_dust` | crafting material | none | none | Warp dust, shards and the epitaph: materials. |

### Relics (`relics`)

25 items: 20 magic/enchanting, 3 crafting material, 2 food.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `springy_boot` | magic/enchanting | none | **wear Agility 20** | Bounces you on landing and launches a crouch-jump. |
| `rider_flute` | magic/enchanting | none | **use Agility 25** | Stores a tamed mount and calls it back anywhere. |
| `cut_glass_boot` | magic/enchanting | none | **wear Agility 30** | Walks on liquids and carries fluids like a bucket. |
| `roller_skate` | magic/enchanting | none | **wear Agility 35** | Builds up speed while you run. |
| `kinetic_belt` | magic/enchanting | none | **wear Agility 45** | Glides and keeps momentum (the Aeronaut set synergy, whose set needs Agility 40). |
| `chorus_staff` | magic/enchanting | none | **use Agility 55** | Blink-teleports you forward on use: a PvP chase and escape tool. |
| `clot_of_time` | magic/enchanting | none | **use Agility 60** | Rewinds you along your recent path: an escape button (and the Prospector set synergy). |
| `glitchy_mantle` | magic/enchanting | none | **wear Agility 65** | Attacks sometimes miss you, it leaves decoys, and you can walk on air. |
| `chef_hat` | magic/enchanting | none | **wear Cooking 20** | Kills drop meatballs. |
| `experience_disperser` | magic/enchanting | none | **wear Enchanting 25** | Shares relic experience between your relics. |
| `piglin_mask` | magic/enchanting | none | **wear Defence 25** | Piglins leave you alone and barter more generously. |
| `reflective_necklace` | magic/enchanting | none | **wear Defence 45** | Stores part of the damage you take and throws it back. |
| `shield_of_retaliation` | magic/enchanting | none | **use Defence 50** | A timed parry that blocks a hit outright. |
| `jellyfish_necklace` | magic/enchanting | none | **wear Hitpoints 35** | More max health and regeneration in water or rain, plus a shock. |
| `sphere_of_self_sacrifice` | magic/enchanting | none | **use Hitpoints 45** | Spend a third of your health to heal twice that back. |
| `ghostly_mantle` | magic/enchanting | none | **wear Hitpoints 70** | Every so often it cancels a killing blow and makes you immortal for a few seconds: a free death save on a lifesteal server. |
| `hunting_belt` | magic/enchanting | none | **wear Strength 30** | Your pets hit harder, and it adds charm slots. (Strength unlocks nothing yet.) |
| `ring_of_the_seven_deadly_sins` | magic/enchanting | none | **wear Strength 55** | Big damage modifiers (height, wrath, envy) plus luck (the Brass Duelist synergy). |
| `midnight_mantle` | magic/enchanting | none | **wear Strength 60** | Moon-phase damage and attack speed, invisibility in the dark, falling stars. |
| `leafy_mantle` | magic/enchanting | none | **wear Woodcutting 50** | Walk through leaves, heal among them, and cheat death with nearby foliage: a forester's relic. |
| 3 items: `golden_tooth`, `pet_bone`, `relic_experience_bottle` | crafting material | none | none | Golden teeth, pet bones and relic experience bottles. |
| 2 items: `cooked_meatball`, `raw_meatball` | food | none | none | Meatballs from the Chef's Hat. |

### Ice and Fire CE (`iceandfire`)

509 items, read from the jar (not in the registry dump): 206 technical/creative-only, 109 armour, 63 decoration/building block, 34 crafting material, 28 tool, 25 magic/enchanting, 12 food, 12 machine/automation, 11 weapon, 8 utility block, 1 light source.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `armor_silver_metal_boots`, `armor_silver_metal_chestplate`, `armor_silver_metal_helmet`, `armor_silver_metal_leggings`, `silver_axe` and 4 more | armour, tool, weapon | none | **craft Smithing 20** | Silver is iron-plus (bonus against undead) and only comes from ice dragon dens: one step past iron (15). |
| `silver_axe`, `silver_sword` | tool, weapon | none | **hold Attack 20** | Weapon tier between iron (15) and diamond (30), as vanilla tiers do (Project MMO WEAPON). |
| `silver_pickaxe`, `silver_shovel` | tool | none | **use Mining 20** | Tool tier like the vanilla ones (Project MMO TOOL). |
| `silver_axe` | tool | none | **use Woodcutting 20** | Tool tier like the vanilla ones. |
| `silver_hoe` | tool | none | **use Farming 20** | Tool tier like the vanilla ones. |
| `armor_silver_metal_boots`, `armor_silver_metal_chestplate`, `armor_silver_metal_helmet`, `armor_silver_metal_leggings` | armour | none | **wear Defence 20** | Armour tier between iron (15) and diamond (30). |
| `copper_axe`, `copper_sword` | tool, weapon | none | **hold Attack 5** | Stone-tier weapons: the stone tier is 5. |
| `copper_pickaxe`, `copper_shovel` | tool | none | **use Mining 5** | Stone-tier tools. |
| `copper_axe` | tool | none | **use Woodcutting 5** | Stone-tier tools. |
| `copper_hoe` | tool | none | **use Farming 5** | Stone-tier tools. |
| `armor_copper_metal_boots`, `armor_copper_metal_chestplate`, `armor_copper_metal_helmet`, `armor_copper_metal_leggings` | armour | none | **wear Defence 5** | Between leather and chainmail, like Create's copper diving gear (Defence 5). |
| `dragonbone_axe`, `dragonbone_bow`, `dragonbone_hoe`, `dragonbone_pickaxe`, `dragonbone_shovel`, `dragonbone_sword` | tool, weapon | none | **craft Crafting 55** | Dragon bones and wither bones: past diamond, before netherite-plus. |
| `dragonbone_axe`, `dragonbone_sword` | tool, weapon | none | **hold Attack 55** | Between netherite (50) and the elemental swords (60). |
| `dragonbone_pickaxe`, `dragonbone_shovel` | tool | none | **use Mining 55** | Past netherite (50). |
| `dragonbone_axe` | tool | none | **use Woodcutting 55** | Past netherite (50). |
| `dragonbone_hoe` | tool | none | **use Farming 55** | Past netherite (50). |
| `dragonbone_bow` | weapon | none | **use Ranged 55** | A bow of dragon bone: past the trident (40). |
| `dragonbone_sword_fire`, `dragonbone_sword_ice`, `dragonbone_sword_lightning` | weapon | none | **craft Crafting 60** | A dragonbone sword soaked in dragon blood: burns, freezes or shocks on hit. |
| `dragonbone_sword_fire`, `dragonbone_sword_ice`, `dragonbone_sword_lightning` | weapon | none | **hold Attack 60** | Elemental damage on top of dragonbone. |
| `dragonsteel_fire_axe`, `dragonsteel_fire_boots`, `dragonsteel_fire_chestplate`, `dragonsteel_fire_helmet`, `dragonsteel_fire_hoe` and 22 more | tool, armour, weapon | quest: wear needs q_ds_done (Dragon Slayer I) | **craft Smithing 80** | The best gear in the pack, from ingots forged in a dragon's breath. Ingots stay free (the rule for ingots); making the gear is master smithing, past the mace (70). |
| `dragonsteel_fire_axe`, `dragonsteel_fire_sword`, `dragonsteel_ice_axe`, `dragonsteel_ice_sword`, `dragonsteel_lightning_axe`, `dragonsteel_lightning_sword` | tool, weapon | none | **hold Attack 75** | Stronger than netherite (50) and the Stormcaller's Sabre (50): only armour is quest-gated today, so the weapons have no gate at all. |
| `dragonsteel_fire_pickaxe`, `dragonsteel_fire_shovel`, `dragonsteel_ice_pickaxe`, `dragonsteel_ice_shovel`, `dragonsteel_lightning_pickaxe`, `dragonsteel_lightning_shovel` | tool | none | **use Mining 75** | The fastest picks in the pack. |
| `dragonsteel_fire_axe`, `dragonsteel_ice_axe`, `dragonsteel_lightning_axe` | tool | none | **use Woodcutting 75** | The fastest axes in the pack. |
| `dragonsteel_fire_hoe`, `dragonsteel_ice_hoe`, `dragonsteel_lightning_hoe` | tool | none | **use Farming 75** | The best hoes in the pack. |
| `armor_amethyst_boots`, `armor_amethyst_chestplate`, `armor_amethyst_helmet`, `armor_amethyst_leggings`, `armor_black_boots` and 43 more | armour | quest: wear needs q_ds_done (Dragon Slayer I) | **craft Crafting 60** | Wearing it already needs Dragon Slayer I; making it from scales becomes a Crafting feat, with the end crystal (60). (Optional, not proposed: a Defence 60 wear level on top of the quest gate.) |
| `dragonforge_fire_core_disabled`, `dragonforge_ice_core_disabled`, `dragonforge_lightning_core_disabled` | machine/automation | none | **craft Smithing 70 (machine)** | The forge that turns iron into dragonsteel with a dragon's breath. It runs with no player (dragonsteel is an ingot), so the gate is on building it, as with Create's machines. |
| `dragonegg_amethyst`, `dragonegg_black`, `dragonegg_blue`, `dragonegg_bronze`, `dragonegg_copper` and 7 more | magic/enchanting | none | **use Farming 70** | A dragon is the strongest mount, pet and forge fuel in the pack. Raising one is master husbandry; the egg can still be carried, traded and kept (a Project MMO USE rule on placing it). |
| `summoning_crystal_fire`, `summoning_crystal_ice`, `summoning_crystal_lightning` | magic/enchanting | none | **craft Crafting 65** | Store your dragon and call it to you anywhere. |
| `dragon_horn` | magic/enchanting | none | **craft Crafting 45** | Carries a tamed dragon as an item. |
| `dragon_seeker` | magic/enchanting | none | **craft Crafting 45** | Points at the nearest dragon: hunting roosts for scales and bones. |
| `epic_dragon_seeker` | magic/enchanting | none | **craft Smithing 55** | Longer range seeker. |
| `legendary_dragon_seeker` | magic/enchanting | none | **craft Smithing 70** | The best seeker. |
| `cooked_rice_with_fire_dragon_meat`, `cooked_rice_with_ice_dragon_meat`, `cooked_rice_with_lightning_dragon_meat` | food | none | **craft Cooking 60** | Exotic dishes from dragon flesh, past the feasts (50). |
| `silver_ore`, `deepslate_silver_ore`, `raw_silver`, `raw_silver_block` | crafting material | none | **Hardness 2 (Mining 20)**: breaking and use | Ice and Fire silver: gold-rare (only in ice dragon dens, its world ore is switched off). Ingots stay free, as with every metal. |
| `sapphire_ore`, `sapphire_gem`, `sapphire_block` | crafting material, decoration/building block | none | **Hardness 3 (Mining 30)**: breaking and use | Ice and Fire sapphire is a gem from ice dragon dens, a diamond-tier find (emeralds stay free only because they are money). |
| 206 items: `amphithere_arrow`, `amphithere_feather`, `amphithere_macuahuitl`, `amphithere_skull` and 202 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 62 items: `ash`, `banner_pattern_bird`, `banner_pattern_eye`, `banner_pattern_fae` and 58 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 41 items: `blindfold`, `dragonarmor_copper_body`, `dragonarmor_copper_head`, `dragonarmor_copper_neck` and 37 more | armour | none | none | Armour for a tamed dragon (only matters once you hatch one) and the blindfold. |
| 28 items: `chain_link`, `copper_nugget`, `dragonbone`, `dragonscales_amethyst` and 24 more | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 9 items: `ambrosia`, `cannoli`, `fire_dragon_flesh`, `fire_stew` and 5 more | food | none | none | Dragon flesh and stews (dragon food) and odd foods. |
| 9 items: `dragonforge_fire_brick`, `dragonforge_fire_core`, `dragonforge_fire_input`, `dragonforge_ice_brick` and 5 more | machine/automation | none | none | Dragonforge bricks and inputs: the core carries the gate. |
| 8 items: `lectern`, `nest`, `podium_acacia`, `podium_birch` and 4 more | utility block | none | none | Podiums, lecterns, nests: display blocks. |
| 6 items: `dragon_flute`, `dragon_meal`, `dragon_stick`, `godly_dragon_seeker` and 2 more | magic/enchanting | none | none | Dragon staff, flute and meals, bestiary, chains: tools for a dragon you already hatched (the egg is the gate). |
| 4 items: `bestiary`, `chain`, `chain_sticky`, `fishing_spear` | tool | none | none | Chains, the bestiary and the fishing spear (no recipe here). |
| 1 item: `burnt_torch` | light source | none | none | Light sources are decoration. |
| 1 item: `dragonbone_arrow` | weapon | none | none | Minor weapons. |

### Farmer's Delight (`farmersdelight`)

185 items: 84 food, 47 utility block, 20 storage/logistics, 16 crafting material, 10 decoration/building block, 5 tool, 2 technical/creative-only, 1 weapon.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `golden_knife` | tool | none | **craft Smithing 10** | The vanilla gold tier (Smithing 10). |
| `iron_knife`, `skillet` | tool, weapon | none | **craft Smithing 15** | The vanilla iron tier (Smithing 15). |
| `diamond_knife` | tool | none | **craft Crafting 30** | The vanilla diamond tier (Crafting 30). |
| `netherite_knife` | tool | none | **craft Smithing 50** | The vanilla netherite tier (Smithing 50). |
| `flint_knife` | tool | none | **hold Attack 5** | The stone tier (5). |
| `golden_knife` | tool | none | **hold Attack 10** | Knives are fast weapons with Backstabbing: same tiers as swords. |
| `iron_knife`, `skillet` | tool, weapon | none | **hold Attack 15** | Iron-tier weapons. |
| `diamond_knife` | tool | none | **hold Attack 30** | Diamond-tier weapon. |
| `netherite_knife` | tool | none | **hold Attack 50** | Netherite-tier weapon. |
| `melon_juice` | food | none | **craft Cooking 15** | A drink with minor instant health. |
| `hot_cocoa` | food | none | **craft Cooking 25** | Clears a harmful effect: a cure in a mug. |
| `gleaming_salad_block` | food | none | **craft Cooking 50** | Farmer's Delight's newest feast, missing from the feasts gate (Cooking 50). |
| `organic_compost` | utility block | none | **craft Farming 20** | Turns into rich soil, which speeds every crop planted on it. |
| `apple_pie`, `bacon_and_eggs`, `chocolate_pie`, `grilled_salmon`, `pasta_with_meatballs` and 6 more | food | craft: cooking 30 | keep | Already gated: no second gate. |
| `bacon_sandwich`, `chicken_sandwich`, `egg_sandwich`, `fruit_salad`, `mixed_salad` | food | craft: cooking 5 | keep | Already gated: no second gate. |
| `baked_cod_stew`, `beef_stew`, `cabbage_rolls`, `cod_roll`, `dumplings` and 6 more | food | craft: cooking 20 | keep | Already gated: no second gate. |
| `bone_broth`, `chicken_soup`, `hamburger`, `mutton_wrap`, `noodle_soup` and 3 more | food | craft: cooking 10 | keep | Already gated: no second gate. |
| `cabbage_seeds`, `onion` | crafting material | plant: farming 5 | keep | Already gated: no second gate. |
| `glow_berry_custard`, `nether_salad`, `squid_ink_pasta` | food | craft: cooking 40 | keep | Already gated: no second gate. |
| `honey_glazed_ham_block`, `rice_roll_medley_block`, `roast_chicken_block`, `shepherds_pie_block`, `stuffed_pumpkin_block` | food | craft: cooking 50 | keep | Already gated: no second gate. |
| `rice` | crafting material | plant: farming 20 | keep | Already gated: no second gate. |
| `tomato_seeds` | crafting material | plant: farming 10 | keep | Already gated: no second gate. |
| 46 items: `black_canvas_sign`, `black_hanging_canvas_sign`, `blue_canvas_sign`, `blue_hanging_canvas_sign` and 42 more | utility block | none | none | Cooking pot, stove, cutting board, signs, rope, safety nets, tatami, rich soil: the gate is on the dishes, not the kitchen. |
| 38 items: `apple_cider`, `apple_pie_slice`, `bacon`, `barbecue_stick` and 34 more | food | none | none | Ingredients, cuts and snacks (cooked rice, patties, cookies, popsicles, apple cider, dog food, horse feed): low value, or already gated (see above). |
| 20 items: `acacia_cabinet`, `bamboo_basket`, `bamboo_cabinet`, `beetroot_crate` and 16 more | storage/logistics | none | none | Cabinets, baskets, crates and the rice bag: chest-class storage. |
| 12 items: `cabbage`, `cabbage_leaf`, `canvas`, `milk_bottle` and 8 more | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 10 items: `brown_mushroom_colony`, `red_mushroom_colony`, `sandy_shrub`, `wild_beetroots` and 6 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 2 items: `debug_pumpkin_pie`, `rich_soil_farmland` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Friends & Foes (`friendsandfoes`)

43 items: 15 machine/automation, 10 utility block, 10 technical/creative-only, 3 crafting material, 2 decoration/building block, 2 magic/enchanting, 1 armour.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `totem_of_freezing` | magic/enchanting | none | **wear Defence 40** | Freezes everything near you when you drop below half health (works from the charm slot). Consider the vanilla Totem of Undying at Hitpoints 50 too. |
| `totem_of_illusion` | magic/enchanting | none | **wear Agility 45** | Turns you invisible and leaves decoys when you drop below half health: an escape. |
| `wildfire_crown` | armour | none | **wear Defence 45** | The Nether citadel boss's helmet: with the loot-only Ember Crown (40). |
| `crab_claw` | crafting material | none | **brew Brewing 45** | Longer block reach. With Weakness, Harming and Invisibility (45). |
| 15 items: `copper_button`, `exposed_copper_button`, `exposed_lightning_rod`, `oxidized_copper_button` and 11 more | machine/automation | none | none | Copper buttons and lightning rods. |
| 10 items: `acacia_beehive`, `bamboo_beehive`, `birch_beehive`, `cherry_beehive` and 6 more | utility block | none | none | Beehives in every wood. |
| 10 items: `copper_golem_spawn_egg`, `crab_spawn_egg`, `glare_spawn_egg`, `iceologer_spawn_egg` and 6 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 2 items: `buttercup`, `music_disc_around_the_corner` | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 2 items: `crab_egg`, `wildfire_crown_fragment` | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |

### Illager Invasion (`illagerinvasion`)

23 items: 13 technical/creative-only, 6 crafting material, 2 tool, 1 magic/enchanting, 1 weapon.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `imbuing_table` | magic/enchanting | none | **craft Enchanting 65** | Pushes an enchantment one level past its maximum: the only way past the caps besides the skill. Check it respects the Enchanting caps. |
| `platinum_sheet` | crafting material | none | **craft Smithing 45** | Platinum trims carry effects (agility, endurance, featherweight, insight), so trimming becomes more than cosmetic; trim copying is Smithing 40. |
| `horn_of_sight` | tool | none | **craft Crafting 45** | Reveals the creatures around you: scouting. |
| `lost_candle` | tool | none | **use Mining 40** | Tells you which ores are nearby: prospecting. Loot-only, so the gate is on using it. |
| `platinum_infused_hatchet` | weapon | none | **hold Strength 40** | A heavy illager weapon. (Strength unlocks nothing yet.) |
| `goat_horn` | vanilla item | none | **brew Brewing 40** | Illager Invasion's potion, brewed from an awkward potion and a goat horn; with Regeneration (40). |
| 13 items: `alchemist_spawn_egg`, `archivist_spawn_egg`, `basher_spawn_egg`, `firecaller_spawn_egg` and 9 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 5 items: `hallowed_gem`, `illusionary_dust`, `platinum_chunk`, `primal_essence`, `unusual_dust` | crafting material | none | none | Dusts, gems and essences dropped by illagers; their uses are gated. |

### Piglin Proliferation (`piglinproliferation`)

18 items: 10 magic/enchanting, 4 decoration/building block, 2 technical/creative-only, 1 armour, 1 tool.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `buckler` | armour | none | **hold Defence 45** | A shield with a charge: bash through, explode, and a guaranteed critical after. |
| `blackstone_fire_ring`, `blackstone_soul_fire_ring`, `deepslate_fire_ring`, `deepslate_soul_fire_ring`, `end_stone_fire_ring` and 5 more | magic/enchanting | none | **craft Brewing 40** | A campfire you infuse with a potion so it gives the effect to everyone nearby. |
| 4 items: `piglin_alchemist_head`, `piglin_brute_head`, `piglin_traveler_head`, `zombified_piglin_head` | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 2 items: `piglin_alchemist_spawn_egg`, `piglin_traveler_spawn_egg` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 1 item: `travelers_compass` | tool | none | none | The Traveler's Compass: a curiosity. |

### Vanilla Backport (minecraft: ids) (`minecraft`)

110 items: 65 decoration/building block, 19 transport, 16 storage/logistics, 5 crafting material, 3 technical/creative-only, 1 utility block, 1 light source.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `black_harness`, `blue_harness`, `brown_harness`, `cyan_harness`, `gray_harness` and 11 more | transport | none | **craft Agility 40** | A happy ghast is a flying mount for four, reachable in the Nether before the elytra (Agility 30 to wear); the harness is what lets you ride it. |
| `black_bundle`, `blue_bundle`, `brown_bundle`, `bundle`, `cyan_bundle` and 12 more | storage/logistics, vanilla item | none | **craft Crafting 10** | Many kinds of item in one slot; Vanilla Backport turns their recipe on. |
| `pale_oak_log`, `pale_oak_wood`, `stripped_pale_oak_log`, `stripped_pale_oak_wood` | decoration/building block | none | **chop Woodcutting 40** | The creaking's eerie forest: with the dark oaks (35) of the CHOP ladder. |
| 61 items: `bush`, `cactus_flower`, `chiseled_cinnabar`, `chiseled_resin_bricks` and 57 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 5 items: `blue_egg`, `brown_egg`, `resin_clump`, `sulfur`, `sulfur_cube_bucket` | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 3 items: `creaking_spawn_egg`, `happy_ghast_spawn_egg`, `sulfur_cube_spawn_egg` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 3 items: `dried_ghast`, `pale_oak_boat`, `pale_oak_chest_boat` | transport | none | none | Pale oak boats, and the dried ghast (the harness is the gate for riding). |
| 1 item: `creaking_heart` | utility block | none | none | The creaking heart: a mob spawner block from the pale garden. |
| 1 item: `firefly_bush` | light source | none | none | Light sources are decoration. |

### Regions Unexplored (`regions_unexplored`)

730 items: 628 decoration/building block, 51 technical/creative-only, 32 transport, 9 light source, 8 crafting material, 2 food.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `pine_log`, `pine_wood`, `stripped_pine_log`, `stripped_pine_wood` | decoration/building block | none | **chop Woodcutting 10** | Common taiga trees: a first step. |
| `bamboo_log`, `palm_log`, `palm_wood`, `stripped_bamboo_log`, `stripped_palm_log`, `stripped_palm_wood` | decoration/building block | none | **chop Woodcutting 15** | Tropical trees, with jungle trees (15). |
| `joshua_log`, `joshua_wood`, `larch_log`, `larch_wood`, `stripped_joshua_log` and 3 more | decoration/building block | none | **chop Woodcutting 20** | Desert and golden-taiga trees. |
| `ashen_log`, `ashen_wood`, `blue_bioshroom_hyphae`, `blue_bioshroom_stem`, `cypress_log` and 17 more | decoration/building block | none | **chop Woodcutting 25** | Bayou, burnt-forest and cave trees. |
| `stripped_willow_log`, `stripped_willow_wood`, `willow_log`, `willow_wood` | decoration/building block | none | **chop Woodcutting 30** | RuneScape's willow is level 30. |
| `eucalyptus_log`, `eucalyptus_wood`, `stripped_eucalyptus_log`, `stripped_eucalyptus_wood` | decoration/building block | none | **chop Woodcutting 35** | With dark oak (35), like RuneScape's teak. |
| `baobab_log`, `baobab_wood`, `magnolia_log`, `magnolia_wood`, `stripped_baobab_log` and 7 more | decoration/building block | none | **chop Woodcutting 40** | Flowering and savanna giants. |
| `maple_log`, `maple_wood`, `stripped_maple_log`, `stripped_maple_wood` | decoration/building block | none | **chop Woodcutting 45** | RuneScape's maple is level 45. |
| `kapok_log`, `kapok_wood`, `stripped_kapok_log`, `stripped_kapok_wood` | decoration/building block | none | **chop Woodcutting 50** | Rainforest giants, like RuneScape's mahogany (50). |
| `blackwood_log`, `blackwood_wood`, `socotra_log`, `socotra_wood`, `stripped_blackwood_log` and 3 more | decoration/building block | none | **chop Woodcutting 55** | Rare dragon-blood trees and the dark blackwood taiga. |
| `brimwood_log`, `brimwood_log_magma`, `brimwood_wood`, `cobalt_log`, `cobalt_wood` and 4 more | decoration/building block | none | **chop Woodcutting 65** | Nether trees past crimson and warped stems (60). |
| `redwood_log`, `redwood_wood`, `stripped_redwood_log`, `stripped_redwood_wood` | decoration/building block | none | **chop Woodcutting 70** | RuneScape's redwood is the top tree (90 there); these giants drop the most logs per tree. |
| `cobalt_obsidian` | crafting material | none | **Hardness 3 (Mining 30)**: breaking and use | Regions Unexplored's cobalt obsidian is tagged #c:obsidians (crying), so tag-based recipes (the wand of symmetry, the backpack void upgrade) take it in place of obsidian, and a diamond pickaxe breaks it with no Hardness. |
| `raw_redstone_block` | crafting material | hardness 2 (mining 20) use-gate; hardness 2 block (mining 20) | keep | Already gated: no second gate. |
| 539 items: `acacia_branch`, `acacia_shrub`, `alpha_dandelion`, `alpha_grass_block` and 535 more | decoration/building block | none | none | Plants, soils, stone and the oak-like woods (small oak, silver birch, alpha and dead trees stay free like oak and birch). |
| 51 items: `black_painted_planks`, `black_painted_slab`, `black_painted_stairs`, `bladed_tall_grass` and 47 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 32 items: `baobab_boat`, `baobab_chest_boat`, `blackwood_boat`, `blackwood_chest_boat` and 28 more | transport | none | none | Boats in the new woods: vanilla-level. |
| 9 items: `cobalt_earlight`, `glister_bulb`, `glowing_blue_bioshroom_block`, `glowing_green_bioshroom_block` and 5 more | light source | none | none | Light sources are decoration. |
| 6 items: `hanging_prismarite`, `large_prismarite_cluster`, `pointed_redstone`, `prismarite_cluster` and 2 more | crafting material | none | none | Prismarite crystals, and redstone buds, bulbs and pointed redstone, which only give or smelt into redstone (already use-gated at tier II). |
| 2 items: `duskmelon_slice`, `salmonberry` | food | none | none | Everyday food. |

### Naturalist (`naturalist`)

141 items: 47 technical/creative-only, 32 crafting material, 28 food, 24 decoration/building block, 7 light source, 2 tool, 1 storage/logistics.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 47 items: `alligator_spawn_egg`, `anglerfish_spawn_egg`, `ant_spawn_egg`, `bass_spawn_egg` and 43 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 32 items: `alligator_egg`, `anglerfish_bucket`, `ant`, `antler` and 28 more | crafting material | none | none | Plain materials stay free; where they matter, what they make is gated. |
| 28 items: `anglerfish`, `bass`, `blobfish`, `bushmeat` and 24 more | food | none | none | Everyday food. |
| 24 items: `ant_hill`, `blue_starfish`, `cut_shellstone`, `cut_shellstone_slab` and 20 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 7 items: `azure_froglass`, `azure_froglass_pane`, `crimson_froglass`, `crimson_froglass_pane` and 3 more | light source | none | none | Light sources are decoration. |
| 2 items: `capture_net`, `whistle` | tool | none | none | Capture net and whistle: no power. |
| 1 item: `knapsack` | storage/logistics | none | none | The knapsack: small. |

### Creeper Overhaul (`creeperoverhaul`)

17 items: 16 technical/creative-only, 1 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 16 items: `badlands_creeper_spawn_egg`, `bamboo_creeper_spawn_egg`, `beach_creeper_spawn_egg`, `birch_creeper_spawn_egg` and 12 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |
| 1 item: `tiny_cactus` | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Variants & Ventures (`variantsandventures`)

4 items: 4 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 4 items: `gelid_spawn_egg`, `murk_spawn_egg`, `thicket_spawn_egg`, `verdant_spawn_egg` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Guard Villagers (`guardvillagers`)

2 items: 2 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 2 items: `guard_spawn_egg`, `illusioner_spawn_egg` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Woodworks (`woodworks`)

83 items: 40 decoration/building block, 22 storage/logistics, 21 utility block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 40 items: `acacia_boards`, `acacia_bookshelf`, `acacia_leaf_pile`, `azalea_leaf_pile` and 36 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 22 items: `acacia_chest`, `bamboo_closet`, `birch_chest`, `cherry_chest` and 18 more | storage/logistics | none | none | Wooden chests and closets: vanilla chest-class. |
| 21 items: `acacia_beehive`, `acacia_ladder`, `bamboo_beehive`, `bamboo_ladder` and 17 more | utility block | none | none | Cheap utility blocks with no power to gate. |

### Every Compat (`everycomp`)

1719 items: 1040 storage/logistics, 606 decoration/building block, 72 utility block, 1 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 1040 items: `abnww/minecraft/pale_oak_chest`, `abnww/minecraft/trapped_pale_oak_chest`, `abnww/regions_unexplored/alpha_chest`, `abnww/regions_unexplored/baobab_chest` and 1036 more | storage/logistics | none | none | Every Compat wood variants of chests, cabinets and furniture with storage: chest-class. |
| 606 items: `abnww/minecraft/chiseled_pale_oak_bookshelf`, `abnww/minecraft/pale_oak_boards`, `abnww/minecraft/pale_oak_bookshelf`, `abnww/minecraft/pale_oak_leaf_pile` and 602 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 72 items: `abnww/minecraft/pale_oak_beehive`, `abnww/minecraft/pale_oak_ladder`, `abnww/regions_unexplored/alpha_beehive`, `abnww/regions_unexplored/alpha_ladder` and 68 more | utility block | none | none | Cheap utility blocks with no power to gate. |
| 1 item: `all_woods` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Macaw's Furniture (`mcwfurnitures`)

654 items: 442 storage/logistics, 212 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 442 items: `acacia_bookshelf_cupboard`, `acacia_bookshelf_drawer`, `acacia_counter`, `acacia_covered_desk` and 438 more | storage/logistics | none | none | Drawers, wardrobes, cabinets, counters and desks with a few slots: chest-class storage, decoration first. |
| 212 items: `acacia_bookshelf`, `acacia_chair`, `acacia_coffee_table`, `acacia_end_table` and 208 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Macaw's Roofs (`mcwroofs`)

607 items, read from the jar (not in the registry dump): 607 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 607 items: `acacia_attic_roof`, `acacia_lower_roof`, `acacia_planks_attic_roof`, `acacia_planks_lower_roof` and 603 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Macaw's Windows (`mcwwindows`)

326 items, read from the jar (not in the registry dump): 326 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 326 items: `acacia_blinds`, `acacia_curtain_rod`, `acacia_four_window`, `acacia_log_parapet` and 322 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Macaw's Doors (`mcwdoors`)

261 items, read from the jar (not in the registry dump): 260 decoration/building block, 1 tool.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 260 items: `acacia_bamboo_door`, `acacia_bark_glass_door`, `acacia_barn_door`, `acacia_barn_glass_door` and 256 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |
| 1 item: `garage_remote` | tool | none | none | The garage door remote. |

### Macaw's Trapdoors (`mcwtrpdoors`)

191 items, read from the jar (not in the registry dump): 191 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 191 items: `acacia_bamboo_trapdoor`, `acacia_bark_trapdoor`, `acacia_barn_trapdoor`, `acacia_barred_trapdoor` and 187 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Macaw's Fences and Walls (`mcwfences`)

180 items, read from the jar (not in the registry dump): 180 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 180 items: `acacia_curved_gate`, `acacia_hedge`, `acacia_highley_gate`, `acacia_horse_fence` and 176 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Macaw's Lights and Lamps (`mcwlights`)

140 items, read from the jar (not in the registry dump): 140 light source.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 140 items: `acacia_ceiling_fan_light`, `acacia_tiki_torch`, `bamboo_tiki_torch`, `bell_lantern` and 136 more | light source | none | none | Light sources are decoration. |

### Macaw's Paths and Pavings (`mcwpaths`)

315 items, read from the jar (not in the registry dump): 315 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 315 items: `acacia_planks_path`, `andesite_basket_weave_paving`, `andesite_clover_paving`, `andesite_crystal_floor` and 311 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Macaw's Bridges (`mcwbridges`)

146 items, read from the jar (not in the registry dump): 146 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 146 items: `acacia_bridge_pier`, `acacia_log_bridge_middle`, `acacia_log_bridge_stair`, `acacia_rail_bridge` and 142 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### Macaw's Stairs (`mcwstairs`)

224 items, read from the jar (not in the registry dump): 224 decoration/building block.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 224 items: `acacia_balcony`, `acacia_bulk_stairs`, `acacia_compact_stairs`, `acacia_loft_stairs` and 220 more | decoration/building block | none | none | Decoration and building blocks stay free (the design rule). |

### GraveStone (`gravestone`)

2 items: 1 utility block, 1 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 1 item: `gravestone` | utility block | none | none | A decorative grave (the real graves need Grave Essence). |
| 1 item: `obituary` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Lootr (`lootr`)

9 items: 9 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 9 items: `decorated_pot`, `lootr_barrel`, `lootr_chest`, `lootr_inventory` and 5 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### FTB Quests (`ftbquests`)

13 items: 13 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 13 items: `barrier`, `book`, `custom_icon`, `detector` and 9 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### FTB Library (`ftblibrary`)

1 item: 1 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 1 item: `icon_item` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Patchouli (`patchouli`)

1 item: 1 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 1 item: `guide_book` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Moonlight Lib (`moonlight`)

2 items: 2 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 2 items: `placeable_item`, `spawn_box` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### DragonLib (`dragonlib`)

1 item: 1 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 1 item: `dragon` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Easy NPC: Core (`easy_npc`)

55 items, read from the jar (not in the registry dump): 55 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 55 items: `allay_spawn_egg`, `bogged_spawn_egg`, `boss_spawner`, `bullet` and 51 more | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Easy NPC: Config UI (`easy_npc_config_ui`)

2 items, read from the jar (not in the registry dump): 2 technical/creative-only.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| 2 items: `easy_npc_wand`, `preset_browser` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### LemurSaucePacket (KubeJS items) (`lemursaucepacket`)

75 items: 33 technical/creative-only, 22 armour, 9 crafting material, 7 tool, 3 weapon, 1 magic/enchanting.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `aeronaut_boots`, `aeronaut_chestplate`, `aeronaut_helmet`, `aeronaut_leggings` | armour | pmmo: WEAR agility 40 | keep | Already gated: no second gate. |
| `aeronaut_rigging` | crafting material | craft: crafting 35 | keep | Already gated: no second gate. |
| `agility_cape`, `armory_cape`, `attack_cape`, `beacon_cape`, `brass_age_cape` and 28 more | technical/creative-only | earned (cape unlock) | keep | Earned, never crafted. |
| `anglers_cap` | armour | pmmo: WEAR fishing 25 | keep | Already gated: no second gate. |
| `brass_sabre` | weapon | pmmo: WEAPON attack 25 | keep | Already gated: no second gate. |
| `builders_wand` | tool | pmmo: TOOL crafting 30, USE crafting 30 | keep | Already gated: no second gate. |
| `compacted_diamond_boots`, `compacted_diamond_chestplate`, `compacted_diamond_helmet`, `compacted_diamond_leggings` | armour | pmmo: WEAR defence 45 | keep | Already gated: no second gate. |
| `compacted_netherite_boots`, `compacted_netherite_chestplate`, `compacted_netherite_helmet`, `compacted_netherite_leggings` | armour | craft: smithing 65; pmmo: WEAR defence 60 | keep | Already gated: no second gate. |
| `diamond_lattice` | crafting material | craft: smithing 45 | keep | Already gated: no second gate. |
| `duelist_boots`, `duelist_chestplate`, `duelist_helmet`, `duelist_leggings` | armour | pmmo: WEAR attack 40 | keep | Already gated: no second gate. |
| `duelists_filigree` | crafting material | craft: crafting 40 | keep | Already gated: no second gate. |
| `ember_crown` | armour | pmmo: WEAR defence 40 | keep | Already gated: no second gate. |
| `excavators_pickaxe` | tool | pmmo: TOOL mining 40, USE mining 40 | keep | Already gated: no second gate. |
| `harvesters_scythe` | tool | pmmo: TOOL farming 30, USE farming 30 | keep | Already gated: no second gate. |
| `lumber_axe` | tool | pmmo: TOOL woodcutting 30, USE woodcutting 30 | keep | Already gated: no second gate. |
| `prospector_boots`, `prospector_chestplate`, `prospector_helmet`, `prospector_leggings` | armour | pmmo: WEAR mining 35 | keep | Already gated: no second gate. |
| `prospector_plating` | crafting material | craft: smithing 25 | keep | Already gated: no second gate. |
| `prospectors_pickaxe` | tool | pmmo: TOOL mining 30, USE mining 30 | keep | Already gated: no second gate. |
| `stormcallers_sabre` | weapon | pmmo: WEAPON attack 50 | keep | Already gated: no second gate. |
| `sturdy_warhammer` | weapon | pmmo: WEAPON attack 45 | keep | Already gated: no second gate. |
| 5 items: `compacted_diamond`, `compacted_netherite`, `duelists_pattern`, `grave_essence`, `incomplete_heart` | crafting material | none | none | Compacted diamond and netherite, the Duelist pattern (loot-only), Grave Essence, the incomplete Heart. |
| 2 items: `lost_item_compass`, `seekers_compass` | tool | none | none | The lifesteal compasses (Lost Item, Seeker's): the owner's lifesteal design, left as it is. |
| 1 item: `heart` | magic/enchanting | none | none | The Heart: the lifesteal currency (a late sequenced assembly), left as it is. |

### lsp_fixes (the companion mod) (`lsp_fixes`)

4 items, read from the jar (not in the registry dump): 2 technical/creative-only, 1 armour, 1 tool.

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `climbing_boots` | armour | craft: crafting 20; wear: agility 25 (relic); pmmo: WEAR agility 25 | keep | Already gated: no second gate. |
| `masons_palette` | tool | use: construction 99 (palette) | keep | Already gated: no second gate. |
| 2 items: `coin_pouch`, `gold_coins` | technical/creative-only | none | none | Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden). |

### Vanilla items that a mod gives a new use

| Item(s) | Class | Current gate | Proposed gate | Reason |
|---|---|---|---|---|
| `goat_horn` | vanilla item | none | **brew Brewing 40** | Illager Invasion's potion, brewed from an awkward potion and a goat horn; with Regeneration (40). |
| `bundle` | vanilla item | none | **craft Crafting 10** | Many kinds of item in one slot; Vanilla Backport turns their recipe on. |

## Hardness additions

The Hardness tiers today: 1 = #c:ores/iron, #c:ores/zinc, #c:ores/lapis (Mining 10); 2 = #c:ores/gold, #c:ores/redstone (Mining 20); 3 = #c:ores/diamond, #c:ores/emerald, minecraft:obsidian, minecraft:crying_obsidian (Mining 30); 4 = #c:ores/netherite_scrap (Mining 40); 5 = minecraft:reinforced_deepslate, minecraft:budding_amethyst (Mining 50). Create's zinc is already in tier I through its `c:` tags, and Regions Unexplored's raw redstone block is already in tier II (NeoForge's `c:ores/redstone` includes `#minecraft:redstone_ores`, which it joins).

| Tier | Blocks (break) | Materials (use-gate) | Resolves to | Why |
|---|---|---|---|---|
| 2 (Mining 20) | `#c:ores/silver` | `#c:ores/silver`, `#c:raw_materials/silver`, `#c:storage_blocks/raw_silver` | `iceandfire:silver_ore`, `iceandfire:deepslate_silver_ore`, `iceandfire:raw_silver`, `iceandfire:raw_silver_block` | Ice and Fire silver: gold-rare (only in ice dragon dens, its world ore is switched off). Ingots stay free, as with every metal. |
| 2 (Mining 20) | - | `createoreexcavation:raw_redstone` | `createoreexcavation:raw_redstone` | Raw redstone from Ore Excavation's redstone veins mills and crushes into redstone (tier II). Machines feeding it stay exempt; a player hand-milling it should not be. |
| 3 (Mining 30) | `#c:ores/sapphire` | `#c:ores/sapphire`, `#c:gems/sapphire`, `iceandfire:sapphire_block` | `iceandfire:sapphire_ore`, `iceandfire:sapphire_gem`, `iceandfire:sapphire_block` | Ice and Fire sapphire is a gem from ice dragon dens, a diamond-tier find (emeralds stay free only because they are money). |
| 3 (Mining 30) | `regions_unexplored:cobalt_obsidian` | `regions_unexplored:cobalt_obsidian` | `regions_unexplored:cobalt_obsidian` | Regions Unexplored's cobalt obsidian is tagged #c:obsidians (crying), so tag-based recipes (the wand of symmetry, the backpack void upgrade) take it in place of obsidian, and a diamond pickaxe breaks it with no Hardness. |
| 3 (Mining 30) | - | `createoreexcavation:raw_diamond` | `createoreexcavation:raw_diamond` | Raw diamond from Ore Excavation: its vein is removed, but if it ever returns it is a raw diamond. (Raw emerald stays free, like emeralds.) |

Optional (not recommended unless the Create route matters):

| Tier | Materials | Why |
|---|---|---|
| 1 | `create:crimsite`, `create:asurine` | Crushing crimsite gives crushed raw iron and asurine crushed raw zinc with no Mining level (they mine like stone). Materials list only: the stones stay breakable and placeable, but a player could no longer hand-feed them to a millstone or crusher. Crushing wheels take items dropped on them, so this only narrows the route; machines are exempt by design. |
| 2 | `create:ochrum` | Crushing ochrum gives crushed raw gold (and electrum nuggets) with no Mining level. Same caveat as above. |

## Recipes and routes that skip a gate

| Gate | Item(s) | Route | Fix |
|---|---|---|---|
| Cooking 20 (cake) | `minecraft:cake` | createaddition:filling/cake: a spout fills a baked cake base with milk | The machine rule covers basins, mechanical crafters and the Crafter, not the spout. Extend it to Create's filling, deploying and sequenced assembly results, or remove the recipe in KubeJS. |
| Cooking 30 (chocolate pie) | `farmersdelight:chocolate_pie` | farmersdelight:integration/create/filling/chocolate_pie: a spout fills a pie crust with chocolate | Same as the cake. |
| Smithing 15 (iron helmet) | `minecraft:iron_helmet` | simulated:sequenced_assembly/engine_assembly lists an iron helmet among its scrap results (a small chance) | Minor (wearing still needs Defence 15); the sequenced-assembly machine rule above would cover it. |
| Crafting 20 (item vaults, proposed) | `createdeco:*_shipping_container`, `create_connected:item_silo` | Create Deco shipping containers (barrel, dye, iron sheet) and Create Connected item silos (iron sheet, barrel) are vaults from their own recipes | Gate them with the vault (included in the proposals). |
| Hardness III (obsidian) | `regions_unexplored:cobalt_obsidian` | Cobalt obsidian is in #c:obsidians, which the wand of symmetry and the void upgrade accept, and it needs no Hardness to break | Add it to tier III (included in the Hardness additions). |
| Hardness I and II (iron, zinc, gold) | `create:crimsite`, `create:asurine`, `create:ochrum`, `minecraft:tuff` | Create's ore stones (and tuff) crush into crushed raw iron, zinc and gold, and nuggets, with no Mining level | A machine route, exempt by design; see the optional Hardness additions if it should narrow. |
| Hardness use-gate (raw ores) | `sophisticatedbackpacks:pickup_upgrade`, `sophisticatedbackpacks:auto_smelting_upgrade`, `sophisticatedbackpacks:auto_blasting_upgrade` | A backpack with a pickup upgrade takes raw ores off the ground without a menu click, and auto-smelting/blasting turns them into ingots (which are free) | Have the use-gate also check backpack pickup (Sophisticated's pickup event) or give the auto-smelting upgrades a filter that refuses gated materials. |
| Enchanting caps | `illagerinvasion:imbuing_table`, `create_enchantment_industry:blaze_forger` | The imbuing table raises an enchantment past its maximum; the blaze forger combines books with no player at an anvil | Check both against the caps (the anvil and table checks do not run there). Using an over-cap item still needs the level, so this is a making gap, not a use gap. |
| Smithing gates and anvil caps | `sophisticatedbackpacks:smithing_upgrade`, `sophisticatedbackpacks:anvil_upgrade` | The backpack's smithing and anvil tabs have their own result slots | Test that the smithing-table gate (netherite gear, Smithing 50) and the anvil enchanting caps apply there; the crafting upgrade is known to be covered. |
| Covered already (no action) | `minecraft:cake`, `minecraft:pumpkin_pie` | Farmer's Delight (cake from milk bottles, pies from slices or crust) and Naturalist (duck-egg cake and pumpkin pie) add crafting-grid recipes for gated vanilla foods | The making gate checks the result, so every crafting-grid recipe for a gated item is already gated. |
