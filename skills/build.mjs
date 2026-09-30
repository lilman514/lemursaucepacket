// LemurSaucePacket's RuneScape-style skills, written out as Project MMO (PMMO 2.10, NeoForge 1.21.1) config.
//
//   node skills/build.mjs            (publish/publish.mjs runs it)
//
// Everything a player can level, what XP it takes, what each level gives and which items each skill gates
// lives in the tables below; this script turns them into PMMO's datapack files under
// pack/kubejs/data/pmmo/config/ (server, skills, perks, autovalues) and pack/kubejs/data/lemursaucepacket/pmmo/
// (item and block rules), plus skill names in pack/kubejs/assets/pmmo/lang/en_us.json.
//
// PMMO facts this relies on (checked against its source, branch 1-21-1):
// - config files replace the built-in ones only when complete; an incomplete file is ignored silently;
// - item/block files are merged per id, highest level per skill wins; "isTagFor" applies a file to items/tags;
// - the "builtin/default" datapack adds requirements for PMMO's own skills (e.g. combat 60 for diamond swords),
//   so the pack disables it (kubejs/server_scripts/skills.js);
// - static_levels is the XP each level costs (not cumulative), capped at its length;
// - USE_ENCHANTMENT requirements stay off: in 2.10.47 an enchantment's requirements replace the item's own
//   (Core.getReqMap -> getCommonReqData only reads item data when the map is still empty), so a Sharpness VI
//   sword would need Enchanting but no Attack. Enchanting caps are enforced by kubejs/*/enchanting.js instead.
// Crit chances for Strength and Ranged are not PMMO perks: kubejs/server_scripts/skills.js rolls them.
// Enchanting (the skill) is defined here; what it unlocks lives in enchanting/enchanting.mjs.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENCHANT_XP } from '../enchanting/enchanting.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'pack', 'kubejs', 'data')
const configDir = path.join(dataDir, 'pmmo', 'config')
const rulesDir = path.join(dataDir, 'lemursaucepacket', 'pmmo')
const langFile = path.join(root, 'pack', 'kubejs', 'assets', 'pmmo', 'lang', 'en_us.json')

// ---------------------------------------------------------------- skills

// RuneScape's XP table: the XP each level costs, 1 -> 99 (13,034,431 in total).
const RUNESCAPE_LEVELS = (() => {
  const out = [0]
  let points = 0
  for (let level = 1; level < 99; level++) {
    points += Math.floor(level + 300 * 2 ** (level / 7))
    out.push(Math.floor(points / 4) - out.reduce((a, b) => a + b, 0))
  }
  return out
})()

// Skill colours are one per group (ember, green, brass, sky), matching the UI kit. Skill icons are the pack's own art (art/generated/skill-icons.png, cut by art/process.mjs into
// pack/kubejs/assets/lemursaucepacket/textures/skills), in the same style as the quest emblems.
const SKILL_ICON_SIZE = 64
const SKILLS = {
  combat: {
    attack: ['Attack', 0xe8623a],
    strength: ['Strength', 0xe8623a],
    defence: ['Defence', 0xe8623a],
    ranged: ['Ranged', 0xe8623a],
    hitpoints: ['Hitpoints', 0xe8623a]
  },
  gathering: {
    mining: ['Mining', 0x8fc44a],
    woodcutting: ['Woodcutting', 0x8fc44a],
    farming: ['Farming', 0x8fc44a],
    fishing: ['Fishing', 0x8fc44a]
  },
  artisan: {
    cooking: ['Cooking', 0xe0ac46],
    smithing: ['Smithing', 0xe0ac46],
    crafting: ['Crafting', 0xe0ac46],
    enchanting: ['Enchanting', 0xe0ac46]
  },
  support: {
    agility: ['Agility', 0x6fb7e8]
  }
}
const TYPE_NAMES = { combat: 'Combat', gathering: 'Gathering', artisan: 'Artisan', support: 'Support' }

