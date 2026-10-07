// Armour as worn: the 64x32 layer textures of the pack's armour, painted in code set by set, so each set reads at a
// glance on a player across the street: the Prospector's steel and brass with a miner's lamp, the Aeronaut's
// flight leathers and goggles, the Brass Duelist's gilded plate with a crimson plume and sash, Compacted Diamond's
// faceted crystal in gold settings, Compacted Netherite's dark plate with glowing seams, and the two single
// pieces (the Angler's Cap, the Ember Crown).
//
// How a layer is made:
//   1. Coverage: which texels of vanilla's armour layout are worn (vanilla iron's, or netherite's for netherite),
//      plus or minus a set's own shapes: a visor, goggles, ear flaps, full sleeves.
//   2. A base material, shaded like vanilla metal (vanilla's own brightness pattern ranked onto a 6-step ramp),
//      with a bevel: the top and left rim of each plate catch the light, the bottom and right rim fall into shade.
//   3. The set's details on top: trims, rivets, straps, lenses, plumes, glowing seams.
//
// Layer 1 holds the helmet (head box), chestplate (body and arm boxes) and boots (leg box, lower part); layer 2 the
// leggings (body box, waist; leg box, upper part). Box UVs are vanilla's: head 0,0 8x8x8; body 16,16 8x12x4;
// arm 40,16 4x12x4; leg 0,16 4x12x4. Faces of a box at u,v (w,h,d): top u+d,v; bottom u+d+w,v; right u,v+d;
// front u+d,v+d; left u+d+w,v+d; back u+2d+w,v+d.
//
// Run: node art/armor-px.mjs [--preview out.png]  (needs the 1.21.1 client jar for vanilla's coverage and shading;
// set MINECRAFT_JAR if it isn't at the default scratch path). art/process.mjs armorLayers calls buildArmor().

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { unzipSync } from 'fflate'
import { RAMPS } from './items.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(root, 'pack/kubejs/assets/lemursaucepacket/textures/models/armor')
const JAR =
  process.env.MINECRAFT_JAR ??
  path.join(process.env.LOCALAPPDATA ?? '', 'Temp', 'claude', 'C--Create-Modpack', 'ab1859ba-46fb-401e-9816-544fdbbd5524', 'scratchpad', 'headless', 'minecraft', 'versions', '1.21.1', '1.21.1.jar')

const W = 64
const H = 32
const BOXES = {
  head: { u: 0, v: 0, w: 8, h: 8, d: 8 },
  body: { u: 16, v: 16, w: 8, h: 12, d: 4 },
  arm: { u: 40, v: 16, w: 4, h: 12, d: 4 },
  leg: { u: 0, v: 16, w: 4, h: 12, d: 4 }
}
const PARTS = { 1: ['head', 'body', 'arm', 'leg'], 2: ['body', 'leg'] }

function faceRects(b) {
  return {
    top: [b.u + b.d, b.v, b.w, b.d],
    bottom: [b.u + b.d + b.w, b.v, b.w, b.d],
    right: [b.u, b.v + b.d, b.d, b.h],
    front: [b.u + b.d, b.v + b.d, b.w, b.h],
    left: [b.u + b.d + b.w, b.v + b.d, b.d, b.h],
    back: [b.u + 2 * b.d + b.w, b.v + b.d, b.w, b.h]
  }
}

/** Where a texel is: { part, face, fx, fy, fw, fh }, or null outside every face of the layer's parts. */
function locate(layer, x, y) {
  for (const part of PARTS[layer]) {
    for (const [face, [fx0, fy0, fw, fh]] of Object.entries(faceRects(BOXES[part]))) {
      if (x >= fx0 && x < fx0 + fw && y >= fy0 && y < fy0 + fh) return { part, face, fx: x - fx0, fy: y - fy0, fw, fh }
    }
  }
  return null
}

// ---------------------------------------------------------------- vanilla coverage and shading

async function vanillaLayers() {
  if (!existsSync(JAR)) throw new Error(`armour: Minecraft 1.21.1 client jar not found at ${JAR} (set MINECRAFT_JAR)`)
  const names = ['iron', 'netherite', 'diamond', 'leather'].flatMap((m) => [1, 2].map((l) => `assets/minecraft/textures/models/armor/${m}_layer_${l}.png`))
  const zip = unzipSync(readFileSync(JAR), { filter: (f) => names.includes(f.name) })
  const out = {}
  for (const [name, bytes] of Object.entries(zip)) {
    const { data } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    out[path.basename(name, '.png')] = data
  }
  return out
}

