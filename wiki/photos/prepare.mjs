#!/usr/bin/env node
// Readies the atlas photo session: writes wiki/photos/atlas_shots.js, with the shot list from wiki/atlas.json filled
// in, into a headless test instance's client scripts (never into pack/). Nothing is shot until that instance's game
// runs, joined to a scratch server as an op.
//
//   node wiki/photos/prepare.mjs --instance <headless>/instance [--kinds biomes,creatures] [--only id,id] [--missing]
//                                [--distant <ticks>] [--peek] [--spots <file>] [--spots-only] [--part k/n]
//                                [--borderless] [--done <screenshots dir>]
//
// --distant gives Distant Horizons that much longer at each open-air biome shot (atlas-run.sh turns it up for the
// session); --peek also shoots halfway through that wait, to judge how long it needs.
//
// --missing leaves out everything docs/images/atlas already has a picture of, so a second session only fills gaps.
//
// --spots shoots the biomes it lists from viewpoints kept from an earlier session (a JSON list of { id, m: biome
// middle, c: camera }), with no /locate; the rest are found as usual (--spots-only leaves them out). --part k/n keeps
// every n-th shot from the k-th, so n test clients can share one session. --borderless shoots in a frameless window
// the size of the screen. --done leaves out what a session already shot (an atlas_<b|c>_<key>.png in that folder),
// so an interrupted session can carry on.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : fallback
}
const instance = arg('instance')
if (!instance || !existsSync(instance)) {
  console.error('prepare: pass --instance <the headless test instance folder>')
  process.exit(1)
}
const kinds = arg('kinds', 'biomes,creatures').split(',')
const only = arg('only') ? new Set(arg('only').split(',')) : null
const missing = process.argv.includes('--missing')

const atlas = JSON.parse(readFileSync(path.join(root, 'wiki', 'atlas.json'), 'utf8'))
const key = (id) => id.replace(':', '__').replace(/\//g, '_')
const has = (kind, id) => ['webp', 'jpg'].some((ext) => existsSync(path.join(root, 'docs', 'images', 'atlas', kind, `${key(id)}.${ext}`)))
const spots = arg('spots') ? new Map(JSON.parse(readFileSync(arg('spots'), 'utf8')).map((s) => [s.id, s])) : null
const doneDir = arg('done')
const shotAlready = (kind, id) => doneDir && existsSync(path.join(doneDir, `atlas_${kind === 'biomes' ? 'b' : 'c'}_${key(id)}.png`))
const wanted = (kind, id) => !shotAlready(kind, id) && (!only || only.has(id)) && !(missing && has(kind, id)) && !(spots && process.argv.includes('--spots-only') && kind === 'biomes' && !spots.has(id))

const DIMS = { overworld: 'minecraft:overworld', nether: 'minecraft:the_nether', end: 'minecraft:the_end' }
const shots = []
if (kinds.includes('biomes')) {
  // The Overworld first, then the Nether and the End, so the session crosses dimensions twice.
  const order = ['overworld', 'nether', 'end']
  for (const b of [...atlas.biomes].sort((a, c) => order.indexOf(a.dimension) - order.indexOf(c.dimension))) {
    if (!wanted('biomes', b.id)) continue
    const path_ = b.id.split(':')[1]
    const how = b.dimension === 'nether' ? 'nether' : b.dimension === 'end' ? 'end' : b.category === 'caves' ? 'cave' : b.category === 'oceans' && !/river|beach|shore|coast/.test(path_) ? 'sea' : 'surface'
    const shot = { kind: 'biome', id: b.id, name: `b_${key(b.id)}`, dim: DIMS[b.dimension], how, dark: how === 'cave', lift: b.category === 'mountains' || b.category === 'snowy' && /peak|slope|mountain/.test(path_) ? 18 : b.category === 'forests' || b.category === 'jungles' ? 14 : 10 }
    if (spots && spots.has(b.id)) Object.assign(shot, { cam: spots.get(b.id).c, mid: spots.get(b.id).m })
    shots.push(shot)
  }
}
if (kinds.includes('creatures')) {
  const biomeById = new Map(atlas.biomes.map((b) => [b.id, b]))
  for (const c of atlas.creatures) {
    if (!wanted('creatures', c.id)) continue
    const water = c.categories.some((k) => /water|axolotl/.test(k)) || /shark|whale|fish|ray|clam|isopod|jellyfish|starfish|piranha|bass|catfish|anglerfish|blobfish|squid|dolphin|turtle|axolotl/.test(c.id)
    const dims = new Set(c.biomes.map((id) => biomeById.get(id)?.dimension))
    const floor = dims.size === 1 && dims.has('nether') ? 'minecraft:netherrack' : dims.size === 1 && dims.has('end') ? 'minecraft:end_stone' : 'minecraft:grass_block'
    shots.push({ kind: 'creature', id: c.id, name: `c_${key(c.id)}`, water, floor })
  }
}

const part = /^(\d+)\/(\d+)$/.exec(arg('part', '1/1'))
if (part) {
  const [k, n] = [Number(part[1]), Number(part[2])]
  shots.splice(0, shots.length, ...shots.filter((_, i) => i % n === k - 1))
}
const template = readFileSync(path.join(root, 'wiki', 'photos', 'atlas_shots.js'), 'utf8')
const distant = Number(arg('distant', '0'))
let script = template.replace(/\/\*SHOTS\*\/[\s\S]*?\/\*END\*\//, `/*SHOTS*/ ${JSON.stringify(shots)} /*END*/`)
script = script.replace(/(\/\*OPTS\*\/[\s\S]*?)distant: \d+, peek: (true|false), borderless: (true|false)/, `$1distant: ${distant}, peek: ${process.argv.includes('--peek')}, borderless: ${process.argv.includes('--borderless')}`)
const out = path.join(instance, 'kubejs', 'client_scripts', 'zz_atlas_shots.js')
mkdirSync(path.dirname(out), { recursive: true })
writeFileSync(out, script)
const open = shots.filter((s) => s.kind === 'biome' && (s.how === 'surface' || s.how === 'sea')).length
const minutes = Math.round((shots.filter((s) => s.kind === 'biome').length * 22 + open * (distant / 20) + shots.filter((s) => s.kind === 'creature').length * 8) / 60)
console.log(`prepare: ${shots.length} shots (${shots.filter((s) => s.kind === 'biome').length} biomes, ${shots.filter((s) => s.kind === 'creature').length} creatures) → ${out}, about ${minutes} minutes`)
