#!/usr/bin/env node
// Turns gear/gear.mjs into everything the pack needs for its gear. Run `node gear/build.mjs`; publish.mjs does.
//
// Writes:
//   pack/kubejs/startup_scripts/gear.js                 armour materials and items (KubeJS registries)
//   pack/kubejs/server_scripts/gear_recipes.js          recipes
//   pack/kubejs/server_scripts/gear_loot.js             loot-only items and the auto-smelt pickaxe (LootJS)
//   pack/kubejs/client_scripts/gear_client.js           the gear's SkyBlock tooltip data (tooltips.js draws it) and JEI info pages
//   pack/config/lemursaucepacket/gear.json              stats, set bonuses, perks and synergies for gear.js
//   pack/kubejs/data/lemursaucepacket_gear/pmmo/items/  Project MMO level gates
//   pack/config/fallingtree.json                        the Lumber Axe is the only tree-felling tool
//   docs/gear.md                                        the wiki page
// Item textures come from art/process.mjs (icon sheets and tinted armour layers), not from here.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CRIT_MULTIPLIER, LOOT, MATERIALS, MATERIAL_ITEMS, NAMESPACE, PIECES, RECIPES, SETS, TOOLS, WEAPONS } from './gear.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = (rel, text) => {
  const file = path.join(root, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}
const ns = (id) => (id.includes(':') ? id : `${NAMESPACE}:${id}`)
const SLOT_GROUP = { helmet: 'head', chestplate: 'chest', leggings: 'legs', boots: 'feet' }
const TIER_DAMAGE = { wood: 0, stone: 1, iron: 2, gold: 0, diamond: 3, netherite: 4 }
const SKILL_NAME = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// ---------------------------------------------------------------- the item list, flattened

/** Every armour piece: set pieces and single pieces, with material, slot, stats, perk, requirement. */
const armour = []
for (const set of SETS) {
  for (const [slot, piece] of Object.entries(set.pieces)) {
    armour.push({
      id: `${set.id}_${slot}`,
      name: piece.name,
      slot,
      material: set.material,
      stats: piece.stats ?? {},
      perk: piece.perk,
      perkText: piece.perkText,
      perkName: piece.perkName,
      perkDesc: piece.perkDesc,
      rarity: piece.rarity ?? set.rarity,
      requirement: set.requirement,
      set: set.id,
      howToGet: set.howToGet
    })
  }
}
for (const piece of PIECES) armour.push({ ...piece, stats: piece.stats ?? {}, perkText: piece.text })

// SkyBlock rarities (gear.mjs) and the vanilla rarity each item registers with, so the name keeps a matching
// colour where the pack's tooltip script doesn't reach (the held-item name above the hotbar, chat).
const RARITY_CODE = { COMMON: 'f', UNCOMMON: 'a', RARE: '9', EPIC: '5', LEGENDARY: '6', MYTHIC: 'd', SPECIAL: 'c' }
const VANILLA_RARITY = { COMMON: 'common', UNCOMMON: 'uncommon', RARE: 'rare', EPIC: 'epic', LEGENDARY: 'epic', MYTHIC: 'epic', SPECIAL: 'epic' }
const rarityOf = (item) => {
  const rarity = item.rarity ?? 'COMMON'
  if (!RARITY_CODE[rarity]) throw new Error(`gear: unknown rarity ${rarity} on ${item.id}`)
  return rarity
}

const allIds = [...armour.map((a) => a.id), ...WEAPONS.map((w) => w.id), ...TOOLS.map((t) => t.id), ...MATERIAL_ITEMS.map((m) => m.id)]

// ---------------------------------------------------------------- id validation

