// Block states for the structure toolkit, checked against structures/.blocks.json: a dump of every block the pack
// registers, with its properties, their values and the default state (re-dump it after adding a mod that adds
// blocks; see structures/README.md). A typo in a block id or a property fails the build instead of placing air.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const REGISTRY = JSON.parse(readFileSync(path.join(here, '..', '.blocks.json'), 'utf8'))

export const known = (id) => id in REGISTRY
export const propsOf = (id) => REGISTRY[id]?.props ?? {}

/**
 * A block state: { name, props } with every property the block has (defaults filled in) so that two states that
 * mean the same block compare equal. Accepts 'minecraft:oak_stairs[facing=north]', an id plus props, or a state.
 */
export function state(idOrString, props = {}) {
  if (typeof idOrString === 'object') return idOrString
  let id = idOrString
  let given = { ...props }
  const bracket = id.indexOf('[')
  if (bracket >= 0) {
    for (const kv of id.slice(bracket + 1, -1).split(',').filter(Boolean)) {
      const [k, v] = kv.split('=')
      if (!(k in given)) given[k] = v
    }
    id = id.slice(0, bracket)
  }
  if (!id.includes(':')) id = `minecraft:${id}`
  const entry = REGISTRY[id]
  if (!entry) throw new Error(`unknown block ${id}`)
  const out = { ...entry.default }
  for (const [k, raw] of Object.entries(given)) {
    if (raw === undefined || raw === null) continue
    const v = String(raw)
    const values = entry.props[k]
    if (!values) throw new Error(`${id} has no property ${k} (has: ${Object.keys(entry.props).join(', ') || 'none'})`)
    if (!values.includes(v)) throw new Error(`${id}: ${k}=${v} is not one of ${values.join('|')}`)
    out[k] = v
  }
  return { name: id, props: out }
}

export const key = (s) => `${s.name}[${Object.entries(s.props).map(([k, v]) => `${k}=${v}`).join(',')}]`
export const AIR = state('minecraft:air')
export const isAir = (s) => s.name === 'minecraft:air' || s.name === 'minecraft:cave_air'

// ---------------------------------------------------------------- directions

export const DIRS = ['north', 'east', 'south', 'west']
export const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' }
export const STEP = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] }
export const CW = { north: 'east', east: 'south', south: 'west', west: 'north' }
export const CCW = { north: 'west', west: 'south', south: 'east', east: 'north' }
export const AXIS = { north: 'z', south: 'z', east: 'x', west: 'x' }

/** Sets a property only when the block has it (so one helper serves blocks with and without, say, waterlogged). */
export function withProps(s, props) {
  const out = { ...s.props }
  const all = propsOf(s.name)
  for (const [k, v] of Object.entries(props)) if (k in all && v !== undefined) out[k] = String(v)
  return state(s.name, out)
}

// ---------------------------------------------------------------- common shapes

/** Stairs (and Macaw's stair-like roofs): `facing` is the side the tall back is on, i.e. the way it climbs. */
export function stairs(id, facing, half = 'bottom', shape = 'straight') {
  const has = propsOf(id.includes(':') ? id : `minecraft:${id}`)
  return state(id, { facing, ...('half' in has ? { half } : {}), ...('shape' in has ? { shape } : {}) })
}
export const slab = (id, type = 'bottom') => state(id, { type })
export const log = (id, axis = 'y') => state(id, { axis })
export const facing = (id, dir, extra = {}) => state(id, { facing: dir, ...extra })
