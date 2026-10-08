// Classify every non-vanilla item (plus Vanilla Backport's minecraft-namespace additions) into the 13 classes.
import { readFileSync, writeFileSync } from 'node:fs'
const SP = 'C:/Users/Shawn/AppData/Local/Temp/claude/C--Create-Modpack/ab1859ba-46fb-401e-9816-544fdbbd5524/scratchpad'
const items = JSON.parse(readFileSync('items.json', 'utf8'))
const scan = JSON.parse(readFileSync('jarscan.json', 'utf8'))
const blocks = new Set(Object.keys(JSON.parse(readFileSync(`${SP}/server-test/kubejs/exported/lsp_blocks.json`, 'utf8'))))
for (const [k, v] of Object.entries(scan.lang)) if (v.kind === 'block') blocks.add(k)
const jeiText = readFileSync('C:/Create+Modpack/pack/kubejs/client_scripts/jei_hidden.js', 'utf8') + readFileSync('C:/Create+Modpack/pack/kubejs/client_scripts/jei_hidden_iceandfire.js', 'utf8')
const hidden = new Set([...jeiText.matchAll(/["']([a-z0-9_]+:[a-z0-9_/]+)["']/g)].map((m) => m[1]))
const VB = new Set(Object.entries(scan.models).filter(([k, j]) => k.startsWith('minecraft:') && j.startsWith('VanillaBackport')).map(([k]) => k))

// Model files that are not items (bow frames, texture variants, removed content).
const IAF_NOT_ITEMS = /^iceandfire:(dragonbone_bow_pulling_\d|summoning_crystal_\w+_active|tinkers\/.*|dread_stone_slab_(double|upper)|pixie_house|troll_weapon|tide_trident_throwing|copper_(ingot|ore|block)|amythest_gem|ancient_stone_stairs|dragon_horn_(fire|ice|lightning)|air_pods|amethyst_gem|dragon_(boots|chestplate|helmet|leggings)|dragonegg|dragonscales|sea_serpent_(boots|chestplate|helmet|leggings)|dragonarmor_(copper|diamond|dragon_steel_fire|dragon_steel_ice|dragon_steel_lightning|gold|iron|netherite|silver))$/
const NOT_ITEMS = /^lsp_fixes:gold_coins_\d+$|^easy_npc:(template\/spawn_egg|epic_fight_.*|cobblemon_npc_spawn_egg|easy_model_entities_npc_spawn_egg|bogged_raw_spawn_egg|skeleton_bogged_spawn_egg|easy_npc_spawner)$/

export const C = { tool: 'tool', weapon: 'weapon', armour: 'armour', machine: 'machine/automation', storage: 'storage/logistics', transport: 'transport', magic: 'magic/enchanting', utility: 'utility block', light: 'light source', deco: 'decoration/building block', food: 'food', material: 'crafting material', tech: 'technical/creative-only' }

// Checked in order; the first match wins.
const RULES = [
  // technical / excluded
  [/spawn_egg|^iceandfire:spawn_egg_/, C.tech, 'spawn egg'],
  [/creative|debug|_test$|^ftbquests:|^ftblibrary:|^patchouli:|^moonlight:|^dragonlib:|^lootr:|^easy_npc|^blueprint:|^kubejs:|^everycomp:all_woods$/, C.tech, 'creative, debug or mod-internal'],
  [/^lemursaucepacket:.*_cape$/, C.tech, 'cape (earned, never crafted)'],
  [/^lsp_fixes:(gold_coins|coin_pouch)$/, C.tech, 'currency'],
  [/^create:(chromatic_compound|refined_radiance\w*|shadow_steel\w*|handheld_worldshaper|.*_placeable|elevator_contact)$/, C.tech, 'unobtainable in survival'],
  [/^(create|create_connected|aeronautics):.*_encased_(shaft|cogwheel|large_cogwheel|cross_connector)$|^create_connected:copycat_|^aeronautics:.*_envelope_encased_shaft$/, C.tech, 'placed form (JEI-hidden)'],
  // the pack's own
  [/^lemursaucepacket:(prospector|aeronaut|duelist|compacted_diamond|compacted_netherite)_(helmet|chestplate|leggings|boots)$|^lemursaucepacket:(anglers_cap|ember_crown)$/, C.armour, 'gear set'],
  [/^lemursaucepacket:(brass_sabre|sturdy_warhammer|stormcallers_sabre)$/, C.weapon, 'gear weapon'],
  [/^lemursaucepacket:(lumber_axe|excavators_pickaxe|prospectors_pickaxe|harvesters_scythe|builders_wand)$/, C.tool, 'gear tool'],
  [/^lemursaucepacket:heart$/, C.magic, 'lifesteal heart'],
  [/^lemursaucepacket:(lost_item_compass|seekers_compass)$/, C.tool, 'lifesteal compass'],
  [/^lemursaucepacket:/, C.material, 'pack material'],
  [/^lsp_fixes:climbing_boots$/, C.armour, 'relic boots'],
  [/^lsp_fixes:masons_palette$/, C.tool, 'Construction 99 palette'],
  // Sophisticated
  [/^sophisticatedbackpacks:upgrade_base$/, C.material, 'upgrade base'],
  [/^sophisticatedbackpacks:/, C.storage, 'backpack / upgrade'],
  [/^sophisticatedcore:ender_linker$/, C.storage, 'linked storage'],
  [/^sophisticatedcore:xp_bucket$/, C.material, 'fluid'],
  [/^createbackpackupgrades:/, C.storage, 'backpack upgrade'],
  // Relics
  [/^relics:(raw_meatball|cooked_meatball)$/, C.food, 'relic food'],
  [/^relics:(golden_tooth|pet_bone|relic_experience_bottle)$/, C.material, 'relic material'],
  [/^relics:/, C.magic, 'relic (curio with abilities)'],
  // Waystones
  [/^waystones:(.*waystone|.*sharestone|.*portstone|warp_plate)$/, C.transport, 'teleport block'],
  [/^waystones:(warp_stone|.*_scroll|twinbound_feather|attuned_shard|crumbling_attuned_shard)$/, C.transport, 'teleport item'],
  [/^waystones:/, C.material, 'waystone material'],
  // Ice and Fire
  [/^iceandfire:(banner_pattern_\w+|weezer_blue_album|dragon_skull_\w+|dragon_ice_spikes)$/, C.deco, 'banner pattern, trophy or disc'],
  [/^iceandfire:(chain|chain_sticky|bestiary|fishing_spear)$/, C.tool, 'Ice and Fire tool'],
  [/^iceandfire:egginice$/, C.tech, 'technical block'],
  [/^iceandfire:(dragonsteel_\w+|silver|copper|dragonbone)_sword$|^iceandfire:dragonbone_sword_\w+$|^iceandfire:(dread_\w*sword|ghost_sword|hippogryph_sword|stymphalian_bird_dagger|amphithere_macuahuitl|troll_weapon_\w+|hippocampus_slapper|tide_trident(_inventory)?|dread_queen_staff|lich_staff|cockatrice_scepter|fishing_spear)$/, C.weapon, 'Ice and Fire weapon'],
  [/^iceandfire:(dragonbone_bow|.*_arrow)$/, C.weapon, 'Ice and Fire bow/arrow'],
  [/^iceandfire:.*_(pickaxe|axe|shovel|hoe)$/, C.tool, 'Ice and Fire tool'],
  [/^iceandfire:(armor_\w+|dragonsteel_\w+|deathworm_\w+|tide_\w+|\w+_troll_leather|sheep)_(helmet|chestplate|leggings|boots)$|^iceandfire:(blindfold|earplugs|deathworm_gauntlet_\w+|pixie_wings)$/, C.armour, 'Ice and Fire armour'],
  [/^iceandfire:dragonarmor_/, C.armour, 'armour for your dragon'],
  [/^iceandfire:(dragon_flute|dragon_horn|dragon_stick|summoning_crystal_\w+|.*dragon_seeker|dragon_meal|sickly_dragon_meal|siren_flute|pixie_wand|gorgon_head|dragonegg_\w+|hippogryph_egg|deathworm_egg(_giant)?|bestiary|manuscript|chain|chain_sticky|weezer_blue_album)$/, C.magic, 'dragon husbandry / magic'],
  [/^iceandfire:dragonforge_/, C.machine, 'dragonforge multiblock'],
  [/^iceandfire:(cannoli|ambrosia|pixie_dust_milky_tea|.*_stew|cooked_rice_with_\w+|\w+_dragon_flesh|ghost_cream|rotten_egg)$/, C.food, 'Ice and Fire food'],
  [/^iceandfire:(silver_ore|deepslate_silver_ore|sapphire_ore|raw_silver|raw_silver_block|silver_ingot|silver_nugget|copper_nugget|sapphire_gem|dragonsteel_\w+_ingot|dragonbone|witherbone|wither_shard|dragonscales_\w+|\w+_dragon_blood|\w+_dragon_heart|dragon_skull_\w+|.*_skull|shiny_scales|sea_serpent_\w+|.*_feather(_bundle)?|.*_fang|.*_tusk|.*_talon|.*_eye|.*_heart|.*_tounge|.*_chitin_\w+|pixie_dust|ectoplasm|ghost_ingot|dread_shard|dread_key|siren_tear|hippocampus_fin|troll_leather_\w+|stone_statue|amethyst_gem)$/, C.material, 'Ice and Fire material'],
  [/^iceandfire:(burnt_torch|dread_torch)$/, C.light, 'torch'],
  [/^iceandfire:(lectern|podium_\w+|pixie_house_\w+|pixie_jar_\w+|ghost_chest|nest|egginice|dread_spawner|dragon_ice_spikes)$/, C.utility, 'Ice and Fire utility block'],
  // Farmer's Delight
  [/^farmersdelight:.*_knife$/, C.tool, 'knife (tool and weapon)'],
  [/^farmersdelight:skillet$/, C.weapon, 'skillet (weapon, cooks on the go)'],
  [/^farmersdelight:(cooking_pot|stove|cutting_board)$/, C.utility, 'kitchen workstation'],
  [/^farmersdelight:(.*_cabinet|.*basket|.*_crate|rice_bag)$/, C.storage, 'storage'],
  [/^farmersdelight:(rich_soil|rich_soil_farmland|organic_compost|safety_net|rope|rope_fence|rope_fence_gate|.*canvas_sign|canvas_rug|tatami|full_tatami_mat|half_tatami_mat)$/, C.utility, 'farm/utility block'],
  [/^farmersdelight:(straw|canvas|tree_bark|cabbage_leaf|rice_panicle|straw_bale|rice_bale|cabbage_seeds|tomato_seeds|onion|rice|cabbage|tomato|rotten_tomato|pumpkin_slice|milk_bottle)$/, C.material, 'crop or material'],
  [/^farmersdelight:(wild_\w+|sandy_shrub|brown_mushroom_colony|red_mushroom_colony)$/, C.deco, 'wild plant'],
  [/^farmersdelight:/, C.food, 'food'],
  // Create add-ons
  [/^createoreexcavation:raw_\w+$/, C.material, 'raw ore from veins'],
  [/^createoreexcavation:(vein_finder|vein_atlas)$/, C.tool, 'vein prospecting'],
  [/^createoreexcavation:/, C.machine, 'ore vein drilling'],
  [/^create_enchantment_industry:experience_cake\w*$/, C.food, 'experience cake'],
  [/^create_enchantment_industry:(super_experience_\w+|enchanting_template|super_enchanting_template|experience_bucket)$/, C.material, 'enchanting material'],
  [/^create_enchantment_industry:/, C.magic, 'enchanting machine'],
  [/^sliceanddice:fertilizer_bucket$/, C.material, 'fluid'],
  [/^sliceanddice:/, C.machine, 'Create farm/kitchen machine'],
  [/^createrailwaysnavigator:navigator$/, C.transport, 'train route planner'],
  [/^createrailwaysnavigator:/, C.utility, 'station display'],
  [/^offroad:(borehead_bearing|rockcutting_wheel)$/, C.machine, 'tunnel borer'],
  [/^offroad:/, C.transport, 'vehicle part'],
  [/^aeronautics:(levitite|pearlescent_levitite|end_stone_powder|levitite_blend_bucket)$/, C.material, 'airship material'],
  [/^aeronautics:aviators_goggles$/, C.armour, 'goggles'],
  [/^aeronautics:mounted_potato_cannon$/, C.weapon, 'ship cannon'],
  [/^aeronautics:music_disc/, C.deco, 'music disc'],
  [/^aeronautics:/, C.transport, 'airship part'],
  [/^simulated:(physics_assembler|steering_wheel|throttle_lever|navigation_table|.*_portable_engine|docking_connector|swivel_bearing|rope_\w+|.*_handle|.*_nameplate|white_symmetric_sail|plunger_launcher|torsion_spring|spring|auger_\w+)$/, C.transport, 'airship/contraption part'],
  [/^simulated:(honey_glue|contraption_diagram|engine_assembly|gyroscopic_mechanism|incomplete_\w+)$/, C.material, 'contraption material'],
  [/^simulated:laser_pointer$/, C.tool, 'pointer'],
  [/^simulated:/, C.machine, 'sensor / transmission'],
  [/^createaddition:(electrum_amulet|diamond_grit_sandpaper)$/, C.tool, 'tool'],
  [/^createaddition:(chocolate_cake|honey_cake)$/, C.food, 'cake'],
  [/^createaddition:barbed_wire$/, C.utility, 'defensive block'],
  [/^createaddition:(small_light_connector|festive_spool)$/, C.light, 'light'],
  [/^createaddition:(electrum_block|biomass_pellet_block)$/, C.deco, 'storage block'],
  [/^createaddition:(electrum_\w+|copper_\w+|gold_\w+|iron_\w+|brass_rod|zinc_sheet|spool|capacitor|diamond_grit|biomass\w*|bioethanol_bucket|seed_oil_bucket|straw|cake_base\w*)$/, C.material, 'electrical material'],
  [/^createaddition:/, C.machine, 'electricity'],
  [/^create_dragons_plus:(.*_dye_bucket|dragon_breath_bucket)$/, C.material, 'fluid bucket'],
  [/^create_dragons_plus:blaze_upgrade_smithing_template$/, C.material, 'smithing template'],
  [/^create_dragons_plus:rare_/, C.deco, 'rare package'],
  [/^create_dragons_plus:/, C.storage, 'fluid logistics'],
  [/^create_connected:music_disc_\w+$/, C.deco, 'music disc'],
  [/^create_connected:(item_silo|fluid_vessel|inventory_access_port|inventory_bridge|brass_chute)$/, C.storage, 'storage/logistics'],
  [/^create_connected:(control_chip|incomplete_control_chip|empty_fan_catalyst|.*_catalyst\w*)$/, C.material, 'fan catalyst / chip'],
  [/^create_connected:/, C.machine, 'kinetics / redstone'],
  [/^copycats:/, C.deco, 'copycat block'],
  // Create
  [/^create:schematic_table$/, C.utility, 'workstation'],
  [/^create:super_glue$/, C.tool, 'Create tool'],
  [/^create:spout$/, C.machine, 'Create machine'],
  [/^create:.*_seat$/, C.utility, 'seat'],
  [/^create:railway_casing$/, C.material, 'casing'],
  [/^create:(.*_sheet|.*_ingot|.*_nugget|crushed_raw_\w+|raw_zinc|andesite_alloy|brass_hand|electron_tube|precision_mechanism|incomplete_\w+|sturdy_sheet|unprocessed_obsidian_sheet|powdered_obsidian|polished_rose_quartz|rose_quartz|cinder_flour|wheat_flour|dough|pulp|propeller|whisk|experience_nugget|cardboard|blaze_cake_base|.*_bucket|belt_connector|filter|attribute_filter|package_filter|empty_schematic|schematic|schematic_and_quill|shopping_list|transmitter|crafter_slot_cover|tree_fertilizer|blaze_cake|sand_paper|red_sand_paper)$/, C.material, 'Create material'],
  [/^create:(bar_of_chocolate|sweet_roll|chocolate_glazed_berries|honeyed_apple|builders_tea)$/, C.food, 'Create food'],
  [/^create:(cardboard_(helmet|chestplate|leggings|boots)|copper_diving_\w+|netherite_diving_\w+|copper_backtank|netherite_backtank|goggles)$/, C.armour, 'Create armour/gear'],
  [/^create:(cardboard_sword|potato_cannon)$/, C.weapon, 'Create weapon'],
  [/^create:(wrench|extendo_grip|wand_of_symmetry|linked_controller|clipboard|schedule|crafting_blueprint)$/, C.tool, 'Create tool'],
  [/^create:(item_vault|.*_toolbox|chute|smart_chute|.*_funnel|.*_tunnel|depot|weighted_ejector|item_drain|fluid_pipe|smart_fluid_pipe|fluid_valve|fluid_tank|mechanical_pump|portable_storage_interface|portable_fluid_interface|packager|repackager|.*postbox|package_frogport|stock_link|stock_ticker|redstone_requester|factory_gauge|cardboard_package_\w+|rare_\w+_package|item_hatch|hose_pulley|spout|chain_conveyor|cardboard_block|bound_cardboard_block)$/, C.storage, 'Create logistics'],
  [/^create:(track|track_station|track_signal|track_observer|controls|train_door|train_trapdoor|controller_rail|minecart_\w+|chest_minecart_contraption|furnace_minecart_contraption|cart_assembler|elevator_pulley|railway_casing|.*_seat|incomplete_track)$/, C.transport, 'Create transport'],
  [/^create:.*_lamp$/, C.light, 'lamp'],
  [/^create:(deepslate_zinc_ore|zinc_ore)$/, C.material, 'ore'],
  [/^create:(.*_table_cloth|.*_window(_pane)?|.*_bars|.*_door|.*_ladder|.*_scaffolding|.*_shingle\w*|.*_tile\w*|.*_tiles|cut_\w+|polished_cut_\w+|small_\w+_brick\w*|layered_\w+|.*_pillar|asurine|crimsite|ochrum|veridium|limestone|scoria|scorchia|.*_block|.*_casing|framed_glass\w*|horizontal_framed_glass\w*|vertical_framed_glass\w*|tiled_glass\w*|metal_girder|metal_bracket|wooden_bracket|placard|industrial_iron_\w+|weathered_iron_\w+|ornate_iron_window\w*|.*_valve_handle|copycat_\w+|desk_bell|white_sail|sail_frame|peculiar_bell|haunted_bell|cuckoo_clock|mysterious_cuckoo_clock|experience_block)$/, C.deco, 'Create building block'],
  [/^create:/, C.machine, 'Create machine/kinetics'],
  // Friends & Foes, Illager Invasion, Piglin Proliferation, Naturalist, Creeper Overhaul, Gravestone
  [/^friendsandfoes:(totem_of_freezing|totem_of_illusion)$/, C.magic, 'totem (charm slot)'],
  [/^friendsandfoes:wildfire_crown$/, C.armour, 'boss helmet'],
  [/^friendsandfoes:(wildfire_crown_fragment|crab_claw|crab_egg)$/, C.material, 'mob drop'],
  [/^friendsandfoes:.*beehive$/, C.utility, 'beehive'],
  [/^friendsandfoes:music_disc/, C.deco, 'music disc'],
  [/^friendsandfoes:buttercup$/, C.deco, 'flower'],
  [/^friendsandfoes:/, C.machine, 'redstone (copper button / lightning rod)'],
  [/^illagerinvasion:imbuing_table$/, C.magic, 'enchanting table (imbues past max)'],
  [/^illagerinvasion:(horn_of_sight|lost_candle)$/, C.tool, 'detection tool'],
  [/^illagerinvasion:platinum_infused_hatchet$/, C.weapon, 'weapon'],
  [/^illagerinvasion:/, C.material, 'illager drop'],
  [/^piglinproliferation:buckler$/, C.armour, 'shield (charge attack)'],
  [/^piglinproliferation:travelers_compass$/, C.tool, 'compass'],
  [/^piglinproliferation:.*fire_ring$/, C.magic, 'potion fire pit'],
  [/^piglinproliferation:/, C.deco, 'mob head'],
  [/^naturalist:cooked_egg$/, C.food, 'food'],
  [/^naturalist:(capture_net|whistle)$/, C.tool, 'tool'],
  [/^naturalist:knapsack$/, C.storage, 'pack'],
  [/^naturalist:(glow_goop|.*froglass\w*)$/, C.light, 'light'],
  [/^naturalist:(.*shellstone\w*|plush_bear|music_disc\w*|.*_starfish|ant_hill)$/, C.deco, 'building/decoration'],
  [/^naturalist:(antler|fur|hide|fat|tooth|snail_shell|scorpion_poison_gland|.*_egg|snail_eggs|chrysalis|butterfly|caterpillar|ant|queen_ant|crab|hedgehog|snail|rat|scorpion|.*_bucket)$/, C.material, 'mob drop / catch'],
  [/^naturalist:/, C.food, 'food'],
  [/^creeperoverhaul:tiny_cactus$/, C.deco, 'plant'],
  [/^gravestone:gravestone$/, C.utility, 'grave'],
  [/^gravestone:obituary$/, C.tech, 'death note (given on death)'],
  [/^variantsandventures:|^guardvillagers:/, C.tech, 'spawn egg'],
  // Woodworks, Every Compat, Macaw's, Create Deco, Regions Unexplored
  [/^woodworks:sawmill$/, C.utility, 'workstation'],
  [/^woodworks:.*(chest|closet)$/, C.storage, 'chest'],
  [/^woodworks:.*beehive$/, C.utility, 'beehive'],
  [/^woodworks:.*ladder$/, C.utility, 'ladder'],
  [/^woodworks:/, C.deco, 'wood decoration'],
  [/^everycomp:abnww\/.*(chest|closet)$|^everycomp:fd\/.*cabinet$|^everycomp:mcfur\/.*(drawer|wardrobe|cupboard|cabinet|counter|desk)/, C.storage, 'wooden storage'],
  [/^everycomp:.*(beehive|ladder)$/, C.utility, 'utility'],
  [/^everycomp:/, C.deco, 'wood variant'],
  [/^mcwfurnitures:.*(drawer|wardrobe|cupboard|cabinet|counter|covered_desk|desk|kitchen_sink)/, C.storage, 'furniture with storage'],
  [/^mcwlights:/, C.light, 'lamp'],
  [/^mcwdoors:garage_remote$/, C.tool, 'remote'],
  [/^mcw\w+:/, C.deco, "Macaw's building block"],
  [/^createdeco:.*lamp$/, C.light, 'lamp'],
  [/^createdeco:.*shipping_container$/, C.storage, 'dyed item vault'],
  [/^createdeco:(.*_sheet|.*_nugget|.*_ingot)$/, C.material, 'metal'],
  [/^createdeco:/, C.deco, 'Create Deco block'],
  [/^regions_unexplored:(.*_boat|.*_chest_boat)$/, C.transport, 'boat'],
  [/^regions_unexplored:(hyacinth_lamp|glister_bulb|glowing_\w+|.*earlight\w*)$/, C.light, 'glowing plant/block'],
  [/^regions_unexplored:(duskmelon_slice|salmonberry)$/, C.food, 'fruit'],
  [/^regions_unexplored:iridescent_ring$/, C.deco, 'ring (cosmetic)'],
  [/^regions_unexplored:(raw_redstone_block|redstone_bud|redstone_bulb|pointed_redstone|prismarite_cluster|large_prismarite_cluster|hanging_prismarite|cobalt_obsidian)$/, C.material, 'mineral'],
  [/^regions_unexplored:/, C.deco, 'natural/building block'],
  // Vanilla Backport (minecraft namespace)
  [/^minecraft:.*_harness$/, C.transport, 'happy ghast harness'],
  [/^minecraft:dried_ghast$/, C.transport, 'grows into a happy ghast'],
  [/^minecraft:.*bundle$/, C.storage, 'bundle'],
  [/^minecraft:(resin_clump|sulfur|blue_egg|brown_egg)$/, C.material, 'material'],
  [/^minecraft:creaking_heart$/, C.utility, 'creaking heart'],
  [/^minecraft:sulfur_cube_bucket$/, C.material, 'mob bucket'],
  [/^minecraft:music_disc/, C.deco, 'music disc'],
  [/^minecraft:(pale_oak_boat|pale_oak_chest_boat)$/, C.transport, 'boat'],
  [/^minecraft:firefly_bush$/, C.light, 'light'],
  [/^minecraft:/, C.deco, 'building block / plant']
]

export function classifyAll() {
  const out = {}
  for (const id of Object.keys(items)) {
    const ns = id.split(':')[0]
    if (ns === 'minecraft' && !VB.has(id)) continue
    if (IAF_NOT_ITEMS.test(id) || NOT_ITEMS.test(id)) continue
    let cls = null, why = null
    for (const [re, c, w] of RULES) if (re.test(id)) { cls = c; why = w; break }
    if (!cls) { cls = blocks.has(id) ? C.deco : C.material; why = 'default' }
    if (hidden.has(id) && cls !== C.tech) { why = `${why}; unobtainable in this pack (JEI-hidden)`; cls = C.tech }
    out[id] = { mod: VB.has(id) ? 'vanillabackport' : ns, name: items[id].name, cls, why, src: items[id].src }
  }
  return out
}

if (process.argv[1] && process.argv[1].endsWith('classify.mjs')) {
  const out = classifyAll()
  writeFileSync('classes.json', JSON.stringify(out))
  const byMod = {}
  for (const v of Object.values(out)) { byMod[v.mod] ??= {}; byMod[v.mod][v.cls] = (byMod[v.mod][v.cls] || 0) + 1 }
  const totals = {}
  for (const v of Object.values(out)) totals[v.cls] = (totals[v.cls] || 0) + 1
  console.log('items', Object.keys(out).length, JSON.stringify(totals))
  for (const [m, c] of Object.entries(byMod).sort()) console.log(m, JSON.stringify(c))
}
