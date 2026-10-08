#!/usr/bin/env node
// The wiki's atlas: every biome, creature and structure the pack's world can have, read from the game's own data, so
// the Biomes, Creatures and Structures pages never guess. Run locally (CI has no jars):
//
//   node wiki/atlas.mjs [--mods C:\LemurSaucePacket-Server\mods] [--vanilla <server extra jar>] [--client <client jar>]
//
// The client jar (the launcher's, by default) only lends its grass and foliage colour maps: most biomes don't name
// their grass colour, the game reads it off those maps by temperature and rainfall, and the wiki paints with it.
//
// Reads every jar's data/ (biomes, biome tags, NeoForge biome modifiers, structures, structure sets), the pack's own
// datapack overrides (pack/kubejs/data), each mod's display name and its en_us names, and writes wiki/atlas.json:
//   biomes:     id, name, mod, dimension, category, climate (temperature, downfall, precipitation), colours,
//               the creatures that spawn there and the structures that can generate there;
//   creatures:  id, name, mod, spawn category, the biomes they spawn in;
//   structures: id, name, mod, the biomes they can generate in.
// Creature spawns come from biome files, neoforge:add_spawns / remove_spawns modifiers, and the tag conventions of
// mods that spawn in code (Naturalist's has_<animal> minus blacklist_<animal>, Friends & Foes' has_<mob>).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, unzlibSync, strFromU8 } from 'fflate'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const modsDir = arg('mods', 'C:\\LemurSaucePacket-Server\\mods')
const libraries = path.join(path.dirname(modsDir), 'libraries', 'net', 'minecraft', 'server')
const vanillaJar =
  arg('vanilla') ??
  (() => {
    for (const dir of existsSync(libraries) ? readdirSync(libraries) : []) {
      const extra = path.join(libraries, dir, `server-${dir}-extra.jar`)
      if (existsSync(extra)) return extra
    }
    throw new Error(`No vanilla server data jar under ${libraries}: pass --vanilla`)
  })()
const clientJar = arg('client', path.join(process.env.APPDATA ?? '', 'LemurSaucePacket', 'minecraft', 'versions', '1.21.1', '1.21.1.jar'))

// ---------------------------------------------------------------- the grass and foliage colour maps

/** An 8-bit PNG's pixels (no dependencies: inflate, then undo each row's filter). */
function decodePng(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = 8
  let width = 0
  let height = 0
  let type = 0
  let palette = null
  const idat = []
  while (pos < bytes.length) {
    const len = dv.getUint32(pos)
    const name = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8))
    const data = bytes.subarray(pos + 8, pos + 8 + len)
    if (name === 'IHDR') {
      width = dv.getUint32(pos + 8)
      height = dv.getUint32(pos + 12)
      if (bytes[pos + 16] !== 8) throw new Error('only 8-bit PNGs')
      type = bytes[pos + 17]
    } else if (name === 'PLTE') palette = data
    else if (name === 'IDAT') idat.push(data)
    else if (name === 'IEND') break
    pos += 12 + len
  }
  const z = new Uint8Array(idat.reduce((n, d) => n + d.length, 0))
  idat.reduce((o, d) => (z.set(d, o), o + d.length), 0)
  const raw = unzlibSync(z)
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]
  const stride = width * bpp
  const px = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0
      const b = y ? px[(y - 1) * stride + x] : 0
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0
      let v = raw[y * (stride + 1) + 1 + x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[y * stride + x] = v & 255
    }
  }
  return (x, y) => {
    const i = (y * width + x) * bpp
    if (type === 3) return (palette[px[i] * 3] << 16) | (palette[px[i] * 3 + 1] << 8) | palette[px[i] * 3 + 2]
    if (type === 0 || type === 4) return px[i] * 0x10101
    return (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]
  }
}
const colourMaps = (() => {
  if (!existsSync(clientJar)) {
    console.warn(`atlas: no client jar at ${clientJar} (pass --client): biomes keep only the colours they name`)
    return null
  }
  const zip = unzipSync(new Uint8Array(readFileSync(clientJar)), { filter: (f) => /^assets\/minecraft\/textures\/colormap\/(grass|foliage)\.png$/.test(f.name) })
  return { grass: decodePng(zip['assets/minecraft/textures/colormap/grass.png']), foliage: decodePng(zip['assets/minecraft/textures/colormap/foliage.png']) }
})()
/** The game's GrassColor/FoliageColor.get: x from temperature, y from rainfall times temperature. */
const fromMap = (map, temperature, downfall) => {
  const t = Math.min(1, Math.max(0, temperature))
  const d = Math.min(1, Math.max(0, downfall)) * t
  return map(Math.trunc((1 - t) * 255), Math.trunc((1 - d) * 255))
}

