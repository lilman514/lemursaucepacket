// The Crandor memorial: a small round shrine at the foot of Elvarg's hill, where Ned keeps watch and keeps the things
// of those who fall up there. A deepslate dais carries the skull of a dragon slain long ago (an Ice and Fire skull,
// added by lsp_fixes after the building), soul lanterns burn on four pillars, and a sign remembers the fallen. Ned's
// corner (bench, barrel, lamp post) is to the south-east, the waystone (placed by lsp_fixes) to the south-west.
// Front (the way visitors come) is south; the den is behind it, to the north.

import { slab, stairs, state } from '../lib/blocks.mjs'
import { DRESSED_MIX, FOUNDATION_MIX } from '../lib/house.mjs'
import { mix, rng } from '../lib/parts.mjs'
import { byte, compound, list, string } from '../lib/nbt.mjs'

const signText = (lines) =>
  compound({
    messages: list('string', [0, 1, 2, 3].map((i) => string(JSON.stringify({ text: lines[i] ?? '' })))),
    color: string('black'),
    has_glowing_text: byte(0)
  })

function memorial(c) {
  const r = rng('crandor_memorial')
  const dressed = mix(DRESSED_MIX, r)
  const footing = mix(FOUNDATION_MIX, r)
  const R = 6
  // The platform: a round of dressed stone with a mossy rim, on a footing that fills any dip in the ground.
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z)
      if (d > R + 0.4) continue
      for (let y = -4; y <= -1; y++) c.set(x, y, z, footing())
      c.set(x, 0, z, d > R - 0.6 ? state(r() < 0.5 ? 'minecraft:mossy_stone_bricks' : 'minecraft:mossy_cobblestone') : dressed())
      for (let y = 1; y <= 9; y++) c.set(x, y, z, state('minecraft:air'))
    }
  // The path in from the south to the dais.
  for (let z = 3; z <= R; z++) for (let x = -1; x <= 1; x++) c.set(x, 0, z, state('minecraft:polished_andesite'))

  // The dais: polished deepslate, stepped all round, its corners carrying candles and poppies.
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) {
      const edge = Math.abs(x) === 2 || Math.abs(z) === 2
      const corner = Math.abs(x) === 2 && Math.abs(z) === 2
      if (!edge) c.set(x, 1, z, state('minecraft:polished_deepslate'))
      else if (corner) c.set(x, 1, z, state('minecraft:chiseled_deepslate'))
      else c.set(x, 1, z, stairs('minecraft:polished_deepslate_stairs', Math.abs(x) === 2 ? (x > 0 ? 'west' : 'east') : z > 0 ? 'north' : 'south'))
    }
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) c.set(x, 2, z, x < 0 === z < 0 ? state('minecraft:potted_poppy') : state('minecraft:candle', { candles: '3', lit: 'true' }))
  c.mark('skull', 0, 2, 0, { facing: 'south' })

  // Four pillars with soul lanterns.
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
    c.set(x, 1, z, state('minecraft:chiseled_deepslate'))
    for (let y = 2; y <= 3; y++) c.set(x, y, z, state('minecraft:deepslate_brick_wall'))
    c.set(x, 4, z, state('minecraft:soul_lantern'))
  }

  // A low wall round the back half (the den side), broken where the path to the den leaves.
  for (let x = -R; x <= R; x++)
    for (let z = -R; z <= 0; z++) {
      const d = Math.hypot(x, z)
      if (d < R - 0.6 || d > R + 0.4 || Math.abs(x) <= 1) continue
      c.set(x, 1, z, state('minecraft:stone_brick_wall'))
    }

  // The sign, in front of the dais.
  c.set(0, 1, 3, state('minecraft:dark_oak_sign', { rotation: '0' }), compound({
    id: string('minecraft:sign'),
    front_text: signText(['In memory of', 'all who went up', 'the hill to Elvarg', '- Ned']),
    back_text: signText(['', 'Crandor', '', '']),
    is_waxed: byte(1)
  }))

  // Ned's corner: a bench against a barrel, a lamp post.
  c.set(5, 1, 2, stairs('minecraft:spruce_stairs', 'east'))
  c.set(5, 1, 1, stairs('minecraft:spruce_stairs', 'east'))
  c.set(4, 1, 0, state('minecraft:barrel', { facing: 'up' }))
  c.set(3, 1, 3, state('minecraft:spruce_fence'))
  c.set(3, 2, 3, state('minecraft:spruce_fence'))
  c.set(3, 3, 3, state('minecraft:lantern'))
  c.set(4, 1, 1, slab('minecraft:spruce_slab', 'bottom'))
  c.mark('npc', 4, 1, 3, { role: 'keeper', facing: 'south' })
  c.mark('waystone', -3, 1, 3, { facing: 'south' })
  c.mark('front', 0, 1, R + 2)
}

export const buildings = [{ name: 'crandor_memorial', kind: 'fixture', notes: "Crandor memorial: Ned's post below Elvarg's den", build: memorial }]
