// LemurSaucePacket gear: the pack's own tools, weapons and armour, SkyBlock-style. Edit this file, then run
// `node gear/build.mjs` (publish.mjs does). It is the single source for:
//   - the KubeJS item registrations (pack/kubejs/startup_scripts/gear.js);
//   - the server-side rules the gear script reads (pack/config/lemursaucepacket/gear.json): stats, set bonuses,
//     perks, relic synergies;
//   - recipes (pack/kubejs/server_scripts/gear_recipes.js), Project MMO level gates, JEI "how to get" pages,
//     tooltips, the FallingTree whitelist, lang entries;
//   - the wiki page docs/gear.md.
//
// Stats vocabulary (what tooltips show):
//   damage        extra attack damage (attribute)            critChance   added to the skill crit roll (fraction)
//   attackSpeed   attack speed baseline for weapons            critDamage   added to the 1.5x crit multiplier
//   defense/toughness/knockbackResistance   armour attributes  health       max health (attribute)
//   speed         movement speed (fraction, multiply-total)    luck         luck attribute
// Perks are named behaviours the server script implements (see pack/kubejs/server_scripts/gear.js).

export const NAMESPACE = 'lemursaucepacket'

/** Skill requirements use Project MMO: 'WEAR' for armour, 'WEAPON' for weapons, 'TOOL' for tools. */
export const MATERIALS = {
  prospector: {
    name: "Prospector's",
    base: 'iron',
    tint: '#b8862b',
    defense: { helmet: 2, chestplate: 6, leggings: 5, boots: 2 },
    toughness: 0,
    knockbackResistance: 0,
    enchantmentValue: 12,
    repair: 'create:brass_ingot'
  },
  aeronaut: {
    name: "Aeronaut's",
    base: 'leather',
    tint: '#7a5230',
    defense: { helmet: 2, chestplate: 5, leggings: 4, boots: 2 },
    toughness: 0,
    knockbackResistance: 0,
    enchantmentValue: 15,
    repair: 'minecraft:leather'
  },
  duelist: {
    name: 'Brass Duelist',
    base: 'iron',
    tint: '#d9a441',
    defense: { helmet: 3, chestplate: 7, leggings: 5, boots: 3 },
    toughness: 1,
    knockbackResistance: 0,
    enchantmentValue: 14,
    repair: 'create:brass_ingot'
  },
  compacted_diamond: {
    name: 'Compacted Diamond',
    base: 'diamond',
    tint: '#4fd6d0',
    defense: { helmet: 4, chestplate: 9, leggings: 7, boots: 4 },
    toughness: 3,
    knockbackResistance: 0.1,
    enchantmentValue: 10,
    repair: 'lemursaucepacket:compacted_diamond'
  },
  compacted_netherite: {
    name: 'Compacted Netherite',
    base: 'netherite',
    tint: '#6b5b6f',
    defense: { helmet: 5, chestplate: 10, leggings: 8, boots: 5 },
    toughness: 4,
    knockbackResistance: 0.2,
    enchantmentValue: 15,
    repair: 'lemursaucepacket:compacted_netherite',
    fireResistant: true
  }
}

/**
 * Armour sets. `pieces` lists per-piece stats and single-piece perks; `set` is the full-set bonus (all four).
 * `synergy` pairs the full set with a Relics item for a roguelike extra.
 */