// ---------------------------------------------------------------- reading every data source

/** Each source: its files as path -> text, filtered to what the atlas reads. */
const WANTED = /^(data\/[^/]+\/(worldgen\/(biome|structure|structure_set|placed_feature|configured_feature)\/|tags\/worldgen\/biome\/|neoforge\/biome_modifier\/)[^]*\.json|assets\/[^/]+\/lang\/en_us\.json|META-INF\/neoforge\.mods\.toml)$/
function readJar(file) {
  const out = new Map()
  const zip = unzipSync(new Uint8Array(readFileSync(file)), { filter: (f) => WANTED.test(f.name) })
  for (const [name, bytes] of Object.entries(zip)) out.set(name, strFromU8(bytes))
  return out
}
function readDir(dir, prefix) {
  const out = new Map()
  const walk = (d, rel) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(p, r)
      else if (WANTED.test(`${prefix}/${r}`)) out.set(`${prefix}/${r}`, readFileSync(p, 'utf8'))
    }
  }
  if (existsSync(dir)) walk(dir, '')
  return out
}

const sources = [{ name: 'minecraft', files: readJar(vanillaJar) }]
for (const f of readdirSync(modsDir).filter((f) => f.endsWith('.jar')).sort()) sources.push({ name: f, files: readJar(path.join(modsDir, f)) })
// The pack's own datapack last: it overrides (pack/kubejs/data is loaded as a datapack by KubeJS).
sources.push({ name: 'pack', files: readDir(path.join(root, 'pack', 'kubejs', 'data'), 'data') })

const json = (text, where) => {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    try {
      // A few mods ship JSON with comments or trailing commas.
      return JSON.parse(text.replace(/\/\/[^\n]*/g, '').replace(/,(\s*[}\]])/g, '$1'))
    } catch (e) {
      console.warn(`atlas: skipping ${where}: ${e.message}`)
      return null
    }
  }
}
const idOf = (file, kind) => {
  const m = new RegExp(`^data/([^/]+)/${kind}/(.+)\\.json$`).exec(file)
  return m ? `${m[1]}:${m[2]}` : null
}

const biomeDefs = new Map()
const placedDefs = new Map()
const configuredDefs = new Map()
const structureDefs = new Map()
const structureSets = new Map() // set id -> definition: a later source's file replaces an earlier one's
const tagFiles = new Map() // tag id -> [{ replace, values }]
const modifiers = []
const lang = {}
const modNames = { minecraft: 'Minecraft' }
for (const src of sources) {
  for (const [file, text] of src.files) {
    if (file.endsWith('neoforge.mods.toml')) {
      // [[mods]] modId = "x" ... displayName = "Y"
      for (const block of text.split(/\[\[mods\]\]/).slice(1)) {
        const id = /modId\s*=\s*"([^"]+)"/.exec(block)?.[1]
        const name = /displayName\s*=\s*"([^"]+)"/.exec(block)?.[1]
        if (id && name && !modNames[id]) modNames[id] = name
      }
      continue
    }
    if (file.endsWith('/lang/en_us.json')) {
      Object.assign(lang, json(text, `${src.name}:${file}`) ?? {})
      continue
    }
    let id
    if ((id = idOf(file, 'worldgen/biome'))) {
      const d = json(text, file)
      if (d) biomeDefs.set(id, d)
    } else if ((id = idOf(file, 'worldgen/placed_feature'))) {
      const d = json(text, file)
      if (d) placedDefs.set(id, d)
    } else if ((id = idOf(file, 'worldgen/configured_feature'))) {
      const d = json(text, file)
      if (d) configuredDefs.set(id, d)
    } else if ((id = idOf(file, 'worldgen/structure'))) {
      const d = json(text, file)
      if (d) structureDefs.set(id, d)
    } else if ((id = idOf(file, 'worldgen/structure_set'))) {
      const d = json(text, file)
      if (d) structureSets.set(id, d)
    } else if ((id = idOf(file, 'tags/worldgen/biome'))) {
      const d = json(text, file)
      if (d) {
        if (d.replace) tagFiles.set(id, [])
        if (!tagFiles.has(id)) tagFiles.set(id, [])
        tagFiles.get(id).push(d.values ?? [])
      }
    } else if ((id = idOf(file, 'neoforge/biome_modifier'))) {
      const d = json(text, file)
      if (d) modifiers.push({ id, ...d })
    }
  }
}

