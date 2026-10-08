#!/usr/bin/env node
// After an atlas photo session: turns the test instance's atlas_<b|c>_<key>.png screenshots into the wiki's pictures,
// docs/images/atlas/<biomes|creatures>/<key>.webp: the middle 16:9 of the frame at 960x540 (a card shows it about
// 420 px wide, twice that on a high-density screen). wiki/render.mjs puts them on the cards instead of the paintings.
// Uses sharp from art/ (npm install there).
//
//   node wiki/photos/collect.mjs --instance <headless>/instance [--dry]

import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const instance = arg('instance')
const shotsDir = instance && path.join(instance, 'screenshots')
if (!shotsDir || !existsSync(shotsDir)) {
  console.error('collect: pass --instance <the headless test instance folder> (its screenshots/ holds the shots)')
  process.exit(1)
}
const dry = process.argv.includes('--dry')
const sharp = (await import('../../art/node_modules/sharp/lib/index.js')).default
const KINDS = { b: 'biomes', c: 'creatures', s: 'structures' }

let done = 0
for (const file of readdirSync(shotsDir).filter((f) => /^atlas_[bcs]_.+\.png$/.test(f)).sort()) {
  const m = /^atlas_([bcs])_(.+)\.png$/.exec(file)
  const outDir = path.join(root, 'docs', 'images', 'atlas', KINDS[m[1]])
  const out = path.join(outDir, `${m[2]}.webp`)
  const img = sharp(path.join(shotsDir, file))
  const { width, height } = await img.metadata()
  // The middle 16:9 of the frame (a 21:9 fullscreen shot loses its sides; a 16:9 window keeps all of it).
  const w = Math.min(width, Math.round((height * 16) / 9))
  const h = Math.min(height, Math.round((w * 9) / 16))
  const left = Math.round((width - w) / 2)
  const top = Math.round((height - h) / 2)
  if (dry) console.log(`${file} ${width}x${height} → crop ${w}x${h}+${left}+${top} → ${path.relative(root, out)}`)
  else {
    mkdirSync(outDir, { recursive: true })
    await img.extract({ left, top, width: w, height: h }).resize(960, 540).webp({ quality: 76, effort: 5 }).toFile(out)
  }
  done++
}
let bytes = 0
for (const kind of Object.values(KINDS)) {
  const dir = path.join(root, 'docs', 'images', 'atlas', kind)
  if (existsSync(dir)) for (const f of readdirSync(dir)) bytes += statSync(path.join(dir, f)).size
}
console.log(`collect: ${done} pictures${dry ? ' (dry run)' : ''}; docs/images/atlas holds ${(bytes / 1e6).toFixed(1)} MB`)
