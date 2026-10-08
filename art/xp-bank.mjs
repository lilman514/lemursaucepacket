// The XP Bank (lsp_fixes, pack 1.16.0), 16x16, drawn the way Create draws its casings: a one-pixel frame lit along
// the top and left, a bevel inside it, and dark planks behind, with the brass casing's own colours (sampled from
// create:block/brass_casing). In the middle of each side a window shows what the bank holds: dark glass while it's
// empty, swirling green experience while it holds any (an eight-frame animation in the colours of Create's Block of
// Experience). The tiers differ in the metal: brass with brass rivets (I), brass with diamond studs (II), netherite
// trimmed with gold (III). The upgrades are plates in the same metals, with a diamond (II) or a nether star (III).
//
// Run: node art/xp-bank.mjs [--preview out.png]. Writes the mod's textures, block models, blockstate and item models:
//   mods-src/lemursaucepacket-fixes/src/main/resources/assets/lsp_fixes/{textures,models,blockstates}/

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = path.join(root, 'mods-src/lemursaucepacket-fixes/src/main/resources/assets/lsp_fixes')
const S = 16
const FRAMES = 8

// Create's brass casing, by role (create:block/brass_casing.png).
const BRASS = {
  corner: '#592424', frame: '#9e6947', frameDark: '#724731',
  hi: '#ffeb8c', hi2: '#f7cb6c', lo: '#e4b763', lo2: '#cea05a',
  planks: ['#301e0e', '#3a2411', '#442b15', '#492f17', '#4f3218', '#53381a', '#5a3e1e'],
  rivet: '#ffeb8c', rivetLo: '#cea05a'
}
// Netherite (vanilla's netherite block and ingot), trimmed with gold.
const NETHERITE = {
  corner: '#1d1819', frame: '#4d4446', frameDark: '#2f2829',
  hi: '#fdf55f', hi2: '#e9b115', lo: '#b26411', lo2: '#7f520c',
  planks: ['#1a1414', '#211a1a', '#271f1f', '#2c2424', '#312828', '#362c2c', '#3b3131'],
  rivet: '#fdf55f', rivetLo: '#dc9613'
}
// Vanilla's diamond, for tier II's studs.
const DIAMOND = { hi: '#d5fff6', mid: '#4aedd9', lo: '#2cb6a3', dark: '#1b7f74' }
// Create's Block of Experience, dark to light.
const XP = ['#2e6c55', '#38835f', '#419760', '#47a759', '#52b64c', '#6fc451', '#8ad055', '#a4db58', '#b6e55f']
const SPARK = ['#9df195', '#b2f8c6', '#ccffea']
const GLASS = { deep: '#14201f', base: '#1c2b2a', mid: '#243837', hi: '#4f6e69', hi2: '#7fa39c' }

const TIERS = {
  1: { metal: BRASS, studs: 'rivets' },
  2: { metal: BRASS, studs: 'diamonds' },
  3: { metal: NETHERITE, studs: 'rivets' }
}

class Canvas {
  constructor(w = S, h = S) {
    this.w = w
    this.h = h
    this.px = new Array(w * h).fill(null)
  }
  put(x, y, hex) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.px[y * this.w + x] = hex
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.px[y * this.w + x]
  }
  rgba() {
    const buf = Buffer.alloc(this.w * this.h * 4)
    for (let i = 0; i < this.w * this.h; i++) {
      const hex = this.px[i]
      if (hex == null) continue
      buf.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], i * 4)
    }
    return buf
  }
  /** The outline a pixel beyond an item sprite: lighter where the sprite lies below or right of it, else darker. */
  outline(light, dark) {
    const filled = (x, y) => this.get(x, y) != null
    const edge = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (filled(x, y)) continue
        const below = filled(x, y + 1) || filled(x + 1, y)
        const above = filled(x, y - 1) || filled(x - 1, y)
        if (below || above) edge.push([x, y, below && !above ? light : dark])
      }
    for (const [x, y, hex] of edge) this.put(x, y, hex)
  }
}

