#!/usr/bin/env node
// Lays out the spawn city and writes pack/config/lemursaucepacket/hub_plan.json for lsp_fixes' HubBuilder.
// Run after structures/build.mjs (it reads the templates' sizes and marks from structures/raw/manifest.json).
//
// City coordinates: x east, z south, origin at the plaza's centre; y 0 is the street surface (each building's
// ground floor stands on it). Every building is placed by the spot just outside its door ("front"), facing a
// street; the rotation maths below is Minecraft's own (StructureTemplate.transform with the pivot at 0).
//
// The plan, from the middle out: a paved plaza (fountain, waystone, notice board, a market quarter, the well),
// an inner ring street, a band of townhouses and shops (fronts on the inner ring, the outer ring and the
// avenues), an outer ring road, cottages with gardens, and the walls with round towers and four gates.

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rng } from './lib/parts.mjs'
import { createHash } from 'node:crypto'
import { AT_BUILDING, NPCS, presetId } from '../npcs/npcs.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const manifest = JSON.parse(readFileSync(path.join(here, 'raw', 'manifest.json'), 'utf8'))
const T = Object.fromEntries(manifest.templates.map((t) => [t.name, t]))
const NS = 'lemursaucepacket'

export const CITY = {
  name: 'Lemurton',
  half: 76, // the walls stand at +-76
  plaza: 21, // the plaza is +-21
  avenue: 3, // avenues are 7 wide (+-3)
  street: 2, // ring streets are 5 wide (+-2 around their centre line)
  inner: 24, // inner ring street centre line
  outer: 54 // outer ring road centre line
}

// ---------------------------------------------------------------- rotation

const TURN = { none: ([x, z]) => [x, z], cw90: ([x, z]) => [-z, x], cw180: ([x, z]) => [-x, -z], ccw90: ([x, z]) => [z, -x] }
/** The rotation that turns a template's front (south) to face `dir`. */
const FACING = { south: 'none', west: 'cw90', north: 'cw180', east: 'ccw90' }

function tpl(name) {
  const t = T[name]
  if (!t) throw new Error(`no template ${name} (run structures/build.mjs)`)
  return t
}

/** The template-space spot just outside the front door (the "front" mark), or the middle of the front edge. */
function frontOf(t) {
  const m = (t.marks ?? []).find((k) => k.name === 'front')
  if (m) return [m.pos[0], m.pos[2]]
  return [Math.floor((t.solid.min[0] + t.solid.max[0]) / 2), t.solid.max[2] + 1]
}

/** Width of the building's frontage, as seen from the street. */
const frontWidth = (t) => t.solid.max[0] - t.solid.min[0] + 1

// ---------------------------------------------------------------- the plan being built

const placements = []
const footprints = []
const paving = []
const blocks = []
const rows = []
const usedOnce = new Set()

/** Where a template's solid blocks would stand if its front spot were at (fx, fz), facing `faces`. */
function boxFor(name, faces, fx, fz) {
  const t = tpl(name)
  const rot = FACING[faces]
  const [ox, oz] = TURN[rot](frontOf(t))
  const px = fx - ox
  const pz = fz - oz
  const c = [
    [t.solid.min[0], t.solid.min[2]],
    [t.solid.max[0], t.solid.max[2]]
  ].map((p) => {
    const [a, b] = TURN[rot](p)
    return [a + px, b + pz]
  })
  return { px, pz, rot, x1: Math.min(c[0][0], c[1][0]), z1: Math.min(c[0][1], c[1][1]), x2: Math.max(c[0][0], c[1][0]), z2: Math.max(c[0][1], c[1][1]) }
}

/** Places `name` so its front spot is at (fx, fz), facing `faces`. */
function place(name, faces, fx, fz, { y = 0, tag = name } = {}) {
  const t = tpl(name)
  const b = boxFor(name, faces, fx, fz)
  const py = y + t.offset[1]
  placements.push({ t: `${NS}:${name}`, p: [b.px, py, b.pz], r: b.rot })
  footprints.push({ x1: b.x1, z1: b.z1, x2: b.x2, z2: b.z2, tag })
  for (const m of t.marks ?? []) {
    if (m.name !== 'npc') continue
    const who = AT_BUILDING[name] ?? AT_BUILDING[m.role]
    if (!who) continue
    const [rx, rz] = TURN[b.rot]([m.pos[0], m.pos[2]])
    npcSpots.push({ who, x: b.px + rx, y: py + m.pos[1], z: b.pz + rz })
  }
  return b
}
const npcSpots = []

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
 * anything placed; otherwise it moves on a block.
 */
