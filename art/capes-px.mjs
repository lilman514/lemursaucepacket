// Static capes as 64x32 pixel art, the native Minecraft cape size: woven cloth rather than framed pictures.
// Skill capes follow Old School RuneScape's idea: the skill's colour, a band near the hem and a small stitched
// emblem. Quest and achievement capes are heraldic patterns (rails, a beacon beam, a saltire, ring-tail bands).
// The animated legendary capes keep their painted art (art/process.mjs capes()).
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

const FOLD = [-1, 0, 0, 1, 0, 0, 1, 0, 0, -1]
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const clamp = (t) => Math.max(0, Math.min(5, t))

function frontPixels(d) {
  const px = []
  const pattern = d.pattern ? PATTERNS[d.pattern](d) : null
  for (let fy = 0; fy < 16; fy++)
    for (let fx = 0; fx < 10; fx++) {
      const shade = FOLD[fx] + (fy === 0 ? -1 : 0) + (fy >= 14 ? -1 : 0)
      let r = d.field
      let t = 3 + shade
      const p = pattern && pattern(fx, fy)
      if (p) {
        r = p[0]
        t = 3 + shade + p[1]
      }
      if (!d.noBand && fy === 12) {
        r = d.band
        t = 3 + FOLD[fx]
      }
      px.push([r, clamp(t)])
    }
  if (d.emblem) {
    const e = EMBLEMS[d.emblem]
    const w = e.rows[0].length
    const x0 = Math.floor((10 - w) / 2)
    const y0 = 2
    e.rows.forEach((row, ey) =>
      [...row].forEach((ch, ex) => {
        if (ch === '.') return
        const [rr, tt] = e.pal[ch].split('@')
        px[(y0 + ey) * 10 + x0 + ex] = [rr, Number(tt)]
      })
    )
  }
  return px
}

/** Renders one static cape as a 64x32 RGBA buffer. */
export function renderCape(id) {
  const d = DESIGNS[id]
  if (!d) throw new Error(`no cape design for ${id}`)
  const buf = Buffer.alloc(64 * 32 * 4)
  const put = (x, y, [r, t]) => {
    const [cr, cg, cb] = hex(ramp(r)[clamp(t)])
    buf.set([cr, cg, cb, 255], (y * 64 + x) * 4)
  }
  const front = frontPixels(d)
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
