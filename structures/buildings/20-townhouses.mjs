// Varrock townhouses: a dressed-stone ground floor, a jettied timber-framed upper floor on corbels, and a steep
// slate roof with its gable to the street. The shop variant has a wide front window, a counter and a hanging sign.

import { log, state } from '../lib/blocks.mjs'
import { house } from '../lib/house.mjs'
import { bed, chair, rng, table } from '../lib/parts.mjs'
import { byte, compound, list, string } from '../lib/nbt.mjs'

const signText = (lines) =>
  compound({
    messages: list('string', [0, 1, 2, 3].map((i) => string(JSON.stringify({ text: lines[i] ?? '' })))),
    color: string('black'),
    has_glowing_text: byte(0)
  })

/** A hanging shop sign on a short beam sticking out of the front wall above the door. */
function shopSign(c, x, y, z, lines, wood = 'spruce') {
  c.set(x, y, z + 1, log(`minecraft:stripped_${wood}_log`, 'z'))
  c.set(x, y - 1, z + 1, state(`minecraft:${wood}_hanging_sign`, { attached: 'false', rotation: '0' }), compound({ id: string('minecraft:hanging_sign'), front_text: signText(lines), back_text: signText(lines), is_waxed: byte(1) }))
}

function homeUpstairs(wood, r) {
  return (c, box, i) => {
    const { x0, x1, z0, z1, y } = box
    if (i === 0) {
      // Kitchen and hearth downstairs, a ladder up in the back corner.
      for (let k = 0; k < 4; k++) c.set(x1, y + k, z0, state('minecraft:ladder', { facing: 'west' }))
      c.set(x1, y + 4, z0, state('minecraft:air'))
      table(c, x0 + 1, y, z0 + 2, wood)
      chair(c, x0 + 1, y, z0 + 3, wood, 'north')
      chair(c, x0 + 1, y, z0 + 1, wood, 'south')
      c.set(x0 + 1, y + 1, z0 + 2, state('minecraft:lantern'))
      c.set(x0, y, z0, state('minecraft:furnace', { facing: 'east' }))
      c.set(x0, y, z0 + 1, state('minecraft:barrel', { facing: 'east' }))
      c.set(x1, y, z1, state('minecraft:crafting_table'))
    } else {
      bed(c, x0, y, z0 + 1, 'north', r.pick(['red', 'blue', 'green', 'cyan']))
      c.set(x0 + 1, y, z0, state('minecraft:chest', { facing: 'south' }))
      c.set(x0 + 2, y, z0, state(`mcwfurnitures:${wood}_wardrobe`, { facing: 'south' }))
      c.set(x1, y, z1, state('minecraft:bookshelf'))
      c.set(x1, y, z1 - 1, state('minecraft:bookshelf'))
      c.set(x1 - 1, y, z1, state(`mcwfurnitures:${wood}_desk`, { facing: 'north' }))
      c.set(x1 - 1, y + 1, z1, state('minecraft:candle', { lit: 'true', candles: '3' }))
    }
  }
}

function shopFloor(wood, goods) {
  return (c, box, i) => {
    const { x0, x1, z0, z1, y } = box
    if (i === 0) {
      // A counter across the room, shelves behind it, the keeper's spot between.
      for (let x = x0; x <= x1; x++) if (x !== x0) c.set(x, y, z0 + 2, state(`mcwfurnitures:${wood}_counter`, { facing: 'south' }))
      for (let x = x0; x <= x1; x++) c.set(x, y, z0, state('minecraft:barrel', { facing: 'south' }))
      for (let x = x0 + 1; x <= x1; x += 2) c.set(x, y + 1, z0, state(goods[x % goods.length]))
      c.set(x0 + 2, y + 1, z0 + 2, state('minecraft:lantern'))
      c.mark('npc', x0 + 2, y, z0 + 1, { role: 'shopkeeper', facing: 'south' })
      for (let k = 0; k < 4; k++) c.set(x0, y + k, z0 + 1, state('minecraft:ladder', { facing: 'east' }))
    } else {
      bed(c, x1, y, z0 + 1, 'north', 'brown')
      c.set(x1 - 1, y, z0, state('minecraft:chest', { facing: 'south' }))
      c.set(x0 + 1, y, z1, state('minecraft:barrel', { facing: 'up' }))
    }
  }
}