// What each level gives (PMMO perks). Attack also adds ranged damage; crits live in skills.js.
const PER_LEVEL = {
  attackDamage: 0.04, // melee damage per Attack level: +2 at 50, +3.96 at 99
  rangedDamage: 0.004, // bow/crossbow damage multiplier per Attack level: x1.2 at 50, x1.4 at 99
  maxHealth: 0.2, // max health per Hitpoints level: one heart per 10 levels (and Hitpoints XP is cut to a third)
  armor: 0.02, // armour points per Defence level: +1 at 50
  moveSpeed: 0.0001, // movement speed per Agility level: about +5% at 50
  fallReduce: 0.005, // fall damage reduction per Agility level, capped at 50%
  dig: 0.005 // mining/chopping/tilling speed per level of the matching skill
}

// ---------------------------------------------------------------- item requirements (RuneScape-style tiers)

const TIER = { wooden: 1, stone: 5, golden: 10, chainmail: 10, iron: 15, diamond: 30, netherite: 50 }
const ARMOR_TIER = { leather: 1, chainmail: 10, golden: 10, iron: 15, diamond: 30, netherite: 50 }
const PIECES = ['helmet', 'chestplate', 'leggings', 'boots']

const requirements = [] // [file name, items, requirements, penalty]
for (const [tier, level] of Object.entries(TIER)) {
  if (tier === 'chainmail' || level <= 1) continue
  // Swords also carry a held penalty; axes are woodcutting tools too, so only hitting with them is gated.
  requirements.push([`${tier}_swords`, [`minecraft:${tier}_sword`], { WEAPON: { attack: level }, WEAR: { attack: level } }, 'weakness'])
  requirements.push([`${tier}_axe_weapons`, [`minecraft:${tier}_axe`], { WEAPON: { attack: level } }])
  requirements.push([`${tier}_mining_tools`, [`minecraft:${tier}_pickaxe`, `minecraft:${tier}_shovel`], { TOOL: { mining: level } }])
  requirements.push([`${tier}_axes`, [`minecraft:${tier}_axe`], { TOOL: { woodcutting: level } }])
  requirements.push([`${tier}_hoes`, [`minecraft:${tier}_hoe`], { TOOL: { farming: level }, USE: { farming: level } }])
}
for (const [tier, level] of Object.entries(ARMOR_TIER)) {
  if (level <= 1) continue
  requirements.push([`${tier}_armor`, PIECES.map((p) => `minecraft:${tier}_${p}`), { WEAR: { defence: level } }, 'slowness'])
}
requirements.push(
  ['crossbow', ['minecraft:crossbow'], { USE: { attack: 15 }, WEAPON: { attack: 15 } }, 'weakness'],
  ['trident', ['minecraft:trident'], { USE: { attack: 40 }, WEAPON: { attack: 40 } }, 'weakness'],
  ['mace', ['minecraft:mace'], { WEAPON: { attack: 50 }, WEAR: { attack: 50 } }, 'weakness'],
  ['potato_cannon', ['create:potato_cannon'], { USE: { attack: 20 } }],
  ['turtle_helmet', ['minecraft:turtle_helmet'], { WEAR: { defence: 20 } }, 'slowness'],
  ['elytra', ['minecraft:elytra'], { WEAR: { agility: 30 } }, 'slowness'],
  ['copper_diving_gear', ['create:copper_diving_helmet', 'create:copper_backtank', 'create:copper_diving_boots'], { WEAR: { defence: 5 } }, 'slowness'],
  ['netherite_diving_gear', ['create:netherite_diving_helmet', 'create:netherite_backtank', 'create:netherite_diving_boots'], { WEAR: { defence: 50 } }, 'slowness']
)
const PENALTY = { weakness: { 'minecraft:weakness': 2 }, slowness: { 'minecraft:slowness': 2 } }

// ---------------------------------------------------------------- XP sources

