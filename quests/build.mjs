// Builds the FTB Quests book (config/ftbquests/quests) from quests/book.mjs.
//   node quests/build.mjs            write into pack/config/ftbquests/quests
//   node quests/build.mjs --check    validate ids only
//   node quests/build.mjs --preview  also draw every chapter to quests/preview/<chapter>.svg
// Every item/entity/biome/structure/advancement id is checked against quests/.registry.json (a dump from
// a real server, quests/registry-dump.js) or quests/.id-index.json (made by quests/id-index.mjs from the
// mod jars), so a typo fails the build instead of producing a quest nobody can complete.
//
// Besides the chapters it writes:
//   - reward_tables/<key>.snbt: the reward tables (book.tables) that quest tiers and finales roll on;
//   - pack/config/lemursaucepacket/milestones.json: the ids of the Skills chapter's milestone quests, which
//     pack/kubejs/server_scripts/quest_milestones.js completes when a player's Project MMO level gets there.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import book from './book.mjs'
import { layoutGrid, layoutQuality, layoutTree, reduceDependencies, textWidth, wrap } from './layout.mjs'
import { chapterSvg } from './preview.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'pack', 'config', 'ftbquests', 'quests')
const milestonesFile = path.join(root, 'pack', 'config', 'lemursaucepacket', 'milestones.json')
const emblemDir = path.join(root, 'pack', 'kubejs', 'assets', 'lemursaucepacket', 'textures', 'quests')
const checkOnly = process.argv.includes('--check')
const preview = process.argv.includes('--preview')

// ---------------------------------------------------------------- ids

/** Stable 16-hex-digit id (positive long) from a key, so re-running the build never reshuffles progress. */
function hexId(key) {
  const h = createHash('sha1').update(`lemursaucepacket:${key}`).digest('hex').slice(0, 16).toUpperCase()
  return (parseInt(h[0], 16) & 0x7).toString(16).toUpperCase() + h.slice(1)
}

// ---------------------------------------------------------------- SNBT