const registryPath = path.join(root, 'quests', '.registry.json')
if (existsSync(registryPath)) {
  const known = new Set(JSON.parse(readFileSync(registryPath, 'utf8')).item)
  const ours = new Set(allIds.map(ns))
  const check = (id, where) => {
    const clean = id.replace(/^\d+x\s*/, '')
    if (clean.startsWith('#') || ours.has(clean) || clean.startsWith('relics:')) return
    if (!known.has(clean)) console.warn(`gear: unknown item ${clean} (${where})`)
  }
  for (const r of RECIPES) {
    for (const v of Object.values(r.key ?? {})) check(v, `recipe ${r.result}`)
    for (const v of r.ingredients ?? []) check(v, `recipe ${r.result}`)
  }
  for (const m of Object.values(MATERIALS)) check(m.repair, `material ${m.name}`)
}

// ---------------------------------------------------------------- startup script: materials and items

function attributeModifier(type, id, amount, operation, slot) {
  return { type: `minecraft:${type}`, id: `${NAMESPACE}:${id}`, amount, operation, slot }
}

/** Attribute modifiers for an armour piece: the material's own values plus any extra stats. */
function armourModifiers(piece) {
  const material = MATERIALS[piece.material]
  const slot = SLOT_GROUP[piece.slot]
  const list = [
    attributeModifier('generic.armor', `armor_${piece.slot}`, material.defense[piece.slot], 'add_value', slot),
    attributeModifier('generic.armor_toughness', `toughness_${piece.slot}`, material.toughness, 'add_value', slot)
  ]
  if (material.knockbackResistance) list.push(attributeModifier('generic.knockback_resistance', `knockback_${piece.slot}`, material.knockbackResistance, 'add_value', slot))
  const s = piece.stats
  if (s.health) list.push(attributeModifier('generic.max_health', `health_${piece.slot}`, s.health, 'add_value', slot))
  if (s.luck) list.push(attributeModifier('generic.luck', `luck_${piece.slot}`, s.luck, 'add_value', slot))
  if (s.damage) list.push(attributeModifier('generic.attack_damage', `damage_${piece.slot}`, s.damage, 'add_value', slot))
  if (s.speed) list.push(attributeModifier('generic.movement_speed', `speed_${piece.slot}`, s.speed, 'add_multiplied_total', slot))
  return list
}

function weaponModifiers(weapon) {
  const list = [
    { type: 'minecraft:generic.attack_damage', id: 'minecraft:base_attack_damage', amount: weapon.damage - 1, operation: 'add_value', slot: 'mainhand' },
    { type: 'minecraft:generic.attack_speed', id: 'minecraft:base_attack_speed', amount: weapon.attackSpeed, operation: 'add_value', slot: 'mainhand' }
  ]
  if (weapon.stats?.knockback) list.push(attributeModifier('generic.attack_knockback', 'knockback', weapon.stats.knockback, 'add_value', 'mainhand'))
  return list
}

const js = (v) => JSON.stringify(v)

