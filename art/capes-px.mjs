// Every cape as 64x32 pixel art, the native Minecraft cape size: woven cloth rather than framed pictures.
// Skill capes follow Old School RuneScape's idea: the skill's colour, a band near the hem and a small stitched
// emblem. Quest and achievement capes are heraldic patterns (rails, a beacon beam, a saltire, ring-tail bands).
// The legendary capes (LEGENDARY) are woven the same way, with a gold trim, and animate in pixel steps.
//
// Layout (vanilla cape UV, 10x16x1 box at 0,0): front x1-10 y1-16 (what people see on your back), inner side
// x12-21 y1-16, edges around them; the elytra area x22-45 y0-21 is filled too, because a player's cape texture
// is drawn on their elytra.

import sharp from 'sharp'
import { RAMPS } from './items.mjs'

const CLOTH = {
  red: ['#2a070d', '#55101b', '#861b25', '#b52b2e', '#d8503d', '#f2825a'],
  rust: ['#240a0a', '#4a1512', '#76231a', '#a13a24', '#c85b33', '#e98a52'],
  blue: ['#0a1330', '#132a5e', '#1d4690', '#2f67bb', '#5190d8', '#8ec0f0'],
  green: ['#0b200f', '#15401a', '#1f6127', '#2f8434', '#52a84b', '#8bd070'],
  slate: ['#15171f', '#282c38', '#3d4353', '#57606f', '#7a8494', '#a9b3c0'],
  forest: ['#0d1d0e', '#1b3a1a', '#2a5a26', '#3f7b34', '#5f9c48', '#8ec16a'],
  olive: ['#1e1f0b', '#3b3d15', '#5d5f1f', '#81812c', '#a6a342', '#cfc76a'],
  ocean: ['#081c29', '#10384f', '#185576', '#23769b', '#3f9dbf', '#7fcfe0'],
  plum: ['#1f0b1c', '#3e1638', '#62225a', '#8a327f', '#b052a3', '#d58bc9'],
  iron: ['#16181c', '#2a2e36', '#434953', '#5f6773', '#858e9b', '#b6bdc7'],
  tan: ['#2a1a0c', '#4f3419', '#795127', '#a07038', '#c79552', '#e8c17e'],
  navy: ['#0a0f24', '#141d44', '#1f2d68', '#2e428c', '#4a62b0', '#7d92d6'],
  black: ['#0b0b0e', '#17171c', '#24242b', '#33333c', '#474752', '#636370'],
  white: ['#4a4652', '#7b7784', '#a9a5b1', '#cfccd6', '#ebe8f0', '#ffffff'],
  royal: ['#150a2a', '#2a1454', '#42207e', '#5c31a3', '#7e4fc4', '#aa82e2'],
  emerald: ['#062016', '#0d3f2a', '#15613f', '#1f8455', '#34a86f', '#6cd699'],
  dusk: ['#140f22', '#261d40', '#3a2d5e', '#52427c', '#6f5e9c', '#9a8bc4']
}
const ramp = (name) => CLOTH[name] ?? RAMPS[name] ?? (() => { throw new Error(`no ramp ${name}`) })()