const D = (n) => ({ __snbt: `${Number.isInteger(n) ? n.toFixed(1) : n}d` })
const F = (n) => ({ __snbt: `${Number.isInteger(n) ? n.toFixed(1) : n}f` })
const L = (n) => ({ __snbt: `${n}L` })
/** A hex id as the signed decimal long FTB writes for cross-references (reward tables). */
const hexLong = (hex) => L(BigInt(`0x${hex}`).toString())

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
// The pack's own gear (gear/gear.mjs) is registered by KubeJS, so a registry dump made before it won't list it.
const gear = await import('../gear/gear.mjs')
const gearIds = [
  ...gear.SETS.flatMap((s) => Object.keys(s.pieces).map((slot) => `${gear.NAMESPACE}:${s.id}_${slot}`)),
  ...[...gear.PIECES, ...gear.WEAPONS, ...gear.TOOLS, ...gear.MATERIAL_ITEMS].map((x) => `${gear.NAMESPACE}:${x.id}`)
]
// Mods added after the dump (Waystones, Regions Unexplored): ids read from their jars.
const later = await import('./later-ids.mjs')
const known = {
  // Numismatics left the pack in 1.5.0 (Gold Coins replaced it); the registry dump still lists its items.
  item: new Set([...index.item, ...gearIds, ...later.WAYSTONES_ITEMS, ...later.LIFESTEAL_ITEMS, ...later.ECONOMY_ITEMS, ...later.XP_BANK_ITEMS, ...later.ICEANDFIRE_ITEMS].filter((id) => !id.startsWith('numismatics:'))),
  entity: new Set(index.entity),
  biome: new Set([...index.biome, ...index.biomeTag, ...later.REGIONS_UNEXPLORED_BIOMES]),
  structure: new Set([...index.structure, ...index.structureTag, ...later.ICEANDFIRE_STRUCTURES]),
  advancement: new Set(index.advancement),
  dimension: new Set(index.dimension ?? ['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end']),
  // Blocks are checked as their items; block tags come from the list in later-ids.mjs.
  blockTag: new Set(later.BLOCK_TAGS)
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

/** A reward of `value` Gold Coins: one stack (lsp_fixes keeps the amount in a component, with no stack cap). */
function coinStack(value) {
  return { components: { 'lsp_fixes:coin_amount': value }, count: 1, id: 'lsp_fixes:gold_coins' }
}

// ---------------------------------------------------------------- build

function taskData(task, id, where) {
  const base = { id, icon: iconData(task.icon, where) }
  if (task.item) {
    need('item', task.item, where)
    // `components` with match 'fuzzy' means every listed component must be on the item (an enchanted book with
    // exactly that stored enchantment); the default matches the item id alone.
    if (task.match && !['fuzzy', 'strict'].includes(task.match)) problems.push(`${where}: unknown match "${task.match}"`)
    return {
      ...base,
      count: (task.count ?? 1) > 1 ? L(task.count) : undefined,
      item: { components: task.components, count: 1, id: task.item },
      match_components: task.match,
      type: 'item'
    }
  }
  // A task only a server script can complete (FTB's CustomTask has no button and no checker of its own):
  // the Skills chapter's milestones, finished by pack/kubejs/server_scripts/quest_milestones.js.
  if (task.custom) return { ...base, type: 'custom' }
  if (task.kill) {
    need('entity', task.kill, where)
    return { ...base, entity: task.kill, type: 'kill', value: L(task.count ?? 1) }
  }
  if (task.structure) {
    need('structure', task.structure, where)
    return { ...base, structure: task.structure, type: 'structure' }
  }
  if (task.biome) {
    need('biome', task.biome, where)
    return { ...base, biome: task.biome, type: 'biome' }
  }
  if (task.dimension) {
    need('dimension', task.dimension, where)
    return { ...base, dimension: task.dimension, type: 'dimension' }
  }
  if (task.advancement) {
    need('advancement', task.advancement, where)
    return { ...base, advancement: task.advancement, criterion: '', type: 'advancement' }
  }
  if (task.observe) {
    // Look at a block (or any block in a "#tag") for a moment: proof you found one without taking it.
    const isTag = task.observe.startsWith('#')
    need(isTag ? 'blockTag' : 'item', task.observe, where)
    // FTB's ObservationTask: observe_type is the ObserveType ordinal (0 block, 1 block tag); timer in ticks.
    return { ...base, observe_type: isTag ? 1 : 0, timer: L(task.ticks ?? 20), to_observe: task.observe, type: 'observation' }
  }
  if (task.checkmark) return { ...base, type: 'checkmark' }
  // A game stage, which in this pack is a vanilla player tag (FTB Library's default stage provider): NPC dialog
  // buttons add them (/tag @initiator add <stage>), so talking to the right townsperson completes the task.
  if (task.stage) {
    if (!/^[a-z0-9_]+$/.test(task.stage)) problems.push(`${where}: stage "${task.stage}" must be lower case, digits and _`)
    return { ...base, stage: task.stage, type: 'gamestage' }
  }
  throw new Error(`${where}: unknown task ${JSON.stringify(task)}`)
}

// ---------------------------------------------------------------- rewards
// Every quest has a difficulty tier (book.tiers): the tier sets its XP, its coins and the reward table it rolls
// on once. A quest's own `reward` adds to that: more xp/coins, fixed `items` (the chapter prizes players can see
// coming), extra `tables` to roll, and `commands` (cape flags). `rolls` rolls the tier table more than once.

const tableIds = new Map((book.tables ?? []).map((t) => [t.key, hexId(`table/${t.key}`)]))

/** An item stack for a reward or table entry: an id string, or { id/item, count, components }. */
function stackData(it, where) {
  const stack = typeof it === 'string' ? { id: it } : { ...it, id: it.id ?? it.item }
  need('item', stack.id, where)
  return { count: stack.count ?? 1, id: stack.id, components: stack.components }
}

function tableReward(table, key, where) {
  if (!tableIds.has(table)) problems.push(`${where}: unknown reward table "${table}"`)
  return { id: hexId(key), table_id: hexLong(tableIds.get(table) ?? '0'), type: 'random' }
}

function rewardData(quest, key, where) {
  const reward = quest.reward ?? {}
  const tier = book.tiers[quest.tier ?? 1]
  if (!tier) problems.push(`${where}: unknown tier ${quest.tier}`)
  const xp = (tier?.xp ?? 0) + (reward.xp ?? 0)
  const coins = (tier?.coins ?? 0) + (reward.coins ?? 0)
  const out = []
  if (xp > 0) out.push({ id: hexId(`${key}/xp`), type: 'xp', xp })
  if (coins > 0) out.push({ id: hexId(`${key}/coins`), item: coinStack(coins), type: 'item' })
  for (const [i, it] of (reward.items ?? []).entries()) {
    out.push({ id: hexId(`${key}/item/${i}`), item: stackData(it, where), type: 'item' })
  }
  const rolls = [...Array.from({ length: reward.rolls ?? (tier?.table ? 1 : 0) }, () => tier.table), ...(reward.tables ?? [])]
  rolls.forEach((table, i) => out.push(tableReward(table, `${key}/roll/${i}`, where)))
  // A server command run for the player ({p} is their name), e.g. unlocking a cape. Runs with permissions.
  for (const [i, command] of (reward.commands ?? []).entries()) {
    out.push({ id: hexId(`${key}/command/${i}`), type: 'command', command, elevate_perms: true, silent: true })
  }
  // NPC questlines hand rewards over as you talk (the pack's default is claim-by-hand in the book).
  if (quest.auto) for (const r of out) r.auto = 'enabled'
  return out
}

/** reward_tables/<key>.snbt: weighted entries a `random` reward picks one of. Entries may roll another table. */
function tableData(table, order) {
  const where = `table ${table.key}`
  const id = tableIds.get(table.key)
  const rewards = table.entries.map((entry, i) => {
    const key = `table/${table.key}/${i}`
    const weight = F(entry.weight ?? 1)
    if (entry.table) return { ...tableReward(entry.table, key, where), weight }
    if (entry.xp) return { id: hexId(key), type: 'xp', weight, xp: entry.xp }
    // [item id or stack, count, weight]
    if (Array.isArray(entry)) {
      const stack = typeof entry[0] === 'string' ? { id: entry[0] } : entry[0]
      return { id: hexId(key), item: stackData({ ...stack, count: entry[1] }, where), type: 'item', weight: F(entry[2] ?? 1) }
    }
    return { id: hexId(key), item: stackData(entry, where), type: 'item', weight }
  })
  return {
    empty_weight: F(0),
    hide_tooltip: false,
    icon: iconData(table.icon, where),
    id,
    loot_size: 1,
    order_index: order,
    rewards,
    use_title: true
  }
}

// ---------------------------------------------------------------- chapter header
// Every chapter opens with a header row above its quests: the crest (art/process.mjs) and an info card
// saying what the chapter is for and what it unlocks. FTB draws the card's text onto a translucent panel
// image (text_on_image), scaled to fit the image, so the card is sized from its text to keep every
// chapter's text the same size.

const TEXT_UNIT = 0.024 // quest-map units per font pixel: about two thirds of UI text size at default zoom
const LINE_PX = 9 // Minecraft font line height
const CARD_WRAP_PX = 300 // wrap width for card text
const CARD_INSET = 3 // text_inset, percent of the card on each side
const CREST = 2
const CREST_GAP = 0.4 // between the crest and the card
const HEADER_GAP = 0.9 // air between the header and the first quests when it sits above them
const HEADER_CLEARANCE = 0.5 // minimum distance from the header to any quest or dependency line
// FTB opens a chapter centred on the middle of everything in it, at zoom 16. That shows about 13.8 x 8.6
// map units on a 720p/1440p/4K screen at automatic GUI scale (more at 1080p); a little less for margin.
const VIEW_W = 13.4
const VIEW_H = 8.2
// FTB sizes chapter images (and quests) in quest-size units but positions them in quest-spacing units,
// 24 vs 28 GUI px at the default spacing (QuestPanel.alignWidgets), so an image is drawn at 6/7 of its
// nominal size around its centre, while the bounds FTB centres the view on use the nominal size.
const IMAGE_SCALE = 6 / 7

function chapterCard(chapter) {
  // FTB starts a new line at every style change (TextUtils.processComponentWithPossibleNewlines), so
  // every line is one style: the "Unlocks:" label gets a line of its own.
  // A colour code keeps bold on in FTB text; only &r clears it.
  const lines = [' ', `&6&l${chapter.title}`]
  if (chapter.subtitle) lines.push(...wrap(chapter.subtitle, CARD_WRAP_PX, '&r&7'))
  if (chapter.about) lines.push(' ', ...wrap(chapter.about, CARD_WRAP_PX, '&r&f'))
  if (chapter.unlocks) lines.push(' ', `&r&e${chapter.unlocksLabel ?? 'Unlocks'}:`, ...wrap(chapter.unlocks, CARD_WRAP_PX, '&r&f'))
  lines.push(' ')
  const pad = 1 / (1 - (2 * CARD_INSET) / 100)
  return { lines, width: Math.max(...lines.map(textWidth)) * TEXT_UNIT * pad, height: lines.length * LINE_PX * TEXT_UNIT * pad }
}

const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const outside = (r, view) => Math.max(0, view.x0 - r.x0) + Math.max(0, r.x1 - view.x1) + Math.max(0, view.y0 - r.y0) + Math.max(0, r.y1 - view.y1)

/** Whether segment p→q passes through rectangle r (Liang–Barsky clipping). */
function segmentHits([px, py], [qx, qy], r) {
  let t0 = 0
  let t1 = 1
  const dx = qx - px
  const dy = qy - py
  for (const [p, q] of [
    [-dx, px - r.x0],
    [dx, r.x1 - px],
    [-dy, py - r.y0],
    [dy, r.y1 - py]
  ]) {
    if (p === 0) {
      if (q < 0) return false
    } else {
      const t = q / p
      if (p < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
      if (t0 > t1) return false
    }
  }
  return true
}

/**
 * Header images (crest + card) for a laid-out chapter, plus the card's text for the lang file.
 * The header goes above the first quests, left-aligned, unless the chapter would then be too big to open
 * with the card in view; then it moves to the free spot in the chapter's top half (clear of every quest
 * and line) that shows the most of the chapter while staying closest to that default spot. Crest beside
 * the card, or above it. A chapter still taller than the view gets a transparent spacer above the header,
 * which moves FTB's centred opening view up so the card is in it (the bottom of the tree starts off-screen).
 */
function chapterHeader(chapter, positions, deps) {
  const boxes = chapter.quests.map((q) => {
    const [x, y] = positions.get(q.key)
    const s = q.size ?? 1
    return { x0: x - s / 2, x1: x + s / 2, y0: y - s / 2, y1: y + s / 2 }
  })
  const segments = chapter.quests.flatMap((q) => (deps.get(q.key) ?? []).map((p) => [positions.get(p), positions.get(q.key)]))
  const tree = {
    x0: Math.min(...boxes.map((b) => b.x0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    y1: Math.max(...boxes.map((b) => b.y1))
  }
  const card = chapter.about || chapter.unlocks ? chapterCard(chapter) : null
  const crest = existsSync(path.join(emblemDir, `${chapter.key}.png`))
  if (!card && !crest) return { images: [], lang: {} }
  const cw = card?.width ?? 0
  const ch = card?.height ?? 0
  // Layout uses drawn sizes (see IMAGE_SCALE); the view bounds use nominal ones.
  const crestD = CREST * IMAGE_SCALE
  const cwD = cw * IMAGE_SCALE
  const chD = ch * IMAGE_SCALE
  const nominal = (r) => {
    const gx = ((r.x1 - r.x0) * (1 / IMAGE_SCALE - 1)) / 2
    const gy = ((r.y1 - r.y0) * (1 / IMAGE_SCALE - 1)) / 2
    return { x0: r.x0 - gx, x1: r.x1 + gx, y0: r.y0 - gy, y1: r.y1 + gy }
  }

  // Each shape places the drawn crest and card relative to the header's top-left corner.
  const shapes = []
  if (!crest) shapes.push({ w: cwD, h: chD, card: [0, 0], penalty: 0 })
  else if (!card) shapes.push({ w: crestD, h: crestD, crest: [0, 0], penalty: 0 })
  else {
    const h = Math.max(crestD, chD)
    shapes.push({ w: crestD + CREST_GAP + cwD, h, crest: [0, (h - crestD) / 2], card: [crestD + CREST_GAP, (h - chD) / 2], penalty: 0 })
    const w = Math.max(crestD, cwD)
    shapes.push({ w, h: crestD + CREST_GAP + chD, crest: [(w - crestD) / 2, 0], card: [(w - cwD) / 2, crestD + CREST_GAP], penalty: 2 })
  }

  let best = null
  for (const shape of shapes) {
    // Candidates on a 0.1 grid through the default spot, anywhere from left of the tree to right of it.
    const home = [tree.x0, tree.y0 - HEADER_GAP - shape.h]
    const step = 0.1
    for (let i = Math.floor((-shape.w - 1) / step); i <= Math.ceil((tree.x1 - tree.x0 + 1) / step); i++) {
      for (let j = Math.floor(-1.5 / step); j <= Math.ceil((tree.y1 - tree.y0 + HEADER_GAP + shape.h + 1) / step); j++) {
        const hx = home[0] + i * step
        const hy = home[1] + j * step
        const rect = { x0: hx, x1: hx + shape.w, y0: hy, y1: hy + shape.h }
        if (rect.y0 + rect.y1 > tree.y0 + tree.y1) continue // top half only: the card is read first
        const clear = { x0: rect.x0 - HEADER_CLEARANCE, x1: rect.x1 + HEADER_CLEARANCE, y0: rect.y0 - HEADER_CLEARANCE, y1: rect.y1 + HEADER_CLEARANCE }
        if (boxes.some((b) => overlaps(b, clear)) || segments.some(([p, q]) => segmentHits(p, q, clear))) continue
        const place = (at, w, h) => at && { x0: hx + at[0], x1: hx + at[0] + w, y0: hy + at[1], y1: hy + at[1] + h }
        const crestRect = place(shape.crest, crestD, crestD)
        const cardRect = place(shape.card, cwD, chD)
        const all = { ...tree }
        for (const n of [crestRect, cardRect].filter(Boolean).map(nominal)) {
          all.x0 = Math.min(all.x0, n.x0)
          all.x1 = Math.max(all.x1, n.x1)
          all.y0 = Math.min(all.y0, n.y0)
          all.y1 = Math.max(all.y1, n.y1)
        }
        const spacer = Math.max(0, all.y0 + all.y1 - VIEW_H - 2 * (cardRect ?? crestRect).y0)
        all.y0 -= spacer
        const cx = (all.x0 + all.x1) / 2
        const cy = (all.y0 + all.y1) / 2
        const view = { x0: cx - VIEW_W / 2, x1: cx + VIEW_W / 2, y0: cy - VIEW_H / 2, y1: cy + VIEW_H / 2 }
        const score =
          (cardRect ? outside(cardRect, view) : 0) * 1000 +
          (crestRect ? outside(crestRect, view) : 0) * 50 +
          (Math.max(0, all.x1 - all.x0 - VIEW_W) + Math.max(0, all.y1 - all.y0 - VIEW_H)) * 20 +
          Math.hypot(hx - home[0], hy - home[1]) +
          shape.penalty
        if (!best || score < best.score - 1e-9) best = { score, rect, crestRect, cardRect, spacer, top: all.y0 }
      }
    }
  }

  const { rect, crestRect, cardRect, spacer, top } = best
  const r = (v) => Math.round(v * 20) / 20
  const mid = (a, b) => r((a + b) / 2)
  const images = []
  if (spacer > 0) {
    images.push({
      height: D(0.1),
      id: hexId(`spacer/${chapter.key}`),
      image: 'lemursaucepacket:textures/quests/blank.png',
      rotation: D(0),
      width: D(0.1),
      x: D(mid(rect.x0, rect.x1)),
      y: D(r(top + 0.05))
    })
  }
  if (crestRect) {
    images.push({
      height: D(CREST),
      id: hexId(`crest/${chapter.key}`),
      image: `lemursaucepacket:textures/quests/${chapter.key}.png`,
      rotation: D(0),
      width: D(CREST),
      x: D(mid(crestRect.x0, crestRect.x1)),
      y: D(mid(crestRect.y0, crestRect.y1))
    })
  }
  const cardId = hexId(`card/${chapter.key}`)
  if (cardRect) {
    images.push({
      height: D(ch),
      id: cardId,
      image: 'lemursaucepacket:textures/quests/panel.png',
      rotation: D(0),
      text_h_align: 'start',
      text_inset: CARD_INSET,
      text_on_image: true,
      text_shadow: true,
      text_v_align: 'start',
      width: D(cw),
      x: D(mid(cardRect.x0, cardRect.x1)),
      y: D(mid(cardRect.y0, cardRect.y1))
    })
  }
  // FTB turns the two characters backslash + n into line breaks.
  return { images, lang: card ? { [`image.${cardId}.title`]: card.lines.join('\\n') } : {} }
}

const files = new Map()
// FTB Quests 2101.1.x reads one flat table per language: lang/<locale>.snbt, keys "<type>.<HEXID>.<field>".
const lang = { 'file.0000000000000001.title': book.title }

const groupIds = new Map(book.groups.map((g) => [g.key, hexId(`group/${g.key}`)]))
for (const g of book.groups) lang[`chapter_group.${groupIds.get(g.key)}.title`] = g.title

;(book.tables ?? []).forEach((table, order) => {
  files.set(`reward_tables/${table.key}.snbt`, tableData(table, order))
  lang[`reward_table.${tableIds.get(table.key)}.title`] = table.title
})

// Skills chapter milestones ({ milestone: { skill, level } } or { milestone: { total } }) → milestones.json.
// Lists rather than level-keyed objects: KubeJS reads JSON into Java maps, where a numeric key breaks Rhino.
const milestones = { levels: [], skills: [], total: [] }
const milestoneSkill = (skill, name) => {
  let entry = milestones.skills.find((s) => s.skill === skill)
  if (!entry) milestones.skills.push((entry = { skill, name, milestones: [] }))
  return entry
}

book.chapters.forEach((chapter, order) => {
  const chapterId = hexId(`chapter/${chapter.key}`)
  const where = `chapter ${chapter.key}`
  const questIds = new Map(chapter.quests.map((q) => [q.key, hexId(`quest/${chapter.key}/${q.key}`)]))
  const seen = new Set()
  for (const q of chapter.quests) {
    if (seen.has(q.key)) problems.push(`${where}: duplicate quest key "${q.key}"`)
    seen.add(q.key)
    for (const dep of q.after ?? []) if (!questIds.has(dep)) problems.push(`${where}/${q.key}: depends on unknown quest "${dep}"`)
  }
  const deps = reduceDependencies(chapter.quests)
  const positions = chapter.layout === 'grid' ? layoutGrid(chapter.quests) : layoutTree(chapter.quests, deps)
  if (preview) {
    // Lines FTB will not draw (hideLines) are not judged.
    const drawn = new Map(chapter.quests.map((q) => [q.key, q.hideLines ? [] : deps.get(q.key)]))
    const quality = layoutQuality(chapter.quests, drawn, new Map(chapter.quests.map((q) => [q.key, q.pos ?? positions.get(q.key)])))
    console.log(`  ${chapter.key}: ${quality.crossings} crossing(s)${quality.through.length ? `; ${quality.through.join(', ')}` : ''}`)
  }
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
    const firstItem = q.tasks.find((t) => t.item)
    const icon = iconData(q.icon ?? (firstItem && { id: firstItem.item, components: firstItem.components }), qWhere)
    chapterLang[`quest.${id}.title`] = q.title
    if (q.subtitle) chapterLang[`quest.${id}.quest_subtitle`] = q.subtitle
    if (q.desc) chapterLang[`quest.${id}.quest_desc`] = q.desc
    if (q.milestone) {
      if (q.milestone.skill) {
        milestoneSkill(q.milestone.skill, q.milestone.name ?? q.milestone.skill).milestones.push({ level: q.milestone.level, quest: id })
        if (!milestones.levels.includes(q.milestone.level)) milestones.levels.push(q.milestone.level)
      } else milestones.total.push({ level: q.milestone.total, quest: id })
    }
    return {
      dependencies: deps.get(q.key).map((k) => questIds.get(k)).filter(Boolean),
      hide_dependency_lines: q.hideLines ? true : undefined,
      hide_until_deps_complete: q.hidden ? true : undefined,
      // RuneScape style: a quest nobody has given you yet stays out of the book until its start task is done.
      invisible: q.invisible ? true : undefined,
      icon,
      id,
      min_required_dependencies: q.minDeps,
      optional: q.optional ? true : undefined,
      rewards: rewardData(q, `reward/${chapter.key}/${q.key}`, qWhere),
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
  const header = chapterHeader(chapter, new Map(chapter.quests.map((q) => [q.key, q.pos ?? positions.get(q.key)])), deps)
  const images = [...(chapter.images ?? []), ...header.images]
  Object.assign(chapterLang, header.lang)
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
// FTB rich text (FTB Library's TextComponentParser) rejects a whole string when '&' is not followed by a
// formatting code (so "Coin & Commerce" showed an error instead of the title), and '{' starts a
// substitution; a backslash makes either literal.
const ftbText = (v) => (Array.isArray(v) ? v.map(ftbText) : String(v).replace(/&(?![0-9a-fk-orz#])/g, '\\&').replace(/\{/g, '\\{'))
files.set('lang/en_us.snbt', Object.fromEntries(Object.entries(lang).map(([k, v]) => [k, ftbText(v)])))

const questCount = book.chapters.reduce((n, c) => n + c.quests.length, 0)
if (problems.length > 0) {
  console.error(`${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
milestones.levels.sort((a, b) => a - b)
for (const s of milestones.skills) s.milestones.sort((a, b) => a.level - b.level)
milestones.total.sort((a, b) => a.level - b.level)
const milestoneCount = milestones.skills.reduce((n, s) => n + s.milestones.length, 0) + milestones.total.length
console.log(
  `${book.chapters.length} chapters, ${questCount} quests, ${(book.tables ?? []).length} reward tables, ${milestoneCount} skill milestones, all ids valid (checked against ${path.basename(sourcePath)})`
)
if (checkOnly) process.exit(0)

rmSync(outDir, { recursive: true, force: true })
for (const [rel, data] of files) {
  const file = path.join(outDir, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, snbt(data) + '\n')
}
mkdirSync(path.dirname(milestonesFile), { recursive: true })
writeFileSync(milestonesFile, JSON.stringify(milestones, null, 2) + '\n')
console.log(`Wrote ${files.size} files to ${path.relative(root, outDir)} and ${path.relative(root, milestonesFile)}`)

if (preview) {
  const previewDir = path.join(root, 'quests', 'preview')
  mkdirSync(previewDir, { recursive: true })
  for (const chapter of book.chapters) {
    writeFileSync(path.join(previewDir, `${chapter.key}.svg`), chapterSvg(files.get(`chapters/${chapter.key}.snbt`), lang, emblemDir))
  }
  console.log(`Previews in ${path.relative(root, previewDir)}`)
}
