// The in-game UI kit: brass-and-iron widgets drawn pixel by pixel on an integer grid, so they stay crisp at
// every GUI scale. Each sprite keeps the size and nine-slice border of the vanilla sprite it replaces (see
// process.mjs for where they go), so every screen built from vanilla widgets — options, FTB Quests, mod
// screens — picks up the same look without per-mod work. The ESC menu's board is drawn here too.
//
// The palette is sampled from the Higgsfield logo and emblems (art/generated), so the pixel kit, the hi-res
// icons and the launcher share one set of materials.

import sharp from 'sharp'

export const COLORS = {
  outline: '#14110d',
  ironDeep: '#191715',
  ironDark: '#242120',
  iron: '#2f2b28',
  ironLight: '#3c3733',
  ironHi: '#4b4540',
  brassDeep: '#553710',
  brassDark: '#87591a',
  brass: '#bd8a2e',
  brassLight: '#e0ac46',
  brassHi: '#f8d982',
  amber: '#5e4218',
  amberHi: '#7c581f',
  greyDark: '#35312d',
  grey: '#5f574e',
  greyLight: '#7d7367',
  parchment: '#f1e4c2'
}

const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, rgba(v)]))

export function rgba(hex, alpha = 255) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha]
}

/** Deterministic per-pixel noise, so re-running the build gives identical files. */
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

export class Pix {
  constructor(width, height) {
    this.w = width
    this.h = height
    this.d = new Uint8ClampedArray(width * height * 4)
  }

  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    this.d[i] = c[0]
    this.d[i + 1] = c[1]
    this.d[i + 2] = c[2]
    this.d[i + 3] = c[3]
  }

  fill(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c)
  }

  hline(x, y, w, c) {
    this.fill(x, y, w, 1, c)
  }

  vline(x, y, h, c) {
    this.fill(x, y, 1, h, c)
  }

  /** Hollow rectangle. */
  box(x, y, w, h, c) {
    this.hline(x, y, w, c)
    this.hline(x, y + h - 1, w, c)
    this.vline(x, y, h, c)
    this.vline(x + w - 1, y, h, c)
  }

  /**
   * Bevelled band: `thickness` nested rectangles, top/left edges from the `lit` colours (outer to inner),
   * bottom/right from `shade`, like light falling from the top left.
   */
  bevel(x, y, w, h, thickness, lit, shade) {
    for (let t = 0; t < thickness; t++) {
      this.hline(x + t, y + t, w - 2 * t, lit[t])
      this.vline(x + t, y + t, h - 2 * t, lit[t])
      this.hline(x + t, y + h - 1 - t, w - 2 * t, shade[t])
      this.vline(x + w - 1 - t, y + t, h - 2 * t, shade[t])
    }
  }

  /** A round-headed rivet, 2 or 3 pixels across. */
  rivet(x, y, size = 2, hi = C.brassHi, mid = C.brassLight, dark = C.brassDeep) {
    if (size === 2) {
      this.set(x, y, hi)
      this.set(x + 1, y, mid)
      this.set(x, y + 1, mid)
      this.set(x + 1, y + 1, dark)
    } else {
      this.fill(x, y, 3, 3, mid)
      this.set(x, y, hi)
      this.set(x + 1, y, hi)
      this.set(x, y + 1, hi)
      this.set(x + 2, y + 2, dark)
      this.set(x + 1, y + 2, dark)
      this.set(x + 2, y + 1, dark)
    }
  }

  /** Slight brightness noise, so plates don't read as flat vector fills. */
  grain(x, y, w, h, amount = 3) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue
        const n = (hash(i, j) % (amount * 2 + 1)) - amount
        const k = (j * this.w + i) * 4
        this.d[k] += n
        this.d[k + 1] += n
        this.d[k + 2] += n
      }
    }
  }

  png() {
    return sharp(Buffer.from(this.d.buffer), { raw: { width: this.w, height: this.h, channels: 4 } }).png({ compressionLevel: 9 })
  }
}

