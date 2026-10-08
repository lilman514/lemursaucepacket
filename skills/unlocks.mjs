// What each skill level unlocks, RuneScape style, with vanilla Minecraft's own mechanics. One source for:
//   - the gates lsp_fixes enforces (pack/config/lemursaucepacket/skill_gates.json: making items, brewing ingredients,
//     drops, fishing treasure), written by skills/build.mjs;
//   - the Project MMO rules for planting (Farming) and chopping (Woodcutting), also written by skills/build.mjs;
//   - the wiki's skill guide (docs/skills.md, between its generated markers);
//   - the quest requirements' wording (the requirements themselves are on the quest steps in npcs/quests.mjs).
// Levels are 1-99. "combat" is the combat level (lsp_fixes skills/CombatLevel): RuneScape's formula over Attack,
// Strength, Defence, Hitpoints and Ranged, which tops out at 113 here (no Prayer or Magic).
// The modded items' gates live in skills/modded.mjs and join the tables below (CRAFT, CHOP, BREW, RELIC_WEAR); its
// hold, use, wear and place gates become Project MMO rules in skills/build.mjs.

import { MODDED } from './modded.mjs'
const modded = (kind) => MODDED.filter((g) => g.kind === kind)

/** What trains each skill and what every level of it gives, for the in-game skill screens (and the wiki's table). */
export const SKILL_INFO = {
  attack: { trainedBy: 'Hitting things', perLevel: '+0.04 melee damage and +0.4% bow damage a level' },
  strength: { trainedBy: 'Hitting things', perLevel: '+0.3% melee critical chance a level (1.5x damage)' },
  defence: { trainedBy: 'Being hit while wearing armour', perLevel: '+0.02 armour a level' },
  ranged: { trainedBy: 'Arrows, tridents and rockets', perLevel: '+0.3% ranged critical chance a level' },
  hitpoints: { trainedBy: 'Any fight (slowly)', perLevel: '+0.2 max health a level: a heart every ten levels' },
  mining: { trainedBy: 'Mining ores and stone', perLevel: 'Faster mining every level' },
  woodcutting: { trainedBy: 'Chopping logs', perLevel: 'Faster chopping every level' },
  farming: { trainedBy: 'Harvesting crops', perLevel: 'Faster tilling every level' },
  fishing: { trainedBy: 'Catching fish', perLevel: 'Better catches as you go' },
  cooking: { trainedBy: 'Cooking food', perLevel: 'New recipes as you go' },
  smithing: { trainedBy: 'Smelting metals and smithing gear', perLevel: 'New recipes as you go' },
  crafting: { trainedBy: 'Crafting', perLevel: 'New recipes as you go' },
  enchanting: { trainedBy: 'The enchanting table', perLevel: 'Enchantments reach further as you go' },
  brewing: { trainedBy: 'Brewing potions', perLevel: 'New potions as you go' },
  construction: { trainedBy: 'Building', perLevel: '+0.1% chance a block you place is not used up, a level' },
  agility: { trainedBy: 'Moving, sprinting and swimming', perLevel: '+0.01% speed and -0.5% fall damage a level (to 50%)' }
}

const pieces = (tier) => ['helmet', 'chestplate', 'leggings', 'boots'].map((p) => `minecraft:${tier}_${p}`)
const tools = (tier) => ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'].map((t) => `minecraft:${tier}_${t}`)
const fd = (...ids) => ids.map((id) => `farmersdelight:${id}`)

/**
 * Making things: the item a crafting grid, a smithing table or a cooking pot would hand you. Anything not listed is free.
 * Create's mechanical crafters have no player to ask, so they refuse what's listed here: you make those yourself.
 */
/**
 * The pack's own relics (lsp_fixes, for the Relics mod's slots): the level wearing each needs. As with armour,
 * Project MMO slows anyone who wears one early, and the relic's ability waits for the level too. Making them is in
 * CRAFT.
 */
export const RELIC_WEAR = [
  { item: 'lsp_fixes:climbing_boots', skill: 'agility', level: 25, what: 'the Climbing Boots (a relic)' },
  // Relics' own relics, the totem of undying and Friends & Foes' totems (skills/modded.mjs): worn, held or used, each
  // needs its level to work (lsp_fixes: relic abilities, LivingUseTotemEvent, and the hook in Friends & Foes' totem code).
  ...MODDED.filter((g) => g.mod === 'relics' || g.items.includes('minecraft:totem_of_undying') || g.items.some((i) => /^friendsandfoes:totem_of_/.test(i))).flatMap(({ kind, skill, level, what, items }) =>
    items.map((item) => ({ item, skill, level, kind: kind === 'use' ? 'use' : 'wear', what: item.startsWith('relics:') ? `the ${what}` : item === 'minecraft:totem_of_undying' ? 'a totem of undying (to be saved by it)' : what })))
]

