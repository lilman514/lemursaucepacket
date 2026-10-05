// Building parts drawn into a Canvas: walls, floors, roofs, doors and windows. Coordinates are a building's own
// (x east, y up, z south, front door on the south side). Shapes that depend on neighbours (stair corners, fence
// and pane connections, Macaw's ridge caps, window and lamp-post parts) are left at their defaults here: the bake
// step places every template in a test world, lets the game work them out, and saves the result.

import { AXIS, CCW, CW, OPPOSITE, STEP, log, propsOf, stairs, state, withProps } from './blocks.mjs'

// ---------------------------------------------------------------- randomness

/** A seeded random generator (mulberry32), so a building looks the same every build. */
export function rng(seed) {
  let a = typeof seed === 'string' ? [...seed].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261) : seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1))
  next.pick = (arr) => arr[Math.floor(next() * arr.length)]
  next.chance = (p) => next() < p
  /** Picks from [[weight, value], ...]. */
  next.weighted = (pairs) => {
    const total = pairs.reduce((s, [w]) => s + w, 0)
    let r = next() * total
    for (const [w, v] of pairs) if ((r -= w) <= 0) return v
    return pairs[pairs.length - 1][1]
  }
  return next
}

/** A block chooser: a fixed state, or a weighted mix like [[8, 'cobblestone'], [2, 'mossy_cobblestone']]. */
export function mix(spec, r) {
  if (Array.isArray(spec)) {
    const pairs = spec.map(([w, s]) => [w, typeof s === 'string' ? state(s) : s])
    return () => r.weighted(pairs)
  }
  const s = typeof spec === 'string' ? state(spec) : spec
  return () => s
}

// ---------------------------------------------------------------- boxes and walls

/** The four walls of a box (x0..x1, z0..z1) from y0 to y1, with a block chooser per position. */
export function walls(c, { x0, x1, z0, z1, y0, y1 }, pick) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      c.set(x, y, z0, pick(x, y, z0, 'north'))
      c.set(x, y, z1, pick(x, y, z1, 'south'))
    }
    for (let z = z0 + 1; z < z1; z++) {
      c.set(x0, y, z, pick(x0, y, z, 'west'))
      c.set(x1, y, z, pick(x1, y, z, 'east'))
    }
  }
}

/**
 * A timber-framed wall ring: log posts at the corners and every `postEvery` blocks, a log beam along the top
 * (and at `beamAt` heights), plaster infill. Posts and beams use the right log axis.
 */
export function timberFrame(c, box, { post, beam = post, infill, postEvery = 3, beamAt = [] }) {
  const { x0, x1, z0, z1, y0, y1 } = box
  const isPostX = (x) => x === x0 || x === x1 || (x - x0) % postEvery === 0
  const isPostZ = (z) => z === z0 || z === z1 || (z - z0) % postEvery === 0
  walls(c, box, (x, y, z, side) => {
    const alongX = side === 'north' || side === 'south'
    const isPost = alongX ? isPostX(x) : isPostZ(z)
    if (isPost) return log(post, 'y')
    if (y === y1 || beamAt.includes(y)) return log(beam, alongX ? 'x' : 'z')
    return infill(x, y, z, side)
  })
}

export function floor(c, { x0, x1, z0, z1, y }, pick) {
  c.fill(x0, y, z0, x1, y, z1, typeof pick === 'function' ? (x, yy, z) => pick(x, yy, z) : pick)
}

/** Air inside the box (inclusive) so terrain or old blocks are cleared out of rooms. */
export function hollow(c, { x0, x1, z0, z1, y0, y1 }) {
  c.clear(x0, y0, z0, x1, y1, z1)
}

// ---------------------------------------------------------------- roofs

/** Macaw's Roofs block ids for a material (thatch, gray, black, oak, oak_planks, stone_bricks, blue_terracotta...). */
export const roofIds = (m) => ({
  roof: `mcwroofs:${m}_roof`,
  steep: `mcwroofs:${m}_steep_roof`,
  upperSteep: `mcwroofs:${m}_upper_steep_roof`,
  lower: `mcwroofs:${m}_lower_roof`,
  upperLower: `mcwroofs:${m}_upper_lower_roof`,
  top: `mcwroofs:${m}_top_roof`,
  attic: `mcwroofs:${m}_attic_roof`
})

/**
 * A gable roof over the wall box x0..x1, z0..z1 whose walls end at height `y - 1`. `ridge` is the axis the ridge
 * runs along ('x': slopes face north and south). `pitch`: 'normal' (45°, one up per one in), 'steep' (two up per
 * one in, the RuneScape look) or 'low' (one up per two in). `overhang` sticks out past the walls on all sides.
 * `gable(x, y, z)` fills the triangular end walls. Returns the ridge height.
 */
