#!/usr/bin/env node
// "Where to find it": JEI shows every recipe, but a loot-only item (found in chests, dropped by a mob, fished up,
// brushed out of suspicious sand) has no page. This scans every client mod jar, the vanilla jar and the pack's own
// datapack for loot tables, recipes and NeoForge loot modifiers, works out which modded items have no recipe, and
// writes
//   pack/kubejs/client_scripts/jei_sources.js   JEI info tab for those items ("Found in: …", "Dropped by: …")
//   docs/where-to-find.md                        the wiki page, one table per mod, Relics first
//
//   node publish/sources.mjs [--mods=DIR] [--vanilla=JAR] [--legacy] [--verbose]
//
// Inputs: the client mods folder (every jar, plus the jars nested in META-INF/jarjar), the 1.21.1 client jar and
// pack/kubejs/data. Set LSP_MODS_DIR / LSP_VANILLA_JAR or the flags when they are not in the default spots below.
// The pack's KubeJS scripts are read too (cheaply, by regex): recipes added with event.shaped(...) count as
// recipes, LootJS addTableModifier(...).addLoot(...) counts as a chest source, and .displayName("…") names items.
//
// Legacy 1.20 folders (data/*/loot_tables, data/*/recipes) are ignored unless --legacy is given: 1.21 renamed them
// to loot_table / recipe and never loads the old ones, and the jars that still ship them (create_ltab, Variants &
// Ventures, Farmer's Delight) are multi-version jars whose 1.21 folders are the live copies.
//
// Relics: its relics reach chests through a code-based global loot modifier (relics:relic_loot), so nothing about
// them is in JSON. RELIC_CATEGORIES and RELICS below were recovered from relics-1.21.1-0.12.8.jar with javap: the
// static initialiser of it.hurts.sskirillss.relics.items.relics.base.data.loot.misc.LootEntries holds the
// dimension / biome / loot-table regexes of every category, and each relic class's constant pool names the
// LootEntries fields it uses. None of the twenty are inferred. relics:aqua_walker is not in 0.12.8 (no class,
// model or lang key), so it has no entry.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a) => (a.startsWith('--') ? a.slice(2).split(/=(.*)/s) : [a, true])).map(([k, v]) => [k, v === undefined ? true : v]))
const INCLUDE_LEGACY = Boolean(args.legacy)
const VERBOSE = Boolean(args.verbose)

const scratch = 'C:/Users/Shawn/AppData/Local/Temp/claude/C--Create-Modpack/ab1859ba-46fb-401e-9816-544fdbbd5524/scratchpad/headless'
const modsDir = firstExisting([args.mods, process.env.LSP_MODS_DIR, path.join(scratch, 'instance/mods'), path.join(root, 'server/mods')])
const vanillaJar = firstExisting([
  args.vanilla,
  process.env.LSP_VANILLA_JAR,
  path.join(scratch, 'minecraft/versions/1.21.1/1.21.1.jar'),
  path.join(os.homedir(), 'AppData/Roaming/.minecraft/versions/1.21.1/1.21.1.jar')
])
if (!modsDir || !vanillaJar) {
  console.error(`sources: need the client mods folder (${modsDir ?? 'missing'}) and the 1.21.1 client jar (${vanillaJar ?? 'missing'}); pass --mods= and --vanilla=`)
  process.exit(1)
}

function firstExisting(candidates) {
  return candidates.find((c) => typeof c === 'string' && c && existsSync(c))
}

// ---------------------------------------------------------------------------------------------------------------
// Scan

const dec = new TextDecoder()
const mods = new Map() // modId -> displayName, from every jar's neoforge.mods.toml (nested jars too)
const jarPrimary = new Map() // jar label -> displayName of its first [[mods]] entry
const nsOwner = new Map() // data/assets namespace -> jar label that ships it (names tables of namespaces that are not mod ids)
const lang = new Map() // en_us keys, all jars merged
const knownItems = new Set() // ids with an item model, an item/block lang key or a recipe result: the item exists on the client
const tables = new Map() // loot table id -> { id, ns, path, kind, items, refs, labels, vanilla, referenced, injected }
const recipeResults = new Set()
const modifiers = [] // NeoForge global loot modifiers with something we can read
const injectedIds = new Set() // loot tables that only exist to be injected into another one by a modifier
let jarCount = 0

const ENTRY_RE = /^(data\/[^/]+\/(loot_tables?|recipes?|loot_modifiers)\/.*\.json|assets\/[^/]+\/lang\/en_us\.json|META-INF\/neoforge\.mods\.toml|META-INF\/jarjar\/[^/]+\.jar)$/
const MODEL_RE = /^assets\/([^/]+)\/models\/item\/([^/]+)\.json$/

function scanZip(buf, label, depth, isVanilla) {
  let files
  try {
    files = unzipSync(buf, {
      filter: (f) => {
        const m = MODEL_RE.exec(f.name)
        if (m) knownItems.add(`${m[1]}:${m[2]}`) // record the name, don't inflate the file
        return ENTRY_RE.test(f.name) && (depth === 0 || !f.name.endsWith('.jar'))
      }
    })
  } catch (e) {
    console.warn(`sources: cannot read ${label}: ${e.message}`)
    return
  }
  jarCount++
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith('.jar')) {
      scanZip(data, `${label}>${path.basename(name)}`, depth + 1, false)
      continue
    }
    if (name === 'META-INF/neoforge.mods.toml') {
      readModsToml(dec.decode(data), label)
      continue
    }
    const langMatch = /^assets\/([^/]+)\/lang\/en_us\.json$/.exec(name)
    if (langMatch) {
      noteOwner(langMatch[1], label)
      readLang(data, label)
      continue
    }
    readDataFile(name, data, label, isVanilla)
  }
}