export const CRAFT = [
  // Crafting: leather, bows, the fine and magical things.
  { skill: 'crafting', level: 5, what: 'Leather armour', items: pieces('leather') },
  { skill: 'crafting', level: 10, what: 'Bows', items: ['minecraft:bow'] },
  { skill: 'crafting', level: 15, what: 'Shields', items: ['minecraft:shield'] },
  { skill: 'crafting', level: 20, what: 'Crossbows', items: ['minecraft:crossbow'] },
  { skill: 'crafting', level: 20, what: 'Climbing Boots (a relic: step up full blocks)', items: ['lsp_fixes:climbing_boots'] },
  { skill: 'crafting', level: 30, what: 'Diamond tools, weapons and armour', items: [...tools('diamond'), ...pieces('diamond')] },
  { skill: 'crafting', level: 40, what: 'Enchanting tables', items: ['minecraft:enchanting_table'] },
  { skill: 'crafting', level: 50, what: 'Ender chests', items: ['minecraft:ender_chest'] },
  { skill: 'crafting', level: 60, what: 'End crystals', items: ['minecraft:end_crystal'] },
  { skill: 'crafting', level: 65, what: 'Shulker boxes', items: ['minecraft:shulker_box'] },
  { skill: 'crafting', level: 70, what: 'Conduits', items: ['minecraft:conduit'] },
  { skill: 'crafting', level: 75, what: 'Beacons', items: ['minecraft:beacon'] },
  { skill: 'crafting', level: 80, what: 'Respawn anchors and lodestones', items: ['minecraft:respawn_anchor', 'minecraft:lodestone'] },
  // The gear sets' hand-made parts (gear/gear.mjs): the mechanical recipes need one per piece.
  { skill: 'crafting', level: 35, what: "Aeronaut's Rigging (for the Aeronaut set)", items: ['lemursaucepacket:aeronaut_rigging'] },
  { skill: 'crafting', level: 40, what: "Duelist's Filigree (for the Brass Duelist set)", items: ['lemursaucepacket:duelists_filigree'] },
  // Smithing: metal.
  { skill: 'smithing', level: 10, what: 'Golden tools, weapons and armour', items: [...tools('golden'), ...pieces('golden')] },
  { skill: 'smithing', level: 15, what: 'Iron tools, weapons and armour', items: [...tools('iron'), ...pieces('iron')] },
  { skill: 'smithing', level: 20, what: 'Anvils and hoppers', items: ['minecraft:anvil', 'minecraft:hopper'] },
  { skill: 'smithing', level: 25, what: "Prospector's Plating (for the Prospector set)", items: ['lemursaucepacket:prospector_plating'] },
  { skill: 'smithing', level: 45, what: 'Diamond Lattice (for the Compacted Diamond set)', items: ['lemursaucepacket:diamond_lattice'] },
  { skill: 'smithing', level: 40, what: 'Copying armour trim templates', items: ['#minecraft:trim_templates'] },
  { skill: 'smithing', level: 50, what: 'Netherite gear (the smithing table upgrade)', items: [...tools('netherite'), ...pieces('netherite')] },
  { skill: 'smithing', level: 60, what: 'Copying the netherite upgrade template', items: ['minecraft:netherite_upgrade_smithing_template'] },
  { skill: 'smithing', level: 65, what: 'Compacted netherite armour', items: ['helmet', 'chestplate', 'leggings', 'boots'].map((p) => `lemursaucepacket:compacted_netherite_${p}`) },
  { skill: 'smithing', level: 70, what: 'Maces', items: ['minecraft:mace'] },
  // Cooking: vanilla dishes and Farmer's Delight's, at the crafting table and the cooking pot.
  { skill: 'cooking', level: 5, what: 'Beetroot soup, sandwiches and salads', items: ['minecraft:beetroot_soup', ...fd('egg_sandwich', 'chicken_sandwich', 'bacon_sandwich', 'mixed_salad', 'fruit_salad')] },
  { skill: 'cooking', level: 10, what: "Pumpkin pie, hamburgers, wraps and Farmer's Delight soups", items: ['minecraft:pumpkin_pie', ...fd('hamburger', 'mutton_wrap', 'vegetable_soup', 'chicken_soup', 'pumpkin_soup', 'onion_soup', 'noodle_soup', 'bone_broth')] },
  { skill: 'cooking', level: 20, what: 'Cake, rabbit stew, stews, rice dishes and rolls', items: ['minecraft:cake', 'minecraft:rabbit_stew', ...fd('beef_stew', 'fish_stew', 'baked_cod_stew', 'fried_rice', 'mushroom_rice', 'cabbage_rolls', 'dumplings', 'stuffed_potato', 'kelp_roll', 'salmon_roll', 'cod_roll')] },
  { skill: 'cooking', level: 30, what: 'Golden carrots, pies, pasta and plated meals', items: ['minecraft:golden_carrot', ...fd('apple_pie', 'sweet_berry_cheesecake', 'chocolate_pie', 'pasta_with_meatballs', 'pasta_with_mutton_chop', 'vegetable_noodles', 'steak_and_potatoes', 'roasted_mutton_chops', 'grilled_salmon', 'bacon_and_eggs', 'ratatouille')] },
  { skill: 'cooking', level: 40, what: 'Squid ink pasta, glow berry custard and nether salad', items: fd('squid_ink_pasta', 'glow_berry_custard', 'nether_salad') },
  { skill: 'cooking', level: 45, what: 'Golden apples', items: ['minecraft:golden_apple'] },
  { skill: 'cooking', level: 50, what: "Farmer's Delight feasts", items: fd('roast_chicken_block', 'stuffed_pumpkin_block', 'shepherds_pie_block', 'honey_glazed_ham_block', 'rice_roll_medley_block') },
  // Brewing's one crafted thing: the way to the End.
  { skill: 'brewing', level: 55, what: 'Eyes of ender', items: ['minecraft:ender_eye'] },
  // Create's machines (machine: true), each waiting on the skill it takes over: a milestone or two per skill on the way
  // to automating it. The press, mixer, blaze burner and deployer stay open (The Knight's Sword needs brass and a
  // precision mechanism), and so does anything only mechanical crafters make.
  { skill: 'mining', level: 15, machine: true, what: 'Mechanical drills', items: ['create:mechanical_drill'] },
  { skill: 'woodcutting', level: 15, machine: true, what: 'Mechanical saws', items: ['create:mechanical_saw'] },
  { skill: 'farming', level: 15, machine: true, what: 'Mechanical harvesters and ploughs', items: ['create:mechanical_harvester', 'create:mechanical_plough'] },
  { skill: 'cooking', level: 20, machine: true, what: 'Encased fans (bulk smoking, blasting and washing)', items: ['create:encased_fan'] },
  { skill: 'crafting', level: 30, machine: true, what: 'Mechanical crafters', items: ['create:mechanical_crafter'] },
  { skill: 'construction', level: 30, machine: true, what: 'Schematicannons', items: ['create:schematicannon'] },
  { skill: 'smithing', level: 35, machine: true, what: 'Steam engines', items: ['create:steam_engine'] },
  { skill: 'agility', level: 35, machine: true, what: 'Train stations and train controls', items: ['create:track_station', 'create:controls'] },
  { skill: 'enchanting', level: 35, machine: true, what: 'Blaze enchanters', items: ['create_enchantment_industry:blaze_enchanter', 'create_enchantment_industry:classic_blaze_enchanter'] },
  { skill: 'enchanting', level: 50, machine: true, what: 'Printers (they copy enchanted books)', items: ['create_enchantment_industry:printer'] },
  { skill: 'mining', level: 50, machine: true, what: 'Drill heads for the ore vein drilling machine', items: ['createoreexcavation:drill'] },
  { skill: 'mining', level: 65, machine: true, what: 'Diamond drill heads', items: ['createoreexcavation:diamond_drill'] },
  { skill: 'mining', level: 80, machine: true, what: 'Netherite drill heads', items: ['createoreexcavation:netherite_drill'] },
  // The XP Bank (lsp_fixes xpbank): what its tiers keep is MACHINE_XP's bankKeeps; a player takes from one at the
  // highest of these they could make.
  { skill: 'crafting', level: 40, machine: true, what: 'XP Banks (keep 10% of the XP machines earn while nobody is near)', items: ['lsp_fixes:xp_bank'] },
  { skill: 'crafting', level: 60, machine: true, what: 'Tier II XP Bank upgrades (the bank keeps 25%)', items: ['lsp_fixes:xp_bank_upgrade_2'] },
  { skill: 'crafting', level: 80, machine: true, what: 'Tier III XP Bank upgrades (the bank keeps 50%)', items: ['lsp_fixes:xp_bank_upgrade_3'] },
  // The modded items' making gates (skills/modded.mjs).
  ...modded('craft').map(({ skill, level, machine, what, items }) => ({ skill, level, ...(machine ? { machine } : {}), what, items }))
]