// Widget "materials": the brass band and the plate face for each state.
export const STYLE = {
  normal: { lit: [C.brassLight, C.brass], shade: [C.brassDeep, C.brassDark], face: C.iron, faceTop: C.ironLight, faceBottom: C.ironDark },
  hover: { lit: [C.brassHi, C.brassLight], shade: [C.brassDark, C.brass], face: C.amber, faceTop: C.amberHi, faceBottom: C.brassDeep },
  disabled: { lit: [C.greyLight, C.grey], shade: [C.greyDark, C.grey], face: C.ironDark, faceTop: C.iron, faceBottom: C.ironDeep, rivet: [C.greyLight, C.grey, C.greyDark] },
  recessed: { lit: [C.brassLight, C.brass], shade: [C.brassDeep, C.brassDark], face: C.ironDeep, faceTop: C.outline, faceBottom: C.ironLight },
  recessedHover: { lit: [C.brassHi, C.brassLight], shade: [C.brassDark, C.brass], face: C.ironDeep, faceTop: C.outline, faceBottom: C.ironLight }
}

/**
 * A plate with a 1px outline, a 2px brass band, an inner dark line and a faced centre: the shape behind
 * buttons, sliders and small panels. Nine-slice border = 4.
 */
export function plate(w, h, style = STYLE.normal, { rivets = true, grain = true } = {}) {
  const p = new Pix(w, h)
  p.box(0, 0, w, h, C.outline)
  p.bevel(1, 1, w - 2, h - 2, 2, style.lit, style.shade)
  p.box(3, 3, w - 6, h - 6, C.outline)
  p.fill(4, 4, w - 8, h - 8, style.face)
  if (style.faceTop) p.hline(4, 4, w - 8, style.faceTop)
  if (style.faceBottom) p.hline(4, h - 5, w - 8, style.faceBottom)
  if (grain) p.grain(4, 5, w - 8, h - 10, 2)
  if (rivets && w >= 12 && h >= 12) {
    const [hi, mid, dark] = style.rivet ?? [C.brassHi, C.brassLight, C.brassDeep]
    for (const [x, y] of [[1, 1], [w - 3, 1], [1, h - 3], [w - 3, h - 3]]) p.rivet(x, y, 2, hi, mid, dark)
  }
  return p
}

/** Slider knob (8x20, border 2/2/2/3): a brass grip with a groove down the middle. */
export function sliderHandle(hover = false) {
  const p = new Pix(8, 20)
  p.box(0, 0, 8, 20, C.outline)
  p.bevel(1, 1, 6, 18, 1, [hover ? C.brassHi : C.brassLight], [C.brassDeep])
  p.fill(2, 2, 4, 16, hover ? C.brassLight : C.brass)
  p.vline(3, 3, 14, C.brassDark)
  p.vline(4, 3, 14, C.brassHi)
  return p
}

/** Tab (130x24, border 2/2/2/0): open at the bottom so it joins the content below. */
export function tab(selected = false, hover = false) {
  const p = new Pix(130, 24)
  p.fill(0, 0, 130, 24, selected ? C.ironLight : C.iron)
  p.hline(0, 0, 130, C.outline)
  p.vline(0, 0, 24, C.outline)
  p.vline(129, 0, 24, C.outline)
  p.hline(1, 1, 128, hover || selected ? C.brassHi : C.brassLight)
  p.vline(1, 1, 23, hover ? C.brassLight : C.brass)
  p.vline(128, 1, 23, C.brassDark)
  if (selected) p.hline(2, 2, 126, C.brassLight)
  p.grain(2, 3, 126, 21, 2)
  return p
}

/** Text field (200x20, border 2): a recessed slot with a thin brass rim that brightens on focus. */
export function textField(focused = false) {
  const p = new Pix(200, 20)
  p.box(0, 0, 200, 20, C.outline)
  p.box(1, 1, 198, 18, focused ? C.brassLight : C.brassDark)
  p.fill(2, 2, 196, 16, C.ironDeep)
  p.hline(2, 2, 196, C.outline)
  p.grain(2, 3, 196, 15, 2)
  return p
}

