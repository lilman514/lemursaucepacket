// Lemurton's curtain wall, drawn in city coordinates (x east, z south, y 0 = the street surface): a loop with
// rounded corners round the city, towers at uneven spacing nudged in and out so no run is ruler-straight, a
// gatehouse on each avenue, and a stone mix that changes block by block (cobble and moss low down, stone bricks
// above). Built to look laid by hand rather than stamped:
//
// - the wall: a battered (sloping) foot, buttresses, arrow slits, a walkway behind a crenellated parapet that
//   overhangs on corbels (machicolations), and a rail on the town side;
// - towers: round, in two sizes (bigger on the corners), crenellated or under a conical timber roof with a flag;
// - gatehouses: twin square towers, an arched passage with the portcullis up, banners, a lantern, and stairs up
//   to the walkway on the town side.
//
// drawWalls() returns the blocks per piece (one per side of the city, split between features so no tower or gate
// is cut in half): structures/buildings/60-walls.mjs turns each piece into a template.

import { state } from './blocks.mjs'
import { rng } from './parts.mjs'

export const WALL = {
  half: 88, // centre line of the straight runs, from the city's centre
  corner: 46, // corner radius of the loop
  height: 10, // walkway level, give or take a block along the wall
  gate: 3, // the avenue's half-width (the passage is 2 * gate + 1 wide)
  seed: 'lemurton-walls'
}

const DIRS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }

/** The compass direction closest to a vector (x, z). */
function dirOf(x, z) {
  return Math.abs(x) >= Math.abs(z) ? (x >= 0 ? 'east' : 'west') : z >= 0 ? 'south' : 'north'
}

/** A cheap, stable hash of a block position (for the stone mix). */
function hash(x, y, z, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + salt * 1274126177) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Picks from [[weight, id], ...] by a value in [0, 1). */
function pick(mix, v) {
  const total = mix.reduce((a, [w]) => a + w, 0)
  let t = v * total
  for (const [w, id] of mix) {
    if ((t -= w) < 0) return id
  }
  return mix[mix.length - 1][1]
}

const FOOT = [[40, 'minecraft:cobblestone'], [30, 'minecraft:mossy_cobblestone'], [15, 'minecraft:andesite'], [15, 'minecraft:stone']]
const BODY = [[55, 'minecraft:stone_bricks'], [16, 'minecraft:cracked_stone_bricks'], [16, 'minecraft:mossy_stone_bricks'], [6, 'minecraft:andesite'], [4, 'minecraft:polished_andesite'], [3, 'minecraft:cobblestone']]
const TOP = [[70, 'minecraft:stone_bricks'], [15, 'minecraft:cracked_stone_bricks'], [10, 'minecraft:mossy_stone_bricks'], [5, 'minecraft:chiseled_stone_bricks']]
const WALK = [[6, 'mcwpaths:stone_flagstone'], [3, 'mcwpaths:andesite_flagstone'], [1, 'mcwpaths:mossy_stone_flagstone']]

/** Stone for a block of wall at height y, by position (moss and cobble low down, dressed stone higher up). */
function stone(x, y, z, top) {
  const v = hash(x, y, z)
  if (y <= 1) return pick(FOOT, v)
  if (y >= top - 1) return pick(TOP, v)
  // Moss creeps up from the ground: more of it near the foot.
  if (y <= 3 && hash(x, y, z, 7) < 0.35) return 'minecraft:mossy_stone_bricks'
  return pick(BODY, v)
}