/** Vanilla's brightness at each texel as -1, 0 or +1 (its grain and bevels), from a layer's own range. */
function grainOf(rgba) {
  const lum = []
  for (let i = 0; i < W * H; i++) lum.push(rgba[i * 4 + 3] > 0 ? 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2] : null)
  const seen = lum.filter((l) => l != null).sort((a, b) => a - b)
  const lo = seen[Math.floor(seen.length * 0.25)]
  const hi = seen[Math.floor(seen.length * 0.8)]
  return lum.map((l) => (l == null ? 0 : l >= hi ? 1 : l < lo ? -1 : 0))
}

// ---------------------------------------------------------------- the sets

// A set's `cover(c)` returns true/false to add or remove a texel from vanilla's coverage (undefined keeps it);
// `paint(c)` returns [ramp, tone], or null for the base material. c = { layer, part, face, fx, fy, fw, fh, slot }.
// `low` and `high` give a face's lowest and highest covered rows (for rims and trims).
const helmetFrontRows = (c, rows) => c.part === 'head' && c.face === 'front' && rows.includes(c.fy)
const sideFaces = ['right', 'left', 'back', 'front']

export const SETS = {
  prospector: {
    base: 'steel',
    cover: (c) => {
      // A full brim round the head and a lamp on the brow.
      if (c.part === 'head' && sideFaces.includes(c.face) && c.fy <= 3 && c.face !== 'front') return true
      if (c.part === 'head' && c.face === 'front') return c.fy <= 2
      return undefined
    },
    paint: (c) => {
      if (c.part === 'head') {
        if (c.face === 'front') {
          // The lamp: a brass ring round a bright lens in the middle of the brow.
          if (c.fy === 1 && (c.fx === 3 || c.fx === 4)) return ['lamp', 5]
          if (c.fy <= 2 && c.fx >= 2 && c.fx <= 5) return ['brass', c.fy === 0 ? 4 : 3]
          if (c.fy === 2) return ['brass', 2]
        }
        if (c.face === 'top' && (c.fx === 3 || c.fx === 4)) return ['brass', 4]
        if (c.fy === c.high && c.face !== 'top') return ['brass', c.fx % 3 === 1 ? 4 : 3]
        if (c.face !== 'top' && c.fy === c.high - 1 && (c.fx === 1 || c.fx === c.fw - 2)) return ['brass', 4]
      }
      if (c.part === 'body' && c.layer === 1) {
        // A leather bandolier across the chest and back, with a brass buckle; a brass hem.
        if (c.face === 'front' || c.face === 'back') {
          const k = c.face === 'front' ? c.fx + c.fy : 7 - c.fx + c.fy
          if (k === 6 && c.fy === 3) return ['brass', 5]
          if (k === 6 || k === 7) return ['leather', k === 6 ? 3 : 2]
        }
        if (c.fy === c.high) return ['brass', c.fx % 2 === 0 ? 4 : 3]
        if (c.face === 'front' && c.fy === 0) return ['brass', 3]
      }
      if (c.part === 'arm') {
        if (c.fy === c.high) return ['brass', 3]
        if (c.face === 'top') return null
        if (c.fy === 1 && c.fx === 1) return ['brass', 5]
      }
      if (c.part === 'leg' && c.layer === 1) {
        // Boots: steel with brass toe caps and a brass cuff.
        if (c.fy === c.low) return ['brass', 4]
        if (c.face === 'front' && c.fy >= c.fh - 2) return ['brass', c.fy === c.fh - 1 ? 2 : 3]
        if (c.face === 'bottom') return ['darksteel', 2]
      }
      if (c.part === 'body' && c.layer === 2) {
        // A leather belt with a brass buckle.
        if (c.face === 'front' && (c.fx === 3 || c.fx === 4)) return ['brass', 4]
        return ['leather', c.fy === c.low ? 3 : 2]
      }
      if (c.part === 'leg' && c.layer === 2) {
        // Brass knee plates.
        if ((c.face === 'front' || c.face === 'right' || c.face === 'left') && (c.fy === 4 || c.fy === 5)) return ['brass', c.fy === 4 ? 4 : 3]
      }
      return null
    }
  },

  aeronaut: {
    base: 'leather',
    cover: (c) => {
      if (c.part === 'head') {
        // A flight cap: crown, back and ear flaps; goggles on the brow, the face left open below them.
        if (c.face === 'front') return c.fy <= 3
        if (c.face === 'back') return c.fy <= 6
        if (c.face === 'right' || c.face === 'left') {
          const front = c.face === 'right' ? c.fw - 1 - c.fx : c.fx
          return c.fy <= 3 || (front >= 2 && front <= 5 && c.fy <= 7)
        }
      }
      // A jacket with full sleeves.
      if (c.part === 'arm' && c.layer === 1) return true
      if (c.part === 'body' && c.layer === 1 && c.face !== 'bottom') return true
      return undefined
    },
    paint: (c) => {
      if (c.part === 'head') {
        if (c.face === 'front') {
          // Brass-rimmed goggles: two lenses.
          const lens = (c.fx === 1 || c.fx === 2 || c.fx === 5 || c.fx === 6) && (c.fy === 1 || c.fy === 2)
          if (lens) return ['glass', c.fy === 1 && (c.fx === 1 || c.fx === 5) ? 5 : c.fy === 1 ? 4 : 3]
          if (c.fy <= 3) return ['brass', c.fy === 0 ? 4 : c.fy === 3 ? 2 : 3]
        }
        // The goggle strap round the head, and fleece at the rim of the flaps.
        if ((c.face === 'right' || c.face === 'left' || c.face === 'back') && (c.fy === 1 || c.fy === 2)) return ['darksteel', c.fy === 1 ? 3 : 2]
        if (c.fy === c.high && c.face !== 'top') return ['fleece', 4]
        if (c.face === 'top' && (c.fy === 0 || c.fy === 7)) return ['leather', 2]
      }
      if (c.part === 'body' && c.layer === 1) {
        // Fleece collar, a brass-buttoned front, two pockets.
        if (c.face === 'top' || c.fy <= 1) return ['fleece', c.fy === 0 ? 5 : 4]
        if (c.face === 'front') {
          if (c.fx === 4 && c.fy % 3 === 0) return ['brass', 5]
          if (c.fx === 4 || c.fx === 3) return ['leather', 2]
          if ((c.fx === 1 || c.fx === 6) && (c.fy === 7 || c.fy === 8)) return ['leather', c.fy === 7 ? 1 : 2]
        }
        if (c.fy === c.high) return ['leather', 1]
      }
      if (c.part === 'arm') {
        if (c.fy === c.high) return ['fleece', 4]
        if (c.fy === 5) return ['darksteel', 2]
        if (c.fy === 0 && c.face !== 'top') return ['fleece', 3]
      }
      if (c.part === 'leg' && c.layer === 1) {
        // Tall boots, fleece-topped, with a brass buckle.
        if (c.fy === c.low) return ['fleece', 4]
        if (c.face === 'front' && c.fy === c.low + 2 && (c.fx === 1 || c.fx === 2)) return ['brass', 4]
        return ['earth', c.face === 'bottom' ? 1 : null]
      }
      if (c.part === 'body' && c.layer === 2) return ['darksteel', c.face === 'front' && (c.fx === 3 || c.fx === 4) ? 4 : 2]
      if (c.part === 'leg' && c.layer === 2) {
        if (c.fy === 3) return ['darksteel', 2]
        if ((c.face === 'right' || c.face === 'left') && c.fy >= 5 && c.fy <= 6) return ['leather', 2]
        return ['earth', null]
      }
      return null
    }
  },

  duelist: {
    base: 'gold',
    cover: (c) => {
      if (c.part === 'head') {
        // A closed helm: brow, an eye slit, a nasal and cheek guards.
        if (c.face === 'front') return c.fy <= 2 || (c.fy >= 4 && c.fy <= 6 && (c.fx <= 1 || c.fx >= 6 || c.fx === 3 || c.fx === 4)) || (c.fy === 3 && (c.fx === 3 || c.fx === 4))
        if (c.face === 'top') return true
        if (c.face !== 'bottom') return c.fy <= 6
      }
      return undefined
    },
    paint: (c) => {
      if (c.part === 'head') {
        // A crimson plume over the crest, falling down the back.
        if (c.face === 'top' && (c.fx === 3 || c.fx === 4)) return ['crimson', c.fy % 2 === 0 ? 4 : 3]
        if (c.face === 'back' && (c.fx === 3 || c.fx === 4) && c.fy <= 5) return ['crimson', 4 - Math.floor(c.fy / 2)]
        if (c.face === 'front' && c.fy === 2 && c.fx >= 1 && c.fx <= 6) return ['gold', 1]
        if (c.face === 'front' && (c.fx === 3 || c.fx === 4) && c.fy >= 3) return ['gold', c.fx === 3 ? 5 : 3]
        if (c.fy === c.high && c.face !== 'top') return ['gold', 2]
      }
      if (c.part === 'body' && c.layer === 1) {
        // The crimson sash from shoulder to hip, front and back, and an embossed keel down the breastplate.
        if (c.face === 'front' || c.face === 'back') {
          const k = c.face === 'front' ? c.fx - c.fy : 7 - c.fx - c.fy
          if (k === 0 || k === 1) return ['crimson', k === 0 ? 4 : 3]
          if (c.face === 'front' && (c.fx === 3 || c.fx === 4) && c.fy >= 2 && c.fy <= 8) return ['gold', c.fx === 3 ? 5 : 2]
        }
        if (c.fy === c.high) return ['crimson', 2]
      }
      if (c.part === 'arm') {
        if (c.fy === c.high) return ['crimson', 3]
        if (c.face === 'top' && c.fx === 1 && c.fy === 1) return ['gold', 5]
      }
      if (c.part === 'leg' && c.layer === 1) {
        if (c.fy === c.low) return ['crimson', 4]
        if (c.face === 'front' && c.fy === c.fh - 1) return ['gold', 5]
      }
      if (c.part === 'body' && c.layer === 2) {
        // A crimson tasset hanging at the front and the back.
        if ((c.face === 'front' || c.face === 'back') && (c.fx === 3 || c.fx === 4)) return ['crimson', 4]
        return ['gold', 2]
      }
      if (c.part === 'leg' && c.layer === 2) {
        if (c.fy === c.high) return ['crimson', 3]
        if (c.face === 'front' && c.fy === 4) return ['gold', 5]
      }
      return null
    }
  },

  compacted_diamond: {
    base: 'diamond',
    cover: (c) => {
      if (c.part === 'head' && c.face === 'front') return c.fy <= 2 || ((c.fx === 3 || c.fx === 4) && c.fy <= 4)
      return undefined
    },
    paint: (c) => {
      // Gold settings at every rim; faceted crystal between them.
      if (c.edge) return ['gold', c.edgeTop ? 4 : 2]
      if (c.part === 'head' && c.face === 'top' && (c.fx === 3 || c.fx === 4)) return ['gold', 4]
      if (c.part === 'body' && c.layer === 1 && c.face === 'front' && c.fy >= 3 && c.fy <= 5 && c.fx >= 3 && c.fx <= 4) return ['diamond', 5]
      if (c.part === 'body' && c.layer === 1 && c.face === 'front' && c.fy >= 2 && c.fy <= 6 && c.fx >= 2 && c.fx <= 5) return ['gold', 3]
      // Facets: diagonal bands of light and shade, a bright glint where each begins.
      const s = c.fx + c.fy
      if (s % 6 === 0) return ['diamond', 5]
      const band = Math.floor(s / 2) % 3
      return ['diamond', band === 0 ? 4 : band === 1 ? 3 : 2]
    }
  },

  compacted_netherite: {
    base: 'netherite',
    coverage: 'netherite',
    cover: (c) => (c.part === 'head' && c.face === 'front' ? c.fy <= 4 : undefined),
    paint: (c) => {
      // Dark plate split by glowing seams.
      if (c.part === 'head' && c.face === 'front' && c.fy === 3) return ['nethglow', c.fx === 0 || c.fx === 7 ? 2 : 5]
      if (c.part === 'head' && c.face === 'front' && c.fy === 4) return c.fx === 3 || c.fx === 4 ? ['netherite', 4] : null
      const seam = c.part === 'head' ? c.fy === 2 && c.face !== 'top' : c.part === 'body' ? c.fy === 5 || (c.face === 'front' && (c.fx === 3 || c.fx === 4) && c.fy >= 6) : c.fy === 6 || c.fy === 2
      if (seam) return ['nethglow', (c.fx + c.fy) % 3 === 0 ? 5 : 4]
      if (c.part === 'head' && c.face === 'top' && (c.fx === 3 || c.fx === 4)) return ['nethglow', 3]
      return null
    }
  },

  anglers: {
    base: 'teal',
    single: 'helmet',
    cover: (c) => {
      if (c.part !== 'head') return undefined
      // A bucket hat: crown and a soft brim all round; the face open below the brim.
      if (c.face === 'front') return c.fy <= 1
      if (c.face === 'top') return true
      if (c.face !== 'bottom') return c.fy <= 2
      return undefined
    },
    paint: (c) => {
      if (c.part !== 'head') return null
      if (c.fy === c.high && c.face !== 'top') return ['teal', 2]
      // A leather band with a fishing fly tucked in it.
      if (c.fy === c.high - 1 && c.face !== 'top') return c.face === 'left' && c.fx === 1 ? ['crimson', 4] : c.face === 'left' && c.fx === 2 ? ['white', 5] : ['leather', 3]
      return null
    }
  },

  ember: {
    base: 'steel',
    single: 'helmet',
    cover: (c) => {
      if (c.part !== 'head') return undefined
      // A crown: a gold circlet with points, nothing over the crown of the head.
      if (c.face === 'top' || c.face === 'bottom') return false
      if (c.fy === 4 || c.fy === 5) return true
      if (c.fy === 3) return c.fx % 2 === 0
      if (c.fy === 2) return c.fx % 4 === 0
      return false
    },
    paint: (c) => {
      if (c.part !== 'head') return null
      // A dark iron circlet: embers burning at its points, glowing gems in the band.
      if (c.fy === 2) return ['ember', 5]
      if (c.fy === 3) return ['ember', c.fx % 4 === 0 ? 4 : 3]
      if (c.fy === 4 && c.fx % 4 === 2) return ['ember', 4]
      return ['steel', c.fy === 5 ? 1 : 2]
    }
  }
}

