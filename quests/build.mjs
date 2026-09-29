// Builds the FTB Quests book (config/ftbquests/quests) from quests/book.mjs.
//   node quests/build.mjs            write into pack/config/ftbquests/quests
//   node quests/build.mjs --check    validate ids only
// Every item/entity/biome/structure/advancement id is checked against quests/.id-index.json
// (made by quests/id-index.mjs from the real mod jars), so a typo fails the build instead of
// producing a quest nobody can complete.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import book from './book.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'pack', 'config', 'ftbquests', 'quests')
const emblemDir = path.join(root, 'pack', 'kubejs', 'assets', 'lemursaucepacket', 'textures', 'quests')
const checkOnly = process.argv.includes('--check')

// ---------------------------------------------------------------- ids

/** Stable 16-hex-digit id (positive long) from a key, so re-running the build never reshuffles progress. */
function hexId(key) {
  const h = createHash('sha1').update(`lemursaucepacket:${key}`).digest('hex').slice(0, 16).toUpperCase()
  return (parseInt(h[0], 16) & 0x7).toString(16).toUpperCase() + h.slice(1)
}

// ---------------------------------------------------------------- SNBT

const D = (n) => ({ __snbt: `${Number.isInteger(n) ? n.toFixed(1) : n}d` })
const L = (n) => ({ __snbt: `${n}L` })

function snbtString(s) {
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function snbt(value, indent = '') {
  const inner = indent + '\t'
  if (value && typeof value === 'object' && '__snbt' in value) return value.__snbt
  if (Array.isArray(value)) {
    if (value.length === 0) return '[ ]'
    if (value.every((v) => typeof v === 'string')) return `[${value.map(snbtString).join(', ')}]`
    return `[\n${value.map((v) => inner + snbt(v, inner)).join('\n')}\n${indent}]`
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort()
    if (keys.length === 0) return '{ }'
    return `{\n${keys.map((k) => `${inner}${/^[A-Za-z0-9_.+-]+$/.test(k) ? k : snbtString(k)}: ${snbt(value[k], inner)}`).join('\n')}\n${indent}}`
  }
  if (typeof value === 'string') return snbtString(value)
  return String(value)
}

// ---------------------------------------------------------------- validation

// Prefer the exact registry dump from a real server (quests/registry-dump.js); the jar scan is a
// fallback that can accept ids which only exist as lang keys.
const registryPath = path.join(root, 'quests', '.registry.json')
const indexPath = path.join(root, 'quests', '.id-index.json')
const sourcePath = existsSync(registryPath) ? registryPath : indexPath
if (!existsSync(sourcePath)) {
  console.error('No id list. Dump one from a server (quests/registry-dump.js) or scan jars: node quests/id-index.mjs <mods dir> <vanilla client jar>')
  process.exit(2)
}
const index = JSON.parse(readFileSync(sourcePath, 'utf8'))
const known = {
  item: new Set(index.item),
  entity: new Set(index.entity),
  biome: new Set([...index.biome, ...index.biomeTag]),
  structure: new Set([...index.structure, ...index.structureTag]),
  advancement: new Set(index.advancement),
  dimension: new Set(index.dimension ?? ['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end'])
}
const problems = []
const need = (kind, id, where) => {
  if (!known[kind].has(id)) problems.push(`${where}: unknown ${kind} "${id}"`)
}

// Our own worldgen tags (pack/kubejs/data/<ns>/tags/worldgen/...) count as known, and their members
// are checked too, so a tag cannot silently end up empty.
for (const kind of ['biome', 'structure']) {
  const base = path.join(root, 'pack', 'kubejs', 'data')
  if (!existsSync(base)) continue
  for (const ns of readdirSync(base)) {
    const dir = path.join(base, ns, 'tags', 'worldgen', kind)
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir, { recursive: true }).filter((f) => f.endsWith('.json'))) {
      const tag = `#${ns}:${file.replace(/\\/g, '/').replace(/\.json$/, '')}`
      for (const v of JSON.parse(readFileSync(path.join(dir, file), 'utf8')).values) need(kind, typeof v === 'string' ? v : v.id, `tag ${tag}`)
      known[kind].add(tag)
    }
  }
}

/** An icon is an item id, or an item stack object ({ id, components }) for things like banners. */
function iconData(icon, where) {
  if (!icon) return undefined
  const stack = typeof icon === 'string' ? { id: icon } : icon
  need('item', stack.id, where)
  return stack
}

