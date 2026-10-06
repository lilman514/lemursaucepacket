#!/usr/bin/env node
// Lays out the spawn city and writes pack/config/lemursaucepacket/hub_plan.json for lsp_fixes' HubBuilder.
// The buildings are Luki's Grand Capitals' (catalogued in structures/external.json by structures/external.mjs; the
// mod is in the pack and the game places them from its jar). The walls, towers and street lamps are ours (from
// structures/raw/manifest.json, written by structures/build.mjs).
//
// City coordinates: x east, z south, origin at the market's centre; y 0 is the street surface. Every building is
// placed by the spot just outside its door ("front"), facing a street. The rotation maths below is Minecraft's own
// (StructureTemplate.transform with the pivot at 0).
//
// From the middle out: the market square (Luki's big market: stalls round a great tree, the waystone and world
// spawn), a paved ring with wells, the inner ring street with the shops, the cathedral and the church looking
// onto the market, a band of houses with the fountain square on the south avenue, the outer ring road, cottages,
// farms, stables and wizard towers, and the walls with round towers and four gates.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AT_BUILDING, MARKET_TRADERS, NPCS, presetId } from '../npcs/npcs.mjs'
import { rng } from './lib/parts.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const manifest = JSON.parse(readFileSync(path.join(here, 'raw', 'manifest.json'), 'utf8'))
const external = JSON.parse(readFileSync(path.join(here, 'external.json'), 'utf8'))
const T = Object.fromEntries([...manifest.templates, ...external.templates].map((t) => [t.name, t]))
const NS = 'lemursaucepacket'

export const CITY = {
  name: 'Lemurton',
  half: 86, // the walls stand at +-86
  avenue: 3, // avenues are 7 wide (+-3)
  street: 2, // ring streets are 5 wide (+-2 around their centre line)
  inner: 27, // inner ring street centre line, round the market square
  outer: 61 // outer ring road centre line
}

// ---------------------------------------------------------------- rotation

const TURN = { none: ([x, z]) => [x, z], cw90: ([x, z]) => [-z, x], cw180: ([x, z]) => [-x, -z], ccw90: ([x, z]) => [z, -x] }
const DIRS = ['north', 'east', 'south', 'west']
const ROTS = ['none', 'cw90', 'cw180', 'ccw90']
/** The rotation that turns a template's front (ours face south; other mods' say which way) to face `dir`. */
const rotFor = (t, dir) => ROTS[(DIRS.indexOf(dir) - DIRS.indexOf(t.facing ?? 'south') + 4) % 4]
/** A block state turned with its building (horizontal facing and axis). */
function turnState(s, rot) {
  const k = ROTS.indexOf(rot)
  if (!k) return s
  return s.replace(/facing=(north|east|south|west)/, (_, f) => `facing=${DIRS[(DIRS.indexOf(f) + k) % 4]}`).replace(/axis=(x|z)/, (_, a) => `axis=${k % 2 ? (a === 'x' ? 'z' : 'x') : a}`)
}

function tpl(name) {
  const t = T[name]
  if (!t) throw new Error(`no template ${name} (run structures/build.mjs and structures/external.mjs)`)
  return t
}

/** The template-space spot just outside the front door (the "front" mark), or the middle of the front edge. */
function frontOf(t) {
  const m = (t.marks ?? []).find((k) => k.name === 'front')
  if (m) return [m.pos[0], m.pos[2]]
  return [Math.floor((t.solid.min[0] + t.solid.max[0]) / 2), t.solid.max[2] + 1]
}

/** Width of the building's frontage, as seen from the street. */
const frontWidth = (t) => (['north', 'south'].includes(t.facing ?? 'south') ? t.solid.max[0] - t.solid.min[0] : t.solid.max[2] - t.solid.min[2]) + 1

// ---------------------------------------------------------------- the plan being built

const placements = []
const footprints = []
const paving = []
const blocks = []
const commands = []
const rows = []
const usedOnce = new Set()
const npcSpots = []
let waystone = null
let spawn = null

