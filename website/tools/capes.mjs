#!/usr/bin/env node
// The capes as they look in game, for the wiki (docs/images/): from the photo
// session's back views (shot_cape_<id>.png, the player in Lemurton's market square), a sheet per kind of cape with
// each one's name under it, and the animated capes moving side by side in one animated WebP (shot_cape_<id>_anim_<1..12>.png,
// a frame every four ticks, as the game steps them).
//
//   node website/tools/capes.mjs <folder with the shots>
//
// capes/build.mjs puts the sheets on the Capes page. Needs sharp, which lives under art/ (npm install there).

import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CAPES } from '../../capes/capes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const sharp = (await import(pathToFileURL(path.join(root, 'art', 'node_modules', 'sharp', 'lib', 'index.js')).href)).default

const from = process.argv[2]
if (!from) {
  console.error('usage: node website/tools/capes.mjs <screenshot folder>')
  process.exit(1)
}
const wikiDir = path.join(root, 'docs', 'images')
mkdirSync(wikiDir, { recursive: true })

// The player stands in the lower middle of the frame, back to the camera: this box holds them and the cape.
const CROP = { left: 0.355, top: 0.33, width: 0.29, height: 0.67 }
const TILE = { w: 300, h: 346 }
const LABEL = 44
const BG = '#211e1c'

async function tile(file, w = TILE.w, h = TILE.h) {
  const meta = await sharp(file).metadata()
  const box = {
    left: Math.round(CROP.left * meta.width),
    top: Math.round(CROP.top * meta.height),
    width: Math.round(CROP.width * meta.width),
    height: Math.round(CROP.height * meta.height)
  }
  return sharp(file).extract(box).resize(w, h, { fit: 'cover', position: 'top' }).png().toBuffer()
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;')
const label = (text, w) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${LABEL}"><text x="${w / 2}" y="28" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="20" font-weight="600" fill="#f2e6cf" text-anchor="middle">${escape(text)}</text></svg>`)

const KINDS = ['skill', 'quest', 'achievement', 'legendary', 'owner']
let sheets = 0
let animations = 0
for (const kind of KINDS) {
  const list = CAPES.filter((c) => c.kind === kind && existsSync(path.join(from, `shot_cape_${c.id}.png`)))
  if (!list.length) continue
  const cols = Math.min(list.length, kind === 'skill' ? 7 : 6)
  const rows = Math.ceil(list.length / cols)
  const gap = 12
  const width = cols * TILE.w + (cols + 1) * gap
  const height = rows * (TILE.h + LABEL) + (rows + 1) * gap
  const parts = []
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    const x = gap + (i % cols) * (TILE.w + gap)
    const y = gap + Math.floor(i / cols) * (TILE.h + LABEL + gap)
    parts.push({ input: await tile(path.join(from, `shot_cape_${c.id}.png`)), left: x, top: y })
    parts.push({ input: label(c.name, TILE.w), left: x, top: y + TILE.h })
  }
  const sheet = await sharp({ create: { width, height, channels: 3, background: BG } }).composite(parts).png().toBuffer()
  await sharp(sheet).resize({ width: Math.min(width, 1600) }).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(wikiDir, `capes_${kind}.jpg`))
  sheets++
}

// The animated capes in motion, side by side: one animated WebP, a frame every four ticks as the game steps them.
const moving = CAPES.filter((c) => c.animated && existsSync(path.join(from, `shot_cape_${c.id}_anim_1.png`)))
if (moving.length) {
  const gap = 12
  const width = moving.length * TILE.w + (moving.length + 1) * gap
  const height = TILE.h + LABEL + 2 * gap
  const labels = moving.map((c) => label(c.name, TILE.w))
  const frames = []
  for (let n = 1; n <= 12; n++) {
    const parts = []
    for (let i = 0; i < moving.length; i++) {
      const file = path.join(from, `shot_cape_${moving[i].id}_anim_${n}.png`)
      const x = gap + i * (TILE.w + gap)
      if (existsSync(file)) parts.push({ input: await tile(file), left: x, top: gap })
      parts.push({ input: labels[i], left: x, top: gap + TILE.h })
    }
    frames.push(await sharp({ create: { width, height, channels: 3, background: BG } }).composite(parts).png().toBuffer())
  }
  await sharp(frames, { join: { animated: true } }).webp({ quality: 80, effort: 6, loop: 0, delay: frames.map(() => 200) }).toFile(path.join(wikiDir, 'capes_animated.webp'))
  animations = moving.length
}
console.log(`capes: ${sheets} sheets, ${animations} animated capes → docs/images`)