/**
 * Machine XP (lsp_fixes skills/MachineXp): a Create machine's work pays every player within playerRange blocks of it
 * what the same work pays by hand; a block lava and water made pays generatedShare of it (the owner: cobblestone
 * generators should pay, but very little). With nobody near, an XP Bank within bankRange blocks (each way) keeps
 * bankKeeps[tier - 1] of it.
 */
export const MACHINE_XP = { playerRange: 16, bankRange: 8, generatedShare: 0.1, bankKeeps: [0.1, 0.25, 0.5] }

/** Brewing: what each ingredient brews and the level it needs (manual or by hopper: a stand brews at the level of whoever last used it). */
export const BREW = [
  { level: 1, item: 'minecraft:nether_wart', what: 'Awkward potions, the base of nearly all others' },
  { level: 5, item: 'minecraft:sugar', what: 'Swiftness' },
  { level: 10, item: 'minecraft:golden_carrot', what: 'Night Vision' },
  { level: 15, item: 'minecraft:rabbit_foot', what: 'Leaping' },
  { level: 20, item: 'minecraft:magma_cream', what: 'Fire Resistance' },
  { level: 25, item: 'minecraft:glistering_melon_slice', what: 'Healing' },
  { level: 25, item: 'minecraft:spider_eye', what: 'Poison' },
  { level: 30, item: 'minecraft:pufferfish', what: 'Water Breathing' },
  { level: 30, item: 'minecraft:redstone', what: 'Longer potions' },
  { level: 35, item: 'minecraft:blaze_powder', what: 'Strength' },
  { level: 40, item: 'minecraft:ghast_tear', what: 'Regeneration' },
  { level: 45, item: 'minecraft:fermented_spider_eye', what: 'Weakness, Harming, Slowness and Invisibility' },
  { level: 50, item: 'minecraft:gunpowder', what: 'Splash potions' },
  { level: 50, item: 'minecraft:phantom_membrane', what: 'Slow Falling' },
  { level: 60, item: 'minecraft:glowstone_dust', what: 'Stronger potions' },
  { level: 65, item: 'minecraft:turtle_helmet', what: 'Turtle Master' },
  { level: 70, item: 'minecraft:dragon_breath', what: 'Lingering potions' },
  { level: 80, item: 'minecraft:breeze_rod', what: 'Wind Charging' },
  { level: 80, item: 'minecraft:cobweb', what: 'Weaving' },
  { level: 80, item: 'minecraft:slime_block', what: 'Oozing' },
  { level: 80, item: 'minecraft:stone', what: 'Infested' },
  // Modded brewing ingredients (skills/modded.mjs): Friends & Foes' crab claw, Illager Invasion's goat horn.
  ...modded('brew').map(({ level, items, what }) => ({ level, item: items[0], what }))
]
/** Modded potions' levels (their ids carry their own namespace), for Brewing XP like POTION_LEVEL's. */
export const MODDED_POTION_LEVEL = { 'friendsandfoes:reaching': 45, 'illagerinvasion:berserking': 40 }
/**
 * The level each potion takes to brew (for its XP): its own ingredient's level, at least 30 for a longer one (redstone)
 * and 60 for a stronger one (glowstone); a splash potion is at least 50 and a lingering one 70.
 */