/** Where a template's solid blocks would stand with its origin at (px, pz), turned by `rot`. */
function boxAt(t, rot, px, pz) {
  const c = [
    [t.solid.min[0], t.solid.min[2]],
    [t.solid.max[0], t.solid.max[2]]
  ].map((p) => {
    const [a, b] = TURN[rot](p)
    return [a + px, b + pz]
  })
  return { px, pz, rot, x1: Math.min(c[0][0], c[1][0]), z1: Math.min(c[0][1], c[1][1]), x2: Math.max(c[0][0], c[1][0]), z2: Math.max(c[0][1], c[1][1]) }
}

/** Where a template's solid blocks would stand if its front spot were at (fx, fz), facing `faces`. */
function boxFor(name, faces, fx, fz) {
  const t = tpl(name)
  const rot = rotFor(t, faces)
  const [ox, oz] = TURN[rot](frontOf(t))
  return boxAt(t, rot, fx - ox, fz - oz)
}

/** Records a placement: the template, its footprint, stand-in blocks, its shopkeeper and its waystone. */
function put(name, b, { y = 0, tag = name } = {}) {
  const t = tpl(name)
  const py = y + t.offset[1]
  const at = (pos) => {
    const [rx, rz] = TURN[b.rot]([pos[0], pos[2]])
    return [b.px + rx, py + pos[1], b.pz + rz]
  }
  placements.push({ t: t.id ?? `${NS}:${name}`, p: [b.px, py, b.pz], r: b.rot })
  footprints.push({ x1: b.x1, z1: b.z1, x2: b.x2, z2: b.z2, tag })
  // Blocks from mods the pack doesn't have load as air; put the vanilla stand-in there.
  for (const s of t.swaps ?? []) blocks.push({ p: at(s.pos), s: turnState(s.state, b.rot) })
  for (const m of t.marks ?? []) {
    if (m.name !== 'npc') continue
    const who = AT_BUILDING[name] ?? AT_BUILDING[m.role]
    if (!who) continue
    const [x, ny, z] = at(m.pos)
    npcSpots.push({ who, x, y: ny, z })
  }
  if (t.waystone) {
    const k = ROTS.indexOf(b.rot)
    waystone = { p: at(t.waystone.pos), facing: DIRS[(DIRS.indexOf(t.waystone.facing) + k) % 4] }
  }
  return { ...b, py, at, t }
}

/** Places `name` so its front spot is at (fx, fz), facing `faces`. */
const place = (name, faces, fx, fz, opts) => put(name, boxFor(name, faces, fx, fz), opts)

/** Places `name` turned by `rot` with the middle of its solid blocks at (cx, cz). */
function placeCentred(name, rot, cx, cz, opts) {
  const t = tpl(name)
  const [ox, oz] = TURN[rot]([(t.solid.min[0] + t.solid.max[0] + 1) / 2, (t.solid.min[2] + t.solid.max[2] + 1) / 2])
  return put(name, boxAt(t, rot, cx - Math.floor(ox), cz - Math.floor(oz)), opts)
}

const SOFT = new Set(['wall', 'tower', 'lamp', 'bench', 'planter'])
/** True if the box overlaps any building already placed (walls, towers and lamps don't count). */
const clashes = (box) => footprints.some((f) => !SOFT.has(f.tag) && box.x1 <= f.x2 && f.x1 <= box.x2 && box.z1 <= f.z2 && f.z1 <= box.z2)

function pave(x1, z1, x2, z2, mix, y = 0) {
  paving.push({ box: [Math.min(x1, x2), Math.min(z1, z2), Math.max(x1, x2), Math.max(z1, z2)], y, mix })
}

/**
 * A row of buildings along a street edge: `along` is the axis the row runs on, `at` the fixed coordinate of
 * the front spots (the first block outside the street), from..to the span, `faces` the way the fronts look.
 * Greedy: at each spot it takes the next design that fits the span, stays inside `bounds` and doesn't overlap
 * anything placed; otherwise it moves on a block. Names in `once` are used at most once in the whole city.
 */
