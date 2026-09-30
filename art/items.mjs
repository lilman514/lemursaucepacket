// Item sprites in the Relics style: 16x16 pixel art for the pack's own items, plus the two status-effect icons
// that Relics 0.12.8 ships without textures (Flight and Tremor).
//
// How a sprite is made:
//   1. A base silhouette: a vanilla 16x16 item sprite read from the Minecraft client jar (so armour and tools
//      read instantly as what they are), or a grid of material regions for shapes vanilla doesn't have.
//   2. Shading: each vanilla pixel's brightness is ranked onto a 6-step ramp; grid regions are shaded from the
//      top-left. Ramps are hue-shifted like Relics' (shadows lean cool, highlights warm) and step 0 is a dark
//      shade of the material itself, so outlines are coloured, never black.
//   3. Paint: set details on top (a miner's lamp, goggles, a plume, glowing runes, sparkles), each either
//      recolouring a pixel while keeping its shade or placing a fixed ramp step.
//   4. Shimmer: like Relics, most items hold still for several seconds, then a quick light sweep crosses
//      them. The pause differs per item so a full inventory doesn't flash in sync.
//
// Run: node art/items.mjs [--preview out.png]   (needs the 1.21.1 client jar; set MINECRAFT_JAR if it isn't
// at the default scratch path). Writes pack/kubejs/assets/lemursaucepacket/textures/item/*.png (+ .mcmeta)
// and pack/kubejs/assets/relics/textures/mob_effect/{flight,tremor}.png.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { unzipSync } from 'fflate'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ITEM_DIR = path.join(root, 'pack/kubejs/assets/lemursaucepacket/textures/item')
const EFFECT_DIR = path.join(root, 'pack/kubejs/assets/relics/textures/mob_effect')
const JAR =
  process.env.MINECRAFT_JAR ??
  path.join(process.env.LOCALAPPDATA ?? '', 'Temp', 'claude', 'C--Create-Modpack', 'ab1859ba-46fb-401e-9816-544fdbbd5524', 'scratchpad', 'headless', 'minecraft', 'versions', '1.21.1', '1.21.1.jar')

// ---------------------------------------------------------------- ramps: [outline, shadow, dark, mid, light, highlight]

export const RAMPS = {
  steel: ['#1c1b2c', '#34354f', '#51587a', '#7682a2', '#a6b3cd', '#e6eef8'],
  iron: ['#1a1a24', '#353846', '#575c6d', '#80879a', '#b3bac8', '#eef1f6'],
  darksteel: ['#141019', '#272030', '#3b3247', '#55495f', '#766880', '#a293a8'],
  brass: ['#3b1a0d', '#6d3514', '#a8601b', '#dd9a2a', '#f7cb4d', '#fff6ad'],
  gold: ['#3e160c', '#7c3612', '#bf6d18', '#eda729', '#ffd84b', '#fffcd2'],
  leather: ['#24100b', '#482315', '#703b20', '#98592f', '#c07b43', '#e3a86a'],
  crimson: ['#2c0612', '#5a0e20', '#90192b', '#c63237', '#ea5f47', '#ffa27a'],
  diamond: ['#0b183b', '#123c6b', '#187693', '#25b1b3', '#6cecd9', '#d8fff4'],
  netherite: ['#120d16', '#241b2a', '#382c3f', '#514457', '#716276', '#9c8ca0'],
  nethglow: ['#1d0826', '#3d0f4f', '#6b1f84', '#a33bb8', '#d774e0', '#f8c4f8'],
  teal: ['#0c1d24', '#143940', '#1d5c5c', '#2c8577', '#4bae91', '#8ad7b0'],
  wood: ['#1e0e09', '#3b1f13', '#5b331f', '#7d4e2d', '#9f6a3e', '#c58f57'],
  ember: ['#360904', '#741505', '#bb330b', '#f06a19', '#ffb23c', '#fff08c'],
  storm: ['#0a1133', '#182d74', '#2c5ab8', '#4c9aec', '#98d6ff', '#f2fdff'],
  glass: ['#0b2336', '#134f6c', '#1c86a6', '#44c2d6', '#a6eef3', '#ffffff'],
  lamp: ['#3a1d05', '#86490a', '#dc930e', '#ffd035', '#fff387', '#ffffff'],
  fleece: ['#3a291c', '#6b533f', '#a0876c', '#cbb596', '#e9dbc1', '#fffaf0'],
  parchment: ['#3a2311', '#6c4825', '#a37a43', '#d1ac6c', '#eed79e', '#fff5d6'],
  leaf: ['#0e230f', '#1c481a', '#2d7727', '#4da439', '#83cf58', '#c5f398'],
  crystal: ['#280a38', '#521970', '#882dad', '#be52de', '#e798f4', '#fff0ff'],
  sky: ['#0e2240', '#1d4a7d', '#3a82bf', '#72b9e6', '#b8e3f7', '#ffffff'],
  earth: ['#1f1008', '#40220f', '#6b3d1a', '#94602b', '#bd8a48', '#e7bd78'],
  plume: ['#1c3350', '#3d6b99', '#78a9d6', '#b5d8f2', '#e3f3ff', '#ffffff']
}