// ---------------------------------------------------------------- biome tags

const tagCache = new Map()
function tag(tagId, seen = new Set()) {
  if (tagCache.has(tagId)) return tagCache.get(tagId)
  const out = new Set()
  if (seen.has(tagId)) return out
  seen.add(tagId)
  for (const values of tagFiles.get(tagId) ?? []) {
    for (const v of values) {
      const ref = typeof v === 'string' ? v : v?.id
      if (!ref) continue
      if (ref.startsWith('#')) for (const b of tag(ref.slice(1), seen)) out.add(b)
      else out.add(ref)
    }
  }
  tagCache.set(tagId, out)
  return out
}
/** A biomes field: "#tag", "id", a list of either, or a NeoForge holder set object. */
function biomesOf(field) {
  const out = new Set()
  if (!field) return out
  const add = (ref) => {
    if (typeof ref !== 'string') return
    if (ref.startsWith('#')) for (const b of tag(ref.slice(1))) out.add(b)
    else out.add(ref)
  }
  if (typeof field === 'string') add(field)
  else if (Array.isArray(field)) field.forEach(add)
  else if (typeof field === 'object') {
    const t = field.type
    if (t === 'neoforge:any') for (const b of biomeDefs.keys()) out.add(b)
    else if (t === 'neoforge:or') for (const v of field.values ?? []) for (const b of biomesOf(v)) out.add(b)
    else if (t === 'neoforge:and') {
      const sets = (field.values ?? []).map(biomesOf)
      for (const b of sets[0] ?? []) if (sets.every((s) => s.has(b))) out.add(b)
    } else if (t === 'neoforge:not') {
      const not = biomesOf(field.value)
      for (const b of biomeDefs.keys()) if (!not.has(b)) out.add(b)
    } else if (field.biomes) for (const b of biomesOf(field.biomes)) out.add(b)
  }
  return out
}
const tagsOfBiome = (id) => [...tagFiles.keys()].filter((t) => tag(t).has(id))

// ---------------------------------------------------------------- which biomes generate

// A biome is in the world if a dimension's biome source can place it: vanilla's own lists aren't data files, so
// everything defined counts, bar the few that never generate on their own.
const NEVER = new Set(['minecraft:the_void', 'minecraft:custom', 'blueprint:original_sink'])
const dimensionOf = (id, tags) =>
  tags.includes('minecraft:is_nether') || tags.includes('c:is_nether') || /^minecraft:(nether_wastes|crimson_forest|warped_forest|soul_sand_valley|basalt_deltas)$/.test(id) ? 'nether'
  : tags.includes('minecraft:is_end') || tags.includes('c:is_end') || id.startsWith('nullscape:') || /the_end|end_|_end$/.test(id.split(':')[1]) ? 'end'
  : 'overworld'