function row({ names, along, at, from, to, faces, gap = 1, r, bounds, once }) {
  const before = placements.length
  const dir = from <= to ? 1 : -1
  let pos = from
  // Rows with landmarks or shops (`once`) try them first; others start at a random design so streets don't repeat.
  let i = r && !once ? r.int(0, names.length - 1) : 0
  const inside = (b) => !bounds || (b.x1 >= bounds.x1 && b.x2 <= bounds.x2 && b.z1 >= bounds.z1 && b.z2 <= bounds.z2)
  while (dir > 0 ? pos <= to : pos >= to) {
    let placed = false
    for (let k = 0; k < names.length && !placed; k++) {
      const name = names[(i + k) % names.length]
      if (once && once.has(name) && usedOnce.has(name)) continue
      const w = frontWidth(tpl(name))
      const end = pos + dir * (w - 1)
      if (dir > 0 ? end > to : end < to) continue
      const c = Math.round(pos + (dir * (w - 1)) / 2)
      const [fx, fz] = along === 'x' ? [c, at] : [at, c]
      const box = boxFor(name, faces, fx, fz)
      if (clashes(box) || !inside(box)) continue
      place(name, faces, fx, fz)
      if (once && once.has(name)) usedOnce.add(name)
      pos = end + dir * (gap + 1)
      i = (i + k + 1) % names.length
      placed = true
    }
    if (!placed) pos += dir
    else if (r && r.chance(0.1)) pos += dir * 3 // now and then a gap for a garden or an alley
  }
  rows.push(`${String(placements.length - before).padStart(2)} x ${names[0]}... along ${along} at ${at}, ${from}..${to}, facing ${faces}`)
}

function lamp(x, z) {
  for (let y = 1; y <= 3; y++) blocks.push({ p: [x, y, z], s: 'mcwlights:classic_street_lamp[lit=true]' })
  footprints.push({ x1: x, z1: z, x2: x, z2: z, tag: 'lamp' })
}

/** A planter with an oak in it (a vanilla tree feature, so each grows its own shape). */
function planter(x, z) {
  const box = { x1: x - 1, z1: z - 1, x2: x + 1, z2: z + 1 }
  if (clashes(box)) return
  for (let i = -1; i <= 1; i++)
    for (let k = -1; k <= 1; k++) {
      const edge = i !== 0 || k !== 0
      blocks.push({ p: [x + i, 0, z + k], s: edge ? 'minecraft:stone_bricks' : 'minecraft:grass_block' })
      if (edge) blocks.push({ p: [x + i, 1, z + k], s: 'minecraft:stone_brick_slab[type=bottom]' })
    }
  footprints.push({ ...box, tag: 'planter' })
  commands.push(`place feature minecraft:oak ~${x} ~1 ~${z}`)
}

/** A bench of two stairs, its back to `faces` (people sit looking the other way). */
function bench(x, z, faces) {
  const along = faces === 'north' || faces === 'south' ? [1, 0] : [0, 1]
  const cells = [
    [x, z],
    [x + along[0], z + along[1]]
  ]
  if (cells.some(([a, b]) => clashes({ x1: a, z1: b, x2: a, z2: b }))) return
  for (const [a, b] of cells) {
    blocks.push({ p: [a, 1, b], s: `minecraft:spruce_stairs[facing=${faces}]` })
    footprints.push({ x1: a, z1: b, x2: a, z2: b, tag: 'bench' })
  }
}

// Street surfaces: full blocks only. Macaw's "*_paving" blocks are thin overlays meant to sit on top of a block;
// at street level they read as holes. Its *_running_bond, *_flagstone, *_crystal_floor and *_windmill_weave are cubes.
const STREET = [[6, 'minecraft:cobblestone'], [2, 'minecraft:mossy_cobblestone'], [2, 'mcwpaths:andesite_flagstone']]
const AVENUE = [[6, 'mcwpaths:stone_running_bond'], [3, 'mcwpaths:andesite_running_bond'], [1, 'mcwpaths:mossy_stone_running_bond']]
const PLAZA = [[3, 'mcwpaths:stone_flagstone'], [1, 'mcwpaths:andesite_flagstone']]
const GARDEN = [[8, 'minecraft:grass_block'], [1, 'minecraft:coarse_dirt']]