export const SETS = [
  {
    id: 'prospector',
    name: "Prospector's Set",
    material: 'prospector',
    theme: 'Mining utility: light where you dig, haste when you commit to the whole set.',
    requirement: { skill: 'mining', level: 35 },
    pieces: {
      helmet: { name: "Prospector's Lamp", perk: 'night_vision_underground', perkText: 'Night Vision below Y=32 (alone too)' },
      chestplate: { name: "Prospector's Vest" },
      leggings: { name: "Prospector's Trousers" },
      boots: { name: "Prospector's Boots" }
    },
    set: { effects: [{ effect: 'minecraft:haste', amplifier: 0 }], perks: ['ore_double_drops'], text: 'Haste I, and a 15% chance of double ore drops' },
    synergy: { relic: 'relics:clot_of_time', effects: [{ effect: 'minecraft:haste', amplifier: 1 }], text: 'Haste II instead of Haste I' },
    howToGet: 'Mechanical crafting from brass casings, andesite alloy and a lamp.'
  },
  {
    id: 'aeronaut',
    name: "Aeronaut's Set",
    material: 'aeronaut',
    theme: 'Mobility for people who live on airships and rooftops.',
    requirement: { skill: 'agility', level: 40 },
    pieces: {
      helmet: { name: "Aeronaut's Goggles" },
      chestplate: { name: "Aeronaut's Jacket" },
      leggings: { name: "Aeronaut's Trousers" },
      boots: { name: "Aeronaut's Boots", perk: 'no_fall_damage', perkText: 'No fall damage (alone too)' }
    },
    set: { attributes: { speed: 0.15, stepHeight: 0.6, swimSpeed: 0.5 }, text: '+15% speed, step up whole blocks, swim faster' },
    synergy: { relic: 'relics:kinetic_belt', attributes: { speed: 0.1 }, text: 'another +10% speed' },
    howToGet: "Mechanical crafting from leather, propeller parts and sturdy sheets."
  },
  {
    id: 'duelist',
    name: 'Brass Duelist Set',
    material: 'duelist',
    theme: 'Fighting armour: every piece sharpens your criticals.',
    requirement: { skill: 'attack', level: 40 },
    pieces: {
      helmet: { name: 'Duelist Helm', stats: { critChance: 0.02 } },
      chestplate: { name: 'Duelist Cuirass', stats: { critChance: 0.02 } },
      leggings: { name: 'Duelist Greaves', stats: { critChance: 0.02 } },
      boots: { name: 'Duelist Sabatons', stats: { critChance: 0.02 } }
    },
    set: { stats: { critChance: 0.1, critDamage: 0.25 }, text: '+10% crit chance and +25% crit damage' },
    synergy: { relic: 'relics:ring_of_the_seven_deadly_sins', stats: { critDamage: 0.15 }, text: 'another +15% crit damage' },
    howToGet: 'Mechanical crafting from brass plates, precision mechanisms and a duelist\'s pattern.'
  },
  {
    id: 'compacted_diamond',
    name: 'Compacted Diamond Set',
    material: 'compacted_diamond',
    theme: 'Heavy plate pressed from compacted diamond.',
    requirement: { skill: 'defence', level: 45 },
    pieces: {
      helmet: { name: 'Compacted Diamond Helmet' },
      chestplate: { name: 'Compacted Diamond Chestplate' },
      leggings: { name: 'Compacted Diamond Leggings' },
      boots: { name: 'Compacted Diamond Boots' }
    },
    set: { perks: ['damage_reduction_10'], text: 'Bulwark: 10% less damage from everything' },
    howToGet: 'Press diamonds into compacted diamond (basin + mechanical press), then mechanical crafting.'
  },
  {
    id: 'compacted_netherite',
    name: 'Compacted Netherite Set',
    material: 'compacted_netherite',
    theme: 'The last armour you will need.',
    requirement: { skill: 'defence', level: 60 },
    pieces: {
      helmet: { name: 'Compacted Netherite Helmet' },
      chestplate: { name: 'Compacted Netherite Chestplate' },
      leggings: { name: 'Compacted Netherite Leggings' },
      boots: { name: 'Compacted Netherite Boots' }
    },
    set: { attributes: { health: 8 }, perks: ['damage_reduction_10'], text: '+4 hearts and Bulwark' },
    howToGet: 'Compacted netherite (basin + press) and smithing over compacted diamond.'
  }
]

/** Single armour pieces with a perk, outside any set. `source: 'loot'` means they only drop (see LOOT). */
export const PIECES = [
  {
    id: 'anglers_cap',
    name: "Angler's Cap",
    slot: 'helmet',
    material: 'aeronaut',
    stats: { luck: 2 },
    requirement: { skill: 'fishing', level: 25 },
    text: '+2 Luck: better catches and better loot',
    howToGet: 'Crafted from leather, string and a fishing rod.'
  },
  {
    id: 'ember_crown',
    name: 'Ember Crown',
    slot: 'helmet',
    material: 'duelist',
    perk: 'fire_immunity',
    stats: { damage: 1 },
    requirement: { skill: 'defence', level: 40 },
    source: 'loot',
    text: 'Fire Resistance while worn, +1 damage',
    howToGet: 'Only found in Nether fortress and bastion chests.'
  }
]

