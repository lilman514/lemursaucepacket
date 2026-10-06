// Gold Coins and the Coin Pouch, 16x16, in the pack's Relics-style gold ramp (art/items.mjs).
//
// Like RuneScape's coin icons, the pile grows with the amount: ten sprites for 1, 2, 3, 4, 5, 25, 100, 250, 1,000 and
// 10,000+ coins (the client picks one with the lsp_fixes:pile item property, see EconomyClient). Each coin is a tilted
// disc: an elliptical face shaded from the top-left with a glint, over a one-pixel rim, outlined in the ramp's darkest
// step. Coins are drawn back to front, so the ones in front keep their outline over the ones behind.
//
// Run: node art/coins.mjs [--preview out.png]. Writes the mod's textures and item models:
//   mods-src/lemursaucepacket-fixes/src/main/resources/assets/lsp_fixes/{textures,models}/item/

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { RAMPS } from './items.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = path.join(root, 'mods-src/lemursaucepacket-fixes/src/main/resources/assets/lsp_fixes')
const W = 16
const H = 16
const GOLD = RAMPS.gold
const LEATHER = RAMPS.leather

class Canvas {
  constructor() {
    this.tone = new Array(W * H).fill(-1)
    this.ramp = new Array(W * H).fill(null)
  }
  put(x, y, ramp, tone) {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    this.tone[y * W + x] = tone
    this.ramp[y * W + x] = ramp
  }
  filled(x, y) {
    return x >= 0 && y >= 0 && x < W && y < H && this.tone[y * W + x] >= 0
  }
  /** The dark outline round the outside of the whole sprite, a pixel beyond its edge. */
  outline(ramp) {
    const edge = []
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (this.filled(x, y)) continue
        if (this.filled(x + 1, y) || this.filled(x - 1, y) || this.filled(x, y + 1) || this.filled(x, y - 1)) edge.push([x, y])
      }
    for (const [x, y] of edge) this.put(x, y, ramp, 0)
  }
  rgba() {
    const buf = Buffer.alloc(W * H * 4)
    for (let i = 0; i < W * H; i++) {
      if (this.tone[i] < 0) continue
      const hex = this.ramp[i][Math.max(0, Math.min(5, this.tone[i]))]
      buf.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], i * 4)
    }
    return buf
  }
}

// A coin seen from a little above: a face lit from the top-left with a glint, and a darker rim row below it. Digits are
// steps of the gold ramp; the outline comes last, round the whole pile.
const STAMPS = {
  big: ['...3333...', '.33455543.', '3455554443', '3445544433', '2344444432', '.12222221.', '..111111..'],
  small: ['.34443.', '3455443', '2344432', '.12221.']
}

/**
 * A coin with its top-left at (x0, y0). Where it overlaps coins already drawn, a dark line is left round it, so each
 * coin keeps its shape in a pile.
 */
function coin(c, x0, y0, kind = 'small') {
  const rows = STAMPS[kind]
  const mine = new Set()
  rows.forEach((r, dy) => [...r].forEach((ch, dx) => ch !== '.' && mine.add(`${x0 + dx},${y0 + dy}`)))
  for (const key of mine) {
    const [x, y] = key.split(',').map(Number)
    for (const [ax, ay] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const nx = x + ax
      const ny = y + ay
      if (!mine.has(`${nx},${ny}`) && c.filled(nx, ny)) c.put(nx, ny, GOLD, Math.min(c.tone[ny * W + nx], 1))
    }
  }
  rows.forEach((r, dy) => [...r].forEach((ch, dx) => ch !== '.' && c.put(x0 + dx, y0 + dy, GOLD, Number(ch))))
}

/** A column of `n` coins, the bottom one's top-left at (x0, y0), two pixels a coin. */
function column(c, x0, y0, n) {
  for (let i = 0; i < n; i++) coin(c, x0, y0 - i * 2)
}

// Back to front within each pile.
const PILES = [
  { n: 1, draw: (c) => coin(c, 3, 4, 'big') },
  { n: 2, draw: (c) => (coin(c, 7, 4), coin(c, 2, 8)) },
  { n: 3, draw: (c) => (coin(c, 8, 3), coin(c, 1, 6), coin(c, 6, 9)) },
  { n: 4, draw: (c) => (coin(c, 1, 3), coin(c, 8, 4), coin(c, 3, 8), coin(c, 8, 10)) },
  { n: 5, draw: (c) => (coin(c, 8, 3), column(c, 1, 8, 3), coin(c, 8, 8), coin(c, 4, 11)) },
  { n: 25, draw: (c) => (column(c, 7, 8, 4), column(c, 1, 10, 3), coin(c, 8, 11)) },
  { n: 100, draw: (c) => (column(c, 1, 9, 4), column(c, 8, 8, 5), column(c, 4, 11, 3)) },
  { n: 250, draw: (c) => (column(c, 0, 8, 4), column(c, 5, 6, 5), column(c, 9, 9, 4), column(c, 3, 11, 3), coin(c, 9, 11)) },
  // The big heaps are mounds: short columns at the sides, tall in the middle, loose coins spilling in front.
  { n: 1000, draw: (c) => (column(c, 0, 11, 2), column(c, 3, 9, 4), column(c, 6, 8, 5), column(c, 9, 10, 3), coin(c, 1, 12), coin(c, 6, 12), coin(c, 10, 12)) },
  {
    n: 10000,
    draw: (c) => (
      column(c, 0, 10, 3), column(c, 2, 8, 5), column(c, 5, 6, 6), column(c, 8, 7, 6), column(c, 9, 10, 4),
      column(c, 3, 11, 3), column(c, 7, 11, 3), coin(c, 0, 12), coin(c, 5, 12), coin(c, 9, 12)
    )
  }
]

