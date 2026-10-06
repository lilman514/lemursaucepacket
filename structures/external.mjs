#!/usr/bin/env node
// Catalogues other mods' buildings for the city plan (structures/hub.mjs). Writes structures/external.json: for each
// template its id, size, solid bounds, entrance (the jigsaw a village street attaches to) and the way it faces, where
// a shopkeeper can stand, its waystone if it has one, and vanilla stand-ins for blocks from mods the pack doesn't
// have. The templates stay in their mod's jar (the pack installs the mod and the game loads them from there), so
// nothing of theirs is copied into this repository.
//
//   node structures/external.mjs
//
// Each source is pinned by the pack: the jar is the one pack/mods/<slug>.pw.toml names (downloaded once into the
// git-ignored structures/.external/ and checked against the hash there).

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decode } from './lib/nbt.mjs'
import { openZip } from './lib/zip.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const BLOCKS = JSON.parse(readFileSync(path.join(here, '.blocks.json'), 'utf8'))

const SOURCES = [
  {
    // Luki's Grand Capitals (Luki, all rights reserved): placed from the mod at runtime, never copied.
    slug: 'lukis-grand-capitals',
    prefix: 'lgc',
    namespace: 'revampedvillages',
    include: /^(plains|taiga)\/(house\/|worker\/|center\/|church|market_|well|water_tower|accessory\/|decor\/(tree_|well|market))/,
    // Blocks from mods the pack doesn't have (they would load as air), and what stands there instead.
    swap: {
      'bountiful:bountyboard': 'minecraft:cartography_table',
      'fwaystones:stone_brick_waystone': 'minecraft:air',
      'morevillagers:blueprint_table': 'minecraft:cartography_table',
      'morevillagers:decayed_workbench': 'minecraft:crafting_table',
      'morevillagers:gardening_table': 'minecraft:composter',
      'morevillagers:hunting_post': 'minecraft:smoker',
      'morevillagers:mining_bench': 'minecraft:smithing_table',
      'morevillagers:oceanography_table': 'minecraft:barrel',
      'morevillagers:purpur_altar': 'minecraft:enchanting_table',
      'morevillagers:woodworking_table': 'minecraft:crafting_table',
      'villagersplus:alchemist_table': 'minecraft:brewing_stand',
      'villagersplus:oak_horticulturist_table': 'minecraft:composter',
      'villagersplus:occultist_table': 'minecraft:enchanting_table',
      'villagersplus:oceanographer_table': 'minecraft:barrel'
    }
  }
]

const AIRISH = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air', 'minecraft:structure_void', 'minecraft:structure_block', 'minecraft:jigsaw'])
const JOB_SITES = new Set(
  ['smithing_table', 'blast_furnace', 'smoker', 'cartography_table', 'brewing_stand', 'barrel', 'stonecutter', 'lectern', 'loom', 'fletching_table', 'cauldron', 'composter', 'grindstone', 'enchanting_table', 'crafting_table', 'anvil'].map((n) => `minecraft:${n}`)
)
// Market counters: what a stall's trader stands behind.
const COUNTER = /planks|slab|stairs|trapdoor|barrel|crafting_table|chest|composter|hay_block|fletching_table|loom|lectern|smithing_table|stonecutter|grindstone|cartography_table|bookshelf/
const STEP = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }
const OUT_OF = { north_up: 'north', south_up: 'south', east_up: 'east', west_up: 'west' }

function sha512(file) {
  return createHash('sha512').update(readFileSync(file)).digest('hex')
}

/** The pinned jar for a pack mod: downloaded once into structures/.external/, checked against the .pw.toml hash. */
async function jarFor(slug) {
  const toml = readFileSync(path.join(root, 'pack', 'mods', `${slug}.pw.toml`), 'utf8')
  const url = /^url\s*=\s*"([^"]+)"/m.exec(toml)[1]
  const hash = /^hash\s*=\s*"([^"]+)"/m.exec(toml)[1]
  const filename = /^filename\s*=\s*"([^"]+)"/m.exec(toml)[1]
  const dir = path.join(here, '.external')
  mkdirSync(dir, { recursive: true })
  const file = path.join(dir, filename)
  if (!existsSync(file) || sha512(file) !== hash) {
    console.log(`Downloading ${filename}`)
    const res = await fetch(url, { headers: { 'User-Agent': 'smp-launcher-research/0.1' } })
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    if (sha512(file) !== hash) throw new Error(`${filename}: hash doesn't match pack/mods/${slug}.pw.toml`)
  }
  return { file, filename }
}