export const POTION_LEVEL = {
  awkward: 1, mundane: 1, thick: 1, swiftness: 5, night_vision: 10, leaping: 15, fire_resistance: 20, healing: 25, poison: 25,
  water_breathing: 30, strength: 35, regeneration: 40, invisibility: 45, weakness: 45, harming: 45, slowness: 45, slow_falling: 50,
  turtle_master: 65, wind_charged: 80, weaving: 80, oozing: 80, infested: 80
}
export const POTION_FORM_LEVEL = { 'minecraft:splash_potion': 50, 'minecraft:lingering_potion': 70 }
/** Brewing XP for each potion taken from a stand: BREW_XP.base + BREW_XP.perLevel × the level its brewing needs. */
export const BREW_XP = { base: 8, perLevel: 2.2 }

/** Drops a mob only gives to a player with the level (whoever kills it; anything else killing it gets none). */
export const DROPS = [
  { entity: 'minecraft:wither_skeleton', item: 'minecraft:wither_skeleton_skull', skill: 'combat', level: 75, what: 'Wither skeleton skulls (the Wither)' }
]

/** Fishing: treasure (enchanted books and gear, name tags, saddles, nautilus shells) from this level; below it, a fish. */
export const FISHING_TREASURE = 20

/** Farming: the level to plant each crop (Project MMO PLACE rules on the crop blocks). */
export const PLANT = [
  { level: 5, what: 'Beetroot', blocks: ['minecraft:beetroots'] },
  { level: 5, what: 'Cabbages and onions', blocks: ['farmersdelight:cabbages', 'farmersdelight:onions'] },
  { level: 10, what: 'Tomatoes and sweet berries', blocks: ['farmersdelight:budding_tomatoes', 'minecraft:sweet_berry_bush'] },
  { level: 15, what: 'Pumpkins and melons', blocks: ['minecraft:pumpkin_stem', 'minecraft:melon_stem'] },
  { level: 20, what: 'Rice', blocks: ['farmersdelight:rice'] },
  { level: 25, what: 'Cocoa', blocks: ['minecraft:cocoa'] },
  { level: 30, what: 'Nether wart', blocks: ['minecraft:nether_wart'] },
  { level: 40, what: 'Torchflowers and pitcher plants', blocks: ['minecraft:torchflower_crop', 'minecraft:pitcher_crop'] },
  { level: 60, what: 'Chorus flowers', blocks: ['minecraft:chorus_flower'] }
]