const W = 16
const H = 16

// ---------------------------------------------------------------- silhouettes

const VANILLA = [
  'iron_helmet',
  'iron_chestplate',
  'iron_leggings',
  'iron_boots',
  'iron_sword',
  'iron_axe',
  'iron_pickaxe',
  'diamond',
  'netherite_ingot',
  'flow_banner_pattern',
  'feather',
  'mace',
  'iron_hoe',
  'blaze_rod'
]

async function loadVanilla() {
  if (!existsSync(JAR)) throw new Error(`items: Minecraft 1.21.1 client jar not found at ${JAR} (set MINECRAFT_JAR)`)
  const wanted = new Set(VANILLA.map((n) => `assets/minecraft/textures/item/${n}.png`))
  const zip = unzipSync(readFileSync(JAR), { filter: (f) => wanted.has(f.name) })
  const out = {}
  for (const [name, bytes] of Object.entries(zip)) {
    const { data } = await sharp(Buffer.from(bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    out[path.basename(name, '.png')] = data
  }
  return out
}

/**
 * A vanilla sprite as a pixel map. Warm, saturated pixels (wooden handles) form group 'h', everything else
 * group 'a'. Within a group the darkest level becomes ramp step 0 (the outline) and the rest spread over 1..5.
 */
function fromVanilla(rgba, ramps, split) {
  const cells = []
  for (let i = 0; i < W * H; i++) {
    const [r, g, b, a] = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], rgba[i * 4 + 3]]
    if (a < 128) {
      cells.push(null)
      continue
    }
    const max = Math.max(r, g, b)
    const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / max
    const level = Math.round(((0.299 * r + 0.587 * g + 0.114 * b) / 255) * 9)
    const group = split ? split(i % W, Math.floor(i / W)) : sat > 0.3 && r > b ? 'h' : 'a'
    cells.push({ group, level })
  }
  const levels = {}
  for (const c of cells) if (c) (levels[c.group] ??= new Set()).add(c.level)
  const toneOf = {}
  for (const [group, set] of Object.entries(levels)) {
    const sorted = [...set].sort((x, y) => x - y)
    toneOf[group] = new Map(sorted.map((l, i) => [l, i === 0 ? 0 : sorted.length === 2 ? 3 : 1 + Math.round(((l - sorted[1]) / Math.max(1, sorted.at(-1) - sorted[1])) * 4)]))
  }
  return cells.map((c) => (c ? { ramp: ramps[c.group] ?? ramps.a, tone: toneOf[c.group].get(c.level) } : null))
}

/**
 * A grid of material regions ('.' is empty) shaded from the top-left: edge pixels touching the outside are the
 * outline, the rest brighten toward the top-left and toward the middle of their region. `parts` maps a region
 * character to a ramp name, or 'ramp@n' for a flat step.
 */