export function scroller() {
  const p = new Pix(6, 32)
  p.box(0, 0, 6, 32, C.outline)
  p.fill(1, 1, 4, 30, C.brass)
  p.vline(1, 1, 30, C.brassHi)
  p.vline(4, 1, 30, C.brassDark)
  return p
}

export function scrollerBackground() {
  const p = new Pix(6, 32)
  p.box(0, 0, 6, 32, C.outline)
  p.fill(1, 1, 4, 30, C.ironDeep)
  return p
}

export function checkbox(selected = false, hover = false) {
  const p = plate(20, 20, hover ? STYLE.hover : STYLE.recessed, { rivets: false })
  if (selected) {
    // A 2px-thick tick from (6,10) down to (9,13) and up to (14,8).
    for (let i = 0; i < 4; i++) {
      p.set(6 + i, 10 + i, C.brassHi)
      p.set(6 + i, 11 + i, C.brassLight)
    }
    for (let i = 0; i < 6; i++) {
      p.set(9 + i, 13 - i, C.brassHi)
      p.set(9 + i, 14 - i, C.brassLight)
    }
  }
  return p
}

/**
 * Riveted iron plate tile (32x32) for menu backgrounds: seams along the top and left edges so tiles read as
 * separate plates, one rivet per plate. `rivets: false` gives the plainer, darker tile used behind lists.
 */
export function plateTile({ face = C.ironDark, rivets = true, alpha = 255 } = {}) {
  const p = new Pix(32, 32)
  const a = (c) => [c[0], c[1], c[2], alpha]
  p.fill(0, 0, 32, 32, a(face))
  p.grain(0, 0, 32, 32, 2)
  p.hline(0, 0, 32, a(C.outline))
  p.vline(0, 0, 32, a(C.outline))
  p.hline(1, 1, 31, a(C.ironLight))
  p.vline(1, 1, 31, a(C.ironLight))
  p.hline(1, 31, 31, a(C.ironDeep))
  p.vline(31, 1, 31, a(C.ironDeep))
  if (rivets) p.rivet(3, 3, 2, a(C.ironHi), a(C.ironLight), a(C.outline))
  return p
}

/** Header/footer separator line (32x2). */
export function separator(alpha = 255) {
  const p = new Pix(32, 2)
  p.hline(0, 0, 32, rgba(COLORS.brassDark, alpha))
  p.hline(0, 1, 32, rgba(COLORS.brassLight, alpha))
  return p
}

/**
 * A framed panel with a 3px brass band and corner rivets (nine-slice border 8). Used for FancyMenu panels
 * (e.g. behind the title screen buttons).
 */
export function panel(w, h, { face = C.ironDark } = {}) {
  const p = new Pix(w, h)
  p.box(0, 0, w, h, C.outline)
  p.bevel(1, 1, w - 2, h - 2, 3, [C.brassHi, C.brassLight, C.brass], [C.brassDeep, C.brassDark, C.brass])
  p.box(4, 4, w - 8, h - 8, C.outline)
  p.fill(5, 5, w - 10, h - 10, face)
  p.hline(5, 5, w - 10, C.ironDeep)
  p.vline(5, 5, h - 10, C.ironDeep)
  p.grain(6, 6, w - 12, h - 12, 2)
  for (const [x, y] of [[2, 2], [w - 5, 2], [2, h - 5], [w - 5, h - 5]]) p.rivet(x, y, 3)
  return p
}

/**
 * Project MMO's glossary atlas (textures/gui/player_stats.png, 256x256). The mod stretches the frame at
 * (0,0)-(147,165) over its left panel, the 7px strip at x=140 when that panel is collapsed, and the two
 * 102x5 bars at y=217 (track) and y=223 (fill) for skill progress. Nothing else in the atlas is used.
 */