function row({ names, along, at, from, to, faces, gap = 1, r, bounds, once }) {
  const before = placements.length
  const dir = from <= to ? 1 : -1
  let pos = from
  // Shops (`once`) are tried first; ordinary rows start at a random design so streets don't repeat.
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
    else if (r && r.chance(0.12)) pos += dir * 3 // now and then a gap for a garden or an alley
  }
  rows.push(`${String(placements.length - before).padStart(2)} x ${names[0]}... along ${along} at ${at}, ${from}..${to}, facing ${faces}`)
}

function lamp(x, z) {
  for (let y = 1; y <= 3; y++) blocks.push({ p: [x, y, z], s: 'mcwlights:classic_street_lamp[lit=true]' })
  footprints.push({ x1: x, z1: z, x2: x, z2: z, tag: 'lamp' })
}

// Street surfaces: full blocks only. Macaw's "*_paving" blocks are thin overlays meant to sit on top of a block;
// at street level they read as holes. Its *_running_bond, *_flagstone, *_crystal_floor and *_windmill_weave are cubes.
const STREET = [[6, 'minecraft:cobblestone'], [2, 'minecraft:mossy_cobblestone'], [2, 'mcwpaths:andesite_flagstone']]
const AVENUE = [[6, 'mcwpaths:stone_running_bond'], [3, 'mcwpaths:andesite_running_bond'], [1, 'mcwpaths:mossy_stone_running_bond']]
const PLAZA = [[1, 'mcwpaths:stone_flagstone']]
const MARKET = [[6, 'mcwpaths:brick_flagstone'], [3, 'mcwpaths:brick_running_bond'], [1, 'mcwpaths:mud_brick_flagstone']]
const GARDEN = [[8, 'minecraft:grass_block'], [1, 'minecraft:coarse_dirt']]

// ---------------------------------------------------------------- the city

