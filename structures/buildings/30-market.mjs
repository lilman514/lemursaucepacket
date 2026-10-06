// Ardougne-style market stalls: four posts, a sloping striped awning, a counter of barrels and crates with the
// goods on show, and a spot behind it for the stall's merchant (an NPC). Front (customers) is south.

import { log, propsOf, stairs, state } from '../lib/blocks.mjs'
import { rng } from '../lib/parts.mjs'

/** A block on show: upright if it can be (barrels), else turned to the customers (smokers, pots). 'id' or 'id[props]'. */
const shown = (g) => {
  const facings = propsOf(g.split('[')[0]).facing ?? []
  return state(g, facings.includes('up') ? { facing: 'up' } : facings.includes('south') ? { facing: 'south' } : {})
}

/**
 * A stall w wide (x) and 3 deep. The awning slopes down to the front with a one-block lip all round, in two
 * colours of Macaw's striped awning. `goods` are blocks shown on the counter, `back` behind it.
 */
function stall(name, { seed, w = 5, colour = 'red', goods, back = ['minecraft:barrel', 'minecraft:chest'], role = 'merchant', wood = 'spruce' }) {
  return {
    name,
    kind: 'stall',
    notes: `${colour} market stall (${role})`,
    build: (c) => {
      const r = rng(seed)
      const x0 = 0
      const x1 = w - 1
      // Posts: tall at the back, shorter at the front, so the awning slopes.
      for (const x of [x0, x1]) {
        for (let y = 1; y <= 5; y++) c.set(x, y, 0, state(`minecraft:${wood}_fence`))
        for (let y = 1; y <= 3; y++) c.set(x, y, 2, state(`minecraft:${wood}_fence`))
      }
      // The canopy: a continuous slope of Macaw's concrete roof in stripes (the striped awning block is a thin
      // flat strip, so it only makes the valance along the front).
      const rows = [
        [2, 4],
        [1, 5],
        [0, 6],
        [-1, 7]
      ]
      const stripe = [`mcwroofs:${colour}_concrete_roof`, 'mcwroofs:white_concrete_roof']
      for (const [z, y] of rows) for (let x = x0 - 1; x <= x1 + 1; x++) c.set(x, y, z, stairs(stripe[(x - x0 + 1) % 2], 'north'))
      for (let x = x0 - 1; x <= x1 + 1; x++) c.set(x, 4, 3, stairs(`mcwroofs:${colour}_striped_awning`, 'north'))
      // Beams carry the awning between the posts.
      for (let x = x0; x <= x1; x++) {
        c.set(x, 5, 0, log(`minecraft:stripped_${wood}_log`, 'x'))
        c.set(x, 3, 2, log(`minecraft:stripped_${wood}_log`, 'x'))
      }
      for (const x of [x0, x1]) c.set(x, 4, 1, log(`minecraft:stripped_${wood}_log`, 'z'))
      // Counter between the front posts with the goods on it; stock along the back.
      for (let x = x0 + 1; x <= x1 - 1; x++) {
        c.set(x, 1, 2, x === x0 + 1 || x === x1 - 1 ? state('minecraft:barrel', { facing: 'south' }) : state(`mcwfurnitures:${wood}_counter`, { facing: 'south' }))
        c.set(x, 2, 2, shown(goods[(x - x0 - 1) % goods.length]))
      }
      for (let x = x0 + 1; x <= x1 - 1; x++) {
        const id = back[(x + 1) % back.length]
        c.set(x, 1, 0, state(id, id.endsWith('chest') ? { facing: 'south' } : id.endsWith('barrel') ? { facing: 'up' } : {}))
      }
      c.set(x0 + Math.floor(w / 2), 4, 0, state('minecraft:lantern', { hanging: 'true' }))
      // Clear the merchant's spot.
      for (let x = x0 + 1; x <= x1 - 1; x++) for (let y = 1; y <= 3; y++) c.set(x, y, 1, state('minecraft:air'))
      c.mark('npc', x0 + Math.floor(w / 2), 1, 1, { role, facing: 'south' })
      void r
    }
  }
}

export const buildings = [
  stall('market_stall_fruit', { seed: 'fruit', colour: 'red', goods: ['minecraft:melon', 'minecraft:pumpkin', 'minecraft:hay_block'], role: 'fruit_seller' }),
  stall('market_stall_baker', { seed: 'baker', colour: 'yellow', goods: ['minecraft:cake', 'minecraft:hay_block', 'minecraft:cake'], role: 'baker' }),
  stall('market_stall_gems', { seed: 'gems', colour: 'purple', goods: ['minecraft:amethyst_block', 'minecraft:purple_stained_glass', 'minecraft:amethyst_block'], role: 'gem_trader' }),
  stall('market_stall_cloth', { seed: 'cloth', colour: 'blue', w: 6, goods: ['minecraft:white_wool', 'minecraft:red_wool', 'minecraft:blue_wool', 'minecraft:yellow_wool'], role: 'tailor' }),
  stall('market_stall_fish', { seed: 'fish', colour: 'cyan', w: 4, goods: ['minecraft:dried_kelp_block', 'minecraft:barrel', 'minecraft:dried_kelp_block'], role: 'fishmonger', back: ['minecraft:barrel', 'minecraft:barrel'] }),
  stall('market_stall_spice', { seed: 'spice', colour: 'orange', goods: ['minecraft:decorated_pot', 'minecraft:flower_pot', 'minecraft:decorated_pot'], role: 'spice_merchant' }),
  stall('market_stall_flowers', { seed: 'flowers', colour: 'pink', goods: ['minecraft:potted_flowering_azalea_bush', 'minecraft:moss_block', 'minecraft:potted_red_tulip'], role: 'flower_seller' }),
  stall('market_stall_butcher', { seed: 'butcher', colour: 'brown', goods: ['minecraft:smoker[lit=true]', 'minecraft:barrel', 'minecraft:smoker[lit=true]'], role: 'butcher' })
]
