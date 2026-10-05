// Cottages: Lumbridge's rough-stone cottages and Draynor's and Seers' timber-framed ones, all under steep thatch.
// Each variant is a house() spec with its own size, window layout, chimney side and furnishing.

import { log, state } from '../lib/blocks.mjs'
import { house } from '../lib/house.mjs'
import { bed, chair, rng, table } from '../lib/parts.mjs'

/** A one-room cottage: bed and chest at the back, table and chairs, a cooking corner, a lantern. */
function cottageRoom(wood, bedColor, r) {
  return (c, box) => {
    const { x0, x1, z0, z1, y } = box
    const left = r.chance(0.5)
    const bx = left ? x0 : x1
    const ox = left ? x1 : x0
    const inward = left ? 1 : -1
    bed(c, bx, y, z0 + 1, 'north', bedColor)
    c.set(bx, y, z0 + 2, state('minecraft:chest', { facing: left ? 'east' : 'west' }))
    c.set(bx + inward, y, z0, state('minecraft:spruce_trapdoor', { half: 'top', facing: 'south' })) // a bedside shelf
    c.set(bx + inward, y + 1, z0, state('minecraft:candle', { lit: 'true', candles: '2' }))
    // Table with two chairs and a lantern on it.
    const tx = ox - inward
    table(c, tx, y, z0 + 1, wood)
    c.set(tx, y + 1, z0 + 1, state('minecraft:lantern'))
    chair(c, tx, y, z0 + 2, wood, 'north')
    chair(c, ox, y, z0 + 1, wood, left ? 'west' : 'east')
    // Cooking corner by the front wall.
    c.set(ox, y, z1, state('minecraft:smoker', { facing: left ? 'west' : 'east' }))
    c.set(ox, y, z1 - 1, state('minecraft:crafting_table'))
    c.set(bx, y, z1, state('minecraft:barrel', { facing: 'up' }))
    c.set(bx, y + 1, z1, state(r.pick(['minecraft:potted_red_tulip', 'minecraft:potted_oxeye_daisy', 'minecraft:potted_fern'])))
    // A rug in the middle.
    const rug = r.pick(['brown', 'red', 'green', 'light_gray'])
    for (let x = x0 + 1; x <= x1 - 1; x++) for (let z = z0 + 2; z <= z1 - 1; z++) if (!c.solid(x, y, z)) c.set(x, y, z, state(`minecraft:${rug}_carpet`))
  }
}

/**
 * A cottage: w x d, rough stone or timber framed, steep thatch with the ridge along x (door on the long side),
 * windows either side of the door, gable windows, a chimney on one gable.
 */
function cottage(name, { seed, w = 9, d = 7, walls = 'stone', roof = 'thatch', wood = 'spruce', bedColor = 'red', chimney = 'west', door = 'mcwdoors:oak_cottage_door' }) {
  return {
    name,
    kind: 'house',
    notes: `${walls} cottage ${w}x${d}, ${roof} roof`,
    build: (c) => {
      const r = rng(seed)
      const mid = Math.floor(w / 2)
      const sideZ = Math.floor(d / 2)
      const shutter = `mcwwindows:${wood}_shutter`
      house(c, {
        w,
        d,
        r,
        floor: `minecraft:${wood}_planks`,
        storeys: [{ h: 4, walls }],
        roof: { material: roof, pitch: 'steep', ridge: 'x', overhang: 1, gable: walls === 'stone' ? 'stone' : 'timber' },
        door: { x: mid, id: door, paving: 'mcwpaths:gravel_path_block', path: 3 },
        windows: [
          { wall: 'south', at: mid - 2, shutters: shutter, flowers: true },
          { wall: 'south', at: mid + 2, shutters: shutter, flowers: true },
          { wall: 'east', at: sideZ },
          { wall: 'west', at: sideZ },
          { wall: 'north', at: mid }
        ],
        chimney: { wall: chimney, at: sideZ },
        interior: cottageRoom(wood, bedColor, r)
      })
      // A small window high in each gable lights the loft.
      for (const x of [0, w - 1]) c.set(x, 7, sideZ, state('mcwwindows:spruce_window', { facing: 'east' }))
      // Firewood stacked against the chimney gable.
      const fx = chimney === 'west' ? -1 : w
      for (const z of [sideZ - 2, sideZ + 2]) if (z >= 0 && z < d) c.set(fx, 1, z, log('minecraft:spruce_log', 'z'))
    }
  }
}

export const buildings = [
  cottage('lumbridge_cottage', { seed: 'lumbridge_cottage', walls: 'stone', chimney: 'west' }),
  cottage('lumbridge_cottage_long', { seed: 'lumbridge_cottage_long', w: 11, walls: 'stone', chimney: 'east', bedColor: 'blue' }),
  cottage('draynor_cottage', { seed: 'draynor_cottage', walls: 'timber', chimney: 'east', bedColor: 'green', door: 'mcwdoors:dark_oak_cottage_door' }),
  cottage('seers_cottage', { seed: 'seers_cottage', w: 9, d: 7, walls: 'timber', roof: 'thatch', wood: 'oak', chimney: 'west', bedColor: 'yellow' })
]

// Seeded variants: sizes, wall types, woods, roofs and doors mixed so a street of them never repeats.
const COTTAGE_ROOFS = ['thatch', 'thatch', 'thatch', 'thatch', 'dark_oak', 'spruce', 'brown_terracotta']
for (let i = 1; i <= 10; i++) {
  const r = rng(`cottage_variant_${i}`)
  buildings.push(
    cottage(`cottage_${String(i).padStart(2, '0')}`, {
      seed: `cottage_${i}`,
      w: r.pick([7, 9, 9, 11]),
      d: r.pick([7, 7, 9]),
      walls: r.pick(['stone', 'timber', 'timber']),
      roof: r.pick(COTTAGE_ROOFS),
      wood: r.pick(['spruce', 'oak', 'dark_oak']),
      chimney: r.pick(['east', 'west']),
      bedColor: r.pick(['red', 'blue', 'green', 'yellow', 'cyan', 'brown']),
      door: r.pick(['mcwdoors:oak_cottage_door', 'mcwdoors:dark_oak_cottage_door', 'mcwdoors:birch_cottage_door'])
    })
  )
}
