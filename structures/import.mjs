#!/usr/bin/env node
// Imports structure templates from other mods (an extracted jar or any folder of .nbt files) as raw templates for
// the bake and preview steps, e.g. to compare their buildings with ours in the showroom:
//
//   node structures/import.mjs --from <dir> --match <regex> --prefix <name> [--to <raw dir>] [--kind sampler]
//
// <regex> is tested against each template's path under <dir>. Jigsaw blocks become their final state (as when
// the game assembles a village), so the pieces don't spawn villagers or show jigsaw blocks. Each template keeps its
// DataVersion, so the game upgrades it on load as usual. The manifest gets the template's size, solid bounds and
// a `door` mark at its building entrance (the jigsaw the village street connects to), facing out.

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { compound, decodeTyped, encode, int, list, string } from './lib/nbt.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const from = arg('from')
const match = new RegExp(arg('match', '.'))
const prefix = arg('prefix', 'ext')
const to = path.resolve(arg('to', path.join(here, 'raw-import')))
const kind = arg('kind', 'sampler')
if (!from) {
  console.error('Usage: node structures/import.mjs --from <dir> --match <regex> --prefix <name> [--to <raw dir>] [--kind sampler]')
  process.exit(2)
}

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = path.join(d, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.nbt') ? [p] : []
  })

/** 'minecraft:chest[facing=north,type=single]' → a palette entry { Name, Properties }. */
function paletteEntry(stateString) {
  const m = /^([^[]+)(?:\[(.*)\])?$/.exec(stateString.trim())
  const entry = { Name: string(m[1]) }
  if (m[2]) entry.Properties = compound(Object.fromEntries(m[2].split(',').map((kv) => kv.split('=')).map(([k, v]) => [k, string(v)])))
  return compound(entry)
}
const stateKey = (p) => {
  const props = p.value.Properties ? Object.entries(p.value.Properties.value).map(([k, v]) => `${k}=${v.value}`).sort().join(',') : ''
  return `${p.value.Name.value}[${props}]`
}

const AIRISH = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:structure_void', 'minecraft:jigsaw'])
const OUT_OF = { 'north_up': 'north', 'south_up': 'south', 'east_up': 'east', 'west_up': 'west' }

mkdirSync(to, { recursive: true })
const manifestPath = path.join(to, 'manifest.json')
let manifest = []
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8')).templates.filter((t) => !t.name.startsWith(`${prefix}_`))
} catch {
  manifest = []
}

let count = 0
for (const file of walk(from)) {
  const rel = path.relative(from, file).split(path.sep).join('/')
  if (!match.test(rel)) continue
  const root = decodeTyped(readFileSync(file))
  const t = root.value
  // Templates with several palettes (shipwrecks and the like) use the first.
  const palette = t.palette ? t.palette.value.items : t.palettes.value.items[0].value.items
  const keys = palette.map(stateKey)
  const indexOf = (entry) => {
    const k = stateKey(entry)
    let i = keys.indexOf(k)
    if (i < 0) {
      palette.push(entry)
      keys.push(k)
      i = keys.length - 1
    }
    return i
  }
  // One palette entry per jigsaw orientation and state.
  const jigsaws = new Set(keys.flatMap((k, i) => (k.startsWith('minecraft:jigsaw[') ? [i] : [])))
  let door = null
  const lo = [Infinity, Infinity, Infinity]
  const hi = [-Infinity, -Infinity, -Infinity]
  for (const b of t.blocks.value.items) {
    const block = b.value
    const pos = block.pos.value.items.map((n) => n.value)
    if (jigsaws.has(block.state.value)) {
      const nbt = block.nbt?.value ?? {}
      const name = nbt.name?.value ?? ''
      // The entrance: the jigsaw a village's street attaches to.
      if (/building_entrance|\/house$|:house$/.test(name) || /building_entrance/.test(nbt.target?.value ?? '')) {
        const orientation = palette[block.state.value].value.Properties?.value.orientation?.value
        door = { pos, facing: OUT_OF[orientation] ?? 'south', jigsaw: name }
      }
      block.state = int(indexOf(paletteEntry(nbt.final_state?.value ?? 'minecraft:air')))
      delete block.nbt
      continue
    }
    if (AIRISH.has(keys[block.state.value].split('[')[0])) continue
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], pos[a])
      hi[a] = Math.max(hi[a], pos[a])
    }
  }
  // The jigsaw entries stay in the palette unused, which is harmless.
  if (t.palette) t.palette = list('compound', palette)
  else t.palettes.value.items[0] = list('compound', palette)
  const name = `${prefix}_${rel.replace(/\.nbt$/, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`.slice(0, 80)
  writeFileSync(path.join(to, `${name}.nbt`), gzipSync(encode(root)))
  const size = t.size.value.items.map((n) => n.value)
  manifest.push({
    name,
    size,
    solid: lo[0] === Infinity ? { min: [0, 0, 0], max: size.map((s) => s - 1) } : { min: lo, max: hi },
    marks: door ? [{ name: 'door', pos: door.pos, facing: door.facing, jigsaw: door.jigsaw }] : [],
    offset: [0, 0, 0],
    blocks: t.blocks.value.items.length,
    palette: palette.length,
    source: rel,
    kind
  })
  count++
}
writeFileSync(manifestPath, JSON.stringify({ templates: manifest }, null, 2) + '\n')
console.log(`${count} templates from ${from} → ${path.relative(process.cwd(), to)} (${manifest.length} in its manifest)`)