/** One section of the Biomes pages each: the first rule that fits wins. */
const CATEGORIES = [
  ['nether', (b) => b.dimension === 'nether'],
  ['end', (b) => b.dimension === 'end'],
  ['caves', (b) => b.has('c:is_cave') || b.has('c:is_underground') || /:cave\//.test(b.id) || /caves?$|prismachasm|cavern|depths|dripstone|lush_caves|deep_dark/.test(b.id)],
  ['oceans', (b) => b.has('minecraft:is_ocean') || b.has('minecraft:is_deep_ocean') || b.has('minecraft:is_river') || b.has('minecraft:is_beach') || b.has('c:is_ocean') || b.has('c:is_river') || b.has('c:is_beach') || /ocean|river|beach|shore|coast|isles|reef|lagoon/.test(b.id)],
  ['snowy', (b) => b.has('c:is_snowy') || b.has('c:is_icy') || b.climate.temperature <= 0.05 || /frozen|snowy|ice_|_ice|glacial|wintry|tundra|frost/.test(b.id)],
  ['mountains', (b) => b.has('c:is_mountain') || b.has('minecraft:is_mountain') || b.has('c:is_peak') || b.has('c:is_slope') || /peak|mountain|cliff|spires|highlands|alps|summit|crag|volcan|caldera/.test(b.id)],
  ['deserts', (b) => b.has('c:is_desert') || b.has('minecraft:is_badlands') || b.has('c:is_badlands') || /desert|badlands|mesa|dune|canyon|sands|oasis|outback/.test(b.id)],
  ['jungles', (b) => b.has('minecraft:is_jungle') || b.has('c:is_jungle') || /jungle|rainforest|tropic|bamboo/.test(b.id)],
  ['savannas', (b) => b.has('minecraft:is_savanna') || b.has('c:is_savanna') || /savanna|shrubland|steppe|brushland|outback|prairie/.test(b.id)],
  ['wetlands', (b) => b.has('c:is_swamp') || b.has('c:is_wet') || /swamp|marsh|bog|fen|bayou|mangrove|wetland/.test(b.id)],
  ['forests', (b) => b.has('minecraft:is_forest') || b.has('c:is_forest') || b.has('minecraft:is_taiga') || b.has('c:is_taiga') || /forest|grove|woods|taiga|orchard|thicket|wood$/.test(b.id)],
  ['plains', () => true]
]

// What grows in a biome, read from its vegetation features' ids ("terralith:yellowstone/spruce_trees_big" -> big
// spruce trees). Only the distinctive: grass, sugar cane, pumpkins and the like grow nearly everywhere.
const WOODS = ['dark_oak', 'oak', 'birch', 'spruce', 'jungle', 'acacia', 'mangrove', 'cherry', 'pine', 'redwood', 'maple', 'baobab', 'willow', 'palm', 'kapok', 'larch', 'magnolia', 'eucalyptus', 'blackwood', 'cypress', 'socotra', 'joshua', 'brimwood', 'cobalt', 'ashen', 'silver_birch', 'alpha', 'dead', 'bamboo', 'aspen', 'fir', 'cedar', 'enchanted_birch', 'mauve', 'yellow_birch', 'red_maple', 'orange_maple', 'golden_larch']
const PLANT_RULES = [
  [/mushroom_(island|huge)|huge_(brown|red)_mushroom|giant_mushroom|big_mushroom/, 'Giant mushrooms'],
  [/bamboo/, 'Bamboo'],
  [/cactus|cacti/, 'Cacti'],
  [/salmonberry/, 'Salmonberries'],
  [/berry|berries/, 'Sweet berries'],
  [/amethyst/, 'Amethyst'],
  [/ice_spike|ice_spikes/, 'Ice spikes'],
  [/iceberg/, 'Icebergs'],
  [/boulder/, 'Boulders'],
  [/fallen|log_pile|fallen_log/, 'Fallen logs'],
  [/coral|warm_ocean_vegetation/, 'Coral reefs'],
  [/sea_pick/, 'Sea pickles'],
  [/kelp/, 'Kelp'],
  [/lily|lilypad|lily_pad/, 'Lily pads'],
  [/azalea/, 'Azaleas'],
  [/lavender/, 'Lavender'],
  [/sunflower/, 'Sunflowers'],
  [/moss/, 'Moss'],
  [/dripstone/, 'Dripstone'],
  [/sculk/, 'Sculk'],
  [/geyser|hot_spring|hotspring/, 'Hot springs'],
  [/flower/, 'Flowers'],
  [/large_fern|fern/, 'Ferns'],
  [/dead_bush/, 'Dead bushes'],
  [/melon/, 'Melons'],
  [/cocoa/, 'Cocoa']
]
// Vanilla's tree features are named after their biome, not their wood.
const VANILLA_TREES = {
  trees_plains: ['Oak'], trees_taiga: ['Spruce'], trees_snowy: ['Spruce'], trees_grove: ['Spruce'], trees_savanna: ['Acacia'], trees_swamp: ['Oak'],
  trees_windswept_hills: ['Spruce', 'Oak'], trees_windswept_forest: ['Spruce', 'Oak'], trees_windswept_savanna: ['Acacia'], trees_meadow: ['Oak', 'Birch'], trees_flower_forest: ['Birch', 'Oak'],
  trees_old_growth_spruce_taiga: ['Big spruce'], trees_old_growth_pine_taiga: ['Big spruce'], birch_tall: ['Big birch'], trees_sparse_jungle: ['Jungle'], trees_badlands: ['Oak'],
  dark_forest_vegetation: ['Dark oak'], trees_mangrove: ['Mangrove'], trees_cherry: ['Cherry'], trees_jungle: ['Jungle'], bamboo_vegetation: ['Jungle']
}
/** The logs a tree feature places, followed through placed and configured features (a random pick of trees, a tree,
 *  trees on a patch): Regions Unexplored names its tree groups after the biome, so only the blocks say what wood. */
const FEATURE_KEYS = new Set(['feature', 'features', 'default', 'feature_true', 'feature_false', 'data'])
/** Each log with its share of the trees: a random pick's chances and weights carry through. */
function logsOf(ref) {
  const out = new Map()
  const seen = new Set()
  // A placed feature and the configured feature it places often share an id: each is followed once. Only
  // references count as hops (a tree in a patch in a random pick is three).
  const visit = (node, hops, isRef, w) => {
    if (node == null || hops > 10 || w <= 0) return
    if (typeof node === 'string') {
      if (!isRef) return
      if (placedDefs.has(node) && !seen.has(`p ${node}`)) {
        seen.add(`p ${node}`)
        visit(placedDefs.get(node), hops + 1, false, w)
      } else if (configuredDefs.has(node) && !seen.has(`c ${node}`)) {
        seen.add(`c ${node}`)
        visit(configuredDefs.get(node), hops + 1, false, w)
      }
      return
    }
    if (Array.isArray(node)) {
      // Weighted entries share by weight, a plain list of features evenly, anything else is passed through.
      const weights = node.map((e) => (typeof e?.weight === 'number' ? e.weight : null))
      const total = weights.every((x) => x !== null) ? weights.reduce((a, b) => a + b, 0) : 0
      node.forEach((e, i) => visit(e, hops, isRef, total ? (w * weights[i]) / total : isRef ? w / node.length : w))
      return
    }
    if (typeof node !== 'object') return
    if (typeof node.Name === 'string' && /_(log|stem|wood)$/.test(node.Name)) {
      const log = node.Name.replace(/(^|:)stripped_/, '$1')
      out.set(log, (out.get(log) ?? 0) + w)
    }
    // Vanilla's random selector: each entry its chance, the default what's left.
    const picks = Array.isArray(node.features) && 'default' in node && node.features.every((e) => typeof e?.chance === 'number')
    let left = 1
    if (picks) for (const e of node.features) {
      visit(e.feature, hops, true, w * e.chance * left)
      left *= 1 - e.chance
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'Name' || (picks && k === 'features')) continue
      visit(v, hops, FEATURE_KEYS.has(k), picks && k === 'default' ? w * left : w)
    }
  }
  visit(ref, 0, true, 1)
  if (process.env.ATLAS_EXPLAIN) console.log(`  ${ref} -> ${[...out].map(([l, x]) => `${l} ${x.toFixed(2)}`).join(', ') || '(no logs)'}`)
  // The woods that make up a real share of the trees, most first (a stray fancy oak in a jungle doesn't count).
  const total = [...out.values()].reduce((a, b) => a + b, 0)
  return [...out].sort((a, b) => b[1] - a[1]).filter(([log, x], i) => i === 0 || x >= total * 0.1 || /mushroom_stem$/.test(log)).map(([log]) => log)
}
const SPECIAL_WOODS = { mushroom: 'Giant mushrooms', crimson: 'Huge crimson fungi', warped: 'Huge warped fungi' }
const woodOf = (log) => log.split(':')[1].replace(/_(log|stem|wood)$/, '').replace(/^small_/, '')