// Per point of damage dealt, taken or absorbed (RuneScape gives 4 per damage to the trained style).
const DAMAGE_XP = {
  DEAL_DAMAGE: {
    'minecraft:player_attack': { attack: 4, strength: 4, hitpoints: 1.33 },
    '#minecraft:is_projectile': { attack: 2, ranged: 4, hitpoints: 1.33 }
  },
  RECEIVE_DAMAGE: {
    'minecraft:mob_attack': { hitpoints: 1 },
    'minecraft:player_attack': { hitpoints: 1 },
    '#minecraft:is_projectile': { hitpoints: 1 }
  },
  MITIGATE_DAMAGE: {
    'minecraft:mob_attack': { defence: 4 },
    'minecraft:player_attack': { defence: 4 },
    '#minecraft:is_projectile': { defence: 4 }
  }
}

// [file name, blocks or tags, BLOCK_BREAK xp]
const BLOCK_XP = [
  ['stone', ['#minecraft:base_stone_overworld', '#minecraft:base_stone_nether', '#c:stones'], { mining: 1 }],
  ['coal_ore', ['#c:ores/coal'], { mining: 10 }],
  ['copper_ore', ['#c:ores/copper'], { mining: 12 }],
  ['zinc_ore', ['#c:ores/zinc'], { mining: 20 }],
  ['quartz_ore', ['#c:ores/quartz'], { mining: 12 }],
  ['redstone_ore', ['#c:ores/redstone'], { mining: 18 }],
  ['iron_ore', ['#c:ores/iron'], { mining: 25 }],
  ['lapis_ore', ['#c:ores/lapis'], { mining: 25 }],
  ['gold_ore', ['#c:ores/gold'], { mining: 35 }],
  ['diamond_ore', ['#c:ores/diamond'], { mining: 80 }],
  ['emerald_ore', ['#c:ores/emerald'], { mining: 100 }],
  ['ancient_debris', ['#c:ores/netherite_scrap'], { mining: 150 }],
  ['logs', ['#minecraft:logs'], { woodcutting: 12 }],
  ['crops', ['#minecraft:crops'], { farming: 4 }],
  ['gourds', ['minecraft:melon', 'minecraft:pumpkin'], { farming: 6 }]
]

// [file name, items or tags, { EVENT: xp }]
const ITEM_XP = [
  ['fish', ['minecraft:cod'], { FISH: { fishing: 10 } }],
  ['salmon', ['minecraft:salmon'], { FISH: { fishing: 15 } }],
  ['exotic_fish', ['minecraft:tropical_fish', 'minecraft:pufferfish'], { FISH: { fishing: 20 } }],
  ['cooked_meat', ['minecraft:cooked_beef', 'minecraft:cooked_porkchop', 'minecraft:cooked_mutton', 'minecraft:cooked_rabbit'], { SMELTED: { cooking: 12 } }],
  ['cooked_poultry_fish', ['minecraft:cooked_chicken', 'minecraft:cooked_cod', 'minecraft:cooked_salmon'], { SMELTED: { cooking: 9 } }],
  ['baked_potato', ['minecraft:baked_potato'], { SMELTED: { cooking: 4 } }],
  ['baked_goods', ['minecraft:bread', 'minecraft:pumpkin_pie', 'minecraft:mushroom_stew', 'minecraft:beetroot_soup'], { CRAFT: { cooking: 8 } }],
  ['feasts', ['minecraft:cake', 'minecraft:rabbit_stew', 'minecraft:golden_carrot'], { CRAFT: { cooking: 20 } }],
  ['iron_ingot', ['minecraft:iron_ingot'], { SMELTED: { smithing: 10 } }],
  ['copper_ingot', ['minecraft:copper_ingot'], { SMELTED: { smithing: 5 } }],
  ['zinc_ingot', ['create:zinc_ingot'], { SMELTED: { smithing: 8 } }],
  ['gold_ingot', ['minecraft:gold_ingot'], { SMELTED: { smithing: 15 } }],
  ['netherite_scrap', ['minecraft:netherite_scrap'], { SMELTED: { smithing: 60 } }],
  ...['iron', 'golden', 'diamond'].map((tier) => [
    `${tier}_gear_smithing`,
    [...['sword', 'axe', 'pickaxe', 'shovel', 'hoe'].map((t) => `minecraft:${tier}_${t}`), ...PIECES.map((p) => `minecraft:${tier}_${p}`)],
    { CRAFT: { smithing: { iron: 25, golden: 20, diamond: 60 }[tier] } }
  ]),
  ['vanilla_crafting', ['minecraft:*'], { CRAFT: { crafting: 1 } }],
  ['create_crafting', ['create:*'], { CRAFT: { crafting: 3 } }],
  ['furniture_crafting', ['mcwfurnitures:*', 'woodworks:*', 'everycomp:*'], { CRAFT: { crafting: 3 } }],
  ['backpack_crafting', ['sophisticatedbackpacks:*'], { CRAFT: { crafting: 8 } }],
  // Enchanting: PMMO's ENCHANT event fires at the table (XP scaled by level / max level for each enchantment
  // rolled, so a level-5-of-10 roll gives half) and at the anvil when a book is involved (flat, for the output).
  // Grindstones have no PMMO event, and disenchanting is not worth XP anyway.
  ['enchanting', ['#c:enchantables', '#minecraft:enchantable/durability', 'minecraft:book', 'minecraft:enchanted_book'], { ENCHANT: { enchanting: ENCHANT_XP } }]
]

