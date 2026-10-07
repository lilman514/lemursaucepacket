// What each skill level unlocks, RuneScape style, with vanilla Minecraft's own mechanics. One source for:
//   - the gates lsp_fixes enforces (pack/config/lemursaucepacket/skill_gates.json: making items, brewing ingredients,
//     drops, fishing treasure), written by skills/build.mjs;
//   - the Project MMO rules for planting (Farming) and chopping (Woodcutting), also written by skills/build.mjs;
//   - the wiki's skill guide (docs/skills.md, between its generated markers);
//   - the quest requirements' wording (the requirements themselves are on the quest steps in npcs/quests.mjs).
// Levels are 1-99. "combat" is the combat level (lsp_fixes skills/CombatLevel): RuneScape's formula over Attack,
// Strength, Defence, Hitpoints and Ranged, which tops out at 113 here (no Prayer or Magic).

const pieces = (tier) => ['helmet', 'chestplate', 'leggings', 'boots'].map((p) => `minecraft:${tier}_${p}`)
const tools = (tier) => ['sword', 'pickaxe', 'axe', 'shovel', 'hoe'].map((t) => `minecraft:${tier}_${t}`)
const fd = (...ids) => ids.map((id) => `farmersdelight:${id}`)

/**
 * Making things: the item a crafting grid, a smithing table or a cooking pot would hand you. Anything not listed is free.
 * Create's mechanical crafters have no player to ask, so they refuse what's listed here: you make those yourself.
 */
export const CRAFT = [
  // Crafting: leather, bows, the fine and magical things.
  { skill: 'crafting', level: 5, what: 'Leather armour', items: pieces('leather') },
  { skill: 'crafting', level: 10, what: 'Bows', items: ['minecraft:bow'] },
  { skill: 'crafting', level: 15, what: 'Shields', items: ['minecraft:shield'] },
  { skill: 'crafting', level: 20, what: 'Crossbows', items: ['minecraft:crossbow'] },
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
  { skill: 'brewing', level: 55, what: 'Eyes of ender', items: ['minecraft:ender_eye'] }
]

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
  { level: 80, item: 'minecraft:stone', what: 'Infested' }
]
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
  { level: 60, what: 'Crimson and warped stems', blocks: stems('crimson', 'warped') }
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
