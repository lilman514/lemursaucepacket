// The Kilnfolk's buildings. Kiln Hollow is their outpost in the volcanic lands: lsp_fixes (pits/KilnHollow) builds it
// once per world, its front toward Lemurton, and reads its data markers for the people and the waystone. The Fight Pits
// and the Inferno are the caves their champions fight in: lsp_instances arenas, placed afresh for every run in the
// instance dimension. The caves have a roof, so their places are data markers (structure blocks in DATA mode:
// player_spawn, wave_spawn) and the bosses' spots are given to the events by height (pits/build.mjs imports ARENAS).
//
// Coordinates: x east, y up, z south, the plaza or cave floor's surface at y 0. Every canvas is symmetric about x 0 and
// z 0, so the template's centre (what lsp_instances measures from) is the canvas's origin.

import { slab, stairs, state } from '../lib/blocks.mjs'
import { mix, rng } from '../lib/parts.mjs'
import { byte, compound, float, int, list, long, string } from '../lib/nbt.mjs'

// ---------------------------------------------------------------- helpers

/** A data marker: a structure block in DATA mode whose metadata names the place. */
function marker(c, x, y, z, meta) {
  c.set(x, y, z, state('minecraft:structure_block', { mode: 'data' }), compound({
    id: string('minecraft:structure_block'),
    name: string(''),
    author: string('LemurSaucePacket'),
    metadata: string(meta),
    posX: int(0), posY: int(1), posZ: int(0),
    sizeX: int(0), sizeY: int(0), sizeZ: int(0),
    rotation: string('NONE'),
    mirror: string('NONE'),
    mode: string('DATA'),
    ignoreEntities: byte(1),
    powered: byte(0),
    showair: byte(0),
    showboundingbox: byte(1),
    integrity: float(1),
    seed: long(0)
  }))
  c.mark(meta.split(':')[0], x, y, z, { meta })
}

const hash = (x, y, z, seed) => {
  const t = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453
  return t - Math.floor(t)
}
const ease = (t) => t * t * (3 - 2 * t)

/** Smooth value noise in 0..1, features about `scale` blocks across. */
function noise(x, y, z, scale, seed) {
  const fx = x / scale, fy = y / scale, fz = z / scale
  const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz)
  const tx = ease(fx - x0), ty = ease(fy - y0), tz = ease(fz - z0)
  let v = 0
  for (let dx = 0; dx <= 1; dx++)
    for (let dy = 0; dy <= 1; dy++)
      for (let dz = 0; dz <= 1; dz++) v += hash(x0 + dx, y0 + dy, z0 + dz, seed) * (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz)
  return v
}

/** Picks from [[upTo, block], ...] by a 0..1 value: patches when the value is noise. */
const band = (v, bands) => bands.find(([upTo]) => v <= upTo)?.[1] ?? bands[bands.length - 1][1]

const axisY = (id) => state(id, { axis: 'y' })
const LAVA = state('minecraft:lava')
const AIR = state('minecraft:air')
const isLava = (s) => s?.name === 'minecraft:lava'
const isAir = (s) => !s || s.name === 'minecraft:air'
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]

/** Walls in every block round a fluid that isn't fluid or bars already, so nothing ever flows. */
function enclose(c, pick) {
  for (const cell of [...c.cells.values()]) {
    if (!isLava(cell.state)) continue
    for (const [dx, dy, dz] of SIDES) {
      const s = c.get(cell.x + dx, cell.y + dy, cell.z + dz)
      if (isLava(s) || s?.name === 'minecraft:iron_bars' || (dy === 1 && s?.name === 'minecraft:air' && cell.open)) continue
      if (!s || s.name === 'minecraft:air' || s.name === 'minecraft:cave_air') c.set(cell.x + dx, cell.y + dy, cell.z + dz, pick(cell.x + dx, cell.y + dy, cell.z + dz))
    }
  }
}

// ---------------------------------------------------------------- the cave arenas

/**
 * What the events need to know about the arenas (pits/build.mjs): how far down the template's bottom layer is (the floor
 * stands at `floorY` in template coordinates, so a boss hovering `n` blocks up is at y floorY + 1 + n), and where
 * things are, from the centre.
 */
