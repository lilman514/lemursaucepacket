#!/usr/bin/env node
// Bakes the raw templates from structures/build.mjs in a scratch server and copies the results into the pack.
//
//   node structures/bake.mjs --server <scratch server dir> [--feed URL] [--keep N] [--port P]
//   node structures/bake.mjs --server <scratch server dir> --collect   (copy out what the last bake saved)
//
// The scratch server is one made with `npm run server -- --dir <dir> --feed <local feed> --offline` (never the
// real server). This copies in the raw templates (kubejs/data/lsp_raw/structure), the manifest and the bake
// script (structures/bake/bake.js), boots the server, waits for "[bake] showroom ready", copies the baked
// templates out of world/generated/lsp_baked to structures/baked and pack/kubejs/data/lemursaucepacket/structure,
// and leaves the server up for N more seconds (--keep, default 240) so `node structures/preview.mjs` can join and
// photograph the showroom.

import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decode } from './lib/nbt.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const server = arg('server')
if (!server) {
  console.error('Usage: node structures/bake.mjs --server <scratch server dir> [--feed URL] [--keep seconds] [--port P]')
  process.exit(2)
}
const feed = arg('feed', 'http://localhost:8787/launcher.json')
const keep = Number(arg('keep', '240'))
const port = arg('port', '25570')

const rawDir = path.join(here, 'raw')
const manifest = JSON.parse(readFileSync(path.join(rawDir, 'manifest.json'), 'utf8'))

// The world folder is whatever server.properties says (the scratch server may be on a test world).
const levelName = (() => {
  try {
    return /^level-name=(.*)$/m.exec(readFileSync(path.join(server, 'server.properties'), 'utf8'))?.[1]?.trim() || 'world'
  } catch {
    return 'world'
  }
})()
const generated = path.join(server, levelName, 'generated', 'lsp_baked')
if (args.includes('--collect')) {
  collect()
  process.exit(0)
}

// 1. Raw templates, manifest and bake script into the scratch server.
const rawTarget = path.join(server, 'kubejs', 'data', 'lsp_raw', 'structure')
rmSync(rawTarget, { recursive: true, force: true })
mkdirSync(rawTarget, { recursive: true })
for (const t of manifest.templates) copyFileSync(path.join(rawDir, `${t.name}.nbt`), path.join(rawTarget, `${t.name}.nbt`))
mkdirSync(path.join(server, 'kubejs', 'bake'), { recursive: true })
copyFileSync(path.join(rawDir, 'manifest.json'), path.join(server, 'kubejs', 'bake', 'manifest.json'))
copyFileSync(path.join(here, 'bake', 'bake.js'), path.join(server, 'kubejs', 'server_scripts', 'zz_bake.js'))
rmSync(generated, { recursive: true, force: true })
console.log(`Copied ${manifest.templates.length} raw templates into ${server}`)

// 2. Boot it and wait for the bake.
const child = spawn('npm', ['run', 'server', '--', '--dir', server, '--feed', feed, '--offline', '--run', '--port', port, '--stop-after', String(keep + 60), '--op', 'Tester'], {
  cwd: path.join(root, 'launcher'),
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe']
})
let done = false
const onLine = (line) => {
  if (/Server is up|Stopping the server|Exception in server tick loop|has crashed/i.test(line)) console.log(line.trim().slice(0, 160))
}
// KubeJS lines only reach the log files (the server tool doesn't echo them), so follow logs/latest.log, which
// this boot starts afresh.
const latest = path.join(server, 'logs', 'latest.log')
const bootTime = Date.now()
let seen = 0
const watch = setInterval(() => {
  let lines
  try {
    if (!existsSync(latest) || statSync(latest).mtimeMs < bootTime) return
    lines = readFileSync(latest, 'utf8').split(/\r?\n/)
  } catch {
    return // being rotated or written; next time
  }
  for (; seen < lines.length - 1; seen++) {
    const line = lines[seen]
    if (/\[bake\]/.test(line)) console.log(line.replace(/^.*\[bake\] /, '[bake] '))
    if (/Error in 'ServerEvents\.tick'/.test(line)) console.log(line.replace(/^.*\]: /, '').slice(0, 200))
    if (/\[bake\] showroom ready/.test(line) && !done) {
      done = true
      clearInterval(watch)
      collect()
    }
  }
}, 2000)
for (const stream of [child.stdout, child.stderr]) {
  let buf = ''
  stream.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      onLine(buf.slice(0, i))
      buf = buf.slice(i + 1)
    }
  })
}
child.on('exit', (code) => {
  clearInterval(watch)
  if (!done) {
    console.error(`The server stopped (code ${code}) before the bake finished.`)
    process.exit(1)
  }
  process.exit(0)
})

// 3. Copy the baked templates out and check them against the raw ones.
function collect() {
  const dirs = ['structure', 'structures'].map((d) => path.join(generated, d)).filter((d) => existsSync(d))
  if (!dirs.length) {
    console.error(`No baked templates in ${generated}`)
    return
  }
  const bakedDir = path.join(here, 'baked')
  const packDir = path.join(root, 'pack', 'kubejs', 'data', 'lemursaucepacket', 'structure')
  mkdirSync(bakedDir, { recursive: true })
  mkdirSync(packDir, { recursive: true })
  let n = 0
  for (const t of manifest.templates) {
    const src = dirs.map((d) => path.join(d, `${t.name}.nbt`)).find((f) => existsSync(f))
    if (!src) {
      console.error(`  missing baked ${t.name}`)
      continue
    }
    const raw = decode(readFileSync(path.join(rawDir, `${t.name}.nbt`)))
    const baked = decode(readFileSync(src))
    const names = (tpl) => tpl.blocks.map((b) => tpl.palette[b.state].Name).filter((nm) => nm !== 'minecraft:air').length
    const lost = names(raw) - names(baked)
    copyFileSync(src, path.join(bakedDir, `${t.name}.nbt`))
    if (t.kind !== 'sampler') copyFileSync(src, path.join(packDir, `${t.name}.nbt`))
    console.log(`  ${t.name.padEnd(28)} ${raw.blocks.length} → ${baked.blocks.length} blocks${lost ? `  (${lost} non-air blocks lost: unknown or unplaceable)` : ''}`)
    n++
  }
  console.log(`Baked ${n}/${manifest.templates.length} into structures/baked (samplers stay out of the pack). Server stays up ${keep}s for previews.`)
}
void readdirSync