function fromGrid(rows, parts) {
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? '.' : rows[y][x] ?? '.')
  const box = {}
  for (let y = 0; y < H; y++) {
    if (rows[y].length !== W) throw new Error(`grid row ${y} is ${rows[y].length} wide: "${rows[y]}"`)
    for (let x = 0; x < W; x++) {
      const c = at(x, y)
      if (c === '.') continue
      const b = (box[c] ??= { x0: x, x1: x, y0: y, y1: y })
      b.x0 = Math.min(b.x0, x)
      b.x1 = Math.max(b.x1, x)
      b.y0 = Math.min(b.y0, y)
      b.y1 = Math.max(b.y1, y)
    }
  }
  const N4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ]
  // Distance of every pixel from the edge of its region, for a rounded look.
  const dist = new Array(W * H).fill(Infinity)
  const queue = []
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = at(x, y)
      if (c !== '.' && N4.some(([dx, dy]) => at(x + dx, y + dy) !== c)) {
        dist[y * W + x] = 0
        queue.push([x, y])
      }
    }
  while (queue.length) {
    const [x, y] = queue.shift()
    for (const [dx, dy] of N4) {
      const nx = x + dx
      const ny = y + dy
      if (at(nx, ny) === at(x, y) && dist[ny * W + nx] === Infinity) {
        dist[ny * W + nx] = dist[y * W + x] + 1
        queue.push([nx, ny])
      }
    }
  }
  const cells = []
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = at(x, y)
      if (c === '.') {
        cells.push(null)
        continue
      }
      const spec = parts[c]
      if (!spec) throw new Error(`grid uses region '${c}' with no ramp`)
      const [ramp, fixed] = spec.split('@')
      if (fixed !== undefined) {
        cells.push({ ramp, tone: Number(fixed) })
        continue
      }
      if (N4.some(([dx, dy]) => at(x + dx, y + dy) === '.')) {
        cells.push({ ramp, tone: 0 })
        continue
      }
      const b = box[c]
      const u = (x - b.x0 + 0.5) / (b.x1 - b.x0 + 1)
      const v = (y - b.y0 + 0.5) / (b.y1 - b.y0 + 1)
      const light = 1 - (0.45 * u + 0.55 * v)
      const depth = Math.min(dist[y * W + x], 3) / 3
      let tone = Math.min(4, Math.max(1, 1 + Math.round((light * 0.72 + depth * 0.28) * 3.4)))
      const below = at(x, y + 1)
      const right = at(x + 1, y)
      if ((below !== '.' && below !== c) || (right !== '.' && right !== c)) tone = Math.max(1, tone - 1)
      cells.push({ ramp, tone })
    }
  return cells
}

/** Hand-placed pixels: every character of `rows` is a key into `pal` ('ramp@n'); '.' is empty. */
function fromPixels(rows, pal) {
  const cells = []
  rows.forEach((row, y) => {
    if (row.length !== W) throw new Error(`pixel row ${y} is ${row.length} wide: "${row}"`)
    for (const ch of row) {
      if (ch === '.') {
        cells.push(null)
        continue
      }
      const spec = pal[ch]
      if (!spec) throw new Error(`pixel '${ch}' has no palette entry`)
      const [ramp, tone] = spec.split('@')
      cells.push({ ramp, tone: Number(tone) })
    }
  })
  return cells
}

/** Paint details: '+'/'-' shift the shade, '*' highlight, '#' outline, '_' erase; legend letters recolour
 *  ('ramp', keeping the shade) or place a flat step ('ramp@n', also on empty pixels). */
function paint(cells, rows, legend = {}, ramp0) {
  if (!rows) return cells
  const out = cells.map((c) => (c ? { ...c } : null))
  rows.forEach((row, y) => {
    if (row.length !== W) throw new Error(`paint row ${y} is ${row.length} wide: "${row}"`)
    ;[...row].forEach((ch, x) => {
      if (ch === '.') return
      const i = y * W + x
      const c = out[i]
      if (ch === '_') out[i] = null
      else if (ch === '+') c && (c.tone = Math.min(5, c.tone + 1))
      else if (ch === '-') c && (c.tone = Math.max(0, c.tone - 1))
      else if (ch === '*') c && (c.tone = 5)
      else if (ch === '#') c && (c.tone = 0)
      else {
        const spec = legend[ch]
        if (!spec) throw new Error(`paint uses '${ch}' with no legend entry`)
        const [ramp, fixed] = spec.split('@')
        if (fixed !== undefined) out[i] = { ramp, tone: Number(fixed) }
        else out[i] = c ? { ...c, ramp } : { ramp, tone: 3 }
      }
    })
  })
  return out
}

// ---------------------------------------------------------------- procedural shapes

const blank = () => Array.from({ length: H }, () => Array(W).fill('.'))
const rowsOf = (g) => g.map((r) => r.join(''))