/** A leather pouch tied with a gold cord, a coin peeking out. */
function pouch() {
  const c = new Canvas()
  const rows = [
    '................',
    '................',
    '.......gg.......',
    '......gGGg......',
    '.....llgglll....',
    '....llLllLLll...',
    '...lLLLLLLLLll..',
    '..lLLLLLLLLLLll.',
    '..lLLLLLLLLLLLl.',
    '..lLLLLLLLLLLLl.',
    '..lLLLLLLLLLLll.',
    '...lLLLLLLLLll..',
    '....llllllll....',
    '................',
    '................',
    '................'
  ]
  const inBag = (x, y) => x >= 0 && y >= 0 && x < W && y < H && /[lL]/.test(rows[y][x])
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x]
      if (ch === '.') continue
      if (ch === 'g' || ch === 'G') {
        c.put(x, y, GOLD, ch === 'G' ? 4 : 0)
        continue
      }
      const edge = !inBag(x + 1, y) || !inBag(x - 1, y) || !inBag(x, y + 1) || !inBag(x, y - 1)
      if (edge && ch === 'l') {
        c.put(x, y, LEATHER, 0)
        continue
      }
      const light = -((x - 8) / 6) * 0.5 - ((y - 8) / 4) * 0.8
      c.put(x, y, LEATHER, Math.max(1, Math.min(4, 3 + Math.round(light))))
    }
  }
  // The cord round the neck, and its stitched seam.
  for (const x of [5, 6, 7, 8, 9, 10]) c.put(x, 5, GOLD, x % 2 ? 3 : 4)
  c.put(4, 5, GOLD, 0)
  c.put(11, 5, GOLD, 0)
  c.put(10, 6, GOLD, 3)
  c.put(10, 7, GOLD, 2)
  for (const [x, y] of [[5, 8], [6, 9], [11, 9], [12, 8]]) c.put(x, y, LEATHER, 5)
  return c
}

async function png(file, rgba) {
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file)
}

export async function buildCoins({ preview } = {}) {
  const tex = path.join(ASSETS, 'textures/item')
  const models = path.join(ASSETS, 'models/item')
  mkdirSync(tex, { recursive: true })
  mkdirSync(models, { recursive: true })
  const sprites = []
  for (const [i, p] of PILES.entries()) {
    const c = new Canvas()
    p.draw(c)
    c.outline(GOLD)
    const name = `gold_coins_${p.n}`
    await png(path.join(tex, `${name}.png`), c.rgba())
    sprites.push({ name, rgba: c.rgba() })
    if (i > 0) writeFileSync(path.join(models, `${name}.json`), JSON.stringify({ parent: 'minecraft:item/generated', textures: { layer0: `lsp_fixes:item/${name}` } }, null, 2) + '\n')
  }
  // The base model is the single coin; the overrides switch to bigger piles (the last match wins).
  const overrides = PILES.slice(1).map((p, i) => ({ predicate: { 'lsp_fixes:pile': (i + 1) / 10 }, model: `lsp_fixes:item/gold_coins_${p.n}` }))
  writeFileSync(path.join(models, 'gold_coins.json'), JSON.stringify({ parent: 'minecraft:item/generated', textures: { layer0: 'lsp_fixes:item/gold_coins_1' }, overrides }, null, 2) + '\n')
  const bag = pouch()
  await png(path.join(tex, 'coin_pouch.png'), bag.rgba())
  sprites.push({ name: 'coin_pouch', rgba: bag.rgba() })
  writeFileSync(path.join(models, 'coin_pouch.json'), JSON.stringify({ parent: 'minecraft:item/generated', textures: { layer0: 'lsp_fixes:item/coin_pouch' } }, null, 2) + '\n')
  console.log(`coins: ${PILES.length} pile sprites + the pouch -> ${path.relative(root, ASSETS)}`)
  if (preview) await writePreview(preview, sprites)
}

async function writePreview(file, sprites) {
  const scale = 8
  const cell = W * scale + 16
  const composites = []
  for (const [i, s] of sprites.entries()) {
    const big = await sharp(s.rgba, { raw: { width: W, height: H, channels: 4 } }).resize(W * scale, H * scale, { kernel: 'nearest' }).png().toBuffer()
    composites.push({ input: big, left: (i % 6) * cell + 8, top: Math.floor(i / 6) * cell + 8 })
  }
  await sharp({ create: { width: 6 * cell, height: Math.ceil(sprites.length / 6) * cell, channels: 4, background: { r: 139, g: 139, b: 139, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(file)
  console.log(`coins: preview ${file}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--preview')
  await buildCoins({ preview: i > 0 ? process.argv[i + 1] : undefined })
}
