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
// What every skill unlocks level by level (RuneScape style) lives in skills/unlocks.mjs: this script writes its
// planting and chopping rules for PMMO, the gates lsp_fixes enforces (pack/config/lemursaucepacket/skill_gates.json:
// making things, brewing, drops, fishing treasure) and the skill guide in docs/skills.md. Brewing XP is lsp_fixes'
// (per potion, scaled by what it takes to brew), not PMMO's BREW event, which can't tell one potion from another.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENCHANT_XP } from '../enchanting/enchanting.mjs'
import {
  BREW, BREW_XP, CHOP, CONSTRUCTION_RECIPES, CONSTRUCTION_SAVE_NEVER, CONSTRUCTION_SAVE_PER_LEVEL, CONSTRUCTION_XP, CRAFT, DROPS, FISHING_TREASURE, PALETTE, PLANT, POTION_FORM_LEVEL, POTION_LEVEL,
  QUEST_REQUIREMENTS, RANGED, RELIC_WEAR, SKILL_INFO
} from './unlocks.mjs'

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
    enchanting: ['Enchanting', 0xe0ac46],
    brewing: ['Brewing', 0xe0ac46],
    construction: ['Construction', 0xe0ac46]
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
// Ranged gear (skills/unlocks.mjs RANGED): using it, and hitting with it.
for (const { level, items } of RANGED) requirements.push([`ranged_${level}`, items, { USE: { ranged: level }, WEAPON: { ranged: level } }, 'weakness'])
requirements.push(
  ['mace', ['minecraft:mace'], { WEAPON: { attack: 50 }, WEAR: { attack: 50 } }, 'weakness'],
  ['turtle_helmet', ['minecraft:turtle_helmet'], { WEAR: { defence: 20 } }, 'slowness'],
  ['elytra', ['minecraft:elytra'], { WEAR: { agility: 30 } }, 'slowness'],
  ...RELIC_WEAR.map(({ item, skill, level }) => [`relic_${item.split(':')[1]}`, [item], { WEAR: { [skill]: level } }, 'slowness']),
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

// Farming plants and Woodcutting chops by level (skills/unlocks.mjs).
for (const { level, blocks } of PLANT) write(path.join(rulesDir, 'blocks', `req_plant_${level}_${blocks[0].split(':')[1]}.json`), { override: false, isTagFor: blocks, requirements: { PLACE: { farming: level } } })
for (const { level, blocks } of CHOP) write(path.join(rulesDir, 'blocks', `req_chop_${level}.json`), { override: false, isTagFor: blocks, requirements: { BREAK: { woodcutting: level } } })

// Construction's alternate recipes (skills/unlocks.mjs CONSTRUCTION_RECIPES): plain datapack recipes, gated by id.
const recipeDir = path.join(dataDir, 'lemursaucepacket', 'recipe', 'construction')
rmSync(recipeDir, { recursive: true, force: true })
for (const r of CONSTRUCTION_RECIPES) {
  write(path.join(recipeDir, `${r.id}.json`), {
    type: 'minecraft:crafting_shaped',
    category: 'building',
    pattern: r.pattern,
    key: Object.fromEntries(Object.entries(r.key).map(([k, item]) => [k, { item }])),
    result: { id: r.result, count: r.count }
  })
}

// What lsp_fixes enforces itself (skills and construction packages): making things, brewing, drops, fishing
// treasure, recipes only a level may use, and Construction's XP, saving perk and palette.
write(path.join(root, 'pack', 'config', 'lemursaucepacket', 'skill_gates.json'), {
  craft: CRAFT.map(({ skill, level, what, items }) => ({ skill, level, what, items })),
  wear: RELIC_WEAR,
  recipes: CONSTRUCTION_RECIPES.map(({ id, level, what }) => ({ id: `lemursaucepacket:construction/${id}`, skill: 'construction', level, what })),
  construction: {
    xp: CONSTRUCTION_XP.map(({ xp, what, match }) => ({ xp, what, match })),
    savePerLevel: CONSTRUCTION_SAVE_PER_LEVEL,
    saveNever: CONSTRUCTION_SAVE_NEVER,
    palette: PALETTE
  },
  brew: BREW.map(({ level, item, what }) => ({ level, item, what })),
  brewXp: BREW_XP,
  // Every potion id the game has for each base: its longer (long_) and stronger (strong_) kinds take more.
  potions: Object.fromEntries(
    Object.entries(POTION_LEVEL).flatMap(([id, level]) => [
      [`minecraft:${id}`, level],
      [`minecraft:long_${id}`, Math.max(level, 30)],
      [`minecraft:strong_${id}`, Math.max(level, 60)]
    ])
  ),
  potionForms: POTION_FORM_LEVEL,
  drops: DROPS,
  fishingTreasure: FISHING_TREASURE
})
writeSkillGuide()
writeGuideData()

const fileCount = requirements.length + ITEM_XP.length + BLOCK_XP.length
console.log(`${allSkills.length} skills, ${requirements.length} requirement rules, ${ITEM_XP.length + BLOCK_XP.length} XP rules (${fileCount} files), ${PLANT.length + CHOP.length} planting/chopping rules, ${CRAFT.length} making gates, ${BREW.length} brewing gates, ${CONSTRUCTION_RECIPES.length} Construction recipes, ${PALETTE.categories.length} palette categories; level 99 costs ${RUNESCAPE_LEVELS.reduce((a, b) => a + b, 0).toLocaleString('en')} XP`)

// ---------------------------------------------------------------- the wiki's skill guide

/** docs/skills.md between its skill-guide markers: what each level of each skill unlocks, from skills/unlocks.mjs. */
function writeSkillGuide() {
  const file = path.join(root, 'docs', 'skills.md')
  const START = '<!-- skill-guide: generated by skills/build.mjs from skills/unlocks.mjs -->'
  const END = '<!-- /skill-guide -->'
  const text = readFileSync(file, 'utf8')
  const a = text.indexOf(START)
  const b = text.indexOf(END)
  if (a < 0 || b < a) {
    console.warn('docs/skills.md has no skill-guide markers: the guide was not written')
    return
  }
  const name = (skill) => (skill === 'combat' ? 'Combat' : skill.split('|').map((s) => s[0].toUpperCase() + s.slice(1)).join(' or '))
  const table = (title, head, rows) => [`### ${title}`, '', `| Level | ${head} |`, '|---|---|', ...rows.sort((x, y) => x[0] - y[0]).map(([l, w]) => `| ${l} | ${w} |`), '']
  const made = (skill) => CRAFT.filter((c) => c.skill === skill && !c.machine).map((c) => [c.level, c.what])
  const lines = [START, '']
  lines.push(...table('Crafting', 'Lets you make', made('crafting')))
  lines.push(...table('Smithing', 'Lets you make', made('smithing')))
  lines.push(...table('Cooking', 'Lets you make', made('cooking')))
  lines.push(...table('Brewing', 'Lets you brew', [...BREW.map((x) => [x.level, `${x.what} (${x.item.replace('minecraft:', '').replace(/_/g, ' ')})`]), ...made('brewing').map(([l, w]) => [l, `${w} (crafting)`])]))
  lines.push(...table('Farming', 'Lets you plant', PLANT.map((p) => [p.level, p.what])))
  lines.push(...table('Woodcutting', 'Lets you chop', CHOP.map((c) => [c.level, c.what])))
  lines.push(...table('Fishing', 'Lets you', [[FISHING_TREASURE, 'Land treasure: enchanted books and gear, name tags, saddles, nautilus shells (below it, treasure comes up as a fish)']]))
  lines.push(...table('Ranged', 'Lets you use', RANGED.map((r) => [r.level, r.what])))
  lines.push(...table('Combat level', 'Lets you', DROPS.filter((d) => d.skill === 'combat').map((d) => [d.level, `Get ${d.what.charAt(0).toLowerCase() + d.what.slice(1)} as drops`])))
  // Create's machines: every skill's milestones in one table, by level.
  lines.push('### Create machines', '', '| Level | Skill | Lets you make |', '|---|---|---|',
    ...CRAFT.filter((c) => c.machine).sort((x, y) => x.level - y.level || x.skill.localeCompare(y.skill)).map((c) => `| ${c.level} | ${name(c.skill)} | ${c.what} |`), '')
  lines.push(...table('Construction', 'Lets you make', [
    ...CONSTRUCTION_RECIPES.map((r) => [r.level, r.what]),
    [PALETTE.level, "Use the Mason's Palette: as many of one decorative block as you like (see below)"]
  ]))
  lines.push('| XP a block | What you build with |', '|---|---|', ...CONSTRUCTION_XP.filter((x) => x.xp > 0).sort((a, b) => b.xp - a.xp).map((x) => `| ${x.xp} | ${x.what} |`))
  lines.push(`| 0 | ${CONSTRUCTION_XP.find((x) => x.xp === 0).what} |`, '')
  lines.push('### Quest requirements', '', '| Quest | Needs |', '|---|---|')
  for (const [quest, reqs] of Object.entries(QUEST_REQUIREMENTS)) {
    const list = Object.entries(reqs).map(([s, l]) => `${name(s)} ${l}`)
    lines.push(`| ${quest} | ${list.length ? list.join(', ') : 'Nothing'} |`)
  }
  lines.push('', END)
  writeFileSync(file, text.slice(0, a) + lines.join('\n') + text.slice(b + END.length))
}

// ---------------------------------------------------------------- the in-game skill guide

/**
 * pack/kubejs/assets/lemursaucepacket/skill_guide.json, for lsp_fixes' skill screens (ESC > Skills, or a skill in the
 * inventory): every skill's unlocks by level, each with an item to show, from the same tables as the wiki's guide.
 */
function writeGuideData() {
  const out = {}
  const add = (skill, level, kind, title, icon) => (out[skill] ??= []).push({ level, kind, title, icon })
  const tierName = (t) => (t === 'golden' ? 'gold' : t)
  // Gear tiers (Project MMO's rules above): what you can wield, wear and use.
  for (const [tier, level] of Object.entries(TIER)) {
    if (level <= 1 || tier === 'chainmail') continue
    add('attack', level, 'wield', `Wield ${tierName(tier)} swords and axes`, `minecraft:${tier}_sword`)
    add('mining', level, 'use', `Mine with ${tierName(tier)} pickaxes and shovels`, `minecraft:${tier}_pickaxe`)
    add('woodcutting', level, 'use', `Chop with ${tierName(tier)} axes`, `minecraft:${tier}_axe`)
    add('farming', level, 'use', `Farm with ${tierName(tier)} hoes`, `minecraft:${tier}_hoe`)
  }
  for (const [tier, level] of Object.entries(ARMOR_TIER)) if (level > 1) add('defence', level, 'wear', `Wear ${tierName(tier)} armour`, `minecraft:${tier}_chestplate`)
  add('attack', 50, 'wield', 'Wield the mace', 'minecraft:mace')
  add('defence', 20, 'wear', 'Wear the turtle shell', 'minecraft:turtle_helmet')
  add('defence', 5, 'wear', 'Wear copper diving gear', 'create:copper_diving_helmet')
  add('defence', 50, 'wear', 'Wear netherite diving gear', 'create:netherite_diving_helmet')
  add('agility', 30, 'wear', 'Wear the elytra', 'minecraft:elytra')
  for (const r of RELIC_WEAR) add(r.skill, r.level, 'wear', `Wear ${r.what}`, r.item)
  for (const r of RANGED) add('ranged', r.level, 'use', r.what, r.items[0])
  // Making things, and Create's machines.
  const itemOf = (id) => (id.startsWith('#') ? 'minecraft:coast_armor_trim_smithing_template' : id)
  for (const c of CRAFT) add(c.skill, c.level, c.machine ? 'machine' : 'make', c.what, itemOf(c.items[0]))
  // Growing, chopping, brewing, fishing.
  const SEEDS = {
    'minecraft:beetroots': 'minecraft:beetroot_seeds', 'farmersdelight:cabbages': 'farmersdelight:cabbage_seeds', 'farmersdelight:budding_tomatoes': 'farmersdelight:tomato_seeds',
    'minecraft:pumpkin_stem': 'minecraft:pumpkin_seeds', 'farmersdelight:rice': 'farmersdelight:rice', 'minecraft:cocoa': 'minecraft:cocoa_beans', 'minecraft:nether_wart': 'minecraft:nether_wart',
    'minecraft:torchflower_crop': 'minecraft:torchflower_seeds', 'minecraft:chorus_flower': 'minecraft:chorus_flower'
  }
  for (const p of PLANT) add('farming', p.level, 'plant', `Plant ${p.what.charAt(0).toLowerCase()}${p.what.slice(1)}`, SEEDS[p.blocks[0]] ?? p.blocks[0])
  for (const c of CHOP) add('woodcutting', c.level, 'chop', `Chop ${c.what.charAt(0).toLowerCase()}${c.what.slice(1)}`, c.blocks[0])
  for (const b of BREW) add('brewing', b.level, 'brew', b.what, b.item)
  add('fishing', FISHING_TREASURE, 'catch', 'Land treasure: enchanted books and gear, name tags, saddles, nautilus shells', 'minecraft:nautilus_shell')
  // Construction.
  for (const r of CONSTRUCTION_RECIPES) add('construction', r.level, 'make', r.what, r.result)
  add('construction', PALETTE.level, 'perk', "The Mason's Palette: as many of one decorative block as you like", 'lsp_fixes:masons_palette')
  // The main quests' requirements ("attack|ranged": either), and every skill's cape at 99.
  for (const [quest, reqs] of Object.entries(QUEST_REQUIREMENTS))
    for (const [skills, level] of Object.entries(reqs))
      for (const skill of skills.split('|')) if (SKILL_INFO[skill]) add(skill, level, 'quest', `${quest} (quest)`, 'ftbquests:book')
  for (const skill of Object.keys(SKILL_INFO)) add(skill, 99, 'cape', `The ${skill.charAt(0).toUpperCase()}${skill.slice(1)} Cape`, `lemursaucepacket:${skill}_cape`)
  // What the every-level gains add up to on the way (shown with the skill's own icon).
  const pct = (x) => `${Math.round(x * 1000) / 10}%`
  for (const L of [25, 50, 75, 99]) {
    add('attack', L, 'perk', `+${(PER_LEVEL.attackDamage * L).toFixed(2)} melee damage and +${pct(PER_LEVEL.rangedDamage * L)} bow damage in all`, null)
    add('strength', L, 'perk', `${pct(0.003 * L)} melee critical chance in all`, null)
    add('defence', L, 'perk', `+${(PER_LEVEL.armor * L).toFixed(2)} armour in all`, null)
    add('ranged', L, 'perk', `${pct(0.003 * L)} ranged critical chance in all`, null)
    add('hitpoints', L, 'perk', `+${(PER_LEVEL.maxHealth * L).toFixed(1)} max health in all (${(PER_LEVEL.maxHealth * L / 2).toFixed(1)} hearts)`, null)
    add('agility', L, 'perk', `+${pct(PER_LEVEL.moveSpeed * L * 10)} speed and ${pct(Math.min(0.5, PER_LEVEL.fallReduce * L))} less fall damage in all`, null)
    for (const skill of ['mining', 'woodcutting', 'farming']) add(skill, L, 'perk', `+${pct(PER_LEVEL.dig * L)} ${skill === 'farming' ? 'tilling' : skill === 'mining' ? 'mining' : 'chopping'} speed in all`, null)
    add('construction', L, 'perk', `${pct(CONSTRUCTION_SAVE_PER_LEVEL * L)} chance a placed block isn't used up`, null)
  }
  // The groups, as Project MMO's skill types (the skills screen's columns), each with its colour.
  const groups = Object.entries(SKILLS).map(([id, members]) => ({ id, name: TYPE_NAMES[id], color: Object.values(members)[0][1], skills: Object.keys(members) }))
  const skills = {}
  for (const [skill, info] of Object.entries(SKILL_INFO)) skills[skill] = { ...info, unlocks: (out[skill] ?? []).sort((a, b) => a.level - b.level) }
  const file = path.join(root, 'pack', 'kubejs', 'assets', 'lemursaucepacket', 'skill_guide.json')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({ comment: 'Written by skills/build.mjs from skills/unlocks.mjs: do not edit by hand.', groups, skills }, null, 1) + '\n')
  console.log(`skills: the in-game guide lists ${Object.values(skills).reduce((n, x) => n + x.unlocks.length, 0)} unlocks over ${Object.keys(skills).length} skills`)
}
