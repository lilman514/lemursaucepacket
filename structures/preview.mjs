#!/usr/bin/env node
// Photographs the bake showroom: run while `node structures/bake.mjs` keeps its scratch server up.
//
//   node structures/preview.mjs --client <headless client dir> --server <scratch server dir> [--feed URL] [--join host:port]
//
// Copies the manifest and structures/bake/preview_client.js into the headless test client (made by the
// launcher's `npx tsx scripts/headless.ts --dir <dir> --launch`), joins the scratch server, and copies
// screenshots/preview_*.png to structures/previews/ (git-ignored).

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const client = arg('client')
if (!client) {
  console.error('Usage: node structures/preview.mjs --client <headless client dir> [--feed URL] [--join host:port]')
  process.exit(2)
}
const feed = arg('feed', 'http://localhost:8787/launcher.json')
const join = arg('join', '127.0.0.1:25570')
const instance = path.join(client, 'instance')
const manifest = JSON.parse(readFileSync(path.join(here, 'raw', 'manifest.json'), 'utf8'))
const shots = manifest.templates.length * 2
const seconds = 12 + shots * 6 + 20

mkdirSync(path.join(instance, 'kubejs', 'bake'), { recursive: true })
copyFileSync(path.join(here, 'raw', 'manifest.json'), path.join(instance, 'kubejs', 'bake', 'manifest.json'))
// The bake decided where each building stands; photograph those spots.
const serverDir = arg('server')
if (!serverDir || !existsSync(path.join(serverDir, 'kubejs', 'bake', 'layout.json'))) {
  console.error('Needs --server <scratch server dir> with kubejs/bake/layout.json (run structures/bake.mjs first).')
  process.exit(2)
}
copyFileSync(path.join(serverDir, 'kubejs', 'bake', 'layout.json'), path.join(instance, 'kubejs', 'bake', 'layout.json'))
copyFileSync(path.join(here, 'bake', 'preview_client.js'), path.join(instance, 'kubejs', 'client_scripts', 'zz_preview.js'))
// A 60° field of view (options.txt stores (fov - 70) / 40) so buildings don't bulge like a fisheye.
const optionsFile = path.join(instance, 'options.txt')
if (existsSync(optionsFile)) writeFileSync(optionsFile, readFileSync(optionsFile, 'utf8').replace(/^fov:.*$/m, 'fov:-0.25'))
const shotsDir = path.join(instance, 'screenshots')
if (existsSync(shotsDir)) for (const f of readdirSync(shotsDir)) if (f.startsWith('preview_')) rmSync(path.join(shotsDir, f))

console.log(`Joining ${join} for ${seconds}s to take ${shots} shots...`)
const run = spawnSync('npx', ['tsx', 'scripts/headless.ts', '--dir', client, '--launch', '--join', join, '--seconds', String(seconds), '--name', 'Tester', '--feed', feed], {
  cwd: path.join(root, 'launcher'),
  shell: true,
  stdio: 'inherit'
})
rmSync(path.join(instance, 'kubejs', 'client_scripts', 'zz_preview.js'), { force: true })

const out = path.join(here, 'previews')
mkdirSync(out, { recursive: true })
let n = 0
if (existsSync(shotsDir)) {
  for (const f of readdirSync(shotsDir)) {
    if (!f.startsWith('preview_')) continue
    copyFileSync(path.join(shotsDir, f), path.join(out, f.replace(/^preview_/, '')))
    n++
  }
}
console.log(`${n}/${shots} previews in structures/previews (client exit ${run.status})`)
void statSync