const tomlString = (text, key) => {
  const m = new RegExp(`${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(text)
  return m ? (m[1] ?? m[2]) : undefined
}

function readModsToml(text, label) {
  const blocks = [...text.matchAll(/\[\[mods\]\]([\s\S]*?)(?=\[\[|\n\[|$)/g)].map((m) => m[1])
  const inline = /mods\s*=\s*\[\s*\{([^}]*)\}/.exec(text) // mods = [ { modId = 'x', displayName = 'Y' } ]
  if (blocks.length === 0 && inline) blocks.push(inline[1])
  for (const block of blocks) {
    const id = tomlString(block, 'modId')
    const name = tomlString(block, 'displayName')
    if (!id) continue
    if (!mods.has(id) || name) mods.set(id, name ?? mods.get(id) ?? id)
    if (!jarPrimary.has(label)) jarPrimary.set(label, name ?? id)
  }
}

function noteOwner(ns, label) {
  if (!nsOwner.has(ns)) nsOwner.set(ns, label)
}

function readLang(data, label) {
  let json
  try {
    json = JSON.parse(dec.decode(data))
  } catch {
    return
  }
  for (const [k, v] of Object.entries(json)) {
    if (typeof v !== 'string') continue
    if (!lang.has(k) || label === 'vanilla') lang.set(k, v)
    const m = /^(item|block)\.([^.]+)\.(.+)$/.exec(k)
    if (m) knownItems.add(`${m[2]}:${m[3]}`)
  }
}

function readDataFile(name, data, label, isVanilla) {
  const m = /^data\/([^/]+)\/(loot_tables?|recipes?|loot_modifiers)\/(.*)\.json$/.exec(name)
  if (!m) return
  const [, ns, folder, rest] = m
  const legacy = folder === 'loot_tables' || folder === 'recipes'
  if (legacy && !INCLUDE_LEGACY) return
  noteOwner(ns, label)
  let json
  try {
    json = JSON.parse(dec.decode(data))
  } catch {
    return
  }
  if (folder.startsWith('loot_table')) readLootTable(`${ns}:${rest}`, ns, rest, json, label, isVanilla)
  else if (folder.startsWith('recipe')) collectResults(json, recipeResults)
  else readModifier(json, label)
}

function readLootTable(id, ns, tablePath, json, label, isVanilla) {
  let t = tables.get(id)
  if (!t) {
    t = { id, ns, path: tablePath, kind: kindOf(tablePath), items: new Set(), refs: new Set(), labels: new Set(), vanilla: false, referenced: false, injected: false }
    tables.set(id, t)
  }
  t.labels.add(label)
  if (isVanilla) t.vanilla = true
  collectPools(json?.pools, t)
}

function collectPools(pools, t) {
  if (!Array.isArray(pools)) return
  for (const pool of pools) collectEntries(pool?.entries, t)
}

function collectEntries(entries, t) {
  if (!Array.isArray(entries)) return
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue
    const type = String(e.type ?? '').replace(/^minecraft:/, '')
    if (type === 'item' && typeof e.name === 'string') t.items.add(normId(e.name))
    else if (type === 'loot_table') {
      const v = e.value ?? e.name
      if (typeof v === 'string') t.refs.add(normId(v))
      else if (v && typeof v === 'object') collectPools(v.pools, t)
    } else if (type === 'alternatives' || type === 'group' || type === 'sequence') collectEntries(e.children, t)
  }
}

function normId(id) {
  return id.includes(':') ? id : `minecraft:${id}`
}

// Recipe results, whatever the recipe type: result / results / output as a string, {id}, {item}, {item:{id}} or
// arrays of those (vanilla, Create results[], Farmer's Delight cutting result[], smithing, neoforge:conditional).
function collectResults(json, out) {
  if (!json || typeof json !== 'object') return
  if (json.type === 'neoforge:conditional' || json.type === 'forge:conditional') {
    if (Array.isArray(json.recipes)) for (const r of json.recipes) collectResults(r?.recipe ?? r, out)
    if (json.recipe) collectResults(json.recipe, out)
    return
  }
  for (const key of ['result', 'results', 'output', 'outputs']) if (key in json) walkResult(json[key], out)
}

function walkResult(v, out) {
  if (typeof v === 'string') {
    if (/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(v)) out.add(v)
    return
  }
  if (Array.isArray(v)) {
    for (const x of v) walkResult(x, out)
    return
  }
  if (v && typeof v === 'object') {
    for (const key of ['id', 'item']) {
      if (typeof v[key] === 'string') walkResult(v[key], out)
      else if (v[key] && typeof v[key] === 'object') walkResult(v[key], out)
    }
  }
}

// A loot modifier is useful when it says which loot table (neoforge:loot_table_id) or which mob (entity_properties)
// it applies to, and what it adds: a table (table / loot_table, e.g. farmersdelight:add_loot_table,
// sophisticatedbackpacks:inject_loot, neoforge:add_table) or items (item / added_item, farmersdelight:add_item).
function readModifier(json, label) {
  if (!json || typeof json !== 'object' || !json.type) return
  const targets = new Set()
  const entities = new Set()
  walkConditions(json.conditions, targets, entities)
  const injected = ['table', 'loot_table', 'lootTable'].map((k) => json[k]).filter((v) => typeof v === 'string').map(normId)
  const items = new Set()
  for (const key of ['item', 'added_item', 'items']) if (key in json) walkResult(json[key], items)
  for (const t of injected) injectedIds.add(t)
  if ((targets.size === 0 && entities.size === 0) || (injected.length === 0 && items.size === 0)) return
  modifiers.push({ label, type: json.type, targets: [...targets], entities: [...entities], injected, items: [...items] })
}

function walkConditions(node, targets, entities) {
  if (Array.isArray(node)) {
    for (const n of node) walkConditions(n, targets, entities)
    return
  }
  if (!node || typeof node !== 'object') return
  const cond = String(node.condition ?? '')
  if (cond === 'neoforge:loot_table_id') {
    for (const id of [].concat(node.loot_table_id ?? [])) if (typeof id === 'string') targets.add(normId(id))
  } else if (cond === 'minecraft:entity_properties' && (node.entity ?? 'this') === 'this') {
    const type = node.predicate?.type
    if (typeof type === 'string' && !type.startsWith('#')) entities.add(normId(type))
  }
  for (const key of ['terms', 'term', 'value']) if (key in node) walkConditions(node[key], targets, entities)
}

// Loot table kinds by folder. Unknown folders (structory:outcast/…, terralith:village/…, create_ltab:core/…) are
// structure loot referenced from structure NBT, so they count as chests unless another table references them.
const AUX_RE = /^(equipment|dispensers?|spawner_projectile|keys|maps|special_items)\//
function kindOf(p) {
  if (/^blocks?\//.test(p)) return 'block'
  if (/(^|\/)(entities|entity|mobs?)\//.test(p)) return 'entity'
  if (/(^|\/)fishing(\/|$)/.test(p)) return 'fishing'
  if (/(^|\/)(archaeology|archeology|archaelogy)\//.test(p)) return 'archaeology'
  if (/^(gameplay|rewards?)\//.test(p)) return 'gameplay'
  if (/^shearing\//.test(p)) return 'shearing'
  if (/^pots?\//.test(p)) return 'pot'
  if (/^spawners?\//.test(p)) return 'spawner'
  if (AUX_RE.test(p)) return 'aux'
  if (/(^|\/)(chests?|barrels?)\//.test(p)) return 'chest'
  return 'loot'
}

function walkDir(dir, visit) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walkDir(full, visit)
    else visit(full)
  }
}

const t0 = Date.now()
for (const f of readdirSync(modsDir).sort()) if (f.endsWith('.jar')) scanZip(new Uint8Array(readFileSync(path.join(modsDir, f))), f, 0, false)
scanZip(new Uint8Array(readFileSync(vanillaJar)), 'vanilla', 0, true)
const packData = path.join(root, 'pack/kubejs/data')
walkDir(packData, (file) => {
  const rel = 'data/' + path.relative(packData, file).split(path.sep).join('/')
  if (rel.endsWith('.json')) readDataFile(rel, readFileSync(file), 'pack', false)
})

// The pack's KubeJS scripts: recipe results, LootJS chest additions and display names, by regex (enough for the
// generated gear_recipes.js / gear_loot.js / gear.js and the hand-written ones; template-literal ids are skipped).
const ID = "['\"]([a-z0-9_.-]+:[a-z0-9_./-]+)['\"]"
const kubeLoot = [] // { target: string | RegExp, entity: bool, items: [] }
const kubeNames = new Map()
for (const dir of ['server_scripts', 'startup_scripts']) {
  walkDir(path.join(root, 'pack/kubejs', dir), (file) => {
    if (!file.endsWith('.js')) return
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(new RegExp(`\\bevent\\.(?:shaped|shapeless|smithing|smelting|blasting|smoking|campfireCooking|stonecutting)\\(\\s*${ID}`, 'g'))) recipeResults.add(m[1])
    for (const m of text.matchAll(new RegExp(`\\bevent\\.recipes\\.[a-z0-9_]+\\.[a-z0-9_]+\\(\\s*${ID}`, 'g'))) recipeResults.add(m[1])
    for (const m of text.matchAll(new RegExp(`\\bresult:\\s*(?:\\{\\s*id:\\s*)?${ID}`, 'g'))) recipeResults.add(m[1])
    for (const chunk of text.split(/(?=\bevent\.create\()/)) {
      const id = new RegExp(`^event\\.create\\(\\s*${ID}`).exec(chunk)?.[1]
      const name = /\.displayName\(\s*(?:"([^"]*)"|'([^']*)')\s*\)/.exec(chunk)
      if (id && name) kubeNames.set(id, name[1] ?? name[2])
    }
    for (const line of text.split('\n')) {
      if (!/add(Table|Entity)Modifier\(/.test(line)) continue
      const items = [...line.matchAll(new RegExp(`\\.addLoot\\(\\s*(?:Item\\.of\\(\\s*)?${ID}`, 'g'))].map((m) => m[1])
      if (items.length === 0) continue
      for (const m of line.matchAll(new RegExp(`\\.add(Table|Entity)Modifier\\(\\s*(?:${ID}|\\/((?:\\\\\\/|[^/])+)\\/([a-z]*))`, 'g'))) {
        const entity = m[1] === 'Entity'
        const target = m[2] ? normId(m[2]) : new RegExp(m[3], m[4])
        kubeLoot.push({ target, entity, items })
      }
    }
  })
}
for (const [id, name] of kubeNames) {
  knownItems.add(id)
  if (!lang.has(`item.${id.replace(':', '.')}`)) lang.set(`item.${id.replace(':', '.')}`, name)
}

// ---------------------------------------------------------------------------------------------------------------
// Resolve: a table's items include the tables it references (a few levels); injected and referenced tables are
// not sources of their own.

for (const t of tables.values()) {
  if (injectedIds.has(t.id)) t.injected = true
  for (const ref of t.refs) if (tables.has(ref)) tables.get(ref).referenced = true
}
const resolvedCache = new Map()
function resolvedItems(id, depth = 0, seen = new Set()) {
  if (resolvedCache.has(id)) return resolvedCache.get(id)
  const t = tables.get(id)
  const out = new Set()
  if (!t || seen.has(id) || depth > 4) return out
  seen.add(id)
  for (const i of t.items) out.add(i)
  for (const ref of t.refs) for (const i of resolvedItems(ref, depth + 1, seen)) out.add(i)
  if (depth === 0) resolvedCache.set(id, out)
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Naming

const NS_ALIAS = { minecraft: 'Minecraft', lemursaucepacket: 'LemurSaucePacket', lemursaucepacket_gear: 'LemurSaucePacket' }
function modName(ns) {
  if (NS_ALIAS[ns]) return NS_ALIAS[ns]
  if (mods.has(ns)) return mods.get(ns)
  const owner = nsOwner.get(ns)
  if (owner && jarPrimary.has(owner)) return jarPrimary.get(owner)
  return titleCase(ns)
}

function titleCase(s) {
  return s
    .replace(/[_/-]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** snake_case id fragment -> "Sentence case". */
function sentenceCase(s) {
  return capFirst(s.replace(/[_/]+/g, ' ').trim())
}

function capFirst(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

const UNCOUNTABLE = /(fish|sheep|deer|bass|moose|cod|salmon|squid|bogged|drowned|surrendered)$/i
function plural(name) {
  if (UNCOUNTABLE.test(name)) return name
  if (/man$/i.test(name)) return name.replace(/man$/i, 'men')
  if (/(s|x|z|ch|sh)$/i.test(name)) return name + 'es'
  if (/[^aeiou]y$/i.test(name)) return name.slice(0, -1) + 'ies'
  if (/(wolf|calf|elf|thief|leaf)$/i.test(name)) return name.replace(/f$/i, 'ves')
  return name + 's'
}

// Vanilla chest and gameplay tables get proper names: [regex on path, label, group, unit for "group (N units)"].
const VANILLA_NAMES = [
  [/^chests\/abandoned_mineshaft$/, 'Abandoned Mineshaft', 'Abandoned Mineshaft chests'],
  [/^chests\/ancient_city$/, 'Ancient City', 'Ancient City chests'],
  [/^chests\/ancient_city_ice_box$/, 'Ancient City (ice box)', 'Ancient City chests'],
  [/^chests\/bastion_(\w+)$/, 'Bastion Remnant ($1)', 'Bastion Remnant chests', 'rooms'],
  [/^chests\/buried_treasure$/, 'Buried Treasure', 'Buried Treasure chests'],
  [/^chests\/desert_pyramid$/, 'Desert Pyramid', 'Desert Pyramid chests'],
  [/^chests\/end_city_treasure$/, 'End City', 'End City chests'],
  [/^chests\/igloo_chest$/, 'Igloo', 'Igloo chests'],
  [/^chests\/jungle_temple$/, 'Jungle Temple', 'Jungle Temple chests'],
  [/^chests\/jungle_temple_dispenser$/, 'Jungle Temple (dispenser)', 'Jungle Temple chests'],
  [/^chests\/nether_bridge$/, 'Nether Fortress', 'Nether Fortress chests'],
  [/^chests\/pillager_outpost$/, 'Pillager Outpost', 'Pillager Outpost chests'],
  [/^chests\/ruined_portal$/, 'Ruined Portal', 'Ruined Portal chests'],
  [/^chests\/shipwreck_(\w+)$/, 'Shipwreck ($1)', 'Shipwreck chests', 'rooms'],
  [/^chests\/simple_dungeon$/, 'Dungeon', 'Dungeon chests'],
  [/^chests\/spawn_bonus_chest$/, 'Spawn bonus chest', 'Spawn bonus chest'],
  [/^chests\/stronghold_(\w+)$/, 'Stronghold ($1)', 'Stronghold chests', 'rooms'],
  [/^chests\/trial_chambers\/(\w+)$/, 'Trial Chambers ($1)', 'Trial Chambers chests', 'kinds'],
  [/^chests\/underwater_ruin_(\w+)$/, 'Ocean Ruin ($1)', 'Ocean Ruin chests', 'kinds'],
  [/^chests\/village\/village_(\w+)$/, 'Village $1', 'Village chests', 'houses'],
  [/^chests\/woodland_mansion$/, 'Woodland Mansion', 'Woodland Mansion chests'],
  [/^archaeology\/desert_pyramid$/, 'Desert Pyramid (archaeology)', 'Archaeology', 'sites'],
  [/^archaeology\/desert_well$/, 'Desert Well (archaeology)', 'Archaeology', 'sites'],
  [/^archaeology\/ocean_ruin_(\w+)$/, 'Ocean Ruin (archaeology, $1)', 'Archaeology', 'sites'],
  [/^archaeology\/trail_ruins_(\w+)$/, 'Trail Ruins (archaeology, $1)', 'Archaeology', 'sites'],
  [/^gameplay\/fishing$/, 'Fishing', 'Fishing', 'catches'],
  [/^gameplay\/fishing\/(\w+)$/, 'Fishing ($1)', 'Fishing', 'catches'],
  [/^gameplay\/hero_of_the_village\/(\w+)_gift$/, 'Hero of the Village gift ($1)', 'Hero of the Village gifts', 'villagers'],
  [/^gameplay\/piglin_bartering$/, 'Piglin bartering', 'Piglin bartering'],
  [/^gameplay\/cat_morning_gift$/, 'Cat morning gift', 'Cat morning gift'],
  [/^gameplay\/sniffer_digging$/, 'Sniffer digging', 'Sniffer digging'],
  [/^gameplay\/panda_sneeze$/, 'Panda sneeze', 'Panda sneeze'],
  [/^gameplay\/chicken_lay$/, 'Chicken eggs', 'Chicken eggs'],
  [/^spawners\/ominous\/trial_chamber\/(\w+)$/, 'Trial Chambers ominous spawners ($1)', 'Trial Chambers spawners', 'kinds'],
  [/^spawners\/trial_chamber\/(\w+)$/, 'Trial Chambers spawners ($1)', 'Trial Chambers spawners', 'kinds'],
  [/^pots\/trial_chambers\/(\w+)$/, 'Trial Chambers pots', 'Trial Chambers pots'],
  [/^shearing\/(\w+)$/, 'Shearing a $1', 'Shearing', 'mobs']
]

// Trailing qualifiers dropped from flat table names, so foundry_treasure, mines_treasure_big and dungeon_3 name
// their structure, not the chest.
const QUALIFIERS = new Set(('treasure tresure normal common supply supplies barrel barrels generic loot chest chests big medium small ' +
  'lesser greater rare random trash map maps special extra low high middle basic legend junk main inside top bottom ' +
  'entrance stairs ground room rooms vault ominous heart potions brewing kitchen library storage food meat utility ' +
  'weaponry armory armoury raw ores vegitarian tools tents tent gardens garden cells hub housing elite passage exterior ' +
  'chains pit hallways equipment coal redstone chamber enchants upper side lab hidden pot statue tomb wardrobe egg ' +
  'tombstone bookshelf forge table piles cs md lg cmd boss mini bar rocket slope dispenser banner cold grave master ' +
  'expert novice drinkables cheap expensive compat').split(' '))
const CATEGORY_FOLDER = /^(chests?|barrels?|pots?|spawners?|archaeology|archeology|archaelogy|gameplay|rewards?|inject|hero_of_the_village|compat)$/
function structureOf(tablePath, lastSegmentOnly) {
  const parts = tablePath.split('/')
  let after = parts
  if (!lastSegmentOnly) {
    let i = 0
    while (i < parts.length - 1 && CATEGORY_FOLDER.test(parts[i])) i++
    after = parts.slice(i)
    if (after.length > 1) return after[0]
  }
  const tokens = after[after.length - 1].split('_').filter(Boolean)
  while (tokens.length > 1 && (QUALIFIERS.has(tokens[tokens.length - 1]) || /^\d+$/.test(tokens[tokens.length - 1]))) tokens.pop()
  return tokens.join('_')
}

const SUFFIX = { chest: ' chests', loot: ' loot', pot: ' pots', spawner: ' spawners', archaeology: ' (archaeology)' }
const sourceCache = new Map()

/** How a loot table reads as a source: { key, kind, label, group, unit, vanilla, mod? } or null when it isn't one. */
function tableSource(id) {
  if (sourceCache.has(id)) return sourceCache.get(id)
  const t = tables.get(id) ?? { id, ns: id.split(':')[0], path: id.split(':')[1] ?? '', kind: kindOf(id.split(':')[1] ?? ''), vanilla: false, referenced: false, injected: false, labels: new Set() }
  let src = null
  const kind = t.kind
  if (kind === 'block' || kind === 'aux' || t.injected || (kind === 'loot' && t.referenced)) src = null
  else if (kind === 'entity') src = entitySource(t)
  else if (t.ns === 'minecraft' && t.vanilla) {
    for (const [re, label, group, unit] of VANILLA_NAMES) {
      const m = re.exec(t.path)
      if (!m) continue
      const fill = (s) => s.replace(/\$1/g, (m[1] ?? '').replace(/_/g, ' '))
      src = { key: fill(label), kind, label: fill(label), group, unit: unit ?? 'kinds', vanilla: true }
      break
    }
    if (!src) src = { key: t.path, kind, label: sentenceCase(t.path.replace(/^[a-z]+\//, '')), group: 'Other', unit: 'kinds', vanilla: true }
  } else {
    const mod = t.ns === 'minecraft' ? jarPrimary.get([...t.labels][0]) ?? 'Minecraft' : modName(t.ns)
    let label
    let group = `${mod}${SUFFIX[kind] ?? ' loot'}`
    if (kind === 'fishing') label = group = `Fishing (${mod})`
    else if (kind === 'shearing') label = group = `Shearing a ${sentenceCase(structureOf(t.path, true))} (${mod})`
    else if (kind === 'gameplay') {
      label = `${mod}: ${sentenceCase(structureOf(t.path, true))}${/^rewards?\//.test(t.path) ? ' reward' : ''}`
      group = label
    } else label = `${mod}: ${sentenceCase(structureOf(t.path, false))}${SUFFIX[kind] ?? ' loot'}`
    src = { key: label, kind, label, group, unit: 'structures', vanilla: false }
  }
  sourceCache.set(id, src)
  return src
}

function entitySource(t) {
  const parts = t.path.split('/')
  let seg = parts[parts.length - 1]
  if (parts.length >= 3 && lang.has(`entity.minecraft.${parts[1]}`)) seg = parts[1] // entities/sheep/black
  seg = seg.replace(/_loot$/, '')
  const own = t.ns === 'minecraft' ? undefined : lang.get(`entity.${t.ns}.${seg}`)
  const vanilla = lang.get(`entity.minecraft.${seg}`)
  const name = own ?? vanilla ?? titleCase(seg)
  const mod = own || !vanilla ? modName(t.ns) : null
  const label = plural(name)
  return { key: `entity:${label}:${mod ?? ''}`, kind: 'entity', label, group: `${mod ?? 'Minecraft'} mobs`, unit: 'mobs', vanilla: !mod, mod }
}

// ---------------------------------------------------------------------------------------------------------------
// Sources per item

const sources = new Map() // item id -> Map(source key -> source)
function addSource(item, src) {
  if (!src) return
  if (!sources.has(item)) sources.set(item, new Map())
  sources.get(item).set(src.key, src)
}

for (const t of tables.values()) {
  const src = tableSource(t.id)
  if (!src) continue
  for (const item of resolvedItems(t.id)) addSource(item, src)
}
for (const m of modifiers) {
  const items = new Set(m.items)
  for (const inj of m.injected) for (const i of resolvedItems(inj)) items.add(i)
  const srcs = []
  for (const target of m.targets) srcs.push(tableSource(target))
  for (const e of m.entities) srcs.push(tableSource(`${e.split(':')[0]}:entities/${e.split(':')[1]}`))
  for (const src of srcs) for (const i of items) addSource(i, src)
}
const tableIds = [...tables.keys()]
for (const k of kubeLoot) {
  const targets = k.entity ? [`${k.target.split(':')[0]}:entities/${k.target.split(':')[1]}`] : k.target instanceof RegExp ? tableIds.filter((id) => k.target.test(id)) : [k.target]
  for (const target of targets) for (const i of k.items) addSource(i, tableSource(target))
}

// ---------------------------------------------------------------------------------------------------------------
// Select

const CHESTLIKE = new Set(['chest', 'loot', 'pot', 'spawner'])
const allowedNs = (ns) => ns === 'minecraft' || ns === 'lemursaucepacket' || mods.has(ns)
const entries = [] // { item, ns, lootOnly, srcs }
const skippedNs = new Map()
const unknownItems = []
const seenNs = new Map()
for (const [item, srcMap] of sources) {
  const ns = item.split(':')[0]
  seenNs.set(ns, (seenNs.get(ns) ?? 0) + 1)
  if (ns === 'minecraft') continue
  if (!allowedNs(ns)) {
    skippedNs.set(ns, (skippedNs.get(ns) ?? 0) + 1)
    continue
  }
  if (ns !== 'lemursaucepacket' && !knownItems.has(item)) {
    unknownItems.push(item)
    continue
  }
  const srcs = [...srcMap.values()]
  const lootOnly = !recipeResults.has(item)
  if (!lootOnly && !srcs.some((s) => CHESTLIKE.has(s.kind))) continue
  entries.push({ item, ns, lootOnly, srcs })
}

// ---------------------------------------------------------------------------------------------------------------
// Text limits: named sources per item, per craftable item ("also found in"), group size that folds into
// "Village chests (12 houses)", and the width of a generated line.

const CAP = 6
const BOTH_CAP = 3
const COLLAPSE = 3
const WIDTH = 82 // plus indent, quotes and comma stays under 90

const byVanilla = (a, b) => (b.vanilla ? 1 : 0) - (a.vanilla ? 1 : 0) || a.label.localeCompare(b.label)

/** Chest-like source labels, vanilla first, groups of COLLAPSE or more folded into "Village chests (12 houses)". */
function collapse(srcs) {
  const groups = new Map()
  for (const s of srcs) {
    if (!groups.has(s.group)) groups.set(s.group, [])
    groups.get(s.group).push(s)
  }
  const out = []
  for (const [group, list] of groups) {
    if (list.length >= COLLAPSE) out.push({ label: `${group} (${list.length} ${list[0].unit})`, vanilla: list[0].vanilla })
    else for (const s of list) out.push(s)
  }
  return out.sort(byVanilla).map((s) => s.label)
}

// ---------------------------------------------------------------------------------------------------------------
// Relics (see the header)

const RELIC_CATEGORIES = {
  WILDCARD: { text: 'any loot chest' },
  OVERWORLD: { text: 'any Overworld loot chest' },
  THE_NETHER: { text: 'any loot chest in the Nether' },
  THE_END: { text: 'any loot chest in the End' },
  NETHER_LIKE: { text: 'nether-themed chests', table: '[\\w]+:chests\\/[\\w_\\/]*(nether|infern|hell|chasm|lava|magma|m[eo]lt|fire|flame|blaze|ember|pyre)[\\w_\\/]*', also: ['minecraft:chests/ruined_portal'] },
  END_LIKE: { text: 'End and stronghold chests', table: '[\\w]+:chests\\/[\\w_\\/]*(end|stronghold)[\\w_\\/]*' },
  VILLAGE: { text: 'village and pillager chests', table: '[\\w]+:chests\\/[\\w_\\/]*(village|pillage)[\\w_\\/]*' },
  BASTION: { text: 'bastion and piglin chests', table: '[\\w]+:chests\\/[\\w_\\/]*(bastion|piglin)[\\w_\\/]*' },
  MINESHAFT: { text: 'mineshaft chests', table: '[\\w]+:chests\\/[\\w_\\/]*(mine)[\\w_\\/]*' },
  DESERT: { text: 'loot chests in desert and badlands biomes' },
  SAVANNA: { text: 'loot chests in savanna biomes' },
  FOREST: { text: 'loot chests in forest biomes' },
  MOUNTAIN: { text: 'loot chests in mountain and hill biomes' },
  AQUATIC: { text: 'loot chests in ocean, beach and river biomes' },
  TROPIC: { text: 'loot chests in jungle biomes' },
  TAIGA: { text: 'loot chests in taiga biomes' },
  PLAINS: { text: 'loot chests in plains and meadow biomes' },
  SWAMP: { text: 'loot chests in swamp biomes' },
  FROST: { text: 'loot chests in snowy and icy biomes' },
  CAVE: { text: 'loot chests in cave biomes' },
  SCULK: { text: 'loot chests in the Deep Dark' }
}
const RELICS = {
  chef_hat: ['VILLAGE'],
  chorus_staff: ['THE_END', 'END_LIKE'],
  clot_of_time: ['THE_END', 'END_LIKE'],
  cut_glass_boot: ['AQUATIC'],
  experience_disperser: ['WILDCARD'],
  ghostly_mantle: ['THE_NETHER', 'NETHER_LIKE'],
  glitchy_mantle: ['THE_END', 'END_LIKE'],
  hunting_belt: ['VILLAGE'],
  jellyfish_necklace: ['AQUATIC'],
  kinetic_belt: ['THE_END', 'END_LIKE'],
  leafy_mantle: ['FOREST', 'TROPIC'],
  midnight_mantle: ['THE_END', 'END_LIKE'],
  piglin_mask: ['BASTION'],
  reflective_necklace: ['THE_NETHER', 'NETHER_LIKE'],
  rider_flute: ['CAVE', 'VILLAGE'],
  ring_of_the_seven_deadly_sins: ['THE_NETHER', 'NETHER_LIKE'],
  roller_skate: ['OVERWORLD'],
  shield_of_retaliation: ['THE_NETHER', 'NETHER_LIKE'],
  sphere_of_self_sacrifice: ['THE_NETHER', 'NETHER_LIKE'],
  springy_boot: ['MOUNTAIN']
}

const chestTableIds = tableIds.filter((id) => tables.get(id).kind === 'chest')
function relicPhrase(cat) {
  const c = RELIC_CATEGORIES[cat]
  if (!c.table) return c.text
  const re = new RegExp(`^(?:${c.table})$`)
  const srcs = new Map()
  for (const id of chestTableIds.concat(c.also ?? [])) {
    if (!re.test(id) && !(c.also ?? []).includes(id)) continue
    const src = tableSource(id)
    if (src) srcs.set(src.key, src)
  }
  const list = collapse([...srcs.values()]).map((s) => s.replace(/ chests( \(|$)/, '$1'))
  const shown = list.slice(0, 4)
  const more = list.length - shown.length
  return list.length ? `${c.text} (${shown.join(', ')}${more > 0 ? `, and ${more} more` : ''})` : c.text
}
const relicEntries = Object.entries(RELICS)
  .filter(([name]) => knownItems.has(`relics:${name}`))
  .map(([name, cats]) => ({ item: `relics:${name}`, where: cats.map(relicPhrase).join('; ') }))

// ---------------------------------------------------------------------------------------------------------------
// Text

/** Named sources for an item: found (chests, fishing, …) and dropped (mobs, one mod suffix when all share it). */
function describe(srcs, cap) {
  const found = collapse(srcs.filter((s) => s.kind !== 'entity'))
  const mobs = srcs.filter((s) => s.kind === 'entity').sort(byVanilla)
  const mobMods = new Set(mobs.map((s) => s.mod).filter(Boolean))
  const oneMod = mobMods.size === 1 && mobs.every((s) => s.mod)
  const dropped = mobs.map((s) => (s.mod && !oneMod ? `${s.label} (${s.mod})` : s.label))
  const keptFound = found.slice(0, cap)
  const keptDropped = dropped.slice(0, Math.max(0, cap - keptFound.length))
  return { found: keptFound, dropped: keptDropped, droppedSuffix: oneMod ? ` (${[...mobMods][0]})` : '', more: found.length + dropped.length - keptFound.length - keptDropped.length }
}

function lines(entry) {
  const { found, dropped, droppedSuffix, more } = describe(entry.srcs, entry.lootOnly ? CAP : BOTH_CAP)
  const out = []
  const tail = more > 0 ? `, and ${more} more` : ''
  if (found.length) out.push(`${entry.lootOnly ? 'Found in' : 'Also found in'}: ${found.join(', ')}${dropped.length ? '' : tail}.`)
  if (dropped.length) out.push(`Dropped by: ${dropped.join(', ')}${tail}${droppedSuffix}.`)
  return out.flatMap(wrap)
}

function wrap(text) {
  const out = []
  let line = ''
  for (const part of text.split(/(?<=[,;] )/)) {
    if (line && line.length + part.length > WIDTH) {
      out.push(line.trimEnd())
      line = ''
    }
    line += part
  }
  if (line) out.push(line.trimEnd())
  return out
}

function whereText(entry) {
  const { found, dropped, droppedSuffix, more } = describe(entry.srcs, entry.lootOnly ? CAP : BOTH_CAP)
  const tail = more > 0 ? `, and ${more} more` : ''
  const parts = []
  if (found.length) parts.push(found.join(', ') + (dropped.length ? '' : tail))
  if (dropped.length) parts.push(`dropped by ${dropped.join(', ')}${tail}${droppedSuffix}`)
  return parts.join('; ')
}

function displayName(id) {
  const [ns, p] = id.split(':')
  const name = lang.get(`item.${ns}.${p}`) ?? lang.get(`block.${ns}.${p}`) ?? titleCase(p)
  // Music discs: "Music Disc (Around the Corner)"; 1.21 keeps the song name under jukebox_song.<ns>.<song>.
  const desc = lang.get(`item.${ns}.${p}.desc`) ?? (p.startsWith('music_disc_') ? lang.get(`jukebox_song.${ns}.${p.slice('music_disc_'.length)}`) : undefined)
  return desc ? `${name} (${desc})` : name
}

// ---------------------------------------------------------------------------------------------------------------
// Write

entries.sort((a, b) => a.item.localeCompare(b.item))
const jei = new Map()
for (const r of relicEntries) jei.set(r.item, wrap(`Found in: ${r.where}.`).concat(['Relics rolls these into matching chests at random.']))
for (const e of entries) if (!jei.has(e.item)) jei.set(e.item, lines(e))

const js = []
js.push('// GENERATED by publish/sources.mjs — do not edit.')
js.push('// Where loot-only modded items come from, for the JEI info tab: chests and mobs from')
js.push("// every mod jar's loot tables and loot modifiers, the Relics from their code.")
js.push('const JEI_SOURCES = {')
const jeiKeys = [...jei.keys()]
jeiKeys.forEach((id, i) => {
  const arr = jei.get(id).map((s) => `    ${JSON.stringify(s)}`).join(',\n')
  js.push(`  ${JSON.stringify(id)}: [\n${arr}\n  ]${i < jeiKeys.length - 1 ? ',' : ''}`)
})
js.push('}')
js.push('')
js.push('const registerSources = (event) => {')
js.push('  Object.keys(JEI_SOURCES).forEach((id) => {')
js.push('    try {')
js.push('      event.add(id, JEI_SOURCES[id])')
js.push('    } catch (e) {}')
js.push('  })')
js.push('}')
js.push('// KubeJS 7 (this pack); JEIEvents is the KubeJS 6 name, kept as a fallback.')
js.push("if (typeof RecipeViewerEvents !== 'undefined') {")
js.push("  RecipeViewerEvents.addInformation('item', registerSources)")
js.push("} else if (typeof JEIEvents !== 'undefined') {")
js.push('  JEIEvents.information(registerSources)')
js.push('}')
js.push('')
// The first sentence also goes on the tooltip (grey, italic, shortened), so the answer is there without JEI.
const tips = {}
for (const id of jeiKeys) {
  const sentence = jei.get(id).join(' ').split(/\.\s/)[0].replace(/\.$/, '')
  tips[id] = sentence.length > 72 ? sentence.slice(0, 70).replace(/[\s,(]+$/, '') + '…' : sentence
}
js.push('const SOURCE_TIPS = {')
jeiKeys.forEach((id, i) => js.push(`  ${JSON.stringify(id)}: ${JSON.stringify(tips[id])}${i < jeiKeys.length - 1 ? ',' : ''}`))
js.push('}')
js.push('ItemEvents.modifyTooltips((event) => {')
js.push('  Object.keys(SOURCE_TIPS).forEach((id) => {')
js.push('    try {')
js.push("      event.modify(id, (tooltip) => tooltip.add(Text.of('\\u00a78\\u00a7o' + SOURCE_TIPS[id])))")
js.push('    } catch (e) {}')
js.push('  })')
js.push('})')
js.push('')
writeFileSync(path.join(root, 'pack/kubejs/client_scripts/jei_sources.js'), js.join('\n'))

// docs/where-to-find.md: one table per mod, Relics first. Mods with more than 60 loot-only items only list
// what chests hold (mob drops of a mod with dozens of creatures are not worth a page).
const byMod = new Map()
for (const e of entries) {
  if (!e.lootOnly) continue
  const name = modName(e.ns)
  if (!byMod.has(name)) byMod.set(name, [])
  byMod.get(name).push(e)
}
const md = []
md.push('# Where to find things')
md.push('')
md.push("JEI shows every recipe; this page (and the JEI info tab, the `i` button on an item) covers what you can't craft: the modded items that only turn up in structure chests, as mob drops, from fishing or from brushing suspicious sand. Vanilla items are left out, and so are plain block drops. Generated from the pack's mod jars by `publish/sources.mjs`, so it matches the installed versions.")
md.push('')
md.push('## Relics')
md.push('')
md.push("Relics never appear in recipes: the mod rolls them into loot chests that match each relic's theme (any chest for some, only nether- or village-flavoured chests for others). Weights are configurable in `config/relics.yaml`.")
md.push('')
md.push('| Item | Where |')
md.push('| --- | --- |')
for (const r of relicEntries.slice().sort((a, b) => displayName(a.item).localeCompare(displayName(b.item)))) md.push(`| ${displayName(r.item)} | ${capFirst(r.where)} |`)
md.push('')
const modNames = [...byMod.keys()].filter((n) => n !== 'Relics').sort((a, b) => a.localeCompare(b))
for (const name of modNames) {
  let list = byMod.get(name)
  const big = list.length > 60
  if (big) list = list.filter((e) => e.srcs.some((s) => CHESTLIKE.has(s.kind)))
  if (list.length === 0) continue
  md.push(`## ${name}`)
  md.push('')
  if (big) md.push(`${byMod.get(name).length} of this mod's items are loot-only; only the ones found in chests are listed.`)
  if (big) md.push('')
  md.push('| Item | Where |')
  md.push('| --- | --- |')
  for (const e of list.slice().sort((a, b) => displayName(a.item).localeCompare(displayName(b.item)))) md.push(`| ${displayName(e.item)} | ${capFirst(whereText(e))} |`)
  md.push('')
}
writeFileSync(path.join(root, 'docs/where-to-find.md'), md.join('\n'))

// ---------------------------------------------------------------------------------------------------------------
// Report

const lootOnly = entries.filter((e) => e.lootOnly)
const lootOnlyMods = new Set(lootOnly.map((e) => modName(e.ns)))
if (skippedNs.size) console.log(`sources: skipped ${[...skippedNs].reduce((n, [, c]) => n + c, 0)} items of namespaces without a client mod: ${[...skippedNs.keys()].sort().join(', ')}`)
if (unknownItems.length) console.log(`sources: skipped ${unknownItems.length} ids with no item model or lang key: ${unknownItems.sort().join(', ')}`)
if (VERBOSE) {
  console.log(`sources: ${jarCount} jars, ${tables.size} loot tables, ${recipeResults.size} recipe results, ${modifiers.length} loot modifiers, ${kubeLoot.length} LootJS additions, ${Date.now() - t0} ms`)
  console.log(`sources: item namespaces in loot: ${[...seenNs].sort((a, b) => b[1] - a[1]).map(([ns, n]) => `${ns}=${n}`).join(' ')}`)
  console.log(`sources: ${entries.length - lootOnly.length} craftable items also get an "also found in" chest hint`)
}
console.log(`sources: ${lootOnly.length} loot-only items across ${lootOnlyMods.size} mods, ${relicEntries.length} relics → jei_sources.js, docs/where-to-find.md`)