// A fixed pseudo-random pattern, so the planks look the same every run.
const noise = (x, y, seed = 0) => {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) >>> 0
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/** Create's casing: frame, bevel, planks with a grain, four rivets (or a tier's studs). */
function casing(c, tier) {
  const { metal: m, studs } = TIERS[tier]
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // Planks run across in pairs of rows, each board its own shade, with a darker seam under it.
      const board = Math.floor((y - 2) / 2)
      const seam = (y - 2) % 2 === 1
      const shade = Math.floor(noise(board, Math.floor(x / 5), tier) * 4) + (seam ? 0 : 2)
      c.put(x, y, m.planks[Math.min(m.planks.length - 1, shade + (noise(x, y, 7) > 0.85 ? 1 : 0))])
    }
  for (let i = 0; i < S; i++) {
    c.put(i, 0, m.frame)
    c.put(0, i, m.frame)
    c.put(i, S - 1, m.frameDark)
    c.put(S - 1, i, m.frameDark)
  }
  for (let i = 1; i < S - 1; i++) {
    c.put(i, 1, i % 4 === 3 ? m.hi2 : m.hi)
    c.put(1, i, i % 4 === 1 ? m.hi2 : m.hi)
    c.put(i, S - 2, i % 3 === 0 ? m.lo2 : m.lo)
    c.put(S - 2, i, i % 3 === 1 ? m.lo2 : m.lo)
  }
  for (const [x, y] of [[0, 0], [S - 1, 0], [0, S - 1], [S - 1, S - 1]]) c.put(x, y, m.corner)
  for (const [x, y] of [[2, 2], [S - 3, 2], [2, S - 3], [S - 3, S - 3]]) {
    if (studs === 'diamonds') {
      c.put(x, y, DIAMOND.mid)
      c.put(x + (x < 8 ? 1 : -1), y, DIAMOND.lo)
      c.put(x, y + (y < 8 ? 1 : -1), DIAMOND.lo)
      c.put(x + (x < 8 ? 1 : -1), y + (y < 8 ? 1 : -1), DIAMOND.dark)
      c.put(x, y, DIAMOND.hi)
    } else {
      c.put(x, y, m.rivet)
      c.put(x + (x < 8 ? 1 : -1), y + (y < 8 ? 1 : -1), m.rivetLo)
    }
  }
}

/** The window's rim (rows and columns 3 to 12) round the 8x8 pane at 4 to 11. */
function rim(c, tier) {
  const { metal: m } = TIERS[tier]
  for (let i = 3; i <= 12; i++) {
    c.put(i, 3, m.lo2)
    c.put(3, i, m.lo2)
    c.put(i, 12, m.hi2)
    c.put(12, i, m.hi2)
  }
  c.put(3, 3, m.frameDark)
  c.put(12, 12, m.hi)
  if (tier === 2) {
    // A diamond line inside the rim: the upgrade shows.
    for (let i = 4; i <= 11; i++) {
      c.put(i, 4, DIAMOND.lo)
      c.put(4, i, DIAMOND.lo)
    }
  }
}

/** Dark glass with a glint in its top-left corner. */
function glass(c, tier) {
  const inset = tier === 2 ? 5 : 4
  for (let y = inset; y <= 11; y++)
    for (let x = inset; x <= 11; x++) c.put(x, y, (x + y) % 5 === 0 ? GLASS.mid : y > 9 ? GLASS.deep : GLASS.base)
  c.put(inset, inset, GLASS.hi2)
  c.put(inset + 1, inset, GLASS.hi)
  c.put(inset, inset + 1, GLASS.hi)
  c.put(inset + 2, inset + 1, GLASS.hi)
  c.put(11, 11, GLASS.deep)
}

/** Experience behind the glass, frame f of the swirl: bands that roll round, and sparks that rise. */
function experience(c, tier, f) {
  const inset = tier === 2 ? 5 : 4
  const cx = 7.5
  const cy = 7.5
  for (let y = inset; y <= 11; y++)
    for (let x = inset; x <= 11; x++) {
      const angle = Math.atan2(y - cy, x - cx)
      const r = Math.hypot(x - cx, y - cy)
      // A spiral: brightness follows the angle, turning with the frame, a little brighter at the heart.
      const wave = Math.sin(angle * 2 + r * 0.9 - (f / FRAMES) * Math.PI * 2)
      const level = Math.round(3 + wave * 2.2 + (3.5 - r) * 0.6)
      c.put(x, y, XP[Math.max(0, Math.min(XP.length - 1, level))])
    }
  // Sparks rise through it, one row a frame, each column at its own phase.
  for (const [x, phase] of [[inset + 1, 0], [inset + 4, 3], [9, 5], [11, 1]]) {
    if (x > 11) continue
    const span = 12 - inset
    const y = 11 - ((f + phase) % span)
    c.put(x, y, SPARK[(f + phase) % SPARK.length])
    if (y + 1 <= 11) c.put(x, y + 1, XP[6])
  }
  c.put(inset, inset, '#ccffea')
}

