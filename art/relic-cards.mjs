// Ability cards for the pack's own relics: the 22x31 pictures Relics shows for each ability on a relic's page
// (Relics looks for relics:textures/abilities/<relic>/<ability>.png and shows a "WIP" card when there's none).
//
// A card is a small scene in Relics' style: a dark vignette, one subject in the middle, a little light on it. The
// subject is a grid of palette letters over a background painted in code (the vignette, faint dust, ground).
//
// Run: node art/relic-cards.mjs   (art/items.mjs runs it too). Writes into lsp_fixes's resources, under the relics
// namespace: mods-src/lemursaucepacket-fixes/src/main/resources/assets/relics/textures/abilities/<relic>/<ability>.png

import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(root, 'mods-src/lemursaucepacket-fixes/src/main/resources/assets/relics/textures/abilities')
const W = 22
const H = 31

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const smooth = (t) => t * t * (3 - 2 * t)
// Same idea as items.mjs's ramps: [outline, shadow, dark, mid, light, highlight].
const RAMP = {
  leather: ['#24100b', '#482315', '#703b20', '#98592f', '#c07b43', '#e3a86a'],
  fleece: ['#3a291c', '#6b533f', '#a0876c', '#cbb596', '#e9dbc1', '#fffaf0'],
  brass: ['#3b1a0d', '#6d3514', '#a8601b', '#dd9a2a', '#f7cb4d', '#fff6ad'],
  steel: ['#1c1b2c', '#34354f', '#51587a', '#7682a2', '#a6b3cd', '#e6eef8'],
  stone: ['#121419', '#22262e', '#363c46', '#4f5662', '#6f7886', '#98a2b0'],
  sky: ['#0e2240', '#1d4a7d', '#3a82bf', '#72b9e6', '#b8e3f7', '#ffffff']
}

/** Deterministic noise, so a card comes out the same every run. */
function noise(x, y, seed) {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

const CARDS = [
  {
    // Climbing Boots / Foothold: a crampon-shod boot stepping up onto a stone ledge, light catching the ledge's lip.
    relic: 'climbing_boots',
    ability: 'foothold',
    seed: 7,
    vignette: { inner: '#33506a', edge: '#060a0f', cx: 9, cy: 12 },
    px: [
      '......................',
      '......................',
      '......................',
      '......................',
      '......................',
      '...OOOOOOO............',
      '..OfffffffO...........',
      '..OFFFFFFFO...........',
      '..OFfFFfFFO...........',
      '..OlLLLLLdO...........',
      '..OlLLLLLdO...........',
      '..OBBBKBBBO...........',
      '..OlLLLLLdO...........',
      '..OlLLLLLLdOO.........',
      '..OlLLLLLLLLdOO.......',
      '..OlLLLLLLLLLLdO......',
      '..OlLLLLLLLLLLLdO.....',
      '..OTLLLLLLLLLLLLTO....',
      '..OSSSSSSSSSSSSSSO....',
      '...s..s..s..s..s......',
      '............uuuuuuuuuu',
      '....v.......gHHHHHHHHH',
      '....v..v....gmmmmmmmmm',
      '....v..v....gmmMmmmmmm',
      '.......v....gmmmmmMmmm',
      '............gmmmmmmmmm',
      'cccccccccc..gmmmMmmmmm',
      'CmmmmcmmmC..gmmmmmmmMm',
      'mmmMmmmmmm..gmMmmmmmmm',
      'mmmmmmmMmm..gmmmmmmmmm',
      'mmmmmmmmmm..gmmmmMmmmm'
    ],
    pal: {
      O: 'leather@0', L: 'leather@3', l: 'leather@4', d: 'leather@2',
      F: 'fleece@3', f: 'fleece@5', B: 'brass@3', K: 'brass@5', T: 'steel@3', S: 'steel@2', s: 'steel@5',
      u: 'stone@5', g: 'stone@1', H: 'stone@4', m: 'stone@2', M: 'stone@1', c: 'stone@3', C: 'stone@2',
      v: 'sky@3'
    }
  }
]

function color(spec) {
  const [ramp, tone] = spec.split('@')
  return hex(RAMP[ramp][Number(tone)])
}

async function card(c) {
  if (c.px.length !== H) throw new Error(`card ${c.relic}/${c.ability}: ${c.px.length} rows, not ${H}`)
  const buf = Buffer.alloc(W * H * 4)
  const inner = hex(c.vignette.inner)
  const edge = hex(c.vignette.edge)
  for (let y = 0; y < H; y++) {
    const row = c.px[y]
    if (row.length !== W) throw new Error(`card ${c.relic}/${c.ability} row ${y} is ${row.length} wide`)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const ch = row[x]
      let rgb
      if (ch === '.') {
        // The vignette, with a little dust in the light.
        const dx = (x - c.vignette.cx) / (W * 0.62)
        const dy = (y - c.vignette.cy) / (H * 0.62)
        const t = smooth(Math.min(1, Math.sqrt(dx * dx + dy * dy)))
        rgb = mix(inner, edge, t)
        const n = noise(x, y, c.seed)
        if (n > 0.965 && t < 0.7) rgb = mix(rgb, [255, 255, 255], 0.22)
        else rgb = rgb.map((v) => Math.max(0, Math.min(255, v + Math.round((n - 0.5) * 8))))
      } else {
        const spec = c.pal[ch]
        if (!spec) throw new Error(`card ${c.relic}/${c.ability} uses '${ch}' with no palette entry`)
        rgb = color(spec)
        // Ground and stone darken towards the card's foot, as Relics' cards fade at the edges.
        if (spec.startsWith('stone')) rgb = mix(rgb, edge, Math.max(0, (y - 22) / 14))
      }
      buf[i] = rgb[0]
      buf[i + 1] = rgb[1]
      buf[i + 2] = rgb[2]
      buf[i + 3] = 255
    }
  }
  const dir = path.join(OUT, c.relic)
  mkdirSync(dir, { recursive: true })
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(dir, `${c.ability}.png`))
}

export async function buildRelicCards() {
  for (const c of CARDS) await card(c)
  console.log(`relic cards: ${CARDS.length} ability card${CARDS.length === 1 ? '' : 's'} (22x31)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await buildRelicCards()