// ---------------------------------------------------------------- coins

const COINS = [
  ['sun', 4096],
  ['crown', 512],
  ['cog', 64],
  ['sprocket', 16],
  ['bevel', 8],
  ['spur', 1]
]
/** Numismatics coin items adding up to `value` spurs. */
function coinItems(value) {
  const out = []
  let left = value
  for (const [coin, worth] of COINS) {
    const n = Math.floor(left / worth)
    if (n > 0) out.push({ item: `numismatics:${coin}`, count: n })
    left -= n * worth
  }
  return out
}

// ---------------------------------------------------------------- build

function taskData(task, id, where) {
  if (task.item) {
    need('item', task.item, where)
    return { id, item: { count: 1, id: task.item }, type: 'item', count: (task.count ?? 1) > 1 ? L(task.count) : undefined }
  }
  if (task.kill) {
    need('entity', task.kill, where)
    return { entity: task.kill, id, type: 'kill', value: L(task.count ?? 1) }
  }
  if (task.structure) {
    need('structure', task.structure, where)
    return { id, structure: task.structure, type: 'structure' }
  }
  if (task.biome) {
    need('biome', task.biome, where)
    return { biome: task.biome, id, type: 'biome' }
  }
  if (task.dimension) {
    need('dimension', task.dimension, where)
    return { dimension: task.dimension, id, type: 'dimension' }
  }
  if (task.advancement) {
    need('advancement', task.advancement, where)
    return { advancement: task.advancement, criterion: '', id, type: 'advancement' }
  }
  if (task.checkmark) return { id, type: 'checkmark' }
  throw new Error(`${where}: unknown task ${JSON.stringify(task)}`)
}

function rewardData(reward, key, where) {
  const out = []
  if (reward.xp) out.push({ id: hexId(`${key}/xp`), type: 'xp', xp: reward.xp })
  if (reward.coins) {
    for (const c of coinItems(reward.coins)) out.push({ id: hexId(`${key}/coin/${c.item}`), item: { count: c.count, id: c.item }, type: 'item' })
  }
  for (const [i, it] of (reward.items ?? []).entries()) {
    need('item', it.item, where)
    out.push({ id: hexId(`${key}/item/${i}`), item: { count: it.count ?? 1, id: it.item }, type: 'item' })
  }
  return out
}

/** Dependency-depth layout: each "generation" of quests is a column, centred vertically. */
function layout(quests) {
  const byKey = new Map(quests.map((q) => [q.key, q]))
  const depth = new Map()
  const depthOf = (q, stack = []) => {
    if (depth.has(q.key)) return depth.get(q.key)
    if (stack.includes(q.key)) throw new Error(`dependency cycle at ${q.key}`)
    const d = (q.after ?? []).length === 0 ? 0 : 1 + Math.max(...q.after.map((k) => depthOf(byKey.get(k), [...stack, q.key])))
    depth.set(q.key, d)
    return d
  }
  const columns = new Map()
  for (const q of quests) {
    const d = depthOf(q)
    if (!columns.has(d)) columns.set(d, [])
    columns.get(d).push(q)
  }
  const pos = new Map()
  for (const [d, col] of columns) col.forEach((q, row) => pos.set(q.key, [d * 2.25, (row - (col.length - 1) / 2) * 1.75]))
  return pos
}

/** Grid layout for chapters that are collections rather than a progression. */
function grid(quests, columns = 5) {
  return new Map(quests.map((q, i) => [q.key, [(i % columns) * 2, Math.floor(i / columns) * 1.75]]))
}

const files = new Map()
// FTB Quests 2101.1.x reads one flat table per language: lang/<locale>.snbt, keys "<type>.<HEXID>.<field>".
const lang = { 'file.0000000000000001.title': book.title }

const groupIds = new Map(book.groups.map((g) => [g.key, hexId(`group/${g.key}`)]))
for (const g of book.groups) lang[`chapter_group.${groupIds.get(g.key)}.title`] = g.title