export const WEAPONS = [
  {
    id: 'brass_sabre',
    name: 'Brass Sabre',
    type: 'sword',
    tier: 'iron',
    damage: 6,
    attackSpeed: -2.0,
    stats: { critChance: 0.1 },
    requirement: { skill: 'attack', level: 25 },
    text: 'Fast, and +10% crit chance',
    howToGet: 'Mechanical crafting from brass ingots and a sturdy sheet.'
  },
  {
    id: 'sturdy_warhammer',
    name: 'Sturdy Warhammer',
    type: 'sword',
    tier: 'diamond',
    damage: 11,
    attackSpeed: -3.2,
    stats: { knockback: 1 },
    requirement: { skill: 'attack', level: 45 },
    text: 'Slow, heavy, sends things flying',
    howToGet: 'Mechanical crafting from sturdy sheets, a precision mechanism and a shaft.'
  },
  {
    id: 'stormcallers_sabre',
    name: "Stormcaller's Sabre",
    type: 'sword',
    tier: 'diamond',
    damage: 8,
    attackSpeed: -2.2,
    stats: { critChance: 0.05 },
    perk: 'shock_strike',
    requirement: { skill: 'attack', level: 50 },
    source: 'loot',
    text: 'One hit in ten shocks the target for 3 extra damage',
    howToGet: 'Only found in pillager outpost and Dungeons Arise chests.'
  }
]

export const TOOLS = [
  {
    id: 'lumber_axe',
    name: 'Lumber Axe',
    type: 'axe',
    tier: 'iron',
    perk: 'fell_tree',
    requirement: { skill: 'woodcutting', level: 30 },
    text: 'Chop one log and the whole tree comes down',
    howToGet: 'Mechanical crafting from iron sheets, andesite alloy and a mechanical saw.'
  },
  {
    id: 'excavators_pickaxe',
    name: "Excavator's Pickaxe",
    type: 'pickaxe',
    tier: 'iron',
    perk: 'mine_3x3',
    requirement: { skill: 'mining', level: 40 },
    text: 'Mines a 3x3 (sneak for a single block)',
    howToGet: 'Mechanical crafting from iron sheets, a drill and brass.'
  },
  {
    id: 'prospectors_pickaxe',
    name: "Prospector's Pickaxe",
    type: 'pickaxe',
    tier: 'iron',
    perk: 'auto_smelt',
    requirement: { skill: 'mining', level: 30 },
    text: 'Ores come out already smelted',
    howToGet: 'Mechanical crafting from iron sheets, a blaze burner and copper.'
  },
  {
    id: 'harvesters_scythe',
    name: "Harvester's Scythe",
    type: 'hoe',
    tier: 'iron',
    perk: 'harvest_radius',
    requirement: { skill: 'farming', level: 30 },
    text: 'Right-click: harvests and replants a 5x5 of ripe crops',
    howToGet: 'Mechanical crafting from iron sheets, a mechanical harvester and a shaft.'
  },
  {
    id: 'builders_wand',
    name: "Builder's Wand",
    type: 'basic',
    perk: 'extend_face',
    maxDamage: 512,
    requirement: { skill: 'crafting', level: 30 },
    text: 'Right-click a block face to extend it with matching blocks from your inventory (up to 32)',
    howToGet: 'Mechanical crafting from brass, a precision mechanism and a schematicannon core.'
  }
]

/** Intermediate materials. */
export const MATERIAL_ITEMS = [
  { id: 'compacted_diamond', name: 'Compacted Diamond', howToGet: 'Four diamonds compacted in a basin under a mechanical press.' },
  { id: 'compacted_netherite', name: 'Compacted Netherite', howToGet: 'Four netherite ingots compacted in a basin under a heated mechanical press.', fireResistant: true },
  { id: 'duelists_pattern', name: "Duelist's Pattern", howToGet: 'Only found in Dungeons Arise chests; one pattern per set piece.' }
]

/**
 * Recipes. `mechanical_crafting` is Create's (a pattern with keys), `compacting` is basin + press, `shaped` and
 * `smithing` are vanilla. Ids are item ids without the namespace for the pack's own items.
 */
