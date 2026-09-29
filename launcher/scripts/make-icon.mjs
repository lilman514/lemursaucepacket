// Renders resources/icon.png (512×512): a brass cogwheel on a dark tile. Pure Node, no dependencies.
// electron-builder turns this PNG into the Windows .ico. Replace the file with your own art any time.
//   node scripts/make-icon.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const SIZE = 512
const SS = 4 // supersampling per axis
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'icon.png')

const lerp = (a, b, t) => a + (b - a) * t
const mix = (c1, c2, t) => c1.map((v, i) => lerp(v, c2[i], t))
const BRASS_LIGHT = [246, 207, 122]
const BRASS_DARK = [199, 131, 43]
const TILE_TOP = [30, 34, 44]
const TILE_BOTTOM = [17, 19, 25]
const HOLE = [21, 24, 31]

// Everything below works in a 64-unit design space, like the SVG logo.
function roundedSquare(x, y, inset, r) {
  const qx = Math.abs(x - 32) - (32 - inset - r)
  const qy = Math.abs(y - 32) - (32 - inset - r)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)
  return outside - r <= 0
}

function gearRadius(theta) {
  const teeth = 10
  const phase = (((theta / (2 * Math.PI)) * teeth) % 1 + 1) % 1 // 0..1 within one tooth period
  // trapezoid tooth: flat top, sloped flanks
  const top = 0.32
  const flank = 0.12
  const d = Math.abs(phase - 0.5)
  let t
  if (d <= top / 2) t = 1
  else if (d <= top / 2 + flank) t = 1 - (d - top / 2) / flank
  else t = 0
  return lerp(20.5, 27, t)
}

function sample(x, y) {
  if (!roundedSquare(x, y, 1.5, 13)) return null
  const dx = x - 32
  const dy = y - 32
  const r = Math.hypot(dx, dy)
  const brass = mix(BRASS_LIGHT, BRASS_DARK, Math.min(1, Math.max(0, (x + y - 20) / 88)))
  if (r <= 4.6) return brass
  if (r <= 9.6) return HOLE
  if (r <= gearRadius(Math.atan2(dy, dx))) {
    // subtle bevel: lighter towards the top-left of each surface
    const shade = 1 - Math.max(0, (dx + dy) / 60) * 0.18
    return brass.map((v) => v * shade)
  }
  const glow = Math.max(0, 1 - Math.hypot(x - 46, y - 14) / 44) * 0.18
  return mix(TILE_TOP, TILE_BOTTOM, y / 64).map((v, i) => lerp(v, BRASS_LIGHT[i], glow))
}

const pixels = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let py = 0; py < SIZE; py++) {
  const row = py * (SIZE * 4 + 1)
  pixels[row] = 0 // PNG filter: none
  for (let px = 0; px < SIZE; px++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = sample(((px + (sx + 0.5) / SS) / SIZE) * 64, ((py + (sy + 0.5) / SS) / SIZE) * 64)
        if (!c) continue
        r += c[0]
        g += c[1]
        b += c[2]
        a++
      }
    }
    const o = row + 1 + px * 4
    if (a > 0) {
      pixels[o] = Math.round(r / a)
      pixels[o + 1] = Math.round(g / a)
      pixels[o + 2] = Math.round(b / a)
    }
    pixels[o + 3] = Math.round((a / (SS * SS)) * 255)
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(pixels, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, png)
console.log(`Wrote ${out} (${png.length} bytes)`)