// Tiny emblems: rows of palette keys, '.' is cloth showing through.
const EMBLEMS = {
  sword: { rows: ['..W..', '..S..', '..S..', '..S..', '..S..', '.GgG.', '..b..', '..G..'], pal: { W: 'steel@5', S: 'steel@4', G: 'gold@3', g: 'gold@5', b: 'leather@2' } },
  axe: { rows: ['.S.S.', 'SSSSS', 'SWbWS', '..b..', '..b..', '..b..'], pal: { S: 'steel@3', W: 'steel@5', b: 'wood@3' } },
  shield: { rows: ['GGGGG', 'GwwwG', 'GwGwG', 'GwwwG', '.GwG.', '..G..'], pal: { G: 'gold@4', w: 'white@4' } },
  arrow: { rows: ['...WWW', '....sW', '...s.W', '..s...', 'gs....', 'gg....'], pal: { W: 'white@5', s: 'steel@3', g: 'gold@4' } },
  heart: { rows: ['.R.R.', 'RrRRR', 'RRRRR', '.RRR.', '..R..'], pal: { R: 'crimson@3', r: 'crimson@5' } },
  pickaxe: { rows: ['.SSS.', 'S.b.S', '..b..', '..b..', '..b..', '..b..'], pal: { S: 'steel@4', b: 'wood@3' } },
  tree: { rows: ['.LLL.', 'LlLLL', 'LLLLL', '.LLL.', '..b..', '..b..'], pal: { L: 'leaf@3', l: 'leaf@5', b: 'wood@2' } },
  wheat: { rows: ['Y.Y.Y', '.YYY.', '..Y..', '.YYY.', '..Y..', '..Y..'], pal: { Y: 'gold@4' } },
  fish: { rows: ['..WW...', '.WWWW.W', 'WoWWWWW', '.WWWW.W', '..WW...'], pal: { W: 'white@4', o: 'black@1' } },
  flame: { rows: ['..Y..', '.YOY.', '.OYO.', 'OOYOO', 'OYyYO', '.OOO.'], pal: { O: 'ember@3', Y: 'ember@4', y: 'ember@5' } },
  anvil: { rows: ['SSSSS.', '.SSSS.', '..SS..', '.SSSS.'], pal: { S: 'black@3' } },
  gear: { rows: ['...G...', '.GGGGG.', '.GG.GG.', 'GG...GG', '.GG.GG.', '.GGGGG.', '...G...'], pal: { G: 'brass@4' } },
  cog: { rows: ['...G...', '.GGGGG.', '.GG.GG.', 'GG...GG', '.GG.GG.', '.GGGGG.', '...G...'], pal: { G: 'brass@1' } },
  wings: { rows: ['W.....W', 'WW...WW', 'WWW.WWW', '.WWWWW.', '..W.W..'], pal: { W: 'white@5' } },
  sapling: { rows: ['.L.L.', 'LlLlL', '.LLL.', '..b..', '..b..', '.bbb.'], pal: { L: 'leaf@3', l: 'leaf@5', b: 'wood@2' } },
  crown: { rows: ['Y..Y..Y', 'YY.Y.YY', 'YYYYYYY', 'YrYrYrY', 'YYYYYYY'], pal: { Y: 'gold@4', r: 'crimson@4' } },
  star: { rows: ['..Y..', '..Y..', 'YYYYY', '.YYY.', '.Y.Y.'], pal: { Y: 'gold@5' } },
  compass: { rows: ['..R..', '..W..', 'RW.WR', '..W..', '..R..'], pal: { R: 'crimson@3', W: 'white@4' } },
  emerald: { rows: ['.EE.', 'EeEE', 'EEEE', 'EEEE', '.EE.'], pal: { E: 'emerald@3', e: 'emerald@5' } }
}