const RAMP = { ...RAMPS, olive: ['#1e1f0b', '#3b3d15', '#5d5f1f', '#81812c', '#a6a342', '#cfc76a'], tan: ['#2a1a0c', '#4f3419', '#795127', '#a07038', '#c79552', '#e8c17e'], white: ['#4a4652', '#7b7784', '#a9a5b1', '#cfccd6', '#ebe8f0', '#ffffff'] }
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const clamp = (t) => Math.max(0, Math.min(5, t))

/** Paints one layer of a set: a 64x32 RGBA buffer. */
function paintLayer(set, layer, vanilla) {
  const base = vanilla[`${set.coverage ?? 'iron'}_layer_${layer}`]
  const grain = grainOf(base)
  const covered = new Uint8Array(W * H)
  const where = []
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = locate(layer, x, y)
      where.push(c)
      if (!c) continue
      // A single piece (a helmet) covers only its own part of layer 1.
      if (set.single === 'helmet' && (layer !== 1 || c.part !== 'head')) continue
      let on = base[(y * W + x) * 4 + 3] > 0
      const say = set.cover ? set.cover({ ...c, layer }) : undefined
      if (say !== undefined) on = say
      covered[y * W + x] = on ? 1 : 0
    }
  // Each face's lowest (top-most) and highest (bottom-most) covered row, for rims.
  const rows = new Map()
  for (let i = 0; i < W * H; i++) {
    const c = where[i]
    if (!c || !covered[i]) continue
    const key = `${c.part}.${c.face}`
    const r = rows.get(key) ?? { low: c.fy, high: c.fy }
    r.low = Math.min(r.low, c.fy)
    r.high = Math.max(r.high, c.fy)
    rows.set(key, r)
  }
  const out = Buffer.alloc(W * H * 4)
  const inFace = (c, dx, dy) => {
    const x = c.x + dx
    const y = c.y + dy
    if (x < 0 || y < 0 || x >= W || y >= H) return false
    const n = where[y * W + x]
    return n && n.part === c.part && n.face === c.face && covered[y * W + x] === 1
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const c0 = where[i]
      if (!c0 || !covered[i]) continue
      const r = rows.get(`${c0.part}.${c0.face}`)
      const c = { ...c0, layer, x, y, low: r.low, high: r.high }
      const up = inFace(c, 0, -1)
      const down = inFace(c, 0, 1)
      const left = inFace(c, -1, 0)
      const right = inFace(c, 1, 0)
      c.edge = !up || !down || !left || !right
      c.edgeTop = !up || !left
      let [ramp, tone] = set.paint(c) ?? [set.base, null]
      if (tone == null) {
        // The base material: vanilla's grain, a lit top-left rim and a shaded bottom-right rim.
        tone = 3 + grain[i] + (!up || !left ? 1 : 0) - (!down || !right ? 1 : 0) - (c.face === 'bottom' ? 1 : 0)
      }
      const [cr, cg, cb] = hex((RAMP[ramp] ?? RAMP[set.base])[clamp(tone)])
      out.set([cr, cg, cb, 255], i * 4)
    }
  return out
}

