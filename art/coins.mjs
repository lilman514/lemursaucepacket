// Gold Coins and the Coin Pouch, 16x16, drawn the way vanilla draws its gold: the gold nugget's and ingot's own
// colours, flat blocky shading lit from the top left with a white glint, and an outline in dark gold rather than black
// (lighter along the top and left, darker along the bottom and right, as vanilla's items are).
//
// Like RuneScape's coin icons, the pile grows with the amount: ten sprites for 1, 2, 3, 4, 5, 25, 100, 250, 1,000 and
// 10,000+ coins (the client picks one with the lsp_fixes:pile item property, see EconomyClient). Each coin is a disc
// seen from a little above: its face, and its edge below it, so a stack shows as stripes of edges under the top face.
// Coins are drawn back to front, and each keeps a thin dark line where it lies over the ones behind it.
//
// Run: node art/coins.mjs [--preview out.png]. Writes the mod's textures and item models:
//   mods-src/lemursaucepacket-fixes/src/main/resources/assets/lsp_fixes/{textures,models}/item/

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = path.join(root, 'mods-src/lemursaucepacket-fixes/src/main/resources/assets/lsp_fixes')
const W = 16
const H = 16

// Vanilla's gold (item/gold_nugget.png and item/gold_ingot.png), by role.
const GOLD = {
  w: '#ffffff', // glint
  h: '#fffde0', // highlight
  c: '#f9f969', // the bright face
  f: '#fdf55f', // face
  m: '#f8d26a', // face, turning away
  g: '#e9b115', // shade
  d: '#dc9613', // the edge
  s: '#b26411', // the edge's underside, and the line between overlapping coins
  o: '#7f520c', // outline, top and left
  O: '#6e470b' // outline, bottom and right
}
// Vanilla's bundle (item/bundle.png): its leathers, by role.
const LEATHER = { hi: '#dfc38d', lt: '#cd7b46', mid: '#a6572c', md: '#815634', dk: '#7d4034', sh: '#623220', o: '#4f2b10', O: '#421e01' }

class Canvas {
  constructor() {
    this.px = new Array(W * H).fill(null)
  }
  put(x, y, hex) {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    this.px[y * W + x] = hex
  }
  filled(x, y) {
    return x >= 0 && y >= 0 && x < W && y < H && this.px[y * W + x] != null
  }
  /** The outline a pixel beyond the sprite: the lighter colour where the sprite lies below or right of it, else the darker. */
  outline(light, dark) {
    const edge = []
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (this.filled(x, y)) continue
        const below = this.filled(x, y + 1) || this.filled(x + 1, y)
        const above = this.filled(x, y - 1) || this.filled(x - 1, y)
        if (below || above) edge.push([x, y, below && !above ? light : dark])
      }
    for (const [x, y, hex] of edge) this.put(x, y, hex)
  }
  rgba() {
    const buf = Buffer.alloc(W * H * 4)
    for (let i = 0; i < W * H; i++) {
      const hex = this.px[i]
      if (hex == null) continue
      buf.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], i * 4)
    }
    return buf
  }
}

// A coin from a little above: the face (lit top left, a glint, shading toward the bottom right) over its edge.
// Letters are GOLD's roles; '.' is nothing.
// The single coin faces you instead: a minted rim (lit top left, shaded bottom right) round a stamped centre.
const STAMPS = {
  face: ['...hhcc...', '.hhccccgg.', '.hcwhcffgd', 'hcwcfmmfgd', 'hchfmggmgd', 'cffmggmfgd', 'cfffmmffgd', '.gfffffgd.', '.ggggggdd.', '...dddd...'],
  small: ['.ccccf.', 'cwcccfg', 'cfffmgg', '.ddddd.']
}

/** A coin with its top-left at (x0, y0). Where it lies over coins already drawn, a thin line keeps its shape. */
function coin(c, x0, y0, kind = 'small') {
  const rows = STAMPS[kind]
  const mine = new Set()
  rows.forEach((r, dy) => [...r].forEach((ch, dx) => ch !== '.' && mine.add(`${x0 + dx},${y0 + dy}`)))
  for (const key of mine) {
    const [x, y] = key.split(',').map(Number)
    for (const [ax, ay] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const nx = x + ax
      const ny = y + ay
      if (!mine.has(`${nx},${ny}`) && c.filled(nx, ny)) c.put(nx, ny, GOLD.s)
    }
  }
  rows.forEach((r, dy) => [...r].forEach((ch, dx) => ch !== '.' && c.put(x0 + dx, y0 + dy, GOLD[ch])))
}

/** A column of `n` coins, the bottom one's top-left at (x0, y0), two pixels a coin. */
function column(c, x0, y0, n) {
  for (let i = 0; i < n; i++) coin(c, x0, y0 - i * 2)
}

// Back to front within each pile.
const PILES = [
  { n: 1, draw: (c) => coin(c, 3, 3, 'face') },
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

/** A leather pouch in the bundle's leathers, tied with a gold cord, a coin showing at the neck. */
function pouch() {
  const c = new Canvas()
  // L leather, l its lit side, n the neck's gather; the outline comes after.
  const rows = [
    '................',
    '................',
    '................',
    '......nnnn......',
    '.......nn.......',
    '.....LLLLLL.....',
    '....LlLLLLLL....',
    '...LllLLLLLLL...',
    '...LlLLLLLLLL...',
    '..LllLLLLLLLLL..',
    '..LlLLLLLLLLLL..',
    '..LLLLLLLLLLLL..',
    '...LLLLLLLLLL...',
    '....LLLLLLLL....',
    '................',
    '................'
  ]
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x]
      if (ch === '.') continue
      if (ch === 'n') {
        c.put(x, y, x < 8 ? LEATHER.lt : LEATHER.mid)
        continue
      }
      // Flat bands of leather, darker toward the bottom right; the lit side along the left.
      const shade = x + y * 1.4
      c.put(x, y, ch === 'l' ? LEATHER.hi : shade < 16 ? LEATHER.lt : shade < 22 ? LEATHER.mid : shade < 27 ? LEATHER.dk : LEATHER.sh)
    }
  // The gold cord round the neck, its knot, and a coin peeking out at the top.
  for (const x of [5, 6, 7, 8, 9, 10]) c.put(x, 5, x % 2 ? GOLD.g : GOLD.c)
  c.put(10, 6, GOLD.d)
  c.put(10, 7, GOLD.g)
  for (const [x, ch] of [[6, 'c'], [7, 'w'], [8, 'c'], [9, 'f']]) c.put(x, 2, GOLD[ch])
  // Stitches down the seam.
  for (const y of [8, 10, 12]) c.put(11, y, LEATHER.sh)
  c.outline(LEATHER.o, LEATHER.O)
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
    c.outline(GOLD.o, GOLD.O)
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