// The buildings.
const HOUSES = Object.keys(T).filter((n) => /^lgc_plains_house_(small|medium)_house/.test(n))
const WORKERS = ['lgc_plains_worker_armorer', 'lgc_plains_worker_toolsmith', 'lgc_plains_worker_fletcher', 'lgc_plains_worker_library_2', 'lgc_plains_worker_butcher_shop_1', 'lgc_plains_worker_butcher_shop_2', 'lgc_plains_worker_shepherd', 'lgc_plains_worker_cartographer']
const SHOPS = Object.keys(AT_BUILDING).filter((n) => T[n] && !MARKET_TRADERS.includes(AT_BUILDING[n]))
const OUTSKIRTS = ['lgc_plains_house_small_house_1', 'lgc_plains_house_small_house_6', 'lgc_plains_house_stable_2', 'lgc_taiga_house_house_1', 'lgc_plains_house_small_house_8', 'lgc_taiga_house_house_2', 'lgc_plains_house_accessory_farm_2', 'lgc_plains_house_small_house_7', 'lgc_taiga_house_house_6', 'lgc_plains_house_small_house_3']
const TOWERS = ['lgc_taiga_house_house_5', 'lgc_taiga_house_house_4', 'lgc_taiga_house_house_7']

// ---------------------------------------------------------------- the city