/** Woodcutting: the level to chop each kind of tree (Project MMO BREAK rules on its logs and wood), like RuneScape's willows and yews. */
const woods = (...kinds) => kinds.flatMap((k) => [`minecraft:${k}_log`, `minecraft:${k}_wood`, `minecraft:stripped_${k}_log`, `minecraft:stripped_${k}_wood`])
const stems = (...kinds) => kinds.flatMap((k) => [`minecraft:${k}_stem`, `minecraft:${k}_hyphae`, `minecraft:stripped_${k}_stem`, `minecraft:stripped_${k}_hyphae`])
export const CHOP = [
  { level: 15, what: 'Jungle trees', blocks: woods('jungle') },
  { level: 30, what: 'Acacia trees', blocks: woods('acacia') },
  { level: 35, what: 'Dark oak trees', blocks: woods('dark_oak') },
  { level: 45, what: 'Mangroves', blocks: woods('mangrove') },
  { level: 50, what: 'Cherry trees', blocks: woods('cherry') },
  { level: 60, what: 'Crimson and warped stems', blocks: stems('crimson', 'warped') },
  // Modded trees (skills/modded.mjs): Regions Unexplored's and the pale oak.
  ...modded('chop').map(({ level, what, items }) => ({ level, what, blocks: items }))
]

/** Gear moved from Attack to Ranged (skills/build.mjs writes the Project MMO rules). */
export const RANGED = [
  { level: 20, what: 'Crossbows and the potato cannon', items: ['minecraft:crossbow', 'create:potato_cannon'] },
  { level: 40, what: 'Tridents', items: ['minecraft:trident'] }
]

/**
 * Enchantments past their vanilla level need two skills: Enchanting to make them, and the skill of the gear they're on
 * to use them (the levels a skill allows grow with it the same way Enchanting's do). enchanting/enchanting.mjs reads it.
 */
export const ENCHANT_SKILL = {
  'minecraft:luck_of_the_sea': 'fishing',
  'minecraft:lure': 'fishing',
  'minecraft:fortune': 'mining',
  'minecraft:efficiency': 'mining',
  'minecraft:sharpness': 'attack',
  'minecraft:smite': 'attack',
  'minecraft:bane_of_arthropods': 'attack',
  'minecraft:looting': 'attack',
  'minecraft:sweeping_edge': 'attack',
  'minecraft:fire_aspect': 'strength',
  'minecraft:knockback': 'strength',
  'minecraft:power': 'ranged',
  'minecraft:punch': 'ranged',
  'minecraft:piercing': 'ranged',
  'minecraft:quick_charge': 'ranged',
  'minecraft:impaling': 'ranged',
  'minecraft:loyalty': 'ranged',
  'minecraft:riptide': 'agility',
  'minecraft:protection': 'defence',
  'minecraft:fire_protection': 'defence',
  'minecraft:blast_protection': 'defence',
  'minecraft:projectile_protection': 'defence',
  'minecraft:thorns': 'defence',
  'minecraft:feather_falling': 'agility',
  'minecraft:soul_speed': 'agility',
  'minecraft:swift_sneak': 'agility',
  'minecraft:frost_walker': 'agility',
  'minecraft:respiration': 'hitpoints'
}

/** The main quests' skill requirements, for the wiki (the quest steps in npcs/quests.mjs enforce them). */
export const QUEST_REQUIREMENTS = {
  "Cook's Assistant": {},
  "The Knight's Sword": { mining: 10, smithing: 10 },
  'Dragon Slayer I': { combat: 40, brewing: 55 },
  'Dragon Slayer II': { smithing: 70, mining: 68, crafting: 62, agility: 60, enchanting: 60, hitpoints: 50 },
  'The Fight Pits': { combat: 60, defence: 50, hitpoints: 50, 'attack|ranged': 50 },
  'Ashes of the Kiln': { defence: 80, hitpoints: 80, 'attack|ranged': 80 },
  'The Inferno': {}
}

// ---------------------------------------------------------------- Construction (lsp_fixes construction package)
//
// Block matchers, used by the XP rules and the palette: a block id, a block tag ('#c:glass_blocks'), a whole mod
// ('@createdeco'), a regex over the id ('~^minecraft:cut_.*'), or '*entity' for any block with a block entity.

/**
 * Construction XP for each block placed, RuneScape style: the fancier the block, the more it pays. A block pays once it
 * has stood for a minute, and a spot pays once (until the server restarts), so placing and breaking earns nothing.
 * Rules are checked in order and the first that matches wins; a block nothing matches pays nothing.
 */
