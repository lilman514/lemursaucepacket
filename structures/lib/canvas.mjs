// A building is drawn into a Canvas: a sparse 3D grid of block states. x runs east, y up, z south; buildings are
// drawn with their front door facing south (+z) and rotated when placed. A position never set is left alone
// when the structure is placed (like structure void); air that is set clears whatever was there (terrain inside
// a house). toTemplate() turns the canvas into Minecraft's structure-template NBT.

import { AIR, key, state } from './blocks.mjs'
import { compound, encodeGzip, int, list, string } from './nbt.mjs'

export const DATA_VERSION = 3955 // Minecraft 1.21.1

export class Canvas {
  constructor(name) {
    this.name = name
    this.cells = new Map()
    this.entities = []
    this.marks = []
  }

  /** A named spot (door, npc, sign...) that placement code can find again; shifted with the template. */
  mark(name, x, y, z, data = {}) {
    this.marks.push({ name, pos: [x, y, z], ...data })
    return this
  }

  static k(x, y, z) {
    return `${x},${y},${z}`
  }

  /** Sets one block. `s` is a state, an id, or 'id[prop=value]'. `nbt` is block entity data (a compound). */
  set(x, y, z, s, nbt) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) throw new Error(`${this.name}: non-integer position ${x},${y},${z}`)
    this.cells.set(Canvas.k(x, y, z), { x, y, z, state: typeof s === 'string' ? state(s) : s, nbt })
    return this
  }

  get(x, y, z) {
    return this.cells.get(Canvas.k(x, y, z))?.state
  }

  has(x, y, z) {
    return this.cells.has(Canvas.k(x, y, z))
  }

  /** True when something solid-ish (not air, not unset) is there. */
  solid(x, y, z) {
    const s = this.get(x, y, z)
    return !!s && s.name !== 'minecraft:air'
  }

  remove(x, y, z) {
    this.cells.delete(Canvas.k(x, y, z))
    return this
  }

  /** Fills the box between two corners (inclusive). `s` may be a function (x, y, z) => state | null (skip). */
  fill(x1, y1, z1, x2, y2, z2, s) {
    const [ax, bx] = [Math.min(x1, x2), Math.max(x1, x2)]
    const [ay, by] = [Math.min(y1, y2), Math.max(y1, y2)]
    const [az, bz] = [Math.min(z1, z2), Math.max(z1, z2)]
    const fixed = typeof s === 'function' ? null : typeof s === 'string' ? state(s) : s
    for (let x = ax; x <= bx; x++)
      for (let y = ay; y <= by; y++)
        for (let z = az; z <= bz; z++) {
          const v = fixed ?? s(x, y, z)
          if (v) this.set(x, y, z, typeof v === 'string' ? state(v) : v)
        }
    return this
  }

  clear(x1, y1, z1, x2, y2, z2) {
    return this.fill(x1, y1, z1, x2, y2, z2, AIR)
  }

  /** Only sets positions that are unset or air (decoration that must not overwrite structure). */
  setIfEmpty(x, y, z, s) {
    const cur = this.get(x, y, z)
    if (!cur || cur.name === 'minecraft:air') this.set(x, y, z, s)
    return this
  }

  /** Replaces blocks matching `test(state)` inside the canvas. */
  replace(test, s) {
    for (const cell of this.cells.values()) if (test(cell.state, cell)) cell.state = typeof s === 'function' ? s(cell.state, cell) : typeof s === 'string' ? state(s) : s
    return this
  }

  /** Copies another canvas into this one at an offset. */
  stamp(other, dx = 0, dy = 0, dz = 0) {
    for (const c of other.cells.values()) this.set(c.x + dx, c.y + dy, c.z + dz, c.state, c.nbt)
    for (const e of other.entities) this.entities.push({ ...e, pos: [e.pos[0] + dx, e.pos[1] + dy, e.pos[2] + dz] })
    for (const m of other.marks) this.marks.push({ ...m, pos: [m.pos[0] + dx, m.pos[1] + dy, m.pos[2] + dz] })
    return this
  }

  bounds() {
    let min = [Infinity, Infinity, Infinity]
    let max = [-Infinity, -Infinity, -Infinity]
    for (const { x, y, z } of this.cells.values()) {
      min = [Math.min(min[0], x), Math.min(min[1], y), Math.min(min[2], z)]
      max = [Math.max(max[0], x), Math.max(max[1], y), Math.max(max[2], z)]
    }
    return { min, max, size: [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1] }
  }

  /** Counts of each block id (for the build report and material lists). */
  census() {
    const out = {}
    for (const { state: s } of this.cells.values()) if (s.name !== 'minecraft:air') out[s.name] = (out[s.name] ?? 0) + 1
    return out
  }

  /**
   * Minecraft's structure template: positions are shifted so the minimum corner is 0,0,0. Returns the NBT root and
   * the offset that was applied (so callers can say where, say, the door ended up).
   */
  toTemplate() {
    const { min, size } = this.bounds()
    const palette = []
    const index = new Map()
    const blocks = []
    const sorted = [...this.cells.values()].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x)
    for (const c of sorted) {
      const k = key(c.state)
      if (!index.has(k)) {
        index.set(k, palette.length)
        const props = Object.fromEntries(Object.entries(c.state.props).map(([pk, pv]) => [pk, string(pv)]))
        palette.push(compound(Object.keys(props).length ? { Name: string(c.state.name), Properties: compound(props) } : { Name: string(c.state.name) }))
      }
      const entry = { pos: list('int', [int(c.x - min[0]), int(c.y - min[1]), int(c.z - min[2])]), state: int(index.get(k)) }
      if (c.nbt) entry.nbt = c.nbt
      blocks.push(compound(entry))
    }
    const root = compound({
      DataVersion: int(DATA_VERSION),
      size: list('int', size.map((v) => int(v))),
      palette: list('compound', palette),
      blocks: list('compound', blocks),
      entities: list('compound', this.entities.map((e) => e.nbt))
    })
    const marks = this.marks.map((m) => ({ ...m, pos: [m.pos[0] - min[0], m.pos[1] - min[1], m.pos[2] - min[2]] }))
    return { root, offset: min, size, marks, paletteSize: palette.length, blockCount: blocks.length }
  }

  toNbtFile() {
    const t = this.toTemplate()
    return { bytes: encodeGzip(t.root), ...t }
  }
}