/** A heavy hammer: a block head across the top-right, bound with brass, on a diagonal haft. */
function warhammerGrid() {
  const g = blank()
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = x - y
      const s = x + y
      if (d >= 4 && d <= 8 && s >= 12 && s <= 20) g[y][x] = s === 14 || s === 18 ? 'b' : 'a'
      else if ((s === 15 || s === 16) && d >= -12 && d <= 3) g[y][x] = y >= 11 ? 'g' : 'h'
    }
  return rowsOf(g)
}

/** A builder's wand: a brass rod with a leather grip and a cut crystal on top. */
function wandGrid() {
  const g = blank()
  const crystal = [
    [11, 1],
    [10, 2],
    [11, 2],
    [12, 2],
    [9, 3],
    [10, 3],
    [11, 3],
    [12, 3],
    [13, 3],
    [10, 4],
    [11, 4],
    [12, 4],
    [11, 5]
  ]
  for (const [x, y] of crystal) g[y][x] = 'c'
  g[6][10] = 'b'
  g[5][10] = 'b'
  g[6][11] = 'b'
  for (let y = 7; y <= 13; y++) {
    const x = 16 - y
    for (const xx of [x - 1, x]) if (xx >= 0) g[y][xx] = y >= 11 ? 'g' : 'r'
  }
  return rowsOf(g)
}

// ---------------------------------------------------------------- the sprites