// Patterns decide each front pixel: [ramp, tone offset] or null for the plain field. fx 0-9, fy 0-15.
const PATTERNS = {
  split: (d) => (fx) => (fx >= 5 ? [d.field2, 0] : null),
  chevron: (d) => (fx, fy) => {
    const dist = Math.abs(fx - 4.5) - 0.5
    return fy >= 6 + dist && fy <= 8 + dist ? [d.field, -1] : null
  },
  rails: () => (fx, fy) => {
    if (fx === 2 || fx === 7) return ['steel', 1]
    if (fy % 3 === 1 && fx >= 1 && fx <= 8) return ['wood', -1]
    return null
  },
  sky: (d) => (fx, fy) => {
    const birds = [
      [3, 2], [3, 4], [4, 3],
      [6, 6], [6, 8], [7, 7]
    ]
    if (birds.some(([y, x]) => y === fy && x === fx)) return ['white', 2]
    if (fy === 10 && fx % 3 !== 2) return ['white', 1]
    if (fy === 11) return ['white', 0]
    return fy < 5 ? [d.field, -1] : fy >= 11 ? [d.field, 1] : null
  },
  flames: () => (fx, fy) => {
    const top = [12, 10, 11, 9, 11, 10, 12, 10, 11, 12][fx]
    if (fy < top) return null
    return fy <= top ? ['ember', 1] : fy >= 14 ? ['ember', -1] : ['ember', 0]
  },
  stripe: (d) => (fx) => (fx === 4 || fx === 5 ? [d.accent, 0] : null),
  saltire: (d) => (fx, fy) => (Math.abs(fx - fy * 0.6) < 0.7 || Math.abs(9 - fx - fy * 0.6) < 0.7 ? [d.accent, 0] : null),
  trail: () => (fx, fy) => {
    const path = [7, 7, 6, 5, 4, 3, 3, 4, 5, 6, 6, 5, 4, 3, 3, 3]
    return fy >= 7 && fy % 2 === 0 && fx === path[fy] ? ['crimson', 0] : null
  },
  band: (d) => (fx, fy) => (fy === 9 || fy === 10 ? [d.accent, 1] : null),
  beam: () => (fx) => (fx === 4 || fx === 5 ? ['glass', 2] : fx === 3 || fx === 6 ? ['glass', -1] : null),
  feathers: (d) => (fx, fy) => ((fy + Math.round(Math.abs(fx - 4.5))) % 6 === 0 ? [d.field, 2] : null),
  ringtail: () => (fx, fy) => (Math.floor(fy / 2) % 2 === 0 ? ['black', 0] : ['white', 0])
}

// Every static cape. band = the stripe near the hem; lining = the inner side and edges.
export const DESIGNS = {
  attack_cape: { field: 'red', band: 'gold', emblem: 'sword' },
  strength_cape: { field: 'rust', band: 'gold', emblem: 'axe' },
  defence_cape: { field: 'blue', band: 'white', emblem: 'shield' },
  ranged_cape: { field: 'green', band: 'tan', emblem: 'arrow' },
  hitpoints_cape: { field: 'white', band: 'red', emblem: 'heart' },
  mining_cape: { field: 'slate', band: 'brass', emblem: 'pickaxe' },
  woodcutting_cape: { field: 'forest', band: 'tan', emblem: 'tree' },
  farming_cape: { field: 'olive', band: 'tan', emblem: 'wheat' },
  fishing_cape: { field: 'ocean', band: 'white', emblem: 'fish' },
  cooking_cape: { field: 'plum', band: 'gold', emblem: 'flame' },
  smithing_cape: { field: 'iron', band: 'brass', emblem: 'anvil' },
  crafting_cape: { field: 'tan', band: 'brass', emblem: 'gear' },
  agility_cape: { field: 'navy', band: 'white', emblem: 'wings' },
  enchanting_cape: { field: 'royal', band: 'gold', emblem: 'star' },
  settlers_cape: { field: 'forest', field2: 'earth', band: 'brass', emblem: 'sapling', pattern: 'split' },
  brass_age_cape: { field: 'brass', band: 'black', emblem: 'cog' },
  iron_roads_cape: { field: 'iron', band: 'brass', pattern: 'rails' },
  skyward_cape: { field: 'sky', band: 'white', pattern: 'sky' },
  crown_of_fire_cape: { field: 'black', band: 'gold', emblem: 'crown', pattern: 'flames', noBand: true },
  legacy_cape: { field: 'royal', band: 'gold', accent: 'gold', emblem: 'star', pattern: 'stripe' },
  armory_cape: { field: 'iron', band: 'gold', accent: 'crimson', pattern: 'saltire' },
  explorer_cape: { field: 'parchment', band: 'crimson', emblem: 'compass', pattern: 'trail' },
  hero_cape: { field: 'emerald', band: 'gold', accent: 'white', emblem: 'emerald', pattern: 'band' },
  beacon_cape: { field: 'navy', band: 'glass', pattern: 'beam', noBand: true },
  wings_cape: { field: 'dusk', band: 'white', pattern: 'feathers' },
  lemur_cape: { field: 'black', band: 'gold', pattern: 'ringtail', lining: 'black' }
}