function build() {
  const r = rng('lemurton')
  const { half: H, avenue: A, street: S, inner, outer } = CITY
  const lo = inner + S + 1 // first block outside the inner ring street
  const hi = outer - S - 1 // last block inside the outer ring road

  // Ground: grass inside the walls, then the streets on top.
  pave(-H + 1, -H + 1, H - 1, H - 1, GARDEN)
  pave(-inner + S + 1, -inner + S + 1, inner - S - 1, inner - S - 1, PLAZA)
  for (const ring of [inner, outer])
    for (const sg of [-1, 1]) {
      pave(-ring - S, sg * ring - S, ring + S, sg * ring + S, STREET)
      pave(sg * ring - S, -ring - S, sg * ring + S, ring + S, STREET)
    }
  pave(-A, -H, A, H, AVENUE)
  pave(-H, -A, H, A, AVENUE)

  // The market square: Luki's big market in the middle, its waystone the city's, world spawn beside it.
  const market = placeCentred('lgc_plains_center_big_market', 'none', 0, 0, { tag: 'market' })
  // Its traders, round the square in a fixed order.
  const stalls = market.t.marks
    .filter((m) => m.name === 'stall')
    .map((m) => market.at(m.pos))
    .sort((a, b) => Math.atan2(a[2], a[0]) - Math.atan2(b[2], b[0]))
  // Where travellers come in (the compass and /lsp hub goto lead there): the paving just south of the market, in
  // line with the waystone, under open sky (the great tree's canopy covers the waystone itself).
  spawn = [waystone.p[0], 1, market.z2 + 2]
  if (stalls.length < MARKET_TRADERS.length) throw new Error(`the market has ${stalls.length} stalls for ${MARKET_TRADERS.length} traders`)
  MARKET_TRADERS.forEach((who, i) => {
    const [x, y, z] = stalls[Math.floor((i * stalls.length) / MARKET_TRADERS.length)]
    npcSpots.push({ who, x, y, z })
  })
  // Two wells in the paved ring, benches facing the market, planters and lamps on the corners.
  const ringIn = inner - S - 1
  placeCentred('lgc_plains_well', 'none', -20, 12, { tag: 'well' })
  placeCentred('lgc_plains_well', 'cw180', 20, -12, { tag: 'well' })
  for (const [x, z] of [[-ringIn + 2, -ringIn + 2], [ringIn - 2, -ringIn + 2], [-ringIn + 2, ringIn - 2], [ringIn - 2, ringIn - 2]]) planter(x, z)
  for (const [x, z, faces] of [[-8, 20, 'south'], [6, 20, 'south'], [-8, -21, 'north'], [6, -21, 'north']]) bench(x, z, faces)
  for (const [x, z] of [[-A - 2, -ringIn], [A + 2, -ringIn], [-A - 2, ringIn], [A + 2, ringIn], [-ringIn, -A - 2], [-ringIn, A + 2], [ringIn, -A - 2], [ringIn, A + 2]]) lamp(x, z)

  // The fountain square on the south avenue, half way to the outer ring.
  const fz = Math.round((lo + hi) / 2)
  pave(-13, fz - 13, 12, fz + 12, AVENUE)
  placeCentred('lgc_plains_center_fountain', 'none', 0, fz, { tag: 'fountain' })

  // Landmarks looking onto the market: the cathedral on the north side, the church on the south.
  place('lgc_taiga_worker_church', 'south', -16, -lo, { tag: 'cathedral' })
  place('lgc_plains_church', 'north', 24, lo, { tag: 'church' })

  // The inner ring: every shop once (each has its shopkeeper), then the other trades, then houses.
  const mid = { x1: -hi, z1: -hi, x2: hi, z2: hi }
  const once = new Set([...SHOPS, ...WORKERS])
  const innerNames = [...SHOPS, ...WORKERS, ...HOUSES]
  for (const sg of [-1, 1]) {
    row({ names: innerNames, along: 'x', at: sg * lo, from: -hi, to: -A - 2, faces: sg > 0 ? 'north' : 'south', r, bounds: mid, once })
    row({ names: innerNames, along: 'x', at: sg * lo, from: A + 2, to: hi, faces: sg > 0 ? 'north' : 'south', r, bounds: mid, once })
    row({ names: innerNames, along: 'z', at: sg * lo, from: -hi, to: -A - 2, faces: sg > 0 ? 'west' : 'east', r, bounds: mid, once })
    row({ names: innerNames, along: 'z', at: sg * lo, from: A + 2, to: hi, faces: sg > 0 ? 'west' : 'east', r, bounds: mid, once })
  }
  // The outer side of the band, looking onto the outer ring road, and the avenues: houses.
  for (const sg of [-1, 1]) {
    row({ names: HOUSES, along: 'x', at: sg * hi, from: -hi, to: -A - 2, faces: sg > 0 ? 'south' : 'north', r, bounds: mid })
    row({ names: HOUSES, along: 'x', at: sg * hi, from: A + 2, to: hi, faces: sg > 0 ? 'south' : 'north', r, bounds: mid })
    row({ names: HOUSES, along: 'z', at: sg * hi, from: -hi, to: -A - 2, faces: sg > 0 ? 'east' : 'west', r, bounds: mid })
    row({ names: HOUSES, along: 'z', at: sg * hi, from: A + 2, to: hi, faces: sg > 0 ? 'east' : 'west', r, bounds: mid })
    row({ names: HOUSES, along: 'z', at: A + 1, from: sg * lo, to: sg * hi, faces: 'west', r, bounds: mid })
    row({ names: HOUSES, along: 'z', at: -A - 1, from: sg * lo, to: sg * hi, faces: 'east', r, bounds: mid })
    row({ names: HOUSES, along: 'x', at: A + 1, from: sg * lo, to: sg * hi, faces: 'north', r, bounds: mid })
    row({ names: HOUSES, along: 'x', at: -A - 1, from: sg * lo, to: sg * hi, faces: 'south', r, bounds: mid })
  }

  // Outskirts (outer ring road to the walls): a wizard tower by three of the corners, then cottages, farms and
  // stables with gardens between.
  const out1 = outer + S + 1
  const wallIn = H - 6
  const ob = { x1: -wallIn, z1: -wallIn, x2: wallIn, z2: wallIn }
  TOWERS.forEach((name, i) => {
    const [sx, sz] = [[-1, -1], [1, -1], [1, 1]][i]
    place(name, sz > 0 ? 'north' : 'south', sx * (wallIn - 14), sz * out1, { tag: 'tower_house' })
  })
  for (const sg of [-1, 1]) {
    row({ names: OUTSKIRTS, along: 'x', at: sg * out1, from: -wallIn, to: -A - 2, faces: sg > 0 ? 'north' : 'south', gap: 3, r, bounds: ob })
    row({ names: OUTSKIRTS, along: 'x', at: sg * out1, from: A + 2, to: wallIn, faces: sg > 0 ? 'north' : 'south', gap: 3, r, bounds: ob })
    row({ names: OUTSKIRTS, along: 'z', at: sg * out1, from: -wallIn, to: -A - 2, faces: sg > 0 ? 'west' : 'east', gap: 3, r, bounds: ob })
    row({ names: OUTSKIRTS, along: 'z', at: sg * out1, from: A + 2, to: wallIn, faces: sg > 0 ? 'west' : 'east', gap: 3, r, bounds: ob })
  }

  // Trees in the outskirts' gardens, wherever there's room for a crown (not on the roads).
  const TREES = ['minecraft:oak', 'minecraft:fancy_oak', 'minecraft:birch', 'minecraft:oak']
  for (let x = -wallIn + 2; x <= wallIn - 2; x += 7)
    for (let z = -wallIn + 2; z <= wallIn - 2; z += 7) {
      const band = Math.max(Math.abs(x), Math.abs(z))
      if (band < out1 + 1 || Math.min(Math.abs(x), Math.abs(z)) <= A + 3) continue
      const tx = x + r.int(-2, 2)
      const tz = z + r.int(-2, 2)
      if (clashes({ x1: tx - 3, z1: tz - 3, x2: tx + 3, z2: tz + 3 }) || !r.chance(0.7)) continue
      commands.push(`place feature ${TREES[r.int(0, TREES.length - 1)]} ~${tx} ~1 ~${tz}`)
      footprints.push({ x1: tx - 1, z1: tz - 1, x2: tx + 1, z2: tz + 1, tag: 'planter' })
    }

  // Walls: towers on the corners and either side of each gate, curtain wall between.
  const towerAt = (x, z) => place('castle_tower_round', 'south', x, z + 5, { tag: 'tower' })
  for (const [x, z] of [[-H, -H], [H, -H], [-H, H], [H, H]]) towerAt(x, z)
  for (const sg of [-1, 1]) {
    towerAt(sg * (A + 6), -H)
    towerAt(sg * (A + 6), H)
    towerAt(-H, sg * (A + 6))
    towerAt(H, sg * (A + 6))
  }
  const wallLen = tpl('castle_wall').size[0]
  for (const side of ['north', 'south', 'east', 'west'])
    for (const sg of [-1, 1]) {
      let from = A + 11
      while (from + wallLen <= H - 5) {
        const m = sg * (from + Math.floor(wallLen / 2))
        if (side === 'north') place('castle_wall', 'south', m, -H + 4, { tag: 'wall' })
        if (side === 'south') place('castle_wall', 'north', m, H - 4, { tag: 'wall' })
        if (side === 'west') place('castle_wall', 'east', -H + 4, m, { tag: 'wall' })
        if (side === 'east') place('castle_wall', 'west', H - 4, m, { tag: 'wall' })
        from += wallLen
      }
    }

  // Street lamps along the avenues, where there's room.
  for (let d = inner + 6; d < H - 6; d += 10)
    for (const sg of [-1, 1])
      for (const [x, z] of [[A + 1, sg * d], [-A - 1, sg * d], [sg * d, A + 1], [sg * d, -A - 1]]) if (!clashes({ x1: x, z1: z, x2: x, z2: z })) lamp(x, z)
}