// ---------------------------------------------------------------- PMMO config files

const allSkills = Object.values(SKILLS).flatMap((group) => Object.keys(group))

const skillsJson = {
  skills: Object.fromEntries(
    Object.values(SKILLS).flatMap((group) =>
      Object.entries(group).map(([id, [, color]]) => [id, { color, icon: `lemursaucepacket:textures/skills/${id}.png`, iconSize: SKILL_ICON_SIZE, maxLevel: 99 }])
    )
  ),
  types: Object.fromEntries(Object.entries(SKILLS).map(([type, group], order) => [type, { order, color: Object.values(group)[0][1], skills: Object.keys(group) }]))
}

const serverJson = {
  general: { creative_reach: 50.0, salvage_block: 'minecraft:smithing_table', treasure_enabled: false, brewing_tracked: true },
  levels: {
    max_level: 99,
    static_levels: RUNESCAPE_LEVELS,
    loss_on_death: 0.0,
    lose_only_excess: true,
    global_modifier: 1.0,
    skill_modifiers: { hitpoints: 0.33 },
    xp_min: 200,
    xp_base: 1.025,
    per_level: 1.1
  },
  requirements: {
    requirement_enabled: { USE_ENCHANTMENT: false, KILL: false, TRAVEL: false, RIDE: false, TAME: false, BREED: false, ENTITY_INTERACT: false }
  },
  xp_gains: {
    reuse_penalty: 0.0,
    perks_plus_config: false,
    player_actions: { SPRINTING: { agility: 0.5 }, JUMP: { agility: 2.5 }, SPRINT_JUMP: { agility: 2.5 } },
    damage: DAMAGE_XP
  },
  party: { party_range: 50, party_bonus: {} },
  mob_scaling: { enabled: false, scaling_aoe: 150, base_level: 0, boss_scaling: 1.1, use_exponential_formula: true, per_level: 1.0, power_base: 1.104088404342588, ratios: {} },
  vein_miner: { enabled: false, require_settings: false, default_consume: 1, charge_modifier: 1.0, blacklist: [] }
}