function build() {
  const r = rng('lemurton')
  const { half: H, plaza: P, avenue: A, street: S, inner, outer } = CITY

  // Ground: grass inside the walls, then the streets on top.
  pave(-H + 1, -H + 1, H - 1, H - 1, GARDEN)
  pave(-P, -P, P, P, PLAZA)
  for (const ring of [inner, outer])
    for (const sg of [-1, 1]) {
      pave(-ring - S, sg * ring - S, ring + S, sg * ring + S, STREET)
      pave(sg * ring - S, -ring - S, sg * ring + S, ring + S, STREET)
    }
  pave(-A, -H, A, H, AVENUE)
  pave(-H, -A, H, A, AVENUE)

  // The plaza: the fountain in the middle (radius 5), the waystone (the builder sets it up) and spawn on the
  // avenue north of it, the notice board beside them, a market across the north half (two rows of stalls facing
  // over a lane, z -15..-11),
  // the well in the south-west, lamps on the corners.
  place('plaza_fountain', 'south', 0, 6)
  place('notice_board', 'south', 8, -3)
  pave(-P + 1, -P + 1, P - 1, -6, MARKET)
  // Eight stalls, each once, in two rows facing over the lane (fronts at z -11 looking north, -15 looking south).
  for (const [name, x, z, faces] of [
    ['market_stall_baker', -15, -11, 'north'],
    ['market_stall_fruit', -7, -11, 'north'],
    ['market_stall_gems', 7, -11, 'north'],
    ['market_stall_spice', 15, -11, 'north'],
    ['market_stall_fish', -15, -15, 'south'],
    ['market_stall_cloth', -7, -15, 'south'],
    ['market_stall_flowers', 7, -15, 'south'],
    ['market_stall_butcher', 15, -15, 'south']
  ]) {
    if (clashes(boxFor(name, faces, x, z))) throw new Error(`${name} doesn't fit at ${x},${z}`)
    place(name, faces, x, z)
  }
  place('town_well', 'south', -12, 16)
  for (const [x, z] of [[-P, -P], [P, -P], [-P, P], [P, P]]) lamp(x, z)
  dressPlaza()

  // Middle band (between the rings): townhouses and shops.
  const town = Object.keys(T).filter((n) => /^(townhouse_|varrock_townhouse)/.test(n))
  const shops = Object.keys(T).filter((n) => /^shop_/.test(n)).concat(['varrock_general_store'])
  const lo = inner + S + 1 // first block outside the inner ring street
  const hi = outer - S - 1 // last block inside the outer ring road
  const mid = { x1: -hi, z1: -hi, x2: hi, z2: hi }
  for (const sg of [-1, 1]) {
    // Fronts on the inner ring, looking at the plaza: each shop once (they have their own shopkeeper), then townhouses.
    const once = new Set(shops)
    row({ names: [...shops, ...town], along: 'x', at: sg * lo, from: -hi, to: -A - 2, faces: sg > 0 ? 'north' : 'south', r, bounds: mid, once })
    row({ names: [...shops.slice().reverse(), ...town], along: 'x', at: sg * lo, from: A + 2, to: hi, faces: sg > 0 ? 'north' : 'south', r, bounds: mid, once })
    row({ names: [...shops, ...town], along: 'z', at: sg * lo, from: -hi, to: -A - 2, faces: sg > 0 ? 'west' : 'east', r, bounds: mid, once })
    row({ names: [...shops, ...town], along: 'z', at: sg * lo, from: A + 2, to: hi, faces: sg > 0 ? 'west' : 'east', r, bounds: mid, once })
    // Fronts on the outer ring, from inside.
    row({ names: town, along: 'x', at: sg * hi, from: -hi, to: -A - 2, faces: sg > 0 ? 'south' : 'north', r, bounds: mid })
    row({ names: town, along: 'x', at: sg * hi, from: A + 2, to: hi, faces: sg > 0 ? 'south' : 'north', r, bounds: mid })
    row({ names: town, along: 'z', at: sg * hi, from: -hi, to: -A - 2, faces: sg > 0 ? 'east' : 'west', r, bounds: mid })
    row({ names: town, along: 'z', at: sg * hi, from: A + 2, to: hi, faces: sg > 0 ? 'east' : 'west', r, bounds: mid })
  }
  for (const sg of [-1, 1]) {
    // Fronts on the avenues, inside the middle band.
    row({ names: town, along: 'z', at: A + 1, from: sg * lo, to: sg * hi, faces: 'west', r, bounds: mid })
    row({ names: town, along: 'z', at: -A - 1, from: sg * lo, to: sg * hi, faces: 'east', r, bounds: mid })
    row({ names: town, along: 'x', at: A + 1, from: sg * lo, to: sg * hi, faces: 'north', r, bounds: mid })
    row({ names: town, along: 'x', at: -A - 1, from: sg * lo, to: sg * hi, faces: 'south', r, bounds: mid })
  }

  // Outer band (outer ring road to the walls): cottages with gardens between.
  const cottages = Object.keys(T).filter((n) => /cottage/.test(n))
  const out1 = outer + S + 1
  const wallIn = H - 6
  const ob = { x1: -wallIn, z1: -wallIn, x2: wallIn, z2: wallIn }
  for (const sg of [-1, 1]) {
    row({ names: cottages, along: 'x', at: sg * out1, from: -wallIn, to: -A - 2, faces: sg > 0 ? 'north' : 'south', gap: 3, r, bounds: ob })
    row({ names: cottages, along: 'x', at: sg * out1, from: A + 2, to: wallIn, faces: sg > 0 ? 'north' : 'south', gap: 3, r, bounds: ob })
    row({ names: cottages, along: 'z', at: sg * out1, from: -wallIn, to: -A - 2, faces: sg > 0 ? 'west' : 'east', gap: 3, r, bounds: ob })
    row({ names: cottages, along: 'z', at: sg * out1, from: A + 2, to: wallIn, faces: sg > 0 ? 'west' : 'east', gap: 3, r, bounds: ob })
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
  for (let d = P + 4; d < H - 6; d += 10)
    for (const sg of [-1, 1])
      for (const [x, z] of [[A + 1, sg * d], [-A - 1, sg * d], [sg * d, A + 1], [sg * d, -A - 1]]) if (!clashes({ x1: x, z1: z, x2: x, z2: z })) lamp(x, z)
}

/** Cells in the ring between two distances from the plaza's centre. */
function ringCells(r0, r1) {
  const out = []
  const R = Math.ceil(r1)
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z)
      if (d >= r0 && d < r1) out.push([x, z])
    }
  return out
}