/** The top: the casing round an intake grate, so it reads as a box that takes something in. */
function top(c, tier) {
  casing(c, tier)
  const { metal: m } = TIERS[tier]
  for (let y = 5; y <= 10; y++)
    for (let x = 5; x <= 10; x++) c.put(x, y, (x + y) % 2 === 0 ? GLASS.deep : '#0e1514')
  for (let i = 4; i <= 11; i++) {
    c.put(i, 4, m.lo2)
    c.put(4, i, m.lo2)
    c.put(i, 11, m.hi2)
    c.put(11, i, m.hi2)
  }
  for (let i = 5; i <= 10; i++) {
    c.put(i, 7, m.frameDark)
    c.put(7, i, m.frameDark)
    c.put(i, 8, m.frame)
    c.put(8, i, m.frame)
  }
}

/** An upgrade: a plate of the tier's metal with its gem set in the middle. */
function upgrade(tier) {
  const c = new Canvas()
  const m = TIERS[tier].metal
  for (let y = 3; y <= 12; y++)
    for (let x = 3; x <= 12; x++) {
      const edge = x === 3 || y === 3 || x === 12 || y === 12
      const light = x === 3 || y === 3
      c.put(x, y, edge ? (light ? m.hi : m.lo2) : m.planks[4 + (noise(x, y, tier) > 0.6 ? 1 : 0)])
    }
  // Rivets at the corners.
  for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) c.put(x, y, m.rivet)
  // The gem: a diamond (II) or a nether star (III), in a ring of experience green.
  for (const [x, y] of [[7, 5], [8, 5], [5, 7], [5, 8], [10, 7], [10, 8], [7, 10], [8, 10], [6, 6], [9, 6], [6, 9], [9, 9]]) c.put(x, y, XP[4])
  if (tier === 2) {
    for (const [x, y, hex] of [[7, 6, DIAMOND.hi], [8, 6, DIAMOND.mid], [6, 7, DIAMOND.mid], [7, 7, DIAMOND.hi], [8, 7, DIAMOND.mid], [9, 7, DIAMOND.lo],
      [6, 8, DIAMOND.lo], [7, 8, DIAMOND.mid], [8, 8, DIAMOND.lo], [9, 8, DIAMOND.dark], [7, 9, DIAMOND.lo], [8, 9, DIAMOND.dark]]) c.put(x, y, hex)
  } else {
    // The nether star: white, with pale yellow and lavender at its points.
    for (const [x, y, hex] of [[7, 6, '#ffffff'], [8, 6, '#fffbd6'], [6, 7, '#fffbd6'], [7, 7, '#ffffff'], [8, 7, '#ffffff'], [9, 7, '#d9c6ff'],
      [6, 8, '#d9c6ff'], [7, 8, '#ffffff'], [8, 8, '#fff3a8'], [9, 8, '#b9a6e8'], [7, 9, '#b9a6e8'], [8, 9, '#9d8acb']]) c.put(x, y, hex)
  }
  c.outline(m.frame, m.corner)
  return c
}

