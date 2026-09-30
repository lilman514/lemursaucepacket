#!/usr/bin/env node
// Turns enchanting/enchanting.mjs into the pack's enchanting data. Run `node enchanting/build.mjs`; publish.mjs does.
//
// Writes:
//   pack/kubejs/data/<ns>/enchantment/<id>.json            raised max levels and table costs (full overrides of the
//                                                          originals kept in enchanting/base/<ns>/<id>.json)
//   pack/kubejs/data/lemursaucepacket/enchantment/*.json   Telekinesis and Hardness
//   pack/kubejs/data/lemursaucepacket/tags/...             their item tags, the Hardness block tiers
//   pack/kubejs/data/minecraft/tags/enchantment/...        Telekinesis in the table, loot and trades
//   pack/kubejs/data/create/tags/block/non_breakable.json  hard blocks Create drills and saws can't break
//   pack/kubejs/data/create_enchantment_industry/...       no "level 11" from super enchanting; no printing Hardness tomes
//   pack/kubejs/data/minecraft/loot_table/blocks/budding_amethyst.json   drops itself to Hardness V + Silk Touch
//   pack/kubejs/server_scripts/enchanting_recipes.js       Hardness tome recipes (mechanical crafting)
//   pack/config/lemursaucepacket/enchanting.json           the tables the scripts and tooltips read
// The behaviour lives in pack/kubejs/startup_scripts/enchanting.js and pack/kubejs/server_scripts/enchanting.js
// (hand-written; they read the config).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COST, ENCHANT_XP, HARDNESS, KEEP_AVAILABLE, MAX_SKILL_LEVEL, NAMESPACE, PENALTY_EFFECTS, RAISED, TABLE_BOOST, TELEKINESIS, unlockLevel } from './enchanting.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dataDir = path.join(root, 'pack', 'kubejs', 'data')
const out = (rel, value) => {
  const file = path.join(root, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}
const js = (v) => JSON.stringify(v)
const ns = (id) => (id.includes(':') ? id : `${NAMESPACE}:${id}`)

// ---------------------------------------------------------------- originals

const base = {}
for (const dir of readdirSync(path.join(here, 'base'))) {
  for (const file of readdirSync(path.join(here, 'base', dir))) {
    base[`${dir}:${file.replace(/\.json$/, '')}`] = JSON.parse(readFileSync(path.join(here, 'base', dir, file), 'utf8'))
  }
}
for (const id of [...Object.keys(RAISED), ...KEEP_AVAILABLE]) {
  if (!base[id]) throw new Error(`enchanting: no original JSON for ${id} in enchanting/base/`)
}

// ---------------------------------------------------------------- id validation (recipes)

const registryPath = path.join(root, 'quests', '.registry.json')
if (existsSync(registryPath)) {
  const known = new Set(JSON.parse(readFileSync(registryPath, 'utf8')).item)
  for (const [tier, recipe] of Object.entries(HARDNESS.recipes)) {
    for (const id of Object.values(recipe.key)) if (!known.has(id)) console.warn(`enchanting: unknown item ${id} (Hardness ${tier} tome)`)
  }
}

// ---------------------------------------------------------------- table costs

/**
 * Linear costs (1.21 allows nothing else) chosen so that level (vanilla max + 1) needs at least COST.aboveVanillaAt
 * table power, the cap needs at most COST.capAt, and the vanilla slope is kept when both hold. The window is
 * wide so a strong table never loses an enchantment.
 */
function costFor(original, vanillaMax, cap) {
  const min1 = original.min_cost.base
  const vanillaStep = original.min_cost.per_level_above_first
  let step = vanillaStep
  if (cap > vanillaMax) {
    const stepMin = Math.ceil((COST.aboveVanillaAt - min1) / vanillaMax)
    const stepMax = Math.max(1, Math.floor((COST.capAt - min1) / (cap - 1)))
    step = Math.min(Math.max(vanillaStep, stepMin, 1), stepMax)
  }
  return {
    min_cost: { base: min1, per_level_above_first: step },
    max_cost: { base: min1 + COST.window, per_level_above_first: step }
  }
}

const table = {} // id -> { vanilla, cap, min1, step, effect, unlocks: [level for vanilla+1 .. cap] }
for (const [id, { cap, effect }] of Object.entries(RAISED)) {
  const original = base[id]
  const vanilla = original.max_level
  if (cap < vanilla) throw new Error(`enchanting: ${id} cap ${cap} is below its vanilla max ${vanilla}`)
  const costs = costFor(original, vanilla, cap)
  out(`pack/kubejs/data/${id.split(':')[0]}/enchantment/${id.split(':')[1]}.json`, { ...original, max_level: cap, ...costs })
  const unlocks = []
  for (let level = vanilla + 1; level <= cap; level++) unlocks.push(unlockLevel(vanilla, cap, level))
  table[id] = { vanilla, cap, effect, minCost: costs.min_cost, unlocks }
}
for (const id of KEEP_AVAILABLE) {
  const original = base[id]
  const costs = costFor(original, original.max_level, original.max_level)
  out(`pack/kubejs/data/${id.split(':')[0]}/enchantment/${id.split(':')[1]}.json`, { ...original, ...costs })
}

// ---------------------------------------------------------------- Telekinesis and Hardness

const description = (id, name) => ({ translate: `enchantment.${NAMESPACE}.${id}`, fallback: name })

out(`pack/kubejs/data/${NAMESPACE}/enchantment/${TELEKINESIS.id}.json`, {
  description: description(TELEKINESIS.id, TELEKINESIS.name),
  supported_items: `#${NAMESPACE}:enchantable/${TELEKINESIS.id}`,
  weight: TELEKINESIS.weight,
  max_level: 1,
  min_cost: { base: TELEKINESIS.minCost, per_level_above_first: 0 },
  max_cost: { base: TELEKINESIS.maxCost, per_level_above_first: 0 },
  anvil_cost: TELEKINESIS.anvilCost,
  slots: ['mainhand'],
  effects: {}
})
out(`pack/kubejs/data/${NAMESPACE}/tags/item/enchantable/${TELEKINESIS.id}.json`, { values: TELEKINESIS.supportedTags })
if (TELEKINESIS.tableAndLoot) out('pack/kubejs/data/minecraft/tags/enchantment/non_treasure.json', { values: [ns(TELEKINESIS.id)] })

out(`pack/kubejs/data/${NAMESPACE}/enchantment/${HARDNESS.id}.json`, {
  description: description(HARDNESS.id, HARDNESS.name),
  supported_items: `#${NAMESPACE}:enchantable/${HARDNESS.id}`,
  weight: 1,
  max_level: HARDNESS.maxLevel,
  min_cost: { base: 1, per_level_above_first: 10 },
  max_cost: { base: 200, per_level_above_first: 10 },
  anvil_cost: HARDNESS.anvilCost,
  slots: ['mainhand'],
  effects: {}
})
out(`pack/kubejs/data/${NAMESPACE}/tags/item/enchantable/${HARDNESS.id}.json`, { values: HARDNESS.supportedTags })
// Hardness tomes are made, not printed.
out('pack/kubejs/data/create_enchantment_industry/tags/enchantment/printer/deny.json', { values: [ns(HARDNESS.id)] })

// Block tiers: one tag per tier plus the union the scripts test first. Tag references to other mods are optional.
const tagEntry = (id) => ({ id, required: false })
const tierTags = []
for (const [tier, blocks] of Object.entries(HARDNESS.tiers)) {
  out(`pack/kubejs/data/${NAMESPACE}/tags/block/hardness/${tier}.json`, { values: blocks.map(tagEntry) })
  tierTags.push(`#${NAMESPACE}:hardness/${tier}`)
}
out(`pack/kubejs/data/${NAMESPACE}/tags/block/hardness/gated.json`, { values: tierTags })
// The materials from those blocks: the same tag names under tags/item, for the use-gate (lsp_fixes UseGateMixin
// and server_scripts/enchanting.js test them), plus the container items a gated stack can't be clicked into.
for (const [tier, items] of Object.entries(HARDNESS.materials)) {
  out(`pack/kubejs/data/${NAMESPACE}/tags/item/hardness/${tier}.json`, { values: items.map(tagEntry) })
}
out(`pack/kubejs/data/${NAMESPACE}/tags/item/hardness/gated.json`, { values: Object.keys(HARDNESS.materials).map((tier) => `#${NAMESPACE}:hardness/${tier}`) })
out(`pack/kubejs/data/${NAMESPACE}/tags/item/hardness/container_items.json`, { values: HARDNESS.useGate.containerItems.map(tagEntry) })
// Create drills and saws stop at the machine tier (create:non_breakable is the only thing they check).
out('pack/kubejs/data/create/tags/block/non_breakable.json', {
  values: Object.keys(HARDNESS.tiers)
    .filter((tier) => Number(tier) > HARDNESS.machineMax)
    .map((tier) => `#${NAMESPACE}:hardness/${tier}`)
})
// Super enchanting in Create Enchantment Industry adds one level above the max: not above our caps.
out('pack/kubejs/data/create_enchantment_industry/data_maps/enchantment/super_enchanting/custom_level_extension.json', {
  values: Object.fromEntries([...Object.keys(RAISED), ns(HARDNESS.id), ns(TELEKINESIS.id)].map((id) => [id, 0]))
})
// Hardness V's prize: budding amethyst can be moved (with Silk Touch). Reinforced deepslate has no loot table
// to override, so server_scripts/enchanting.js drops it by hand.
out('pack/kubejs/data/minecraft/loot_table/blocks/budding_amethyst.json', {
  type: 'minecraft:block',
  random_sequence: 'minecraft:blocks/budding_amethyst',
  pools: [
    {
      rolls: 1,
      bonus_rolls: 0,
      conditions: [
        {
          condition: 'minecraft:match_tool',
          predicate: {
            predicates: {
              'minecraft:enchantments': [
                { enchantments: 'minecraft:silk_touch', levels: { min: 1 } },
                { enchantments: ns(HARDNESS.id), levels: { min: HARDNESS.maxLevel } }
              ]
            }
          }
        }
      ],
      entries: [{ type: 'minecraft:item', name: 'minecraft:budding_amethyst' }]
    }
  ]
})

// ---------------------------------------------------------------- Hardness tome recipes

{
  const lines = [
    '// GENERATED by enchanting/build.mjs from enchanting/enchanting.mjs. Hardness tomes: enchanted books, tier I at',
    '// the crafting table (nothing that needs iron), the rest by mechanical crafting; applied to a pickaxe in an',
    '// anvil (startup_scripts/enchanting.js checks the Mining level).',
    '',
    'ServerEvents.recipes((event) => {'
  ]
  for (const [tier, recipe] of Object.entries(HARDNESS.recipes)) {
    const result = `minecraft:enchanted_book[minecraft:stored_enchantments={levels:{"${ns(HARDNESS.id)}":${tier}}}]`
    const method = recipe.type === 'crafting' ? 'event.shaped' : 'event.recipes.create.mechanical_crafting'
    lines.push(`  ${method}(Item.of('${result}'), ${js(recipe.pattern)}, ${js(recipe.key)}).id('${NAMESPACE}:enchanting/hardness_tome_${tier}')`)
  }
  lines.push('})', '')
  out('pack/kubejs/server_scripts/enchanting_recipes.js', lines.join('\n'))
}

// ---------------------------------------------------------------- config for the scripts and tooltips

out('pack/config/lemursaucepacket/enchanting.json', {
  maxSkillLevel: MAX_SKILL_LEVEL,
  tableBoost: TABLE_BOOST,
  enchantXp: ENCHANT_XP,
  // id -> { vanilla, cap, unlocks: Enchanting level needed for vanilla+1, vanilla+2, ... cap; effect }
  enchantments: table,
  telekinesis: { id: ns(TELEKINESIS.id), name: TELEKINESIS.name, description: TELEKINESIS.description },
  hardness: {
    id: ns(HARDNESS.id),
    name: HARDNESS.name,
    description: HARDNESS.description,
    maxLevel: HARDNESS.maxLevel,
    unlock: HARDNESS.unlock,
    machineMax: HARDNESS.machineMax,
    tiers: HARDNESS.tiers,
    materials: HARDNESS.materials,
    tag: `${NAMESPACE}:hardness/`,
    useGate: { ...HARDNESS.useGate, containerItems: `${NAMESPACE}:hardness/container_items` }
  },
  penalty: PENALTY_EFFECTS
})

// ---------------------------------------------------------------- summary

const raised = Object.keys(RAISED).length
console.log(`enchanting: ${raised} enchantments raised (+${KEEP_AVAILABLE.length} kept available), ${Object.keys(HARDNESS.tiers).length} Hardness tiers, ${Object.keys(HARDNESS.recipes).length} tome recipes`)
for (const [id, t] of Object.entries(table)) {
  const costs = []
  for (let level = 1; level <= t.cap; level++) costs.push(t.minCost.base + t.minCost.per_level_above_first * (level - 1))
  console.log(`  ${id.padEnd(36)} ${t.vanilla} -> ${String(t.cap).padEnd(2)} unlocks at Enchanting ${t.unlocks.join('/').padEnd(22)} table power ${costs.join(' ')}`)
}

// ---------------------------------------------------------------- docs/enchanting.md

{
  const roman = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] ?? String(n)
  const pretty = (id) => id.split(':')[1].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const blockName = (id) => (id === '#c:ores/netherite_scrap' ? 'ancient debris' : id.startsWith('#c:ores/') ? id.slice(8).replace(/_/g, ' ') + ' ore' : id.split(':')[1].replace(/_/g, ' '))
  const lines = [
    '# Enchanting',
    '',
    'Enchanting is its own skill. The enchanting table trains it, and the skill decides how far every enchantment can go: most enchantments now reach level 10, one step at a time as your Enchanting level rises.',
    '',
    '## How it works',
    '',
    `- **Training it:** enchanting an item or a book at the table gives Enchanting XP (more for higher-level enchantments); so does using a book at the anvil.`,
    `- **Bigger tables:** the third slot of the table scales with your level, from the usual 30 up to ${30 * (1 + TABLE_BOOST)} at Enchanting ${MAX_SKILL_LEVEL}. Higher levels of an enchantment only appear once the table can reach their cost, and they cost more XP.`,
    '- **Past vanilla max:** the table rolls it, or two equal books or items combine at the anvil, as long as your Enchanting level allows the result. Chests, fishing and villagers only give vanilla levels.',
    '- **Above your level:** an item enchanted past what you have unlocked does no damage, breaks no blocks and slows you while worn. Level up, and it works.',
    '',
    '## Caps and unlocks',
    '',
    `Allowed level = vanilla max + a share of the extra levels that grows with your Enchanting level, so every enchantment reaches its cap at ${MAX_SKILL_LEVEL}.`,
    '',
    '| Enchantment | Vanilla | Cap | Unlocks at Enchanting | Effect per level |',
    '|---|---|---|---|---|'
  ]
  for (const [id, t] of Object.entries(table)) lines.push(`| ${pretty(id)} | ${roman(t.vanilla)} | ${roman(t.cap)} | ${t.unlocks.map((lvl, i) => `${roman(t.vanilla + i + 1)} at ${lvl}`).join(', ')} | ${t.effect ?? ''} |`)
  lines.push('', 'Single-level enchantments (Mending, Infinity, Silk Touch, Aqua Affinity, Flame, Channeling, Multishot, the curses) are unchanged, and so are the ones whose effect stops scaling.', '')
  lines.push('## Telekinesis', '', `**${TELEKINESIS.name}** (one level, on mining tools and weapons): ${TELEKINESIS.description} It rolls at the enchanting table and turns up in loot and villager trades like any other enchantment.`, '')
  lines.push('## Hardness: what your pickaxe can break', '', 'Some blocks need more than a pickaxe tier. A **Hardness** tome is applied to a pickaxe at the anvil, and each tier also needs a Mining level to work. The first tome is made at a crafting table (iron is behind it, and every Create machine needs iron); the rest need a Mechanical Crafter:', '', '| Tier | Mining | Breaks | Tome recipe |', '|---|---|---|---|')
  for (let tier = 1; tier <= 5; tier++) {
    const blocks = (HARDNESS.tiers[tier] ?? []).map(blockName).join(', ')
    const recipe = HARDNESS.recipes[tier] ? Object.values(HARDNESS.recipes[tier].key ?? {}).map((k) => (typeof k === 'string' ? k : k.item ?? k.tag ?? '')).map((k) => String(k).replace(/^#?[a-z_]+:/, '').replace(/_/g, ' ')).filter(Boolean).join(', ') : ''
    const method = HARDNESS.recipes[tier]?.type === 'crafting' ? 'crafting table' : 'mechanical crafting'
    lines.push(`| ${roman(tier)} | ${HARDNESS.unlock[tier]} | ${blocks || '—'} | ${recipe} (${method}) |`)
  }
  lines.push('', `Create drills, saws and rollers break blocks up to tier ${roman(HARDNESS.machineMax)}, deployers with a pickaxe too; obsidian, diamonds and beyond are yours to dig. Obsidian can still be cast in place with lava and water and ruined portals still work; what needs Hardness is obsidian as an item.`, '')
  lines.push(`**Found it before you can mine it?** Loot chests, witches and other players' chests hand these out early. You can carry them, keep them in a chest, barrel, shulker box or ender chest, place them if they are blocks, or drop them; recipes, machines, hoppers, backpacks and every other container refuse them until your Mining level reaches the tier (the tooltip says which level). Emeralds are money and never gated, ingots aren't either: only what comes out of the ground is, the raw ore, dust, gem or block.`, '')
  writeFileSync(path.join(root, 'docs', 'enchanting.md'), lines.join('\n') + '\n')
  console.log('enchanting: docs/enchanting.md')
}