/** The plaza's finish: a stone ring round the fountain, a dressed border, benches, planted trees and a lamp ring. */
function dressPlaza() {
  const P = CITY.plaza
  const A = CITY.avenue
  const free = (x, z) => !clashes({ x1: x, z1: z, x2: x, z2: z })
  // Two bands round the fountain, stopping at the market (north of z -6) except along the avenue.
  const open = (x, z) => (z > -6 || Math.abs(x) <= A) && free(x, z)
  for (const [x, z] of ringCells(6.5, 7.6)) if (open(x, z)) blocks.push({ p: [x, 0, z], s: 'mcwpaths:andesite_flagstone' })
  for (const [x, z] of ringCells(7.6, 8.4)) if (open(x, z)) blocks.push({ p: [x, 0, z], s: 'mcwpaths:diorite_flagstone' })
  // A dressed border round the plaza's edge.
  pave(-P, -P, P, -P, [[1, 'minecraft:polished_andesite']])
  pave(-P, P, P, P, [[1, 'minecraft:polished_andesite']])
  pave(-P, -P, -P, P, [[1, 'minecraft:polished_andesite']])
  pave(P, -P, P, P, [[1, 'minecraft:polished_andesite']])
  // Benches facing the fountain (two stairs each, backs away from it).
  for (const [x, z, faces] of [[-6, 11, 'south'], [5, 11, 'south'], [-11, 4, 'west'], [11, 4, 'east']]) {
    const along = faces === 'south' ? [1, 0] : [0, 1]
    const cells = [[x, z], [x + along[0], z + along[1]]]
    if (!cells.every(([a, b]) => free(a, b))) continue
    for (const [a, b] of cells) {
      blocks.push({ p: [a, 1, b], s: `minecraft:spruce_stairs[facing=${faces}]` })
      footprints.push({ x1: a, z1: b, x2: a, z2: b, tag: 'bench' })
    }
  }
  // Planters with an oak in each (a vanilla tree feature, so each grows its own shape).
  const commands = []
  for (const [x, z] of [[14, 9], [14, 16], [-17, 6], [6, 17]]) {
    const box = { x1: x - 1, z1: z - 1, x2: x + 1, z2: z + 1 }
    if (clashes(box)) continue
    for (let i = -1; i <= 1; i++)
      for (let k = -1; k <= 1; k++) {
        const edge = i !== 0 || k !== 0
        blocks.push({ p: [x + i, 0, z + k], s: edge ? 'minecraft:stone_bricks' : 'minecraft:grass_block' })
        if (edge) blocks.push({ p: [x + i, 1, z + k], s: 'minecraft:stone_brick_slab[type=bottom]' })
      }
    footprints.push({ ...box, tag: 'planter' })
    commands.push(`place feature minecraft:oak ~${x} ~1 ~${z}`)
  }
  plazaCommands.push(...commands)
  // A ring of lamps round the fountain, where it's clear.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * 2 * Math.PI + Math.PI / 8
    const x = Math.round(Math.cos(a) * 10)
    const z = Math.round(Math.sin(a) * 10)
    if (z > -6 && free(x, z)) lamp(x, z)
  }
}
const plazaCommands = []

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

/** Guards inside each gate, the mayor by the waystone, townsfolk about the plaza. */
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
  npcSpots.push({ who: 'mayor', x: 3, y: 1, z: -8 })
  for (const [x, z] of [[-9, 4], [9, -2], [-4, 13], [12, 12], [-15, -2]]) if (!clashes({ x1: x, z1: z, x2: x, z2: z })) npcSpots.push({ who: 'townsfolk', x, y: 1, z })
}

/** A stable UUID per NPC spot (re-importing the plan updates the same NPCs instead of adding more). */
function uuidFor(key) {
  const h = createHash('sha1').update(`lemurton:${key}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

build()
people()
for (const n of npcSpots) {
  const def = NPCS[n.who]
  if (!def) throw new Error(`no NPC ${n.who}`)
  plazaCommands.push(`easy_npc preset import data ${presetId(n.who, def.model)} ~${n.x + 0.5} ~${n.y} ~${n.z + 0.5} ${uuidFor(`${n.who}@${n.x},${n.z}`)}`)
}
const problems = overlaps()
const plan = {
  version: 1,
  name: CITY.name,
  flatten: { radius: CITY.half + 8, blend: 20 },
  search: { radius: 320, step: 32 },
  paving,
  placements,
  blocks,
  commands: plazaCommands,
  waystone: { p: [0, 1, -9], name: CITY.name, facing: 'south' },
  spawn: [0, 1, -7],
  zone: { name: 'hub', box: [-CITY.half - 12, -CITY.half - 12, CITY.half + 12, CITY.half + 12] }
}
const out = path.join(root, 'pack', 'config', 'lemursaucepacket', 'hub_plan.json')
writeFileSync(out, JSON.stringify(plan, null, 1) + '\n')
for (const line of rows) console.log('  row ' + line)
console.log(`${npcSpots.length} NPCs: ${Object.entries(npcSpots.reduce((a, n) => ((a[n.who] = (a[n.who] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ')}`)
const buildings = footprints.filter((f) => !SOFT.has(f.tag)).length
console.log(`${placements.length} placements (${buildings} buildings), ${paving.length} paving areas, ${blocks.length} blocks -> ${path.relative(root, out)}`)
if (problems.length) {
  console.log(`${problems.length} overlaps:`)
  for (const p of problems.slice(0, 30)) console.log('  ' + p)
  process.exitCode = 1
}