// The legendary capes: woven like the rest, with a braided gold trim, a bigger emblem, and a short pixel animation
// that loops every 12 frames (the client steps a frame every 4 ticks): a glint sweeps down the cloth and rests,
// while stars twinkle, a cog turns or a dragon's fire flickers.
const LEGEND_EMBLEMS = {
  radiant: { rows: ['...Y...', '.y.Y.y.', '..YWY..', 'YYWWWYY', '..YWY..', '.y.Y.y.', '...Y...'], pal: { Y: 'gold@4', W: 'gold@5', y: 'gold@2' } },
  cogA: { rows: ['..G..', '.GGG.', 'GG.GG', '.GGG.', '..G..'], pal: { G: 'brass@4' } },
  cogB: { rows: ['G...G', '.GGG.', '.G.G.', '.GGG.', 'G...G'], pal: { G: 'brass@4' } },
  book: { rows: ['.WWWWWW.', 'WwwwswwW', 'WwwWsWwW', 'BBBBBBBB'], pal: { W: 'white@4', w: 'white@2', s: 'white@1', B: 'gold@3' } },
  dragon: { rows: ['.H......', '.KH.....', 'KKKKKH..', 'KKeKKKKK', 'KKKKKw..', '.K..Kw..'], pal: { K: 'black@3', H: 'black@5', w: 'white@5', e: 'ember@5' } }
}
// Dragon fire, two flickers: purple flame from the open jaw, spilling down to the right.
const DRAGON_FIRE = [
  [[6, 4, 4], [7, 5, 4], [6, 5, 2], [6, 6, 4], [7, 6, 5], [5, 7, 2], [6, 7, 4], [7, 7, 3], [6, 8, 2]],
  [[6, 4, 5], [7, 4, 2], [7, 5, 4], [6, 6, 3], [7, 6, 4], [6, 7, 5], [7, 7, 2], [5, 8, 2], [7, 8, 3]]
]
// Thirteen small stars round the Maxed Cape's sun.
const MAX_STARS = [[2, 1], [5, 1], [8, 1], [1, 9], [4, 10], [7, 9], [2, 11], [8, 11], [3, 13], [6, 14], [8, 13], [1, 14], [5, 13]]

// The Fire Cape: Minecraft's lava, pouring down the cloth. A 10x12 tile of lava (ember tones 1-5, 'c' a crust of
// cooling rock) that slides down a row a frame, so twelve frames loop seamlessly.
const LAVA = [
  '3344332234',
  '3445433223',
  '2344c43322',
  '2234443332',
  '3223443433',
  '4322344443',
  '4432234554',
  '34433234c4',
  '3344332344',
  '2334432233',
  'c233443322',
  '3223344332'
]
// The Infernal Cape: black obsidian split by branching cracks of lava, over a molten hem. Each crack is a path from
// the collar down (cloth x, y); light pulses down the paths a step a frame.
const INFERNAL_CRACKS = [
  [[4, 1], [4, 2], [3, 3], [3, 4], [2, 5], [2, 6], [3, 7], [3, 8], [2, 9], [2, 10], [1, 11], [2, 12], [2, 13]],
  [[5, 3], [5, 4], [6, 5], [6, 6], [7, 7], [6, 8], [6, 9], [7, 10], [7, 11], [8, 12], [7, 13]],
  [[4, 5], [4, 6], [5, 7], [5, 8], [4, 9], [4, 10], [5, 11], [5, 12], [4, 13]]
]
const INFERNAL_START = [0, 2, 4] // where each crack branches off, in steps