function startupScript() {
  const lines = [
    '// GENERATED by gear/build.mjs from gear/gear.mjs. Do not edit; edit gear.mjs.',
    '// Armour materials and every gear item. Textures: assets/lemursaucepacket/textures/item and models/armor.',
    '',
    '// Attribute modifiers must be a real ItemAttributeModifiers: the item builder stores a plain JS object as-is,',
    '// and the server then throws ClassCastException (and kicks the player) as soon as someone wearing the item ticks.',
    "// withTooltip(false) hides vanilla's \"When on Head:\" lines: the tooltip shows the same stats in the SkyBlock",
    '// layout instead (client_scripts/tooltips.js).',
    "const GearModifiers = Java.loadClass('net.minecraft.world.item.component.ItemAttributeModifiers')",
    "const GearModifier = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier')",
    "const GearOperation = Java.loadClass('net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation')",
    "const GearSlotGroup = Java.loadClass('net.minecraft.world.entity.EquipmentSlotGroup')",
    "const GearRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')",
    "const GearResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')",
    'function gearModifiers(list) {',
    '  let builder = GearModifiers.builder()',
    '  list.forEach((m) => {',
    '    let attribute = GearRegistries.ATTRIBUTE.get(GearResourceLocation.parse(m.type))',
    "    if (attribute == null) throw new Error('unknown attribute ' + m.type)",
    '    builder.add(',
    '      GearRegistries.ATTRIBUTE.wrapAsHolder(attribute),',
    '      new GearModifier(GearResourceLocation.parse(m.id), m.amount, GearOperation.valueOf(m.operation.toUpperCase())),',
    '      GearSlotGroup.valueOf(m.slot.toUpperCase())',
    '    )',
    '  })',
    '  return builder.build().withTooltip(false)',
    '}',
    '',
    "StartupEvents.registry('armor_material', (event) => {"
  ]
  for (const [id, m] of Object.entries(MATERIALS)) {
    lines.push(
      `  event.create('${NAMESPACE}:${id}')`,
      `    .defense(${js({ HELMET: m.defense.helmet, CHESTPLATE: m.defense.chestplate, LEGGINGS: m.defense.leggings, BOOTS: m.defense.boots })})`,
      `    .toughness(${m.toughness})`,
      `    .knockbackResistance(${m.knockbackResistance})`,
      `    .enchantmentValue(${m.enchantmentValue})`,
      `    .repairIngredient(() => Ingredient.of('${m.repair}'))`,
      `    .equipSound('minecraft:item.armor.equip_${m.base === 'leather' ? 'leather' : m.base === 'netherite' ? 'netherite' : m.base === 'diamond' ? 'diamond' : 'iron'}')`
    )
  }
  lines.push('})', '', "StartupEvents.registry('item', (event) => {")
  for (const m of MATERIAL_ITEMS) {
    lines.push(`  event.create('${NAMESPACE}:${m.id}').displayName(${js(m.name)})${m.fireResistant ? '.fireResistant()' : ''}.rarity('${VANILLA_RARITY[rarityOf(m)]}')`)
  }
  for (const piece of armour) {
    lines.push(
      `  event.create('${NAMESPACE}:${piece.id}', '${piece.slot}')`,
      `    .material('${NAMESPACE}:${piece.material}')`,
      `    .displayName(${js(piece.name)})`,
      `    .rarity('${VANILLA_RARITY[rarityOf(piece)]}')`,
      `    .component('minecraft:attribute_modifiers', gearModifiers(${js(armourModifiers(piece))}))${MATERIALS[piece.material].fireResistant ? '\n    .fireResistant()' : ''}`
    )
  }
  for (const w of WEAPONS) {
    lines.push(
      `  event.create('${NAMESPACE}:${w.id}', 'sword')`,
      `    .tier('${w.tier}')`,
      `    .displayName(${js(w.name)})`,
      `    .rarity('${VANILLA_RARITY[rarityOf(w)]}')`,
      `    .component('minecraft:attribute_modifiers', gearModifiers(${js(weaponModifiers(w))}))`
    )
  }
  for (const t of TOOLS) {
    if (t.type === 'basic') {
      lines.push(`  event.create('${NAMESPACE}:${t.id}').displayName(${js(t.name)}).rarity('${VANILLA_RARITY[rarityOf(t)]}').unstackable().maxDamage(${t.maxDamage ?? 256})`)
    } else {
      lines.push(`  event.create('${NAMESPACE}:${t.id}', '${t.type}').tier('${t.tier}').displayName(${js(t.name)}).rarity('${VANILLA_RARITY[rarityOf(t)]}')`)
    }
  }
  lines.push('})', '')
  return lines.join('\n')
}

// ---------------------------------------------------------------- server data: gear.json

