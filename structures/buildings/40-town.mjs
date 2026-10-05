// Town fixtures: the village well, the plaza fountain, street lamps and a notice board.

import { log, slab, stairs, state } from '../lib/blocks.mjs'
import { mix, rng } from '../lib/parts.mjs'
import { DRESSED_MIX } from '../lib/house.mjs'

/** A covered well: a stone ring round deep water, two posts, a beam with a hanging chain, a little thatch roof. */
function well(c) {
  const r = rng('well')
  const stone = mix(DRESSED_MIX, r)
  for (let x = 0; x <= 4; x++)
    for (let z = 0; z <= 4; z++) {
      const edge = x === 0 || x === 4 || z === 0 || z === 4
      const corner = (x === 0 || x === 4) && (z === 0 || z === 4)
      if (corner) continue
      for (let y = -4; y <= 0; y++) c.set(x, y, z, edge ? stone() : state('minecraft:water'))
      if (edge) c.set(x, 1, z, stairs('minecraft:stone_brick_stairs', x === 0 ? 'east' : x === 4 ? 'west' : z === 0 ? 'south' : 'north', 'top'))
    }
  for (const z of [0, 4]) {
    for (let y = 1; y <= 3; y++) c.set(2, y, z, state('minecraft:spruce_fence'))
  }
  for (let z = 0; z <= 4; z++) c.set(2, 4, z, log('minecraft:stripped_spruce_log', 'z'))
  c.set(2, 3, 2, state('minecraft:chain', { axis: 'y' }))
  c.set(2, 2, 2, state('minecraft:chain', { axis: 'y' }))
  // A small two-sided thatch roof over the beam.
  for (let z = -1; z <= 5; z++) {
    c.set(1, 4, z, stairs('mcwroofs:thatch_roof', 'east'))
    c.set(3, 4, z, stairs('mcwroofs:thatch_roof', 'west'))
    c.set(2, 5, z, state('mcwroofs:thatch_top_roof'))
  }
  c.mark('water', 2, 0, 2)
}

/** The plaza fountain: a round two-tier basin of dressed stone with a carved column in the middle. */
function fountain(c) {
  const r = rng('fountain')
  const stone = mix(DRESSED_MIX, r)
  const R = 5
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z)
      if (d > R + 0.4) continue
      c.set(x, -1, z, stone())
      if (d > R - 0.6) {
        c.set(x, 0, z, stone())
        c.set(x, 1, z, slab('minecraft:smooth_stone_slab', 'bottom'))
      } else c.set(x, 0, z, state('minecraft:water'))
    }
  // A slim carved column in the middle with a lantern on top (a standing bowl reads as a mushroom).
  for (let y = 0; y <= 2; y++) c.set(0, y, 0, state('minecraft:stone_brick_wall'))
  c.set(0, 3, 0, state('minecraft:chiseled_stone_bricks'))
  c.set(0, 4, 0, state('minecraft:stone_brick_wall'))
  c.set(0, 5, 0, state('minecraft:lantern'))
  for (const [x, z, f] of [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']]) c.set(x, 3, z, stairs('minecraft:stone_brick_stairs', f === 'east' ? 'west' : f === 'west' ? 'east' : f === 'south' ? 'north' : 'south', 'top'))
  c.mark('centre', 0, 1, 0)
}

/** A street lamp (Macaw's classic lamp joins its parts into one post). */
function lamp(c, id = 'mcwlights:classic_street_lamp') {
  c.set(0, 0, 0, state('mcwpaths:stone_flagstone'))
  for (let y = 1; y <= 3; y++) c.set(0, y, 0, state(id))
}

/** A notice board for quests and news: two posts, a spruce board, a lantern on top. */
function noticeBoard(c) {
  // Two posts, a plank board on top of them (the sign hangs on its face), a slab cap with a lantern.
  for (const x of [0, 2]) c.set(x, 1, 0, state('minecraft:spruce_fence'))
  for (let x = 0; x <= 2; x++) {
    for (let y = 2; y <= 3; y++) c.set(x, y, 0, state('minecraft:spruce_planks'))
    c.set(x, 4, 0, slab('minecraft:spruce_slab', 'top'))
  }
  c.set(1, 3, 1, state('minecraft:spruce_wall_sign', { facing: 'south' }))
  c.set(1, 5, 0, state('minecraft:lantern'))
  c.mark('board', 1, 2, 1, { facing: 'south' })
}

export const buildings = [
  { name: 'town_well', kind: 'fixture', notes: 'covered well', build: well },
  { name: 'plaza_fountain', kind: 'fixture', notes: 'two-tier fountain, radius 5', build: fountain },
  { name: 'street_lamp', kind: 'fixture', notes: 'classic street lamp', build: (c) => lamp(c) },
  { name: 'street_lamp_double', kind: 'fixture', notes: 'double street lamp', build: (c) => lamp(c, 'mcwlights:double_street_lamp') },
  { name: 'notice_board', kind: 'fixture', notes: 'quest notice board', build: noticeBoard }
]