/** Buildings (not walls, towers or lamps) must not overlap each other. */
function overlaps() {
  const solid = footprints.filter((f) => !SOFT.has(f.tag))
  const out = []
  for (let i = 0; i < solid.length; i++)
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i]
      const b = solid[j]
      if (a.x1 <= b.x2 && b.x1 <= a.x2 && a.z1 <= b.z2 && b.z1 <= a.z2) out.push(`${a.tag} [${a.x1},${a.z1} .. ${a.x2},${a.z2}] and ${b.tag} [${b.x1},${b.z1} .. ${b.x2},${b.z2}]`)
    }
  return out
}

/** Guards inside each gate, the mayor by the waystone, townsfolk about the square. */
function people() {
  const H = CITY.half
  for (const [gx, gz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const inward = H - 4
    for (const side of [-2, 2]) {
      const x = gx === 0 ? side : gx * inward
      const z = gz === 0 ? side : gz * inward
      npcSpots.push({ who: 'guard', x, y: 1, z })
    }
  }
  // The mayor greets newcomers where they arrive.
  npcSpots.push({ who: 'mayor', x: spawn[0] + 2, y: 1, z: spawn[2] - 1 })
  const ringIn = CITY.inner - CITY.street - 1
  for (const [x, z] of [[-10, ringIn - 1], [12, ringIn - 1], [-ringIn + 1, -8], [ringIn - 1, 9], [3, -ringIn + 1]]) if (!clashes({ x1: x, z1: z, x2: x, z2: z })) npcSpots.push({ who: 'townsfolk', x, y: 1, z })
}

/** A stable UUID per NPC spot (re-importing the plan updates the same NPCs instead of adding more). */
function uuidFor(key) {
  const h = createHash('sha1').update(`lemurton:${key}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

build()
if (!waystone) throw new Error('no waystone in the city')
people()
for (const n of npcSpots) {
  const def = NPCS[n.who]
  if (!def) throw new Error(`no NPC ${n.who}`)
  commands.push(`easy_npc preset import data ${presetId(n.who, def.model)} ~${n.x + 0.5} ~${n.y} ~${n.z + 0.5} ${uuidFor(`${n.who}@${n.x},${n.z}`)}`)
}
const problems = overlaps()
const plan = {
  version: 2,
  name: CITY.name,
  flatten: { radius: CITY.half + 8, blend: 20 },
  // Not at world spawn: out of sight (players see 160 blocks at most), a few minutes' walk.
  search: { minDistance: 400, radius: 700, step: 96 },
  paving,
  placements,
  blocks,
  commands,
  waystone: { p: waystone.p, name: CITY.name, facing: waystone.facing },
  arrival: spawn,
  zone: { name: 'hub', box: [-CITY.half - 12, -CITY.half - 12, CITY.half + 12, CITY.half + 12] },
  credits: external.sources.map((s) => s.jar)
}
const out = path.join(root, 'pack', 'config', 'lemursaucepacket', 'hub_plan.json')
writeFileSync(out, JSON.stringify(plan, null, 1) + '\n')
// Ship only the templates of ours the city uses (bake.mjs copies every baked building into the pack).
const used = new Set(placements.filter((p) => p.t.startsWith(`${NS}:`)).map((p) => p.t.slice(NS.length + 1)))
const packStructures = path.join(root, 'pack', 'kubejs', 'data', NS, 'structure')
const unused = readdirSync(packStructures).filter((f) => f.endsWith('.nbt') && !used.has(f.slice(0, -4)))
for (const f of unused) rmSync(path.join(packStructures, f))
if (unused.length) console.log(`Removed ${unused.length} templates the city doesn't use from the pack (keeping ${[...used].join(', ')})`)
for (const line of rows) console.log('  row ' + line)
console.log(`${npcSpots.length} NPCs: ${Object.entries(npcSpots.reduce((a, n) => ((a[n.who] = (a[n.who] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')}`)
const buildings = footprints.filter((f) => !SOFT.has(f.tag)).length
console.log(`${placements.length} placements (${buildings} buildings), ${paving.length} paving areas, ${blocks.length} blocks -> ${path.relative(root, out)}`)
if (problems.length) {
  console.log(`${problems.length} overlaps:`)
  for (const p of problems.slice(0, 30)) console.log('  ' + p)
  process.exitCode = 1
}