export const LEGENDARY = {
  maxed_cape: { field: 'black', band: 'gold', trim: 'gold', frames: 12, animate: 'stars' },
  completionist_cape: { field: 'royal', band: 'gold', trim: 'gold', frames: 12, animate: 'cog' },
  dragonslayer_cape: { field: 'red', fieldTone: -1, band: 'gold', trim: 'gold', frames: 12, animate: 'fire' },
  fire_cape: { field: 'ember', noBand: true, trim: 'black', frames: 12, animate: 'lava', lining: 'rust' },
  infernal_cape: { field: 'black', fieldTone: -2, noBand: true, trim: 'netherite', frames: 12, animate: 'infernal', lining: 'black' }
}

const FOLD = [-1, 0, 0, 1, 0, 0, 1, 0, 0, -1]
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const clamp = (t) => Math.max(0, Math.min(5, t))

/** Stamps an emblem (rows of palette keys) onto the front, centred across, its top row at y0. */
function stamp(px, e, y0, x0 = Math.floor((10 - e.rows[0].length) / 2)) {
  e.rows.forEach((row, ey) =>
    [...row].forEach((ch, ex) => {
      if (ch === '.') return
      const [rr, tt] = e.pal[ch].split('@')
      px[(y0 + ey) * 10 + x0 + ex] = [rr, Number(tt)]
    })
  )
}

function frontPixels(d, frame = 0) {
  const px = []
  const pattern = d.pattern ? PATTERNS[d.pattern](d) : null
  for (let fy = 0; fy < 16; fy++)
    for (let fx = 0; fx < 10; fx++) {
      const shade = FOLD[fx] + (fy === 0 ? -1 : 0) + (fy >= 14 ? -1 : 0)
      let r = d.field
      let t = 3 + shade + (d.fieldTone ?? 0)
      const p = pattern && pattern(fx, fy)
      if (p) {
        r = p[0]
        t = 3 + shade + p[1]
      }
      if (!d.noBand && fy === 12) {
        r = d.band
        t = 3 + FOLD[fx]
      }
      // A gold trim round the edge: lit along the top, shaded at the hem, a brighter stitch every third row and
      // bright corners.
      if (d.trim && (fx === 0 || fx === 9 || fy === 0 || fy === 15)) {
        r = d.trim
        const corner = (fx === 0 || fx === 9) && (fy === 0 || fy === 15)
        t = corner ? 5 : fy === 0 ? 4 : fy === 15 ? 2 : fy % 3 === 1 ? 4 : 3
      }
      px.push([r, clamp(t)])
    }
  if (d.emblem) stamp(px, EMBLEMS[d.emblem], 2)
  if (d.animate) animateLegendary(px, d, frame)
  return px
}