export const ARENAS = {
  fight_pits: { bottom: -3, floorY: 3, radius: 25, rx: 23, ry: 16, jad: { x: 0, z: -11 } },
  inferno: { bottom: -3, floorY: 3, radius: 31, rx: 32, ry: 22, zuk: { x: 0, z: -22 }, lip: -17, shield: { z: -18, from: -12, to: 12 } }
}

const ARENAS_BOTTOM = -3

/**
 * A cave: a solid floor (y 0) on a foundation, under a dome whose inside is an ellipsoid (rx across, ry high) roughened
 * by noise, with a three-block shell. Returns the wall face finder.
 */
function cave(c, o) {
  const seed = o.seed
  const R = o.rx + 3
  const H = o.ry + 3
  const inside = (x, y, z) => {
    if (y < 1) return false
    const n = noise(x, y, z, 7, seed) - 0.5
    const d = Math.hypot(x, z)
    const k = (d / (o.rx + n * 2.6)) ** 2 + (y / (o.ry + n * 2)) ** 2
    return k < 1 && !(o.solid && o.solid(x, y, z))
  }
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z)
      if (d > R + 0.5) continue
      for (let y = ARENAS_BOTTOM; y <= H; y++) {
        const outer = (d / (R + 0.5)) ** 2 + (Math.max(0, y) / (H + 0.5)) ** 2
        if (y <= 0) {
          c.set(x, y, z, y === 0 && inside(x, 1, z) ? o.floor(x, z) : o.rock(x, y, z))
        } else if (inside(x, y, z)) c.set(x, y, z, AIR)
        else if (outer <= 1) c.set(x, y, z, o.rock(x, y, z))
      }
    }
  // The outermost ring at floor level fixes the bounds, so the centre is x 0, z 0.
  for (const [x, z] of [[-R, 0], [R, 0], [0, -R], [0, R]]) c.set(x, ARENAS_BOTTOM, z, o.rock(x, ARENAS_BOTTOM, z))
  /** The first solid block going out from the centre along an angle at height y: the cave wall's face. */
  return (angle, y, from = 4) => {
    const dx = Math.cos(angle), dz = Math.sin(angle)
    for (let d = from; d <= R + 1; d += 0.5) {
      const x = Math.round(dx * d), z = Math.round(dz * d)
      if (!isAir(c.get(x, y, z)) || !c.has(x, y, z)) return { x, z, d, dx, dz }
    }
    return null
  }
}

/** Lava behind iron bars where the wall meets the floor (a pocket) or running up the wall (a fall). */
function lavaInWall(c, face, angle, { y0 = 1, y1 = 3, width = 3, depth = 2, from = 4 }) {
  const px = -Math.sin(angle), pz = Math.cos(angle)
  for (let y = y0; y <= y1; y++) {
    const f = face(angle, y, from)
    if (!f) continue
    for (let w = -(width >> 1); w <= width >> 1; w++) {
      const bx = Math.round(f.x + px * w), bz = Math.round(f.z + pz * w)
      // Bars on the face, unless the face here is still floor (the cave curves in above).
      if (isAir(c.get(bx, y, bz)) && c.has(bx, y, bz)) continue
      c.set(bx, y, bz, state('minecraft:iron_bars'))
      for (let k = 1; k <= depth; k++) c.set(Math.round(bx + f.dx * k), y, Math.round(bz + f.dz * k), LAVA)
    }
  }
}

/** A rough boulder of rock on the floor. */
function boulder(c, cx, cz, r, h, pick, seed) {
  for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r + 1); z++)
      for (let y = 1; y <= h + 1; y++) {
        const n = noise(x, y, z, 2.5, seed) - 0.5
        const k = ((x - cx) / (r + n)) ** 2 + ((z - cz) / (r + n)) ** 2 + ((y - 0.5) / (h + n)) ** 2
        if (k < 1) c.set(x, y, z, pick(x, y, z))
      }
}

