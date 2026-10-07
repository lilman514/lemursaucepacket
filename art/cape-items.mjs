// Pixel art for capes as items: each cape's inventory icon, drawn from its own texture (the design people see on your
// back, the 10x16 front of the 64x32 cape), and the Curios slot's empty-slot outline. process.mjs (step capeItems)
// writes them into the pack; an animated cape gets an animated icon, one frame per frame of the cape.

/**
 * The cape hanging from a clasp, seen from behind: per row of the 16x16 icon, the columns the cloth covers (inclusive).
 * Rows 1 to 13 are cloth; row 14 is the hem, in three scallops.
 */
const ROWS = {
  1: [5, 10],
  2: [4, 11],
  3: [4, 11],
  4: [4, 11],
  5: [4, 11],
  6: [3, 12],
  7: [3, 12],
  8: [3, 12],
  9: [3, 12],
  10: [3, 12],
  11: [3, 12],
  12: [2, 13],
  13: [2, 13]
}
const HEM = [2, 3, 6, 7, 8, 9, 12, 13]
const CLASP = [0xe8, 0xc5, 0x47]
const CLASP_DARK = [0x8a, 0x6a, 0x1c]

const inside = (x, y) => {
  if (y === 14) return HEM.includes(x)
  const r = ROWS[y]
  return r != null && x >= r[0] && x <= r[1]
}

const shade = (rgb, f) => rgb.map((c) => Math.max(0, Math.min(255, Math.round(c * f))))

/**
 * A cape's icon from its 64x32 RGBA texture (a Uint8Array or Buffer): the front design stretched over the cape's shape,
 * lit from the left (the right edge falls into shadow), a dark outline in the cloth's own colours, and a brass clasp.
 * Returns 16x16 RGBA.
 */
export function capeIcon(texture) {
  const face = (u, v) => {
    const i = ((1 + v) * 64 + (1 + u)) * 4
    return [texture[i], texture[i + 1], texture[i + 2]]
  }
  const out = new Uint8Array(16 * 16 * 4)
  const put = (x, y, rgb) => {
    const i = (y * 16 + x) * 4
    out[i] = rgb[0]
    out[i + 1] = rgb[1]
    out[i + 2] = rgb[2]
    out[i + 3] = 255
  }
  const fill = []
  for (let y = 1; y <= 14; y++) {
    const r = ROWS[y] ?? [2, 13]
    for (let x = 0; x < 16; x++) {
      if (!inside(x, y)) continue
      const u = Math.min(9, Math.floor(((x - r[0] + 0.5) / (r[1] - r[0] + 1)) * 10))
      const v = Math.min(15, Math.floor(((y - 1 + 0.5) / 14) * 16))
      let rgb = face(u, v)
      if (x === r[0]) rgb = shade(rgb, 1.12)
      else if (x === r[1]) rgb = shade(rgb, 0.72)
      else if (x === r[1] - 1) rgb = shade(rgb, 0.88)
      if (y === 1) rgb = shade(rgb, 0.8)
      fill.push([x, y, rgb])
    }
  }
  for (const [x, y, rgb] of fill) put(x, y, rgb)
  // The outline: every empty pixel next to the cloth takes a dark shade of the cloth beside it.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (inside(x, y)) continue
      const near = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].find(([nx, ny]) => nx >= 0 && ny >= 0 && nx < 16 && ny < 16 && inside(nx, ny))
      if (!near) continue
      const i = (near[1] * 16 + near[0]) * 4
      put(x, y, shade([out[i], out[i + 1], out[i + 2]], 0.38))
    }
  }
  // The clasp at the collar.
  put(5, 1, CLASP)
  put(10, 1, CLASP)
  put(6, 1, CLASP_DARK)
  put(9, 1, CLASP_DARK)
  return out
}

/** The empty cape slot, in the Curios style (a one-pixel outline in 0x555555). Returns 16x16 RGBA. */
export function capeSlotIcon() {
  const rows = [
    '................',
    '.....++++++.....',
    '....+......+....',
    '....+.++++.+....',
    '...+........+...',
    '...+........+...',
    '...+........+...',
    '..+..........+..',
    '..+..........+..',
    '..+..........+..',
    '..+..........+..',
    '.+............+.',
    '.+............+.',
    '.+..++....++..+.',
    '..++..++++..++..',
    '................'
  ]
  const out = new Uint8Array(16 * 16 * 4)
  rows.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      if (row[x] !== '+') continue
      const i = (y * 16 + x) * 4
      out[i] = out[i + 1] = out[i + 2] = 85
      out[i + 3] = 255
    }
  })
  return out
}