export const CONSTRUCTION_XP = [
  { xp: 25, what: 'Fine pieces: lecterns, bells, bookshelves, sea lanterns, end rods, decorated pots', match: ['minecraft:lectern', 'minecraft:bell', 'minecraft:bookshelf', 'minecraft:chiseled_bookshelf', 'minecraft:sea_lantern', 'minecraft:end_rod', 'minecraft:decorated_pot'] },
  { xp: 2, what: 'Cobblestone and stone', match: ['minecraft:cobblestone', 'minecraft:stone', 'minecraft:cobbled_deepslate', 'minecraft:mossy_cobblestone'] },
  {
    xp: 0,
    what: 'The ground as you found it (dirt, sand, gravel, natural stone, logs, leaves, plants, ores), storage blocks, machines and anything with an inventory, redstone, rails, torches, ladders and scaffolding',
    match: [
      '#minecraft:dirt', '#minecraft:sand', '#c:gravels', '#minecraft:base_stone_overworld', '#minecraft:base_stone_nether', '#minecraft:logs', '#minecraft:leaves',
      '#minecraft:saplings', '#minecraft:flowers', '#minecraft:crops', '#c:ores', '#c:storage_blocks', '#minecraft:rails', '#minecraft:beds', '#minecraft:ice', '#minecraft:snow',
      '~^minecraft:(grass_block|mycelium|podzol|mud|clay|moss_block|end_stone|obsidian|crying_obsidian|netherrack|magma_block|soul_sand|soul_soil|sponge|wet_sponge|hay_block|slime_block|honey_block|cactus|sugar_cane|bamboo|kelp|vine|cobweb|farmland|dirt_path|tnt)$',
      '~.*(torch|ladder|scaffolding|redstone|repeater|comparator|observer|piston|lever|button|pressure_plate|tripwire|daylight_detector|target|note_block|jukebox|dispenser|dropper|hopper|crafter|sculk|_rail|copper_bulb).*',
      '*entity'
    ]
  },
  {
    xp: 15,
    what: "Macaw's roofs, windows, paths, bridges, stairs, fences, lights, doors and furniture, and Create Deco",
    match: ['@mcwroofs', '@mcwwindows', '@mcwpaths', '@mcwbridges', '@mcwstairs', '@mcwfences', '@mcwlights', '@mcwdoors', '@mcwtrpdoors', '@mcwfurnitures', '@createdeco']
  },
  {
    xp: 10,
    what: "Fancy stone and glass: chiseled, cracked, mossy, cut, smooth, polished and tiled kinds, quartz, prismarine, purpur, end stone bricks, copper, glazed terracotta, stained glass, Create's cut stone; lanterns, chains, iron bars, doors and trapdoors",
    match: [
      '~^minecraft:(chiseled|cracked|mossy|cut|smooth|polished)_.*', '~^minecraft:.*_tiles?(_stairs|_slab|_wall)?$', '~^minecraft:.*(quartz|prismarine|purpur|end_stone_brick|copper).*',
      '~^minecraft:.*_glazed_terracotta$', '~^minecraft:.*stained_glass.*', '~^minecraft:(tuff|mud|red_nether|nether)_brick.*', '~^create:(cut|polished_cut|small|layered)_.*', '~^create:.*_pillar$',
      'minecraft:lantern', 'minecraft:soul_lantern', 'minecraft:chain', 'minecraft:iron_bars', '#minecraft:doors', '#minecraft:trapdoors', '#minecraft:fence_gates'
    ]
  },
  {
    xp: 5,
    what: 'Building blocks: planks, bricks, stone bricks, glass, wool, concrete, terracotta and sandstone, and every stair, slab, wall and fence',
    match: [
      '#minecraft:planks', '#minecraft:stairs', '#minecraft:slabs', '#minecraft:walls', '#minecraft:fences', '#minecraft:wool', '#minecraft:wool_carpets', '#minecraft:terracotta', '#c:glass_blocks', '#c:glass_panes',
      '~^minecraft:.*_concrete$', '~^minecraft:(red_)?sandstone$', '~^minecraft:.*bricks$', 'minecraft:packed_mud', 'minecraft:flower_pot'
    ]
  }
]

/** The saving perk: each Construction level adds this chance that a block you place doesn't get used up (9.9% at 99). */
export const CONSTRUCTION_SAVE_PER_LEVEL = 0.001

/**
 * What the saving perk never gives back, even where it pays XP: anything worth more as a material than as a block.
 * Storage blocks and beacon bases, ores, the whole copper family (an axe scrapes the wax off waxed copper, which would
 * turn a saved block back into a real one), coin stacks, the precious metals and amethyst, and flower pots (a plant in
 * one makes it another block). lsp_fixes also leaves out anything a crafting recipe unpacks into four or more of
 * something (modded storage blocks and crates, untagged ones too), and as before anything with a block entity or
 * contents (chests, shulker boxes, backpacks, machines, lecterns), anything that falls or weathers, anything Create's
 * wrench picks up, and what Create grinds into something. It gives back only a plain block: a stack holding anything
 * (contents, a block entity's data) is never copied.
 */
export const CONSTRUCTION_SAVE_NEVER = [
  '#c:storage_blocks', '#minecraft:beacon_base_blocks', '#c:ores', '#minecraft:shulker_boxes', '#minecraft:flower_pots',
  '~.*(copper|coinstack|coin_stack|amethyst|gold|diamond|emerald|netherite|lapis|_ore$|raw_|gilded).*'
]