function gearJson() {
  const items = {}
  const addStats = (id, stats, extra) => {
    items[ns(id)] = { ...(items[ns(id)] ?? {}), ...(stats ?? {}), ...(extra ?? {}) }
  }
  for (const piece of armour) addStats(piece.id, piece.stats, { slot: piece.slot, set: piece.set ?? null, perk: piece.perk ?? null })
  for (const w of WEAPONS) addStats(w.id, w.stats, { weapon: true, perk: w.perk ?? null })
  for (const t of TOOLS) addStats(t.id, {}, { tool: t.type, perk: t.perk ?? null })
  const sets = Object.fromEntries(
    SETS.map((s) => [
      s.id,
      {
        name: s.name,
        pieces: Object.keys(s.pieces).map((slot) => ns(`${s.id}_${slot}`)),
        bonus: { attributes: s.set.attributes ?? {}, effects: s.set.effects ?? [], perks: s.set.perks ?? [], stats: s.set.stats ?? {} },
        synergy: s.synergy ? { relic: s.synergy.relic, attributes: s.synergy.attributes ?? {}, effects: s.synergy.effects ?? [], stats: s.synergy.stats ?? {} } : null
      }
    ])
  )
  return { critMultiplier: CRIT_MULTIPLIER, items, sets }
}

// ---------------------------------------------------------------- recipes

function recipesScript() {
  const lines = ['// GENERATED by gear/build.mjs. Gear recipes: mostly Create mechanical crafting and compacting.', '', 'ServerEvents.recipes((event) => {']
  for (const r of RECIPES) {
    const result = ns(r.result)
    if (r.type === 'compacting') {
      lines.push(`  event.recipes.create.compacting('${result}', ${js(r.ingredients)})${r.heat === 'heated' ? '.heated()' : ''}.id('${NAMESPACE}:gear/${r.result}')`)
    } else if (r.type === 'mechanical_crafting') {
      lines.push(`  event.recipes.create.mechanical_crafting('${result}', ${js(r.pattern)}, ${js(r.key)}).id('${NAMESPACE}:gear/${r.result}')`)
    } else if (r.type === 'shaped') {
      lines.push(`  event.shaped('${result}', ${js(r.pattern)}, ${js(r.key)}).id('${NAMESPACE}:gear/${r.result}')`)
    } else if (r.type === 'smithing') {
      lines.push(`  event.smithing('${result}', 'minecraft:netherite_upgrade_smithing_template', '${ns(r.base)}', '${ns(r.addition)}').id('${NAMESPACE}:gear/${r.result}')`)
    }
  }
  lines.push('})', '')
  return lines.join('\n')
}

// ---------------------------------------------------------------- loot

const SMELT = [
  ['minecraft:raw_iron', 'minecraft:iron_ingot'],
  ['minecraft:raw_copper', 'minecraft:copper_ingot'],
  ['minecraft:raw_gold', 'minecraft:gold_ingot'],
  ['create:raw_zinc', 'create:zinc_ingot'],
  ['minecraft:ancient_debris', 'minecraft:netherite_scrap']
]

function lootScript() {
  const lines = ['// GENERATED by gear/build.mjs. Loot-only gear in chests, and the Prospector\'s Pickaxe smelting what it mines.', '', 'LootJS.modifiers((event) => {']
  for (const l of LOOT) {
    for (const table of l.tables) {
      const target = table.startsWith('#') ? `/^${table.slice(1)}:chests\\/.*/` : `'${table}'`
      const count = l.count ? `Item.of('${ns(l.item)}', ${l.count[0]})` : `'${ns(l.item)}'`
      lines.push(`  event.addTableModifier(${target}).randomChance(${l.chance}).addLoot(${count})`)
    }
  }
  lines.push(`  event.addBlockModifier(['#c:ores', 'minecraft:ancient_debris']).matchMainHand('${NAMESPACE}:prospectors_pickaxe')`)
  for (const [from, to] of SMELT) lines.push(`    .replaceLoot('${from}', '${to}')`)
  lines.push('})', '')
  return lines.join('\n')
}

// ---------------------------------------------------------------- client: tooltips and JEI

const STAT_LINES = (stats) => {
  const lines = []
  if (stats.critChance) lines.push(`&c☣ Crit Chance +${Math.round(stats.critChance * 100)}%`)
  if (stats.critDamage) lines.push(`&c☠ Crit Damage +${Math.round(stats.critDamage * 100)}%`)
  if (stats.knockback) lines.push(`&6➶ Knockback +${stats.knockback}`)
  if (stats.luck) lines.push(`&a✦ Luck +${stats.luck}`)
  if (stats.health) lines.push(`&d❤ Health +${stats.health / 2} hearts`)
  if (stats.speed) lines.push(`&b➶ Speed +${Math.round(stats.speed * 100)}%`)
  return lines
}