/** Writes <set>_layer_1.png and _layer_2.png for every set; returns the vanilla layers (for the preview). */
export async function buildArmor({ preview } = {}) {
  const vanilla = await vanillaLayers()
  mkdirSync(OUT, { recursive: true })
  const made = {}
  for (const [id, set] of Object.entries(SETS)) {
    for (const layer of [1, 2]) {
      if (set.single && layer === 2) continue
      const buf = paintLayer(set, layer, vanilla)
      made[`${id}_layer_${layer}`] = buf
      await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${id}_layer_${layer}.png`))
    }
  }
  if (preview) await writePreview(preview, made)
  console.log(`armour: ${Object.keys(made).length} layer textures for ${Object.keys(SETS).length} sets → textures/models/armor`)
  return made
}

/**
 * A quick look without starting the game: each set on a plain figure, front and back, as the layout maps it
 * (head, body, arms and legs side by side, orthographic), at 8x.
 */
async function writePreview(file, made) {
  const S = 8
  const sets = Object.keys(SETS)
  const views = []
  for (const id of sets) {
    for (const facing of ['front', 'back']) {
      const canvas = Buffer.alloc(16 * 32 * 4)
      // A grey figure underneath, so the armour's holes read.
      const figure = (x0, y0, w, h, rgb) => {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) canvas.set([...rgb, 255], ((y0 + y) * 16 + x0 + x) * 4)
      }
      figure(4, 0, 8, 8, [196, 160, 128])
      figure(4, 8, 8, 12, [74, 110, 160])
      figure(0, 8, 4, 12, [196, 160, 128])
      figure(12, 8, 4, 12, [196, 160, 128])
      figure(4, 20, 4, 12, [60, 60, 100])
      figure(8, 20, 4, 12, [60, 60, 100])
      const blit = (layer, part, x0, y0, flip) => {
        const buf = made[`${id}_layer_${layer}`]
        if (!buf) return
        const [fx0, fy0, fw, fh] = faceRects(BOXES[part])[facing]
        for (let y = 0; y < fh; y++)
          for (let x = 0; x < fw; x++) {
            const sx = flip ? fx0 + fw - 1 - x : fx0 + x
            const i = ((fy0 + y) * W + sx) * 4
            if (buf[i + 3] === 0) continue
            canvas.set(buf.subarray(i, i + 4), ((y0 + y) * 16 + x0 + x) * 4)
          }
      }
      // Leggings under boots and chestplate, like the game draws them.
      blit(2, 'body', 4, 8)
      blit(2, 'leg', 4, 20)
      blit(2, 'leg', 8, 20, true)
      blit(1, 'leg', 4, 20)
      blit(1, 'leg', 8, 20, true)
      blit(1, 'body', 4, 8)
      blit(1, 'arm', 0, 8)
      blit(1, 'arm', 12, 8, true)
      blit(1, 'head', 4, 0)
      views.push(await sharp(canvas, { raw: { width: 16, height: 32, channels: 4 } }).resize(16 * S, 32 * S, { kernel: 'nearest' }).png().toBuffer())
    }
  }
  const cols = views.length
  await sharp({ create: { width: cols * (16 * S + 16), height: 32 * S + 16, channels: 4, background: '#2a2624' } })
    .composite(views.map((input, k) => ({ input, left: 8 + k * (16 * S + 16), top: 8 })))
    .png()
    .toFile(file)
  console.log(`armour preview → ${file}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const i = process.argv.indexOf('--preview')
  await buildArmor({ preview: i > 0 ? process.argv[i + 1] : undefined })
}