/** Shroomlights set into the ceiling, and lanterns on chains. */
function ceilingLights(c, r, { count, chains, within, top }) {
  const ceiling = (x, z) => {
    for (let y = top; y > 2; y--) if (isAir(c.get(x, y - 1, z)) && c.has(x, y - 1, z) && !isAir(c.get(x, y, z))) return y
    return null
  }
  let placed = 0
  for (let i = 0; i < count * 4 && placed < count; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * within
    const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d)
    const y = ceiling(x, z)
    if (y == null) continue
    c.set(x, y, z, state('minecraft:shroomlight'))
    placed++
  }
  for (const [x, z, len] of chains) {
    const y = ceiling(x, z)
    if (y == null) continue
    for (let k = 1; k <= len; k++) c.set(x, y - k, z, state('minecraft:chain', { axis: 'y' }))
    c.set(x, y - len - 1, z, state('minecraft:lantern', { hanging: 'true' }))
  }
}

/** Glowing vents in the floor, on a jittered grid, clear of the given spots. */
function vents(c, r, { spacing, within, keep, avoid = () => false }) {
  for (let gx = -within; gx <= within; gx += spacing)
    for (let gz = -within; gz <= within; gz += spacing) {
      const x = gx + r.int(-2, 2), z = gz + r.int(-2, 2)
      if (Math.hypot(x, z) > within || avoid(x, z) || keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue
      if (!isAir(c.get(x, 1, z)) || !c.has(x, 1, z)) continue
      c.set(x, 0, z, r.chance(0.7) ? axisY('minecraft:ochre_froglight') : state('minecraft:shroomlight'))
    }
}

/** wave_spawn markers round a ring, skipping the arcs given (radians, centre and half-width). */
function waveMarkers(c, { radius, count, skip = [] }) {
  let made = 0
  for (let i = 0; i < count * 3 && made < count; i++) {
    const a = (i / (count * 3)) * Math.PI * 2
    if (skip.some(([centre, half]) => Math.abs(Math.atan2(Math.sin(a - centre), Math.cos(a - centre))) < half)) continue
    if (i % 3) continue
    const x = Math.round(Math.cos(a) * radius), z = Math.round(Math.sin(a) * radius)
    if (!isAir(c.get(x, 1, z)) || !isAir(c.get(x, 2, z)) || isAir(c.get(x, 0, z))) continue
    marker(c, x, 1, z, 'wave_spawn')
    made++
  }
  if (made < count / 2) throw new Error(`${c.name}: only ${made} wave markers fit`)
}

// The Fight Pits: a round cave of blackstone and basalt, lit by lava behind bars and glowing vents in the floor, with
// boulders to fight round. The champion, Kiln-Tok-Jad, comes in on the far (north) side.
function fightPits(c) {
  const A = ARENAS.fight_pits
  const seed = 31
  const r = rng('fight_pits')
  const rockAt = (x, y, z) => {
    const v = Math.min(1, Math.max(0, noise(x, y, z, 5, seed + 1) + (r() - 0.5) * 0.2))
    if (r() < 0.025) return state('minecraft:magma_block')
    return band(v, [[0.34, state('minecraft:blackstone')], [0.5, axisY('minecraft:basalt')], [0.64, state('minecraft:smooth_basalt')], [0.8, state('minecraft:blackstone')], [1, state('minecraft:tuff')]])
  }
  const floorAt = (x, z) => {
    const v = Math.min(1, Math.max(0, noise(x, 0, z, 4, seed + 2) + (r() - 0.5) * 0.22))
    return band(v, [[0.3, state('minecraft:blackstone')], [0.45, state('minecraft:smooth_basalt')], [0.6, axisY('minecraft:basalt')], [0.72, state('minecraft:polished_blackstone')], [0.85, state('minecraft:blackstone')], [1, state('minecraft:cracked_polished_blackstone_bricks')]])
  }
  const face = cave(c, { rx: A.rx, ry: A.ry, seed, rock: rockAt, floor: floorAt })

  // Lava: eight pockets at the foot of the wall and four falls, all behind bars.
  for (let i = 0; i < 8; i++) lavaInWall(c, face, (i / 8) * Math.PI * 2 + Math.PI / 8, { y0: 1, y1: 2, width: 3, depth: 2 })
  for (let i = 0; i < 4; i++) lavaInWall(c, face, (i / 4) * Math.PI * 2, { y0: 1, y1: 7, width: 1, depth: 1 })
  enclose(c, rockAt)

  // Boulders to fight round (cover from the Xil's arrows and the Zek's fire), clear of the middle and the way in.
  const rocks = [[-11, -4, 2.2, 3], [10, -7, 2, 3], [-7, 9, 1.8, 2], [12, 6, 2.4, 4], [-15, 3, 1.6, 2], [4, 12, 1.5, 2]]
  for (const [x, z, rad, h] of rocks) boulder(c, x, z, rad, h, rockAt, seed + x * 7 + z)

  vents(c, r, { spacing: 7, within: A.rx - 4, keep: rocks.map(([x, z, rad]) => [x, z, rad + 1.5]) })
  ceilingLights(c, r, { count: 14, within: A.rx - 6, top: A.ry + 3, chains: [[-6, -6, 3], [7, 3, 2], [-3, 8, 4], [5, -9, 3]] })

  // The party comes in on the south side; the waves come from all round.
  marker(c, 0, 1, A.rx - 5, 'player_spawn')
  for (const [x, z] of [[-1, A.rx - 5], [1, A.rx - 5], [0, A.rx - 4]]) if (isAir(c.get(x, 1, z))) c.set(x, 0, z, state('minecraft:polished_blackstone_bricks'))
  waveMarkers(c, { radius: A.rx - 5, count: 10, skip: [[Math.PI / 2, 0.55]] })
}

// The Inferno: a far bigger cave of obsidian and blackstone, with three pillars to break line of sight and, on the north
// side across a lava lake, the place where Kiln-Kal-Zuk hangs. A low wall runs along the lake's shore; lsp_fixes moves
// the shield (block displays) along it.
function inferno(c) {
  const A = ARENAS.inferno
  const seed = 47
  const r = rng('inferno')
  const rockAt = (x, y, z) => {
    const v = Math.min(1, Math.max(0, noise(x, y, z, 6, seed + 1) + (r() - 0.5) * 0.2))
    if (r() < 0.03) return state('minecraft:magma_block')
    return band(v, [[0.25, state('minecraft:obsidian')], [0.33, state('minecraft:crying_obsidian')], [0.55, state('minecraft:blackstone')], [0.7, axisY('minecraft:basalt')], [0.85, state('minecraft:obsidian')], [1, state('minecraft:smooth_basalt')]])
  }
  const floorAt = (x, z) => {
    const v = Math.min(1, Math.max(0, noise(x, 0, z, 4, seed + 2) + (r() - 0.5) * 0.22))
    return band(v, [[0.28, state('minecraft:polished_blackstone')], [0.42, state('minecraft:blackstone')], [0.55, state('minecraft:smooth_basalt')], [0.68, state('minecraft:polished_blackstone_bricks')], [0.8, state('minecraft:cracked_polished_blackstone_bricks')], [1, axisY('minecraft:basalt')]])
  }
  // Three pillars, floor to roof: obsidian banded with blackstone, a little crying obsidian.
  const pillars = [[-14, 5], [14, 5], [0, 17]]
  const pillarR = 2.3
  const inPillar = (x, z) => pillars.some(([px, pz]) => Math.hypot(x - px, z - pz) <= pillarR)
  const face = cave(c, { rx: A.rx, ry: A.ry, seed, rock: rockAt, floor: floorAt, solid: (x, y, z) => inPillar(x, z) })
  for (const cell of c.cells.values()) {
    if (cell.y < 1 || !inPillar(cell.x, cell.z) || isAir(cell.state)) continue
    cell.state = cell.y % 5 === 0 ? state('minecraft:chiseled_polished_blackstone') : r() < 0.12 ? state('minecraft:crying_obsidian') : state('minecraft:obsidian')
  }

  // The lava lake under Zuk, north of the shore, and the low wall along the shore.
  for (const cell of [...c.cells.values()]) {
    if (cell.y !== 0 || cell.z >= A.lip || !inside2(c, cell.x, cell.z)) continue
    cell.state = LAVA
    cell.open = true
  }
  for (let x = -A.rx; x <= A.rx; x++) {
    if (!isAir(c.get(x, 1, A.lip)) || !c.has(x, 1, A.lip)) continue
    c.set(x, 1, A.lip, state('minecraft:polished_blackstone_brick_wall'))
    c.set(x, 0, A.lip, state('minecraft:chiseled_polished_blackstone'))
  }
  // Lava falls behind bars round the rest of the wall.
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + ((i - 2.5) / 6) * Math.PI * 1.2
    lavaInWall(c, face, a, { y0: 1, y1: 2, width: 3, depth: 2 })
  }
  for (const a of [Math.PI * 0.3, Math.PI * 0.7]) lavaInWall(c, face, a, { y0: 1, y1: 8, width: 1, depth: 1 })
  for (const a of [-Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5, -Math.PI / 2 - 0.85, -Math.PI / 2 + 0.85]) lavaInWall(c, face, a, { y0: 1, y1: 10, width: 1, depth: 1, from: 21 })
  enclose(c, rockAt)

  vents(c, r, { spacing: 7, within: A.rx - 4, keep: pillars.map(([x, z]) => [x, z, pillarR + 2]), avoid: (x, z) => z <= A.lip + 1 })
  ceilingLights(c, r, { count: 22, within: A.rx - 6, top: A.ry + 3, chains: [[-8, -2, 4], [9, 9, 3], [-12, 14, 3], [6, -8, 5], [16, -4, 3], [-18, -6, 4]] })

  marker(c, -8, 1, A.rx - 8, 'player_spawn')
  waveMarkers(c, { radius: A.rx - 7, count: 12, skip: [[Math.PI / 2 + 0.3, 0.45], [-Math.PI / 2, 0.75]] })
}