// SkyBlock wraps descriptions at roughly this many characters.
const TOOLTIP_WIDTH = 38
const TOOL_TYPE = { axe: 'AXE', pickaxe: 'PICKAXE', shovel: 'SHOVEL', hoe: 'HOE', sword: 'SWORD' }

/** Greedy word wrap; every line starts with the colour code. */
function wrap(code, text, width = TOOLTIP_WIDTH) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines.map((l) => `§${code}${l}`)
}
const sentence = (text) => {
  const t = text.trim()
  const s = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(s) ? s : `${s}.`
}
// JS source with § written as §, so the generated file stays ASCII.
const jsText = (v) => js(v).replace(/§/g, '\\u00a7')

/**
 * Tooltip data for every gear item. client_scripts/tooltips.js draws every tooltip in SkyBlock's layout and
 * asks gearTipSpec() (below, generated too) for these: the rarity, the type word on the last line, the stats
 * that aren't attribute modifiers (crit; damage, defense and the rest come from the item itself), the
 * Piece Bonus / Ability / lore sections, the set, "How to get" and the skill requirement.
 */
function clientScript() {
  const tips = {}
  const sets = {}
  const info = []
  const extraStats = (stats = {}) => {
    const out = {}
    if (stats.critChance) out.critChance = stats.critChance
    if (stats.critDamage) out.critDamage = stats.critDamage
    return out
  }
  const perkSection = (item, header) => {
    if (!item.perkName) return null
    const trigger = item.perkTrigger ? ` §e§l${item.perkTrigger}` : ''
    return [`§6${header}: ${item.perkName}${trigger}`, ...wrap('7', sentence(item.perkDesc ?? item.perkText ?? item.text))]
  }
  const loreSection = (item) => (item.lore && !item.perkName ? wrap('7', sentence(item.lore)) : null)
  const add = (item, type, stats, sections, set) => {
    const req = item.requirement
    tips[ns(item.id)] = {
      rarity: rarityOf(item),
      type,
      stats: extraStats(stats),
      sections: sections.filter(Boolean),
      ...(set ? { set } : {}),
      how: wrap('8', `How to get: ${item.howToGet}`),
      ...(req ? { req: [req.skill, req.level] } : {})
    }
    info.push({ id: ns(item.id), text: [`${item.name}.`, item.howToGet, req ? `Needs ${SKILL_NAME(req.skill)} ${req.level}.` : ''].filter(Boolean).join(' ') })
  }
  for (const piece of armour) add(piece, piece.slot.toUpperCase(), piece.stats, [perkSection(piece, 'Piece Bonus'), loreSection(piece)], piece.set)
  for (const w of WEAPONS) add(w, 'SWORD', w.stats, [perkSection(w, 'Ability'), loreSection(w)])
  for (const t of TOOLS) add(t, TOOL_TYPE[t.type] ?? t.kind ?? '', {}, [perkSection(t, 'Ability'), loreSection(t)])
  for (const m of MATERIAL_ITEMS) add(m, '', {}, [])
  for (const set of SETS) {
    sets[set.id] = {
      name: set.name,
      pieces: Object.keys(set.pieces).map((slot) => ns(`${set.id}_${slot}`)),
      bonus: wrap('7', sentence(set.set.text)),
      ...(set.synergy ? { relic: set.synergy.relic, synergy: wrap('7', `With the full set and this relic equipped: ${sentence(set.synergy.text)}`) } : {})
    }
  }
  // The "how to get" text is also JEI's information page for the item. KubeJS 7 calls the JEI hook
  // RecipeViewerEvents.addInformation; JEIEvents.information was the KubeJS 6 name.
  return [
    '// GENERATED by gear/build.mjs from gear/gear.mjs. Do not edit; edit gear.mjs.',
    "// The gear's part of the SkyBlock-style tooltips (client_scripts/tooltips.js draws them): each item's rarity,",
    '// the type on the last line, the stats that are not attribute modifiers (crit chance and damage; damage,',
    '// defense and the rest come from the item itself), the Piece Bonus / Ability / lore sections, its set,',
    '// "How to get" and the skill requirement tooltips.js falls back on. Plus the JEI information pages.',
    '',
    `const GEAR_TIPS = ${jsText(tips)}`,
    `const GEAR_SETS = ${jsText(sets)}`,
    `const GEAR_INFO = ${jsText(Object.fromEntries(info.map((i) => [i.id, i.text])))}`,
    'let GearTipCurios = null',
    'try {',
    "  GearTipCurios = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')",
    '} catch (e) {}',
    '',
    '/** How many of the pieces the player wears. */',
    'function gearTipWorn(player, pieces) {',
    '  let worn = 0',
    "  ;['head', 'chest', 'legs', 'feet'].forEach((slot) => {",
    '    if (pieces.indexOf(String(player.getItemBySlot(slot).id)) >= 0) worn++',
    '  })',
    '  return worn',
    '}',
    '',
    '/** Whether the player has a Relics item in a Curios slot (the set synergies). */',
    'function gearTipHasRelic(player, relic) {',
    '  if (GearTipCurios == null) return false',
    '  try {',
    '    let inventory = GearTipCurios.getCuriosInventory(player).orElse(null)',
    '    if (inventory == null) return false',
    '    let handler = inventory.getEquippedCurios()',
    '    for (let i = 0; i < handler.getSlots(); i++) {',
    '      if (String(handler.getStackInSlot(i).id) === relic) return true',
    '    }',
    '  } catch (e) {}',
    '  return false',
    '}',
    '',
    '/**',
    " * The SkyBlock layout for one of the pack's items, for tooltips.js: rarity, type, extra stats, the sections",
    ' * (Piece Bonus / Ability / lore, then the Full Set Bonus with the pieces worn), and the Shift details. Shift',
    ' * adds the set bonus itself, the relic synergy and "How to get".',
    ' */',
    'function gearTipSpec(id, player, shift) {',
    '  let tip = GEAR_TIPS[id]',
    '  let sections = tip.sections.slice()',
    '  let set = tip.set ? GEAR_SETS[tip.set] : null',
    '  if (set != null) {',
    '    let worn = player != null ? gearTipWorn(player, set.pieces) : -1',
    "    let count = worn < 0 ? '' : (worn === set.pieces.length ? ' \\u00a7a(' : ' \\u00a78(') + worn + '/' + set.pieces.length + ')'",
    "    let bonus = ['\\u00a76Full Set Bonus: ' + set.name + count]",
    '    if (shift) set.bonus.forEach((line) => bonus.push(line))',
    '    sections.push(bonus)',
    '    if (shift && set.relic) {',
    '      let equipped = player != null && gearTipHasRelic(player, set.relic)',
    "      let header = Text.literal('\\u00a76Relic Synergy: ')",
    "      header.append(Text.translatable('item.' + set.relic.replace(':', '.')).gold())",
    "      header.append(Text.literal(equipped ? ' \\u00a7a(equipped)' : ' \\u00a78(not equipped)'))",
    '      let synergy = [header]',
    '      set.synergy.forEach((line) => synergy.push(line))',
    '      sections.push(synergy)',
    '    }',
    '  }',
    '  return { rarity: tip.rarity, type: tip.type, stats: tip.stats, sections: sections, details: tip.how, more: set != null, req: tip.req || null }',
    '}',
    '',
    'const gearInformation = (event) => {',
    '  Object.keys(GEAR_INFO).forEach((id) => {',
    '    try {',
    '      event.add(id, [GEAR_INFO[id]])',
    '    } catch (e) {',
    "      console.error('[LemurSaucePacket] JEI info for ' + id + ': ' + e)",
    '    }',
    '  })',
    '}',
    "if (typeof RecipeViewerEvents !== 'undefined') RecipeViewerEvents.addInformation('item', gearInformation)",
    "else if (typeof JEIEvents !== 'undefined') JEIEvents.information(gearInformation)",
    ''
  ].join('\n')
}