/** The blocks of the whole wall: a Map 'x,y,z' -> { x, y, z, s (state string), piece }. */
export function drawWalls(opts = {}) {
  const W = { ...WALL, ...opts }
  const r = rng(W.seed)
  const blocks = new Map()
  let piece = 'north'
  const put = (x, y, z, s) => blocks.set(`${x},${y},${z}`, { x, y, z, s, piece })
  const get = (x, y, z) => blocks.get(`${x},${y},${z}`)?.s

  // ---------------------------------------------------------------- the loop and its nodes

  const straight = W.half - W.corner
  const quarter = 2 * straight + (Math.PI * W.corner) / 2
  /** A point on the loop, s blocks clockwise from the north gate (0, -half). */
  const loop = (s) => {
    s = ((s % (4 * quarter)) + 4 * quarter) % (4 * quarter)
    const q = Math.floor(s / quarter)
    let t = s - q * quarter
    let x
    let z
    if (t < straight) [x, z] = [t, -W.half]
    else if (t < straight + (Math.PI * W.corner) / 2) {
      const a = -Math.PI / 2 + (t - straight) / W.corner
      ;[x, z] = [straight + W.corner * Math.cos(a), -straight + W.corner * Math.sin(a)]
    } else [x, z] = [W.half, -straight + (t - straight - (Math.PI * W.corner) / 2)]
    // Rotate the first quarter (north gate to east gate) round to quarter q, clockwise.
    for (let k = 0; k < q; k++) [x, z] = [-z, x]
    return [x, z]
  }
  const sides = ['north', 'east', 'south', 'west']
  // Nodes clockwise from the north gate: the gates, and five towers a quarter (the middle one the big corner tower),
  // each nudged towards or away from the town.
  const nodes = []
  for (let q = 0; q < 4; q++) {
    const s0 = q * quarter
    nodes.push({ kind: 'gate', s: s0, side: sides[q], p: loop(s0) })
    for (const [at, kind] of [[26, 'tower'], [56, 'tower'], [quarter / 2, 'corner'], [quarter - 56, 'tower'], [quarter - 26, 'tower']]) {
      const s = s0 + at + (kind === 'corner' ? 0 : r.int(-3, 3))
      const [x, z] = loop(s)
      const d = Math.hypot(x, z)
      const nudge = kind === 'corner' ? r.int(0, 2) : r.int(-2, 2)
      nodes.push({ kind, s, side: sides[q], p: [Math.round(x + (x / d) * nudge), Math.round(z + (z / d) * nudge)], roofed: kind === 'corner' || r.chance(0.45) })
    }
  }
  // Which piece a node is drawn into: towers from the north gate to just before the east corner are "north", and so
  // on round; the corner tower goes with the side clockwise before it.
  for (const n of nodes) n.piece = n.side

  // ---------------------------------------------------------------- the wall between nodes

  const heightAt = (s) => W.height + Math.round(Math.sin(s / 23) * 0.6 + Math.sin(s / 9.5 + 1.3) * 0.5)
  /** One straight run of wall from a to b (city coordinates), its walkway at height h. */
  const run = (a, b, h, sAt) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    // Outward: away from the town.
    let n = [-d[1], d[0]]
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    if (n[0] * mid[0] + n[1] * mid[1] < 0) n = [-n[0], -n[1]]
    const inward = dirOf(-n[0], -n[1])
    const x1 = Math.floor(Math.min(a[0], b[0])) - 6
    const x2 = Math.ceil(Math.max(a[0], b[0])) + 6
    const z1 = Math.floor(Math.min(a[1], b[1])) - 6
    const z2 = Math.ceil(Math.max(a[1], b[1])) + 6
    for (let x = x1; x <= x2; x++)
      for (let z = z1; z <= z2; z++) {
        const px = x + 0.5 - a[0]
        const pz = z + 0.5 - a[1]
        const t = px * d[0] + pz * d[1]
        const u = px * n[0] + pz * n[1]
        if (t < -0.5 || t > len + 0.5 || u < -3.5 || u > 4.6) continue
        const s = sAt + t
        const along = Math.floor(s)
        const top = h
        if (u >= -2.5 && u <= 2.5) {
          // The body, on a foundation that replaces the ground.
          for (let y = -2; y <= 0; y++) put(x, y, z, pick(FOOT, hash(x, y, z, 3)))
          for (let y = 1; y < top; y++) put(x, y, z, stone(x, y, z, top))
          // Arrow slits: a narrow dark recess in the outer face every seven blocks.
          if (u > 1.5 && along % 7 === 3) for (const y of [top - 4, top - 3]) put(x, y, z, 'minecraft:air')
          // Walkway (behind the parapet) and the rail on the town side.
          if (u <= 1.5) put(x, top, z, pick(WALK, hash(x, top, z, 5)))
          else put(x, top, z, stone(x, top, z, top + 2))
          if (u < -1.5) put(x, top + 1, z, 'minecraft:stone_brick_wall')
        } else if (u > 2.5 && u <= 3.6) {
          // The foot slopes out at the bottom; corbels carry the parapet out over the face (gaps between them:
          // machicolations); the parapet itself, with merlons on every other pair of blocks.
          for (let y = -1; y <= 0; y++) put(x, y, z, pick(FOOT, hash(x, y, z, 9)))
          put(x, 1, z, `minecraft:cobblestone_stairs[facing=${inward}]`)
          if (along % 2 === 0) put(x, top - 1, z, `minecraft:stone_brick_stairs[facing=${inward},half=top]`)
          put(x, top, z, stone(x, top, z, top + 2))
          put(x, top + 1, z, stone(x, top + 1, z, top + 2))
          if (Math.floor(s / 2) % 2 === 0) put(x, top + 2, z, stone(x, top + 2, z, top + 2))
        } else if (u > 3.6 && u <= 4.6 && along % 11 < 2) {
          // Buttresses every eleven blocks: two wide, a sloped cap.
          for (let y = -1; y <= 0; y++) put(x, y, z, pick(FOOT, hash(x, y, z, 11)))
          for (let y = 1; y <= top - 5; y++) put(x, y, z, stone(x, y, z, top))
          put(x, top - 4, z, `minecraft:stone_brick_stairs[facing=${inward}]`)
        }
        // A lantern on the town-side rail now and then.
        if (u >= -2.5 && u < -1.5 && along % 13 === 0) put(x, top + 2, z, 'minecraft:lantern[hanging=false]')
      }
  }

  // Runs between consecutive nodes, with a slight bend in the middle (no ruler-straight lines).
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    const b = nodes[(i + 1) % nodes.length]
    piece = a.piece
    const mid = [(a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2]
    const dm = Math.hypot(mid[0], mid[1])
    const bend = r.int(-2, 2)
    const m = [Math.round(mid[0] + (mid[0] / dm) * bend), Math.round(mid[1] + (mid[1] / dm) * bend)]
    const sMid = (a.s + (b.s < a.s ? b.s + 4 * quarter : b.s)) / 2
    run(a.p, m, heightAt(a.s), a.s)
    run(m, b.p, heightAt(sMid), sMid)
  }

  // ---------------------------------------------------------------- towers

  const tower = (n) => {
    piece = n.piece
    const big = n.kind === 'corner'
    const rad = big ? 6 : r.chance(0.5) ? 4 : 5
    const h = heightAt(n.s)
    const top = h + (big ? 8 : r.int(5, 7))
    const [cx, cz] = n.p
    const within = (x, z, rr) => Math.hypot(x - cx, z - cz) <= rr + 0.35
    const ring = (x, z, r0, r1) => {
      const d = Math.hypot(x - cx, z - cz)
      return d > r0 + 0.35 && d <= r1 + 0.35
    }
    const inwardAt = (x, z) => dirOf(cx - x, cz - z)
    for (let x = cx - rad - 2; x <= cx + rad + 2; x++)
      for (let z = cz - rad - 2; z <= cz + rad + 2; z++) {
        if (within(x, z, rad)) {
          for (let y = -2; y <= 0; y++) put(x, y, z, pick(FOOT, hash(x, y, z, 13)))
          for (let y = 1; y < top; y++) put(x, y, z, stone(x, y, z, top))
          put(x, top, z, 'minecraft:stone_bricks')
        } else if (ring(x, z, rad, rad + 1)) {
          // A battered foot, and a corbelled band carrying the overhanging top.
          for (let y = -1; y <= 0; y++) put(x, y, z, pick(FOOT, hash(x, y, z, 17)))
          put(x, 1, z, `minecraft:cobblestone_stairs[facing=${inwardAt(x, z)}]`)
          put(x, top - 1, z, `minecraft:stone_brick_stairs[facing=${inwardAt(x, z)},half=top]`)
          put(x, top, z, 'minecraft:stone_bricks')
        }
      }
    // Arrow slits round the body, two rows.
    for (const y of [h - 3, top - 3])
      for (const [dx, dz] of Object.values(DIRS)) {
        put(cx + dx * rad, y, cz + dz * rad, 'minecraft:air')
        put(cx + dx * rad, y + 1, cz + dz * rad, 'minecraft:air')
      }
    // The wall walk goes through the tower: a passage three high along the wall.
    const prev = nodes[(nodes.indexOf(n) + nodes.length - 1) % nodes.length].p
    const next = nodes[(nodes.indexOf(n) + 1) % nodes.length].p
    for (const other of [prev, next]) {
      const len = Math.hypot(other[0] - cx, other[1] - cz)
      const dx = (other[0] - cx) / len
      const dz = (other[1] - cz) / len
      for (let k = 0; k <= rad + 1; k++)
        for (let w = -1; w <= 1; w++) {
          const x = Math.round(cx + dx * k - dz * w)
          const z = Math.round(cz + dz * k + dx * w)
          for (let y = h + 1; y <= h + 3; y++) put(x, y, z, 'minecraft:air')
          put(x, h, z, pick(WALK, hash(x, h, z, 19)))
        }
    }
    if (n.roofed) {
      // A conical timber roof (steps facing in, so the slope runs down and out), a flag on top.
      let k = 0
      for (let rr = rad + 1.5; rr > 0.4; rr -= 1, k++) {
        const y = top + 1 + k
        for (let x = cx - rad - 2; x <= cx + rad + 2; x++)
          for (let z = cz - rad - 2; z <= cz + rad + 2; z++) {
            const d = Math.hypot(x - cx, z - cz)
            if (d > rr + 0.3) continue
            put(x, y, z, d > rr - 0.8 ? `minecraft:dark_oak_stairs[facing=${inwardAt(x, z)}]` : 'minecraft:dark_oak_planks')
          }
      }
      put(cx, top + 1 + k, cz, 'minecraft:spruce_fence')
      put(cx, top + 2 + k, cz, 'minecraft:red_banner[rotation=0]')
    } else {
      // Crenellations, and a flag pole in the middle.
      for (let x = cx - rad - 2; x <= cx + rad + 2; x++)
        for (let z = cz - rad - 2; z <= cz + rad + 2; z++) {
          if (!ring(x, z, rad, rad + 1)) continue
          put(x, top + 1, z, stone(x, top + 1, z, top + 3))
          const a = Math.atan2(z - cz, x - cx)
          if (Math.floor(((a + Math.PI) / (2 * Math.PI)) * (rad * 4)) % 2 === 0) put(x, top + 2, z, stone(x, top + 2, z, top + 3))
        }
      for (let y = top + 1; y <= top + 3; y++) put(cx, y, cz, 'minecraft:spruce_fence')
      put(cx, top + 4, cz, 'minecraft:red_banner[rotation=0]')
    }
  }

  // ---------------------------------------------------------------- gatehouses

  /** A gatehouse on an avenue: drawn in its own frame (a along the wall, u out of the town, y up). */
  const gatehouse = (n) => {
    piece = n.piece
    const [gx, gz] = n.p
    const out = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] }[n.side]
    const along = [-out[1], out[0]]
    const at = (a, u) => [Math.round(gx + a * along[0] + u * out[0]), Math.round(gz + a * along[1] + u * out[1])]
    const face = (da, du) => dirOf(da * along[0] + du * out[0], da * along[1] + du * out[1])
    const h = heightAt(n.s)
    const T = h + 6
    const g = W.gate
    const P = (a, y, u, s) => {
      const [x, z] = at(a, u)
      put(x, y, z, s)
    }
    // Twin towers, 7 square, either side of the passage, standing a little proud of the wall outside.
    for (const side of [-1, 1])
      for (let a = g + 2; a <= g + 8; a++)
        for (let u = -3; u <= 4; u++) {
          const aa = side * a
          for (let y = -2; y <= 0; y++) P(aa, y, u, pick(FOOT, hash(aa, y, u, 23)))
          const edge = a === g + 2 || a === g + 8 || u === -3 || u === 4
          const [wx, wz] = at(aa, u)
          for (let y = 1; y < T; y++) put(wx, y, wz, stone(wx, y, wz, T))
          P(aa, T, u, 'minecraft:stone_bricks')
          if (edge) {
            P(aa, T + 1, u, 'minecraft:stone_bricks')
            if ((a + u) % 2 === 0) P(aa, T + 2, u, 'minecraft:stone_bricks')
          }
        }
    // The wall walk goes through both towers.
    for (let a = -g - 8; a <= g + 8; a++)
      for (let u = -2; u <= 2; u++) {
        for (let y = h + 1; y <= h + 3; y++) P(a, y, u, 'minecraft:air')
        P(a, h, u, pick(WALK, hash(a, h, u, 31)))
      }
    // The passage block over the road: solid from the arch to the walkway.
    for (let a = -g - 1; a <= g + 1; a++)
      for (let u = -3; u <= 3; u++) {
        for (let y = 1; y <= h; y++) {
          const [x, z] = at(a, u)
          put(x, y, z, stone(x, y, z, h))
        }
        if (u === 3) {
          P(a, h + 1, u, 'minecraft:stone_bricks')
          if (a % 2 === 0) P(a, h + 2, u, 'minecraft:stone_bricks')
        }
        if (u <= 2) P(a, h, u, pick(WALK, hash(a, h, u, 29)))
        if (u === -3) P(a, h + 1, u, 'minecraft:stone_brick_wall')
      }
    // The arched opening, the road through it, a raised portcullis on the outer face, a lantern inside.
    for (let a = -g; a <= g; a++)
      for (let u = -3; u <= 3; u++) {
        P(a, 0, u, 'mcwpaths:stone_running_bond')
        const archTop = Math.abs(a) === g ? 4 : Math.abs(a) === g - 1 ? 5 : 6
        for (let y = 1; y <= archTop; y++) P(a, y, u, 'minecraft:air')
        // Upside-down stairs, their lower part against the jamb, round the top of the opening.
        if (Math.abs(a) === g) P(a, 5, u, `minecraft:stone_brick_stairs[facing=${face(a > 0 ? 1 : -1, 0)},half=top]`)
        if (Math.abs(a) === g - 1) P(a, 6, u, `minecraft:stone_brick_stairs[facing=${face(a > 0 ? 1 : -1, 0)},half=top]`)
      }
    for (let a = -g + 1; a <= g - 1; a++) P(a, 6, 2, 'minecraft:iron_bars')
    for (let a = -g + 2; a <= g - 2; a++) P(a, 5, 2, 'minecraft:iron_bars')
    P(0, 6, 0, 'minecraft:lantern[hanging=true]')
    // Banners either side of the arch, outside.
    for (const side of [-1, 1]) {
      P(side * (g + 1), h - 2, 4, `minecraft:red_wall_banner[facing=${face(0, 1)}]`)
      P(side * (g + 1), h - 3, 4, 'minecraft:air')
    }
    // Stairs up to the walkway on the town side, running along the wall from the tower, onto a landing, and a gap
    // in the rail there.
    const a0 = g + 9
    for (let k = 0; k < h; k++)
      for (const u of [-4, -5]) {
        for (let y = 1; y <= k; y++) P(a0 + k, y, u, stone(...at(a0 + k, u), y, h))
        P(a0 + k, k + 1, u, `minecraft:stone_brick_stairs[facing=${face(1, 0)}]`)
      }
    for (let a = a0 + h; a <= a0 + h + 1; a++)
      for (const u of [-4, -5]) {
        for (let y = 1; y <= h; y++) P(a, y, u, stone(...at(a, u), y, h))
        P(a, h + 1, u, 'minecraft:air')
      }
    for (let a = a0 + h - 1; a <= a0 + h + 2; a++)
      for (const u of [-3, -2]) for (let y = h + 1; y <= h + 2; y++) P(a, y, u, 'minecraft:air')
  }

  for (const n of nodes) {
    if (n.kind === 'gate') gatehouse(n)
    else tower(n)
  }
  return { blocks, nodes, quarter }
}

/** True if (x, z) is inside the wall's town side (with `margin` blocks to spare): for keeping buildings off it. */
export function insideWalls(x, z, margin = 0) {
  const W = WALL
  const inner = W.half - 3 - margin
  const straight = W.half - W.corner
  const ax = Math.abs(x)
  const az = Math.abs(z)
  if (ax <= straight || az <= straight) return ax <= inner && az <= inner
  return Math.hypot(ax - straight, az - straight) <= W.corner - 3 - margin
}

export { state }