book.chapters.forEach((chapter, order) => {
  const chapterId = hexId(`chapter/${chapter.key}`)
  const where = `chapter ${chapter.key}`
  const questIds = new Map(chapter.quests.map((q) => [q.key, hexId(`quest/${chapter.key}/${q.key}`)]))
  for (const q of chapter.quests) {
    for (const dep of q.after ?? []) if (!questIds.has(dep)) problems.push(`${where}/${q.key}: depends on unknown quest "${dep}"`)
  }
  const positions = chapter.layout === 'grid' ? grid(chapter.quests) : layout(chapter.quests)
  const chapterLang = {}
  const quests = chapter.quests.map((q) => {
    const id = questIds.get(q.key)
    const qWhere = `${where}/${q.key}`
    const [x, y] = q.pos ?? positions.get(q.key)
    const tasks = q.tasks.map((t, i) => {
      const taskId = hexId(`task/${chapter.key}/${q.key}/${i}`)
      if (t.title) chapterLang[`task.${taskId}.title`] = t.title
      return taskData(t, taskId, qWhere)
    })
    const icon = iconData(q.icon ?? q.tasks.find((t) => t.item)?.item, qWhere)
    chapterLang[`quest.${id}.title`] = q.title
    if (q.subtitle) chapterLang[`quest.${id}.quest_subtitle`] = q.subtitle
    if (q.desc) chapterLang[`quest.${id}.quest_desc`] = q.desc
    return {
      dependencies: (q.after ?? []).map((k) => questIds.get(k)).filter(Boolean),
      icon,
      id,
      rewards: rewardData(q.reward ?? {}, `reward/${chapter.key}/${q.key}`, qWhere),
      shape: q.shape,
      size: q.size ? D(q.size) : undefined,
      tasks,
      x: D(x),
      y: D(y)
    }
  })
  quests.forEach((q) => {
    if (q.dependencies.length === 0) delete q.dependencies
  })
  // Chapter crest: the emblem art (art/process.mjs). FTB centres its first view on the quests only, so the
  // crest goes right above the chapter's first column when that column is short, else to its left.
  const images = [...(chapter.images ?? [])]
  if (existsSync(path.join(emblemDir, `${chapter.key}.png`))) {
    const at = chapter.quests.map((q) => q.pos ?? positions.get(q.key))
    const minX = Math.min(...at.map(([x]) => x))
    const firstColumn = at.filter(([x]) => x === minX).map(([, y]) => y)
    const top = Math.min(...firstColumn)
    const bottom = Math.max(...firstColumn)
    const [x, y] = bottom - top <= 1.75 ? [minX, top - 2.3] : [minX - 2.3, (top + bottom) / 2]
    images.push({ height: D(2.2), image: `lemursaucepacket:textures/quests/${chapter.key}.png`, rotation: D(0), width: D(2.2), x: D(x), y: D(y) })
  }
  files.set(`chapters/${chapter.key}.snbt`, {
    default_hide_dependency_lines: false,
    default_quest_shape: '',
    filename: chapter.key,
    group: groupIds.get(chapter.group) ?? '',
    icon: iconData(chapter.icon, where),
    id: chapterId,
    images,
    order_index: order,
    progression_mode: 'default',
    quest_links: [],
    quests
  })
  lang[`chapter.${chapterId}.title`] = chapter.title
  if (chapter.subtitle) lang[`chapter.${chapterId}.chapter_subtitle`] = [chapter.subtitle]
  Object.assign(lang, chapterLang)
})

files.set('chapter_groups.snbt', { chapter_groups: book.groups.map((g) => ({ id: groupIds.get(g.key) })) })
files.set('data.snbt', {
  default_autoclaim_rewards: 'disabled',
  default_consume_items: false,
  default_quest_disable_jei: false,
  default_quest_shape: 'circle',
  default_reward_team: false,
  detection_delay: 20,
  disable_gui: false,
  drop_loot_crates: false,
  emergency_items_cooldown: 300,
  grid_scale: D(0.5),
  icon: iconData(book.icon, 'book'),
  lock_message: '',
  loot_crate_no_drop: { boss: 0, monster: 600, passive: 4000 },
  pause_game: false,
  // Flexible: tasks count whenever you do them (e.g. visiting a biome early), and quests complete once
  // their prerequisites are done. Linear would make players repeat exploration.
  progression_mode: 'flexible',
  show_lock_icons: true,
  version: 13
})
files.set('lang/en_us.snbt', lang)

const questCount = book.chapters.reduce((n, c) => n + c.quests.length, 0)
if (problems.length > 0) {
  console.error(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`${book.chapters.length} chapters, ${questCount} quests, all ids valid (checked against ${path.basename(sourcePath)})`)
if (checkOnly) process.exit(0)

rmSync(outDir, { recursive: true, force: true })
for (const [rel, data] of files) {
  const file = path.join(outDir, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, snbt(data) + '\n')
}
console.log(`Wrote ${files.size} files to ${path.relative(root, outDir)}`)