/** The legendary capes' emblems and their frame of animation. */
function animateLegendary(px, d, frame) {
  const at = (fx, fy) => fy * 10 + fx
  if (d.animate === 'stars') {
    stamp(px, LEGEND_EMBLEMS.radiant, 2)
    // Each star rests dim and flares for a moment, each at its own time.
    MAX_STARS.forEach(([fx, fy], i) => {
      const since = (frame - ((i * 5) % 12) + 12) % 12
      px[at(fx, fy)] = ['gold', since === 0 ? 5 : since === 1 ? 4 : 2]
    })
  } else if (d.animate === 'cog') {
    // The cog turns an eighth every three frames; the book lies open under it.
    stamp(px, Math.floor(frame / 3) % 2 === 0 ? LEGEND_EMBLEMS.cogA : LEGEND_EMBLEMS.cogB, 2)
    stamp(px, LEGEND_EMBLEMS.book, 7, 1)
    if (frame >= 7 && frame <= 9) px[at(3, 8)] = ['white', 5]
  } else if (d.animate === 'fire') {
    stamp(px, LEGEND_EMBLEMS.dragon, 2, 1)
    // Purple fire from the jaw, flickering between two shapes.
    for (const [ex, ey, t] of DRAGON_FIRE[Math.floor(frame / 2) % 2]) px[at(1 + ex, 2 + ey)] = ['nethglow', t]
    // Embers rising from the hem.
    ;[[2, 0], [5, 4], [7, 8]].forEach(([fx, offset]) => {
      const rise = (frame + offset) % 12
      const fy = 14 - rise
      if (fy >= 10 && fy <= 14 && fy !== 12) px[at(fx, fy)] = ['ember', rise < 2 ? 5 : 3]
    })
  } else if (d.animate === 'lava') {
    // Lava pours down the cloth a row a frame; the folds sit a shade deeper.
    for (let fy = 1; fy <= 14; fy++)
      for (let fx = 1; fx <= 8; fx++) {
        const ch = LAVA[(fy - frame + 120) % 12][fx]
        px[at(fx, fy)] = ch === 'c' ? ['black', 1] : ['ember', clamp(Number(ch) + (FOLD[fx] < 0 ? -1 : 0))]
      }
    return
  } else if (d.animate === 'infernal') {
    // Light runs down the cracks: the step at the pulse burns white-hot, the two behind it cool.
    INFERNAL_CRACKS.forEach((path, k) =>
      path.forEach(([fx, fy], i) => {
        const behind = frame - (INFERNAL_START[k] + i)
        px[at(fx, fy)] = ['ember', behind === 0 ? 5 : behind === 1 ? 4 : behind === 2 ? 3 : 2]
      })
    )
    // The molten hem, brightest as the pulse reaches it.
    for (let fx = 1; fx <= 8; fx++) px[at(fx, 14)] = ['ember', (fx + frame) % 4 === 0 ? 4 : frame >= 10 ? 4 : 3]
    return
  }
  // The glint: a diagonal of light sweeps from the top left to the hem in six frames, then rests for six.
  if (frame < 6) {
    const g = frame * 5 - 2
    for (let fy = 0; fy < 16; fy++)
      for (let fx = 0; fx < 10; fx++) {
        const s = fx + fy
        if (s === g || s === g + 1) px[at(fx, fy)] = [px[at(fx, fy)][0], clamp(px[at(fx, fy)][1] + (s === g ? 2 : 1))]
      }
  }
}

/** Renders one cape as a 64x32 RGBA buffer: a static design, or frame `frame` of a legendary one. */
export function renderCape(id, frame = 0) {
  const d = DESIGNS[id] ?? LEGENDARY[id]
  if (!d) throw new Error(`no cape design for ${id}`)
  const buf = Buffer.alloc(64 * 32 * 4)
  const put = (x, y, [r, t]) => {
    const [cr, cg, cb] = hex(ramp(r)[clamp(t)])
    buf.set([cr, cg, cb, 255], (y * 64 + x) * 4)
  }
  const front = frontPixels(d, frame)
  const lining = d.lining ?? d.field
  for (let fy = 0; fy < 16; fy++)
    for (let fx = 0; fx < 10; fx++) {
      put(1 + fx, 1 + fy, front[fy * 10 + fx])
      put(12 + fx, 1 + fy, [lining, 1 + (FOLD[fx] > 0 ? 1 : 0)])
    }
  for (let x = 0; x < 10; x++) {
    put(1 + x, 0, [lining, 1])
    put(11 + x, 0, [d.noBand ? lining : d.band, 2])
  }
  for (let y = 0; y < 16; y++) {
    put(0, 1 + y, [lining, 1])
    put(11, 1 + y, [lining, 1])
  }
  // Elytra: the field with its folds and the band, repeated across the wing area.
  for (let y = 0; y < 22; y++)
    for (let x = 22; x < 46; x++) {
      const fx = (x - 22) % 10
      const fy = Math.min(15, Math.floor((y * 16) / 22))
      put(x, y, front[fy * 10 + fx])
    }
  return buf
}

export async function buildStaticCapes(dir, ids = Object.keys(DESIGNS)) {
  for (const id of ids) await sharp(renderCape(id), { raw: { width: 64, height: 32, channels: 4 } }).png({ compressionLevel: 9 }).toFile(`${dir}/${id}.png`)
  return ids.length
}
