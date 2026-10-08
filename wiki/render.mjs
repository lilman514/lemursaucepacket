// The atlas on the wiki's pages (publish/docs.mjs calls it): a page marks a region with
//   <!-- atlas:biomes:forests -->  ...  <!-- /atlas -->     (or atlas:creatures:all, atlas:structures:dungeons_arise)
// and the region becomes a grid of cards from wiki/atlas.json: a picture (docs/images/atlas/<kind>/<id>.jpg once the
// photo session has taken it; until then a biome is painted from its own colours by wiki/scene.mjs), the name, the
// mod, the climate, what grows there, and the creatures and structures that set it apart, all linked to each other.
// Whatever wiki/build.mjs wrote inside the region (a plain table, for GitBook) is replaced.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BIOME_NOTES, CATEGORY_PAGES, CREATURE_NOTES, MOD_NAMES, STRUCTURE_GROUPS, STRUCTURE_NAMES } from './notes.mjs'
import { scene } from './scene.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const atlasFile = path.join(root, 'wiki', 'atlas.json')
export const atlas = existsSync(atlasFile) ? JSON.parse(readFileSync(atlasFile, 'utf8')) : { biomes: [], creatures: [], structures: [], mods: {} }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
export const key = (id) => id.replace(':', '__').replace(/\//g, '_')
const anchor = (prefix, id) => `${prefix}-${id.replace(':', '-').replace(/\//g, '-')}`
/** A thing's photo, once the photo session has taken it (wiki/photos/collect.mjs writes .webp). */
export const picture = (kind, id) => {
  for (const ext of ['webp', 'jpg']) {
    const rel = `images/atlas/${kind}/${key(id)}.${ext}`
    if (existsSync(path.join(root, 'docs', rel))) return rel
  }
  return null
}
export const modName = (ns) => MOD_NAMES[ns] ?? atlas.mods[ns] ?? ns

const biomeById = new Map(atlas.biomes.map((b) => [b.id, b]))
const creatureById = new Map(atlas.creatures.map((c) => [c.id, c]))
const structureById = new Map(atlas.structures.map((s) => [s.id, s]))
for (const s of atlas.structures) if (STRUCTURE_NAMES[s.id]) s.name = STRUCTURE_NAMES[s.id]

/** Where a biome's card lives: its category's page. */
export const biomePage = (b) => (b.dimension === 'nether' ? 'nether.html' : b.dimension === 'end' ? 'end.html' : `biomes-${b.category}.html`)
export const biomeHref = (id) => {
  const b = biomeById.get(id)
  return b ? `${biomePage(b)}#${anchor('b', id)}` : null
}
const creatureHref = (id) => `creatures.html#${anchor('c', id)}`
const structureHref = (id) => {
  const s = structureById.get(id)
  return s ? `structures.html#${anchor('s', s.group ?? id)}` : null
}

// ---------------------------------------------------------------- what sets a biome apart

// A creature or structure found in most biomes of a dimension says nothing about any one of them.
const ubiquity = (() => {
  const dims = {}
  for (const b of atlas.biomes) (dims[b.dimension] ??= []).push(b)
  const share = { creatures: new Map(), structures: new Map() }
  for (const [dim, list] of Object.entries(dims)) {
    for (const kind of ['creatures', 'structures']) {
      const counts = new Map()
      for (const b of list) for (const x of b[kind]) counts.set(x, (counts.get(x) ?? 0) + 1)
      for (const [x, n] of counts) share[kind].set(`${dim}|${x}`, n / list.length)
    }
  }
  return share
})()
const distinctive = (b, kind, limit, skip = () => false) =>
  b[kind]
    .filter((x) => !skip(x) && (ubiquity[kind].get(`${b.dimension}|${x}`) ?? 0) < (kind === 'creatures' ? 0.35 : 0.2))
    .sort((x, y) => (ubiquity[kind].get(`${b.dimension}|${x}`) ?? 0) - (ubiquity[kind].get(`${b.dimension}|${y}`) ?? 0))
    .slice(0, limit)

export function climate(b) {
  if (b.dimension !== 'overworld') return []
  const t = b.climate.temperature
  const out = [t < 0.15 ? 'Freezing' : t < 0.4 ? 'Cold' : t < 0.9 ? 'Temperate' : t < 1.5 ? 'Warm' : 'Hot']
  if (!b.climate.precipitation) out.push('No rain')
  else if (t < 0.15) out.push('Snow')
  else out.push(b.climate.downfall >= 0.7 ? 'Wet' : b.climate.downfall >= 0.35 ? 'Rain' : 'Dry')
  return out
}

const KIND = {
  monster: ['Hostile', 'hostile'],
  creature: ['Animal', 'passive'],
  ambient: ['Ambient', ''],
  water_creature: ['Sea life', 'water'],
  water_ambient: ['Fish', 'water'],
  underground_water_creature: ['Cave water', 'water'],
  axolotls: ['Axolotl', 'water'],
  misc: ['Other', '']
}
const creatureKind = (c) => {
  const cat = c.categories[0]
  if (cat && KIND[cat]) return KIND[cat]
  // Mods that spawn in code don't say: guess from the name.
  if (/shark|whale|fish|ray|clam|isopod|jellyfish|starfish|piranha|bass|catfish|anglerfish|blobfish/.test(c.id)) return KIND.water_creature
  if (/creeper|scorpion|mauler|iceologer|illusioner|zombie|skeleton|spider/.test(c.id)) return KIND.monster
  return KIND.creature
}

const links = (ids, href, nameOf) =>
  ids
    .map((id) => {
      const h = href(id)
      const n = esc(nameOf(id))
      return h ? `<a href="${h}">${n}</a>` : n
    })
    .join(', ')
const nameOfBiome = (id) => biomeById.get(id)?.name ?? id
const nameOfCreature = (id) => creatureById.get(id)?.name ?? id
const nameOfStructure = (id) => {
  const s = structureById.get(id)
  return s ? s.groupName ?? s.name : id
}

// ---------------------------------------------------------------- cards

const painted = (b, opts) => `<span class="painted" data-label="Photo coming soon">${scene(b, opts)}</span>`
/** A card's name and tags; without a photo, the emblem of what it is beside them (the card stays compact). */
const head = (name, tags, emblem, cls) =>
  `<div class="atlas-head">${emblem ? `<span class="atlas-emblem ${cls}"><img src="assets/emblems/${emblem}.webp" alt="" loading="lazy" decoding="async"></span>` : ''}<div><h3>${esc(name)}</h3><p class="tags">${tags}</p></div></div>`

const groupOf = (id) => structureById.get(id)?.group ?? id
/** The share of the Overworld's biomes a creature (or a structure group) turns up in. */
const overworldBiomes = atlas.biomes.filter((b) => b.dimension === 'overworld')
const everywhereCache = new Map()
const everywhere = (kind, x) => {
  const k = `${kind}|${x}`
  if (!everywhereCache.has(k)) everywhereCache.set(k, overworldBiomes.filter((b) => (kind === 'structures' ? b.structures.some((id) => groupOf(id) === x) : b.creatures.includes(x))).length / overworldBiomes.length)
  return everywhereCache.get(k)
}
const leadOf = (group) => atlas.structures.find((st) => (st.group ?? st.id) === group)?.id ?? group

function biomeCard(b, common = { creatures: new Set(), structures: new Set() }) {
  const pic = picture('biomes', b.id)
  const creatures = distinctive(b, 'creatures', 6, (x) => common.creatures.has(x))
  const structures = distinctive(b, 'structures', 5, (x) => common.structures.has(groupOf(x)))
  const note = BIOME_NOTES[b.id]
  const mod = modName(b.mod)
  const tags = [`<span class="tag mod">${esc(mod)}</span>`, ...climate(b).map((t) => `<span class="tag">${t}</span>`)]
  const search = [b.name, mod, b.category, ...climate(b), ...b.plants, ...creatures.map(nameOfCreature), ...structures.map(nameOfStructure)].join(' ').toLowerCase()
  return (
    `<article class="atlas-card" id="${anchor('b', b.id)}" data-mod="${b.mod}" data-search="${esc(search)}">` +
    `<div class="atlas-pic">${pic ? `<img src="${pic}" alt="${esc(b.name)}" loading="lazy" decoding="async">` : painted(b)}</div>` +
    `<div class="atlas-body">${head(b.name, tags.join(''))}` +
    (note ? `<p class="atlas-note">${esc(note)}</p>` : '') +
    '<dl>' +
    (b.plants.length ? `<dt>Grows here</dt><dd>${esc(b.plants.join(', '))}</dd>` : '') +
    (creatures.length ? `<dt>Creatures</dt><dd>${links(creatures, creatureHref, nameOfCreature)}</dd>` : '') +
    (structures.length ? `<dt>Structures</dt><dd>${links([...new Set(structures.map((s) => structureById.get(s)?.group ?? s))].map((g) => atlas.structures.find((s) => (s.group ?? s.id) === g)?.id ?? g), structureHref, nameOfStructure)}</dd>` : '') +
    '</dl></div></article>'
  )
}

function creatureCard(c) {
  const pic = picture('creatures', c.id)
  const [kind, cls] = creatureKind(c)
  const mod = modName(c.mod)
  const where = c.biomes.map((id) => biomeById.get(id)).filter(Boolean)
  const cats = [...new Set(where.map((b) => (b.dimension === 'overworld' ? CATEGORY_PAGES[b.category]?.short ?? b.category : b.dimension === 'nether' ? 'The Nether' : 'The End')))]
  const note = CREATURE_NOTES[c.id]
  const some = where.slice(0, 8).map((b) => b.id)
  const search = [c.name, mod, kind, ...cats].join(' ').toLowerCase()
  return (
    `<article class="atlas-card${pic ? '' : ' compact'}" id="${anchor('c', c.id)}" data-mod="${c.mod}" data-kind="${cls || 'other'}" data-search="${esc(search)}">` +
    (pic ? `<div class="atlas-pic"><img src="${pic}" alt="${esc(c.name)}" loading="lazy" decoding="async"></div>` : '') +
    `<div class="atlas-body">${head(c.name, `<span class="tag mod">${esc(mod)}</span><span class="tag ${cls}">${kind}</span>`, pic ? null : 'bestiary', `ph-${cls || 'other'}`)}` +
    (note ? `<p class="atlas-note">${esc(note)}</p>` : '') +
    `<dl><dt>Spawns in</dt><dd>${where.length > 8 ? `${where.length} biomes: ${esc(cats.join(', '))}. Among them ` : ''}${links(some, biomeHref, nameOfBiome)}${where.length > 8 ? '…' : ''}</dd></dl></div></article>`
  )
}

const DIMENSION_NAMES = { nether: 'the Nether', end: 'the End' }
const biomesIn = (dim) => atlas.biomes.filter((b) => b.dimension === dim).length
/** Where a structure turns up, in a few words (a dimension, most of the Overworld, its biome groups), and whether
 *  its biomes are few enough to name one by one. */
function scopeOf(s) {
  const where = s.biomes.map((id) => biomeById.get(id)).filter(Boolean)
  const dims = [...new Set(where.map((b) => b.dimension))]
  const cats = [...new Set(where.filter((b) => b.dimension === 'overworld').map((b) => CATEGORY_PAGES[b.category]?.short ?? b.category))]
  const other = dims.length === 1 && dims[0] !== 'overworld' ? dims[0] : null
  const share = other ? where.length / biomesIn(other) : 0
  const scope = other
    ? share === 1
      ? `Throughout ${DIMENSION_NAMES[other]}`
      : share >= 0.6
        ? `Most of ${DIMENSION_NAMES[other]} (${where.length} of ${biomesIn(other)} biomes)`
        : DIMENSION_NAMES[other].replace(/^t/, 'T')
    : cats.length > 6
      ? `Most of the Overworld (${where.length} biomes)`
      : cats.join(', ')
  return { where, dims, cats, scope, listed: where.length <= 10 && share < 0.6 && cats.length <= 6 }
}

function structureCard(s) {
  const pic = picture('structures', s.id)
  const mod = modName(s.mod)
  const { where, dims, scope, listed } = scopeOf(s)
  const search = [s.groupName ?? s.name, mod, scope, ...(s.variants ?? [])].join(' ').toLowerCase()
  return (
    `<article class="atlas-card${pic ? '' : ' compact'}" id="${anchor('s', s.group ?? s.id)}" data-mod="${s.mod}" data-search="${esc(search)}">` +
    (pic ? `<div class="atlas-pic"><img src="${pic}" alt="${esc(s.name)}" loading="lazy" decoding="async"></div>` : '') +
    `<div class="atlas-body">${head(s.groupName ?? s.name, `<span class="tag mod">${esc(mod)}</span>${s.variants?.length > 1 ? `<span class="tag">${s.variants.length} kinds</span>` : ''}`, pic ? null : 'banners', `ph-${dims.length === 1 ? dims[0] : 'overworld'}`)}` +
    `<dl><dt>Found in</dt><dd>${esc(scope)}${listed ? `: ${links(where.map((b) => b.id), biomeHref, nameOfBiome)}` : ''}</dd>` +
    (s.variants?.length > 1 ? `<dt>Kinds</dt><dd>${esc(s.variants.join(', '))}</dd>` : '') +
    '</dl></div></article>'
  )
}

// ---------------------------------------------------------------- structures grouped (a mod's twelve mineshafts are one card)

for (const [mod, groups] of Object.entries(STRUCTURE_GROUPS)) {
  for (const [group, { name, match }] of Object.entries(groups)) {
    const members = atlas.structures.filter((s) => s.mod === mod && match.test(s.id.split(':')[1]))
    if (!members.length) continue
    const lead = members[0]
    lead.group = `${mod}:${group}`
    lead.groupName = name
    lead.variants = members.map((m) => m.name)
    lead.biomes = [...new Set(members.flatMap((m) => m.biomes))].sort()
    for (const m of members.slice(1)) {
      m.group = lead.group
      m.hidden = true
    }
  }
}

// ---------------------------------------------------------------- page banners

/** Each biome page's signature biome: its banner, and its group's card on the Biomes page. */
const HEROES = {
  'biomes.md': 'minecraft:cherry_grove',
  'biomes-forests.md': 'regions_unexplored:autumnal_maple_forest',
  'biomes-plains.md': 'minecraft:sunflower_plains',
  'biomes-snowy.md': 'minecraft:snowy_taiga',
  'biomes-mountains.md': 'minecraft:jagged_peaks',
  'biomes-deserts.md': 'minecraft:badlands',
  'biomes-jungles.md': 'minecraft:jungle',
  'biomes-savannas.md': 'minecraft:savanna',
  'biomes-wetlands.md': 'minecraft:mangrove_swamp',
  'biomes-oceans.md': 'minecraft:warm_ocean',
  'biomes-caves.md': 'minecraft:lush_caves',
  'nether.md': 'minecraft:crimson_forest',
  'end.md': 'minecraft:the_end'
}
/** A page's banner: its signature biome's photo once there is one, its painting until then. */
export function banner(file) {
  const b = biomeById.get(HEROES[file])
  if (!b) return null
  const photo = picture('biomes', b.id)
  return photo ? { cover: photo } : { svg: scene(b, { w: 640, h: 200, prefix: 'hero-' }) }
}

// ---------------------------------------------------------------- regions

const HINTS = { biomes: 'Filter by name, tree, creature…', creatures: 'Filter by name or where it lives…', structures: 'Filter by name, mod or where…' }
function tools(id, list, kinds, kind) {
  const mods = [...new Set(list.map((x) => x.mod))].sort((a, b) => modName(a).localeCompare(modName(b)))
  // A few mods are chips; a long list of them is a menu, so the bar stays one line.
  const n = (m) => list.filter((x) => x.mod === m).length
  const chips =
    mods.length > 8
      ? [`<select data-key="mod" aria-label="Mod"><option value="">All ${mods.length} mods</option>${mods.map((m) => `<option value="${m}">${esc(modName(m))} (${n(m)})</option>`).join('')}</select>`]
      : [`<button class="chip" type="button" data-key="mod" data-value="" aria-pressed="true">All mods</button>`, ...mods.map((m) => `<button class="chip" type="button" data-key="mod" data-value="${m}" aria-pressed="false">${esc(modName(m))}</button>`)]
  const kindChips = kinds ? [`<button class="chip" type="button" data-key="kind" data-value="" aria-pressed="true">Every kind</button>`, ...kinds.map(([v, label]) => `<button class="chip" type="button" data-key="kind" data-value="${v}" aria-pressed="false">${label}</button>`)] : []
  return `<div class="atlas-tools" data-atlas="${id}"><input type="search" placeholder="${HINTS[kind]}" aria-label="Filter">${mods.length > 1 ? chips.join('') : ''}${kindChips.join('')}<span class="atlas-count"></span></div>`
}

const dimOf = (s) => {
  const dims = new Set(s.biomes.map((b) => biomeById.get(b)?.dimension))
  return dims.size === 1 ? [...dims][0] : 'overworld'
}
/** What a region lists: biomes of a group or dimension, creatures, structures (all, one mod's, one dimension's). */
function listOf(kind, filter) {
  if (kind === 'biomes') return atlas.biomes.filter((b) => (filter === 'nether' || filter === 'end' ? b.dimension === filter : filter === 'all' ? true : b.dimension === 'overworld' && b.category === filter))
  if (kind === 'creatures') return atlas.creatures.filter((c) => filter === 'all' || c.mod === filter)
  if (kind === 'structures')
    return atlas.structures
      .filter((s) => !s.hidden && (filter === 'all' || s.mod === filter || ((filter === 'nether' || filter === 'end' || filter === 'overworld') && dimOf(s) === filter)))
      .sort((a, b) => (a.groupName ?? a.name).localeCompare(b.groupName ?? b.name))
  return []
}
const groupName = (b) => (b.dimension === 'overworld' ? CATEGORY_PAGES[b.category]?.short ?? b.category : b.dimension === 'nether' ? 'The Nether' : 'The End')

let regionCount = 0
/** The HTML for one atlas region, and the search entries for its cards. */
export function renderRegion(kind, filter, page) {
  const id = `atlas-${++regionCount}`
  const list = listOf(kind, filter)
  let cards = []
  let entries = []
  let lead = ''
  if (kind === 'biomes') {
    // What most of these biomes share is said once, above them, and left off each card.
    const common = { creatures: new Set(), structures: new Set() }
    if (list.length >= 6 && filter !== 'all' && filter !== 'nether' && filter !== 'end')
      for (const k of ['creatures', 'structures']) {
        const counts = new Map()
        for (const b of list) for (const x of new Set(k === 'structures' ? b[k].map(groupOf) : b[k])) counts.set(x, (counts.get(x) ?? 0) + 1)
        // Shared by most of these but not by most of the Overworld: what this kind of land is known for.
        for (const [x, n] of counts) if (n / list.length >= 0.6 && everywhere(k, x) < 0.5) common[k].add(x)
      }
    const row = (label, ids, href, nameOf) => (ids.length ? `<div><dt>${label}</dt><dd>${links(ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b))), href, nameOf)}</dd></div>` : '')
    const both = row('Living in most of them', [...common.creatures], creatureHref, nameOfCreature) + row('Found in most of them', [...common.structures].map(leadOf), structureHref, nameOfStructure)
    if (both) lead = `<dl class="atlas-common">${both}</dl>`
    cards = list.map((b) => biomeCard(b, common))
    entries = list.map((b) => ({ s: b.name, x: [modName(b.mod), ...climate(b), b.plants.join(', '), BIOME_NOTES[b.id] ?? ''].filter(Boolean).join(' · '), u: `${page}#${anchor('b', b.id)}` }))
  } else if (kind === 'creatures') {
    cards = list.map(creatureCard)
    entries = list.map((c) => ({ s: c.name, x: `${modName(c.mod)} · ${creatureKind(c)[0]} · ${CREATURE_NOTES[c.id] ?? `spawns in ${c.biomes.length} biomes`}`, u: `${page}#${anchor('c', c.id)}` }))
  } else if (kind === 'structures') {
    cards = list.map(structureCard)
    entries = list.map((s) => ({ s: s.groupName ?? s.name, x: `${modName(s.mod)}${s.variants?.length > 1 ? ` · ${s.variants.join(', ')}` : ''}`, u: `${page}#${anchor('s', s.group ?? s.id)}` }))
  } else if (kind === 'categories') {
    // The Overworld's biome groups, each a card with a strip of its biomes' colours (or its first photo).
    const html = Object.entries(CATEGORY_PAGES)
      .map(([cat, page]) => {
        const members = atlas.biomes.filter((b) => b.dimension === 'overworld' && b.category === cat)
        if (!members.length) return ''
        const lead = biomeById.get(HEROES[page.file]) ?? members[0]
        const photo = picture('biomes', lead.id) ?? members.map((b) => picture('biomes', b.id)).find(Boolean)
        const mods = [...new Set(members.map((b) => modName(b.mod)))].join(', ')
        return `<a class="card" href="${page.file.replace(/\.md$/, '.html')}">${photo ? `<img class="cover" src="${photo}" alt="" loading="lazy">` : `<div class="cover painted">${scene(lead, { prefix: 'cat-' })}</div>`}<strong>${esc(page.title)}</strong><span>${members.length} biomes · ${esc(mods)}</span></a>`
      })
      .join('')
    return { html: `<div class="cards">${html}</div>`, entries: [] }
  } else if (kind === 'index') {
    // Every biome A to Z, folded away: name, where, mod, climate.
    const rows = atlas.biomes
      .map((b) => `<tr><td><a href="${biomeHref(b.id)}">${esc(b.name)}</a></td><td>${esc(groupName(b))}</td><td>${esc(modName(b.mod))}</td><td>${esc(climate(b).join(', '))}</td></tr>`)
      .join('')
    return { html: `<details><summary>All ${atlas.biomes.length} biomes</summary><div class="table-wrap"><table><thead><tr><th>Biome</th><th>Group</th><th>From</th><th>Climate</th></tr></thead><tbody>${rows}</tbody></table></div></details>`, entries: [] }
  }
  if (!cards.length) return { html: '<p class="atlas-empty">Nothing here in this pack.</p>', entries: [] }
  const kinds = kind === 'creatures' ? [['hostile', 'Hostile'], ['passive', 'Animals'], ['water', 'Sea life']] : null
  return { html: `${list.length > 6 ? tools(id, list, kinds, kind) : ''}${lead}<div class="atlas" id="${id}">${cards.join('')}</div>`, entries }
}

// ---------------------------------------------------------------- the same regions as plain markdown

const cell = (x) => String(x).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n')
const few = (list, n) => (list.length > n ? `${list.slice(0, n).join(', ')}…` : list.join(', '))

/** One region as markdown: a table of what it lists (the wiki's cards replace it; GitBook and the book read it). */
export function markdownRegion(kind, filter) {
  const list = listOf(kind, filter)
  if (kind === 'biomes') {
    if (filter === 'nether' || filter === 'end') return table(['Biome', 'From', 'About'], list.map((b) => [b.name, modName(b.mod), BIOME_NOTES[b.id] ?? '']))
    return table(['Biome', 'From', 'Climate', 'Grows here'], list.map((b) => [b.name, modName(b.mod), climate(b).join(', '), few(b.plants, 4)]))
  }
  if (kind === 'creatures')
    return table(['Creature', 'From', 'Kind', 'Lives in'], list.map((c) => [c.name, modName(c.mod), creatureKind(c)[0], few([...new Set(c.biomes.map((id) => biomeById.get(id)).filter(Boolean).map(groupName))], 4)]))
  if (kind === 'structures') return table(['Structure', 'From', 'Found in'], list.map((s) => [s.groupName ?? s.name, modName(s.mod), scopeOf(s).scope]))
  if (kind === 'categories')
    return Object.entries(CATEGORY_PAGES)
      .map(([cat, p]) => [p, atlas.biomes.filter((b) => b.dimension === 'overworld' && b.category === cat).length])
      .filter(([, n]) => n)
      .map(([p, n]) => `- [${p.title}](${p.file}): ${n} biomes`)
      .join('\n')
  if (kind === 'index') {
    // Every biome, linked to its page: for GitBook (the book has the group pages, so it skips this).
    const rows = atlas.biomes.map((b) => [`[${b.name}](${biomePage(b).replace(/\.html$/, '.md')})`, groupName(b), modName(b.mod), climate(b).join(', ')])
    return ['<!-- book:skip -->', '', table(['Biome', 'Group', 'From', 'Climate'], rows), '', '<!-- book:end -->'].join('\n')
  }
  return ''
}

/** Replaces every atlas region in a page's markdown with its HTML (kept aside, so marked leaves it alone). */
export function expandAtlas(markdown, page, stash) {
  const entries = []
  const text = markdown.replace(/<!-- atlas:(\w+):([\w-]+) -->[\s\S]*?<!-- \/atlas -->/g, (_, kind, filter) => {
    const r = renderRegion(kind, filter, page)
    entries.push(...r.entries)
    stash.push(r.html)
    return `\n\n<div data-stash="${stash.length - 1}"></div>\n\n`
  })
  return { text, entries }
}