function plantsOf(features) {
  const out = []
  const add = (s) => {
    if (!out.includes(s)) out.push(s)
  }
  for (const f of features) {
    const [ns, p = ''] = String(f).split(':')
    if (/glow_lichen|patch_grass|patch_sugar_cane|patch_pumpkin|underwater_magma|seagrass_simple|brown_mushroom_|red_mushroom_|ore_|disk_|spring_|lake_|amethyst_geode|flower_default|forest_flowers$/.test(p)) continue
    // A tree feature: what its logs say, where they say anything.
    if (typeof f === 'string' && !/fallen|log_pile|stump|boulder|bush|shrub|trees_water/.test(p)) {
      const woods = [...new Set(logsOf(f).map(woodOf))]
      if (woods.length) {
        const big = /big|giant|mega|huge|tall|old_growth|large/.test(p)
        for (const w of woods) {
          if (SPECIAL_WOODS[w]) add(SPECIAL_WOODS[w])
          else {
            const name = w.replace(/_/g, ' ')
            add(big ? `Big ${name} trees` : `${name.charAt(0).toUpperCase()}${name.slice(1)} trees`)
          }
        }
        continue
      }
    }
    if (ns === 'minecraft' && VANILLA_TREES[p]) {
      for (const w of VANILLA_TREES[p]) add(`${w} trees`)
      if (p === 'dark_forest_vegetation') add('Giant mushrooms')
      continue
    }
    if (/tree|forest|grove|woods/.test(p)) {
      const woods = WOODS.filter((w) => new RegExp(`(^|[/_])${w}s?([/_]|$)`).test(p) && !(w === 'oak' && /dark_oak/.test(p)))
      if (woods.length) {
        const big = /big|giant|mega|huge|tall|old_growth|large/.test(p)
        for (const w of woods) {
          const name = w.replace(/_/g, ' ')
          add(big ? `Big ${name} trees` : `${name.charAt(0).toUpperCase()}${name.slice(1)} trees`)
        }
        continue
      }
    }
    // Terralith names its trees after the biome family ("taiga/tall/trees_tall"), not the wood.
    if (/trees?([_/]|$)/.test(p) && !/trees_water/.test(p)) {
      const family = Object.keys(FAMILY_TREES).find((k) => new RegExp(`(^|[/_])${k}([/_]|$)`).test(p))
      if (family) {
        const big = /tall|big|giant|mega|old_growth/.test(p)
        for (const w of FAMILY_TREES[family]) add(big ? `Big ${w.toLowerCase()} trees` : `${w} trees`)
        continue
      }
    }
    const rule = PLANT_RULES.find(([re]) => re.test(p))
    if (rule) add(rule[1])
  }
  // Trees first: they're what a biome looks like, and what Woodcutting asks about.
  const tree = (x) => / trees$|fungi$/.test(x)
  return [...out.filter(tree), ...out.filter((x) => !tree(x))].slice(0, 6)
}
const FAMILY_TREES = { dark_forest: ['Dark oak'], forest: ['Oak', 'Birch'], taiga: ['Spruce'], savanna: ['Acacia'], jungle: ['Jungle'], birch: ['Birch'], snowy: ['Spruce'], tundra: ['Spruce'], mangrove: ['Mangrove'], swamp: ['Oak'], plains: ['Oak'], maple: ['Maple'], sakura: ['Cherry'], cherry: ['Cherry'], highlands: ['Spruce'], alpine: ['Spruce'], siberian: ['Spruce'] }