/**
 * Alternate recipes Construction unlocks: decorative blocks in bulk, without a furnace or a stonecutter. Each has two
 * kinds of ingredient in a shape of its own, so Create's mixer and press never pick them up; the crafting table, the
 * blueprint and the Crafter check the level (machines never use them). skills/build.mjs writes the recipe files
 * (lemursaucepacket:construction/<id>) and their gates.
 */
const ring = (outer, middle) => ({ pattern: ['OOO', 'OMO', 'OOO'], key: { O: outer, M: middle } })
export const CONSTRUCTION_RECIPES = [
  { id: 'mortared_stone_bricks', level: 5, what: 'Ten stone bricks from eight stone and a clay ball', ...ring('minecraft:stone', 'minecraft:clay_ball'), result: 'minecraft:stone_bricks', count: 10 },
  { id: 'mossy_cobblestone', level: 10, what: 'Mossy cobblestone by the eight: cobblestone round a moss block', ...ring('minecraft:cobblestone', 'minecraft:moss_block'), result: 'minecraft:mossy_cobblestone', count: 8 },
  { id: 'mossy_stone_bricks', level: 15, what: 'Mossy stone bricks by the eight: stone bricks round a moss block', ...ring('minecraft:stone_bricks', 'minecraft:moss_block'), result: 'minecraft:mossy_stone_bricks', count: 8 },
  { id: 'cracked_stone_bricks', level: 20, what: 'Cracked stone bricks without a furnace: stone bricks round a flint', ...ring('minecraft:stone_bricks', 'minecraft:flint'), result: 'minecraft:cracked_stone_bricks', count: 8 },
  { id: 'smooth_stone', level: 25, what: 'Smooth stone without a furnace: stone round a sand', ...ring('minecraft:stone', 'minecraft:sand'), result: 'minecraft:smooth_stone', count: 8 },
  { id: 'chiseled_stone_bricks', level: 30, what: 'Chiseled stone bricks by the eight: stone bricks round an iron nugget', ...ring('minecraft:stone_bricks', 'minecraft:iron_nugget'), result: 'minecraft:chiseled_stone_bricks', count: 8 },
  { id: 'cracked_deepslate_bricks', level: 40, what: 'Cracked deepslate bricks without a furnace', ...ring('minecraft:deepslate_bricks', 'minecraft:flint'), result: 'minecraft:cracked_deepslate_bricks', count: 8 },
  { id: 'cracked_deepslate_tiles', level: 45, what: 'Cracked deepslate tiles without a furnace', ...ring('minecraft:deepslate_tiles', 'minecraft:flint'), result: 'minecraft:cracked_deepslate_tiles', count: 8 },
  { id: 'cracked_nether_bricks', level: 50, what: 'Cracked nether bricks without a furnace', ...ring('minecraft:nether_bricks', 'minecraft:flint'), result: 'minecraft:cracked_nether_bricks', count: 8 },
  { id: 'cracked_polished_blackstone_bricks', level: 55, what: 'Cracked polished blackstone bricks without a furnace', ...ring('minecraft:polished_blackstone_bricks', 'minecraft:flint'), result: 'minecraft:cracked_polished_blackstone_bricks', count: 8 },
  { id: 'stone_brick_stairs', level: 60, what: 'Eight stone brick stairs from six stone bricks and a clay ball', pattern: ['S  ', 'SS ', 'SSC'], key: { S: 'minecraft:stone_bricks', C: 'minecraft:clay_ball' }, result: 'minecraft:stone_brick_stairs', count: 8 },
  { id: 'lantern', level: 70, what: 'A lantern from four iron nuggets, four glass panes and a torch', pattern: ['NGN', 'GTG', 'NGN'], key: { N: 'minecraft:iron_nugget', G: 'minecraft:glass_pane', T: 'minecraft:torch' }, result: 'minecraft:lantern', count: 1 }
]

/**
 * The Mason's Palette (lsp_fixes:masons_palette), the Construction Cape's: at Construction 99 it places as many of one
 * decorative block as you like, without using any up. Nothing it places drops anything when broken (nor slips away on
 * a piston, a contraption, an explosion or a drill, or rides an airship back out), so it can't be turned into items, and
 * it never places what you'd otherwise farm or mine for (no wood, wool or crops), what Create crushes, mills or washes
 * into something (lsp_fixes reads those from Create's own recipes: raw tuff, granite and diorite, terracotta, Create's
 * ore stones), anything that falls, holds items, changes on its own (copper) or carries redstone. Nothing of any wood
 * either: lsp_fixes also leaves out every block named after a kind of planks in the game (so modded woods too). Categories
 * list in order; a block goes in the first that matches.
 */