async function png(file, canvas) {
  await sharp(canvas.rgba(), { raw: { width: canvas.w, height: canvas.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file)
}

const json = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n')

export async function buildXpBank({ preview } = {}) {
  const blockTex = path.join(ASSETS, 'textures/block')
  const itemTex = path.join(ASSETS, 'textures/item')
  const blockModels = path.join(ASSETS, 'models/block')
  const itemModels = path.join(ASSETS, 'models/item')
  const states = path.join(ASSETS, 'blockstates')
  for (const d of [blockTex, itemTex, blockModels, itemModels, states]) mkdirSync(d, { recursive: true })
  const shown = []
  const variants = {}
  for (const tier of [1, 2, 3]) {
    const side = new Canvas()
    casing(side, tier)
    rim(side, tier)
    glass(side, tier)
    await png(path.join(blockTex, `xp_bank_side_${tier}.png`), side)
    // The full side: eight frames stacked, the swirl turning.
    const strip = new Canvas(S, S * FRAMES)
    for (let f = 0; f < FRAMES; f++) {
      const frame = new Canvas()
      casing(frame, tier)
      rim(frame, tier)
      experience(frame, tier, f)
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) strip.put(x, f * S + y, frame.get(x, y))
      if (f === 0) var firstFrame = frame
    }
    await png(path.join(blockTex, `xp_bank_side_${tier}_full.png`), strip)
    json(path.join(blockTex, `xp_bank_side_${tier}_full.png.mcmeta`), { animation: { frametime: 3, interpolate: true } })
    const t = new Canvas()
    top(t, tier)
    await png(path.join(blockTex, `xp_bank_top_${tier}.png`), t)
    const bottom = new Canvas()
    casing(bottom, tier)
    await png(path.join(blockTex, `xp_bank_bottom_${tier}.png`), bottom)
    shown.push(side, firstFrame, t, bottom)
    for (const full of [false, true]) {
      const name = `xp_bank_${tier}${full ? '_full' : ''}`
      json(path.join(blockModels, `${name}.json`), {
        parent: 'minecraft:block/cube_bottom_top',
        textures: { side: `lsp_fixes:block/xp_bank_side_${tier}${full ? '_full' : ''}`, top: `lsp_fixes:block/xp_bank_top_${tier}`, bottom: `lsp_fixes:block/xp_bank_bottom_${tier}` }
      })
      variants[`full=${full},tier=${tier}`] = { model: `lsp_fixes:block/${name}` }
    }
  }
  json(path.join(states, 'xp_bank.json'), { variants })
  // The item looks like the bank it places (XpBankClient's lsp_fixes:tier and lsp_fixes:full); the last match wins.
  json(path.join(itemModels, 'xp_bank.json'), {
    parent: 'lsp_fixes:block/xp_bank_1',
    overrides: [
      { predicate: { 'lsp_fixes:full': 1 }, model: 'lsp_fixes:block/xp_bank_1_full' },
      { predicate: { 'lsp_fixes:tier': 0.5 }, model: 'lsp_fixes:block/xp_bank_2' },
      { predicate: { 'lsp_fixes:tier': 0.5, 'lsp_fixes:full': 1 }, model: 'lsp_fixes:block/xp_bank_2_full' },
      { predicate: { 'lsp_fixes:tier': 1 }, model: 'lsp_fixes:block/xp_bank_3' },
      { predicate: { 'lsp_fixes:tier': 1, 'lsp_fixes:full': 1 }, model: 'lsp_fixes:block/xp_bank_3_full' }
    ]
  })
  for (const tier of [2, 3]) {
    const u = upgrade(tier)
    await png(path.join(itemTex, `xp_bank_upgrade_${tier}.png`), u)
    json(path.join(itemModels, `xp_bank_upgrade_${tier}.json`), { parent: 'minecraft:item/generated', textures: { layer0: `lsp_fixes:item/xp_bank_upgrade_${tier}` } })
    shown.push(u)
  }
  console.log(`xp bank: 3 tiers (side, animated full side, top, bottom), 6 block models, 2 upgrades -> ${path.relative(root, ASSETS)}`)
  if (preview) await writePreview(preview, shown)
}

async function writePreview(file, sprites) {
  const scale = 8
  const cell = S * scale + 16
  const composites = []
  for (const [i, s] of sprites.entries()) {
    const big = await sharp(s.rgba(), { raw: { width: s.w, height: s.h, channels: 4 } }).resize(S * scale, S * scale, { kernel: 'nearest' }).png().toBuffer()
    composites.push({ input: big, left: (i % 4) * cell + 8, top: Math.floor(i / 4) * cell + 8 })
  }
  await sharp({ create: { width: 4 * cell, height: Math.ceil(sprites.length / 4) * cell, channels: 4, background: { r: 139, g: 139, b: 139, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(file)
  console.log(`xp bank: preview ${file}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--preview')
  await buildXpBank({ preview: i > 0 ? process.argv[i + 1] : undefined })
}