// ---------------------------------------------------------------- Project MMO gates

// One file per item. Project MMO reads a file under data/<ns>/pmmo/items/<name>.json as the item <ns>:<name>, so
// each file names the real item with isTagFor (the data namespace here is lemursaucepacket_gear).
function pmmoFilesById() {
  const dir = 'pack/kubejs/data/lemursaucepacket_gear/pmmo/items'
  rmSync(path.join(root, dir), { recursive: true, force: true })
  const rules = {}
  const add = (id, kind, req) => {
    rules[id] = rules[id] ?? {}
    rules[id][kind] = { [req.skill]: req.level }
  }
  for (const piece of armour) add(piece.id, 'WEAR', piece.requirement)
  for (const w of WEAPONS) add(w.id, 'WEAPON', w.requirement)
  for (const t of TOOLS) {
    add(t.id, 'TOOL', t.requirement)
    add(t.id, 'USE', t.requirement)
  }
  for (const [id, requirements] of Object.entries(rules)) out(`${dir}/${id}.json`, JSON.stringify({ isTagFor: [`${NAMESPACE}:${id}`], requirements }, null, 2))
  return Object.keys(rules).length
}

// ---------------------------------------------------------------- FallingTree

function fallingTreeConfig() {
  return JSON.stringify(
    {
      sneakMode: 'SNEAK_DISABLE',
      breakInCreative: true,
      lootInCreative: true,
      notificationMode: 'ACTION_BAR',
      trees: {
        breakMode: 'INSTANTANEOUS',
        detectionMode: 'WHOLE_TREE',
        maxScanSize: 800,
        minSize: 1,
        maxSize: 200,
        maxSizeAction: 'ABORT',
        breakOrder: 'FURTHEST_FIRST',
        treeBreaking: true,
        leavesBreaking: true,
        leavesBreakingForceRadius: 0,
        allowMixedLogs: false,
        breakNetherTreeWarts: true,
        breakMangroveRoots: true,
        searchAreaRadius: -1,
        spawnItemsAtBreakPoint: true,
        trunkLootPercentage: 100
      },
      tools: {
        allowed: [`${NAMESPACE}:lumber_axe`],
        denied: [],
        durabilityMode: 'PERCENTAGE',
        ignoreTools: false,
        damageMultiplicand: 0.25,
        damageRounding: 'ROUND',
        speedMultiplicand: 0,
        // true would let logs be broken ONLY with the allowed tools: no fists, no ordinary axes. The allowed list
        // alone is what keeps whole-tree felling to the Lumber Axe.
        forceToolUsage: false
      },
      player: { allowedTags: [] },
      enchantment: { registerEnchant: false, registerSpecificEnchant: false, hideEnchant: true, requireEnchantment: false }
    },
    null,
    2
  )
}