// Item ids are lemursaucepacket:<id>; effects are relics:<id> mob-effect icons.
const SPRITES = [
  // ------------------------------------------------ Prospector: blue steel, brass trim, a miner's lamp
  {
    id: 'prospector_helmet',
    base: 'iron_helmet',
    ramps: { a: 'steel' },
    legend: { B: 'brass', R: 'brass@1', L: 'lamp@3', W: 'lamp@5' },
    paint: ['', '', '', '', '.......RR.......', '......RWLR......', '......RLLR......', '....BB.RR.BB....'],
    pause: 180
  },
  {
    id: 'prospector_chestplate',
    base: 'iron_chestplate',
    ramps: { a: 'steel' },
    legend: { B: 'brass', D: 'leather', K: 'brass@4' },
    paint: ['', '', '', '', '.....B....B.....', '......B..BD.....', '.........D......', '........K.......', '.......D........', '......D.........', '.....D..........', '', '....BBBBBBBB....'],
    pause: 196
  },
  {
    id: 'prospector_leggings',
    base: 'iron_leggings',
    ramps: { a: 'steel' },
    legend: { B: 'brass', K: 'brass@5' },
    paint: ['', '', '....BBBBBBBB....', '...BBBBKBBBB....', '', '', '', '', '....BB....BB....'],
    pause: 212
  },
  {
    id: 'prospector_boots',
    base: 'iron_boots',
    ramps: { a: 'steel' },
    legend: { B: 'brass' },
    paint: ['', '', '', '....BBB..BBB....', '...BBBB..BBBB...', '', '', '', '', '', '.BB..........BB.', '.BB..........BB.'],
    pause: 228
  },

  // ------------------------------------------------ Aeronaut: flight leather, fleece, brass-rimmed goggles
  {
    id: 'aeronaut_helmet',
    base: 'iron_helmet',
    ramps: { a: 'leather' },
    legend: { B: 'brass', G: 'glass@3', g: 'glass@2', S: 'glass@5', F: 'fleece', T: 'brass@2' },
    paint: ['', '', '', '', '.....BB..BB.....', '....BSGTTSGB....', '....BggBBggB....', '....FF....FF....', '', '....F......F....', '....F......F....'],
    pause: 188
  },
  {
    id: 'aeronaut_chestplate',
    base: 'iron_chestplate',
    ramps: { a: 'leather' },
    legend: { F: 'fleece', K: 'brass@4' },
    paint: ['', '', '', '....FF....FF....', '.....FF..FF.....', '......F..F......', '.......-........', '.......-K.......', '.......-........', '.......-K.......', '.......-........', '.......-K.......'],
    pause: 204
  },
  {
    id: 'aeronaut_leggings',
    base: 'iron_leggings',
    ramps: { a: 'leather' },
    legend: { D: 'leather@1', K: 'brass@4', B: 'brass' },
    paint: ['', '', '', '....DDDKKDDD....', '', '', '', '', '', '....BB....BB....'],
    pause: 220
  },
  {
    id: 'aeronaut_boots',
    base: 'iron_boots',
    ramps: { a: 'leather' },
    legend: { F: 'fleece', K: 'brass@4', D: 'darksteel' },
    paint: ['', '', '', '....FFF..FFF....', '...FFFF..FFFF...', '', '', '....K.....K.....', '', '', '', '', '.DDDD......DDDD.'],
    pause: 236
  },

  // ------------------------------------------------ Brass Duelist: gilded plate, crimson plume and sash
  {
    id: 'duelist_helmet',
    base: 'iron_helmet',
    ramps: { a: 'gold' },
    legend: { r: 'crimson@1', R: 'crimson@3', Q: 'crimson@4', q: 'crimson@0' },
    paint: ['..........qQ....', '........qRQRq...', '.......qRRq.....', '', '', '', '', '', '....*......*....'],
    pause: 176
  },
  {
    id: 'duelist_chestplate',
    base: 'iron_chestplate',
    ramps: { a: 'gold' },
    legend: { S: 'crimson' },
    paint: ['', '', '', '', '....SS..........', '.....SS.........', '......SS........', '.......SS.......', '........SS......', '.........SS.....', '..........S.....'],
    pause: 192
  },
  {
    id: 'duelist_leggings',
    base: 'iron_leggings',
    ramps: { a: 'gold' },
    legend: { S: 'crimson', T: 'crimson@3', t: 'crimson@1' },
    paint: ['', '', '', '.......SS.......', '.......SS.......', '.......SS.......', '.......SS.......', '.......Tt.......', '.......Tt.......', '.......t........'],
    pause: 208
  },
  {
    id: 'duelist_boots',
    base: 'iron_boots',
    ramps: { a: 'gold' },
    legend: { S: 'crimson' },
    paint: ['', '', '', '', '...SSSS..SSSS...', '', '', '', '', '', '..*..........*..'],
    pause: 224
  },

  // ------------------------------------------------ Compacted Diamond: dense cyan crystal with a crest
  {
    id: 'compacted_diamond_helmet',
    base: 'iron_helmet',
    ramps: { a: 'diamond' },
    legend: { C: 'diamond@4', c: 'diamond@1', S: 'diamond@5' },
    paint: ['', '.......S........', '......cCc.......', '', '....*...........', '', '', '', '...........S....'],
    pause: 184
  },
  {
    id: 'compacted_diamond_chestplate',
    base: 'iron_chestplate',
    ramps: { a: 'diamond' },
    legend: { S: 'diamond@5' },
    paint: ['', '', '', '..S.............', '', '', '', '.......-........', '......-.-.......', '.......-...S....', '', '', ''],
    pause: 200
  },
  {
    id: 'compacted_diamond_leggings',
    base: 'iron_leggings',
    ramps: { a: 'diamond' },
    legend: { S: 'diamond@5' },
    paint: ['', '', '', '....S...........', '', '', '', '', '..........S.....'],
    pause: 216
  },
  {
    id: 'compacted_diamond_boots',
    base: 'iron_boots',
    ramps: { a: 'diamond' },
    legend: { S: 'diamond@5' },
    paint: ['', '', '', '', '....S.....S.....', '', '', '', '', '..S.............'],
    pause: 232
  },

  // ------------------------------------------------ Compacted Netherite: soot-dark plate with violet runes
  {
    id: 'compacted_netherite_helmet',
    base: 'iron_helmet',
    ramps: { a: 'netherite' },
    legend: { H: 'netherite@3', h: 'netherite@1', G: 'nethglow@5', g: 'nethglow@3' },
    paint: ['', '...G........G...', '...h........h...', '....H......H....', '', '.......g........', '', '', '......G..G......'],
    pause: 180
  },
  {
    id: 'compacted_netherite_chestplate',
    base: 'iron_chestplate',
    ramps: { a: 'netherite' },
    legend: { G: 'nethglow@4', g: 'nethglow@3' },
    paint: ['', '', '', '', '', '', '.......g........', '.......G........', '......gGg.......', '.......G........', '.......g........'],
    pause: 196
  },
  {
    id: 'compacted_netherite_leggings',
    base: 'iron_leggings',
    ramps: { a: 'netherite' },
    legend: { G: 'nethglow@4', g: 'nethglow@3' },
    paint: ['', '', '', '.......gg.......', '', '.....g....g.....', '.....G....G.....', '.....g....g.....'],
    pause: 212
  },
  {
    id: 'compacted_netherite_boots',
    base: 'iron_boots',
    ramps: { a: 'netherite' },
    legend: { G: 'nethglow@4', g: 'nethglow@3' },
    paint: ['', '', '', '', '', '....g.....g.....', '....G.....G.....', '', '', '', '..g..........g..'],
    pause: 228
  },

  // ------------------------------------------------ singles
  {
    id: 'anglers_cap',
    px: [
      '................',
      '................',
      '................',
      '................',
      '.....OOOOOO.....',
      '....OAAABBCO....',
      '....OAABBBCO....',
      '...OABBBBBCCO...',
      '...OkKKRwKKkO...',
      '.OOABBBBBBBCCOO.',
      'OAABBBBBBBBBCCDO',
      '.OOOOOOOOOOOOOO.',
      '.............s..',
      '............Rr..',
      '................',
      '................'
    ],
    pal: { O: 'teal@0', A: 'teal@4', B: 'teal@3', C: 'teal@2', D: 'teal@1', k: 'leather@1', K: 'leather@3', R: 'crimson@4', r: 'crimson@2', w: 'fleece@5', s: 'steel@4' },
    pause: 190
  },
  {
    id: 'ember_crown',
    grid: [
      '................',
      '................',
      '................',
      '................',
      '..a....aa....a..',
      '..aa..aaaa..aa..',
      '..aaa.aaaa.aaa..',
      '..aaaaaaaaaaaa..',
      '..aaaaaaaaaaaa..',
      '..aaaaaaaaaaaa..',
      '..cccccccccccc..',
      '................',
      '................',
      '................',
      '................',
      '................'
    ],
    parts: { a: 'steel', c: 'gold' },
    legend: { E: 'ember@5', e: 'ember@3', f: 'ember@2', G: 'ember@4', g: 'ember@2' },
    paint: ['', '..E.....E....E..', '..e....Ee....e..', '..f....ff....f..', '', '', '', '', '....G..GG..G....', '....g..gg..g....'],
    pause: 150
  },
  {
    id: 'brass_sabre',
    base: 'iron_sword',
    ramps: { a: 'brass', h: 'crimson' },
    legend: { G: 'gold' },
    paint: ['', '', '', '', '', '', '..GG............', '..GGG...........', '...GGG..........', '...GGG..........', '....GGGG........', '.....GGGG.......', '......GGGG......', 'GG......GG......', 'GGG.............', 'GGG.............'],
    pause: 200
  },
  {
    id: 'sturdy_warhammer',
    base: 'mace',
    split: (x, y) => (y >= 8 && x <= 7 ? 'h' : 'a'),
    ramps: { a: 'iron', h: 'wood' },
    legend: { B: 'brass' },
    paint: ['', '', '', '', '', '', '', '.......BB.......', '........B.......', '', '', '', '', 'BBB.............', 'BB..............'],
    pause: 216
  },
  {
    id: 'stormcallers_sabre',
    base: 'iron_sword',
    ramps: { a: 'storm', h: 'darksteel' },
    legend: { G: 'steel', S: 'storm@5', s: 'storm@4' },
    paint: ['', '..........S.....', '', '...............S', '...........s....', '..............s.', '..GG............', '..GGG...........', '...GGG..........', '...GGG..........', '....GGGG........', '.....GGGG.......', '......GGGG......', 'GG......GG......', 'GGG.............', 'GGG.............'],
    pause: 120
  },
  {
    id: 'lumber_axe',
    base: 'iron_axe',
    ramps: { a: 'iron', h: 'wood' },
    legend: { B: 'brass' },
    paint: ['', '', '', '', '...........BB...', '............B...', '.........B......', '........B.......'],
    pause: 204
  },
  {
    id: 'excavators_pickaxe',
    base: 'iron_pickaxe',
    ramps: { a: 'darksteel', h: 'wood' },
    legend: { K: 'brass@4', B: 'brass' },
    paint: ['', '', '', '.......K....BB..', '............B...', '..........B.....', '.............K..'],
    pause: 220
  },
  {
    id: 'prospectors_pickaxe',
    base: 'iron_pickaxe',
    ramps: { a: 'ember', h: 'wood' },
    legend: { B: 'brass' },
    paint: ['', '', '', '............BB..', '............B...', '..........B.....'],
    pause: 140
  },
  {
    id: 'harvesters_scythe',
    base: 'iron_hoe',
    ramps: { a: 'iron', h: 'wood' },
    legend: { O: 'iron@0', D: 'iron@1', M: 'iron@2', m: 'iron@3', L: 'iron@4', W: 'iron@5', G: 'leaf@4', g: 'leaf@2' },
    paint: ['', '..OOOOO.........', '.OLLWWL.........', 'OMmmmmmm........', 'OMDOOOOOO.......', 'OO..............', '.........GG.....', '........gg.G....', '...........g....'],
    pause: 212
  },
  {
    id: 'builders_wand',
    base: 'blaze_rod',
    split: (x, y) => (y >= 10 ? 'g' : 'h'),
    ramps: { h: 'brass', g: 'leather', a: 'brass' },
    legend: { O: 'crystal@0', W: 'crystal@5', L: 'crystal@4', M: 'crystal@2', S: 'crystal@5', s: 'crystal@4' },
    paint: ['............O.S.', '.........s.OWO..', '..........OLWMO.', '...........OMO.S', '............O...'],
    pause: 130
  },

  // ------------------------------------------------ materials
  {
    id: 'compacted_diamond',
    px: [
      '................',
      '................',
      '............S...',
      '..........OOO...',
      '.......OOOHWLO..',
      '....OOOLLWWWLO..',
      '.OOOLLWWWWLLDO..',
      'OLLWWWWWLLLDDO..',
      'OLWWWLLLLDDDO...',
      'OLLLLLLDDDDOO...',
      'ODDDDDDDDOO.....',
      '.OOOOOOOO.......',
      '..S.............',
      '................',
      '................',
      '................'
    ],
    pal: { O: 'diamond@0', D: 'diamond@2', L: 'diamond@3', W: 'diamond@4', H: 'diamond@5', S: 'diamond@5' },
    pause: 170
  },
  {
    id: 'compacted_netherite',
    base: 'netherite_ingot',
    ramps: { a: 'netherite' },
    legend: { G: 'nethglow@4', g: 'nethglow@3' },
    paint: ['', '', '', '', '.......g........', '.....gG.........', '....g...Gg......', '..........G.....', '', '', '', ''],
    pause: 190
  },
  {
    id: 'duelists_pattern',
    px: [
      '................',
      '..OOOOOOOOOOOO..',
      '.OPPPPPPPPPPPPO.',
      '.OPLLLLLLLLLLPO.',
      '.OLLKLLLLLLKLLO.',
      '.OLLLKLLLLKLLLO.',
      '.OLLLLKLLKLLLLO.',
      '.OLLLLLKKLLLLLO.',
      '.OLLLGLKKLGLLLO.',
      '.OLLLLGLLGLLLLO.',
      '.OLLLgLGGLgLLLO.',
      '.OLLRLLLLLLRLLO.',
      '.OPLLLLLLLLLLPO.',
      '.OPPPPPPPPPPPPO.',
      '..OOOOOOOOOOOO..',
      '................'
    ],
    pal: { O: 'parchment@0', P: 'parchment@2', L: 'parchment@4', K: 'steel@5', G: 'gold@4', g: 'leather@2', R: 'crimson@3' },
    pause: 206
  },

  // ------------------------------------------------ Relics effect icons Relics 0.12.8 forgot
  {
    id: 'flight',
    kind: 'effect',
    base: 'feather',
    ramps: { a: 'plume', h: 'plume' },
    legend: { S: 'sky@5', s: 'sky@4', t: 'sky@3' },
    paint: ['', '.............S..', '', '', '', '..t.............', '.t..............', '', '', '..........S.....', '', '', '', '', '', ''],
    shimmer: false
  },
  {
    id: 'tremor',
    kind: 'effect',
    px: [
      '................',
      '................',
      '................',
      '...d........d...',
      '.d....d..d....d.',
      '................',
      '..A..........A..',
      '..OOOOOOOOOOOO..',
      '.OLAAAAOAAAAAAO.',
      'OABBBBOEOBBBBBBO',
      'OBCCCOEOCCOOCCCO',
      'ODDDOEODDOEODDDO',
      '.OOOOOOOOOOOOOO.',
      '................',
      '................',
      '................'
    ],
    pal: { O: 'earth@0', L: 'earth@5', A: 'earth@4', B: 'earth@3', C: 'earth@2', D: 'earth@1', E: 'ember@4', d: 'earth@3' },
    shimmer: false
  },
]