export function pmmoAtlas() {
  const p = new Pix(256, 256)
  const w = 147
  const h = 165
  p.box(0, 0, w, h, C.outline)
  p.bevel(1, 1, w - 2, h - 2, 3, [C.brassHi, C.brassLight, C.brass], [C.brassDeep, C.brassDark, C.brass])
  p.box(4, 4, w - 8, h - 8, C.outline)
  p.fill(5, 5, w - 10, h - 10, C.ironDark)
  p.hline(5, 5, w - 10, C.ironDeep)
  p.vline(5, 5, h - 10, C.ironDeep)
  p.grain(6, 6, w - 12, h - 12, 2)
  for (const [x, y] of [[2, 2], [w - 5, 2], [2, h - 5], [w - 5, h - 5]]) p.rivet(x, y, 3)
  p.fill(0, 217, 102, 5, C.ironDeep)
  p.hline(0, 217, 102, C.outline)
  p.hline(0, 221, 102, C.ironLight)
  const fill = [C.brassHi, C.brassLight, C.brass, C.brassDark, C.brassDeep]
  fill.forEach((c, i) => p.hline(0, 223 + i, 102, c))
  return p
}

/** A recessed area cut into a plate: dark face, shadow along the top and left, a lit lip bottom and right. */
function recess(p, x, y, w, h, face = C.ironDark) {
  p.box(x, y, w, h, C.outline)
  p.fill(x + 1, y + 1, w - 2, h - 2, face)
  p.hline(x + 1, y + 1, w - 2, C.ironDeep)
  p.vline(x + 1, y + 1, h - 2, C.ironDeep)
  p.hline(x + 1, y + h - 2, w - 2, C.ironLight)
  p.vline(x + w - 2, y + 1, h - 2, C.ironLight)
  p.grain(x + 2, y + 2, w - 4, h - 4, 2)
}

/**
 * The ESC menu board: a brass-framed wall of riveted iron plates with recessed panels cut into it. Drawn at
 * its final size (1 pixel = 1 GUI pixel), so the plate seams and rivets stay regular.
 */
export function board(w, h, panels, { plaque } = {}) {
  const p = new Pix(w, h)
  const tile = plateTile()
  for (let ty = 0; ty * 32 < h; ty++) {
    for (let tx = 0; tx * 32 < w; tx++) {
      for (let j = 0; j < 32; j++) {
        for (let i = 0; i < 32; i++) {
          const k = (j * 32 + i) * 4
          p.set(4 + tx * 32 + i, 4 + ty * 32 + j, [tile.d[k], tile.d[k + 1], tile.d[k + 2], 255])
        }
      }
    }
  }
  // Frame.
  p.box(0, 0, w, h, C.outline)
  p.bevel(1, 1, w - 2, h - 2, 3, [C.brassHi, C.brassLight, C.brass], [C.brassDeep, C.brassDark, C.brass])
  p.box(4, 4, w - 8, h - 8, C.outline)
  p.hline(5, 5, w - 10, C.ironDeep)
  p.vline(5, 5, h - 10, C.ironDeep)
  for (const [x, y] of [[2, 2], [w - 5, 2], [2, h - 5], [w - 5, h - 5]]) p.rivet(x, y, 3)
  // Rivets along the long edges, one per plate.
  for (let x = 36; x < w - 8; x += 32) {
    p.rivet(x, 1, 2)
    p.rivet(x, h - 3, 2)
  }
  for (let y = 36; y < h - 8; y += 32) {
    p.rivet(1, y, 2)
    p.rivet(w - 3, y, 2)
  }
  // A brass-rimmed dark plaque behind the header, so the wordmark's brass and silver stand out.
  if (plaque) {
    const { x, y, w: pw, h: ph } = plaque
    p.box(x, y, pw, ph, C.outline)
    p.bevel(x + 1, y + 1, pw - 2, ph - 2, 1, [C.brassLight], [C.brassDeep])
    p.box(x + 2, y + 2, pw - 4, ph - 4, C.outline)
    p.fill(x + 3, y + 3, pw - 6, ph - 6, C.ironDeep)
    p.grain(x + 3, y + 3, pw - 6, ph - 6, 2)
    p.rivet(x + 1, y + 1, 2)
    p.rivet(x + pw - 3, y + 1, 2)
    p.rivet(x + 1, y + ph - 3, 2)
    p.rivet(x + pw - 3, y + ph - 3, 2)
  }
  for (const r of panels) recess(p, r.x, r.y, r.w, r.h)
  return p
}