export const PALETTE = {
  level: 99,
  coins: 10000,
  never: [
    '#minecraft:logs', '#minecraft:planks', '#minecraft:wool', '#minecraft:wool_carpets', '#minecraft:beds', '#minecraft:candles', '#minecraft:banners', '#c:storage_blocks', '#c:ores', '#minecraft:rails',
    // Every Compat is wood-type variants of other mods' blocks; Macaw's furniture is wood or wool.
    '@everycomp', '@mcwfurnitures',
    '~.*(seat|couch|chaise|curtain|paper|froglass|cushion).*',
    '~.*(oak|spruce|birch|jungle|acacia|mangrove|cherry|bamboo|crimson|warped|azalea|_wood|_log|planks|stem|hyphae).*',
    '~.*(hay|honey|slime|glowstone|shroomlight|amethyst|sponge|coinstack|infested|_ore|raw_|gilded|skull|_head|copper|flower_pot|potted|candle|carpet).*',
    '~.*(torch|ladder|scaffolding|redstone|repeater|comparator|observer|piston|lever|button|pressure_plate|tripwire|daylight_detector|target|note_block|jukebox|dispenser|dropper|hopper|crafter|sculk|tnt|lightning_rod).*',
    '~^minecraft:(obsidian|crying_obsidian|netherite_block|lodestone|respawn_anchor|beacon|conduit|spawner|bedrock|end_portal_frame|budding_amethyst|dragon_egg|reinforced_deepslate|bookshelf|chiseled_bookshelf|ice|packed_ice|blue_ice)$'
  ],
  // The one block with a block entity it may place: a lectern holds a book you put there, which drops as usual.
  blockEntities: ['minecraft:lectern'],
  // Create's processing inputs that only give back what a cobblestone generator already does.
  processingAllowed: ['minecraft:cobblestone', 'minecraft:sandstone', '#c:glass_blocks', '#c:glass_panes'],
  categories: [
    { name: 'Stone', icon: 'minecraft:stone_bricks', match: ['~^minecraft:(stone|cobblestone|mossy_cobblestone|smooth_stone)(_stairs|_slab|_wall)?$', '~^minecraft:(mossy_|cracked_|chiseled_)?stone_brick(s|_stairs|_slab|_wall)$'] },
    { name: 'Granite, diorite and andesite', icon: 'minecraft:polished_andesite', match: ['~^minecraft:(polished_)?(granite|diorite|andesite)(_stairs|_slab|_wall)?$'] },
    { name: 'Deepslate and tuff', icon: 'minecraft:deepslate_tiles', match: ['~^minecraft:.*(deepslate|tuff).*'] },
    { name: 'Blackstone and basalt', icon: 'minecraft:polished_blackstone_bricks', match: ['~^minecraft:.*(blackstone|basalt).*'] },
    { name: 'Sandstone', icon: 'minecraft:cut_sandstone', match: ['~^minecraft:.*sandstone.*'] },
    { name: 'Bricks', icon: 'minecraft:bricks', match: ['~^minecraft:(bricks|brick_.*|mud_brick.*|packed_mud|.*nether_brick.*)$'] },
    { name: 'Quartz, purpur and end stone', icon: 'minecraft:quartz_bricks', match: ['~^minecraft:.*(quartz|purpur|end_stone_brick).*'] },
    { name: 'Prismarine', icon: 'minecraft:prismarine_bricks', match: ['~^minecraft:.*prismarine.*', 'minecraft:sea_lantern'] },
    { name: 'Concrete', icon: 'minecraft:light_gray_concrete', match: ['~^minecraft:.*_concrete$'] },
    { name: 'Terracotta', icon: 'minecraft:orange_glazed_terracotta', match: ['#minecraft:terracotta', '~^minecraft:.*_glazed_terracotta$'] },
    { name: 'Glass', icon: 'minecraft:glass', match: ['#c:glass_blocks', '#c:glass_panes'] },
    { name: "Create's stone", icon: 'create:cut_limestone', match: ['~^create:(cut|polished_cut|small|layered)_.*', '~^create:.*_pillar$', '~^create:(limestone|scoria|scorchia)$'] },
    { name: 'Create Deco', icon: 'createdeco:dusk_bricks', match: ['@createdeco'] },
    { name: "Macaw's roofs", icon: 'mcwroofs:stone_roof', match: ['@mcwroofs'] },
    { name: "Macaw's paths", icon: 'mcwpaths:andesite_basket_weave_paving', match: ['@mcwpaths'] },
    { name: "Macaw's stairs and bridges", icon: 'mcwbridges:stone_brick_bridge', match: ['@mcwstairs', '@mcwbridges'] },
    { name: "Macaw's windows and doors", icon: 'mcwwindows:stone_window', match: ['@mcwwindows', '@mcwdoors', '@mcwtrpdoors'] },
    { name: "Macaw's fences and walls", icon: 'mcwfences:modern_stone_brick_wall', match: ['@mcwfences'] },
    { name: "Macaw's lights", icon: 'mcwlights:chain_lantern', match: ['@mcwlights'] },
    { name: 'Decoration', icon: 'minecraft:lantern', match: ['minecraft:lectern', 'minecraft:lantern', 'minecraft:soul_lantern', 'minecraft:chain', 'minecraft:iron_bars', 'minecraft:end_rod', '~^create:(andesite|brass)_bars$', '~^create:.*_iron_window(_pane)?$'] }
  ]
}