// Underground, only the underground counts: vanilla's deep dark and dripstone caves carry the plains' trees and
// flowers in their files, which never place below the surface.
const CAVE_RULES = [
  [/sculk/, 'Sculk'],
  [/dripstone/, 'Dripstone'],
  [/cave_vines/, 'Glow berries'],
  [/lush_caves_(ceiling_)?vegetation|ceiling_moss|moss_patch/, 'Moss'],
  [/dripleaf|lush_caves_clay/, 'Dripleaf'],
  [/azalea/, 'Azaleas'],
  [/spore_blossom/, 'Spore blossoms'],
  [/bioshroom/, 'Bioshrooms'],
  [/prismarite|prismoss/, 'Prismarite crystals'],
  [/pointed_redstone|redstone_bu(d|lb)/, 'Redstone crystals'],
  [/ash_vent/, 'Ash vents'],
  [/calcite_pool/, 'Calcite pools'],
  [/corpse_flower/, 'Corpse flowers'],
  [/duskmelon/, 'Duskmelons'],
  [/dropleaf/, 'Dropleaf'],
  [/fungal\/(floor|ceiling)|mushroom/, 'Mushrooms'],
  [/hanging_roots/, 'Hanging roots'],
  [/cobweb/, 'Cobwebs'],
  [/ore_infested/, 'Infested stone'],
  [/magma_strip|lava_drip/, 'Magma'],
  [/basalt_strip/, 'Basalt'],
  [/sea_pickle/, 'Sea pickles'],
  [/jungle\/vegetation/, 'Jungle plants'],
  [/mud_water/, 'Mud pools'],
  [/sulfur_spike/, 'Sulfur spikes'],
  [/ice|frost/, 'Ice']
]
function cavePlantsOf(features) {
  const out = []
  for (const f of features) {
    const p = String(f).split(':')[1] ?? ''
    // Vanilla's mushroom patches go on the surface, whichever biome lists them.
    if (/^(brown|red)_mushroom_/.test(p)) continue
    const rule = CAVE_RULES.find(([re]) => re.test(p))
    if (rule && !out.includes(rule[1])) out.push(rule[1])
  }
  return out.slice(0, 6)
}