export function gableRoof(c, { x0, x1, z0, z1, y, ridge = 'x', material, pitch = 'steep', overhang = 1, gable }) {
  const ids = roofIds(material)
  // Work in (u, v): u along the ridge, v across it; map back to x/z.
  const [u0, u1, v0, v1] = ridge === 'x' ? [x0, x1, z0, z1] : [z0, z1, x0, x1]
  const at = (u, yy, v, s) => (ridge === 'x' ? c.set(u, yy, v, s) : c.set(v, yy, u, s))
  const atIfEmpty = (u, yy, v, s) => (ridge === 'x' ? c.setIfEmpty(u, yy, v, s) : c.setIfEmpty(v, yy, u, s))
  // The low side faces outward; stairs face the way they climb: the near (v0) slope climbs toward +v.
  const upNear = ridge === 'x' ? 'south' : 'east'
  const upFar = ridge === 'x' ? 'north' : 'west'
  const lo = v0 - overhang
  const hi = v1 + overhang
  const uA = u0 - overhang
  const uB = u1 + overhang
  let k = 0
  let top = y
  for (;;) {
    const vn = pitch === 'low' ? lo + 2 * k : lo + k
    const vf = pitch === 'low' ? hi - 2 * k : hi - k
    if (vn > vf) break
    const yy = pitch === 'steep' ? y + 2 * k : y + k
    const rows = vn === vf ? [[vn, null]] : pitch === 'low' && vf - vn === 1 ? [[vn, upNear], [vf, upFar]] : [[vn, upNear], [vf, upFar]]
    for (let u = uA; u <= uB; u++) {
      if (vn === vf) {
        // An odd span ends in a single ridge row.
        at(u, yy, vn, state(ids.top))
        continue
      }
      if (pitch === 'normal') {
        at(u, yy, vn, stairs(ids.roof, upNear))
        at(u, yy, vf, stairs(ids.roof, upFar))
      } else if (pitch === 'steep') {
        at(u, yy, vn, stairs(ids.steep, upNear))
        at(u, yy + 1, vn, stairs(ids.upperSteep, upNear))
        at(u, yy, vf, stairs(ids.steep, upFar))
        at(u, yy + 1, vf, stairs(ids.upperSteep, upFar))
      } else {
        at(u, yy, vn, stairs(ids.lower, upNear))
        at(u, yy, vf, stairs(ids.lower, upFar))
        if (vn + 1 < vf - 1) {
          at(u, yy, vn + 1, stairs(ids.upperLower, upNear))
          at(u, yy, vf - 1, stairs(ids.upperLower, upFar))
        } else if (vn + 1 === vf - 1) {
          at(u, yy, vn + 1, state(ids.top))
        }
      }
    }
    void rows
    // Gable end walls under this course (only inside the wall line).
    if (gable) {
      const height = pitch === 'steep' ? 2 : 1
      const inner0 = Math.max(v0, (pitch === 'low' ? vn + 2 : vn + 1))
      const inner1 = Math.min(v1, (pitch === 'low' ? vf - 2 : vf - 1))
      for (let h = 0; h < height; h++)
        for (let v = inner0; v <= inner1; v++) {
          atIfEmpty(u0, yy + h, v, gable(u0, yy + h, v))
          atIfEmpty(u1, yy + h, v, gable(u1, yy + h, v))
        }
    }
    top = pitch === 'steep' ? yy + 1 : yy
    k++
    if (vn === vf) break
  }
  return top
}

/**
 * A hip roof: all four sides slope up to a short ridge (or a point). Same arguments as gableRoof, no gables.
 * Corner pieces are placed as straight stairs; the bake step turns them into the right outer corners.
 */
export function hipRoof(c, { x0, x1, z0, z1, y, material, pitch = 'steep', overhang = 1 }) {
  const ids = roofIds(material)
  let ax = x0 - overhang
  let bx = x1 + overhang
  let az = z0 - overhang
  let bz = z1 + overhang
  let yy = y
  const rise = pitch === 'steep' ? 2 : 1
  while (ax <= bx && az <= bz) {
    if (ax === bx || az === bz) {
      // A one-wide band is the ridge.
      for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) c.set(x, yy, z, state(ids.top))
      return yy
    }
    const piece = (x, z, dir) => {
      if (pitch === 'steep') {
        c.set(x, yy, z, stairs(ids.steep, dir))
        c.set(x, yy + 1, z, stairs(ids.upperSteep, dir))
      } else c.set(x, yy, z, stairs(ids.roof, dir))
    }
    for (let x = ax; x <= bx; x++) {
      piece(x, az, 'south')
      piece(x, bz, 'north')
    }
    for (let z = az + 1; z < bz; z++) {
      piece(ax, z, 'east')
      piece(bx, z, 'west')
    }
    ax++
    bx--
    az++
    bz--
    yy += rise
  }
  return yy - 1
}