/** A state string with the original's facing kept when the stand-in has one. */
function standIn(target, props) {
  if (target === 'minecraft:air') return target
  const entry = BLOCKS[target]
  if (!entry) throw new Error(`stand-in ${target} isn't a block in .blocks.json`)
  const keep = Object.entries(props ?? {}).filter(([k, v]) => entry.props[k]?.includes(String(v)))
  return keep.length ? `${target}[${keep.map(([k, v]) => `${k}=${v}`).join(',')}]` : target
}

function catalogue(t, rel, src) {
  const palette = t.palette ?? t.palettes[0]
  const at = new Map()
  for (const b of t.blocks) at.set(b.pos.join(','), b)
  const nameAt = (x, y, z) => {
    const b = at.get(`${x},${y},${z}`)
    return b ? palette[b.state].Name : 'minecraft:air'
  }
  const isAir = (x, y, z) => AIRISH.has(nameAt(x, y, z)) && nameAt(x, y, z) !== 'minecraft:structure_block'
  const isSolid = (x, y, z) => !AIRISH.has(nameAt(x, y, z)) && !/carpet|flower|torch|lantern|button|pressure_plate|rail|sign|banner|grass$|fern$|vine/.test(nameAt(x, y, z))
  const standable = (x, y, z) => isAir(x, y, z) && isAir(x, y + 1, z) && isSolid(x, y - 1, z)

  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  let door = null
  const swaps = []
  const jobs = []
  let waystone = null
  for (const b of t.blocks) {
    const p = palette[b.state]
    if (p.Name === 'minecraft:jigsaw' && b.nbt && (/building_entrance|\/house$/.test(b.nbt.name) || /building_entrance/.test(b.nbt.target ?? ''))) {
      door = { pos: b.pos, facing: OUT_OF[p.Properties?.orientation] ?? 'north' }
    }
    if (AIRISH.has(p.Name)) continue
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], b.pos[a])
      hi[a] = Math.max(hi[a], b.pos[a])
    }
    const swapTo = src.swap[p.Name]
    if (swapTo) swaps.push({ pos: b.pos, state: standIn(swapTo, p.Properties) })
    else if (!p.Name.startsWith('minecraft:') && !BLOCKS[p.Name]) swaps.push({ pos: b.pos, state: 'minecraft:air', missing: p.Name })
    const jobName = swapTo ?? p.Name
    if (JOB_SITES.has(jobName)) jobs.push({ pos: b.pos, block: jobName.replace('minecraft:', '') })
    if (p.Name === 'waystones:waystone' && p.Properties?.half === 'lower') waystone = { pos: b.pos, facing: p.Properties?.facing ?? 'north' }
  }

  const marks = []
  if (door) {
    const [sx, sz] = STEP[door.facing]
    marks.push({ name: 'door', pos: door.pos, facing: door.facing })
    marks.push({ name: 'front', pos: [door.pos[0] + sx, door.pos[1], door.pos[2] + sz] })
  }
  // A shopkeeper's spot: beside a workstation, under a roof, nearest the entrance.
  const roofed = (x, y, z) => {
    for (let k = y + 2; k < Math.min(t.size[1], y + 12); k++) if (isSolid(x, k, z)) return true
    return false
  }
  const doorPos = door?.pos ?? [t.size[0] / 2, 1, t.size[2] / 2]
  const GENERIC = new Set(['crafting_table', 'anvil', 'barrel', 'composter'])
  const spots = []
  for (const j of jobs) {
    for (const [dx, dz] of Object.values(STEP)) {
      const x = j.pos[0] + dx
      const z = j.pos[2] + dz
      for (const y of [j.pos[1], j.pos[1] + 1]) {
        if (!standable(x, y, z) || !roofed(x, y, z)) continue
        // On the entrance's floor first (a shopkeeper upstairs is hard to find), a real workstation over furniture,
        // then the nearest the door.
        const score = Math.abs(y - doorPos[1]) * 20 + (GENERIC.has(j.block) ? 6 : 0) + Math.hypot(x - doorPos[0], z - doorPos[2])
        spots.push({ pos: [x, y, z], job: j.block, score })
      }
    }
  }
  spots.sort((a, b) => a.score - b.score)
  let npc = spots[0] && Math.abs(spots[0].pos[1] - doorPos[1]) <= 1 ? spots[0] : null
  // No workstation on that floor: just inside the door.
  if (!npc && door) {
    const [sx, sz] = STEP[door.facing]
    for (let k = 1; k <= 5 && !npc; k++) {
      const x = door.pos[0] - sx * k
      const z = door.pos[2] - sz * k
      for (const y of [door.pos[1], door.pos[1] + 1]) if (!npc && standable(x, y, z) && roofed(x, y, z)) npc = { pos: [x, y, z], job: 'door' }
    }
  }
  if (npc) marks.push({ name: 'npc', pos: npc.pos, job: npc.job })
  // Market squares: traders under the canopies, behind a counter, well apart.
  if (/market/.test(rel)) {
    const free = []
    for (let x = 1; x < t.size[0] - 1; x++)
      for (let z = 1; z < t.size[2] - 1; z++)
        for (let y = 1; y < Math.min(4, t.size[1] - 3); y++) {
          if (!standable(x, y, z)) continue
          let canopy = false
          for (let k = y + 2; k <= y + 4; k++) if (/wool|carpet/.test(nameAt(x, k, z))) canopy = true
          const counter = Object.values(STEP).some(([dx, dz]) => COUNTER.test(nameAt(x + dx, y, z + dz)))
          if (canopy && counter) free.push([x, y, z])
        }
    // Spread over every stall: start nearest the middle, then keep taking the spot farthest from those taken.
    const mid = [t.size[0] / 2, t.size[2] / 2]
    const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2
    const picked = free.length ? [free.reduce((a, b) => (d2(a, [mid[0], 0, mid[1]]) <= d2(b, [mid[0], 0, mid[1]]) ? a : b))] : []
    while (picked.length < 8) {
      let best = null
      let bestD = 16 // at least 4 blocks apart
      for (const p of free) {
        const d = Math.min(...picked.map((q) => d2(p, q)))
        if (d > bestD) {
          best = p
          bestD = d
        }
      }
      if (!best) break
      picked.push(best)
    }
    for (const p of picked) marks.push({ name: 'stall', pos: p })
  }
  const name = `${src.prefix}_${rel.replace(/\.nbt$/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`
  return {
    name,
    id: `${src.namespace}:${rel.replace(/\.nbt$/, '')}`,
    kind: 'external',
    size: t.size,
    solid: { min: lo, max: hi },
    // The entrance sits at walking height; plan y 0 is the paving, so the template goes in one lower.
    offset: [0, door ? 1 - door.pos[1] : 0, 0],
    facing: door?.facing ?? 'north',
    marks,
    swaps,
    waystone,
    jobs: jobs.map((j) => j.block)
  }
}

const out = { generated: 'node structures/external.mjs', sources: [], templates: [] }
for (const src of SOURCES) {
  const { file, filename } = await jarFor(src.slug)
  const zip = openZip(file)
  const base = `data/${src.namespace}/structure/`
  let n = 0
  for (const entry of zip.names.filter((e) => e.startsWith(base) && e.endsWith('.nbt')).sort()) {
    const rel = entry.slice(base.length)
    if (!src.include.test(rel)) continue
    out.templates.push(catalogue(decode(zip.read(entry)), rel, src))
    n++
  }
  out.sources.push({ slug: src.slug, jar: filename, namespace: src.namespace, templates: n })
  console.log(`${filename}: ${n} templates`)
}
writeFileSync(path.join(here, 'external.json'), JSON.stringify(out, null, 1) + '\n')
const missing = out.templates.flatMap((t) => t.swaps.filter((s) => s.missing).map((s) => `${t.name}: ${s.missing}`))
if (missing.length) console.log(`Blocks with no stand-in (placed as air):\n  ${[...new Set(missing)].join('\n  ')}`)
console.log(`${out.templates.length} templates → structures/external.json`)