export const RECIPES = [
  { type: 'compacting', result: 'compacted_diamond', ingredients: ['4x minecraft:diamond'] },
  { type: 'compacting', result: 'compacted_netherite', ingredients: ['4x minecraft:netherite_ingot'], heat: 'heated' },
  {
    type: 'mechanical_crafting',
    result: 'lumber_axe',
    pattern: ['SSM', 'SAM', ' R '],
    key: { S: 'create:iron_sheet', M: 'create:mechanical_saw', A: 'create:andesite_alloy', R: 'create:shaft' }
  },
  {
    type: 'mechanical_crafting',
    result: 'excavators_pickaxe',
    pattern: ['SDS', 'BRB', ' R '],
    key: { S: 'create:iron_sheet', D: 'create:mechanical_drill', B: 'create:brass_ingot', R: 'create:shaft' }
  },
  {
    type: 'mechanical_crafting',
    result: 'prospectors_pickaxe',
    pattern: ['SBS', 'CRC', ' R '],
    key: { S: 'create:iron_sheet', B: 'create:blaze_burner', C: 'create:copper_sheet', R: 'create:shaft' }
  },
  {
    type: 'mechanical_crafting',
    result: 'harvesters_scythe',
    pattern: ['SSH', ' R ', ' R '],
    key: { S: 'create:iron_sheet', H: 'create:mechanical_harvester', R: 'create:shaft' }
  },
  {
    type: 'mechanical_crafting',
    result: 'builders_wand',
    pattern: ['  P', ' B ', 'C  '],
    key: { P: 'create:precision_mechanism', B: 'create:brass_ingot', C: 'create:schematicannon' }
  },
  {
    type: 'mechanical_crafting',
    result: 'brass_sabre',
    pattern: [' B', 'BS', 'R '],
    key: { B: 'create:brass_ingot', S: 'create:sturdy_sheet', R: 'create:shaft' }
  },
  {
    type: 'mechanical_crafting',
    result: 'sturdy_warhammer',
    pattern: ['SPS', 'SSS', ' R '],
    key: { S: 'create:sturdy_sheet', P: 'create:precision_mechanism', R: 'create:shaft' }
  },
  { type: 'shaped', result: 'anglers_cap', pattern: ['LLL', 'LRL'], key: { L: 'minecraft:leather', R: 'minecraft:fishing_rod' } },
  // Armour: the four pieces of each set share one recipe shape per slot.
  ...armourRecipes('prospector', { C: 'create:brass_casing', A: 'create:andesite_alloy', X: 'create:brass_ingot' }, { helmet: 'minecraft:lantern' }),
  ...armourRecipes('aeronaut', { C: 'minecraft:leather', A: 'create:sturdy_sheet', X: 'aeronautics:propeller_bearing' }),
  ...armourRecipes('duelist', { C: 'create:brass_sheet', A: 'create:precision_mechanism', X: 'lemursaucepacket:duelists_pattern' }),
  ...armourRecipes('compacted_diamond', { C: 'lemursaucepacket:compacted_diamond', A: 'create:sturdy_sheet', X: 'create:precision_mechanism' }),
  { type: 'smithing', result: 'compacted_netherite_helmet', base: 'compacted_diamond_helmet', addition: 'compacted_netherite' },
  { type: 'smithing', result: 'compacted_netherite_chestplate', base: 'compacted_diamond_chestplate', addition: 'compacted_netherite' },
  { type: 'smithing', result: 'compacted_netherite_leggings', base: 'compacted_diamond_leggings', addition: 'compacted_netherite' },
  { type: 'smithing', result: 'compacted_netherite_boots', base: 'compacted_diamond_boots', addition: 'compacted_netherite' }
]

/** Mechanical-crafting shapes for a set: C = casing/plate, A = accent, X = the set's special ingredient. */
function armourRecipes(setId, key, extra = {}) {
  const shapes = {
    helmet: ['CXC', 'CAC'],
    chestplate: ['CAC', 'CXC', 'CCC'],
    leggings: ['CXC', 'CAC', 'C C'],
    boots: ['CAC', 'CXC']
  }
  return Object.entries(shapes).map(([slot, pattern]) => {
    if (!extra[slot]) return { type: 'mechanical_crafting', result: `${setId}_${slot}`, pattern, key }
    // This slot swaps the special ingredient for another (the lamp in the Prospector's helmet).
    const { X, ...rest } = key
    return { type: 'mechanical_crafting', result: `${setId}_${slot}`, pattern: pattern.map((row) => row.replace('X', 'L')), key: { ...rest, L: extra[slot] } }
  })
}

/** Loot-only items (LootJS): which chests, and how likely. */
export const LOOT = [
  { item: 'ember_crown', tables: ['minecraft:chests/nether_bridge', 'minecraft:chests/bastion_treasure'], chance: 0.12 },
  { item: 'stormcallers_sabre', tables: ['minecraft:chests/pillager_outpost', '#dungeons_arise'], chance: 0.06 },
  { item: 'duelists_pattern', tables: ['#dungeons_arise', 'minecraft:chests/stronghold_library', 'minecraft:chests/ancient_city'], chance: 0.25, count: [1, 2] }
]

/** Crit multiplier the skills script uses (1.5x); critDamage stats add to it. */
export const CRIT_MULTIPLIER = 1.5