// ---------------------------------------------------------------- render

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

function toRgba(cells) {
  const buf = Buffer.alloc(W * H * 4)
  cells.forEach((c, i) => {
    if (!c) return
    const ramp = RAMPS[c.ramp]
    if (!ramp) throw new Error(`unknown ramp ${c.ramp}`)
    const [r, g, b] = hex(ramp[Math.max(0, Math.min(5, c.tone))])
    buf.set([r, g, b, 255], i * 4)
  })
  return buf
}

/** The Relics shimmer: a two-pixel diagonal band of light crossing the item. */
function shimmerFrames(cells) {
  const frames = [cells]
  for (let s = -2; s <= 32; s += 3) {
    frames.push(
      cells.map((c, i) => {
        if (!c) return null
        const x = i % W
        const y = Math.floor(i / W)
        const d = x + y - s
        const boost = d === 0 || d === 1 ? (c.tone === 0 ? 1 : 2) : d === -1 || d === 2 ? 1 : 0
        return boost ? { ...c, tone: Math.min(5, c.tone + boost) } : c
      })
    )
  }
  return frames
}

async function writeSprite(file, frames, pause) {
  const strip = Buffer.concat(frames.map(toRgba))
  await sharp(strip, { raw: { width: W, height: H * frames.length, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file)
  const meta = `${file}.mcmeta`
  if (frames.length > 1) {
    const animation = { animation: { interpolate: false, frames: [{ index: 0, time: pause }, ...frames.slice(1).map((_, i) => ({ index: i + 1, time: 2 }))] } }
    writeFileSync(meta, JSON.stringify(animation, null, 2) + '\n')
  } else if (existsSync(meta)) rmSync(meta)
}

export async function buildItems({ preview } = {}) {
  const vanilla = await loadVanilla()
  mkdirSync(ITEM_DIR, { recursive: true })
  mkdirSync(EFFECT_DIR, { recursive: true })
  const firstFrames = []
  for (const s of SPRITES) {
    let cells
    if (s.base) {
      if (!vanilla[s.base]) throw new Error(`${s.id}: vanilla sprite ${s.base} missing from the jar`)
      cells = fromVanilla(vanilla[s.base], s.ramps, s.split)
    } else if (s.px) cells = fromPixels(s.px, s.pal)
    else cells = fromGrid(s.grid, s.parts)
    cells = paint(cells, s.paint && s.paint.map((r) => (r === '' ? '.'.repeat(W) : r)).concat(Array(Math.max(0, H - (s.paint?.length ?? 0))).fill('.'.repeat(W))), s.legend)
    const frames = s.shimmer === false ? [cells] : shimmerFrames(cells)
    const dir = s.kind === 'effect' ? EFFECT_DIR : ITEM_DIR
    await writeSprite(path.join(dir, `${s.id}.png`), frames, s.pause ?? 200)
    firstFrames.push({ id: s.id, rgba: toRgba(cells) })
  }
  console.log(`items: ${SPRITES.filter((s) => s.kind !== 'effect').length} item sprites (16x16, Relics style), ${SPRITES.filter((s) => s.kind === 'effect').length} Relics effect icons`)
  if (preview) await writePreview(preview, firstFrames)
}

/** A review sheet: every sprite at 8x on a mid-grey plate, 8 per row. */
async function writePreview(file, sprites) {
  const scale = 8
  const cell = W * scale + 16
  const cols = 8
  const rows = Math.ceil(sprites.length / cols)
  const composites = []
  for (const [i, s] of sprites.entries()) {
    const big = await sharp(s.rgba, { raw: { width: W, height: H, channels: 4 } }).resize(W * scale, H * scale, { kernel: 'nearest' }).png().toBuffer()
    composites.push({ input: big, left: (i % cols) * cell + 8, top: Math.floor(i / cols) * cell + 8 })
  }
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: { r: 60, g: 58, b: 64, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(file)
  console.log(`items: preview ${file}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--preview')
  await buildItems({ preview: i > 0 ? process.argv[i + 1] : undefined })
}