// ---------------------------------------------------------------- docs

function docsPage() {
  const req = (r) => `${SKILL_NAME(r.skill)} ${r.level}`
  const statText = (stats) =>
    STAT_LINES(stats ?? {})
      .map((l) => l.replace(/&[0-9a-fk-or]/g, ''))
      .join(', ')
  const lines = [
    '# Gear',
    '',
    'The pack\'s own tools, weapons and armour, made with Create and gated by [skills](skills.md). Every piece shows its stats and a "How to get" line in its tooltip, and JEI has the same "how to get" text on the item\'s information page (the `i` tab next to its recipes; press R on any item).',
    '',
    'Stats: **Damage**, **Attack Speed**, **Crit Chance** (added to the Strength/Ranged crit roll), **Crit Damage** (added to the 1.5× critical multiplier), **Defense**, **Toughness**, **Health**, **Speed**, **Luck**. Perks are named effects a piece has on its own; a **full set** bonus needs all four pieces; a **synergy** is a Relics item that makes a full set stronger.',
    '',
    '## Armour sets',
    ''
  ]
  for (const set of SETS) {
    const m = MATERIALS[set.material]
    lines.push(`### ${set.name}`, '', set.theme, '', `Wear: ${req(set.requirement)}. Defense ${m.defense.helmet}/${m.defense.chestplate}/${m.defense.leggings}/${m.defense.boots}, toughness ${m.toughness}${m.knockbackResistance ? `, knockback resistance ${m.knockbackResistance}` : ''}.`, '')
    lines.push('| Piece | Stats and perk |', '|---|---|')
    for (const piece of Object.values(set.pieces)) lines.push(`| ${piece.name} | ${[statText(piece.stats), piece.perkText].filter(Boolean).join('; ') || '—'} |`)
    lines.push('', `**Full set:** ${set.set.text}.${set.synergy ? ` **With the ${set.synergy.relic.split(':')[1].replace(/_/g, ' ')}:** ${set.synergy.text}.` : ''}`, '', `**How to get:** ${set.howToGet}`, '')
  }
  lines.push('## Single pieces', '', '| Piece | Slot | Stats and perk | Wear | How to get |', '|---|---|---|---|---|')
  for (const p of PIECES) lines.push(`| ${p.name} | ${p.slot} | ${[statText(p.stats), p.text].filter(Boolean).join('; ')} | ${req(p.requirement)} | ${p.howToGet} |`)
  lines.push('', '## Weapons', '', '| Weapon | Damage | Attack speed | Extra | Wield | How to get |', '|---|---|---|---|---|---|')
  for (const w of WEAPONS) lines.push(`| ${w.name} | ${w.damage} | ${(4 + w.attackSpeed).toFixed(1)} | ${[statText(w.stats), w.text].filter(Boolean).join('; ')} | ${req(w.requirement)} | ${w.howToGet} |`)
  lines.push('', '## Tools', '', '| Tool | Does | Use | How to get |', '|---|---|---|---|')
  for (const t of TOOLS) lines.push(`| ${t.name} | ${t.text} | ${req(t.requirement)} | ${t.howToGet} |`)
  lines.push('', '## Materials', '', '| Material | How to get |', '|---|---|')
  for (const m of MATERIAL_ITEMS) lines.push(`| ${m.name} | ${m.howToGet} |`)
  lines.push('', '## Loot-only gear', '', 'Some pieces never have a recipe:', '')
  for (const l of LOOT) lines.push(`- **${[...armour, ...WEAPONS, ...MATERIAL_ITEMS].find((x) => x.id === l.item)?.name}**: ${Math.round(l.chance * 100)}% per chest in ${l.tables.map((t) => (t.startsWith('#') ? `${t.slice(1)} structures` : t.split('/').pop().replace(/_/g, ' '))).join(', ')}.`)
  lines.push('', 'Generated from `gear/gear.mjs`, so this page matches the game.', '')
  return lines.join('\n')
}

// ---------------------------------------------------------------- write everything

out('pack/kubejs/startup_scripts/gear.js', startupScript())
out('pack/config/lemursaucepacket/gear.json', JSON.stringify(gearJson()))
out('pack/kubejs/server_scripts/gear_recipes.js', recipesScript())
out('pack/kubejs/server_scripts/gear_loot.js', lootScript())
out('pack/kubejs/client_scripts/gear_client.js', clientScript())
const gates = pmmoFilesById()
out('pack/config/fallingtree.json', fallingTreeConfig())
out('docs/gear.md', docsPage())
console.log(`gear: ${armour.length} armour pieces, ${WEAPONS.length} weapons, ${TOOLS.length} tools, ${MATERIAL_ITEMS.length} materials; ${RECIPES.length} recipes, ${gates} level gates, ${LOOT.length} loot entries; docs/gear.md`)