// ---------------------------------------------------------------- openings

/** A two-block door in the wall at (x, y, z), facing out of the building (`facing` is the outside direction). */
export function door(c, x, y, z, id, facing, hinge = 'left') {
  const out = OPPOSITE[facing] // doors face the way a player walks in; see the bake screenshots if this looks wrong
  c.set(x, y, z, state(id, { facing: out, half: 'lower', hinge, open: 'false' }))
  c.set(x, y + 1, z, state(id, { facing: out, half: 'upper', hinge, open: 'false' }))
}

/**
 * A window of `id` in a wall whose outside is `facing`, h blocks tall. Macaw's frame windows join up into one
 * frame when stacked or side by side, and only take facing=north|east (the wall's axis).
 */
export function windowCol(c, x, y, z, id, facing, h = 2) {
  const values = propsOf(id).facing ?? []
  const f = values.length === 2 ? (AXIS[facing] === 'z' ? 'north' : 'east') : facing
  for (let i = 0; i < h; i++) c.set(x, y + i, z, withProps(state(id), { facing: f }))
}

/** Open shutters on both sides of a window column (outside face). */
export function shutters(c, x, y, z, id, facing, h = 2) {
  const [dx, , dz] = STEP[facing]
  const left = CCW[facing]
  const right = CW[facing]
  for (let i = 0; i < h; i++) {
    const [lx, , lz] = STEP[left]
    const [rx, , rz] = STEP[right]
    c.setIfEmpty(x + dx + lx, y + i, z + dz + lz, state(id, { facing, open: 'true', hinge: 'right' }))
    c.setIfEmpty(x + dx + rx, y + i, z + dz + rz, state(id, { facing, open: 'true', hinge: 'left' }))
  }
}

/** A flower box under a window: a trapdoor-fronted planter outside the wall. */
export function flowerBox(c, x, y, z, facing, { trapdoor = 'minecraft:spruce_trapdoor', soil = 'minecraft:rooted_dirt', flowers = ['minecraft:red_tulip', 'minecraft:poppy', 'minecraft:cornflower', 'minecraft:oxeye_daisy'] }, r, width = 1) {
  const [dx, , dz] = STEP[facing]
  const side = CW[facing]
  const [sx, , sz] = STEP[side]
  for (let i = 0; i < width; i++) {
    const bx = x + dx + sx * i
    const bz = z + dz + sz * i
    c.set(bx, y, bz, state(soil))
    c.set(bx + dx, y, bz + dz, state(trapdoor, { facing, half: 'top', open: 'true' }))
    c.set(bx, y + 1, bz, state(r.pick(flowers)))
  }
}

// ---------------------------------------------------------------- furniture and lights

/** A bed: foot at (x, y, z), head one block toward `head`. */
export function bed(c, x, y, z, head, color = 'red') {
  const [dx, , dz] = STEP[head]
  c.set(x, y, z, state(`minecraft:${color}_bed`, { facing: head, part: 'foot' }))
  c.set(x + dx, y, z + dz, state(`minecraft:${color}_bed`, { facing: head, part: 'head' }))
}

/** A chair that you sit in looking toward `faces`. */
export const chair = (c, x, y, z, wood, faces) => c.set(x, y, z, state(`mcwfurnitures:${wood}_chair`, { facing: faces }))
export const table = (c, x, y, z, wood) => c.set(x, y, z, state(`mcwfurnitures:${wood}_table`))

/** A lantern on a chain, on a wall whose open side is `out` (the lantern sits on that side of the wall). */
export const wallLantern = (c, x, y, z, out) => c.set(x, y, z, state('mcwlights:chain_wall_lantern', { facing: out }))
export const hangingLantern = (c, x, y, z) => c.set(x, y, z, state('minecraft:lantern', { hanging: 'true' }))

/** A chimney stack (w x d columns) from y0 to y1 with a lit campfire tucked inside the top for smoke. */
export function chimney(c, { x, z, y0, y1, w = 1, d = 1 }, pick) {
  for (let y = y0; y <= y1; y++) for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) c.set(x + i, y, z + j, pick(x + i, y, z + j))
  c.set(x, y1 + 1, z, state('minecraft:campfire', { lit: 'true', signal_fire: 'false' }))
}