// Grass the game tints on top of the map: the dark forest's darker, the swamp's two olive greens (the drier one here).
const tint = (modifier, c) => (modifier === 'dark_forest' ? ((c & 0xfefefe) + 0x28340a) >> 1 : modifier === 'swamp' ? 0x6a7039 : c)

const nameOf = (kind, id) => {
  const [ns, p] = id.split(':')
  return lang[`${kind}.${ns}.${p.replace(/\//g, '.')}`] ?? p.split('/').pop().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
// Some mods write colours as signed ARGB ints (-10300573): keep the low 24 bits.
const colour = (n) => (typeof n === 'number' ? `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, '0')}` : undefined)

const biomes = []
for (const [id, d] of biomeDefs) {
  if (NEVER.has(id) || id.startsWith('blueprint:') || /\(Removed\)/.test(lang[`biome.${id.replace(':', '.').replace(/\//g, '.')}`] ?? '')) continue
  const tags = tagsOfBiome(id)
  const climate = { temperature: d.temperature ?? 0.5, downfall: d.downfall ?? 0.5, precipitation: d.has_precipitation ?? d.precipitation !== 'none' }
  const fx = d.effects ?? {}
  const b = {
    id,
    name: nameOf('biome', id),
    mod: id.split(':')[0],
    dimension: dimensionOf(id, tags),
    climate,
    colours: {
      sky: colour(fx.sky_color),
      fog: colour(fx.fog_color),
      water: colour(fx.water_color),
      grass: colour(fx.grass_color ?? (colourMaps ? tint(fx.grass_color_modifier, fromMap(colourMaps.grass, climate.temperature, climate.downfall)) : undefined)),
      foliage: colour(fx.foliage_color ?? (colourMaps ? fromMap(colourMaps.foliage, climate.temperature, climate.downfall) : undefined))
    },
    tags: tags.filter((t) => /^(c|minecraft):is_/.test(t)).sort(),
    spawns: {}
  }
  b.has = (t) => tags.includes(t)
  for (const [cat, list] of Object.entries(d.spawners ?? {})) for (const s of list ?? []) if (s?.type) b.spawns[s.type] = cat
  b.category = CATEGORIES.find(([, test]) => test(b))[0]
  const steps = (...i) => i.flatMap((n) => d.features?.[n] ?? [])
  if (process.env.ATLAS_EXPLAIN === id) console.log(`${id}:`)
  const explain = process.env.ATLAS_EXPLAIN
  if (explain && explain !== id) delete process.env.ATLAS_EXPLAIN
  b.plants = b.category === 'caves' ? cavePlantsOf(steps(9, 7, 4, 2)) : plantsOf(steps(9, 4, 2))
  if (explain) process.env.ATLAS_EXPLAIN = explain
  biomes.push(b)
}
const byBiome = new Map(biomes.map((b) => [b.id, b]))

// Spawns added or removed by biome modifiers.
for (const m of modifiers) {
  if (m.type === 'neoforge:add_spawns') {
    const spawners = Array.isArray(m.spawners) ? m.spawners : m.spawners ? [m.spawners] : []
    for (const id of biomesOf(m.biomes)) for (const s of spawners) if (byBiome.has(id) && s?.type) byBiome.get(id).spawns[s.type] ??= 'modded'
  } else if (m.type === 'neoforge:remove_spawns') {
    const types = new Set(typeof m.entity_types === 'string' ? (m.entity_types.startsWith('#') ? [] : [m.entity_types]) : m.entity_types ?? [])
    for (const id of biomesOf(m.biomes)) if (byBiome.has(id)) for (const t of types) delete byBiome.get(id).spawns[t]
  }
}
// Mods that spawn in code from tags: Naturalist (has_<animal>, minus its blacklist) and Friends & Foes (has_<mob>).
const entityExists = (id) => lang[`entity.${id.replace(':', '.')}`] !== undefined
for (const t of tagFiles.keys()) {
  let m
  if ((m = /^naturalist:has_([a-z_]+)$/.exec(t))) {
    const entity = `naturalist:${m[1]}`
    if (!entityExists(entity)) continue
    const blacklist = tag(`naturalist:blacklist/blacklist_${m[1]}`)
    for (const id of tag(t)) if (byBiome.has(id) && !blacklist.has(id)) byBiome.get(id).spawns[entity] ??= 'modded'
  } else if ((m = /^friendsandfoes:has_([a-z_]+?)(?:\/any)?$/.exec(t))) {
    const name = m[1].replace(/^(badlands|desert|savanna)_/, '')
    const entity = `friendsandfoes:${name}`
    if (!entityExists(entity)) continue
    for (const id of tag(t)) if (byBiome.has(id)) byBiome.get(id).spawns[entity] ??= 'modded'
  }
}

// ---------------------------------------------------------------- structures

const inSets = new Set()
for (const s of structureSets.values()) for (const e of s.structures ?? []) if (e?.structure) inSets.add(e.structure)

// YUNG's mods switch off the vanilla structures they rebuild (in code, so no data file says so), unless their config
// keeps them: the pack's config wins, then the server's, then YUNG's default (off).
const YUNG = [
  ['betterstrongholds', null, ['minecraft:stronghold']],
  ['bettermineshafts', 'Disable Vanilla Mineshafts', ['minecraft:mineshaft', 'minecraft:mineshaft_mesa']],
  ['betterdeserttemples', 'Disable Vanilla Pyramids', ['minecraft:desert_pyramid']],
  ['betteroceanmonuments', 'Disable Vanilla Ocean Monuments', ['minecraft:monument']],
  ['betterwitchhuts', 'Disable Vanilla Witch Huts', ['minecraft:swamp_hut']],
  ['betterjungletemples', 'Disable Vanilla Jungle Temples', ['minecraft:jungle_pyramid']],
  ['betterfortresses', 'Disable Vanilla Nether Fortresses', ['minecraft:fortress']]
]
for (const [mod, key, vanilla] of YUNG) {
  if (!modNames[mod]) continue
  const file = [path.join(root, 'pack', 'config', `${mod}-neoforge-1_21.toml`), path.join(path.dirname(modsDir), 'config', `${mod}-neoforge-1_21.toml`)].find(existsSync)
  const kept = key && file && new RegExp(`"${key}"\\s*=\\s*false`).test(readFileSync(file, 'utf8'))
  if (!kept) for (const id of vanilla) inSets.delete(id)
}
const structures = []
for (const [id, d] of structureDefs) {
  if (!inSets.has(id)) continue
  const where = [...biomesOf(d.biomes)].filter((b) => byBiome.has(b))
  if (!where.length) continue
  structures.push({ id, name: nameOf('structure', id), mod: id.split(':')[0], biomes: where.sort() })
  for (const b of where) (byBiome.get(b).structures ??= []).push(id)
}

// ---------------------------------------------------------------- creatures

const creatures = new Map()
for (const b of biomes) {
  for (const [entity, cat] of Object.entries(b.spawns)) {
    if (!creatures.has(entity)) creatures.set(entity, { id: entity, name: nameOf('entity', entity), mod: entity.split(':')[0], categories: new Set(), biomes: [] })
    const c = creatures.get(entity)
    if (cat !== 'modded') c.categories.add(cat)
    c.biomes.push(b.id)
  }
}

// ---------------------------------------------------------------- out

const out = {
  generated: new Date().toISOString().slice(0, 10),
  mods: modNames,
  biomes: biomes
    .map(({ has, spawns, ...b }) => ({ ...b, creatures: Object.keys(spawns).sort(), structures: (b.structures ?? []).sort() }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  creatures: [...creatures.values()].map((c) => ({ ...c, categories: [...c.categories].sort(), biomes: c.biomes.sort() })).sort((a, b) => a.name.localeCompare(b.name)),
  structures: structures.sort((a, b) => a.name.localeCompare(b.name))
}
writeFileSync(path.join(root, 'wiki', 'atlas.json'), JSON.stringify(out, null, 1) + '\n')
const count = (list, key) => Object.entries(list.reduce((m, x) => ((m[x[key]] = (m[x[key]] ?? 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(', ')
console.log(`atlas: ${out.biomes.length} biomes (${count(out.biomes, 'category')}), ${out.creatures.length} creatures, ${out.structures.length} structures`)