const perksJson = {
  perks: {
    SKILL_UP: [
      { perk: 'pmmo:attribute', skill: 'attack', attribute: 'minecraft:generic.attack_damage', per_level: PER_LEVEL.attackDamage, max_boost: PER_LEVEL.attackDamage * 99 },
      { perk: 'pmmo:attribute', skill: 'hitpoints', attribute: 'minecraft:generic.max_health', per_level: PER_LEVEL.maxHealth, max_boost: PER_LEVEL.maxHealth * 99 },
      { perk: 'pmmo:attribute', skill: 'defence', attribute: 'minecraft:generic.armor', per_level: PER_LEVEL.armor, max_boost: PER_LEVEL.armor * 99 },
      { perk: 'pmmo:attribute', skill: 'agility', attribute: 'minecraft:generic.movement_speed', per_level: PER_LEVEL.moveSpeed, max_boost: PER_LEVEL.moveSpeed * 99 },
      ...allSkills.map((skill) => ({ perk: 'pmmo:fireworks', skill, per_x_level: 10 }))
    ],
    DEAL_DAMAGE: [
      { perk: 'pmmo:damage_boost', skill: 'attack', applies_to: ['minecraft:bow', 'minecraft:crossbow'], for_damage: ['minecraft:arrow'], per_level: PER_LEVEL.rangedDamage, base: 1.0, multiplicative: true }
    ],
    RECEIVE_DAMAGE: [
      { perk: 'pmmo:damage_reduce', skill: 'agility', for_damage: 'minecraft:fall', per_level: PER_LEVEL.fallReduce, max_boost: 0.5 }
    ],
    BREAK_SPEED: [
      { perk: 'pmmo:break_speed', skill: 'mining', pickaxe_dig: PER_LEVEL.dig, shovel_dig: PER_LEVEL.dig },
      { perk: 'pmmo:break_speed', skill: 'woodcutting', axe_dig: PER_LEVEL.dig },
      { perk: 'pmmo:break_speed', skill: 'farming', hoe_dig: PER_LEVEL.dig }
    ]
  }
}

// Autovalues would invent XP and requirements for everything not listed above, in PMMO's default skills.
// PMMO ignores partial files, so this is its complete default file (skills/autovalues.json) switched off; its
// penalties section still sets the effects for worn or held gear a player isn't skilled enough for.
const autovaluesJson = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'autovalues.json'), 'utf8')
)
autovaluesJson.enabled = false

// ---------------------------------------------------------------- write

const write = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

rmSync(rulesDir, { recursive: true, force: true })
write(path.join(configDir, 'skills.json'), skillsJson)
write(path.join(configDir, 'server.json'), serverJson)
write(path.join(configDir, 'perks.json'), perksJson)
write(path.join(configDir, 'autovalues.json'), autovaluesJson)
for (const [name, items, reqs, penalty] of requirements) {
  write(path.join(rulesDir, 'items', `req_${name}.json`), { override: false, isTagFor: items, requirements: reqs, ...(penalty ? { negative_effect: PENALTY[penalty] } : {}) })
}
for (const [name, items, xp] of ITEM_XP) write(path.join(rulesDir, 'items', `xp_${name}.json`), { override: false, isTagFor: items, xp_values: xp })
for (const [name, blocks, xp] of BLOCK_XP) write(path.join(rulesDir, 'blocks', `xp_${name}.json`), { override: false, isTagFor: blocks, xp_values: { BLOCK_BREAK: xp } })
write(langFile, {
  ...Object.fromEntries(Object.values(SKILLS).flatMap((group) => Object.entries(group).map(([id, [name]]) => [`pmmo.${id}`, name]))),
  ...Object.fromEntries(Object.entries(TYPE_NAMES).map(([type, name]) => [`pmmo.type.${type}`, name]))
})

const fileCount = requirements.length + ITEM_XP.length + BLOCK_XP.length
console.log(`${allSkills.length} skills, ${requirements.length} requirement rules, ${ITEM_XP.length + BLOCK_XP.length} XP rules (${fileCount} files); level 99 costs ${RUNESCAPE_LEVELS.reduce((a, b) => a + b, 0).toLocaleString('en')} XP`)