/** A two-storey Varrock townhouse, w wide on the street (south), d deep. */
function townhouse(name, { seed, w = 7, d = 9, roof = 'gray', shop = null, storeys = 2, wood = 'spruce' }) {
  return {
    name,
    kind: shop ? 'shop' : 'house',
    notes: `${storeys}-storey townhouse ${w}x${d}, ${roof} roof${shop ? `, shop "${shop.lines.join(' ')}"` : ''}`,
    build: (c) => {
      const r = rng(seed)
      const mid = Math.floor(w / 2)
      const upper = { h: 4, walls: 'timber', jetty: { south: 1 }, postEvery: 2 }
      const spec = {
        w,
        d,
        r,
        floor: `minecraft:${wood}_planks`,
        storeys: [{ h: 4, walls: 'dressed' }, upper, ...(storeys > 2 ? [{ h: 4, walls: 'timber', jetty: { south: 1 }, postEvery: 2 }] : [])],
        roof: { material: roof, pitch: 'steep', ridge: 'z', overhang: 1, gable: 'timber' },
        door: { x: mid, id: shop ? 'mcwdoors:spruce_classic_door' : 'mcwdoors:spruce_stable_door' },
        windows: [
          ...(shop ? [] : [{ wall: 'south', at: mid - 2, shutters: 'mcwwindows:dark_oak_shutter', flowers: true }, { wall: 'south', at: mid + 2, shutters: 'mcwwindows:dark_oak_shutter', flowers: true }]),
          { wall: 'east', at: 3 },
          { wall: 'west', at: 5 },
          { wall: 'south', at: 1, storey: 1 },
          { wall: 'south', at: mid, storey: 1 },
          { wall: 'south', at: w - 2, storey: 1 },
          { wall: 'east', at: 5, storey: 1 },
          { wall: 'west', at: 3, storey: 1 },
          ...(storeys > 2 ? [{ wall: 'south', at: mid - 1, storey: 2 }, { wall: 'south', at: mid + 1, storey: 2 }] : [])
        ],
        chimney: { wall: 'east', at: 2 },
        interior: shop ? shopFloor(wood, shop.goods) : homeUpstairs(wood, r)
      }
      house(c, spec)
      if (shop) {
        // A wide shop window either side of the door, with a display ledge outside.
        for (const x of [1, 2, w - 3, w - 2]) {
          for (const y of [1, 2]) c.set(x, y, d - 1, state('mcwwindows:spruce_window', { facing: 'north' }))
          c.set(x, 0, d, state('minecraft:spruce_slab', { type: 'top' }))
        }
        shopSign(c, mid + 2, 4, d - 1, shop.lines)
      }
    }
  }
}

const pad = (i) => String(i).padStart(2, '0')
export const buildings = [
  townhouse('varrock_townhouse', { seed: 'varrock_townhouse', roof: 'gray' }),
  townhouse('varrock_townhouse_tall', { seed: 'varrock_townhouse_tall', roof: 'black', storeys: 3, w: 7, d: 9 }),
  townhouse('varrock_general_store', {
    seed: 'varrock_general_store',
    roof: 'gray',
    shop: { lines: ['', 'General', 'Store', ''], goods: ['minecraft:hay_block', 'minecraft:melon', 'minecraft:pumpkin', 'minecraft:barrel'] }
  })
]

// Seeded variants: widths, depths, storeys, woods and roofs (Varrock slate, Ardougne tile, dark shingle).
const TOWN_ROOFS = ['gray', 'gray', 'black', 'deepslate', 'brown_terracotta', 'red_terracotta', 'dark_oak']
for (let i = 1; i <= 10; i++) {
  const r = rng(`townhouse_variant_${i}`)
  buildings.push(townhouse(`townhouse_${pad(i)}`, { seed: `townhouse_${i}`, w: r.pick([7, 7, 9]), d: r.pick([9, 9, 11]), roof: r.pick(TOWN_ROOFS), storeys: r.pick([2, 2, 3]), wood: r.pick(['spruce', 'dark_oak', 'oak']) }))
}

// Shops: the same townhouse with a shop front, a sign and goods on the shelves.
const SHOPS = [
  ['shop_smithy', ['', "Smith's", 'Forge', ''], ['minecraft:anvil', 'minecraft:iron_block', 'minecraft:grindstone', 'minecraft:smithing_table'], 'black'],
  ['shop_tailor', ['', 'Tailor', '', ''], ['minecraft:white_wool', 'minecraft:red_wool', 'minecraft:blue_wool', 'minecraft:loom'], 'brown_terracotta'],
  ['shop_apothecary', ['', 'Apothecary', '', ''], ['minecraft:brewing_stand', 'minecraft:cauldron', 'minecraft:flower_pot', 'minecraft:brewing_stand'], 'red_terracotta'],
  ['shop_fishing', ['', 'Fishing', 'Supplies', ''], ['minecraft:barrel', 'minecraft:dried_kelp_block', 'minecraft:barrel', 'minecraft:dried_kelp_block'], 'gray'],
  ['shop_builder', ['', "Builder's", 'Merchant', ''], ['minecraft:bricks', 'minecraft:stone_bricks', 'minecraft:oak_planks', 'minecraft:scaffolding'], 'deepslate'],
  ['shop_jeweller', ['', 'Jeweller', '', ''], ['minecraft:amethyst_block', 'minecraft:gold_block', 'minecraft:amethyst_block', 'minecraft:lapis_block'], 'dark_oak']
]
for (const [name, lines, goods, roof] of SHOPS) buildings.push(townhouse(name, { seed: name, roof, shop: { lines, goods }, w: 7, d: 9 }))
