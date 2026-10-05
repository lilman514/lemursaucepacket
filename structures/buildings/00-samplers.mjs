// Roof samplers: small huts showing each Macaw's roof pitch and material, odd and even spans, gable and hip.
// Not used in the world; they are for checking how the roof pieces join (see the bake previews).

import { state } from '../lib/blocks.mjs'
import { door, floor, gableRoof, hipRoof, hollow, walls } from '../lib/parts.mjs'

function hut(c, { roof, pitch = 'steep', kind = 'gable', ridge = 'x', w = 5, d = 5, h = 3, overhang = 1 }) {
  const x0 = 0
  const x1 = w - 1
  const z0 = 0
  const z1 = d - 1
  const plaster = state('minecraft:white_terracotta')
  floor(c, { x0, x1, z0, z1, y: 0 }, state('minecraft:cobblestone'))
  walls(c, { x0, x1, z0, z1, y0: 1, y1: h }, () => plaster)
  hollow(c, { x0: x0 + 1, x1: x1 - 1, z0: z0 + 1, z1: z1 - 1, y0: 1, y1: h + 8 })
  if (kind === 'gable') gableRoof(c, { x0, x1, z0, z1, y: h + 1, ridge, material: roof, pitch, overhang, gable: () => plaster })
  else hipRoof(c, { x0, x1, z0, z1, y: h + 1, material: roof, pitch, overhang })
  door(c, Math.floor(w / 2), 1, z1, 'minecraft:spruce_door', 'south')
}

const sample = (name, opts) => ({ name, kind: 'sampler', notes: JSON.stringify(opts), build: (c) => hut(c, opts) })

export const buildings = [
  sample('sample_thatch_normal', { roof: 'thatch', pitch: 'normal' }),
  sample('sample_thatch_steep', { roof: 'thatch', pitch: 'steep' }),
  sample('sample_thatch_low', { roof: 'thatch', pitch: 'low' }),
  sample('sample_thatch_steep_even', { roof: 'thatch', pitch: 'steep', d: 6 }),
  sample('sample_gray_steep_hip', { roof: 'gray', pitch: 'steep', kind: 'hip', w: 7, d: 5 }),
  sample('sample_black_normal_hip', { roof: 'black', pitch: 'normal', kind: 'hip', w: 5, d: 5 }),
  sample('sample_blue_steep', { roof: 'blue_terracotta', pitch: 'steep', ridge: 'z', w: 5, d: 7 }),
  sample('sample_oak_planks_steep', { roof: 'oak_planks', pitch: 'steep' }),
  sample('sample_spruce_normal', { roof: 'spruce', pitch: 'normal' }),
  sample('sample_stone_bricks_steep', { roof: 'stone_bricks', pitch: 'steep' })
]