/** True where the floor at x, z is under the cave (air above it). */
function inside2(c, x, z) {
  return c.has(x, 1, z) && isAir(c.get(x, 1, z))
}

// ---------------------------------------------------------------- Kiln Hollow

// The outpost: a round plaza of blackstone cut into the volcanic rock. In the middle, the mouth of the Fight Pits, grated
// over (lava far below); to the north, the sealed gate of the Inferno; the elder's seat to the west, the smith's forge to
// the east; basalt columns all round, and two fire posts at the way in (south).
function kilnHollow(c) {
  const r = rng('kiln_hollow')
  const R = 15
  const rough = mix([[5, 'minecraft:blackstone'], [3, axisY('minecraft:basalt')], [2, 'minecraft:smooth_basalt'], [1, 'minecraft:tuff']], r)
  const paving = mix([[10, 'minecraft:polished_blackstone_bricks'], [3, 'minecraft:cracked_polished_blackstone_bricks'], [2, 'minecraft:polished_blackstone']], r)
  const shaft = mix([[6, 'minecraft:polished_blackstone_bricks'], [2, 'minecraft:magma_block'], [1, 'minecraft:crying_obsidian'], [2, 'minecraft:blackstone']], r)

  // Footing, plaza, and clear air above (it's cut into whatever the ground was).
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z)
      if (d > R + 0.4) continue
      for (let y = -10; y <= -1; y++) c.set(x, y, z, rough())
      const dp = Math.hypot(x, z + 3)
      c.set(x, 0, z, d > 13.2 ? rough() : d > 12.4 ? state('minecraft:polished_basalt', { axis: 'y' }) : Math.abs(dp - 6.6) < 0.5 ? state('minecraft:chiseled_polished_blackstone') : paving())
      for (let y = 1; y <= 18; y++) c.set(x, y, z, AIR)
    }
  // The way in from the south: polished basalt.
  for (let z = 6; z <= R; z++) for (let x = -1; x <= 1; x++) c.set(x, 0, z, state('minecraft:polished_basalt', { axis: 'z' }))

  // The pit mouth: a shaft down to a lava pool, grated over at the plaza.
  const P = { x: 0, z: -3, r: 3.4 }
  for (let x = -5; x <= 5; x++)
    for (let z = -8; z <= 2; z++) {
      const d = Math.hypot(x - P.x, z - P.z)
      if (d > P.r + 1.2) continue
      if (d <= P.r) {
        for (let y = -7; y <= -1; y++) c.set(x, y, z, AIR)
        c.set(x, -8, z, LAVA)
        c.set(x, -9, z, state('minecraft:blackstone'))
        c.set(x, 0, z, state('minecraft:iron_bars'))
      } else {
        for (let y = -9; y <= -1; y++) c.set(x, y, z, shaft())
        c.set(x, 0, z, state('minecraft:gilded_blackstone'))
      }
    }
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = Math.round(P.x + dx * 3.6), z = Math.round(P.z + dz * 3.6)
    c.set(x, 1, z, state('minecraft:chiseled_polished_blackstone'))
    c.set(x, 2, z, state('minecraft:polished_blackstone_wall'))
    c.set(x, 3, z, state('minecraft:campfire', { lit: 'true', facing: 'south' }))
  }
  marker(c, 0, 1, 2, 'npc:pit_master:south')

  // The Inferno's gate, north: an arch of obsidian and crying obsidian over a sealed doorway.
  const gz = -11
  for (let x = -4; x <= 4; x++)
    for (let y = 1; y <= 9; y++) {
      const edge = Math.abs(x) === 4 || y === 9 || (Math.abs(x) === 3 && y >= 8)
      if (edge) c.set(x, y, gz, (x + y) % 3 === 0 ? state('minecraft:crying_obsidian') : state('minecraft:obsidian'))
      else if (Math.abs(x) <= 3 && y <= 8) c.set(x, y, gz - 1, y === 1 || (x === 0 && y === 4) ? state('minecraft:crying_obsidian') : (x + y) % 4 === 0 ? state('minecraft:gilded_blackstone') : state('minecraft:polished_blackstone_bricks'))
    }
  for (let x = -5; x <= 5; x++) for (let y = 1; y <= 10; y++) for (let z = gz - 3; z <= gz - 2; z++) c.set(x, y, z, rough())
  for (const x of [-5, 5]) {
    c.set(x, 1, gz + 1, state('minecraft:chiseled_polished_blackstone'))
    c.set(x, 2, gz + 1, state('minecraft:polished_blackstone_wall'))
    c.set(x, 3, gz + 1, state('minecraft:campfire', { lit: 'true', facing: 'south' }))
  }
  for (let x = -3; x <= 3; x++) c.set(x, 0, gz + 1, state('minecraft:polished_blackstone_bricks'))
  marker(c, 0, 1, gz + 2, 'npc:inferno_keeper:south')

  // The elder's seat, west: a dais with a throne of blackstone and gold.
  const ex = -10
  for (let z = -2; z <= 2; z++) {
    c.set(ex - 1, 1, z, state('minecraft:polished_blackstone_bricks'))
    c.set(ex, 1, z, slab('minecraft:polished_blackstone_brick_slab', 'bottom'))
  }
  c.set(ex - 1, 2, 0, stairs('minecraft:blackstone_stairs', 'east'))
  c.set(ex - 2, 2, 0, state('minecraft:gilded_blackstone'))
  c.set(ex - 2, 3, 0, state('minecraft:gilded_blackstone'))
  c.set(ex - 2, 4, 0, state('minecraft:chiseled_polished_blackstone'))
  for (const z of [-1, 1]) {
    c.set(ex - 1, 2, z, state('minecraft:polished_blackstone_wall'))
    c.set(ex - 2, 2, z, state('minecraft:polished_blackstone_bricks'))
    c.set(ex - 2, 3, z, state('minecraft:polished_blackstone_wall'))
  }
  for (const z of [-3, 3]) {
    c.set(ex - 1, 1, z, state('minecraft:chiseled_polished_blackstone'))
    c.set(ex - 1, 2, z, state('minecraft:polished_blackstone_wall'))
    c.set(ex - 1, 3, z, state('minecraft:campfire', { lit: 'true', facing: 'east' }))
  }
  marker(c, ex + 2, 1, 0, 'npc:kiln_elder:east')

  // The smith's forge, east: an open-fronted hut of blackstone under a basalt roof.
  const fx = 9
  for (let x = fx; x <= fx + 3; x++)
    for (let z = -3; z <= 3; z++)
      for (let y = 1; y <= 4; y++) {
        const back = x === fx + 3, side = Math.abs(z) === 3
        if (back || side) c.set(x, y, z, y === 4 ? state('minecraft:polished_blackstone_bricks') : side && x === fx ? state('minecraft:chiseled_polished_blackstone') : rough())
      }
  for (let x = fx - 1; x <= fx + 4; x++) for (let z = -4; z <= 4; z++) c.set(x, 5, z, x === fx - 1 || Math.abs(z) === 4 ? slab('minecraft:blackstone_slab', 'bottom') : state('minecraft:polished_basalt', { axis: 'x' }))
  c.set(fx + 2, 1, -2, state('minecraft:blast_furnace', { facing: 'west', lit: 'true' }))
  c.set(fx + 2, 1, 2, state('minecraft:smithing_table'))
  c.set(fx + 1, 1, -1, state('minecraft:anvil', { facing: 'north' }))
  c.set(fx + 2, 1, 0, state('minecraft:lava_cauldron'))
  c.set(fx + 2, 1, 1, state('minecraft:barrel', { facing: 'up' }))
  for (const z of [-2, 2]) {
    c.set(fx + 1, 4, z, state('minecraft:chain', { axis: 'y' }))
    c.set(fx + 1, 3, z, state('minecraft:lantern', { hanging: 'true' }))
  }
  marker(c, fx - 1, 1, 0, 'npc:kiln_smith:west')

  // Basalt columns round the rim, open at the way in and the gate.
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    const x = Math.round(Math.cos(a) * 14), z = Math.round(Math.sin(a) * 14)
    if (z > 9 && Math.abs(x) <= 4) continue
    if (z < -9 && Math.abs(x) <= 6) continue
    const h = 2 + Math.floor(noise(x, 0, z, 3, 5) * 5)
    for (let y = 1; y <= h; y++) c.set(x, y, z, axisY(y === h && r.chance(0.3) ? 'minecraft:polished_basalt' : 'minecraft:basalt'))
  }
  // A parapet round the rim (the Hollow may stand on a summit): open only at the way in.
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z)
      if (d <= 14.1 || d > R + 0.4 || (z > 0 && Math.abs(x) <= 2)) continue
      if (isAir(c.get(x, 1, z))) c.set(x, 1, z, state('minecraft:polished_blackstone_brick_wall'))
    }
  // Fire posts at the way in, and the waystone's spot beside it.
  for (const x of [-3, 3]) {
    for (let y = 1; y <= 4; y++) c.set(x, y, 12, axisY('minecraft:polished_basalt'))
    c.set(x, 5, 12, state('minecraft:campfire', { lit: 'true', facing: 'south' }))
  }
  marker(c, -6, 1, 8, 'waystone:south')

  // Small lava basins along the rim, walled so nobody walks in.
  for (const [bx, bz] of [[-9, -8], [9, -8], [-11, 6], [11, 6]]) {
    for (let x = bx - 1; x <= bx + 1; x++)
      for (let z = bz - 1; z <= bz + 1; z++) {
        const edge = x !== bx || z !== bz
        c.set(x, 0, z, edge ? state('minecraft:polished_blackstone_bricks') : LAVA)
        c.set(x, -1, z, state('minecraft:blackstone'))
        if (edge) c.set(x, 1, z, state('minecraft:polished_blackstone_brick_wall'))
      }
  }
  // A sign at the way in.
  c.set(2, 1, 13, state('minecraft:crimson_sign', { rotation: '0' }), compound({
    id: string('minecraft:sign'),
    front_text: compound({
      messages: list('string', ['Kiln Hollow', 'home of the', 'Kilnfolk', 'The Fight Pits'].map((t) => string(JSON.stringify({ text: t })))),
      color: string('orange'),
      has_glowing_text: byte(1)
    }),
    back_text: compound({ messages: list('string', ['', '', '', ''].map((t) => string(JSON.stringify({ text: t })))), color: string('black'), has_glowing_text: byte(0) }),
    is_waxed: byte(1)
  }))
  marker(c, 0, 1, 0, 'centre')
}

export const buildings = [
  { name: 'kiln_hollow', kind: 'fixture', notes: 'Kiln Hollow: the Kilnfolk outpost, way in to the Fight Pits and the Inferno', build: kilnHollow },
  { name: 'fight_pits', kind: 'arena', notes: 'The Fight Pits (lsp_instances arena): a lava-lit cave with boulders', build: fightPits },
  { name: 'inferno', kind: 'arena', notes: 'The Inferno (lsp_instances arena): a great obsidian cave with three pillars and a lava lake for Zuk', build: inferno }
]
