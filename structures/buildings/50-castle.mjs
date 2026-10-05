// Castle pieces in Lumbridge's and Falador's manner: round towers (crenellated, or with a conical slate roof) and
// a curtain-wall segment with a wall walk. The hub's walls are built from these.

import { log, slab, stairs, state } from '../lib/blocks.mjs'
import { mix, rng } from '../lib/parts.mjs'
import { DRESSED_MIX, FOUNDATION_MIX } from '../lib/house.mjs'

const towards = (x, z) => (Math.abs(x) >= Math.abs(z) ? (x > 0 ? 'west' : 'east') : z > 0 ? 'north' : 'south')
const away = (x, z) => (Math.abs(x) >= Math.abs(z) ? (x > 0 ? 'east' : 'west') : z > 0 ? 'south' : 'north')

/**
 * A round tower centred on 0,0: outer radius R, walls up to y = H, floors every 5, a ladder, arrow slits on
 * every floor facing the four ways, a door on the south, and either crenellations or a cone roof.
 */
function roundTower(c, { seed, R = 4, H = 16, cone = null, wallMix = DRESSED_MIX }) {
  const r = rng(seed)
  const stone = mix(wallMix, r)
  const found = mix(FOUNDATION_MIX, r)
  const cells = []
  for (let x = -R - 1; x <= R + 1; x++)
    for (let z = -R - 1; z <= R + 1; z++) {
      const d = Math.hypot(x, z)
      if (d <= R + 0.5) cells.push({ x, z, ring: d > R - 0.55 })
    }
  for (const { x, z, ring } of cells) {
    for (let y = -3; y <= 0; y++) c.set(x, y, z, found())
    for (let y = 1; y <= H; y++) c.set(x, y, z, ring ? stone() : state('minecraft:air'))
  }
  // Floors (with the ladder hole), the top deck. The ladder is one off the middle: the north arrow slits are
  // right behind the middle, and a ladder can't hang on a slit.
  const ladderX = 1
  const ladderZ = -(R - 1)
  for (let f = 5; f <= H; f += 5) {
    const y = Math.min(f, H)
    for (const { x, z, ring } of cells) if (!ring && !(x === ladderX && z === ladderZ)) c.set(x, y, z, state('minecraft:spruce_planks'))
  }
  for (const { x, z, ring } of cells) if (!ring) c.set(x, H, z, state('minecraft:stone_bricks'))
  c.set(ladderX, H, ladderZ, state('minecraft:spruce_trapdoor', { half: 'top', facing: 'south' }))
  for (let y = 1; y < H; y++) c.set(ladderX, y, ladderZ, state('minecraft:ladder', { facing: 'south' }))
  // Arrow slits facing out on every floor, the door on the south.
  for (let f = 0; f + 3 < H; f += 5)
    for (const [x, z] of [[0, -R], [0, R], [-R, 0], [R, 0]]) {
      if (f === 0 && z === R) continue
      for (const y of [f + 2, f + 3]) c.set(x, y, z, state('mcwwindows:stone_brick_arrow_slit', { facing: away(x, z) }))
    }
  c.set(0, 1, R, state('mcwdoors:dark_oak_stable_door', { facing: 'north', half: 'lower', hinge: 'left' }))
  c.set(0, 2, R, state('mcwdoors:dark_oak_stable_door', { facing: 'north', half: 'upper', hinge: 'left' }))
  c.set(0, 3, R + 1, state('mcwlights:chain_wall_lantern', { facing: 'south' }))
  c.mark('door', 0, 1, R, { facing: 'south' })

  if (!cone) {
    // Crenellations: every other block of the ring stands one higher, with a corbel course under the top.
    for (const { x, z, ring } of cells) {
      if (!ring) continue
      const ang = Math.atan2(z, x)
      const merlon = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * Math.round(2 * Math.PI * R)) % 2 === 0
      c.set(x, H + 1, z, merlon ? stone() : slab('minecraft:stone_brick_slab', 'bottom'))
    }
    c.mark('top', 0, H + 1, 0)
    return
  }
  // A cone: Macaw's roof pieces facing the middle, full blocks under them where the slope drops more than one.
  const RC = R + 1
  const HC = Math.round(RC * cone.steep)
  const top = H + 1
  for (let x = -RC; x <= RC; x++)
    for (let z = -RC; z <= RC; z++) {
      const d = Math.hypot(x, z)
      if (d > RC + 0.3) continue
      const h = Math.max(0, Math.floor((1 - d / (RC + 0.5)) * HC))
      for (let y = top; y < top + h; y++) c.set(x, y, z, state(cone.fill))
      if (x === 0 && z === 0) c.set(0, top + h, 0, state(cone.fill))
      else c.set(x, top + h, z, stairs(`mcwroofs:${cone.material}_roof`, towards(x, z)))
    }
  const apex = top + Math.floor(HC * (1 - 0 / (RC + 0.5))) + 1
  c.set(0, apex, 0, state('minecraft:lightning_rod'))
  c.mark('top', 0, apex, 0)
}

/**
 * A straight curtain-wall segment, L long (x), 3 thick: outer face north (outside the town), a wall walk on
 * top, merlons on the outer edge and a low parapet inside, torches in sconces along the walk.
 */
function wallSegment(c, { seed, L = 11, H = 9 }) {
  const r = rng(seed)
  const stone = mix(DRESSED_MIX, r)
  const found = mix(FOUNDATION_MIX, r)
  for (let x = 0; x < L; x++) {
    for (let z = 0; z <= 2; z++) {
      for (let y = -3; y <= 0; y++) c.set(x, y, z, found())
      for (let y = 1; y <= H; y++) c.set(x, y, z, stone())
    }
    // Batter: a sloping plinth on the outside.
    c.set(x, 1, -1, stairs('minecraft:stone_brick_stairs', 'south'))
    c.set(x, 0, -1, found())
    c.set(x, H + 1, 0, x % 2 === 0 ? stone() : slab('minecraft:stone_brick_slab', 'bottom'))
    c.set(x, H + 1, 2, state('minecraft:stone_brick_wall'))
    c.set(x, H + 1, 1, state('minecraft:air'))
    c.set(x, H + 2, 1, state('minecraft:air'))
    if (x % 4 === 2) c.set(x, H + 2, 2, state('minecraft:lantern'))
    if (x % 4 === 0) for (const y of [4, 5]) c.set(x, y, 0, state('mcwwindows:stone_brick_arrow_slit', { facing: 'north' }))
  }
  c.mark('walk', Math.floor(L / 2), H + 1, 1)
}

export const buildings = [
  { name: 'castle_tower_round', kind: 'castle', notes: 'round crenellated tower, R4 H16', build: (c) => roundTower(c, { seed: 'tower_round' }) },
  { name: 'castle_tower_cone', kind: 'castle', notes: 'round tower with a black slate cone', build: (c) => roundTower(c, { seed: 'tower_cone', H: 14, cone: { material: 'black', fill: 'mcwroofs:black_roof_block', steep: 2.2 } }) },
  { name: 'falador_tower', kind: 'castle', notes: 'white tower with a blue cone', build: (c) => roundTower(c, { seed: 'falador_tower', R: 3, H: 13, wallMix: [[7, 'minecraft:polished_diorite'], [2, 'minecraft:diorite'], [1, 'minecraft:calcite']], cone: { material: 'blue_concrete', fill: 'minecraft:blue_concrete', steep: 2.4 } }) },
  { name: 'castle_wall', kind: 'castle', notes: 'curtain wall, 11 long, wall walk', build: (c) => wallSegment(c, { seed: 'castle_wall' }) }
]
void log
