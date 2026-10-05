#!/usr/bin/env node
// Draws every building in structures/buildings/*.mjs into a raw structure template. Run `node structures/build.mjs`.
//
// Writes:
//   structures/raw/<name>.nbt        raw templates (neighbour-dependent shapes not worked out yet)
//   structures/raw/manifest.json     names, sizes and notes for the bake step
// Then `node structures/bake.mjs` bakes them in a scratch server (the game works out stair corners, fence and pane
// connections, Macaw's window and roof parts) and copies the baked templates into the pack.
//
// Usage: node structures/build.mjs [name-filter] [--samplers]

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Canvas } from './lib/canvas.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const rawDir = path.join(here, 'raw')
const samplers = process.argv.includes('--samplers')
const filterArg = process.argv.slice(2).find((a) => !a.startsWith('--'))
const filter = filterArg ? new RegExp(filterArg) : null

// 00-*.mjs are samplers (roof tests and the like), built only with --samplers.
const modules = readdirSync(path.join(here, 'buildings')).filter((f) => f.endsWith('.mjs') && (samplers || !f.startsWith('00-'))).sort()
const templates = []
const seen = new Set()
for (const file of modules) {
  const mod = await import(pathToFileURL(path.join(here, 'buildings', file)).href)
  for (const b of mod.buildings ?? []) {
    if (seen.has(b.name)) throw new Error(`two buildings are called ${b.name}`)
    seen.add(b.name)
    if (filter && !filter.test(b.name)) continue
    const c = new Canvas(b.name)
    b.build(c)
    templates.push({ b, c, file })
  }
}

// With a name filter only those templates are rebuilt; the rest of structures/raw and the manifest stay.
let manifest = []
if (filter) {
  try {
    manifest = JSON.parse(readFileSync(path.join(rawDir, 'manifest.json'), 'utf8')).templates.filter((t) => !filter.test(t.name))
  } catch {
    manifest = []
  }
} else rmSync(rawDir, { recursive: true, force: true })
mkdirSync(rawDir, { recursive: true })
for (const { b, c, file } of templates) {
  const t = c.toNbtFile()
  writeFileSync(path.join(rawDir, `${b.name}.nbt`), t.bytes)
  // The box of non-air blocks in template coordinates (air set to clear terrain doesn't count), for framing photos.
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const cell of c.cells.values()) {
    if (cell.state.name === 'minecraft:air') continue
    const p = [cell.x - t.offset[0], cell.y - t.offset[1], cell.z - t.offset[2]]
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], p[i])
      hi[i] = Math.max(hi[i], p[i])
    }
  }
  manifest.push({ name: b.name, size: t.size, solid: { min: lo, max: hi }, marks: t.marks, offset: t.offset, blocks: t.blockCount, palette: t.paletteSize, source: file, kind: b.kind ?? 'building', notes: b.notes ?? '' })
  console.log(`${b.name.padEnd(28)} ${t.size.join('x').padEnd(10)} ${String(t.blockCount).padStart(6)} blocks, ${t.paletteSize} states`)
}
writeFileSync(path.join(rawDir, 'manifest.json'), JSON.stringify({ templates: manifest }, null, 2) + '\n')
console.log(`${manifest.length} raw templates in structures/raw`)
