#!/usr/bin/env node
// Builds the folder you host for players and the server:
//
//   site/launcher.json              <- the launcher reads this before every launch
//   site/packs/<name>-<ver>.mrpack  <- exported from pack/ with packwiz
//   site/packs/latest.mrpack        <- stable URL for the server (itzg MODRINTH_MODPACK)
//
// Usage:  node publish/publish.mjs [--allow-external]
// Needs packwiz (https://packwiz.infra.link) on PATH, in ~/go/bin, or set PACKWIZ=/path/to/packwiz.
// --allow-external keeps non-Modrinth download URLs (e.g. CurseForge-only mods) in the pack instead
// of letting packwiz refuse them; only do that for mods whose authors allow third-party downloads.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packDir = path.join(root, 'pack')
const siteDir = path.join(root, 'site')
const packsDir = path.join(siteDir, 'packs')
const KEEP_OLD_PACKS = 5

function findPackwiz() {
  if (process.env.PACKWIZ) return process.env.PACKWIZ
  const local = path.join(os.homedir(), 'go', 'bin', process.platform === 'win32' ? 'packwiz.exe' : 'packwiz')
  return existsSync(local) ? local : 'packwiz'
}

function tomlString(text, key) {
  return new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm').exec(text)?.[1]
}

const packwiz = findPackwiz()
const packToml = readFileSync(path.join(packDir, 'pack.toml'), 'utf8')
const name = tomlString(packToml, 'name')
const version = tomlString(packToml, 'version')
if (!name || !version) throw new Error('pack/pack.toml needs a name and a version')

const versionsSection = packToml.split(/^\[versions\]\s*$/m)[1] ?? ''
const minecraft = tomlString(versionsSection, 'minecraft')
const loaders = { neoforge: 'neoforge', forge: 'forge', fabric: 'fabric', quilt: 'quilt' }
const loader = Object.keys(loaders).find((l) => tomlString(versionsSection, l)) ?? 'vanilla'
const loaderVersion = loader === 'vanilla' ? undefined : tomlString(versionsSection, loader)

console.log(`Publishing ${name} ${version} (Minecraft ${minecraft}, ${loader} ${loaderVersion ?? ''})`)
// The quest book is compiled from quests/book.mjs; rebuilding here means a publish can never ship a
// stale book, and a bad item id stops the publish instead of reaching players.
if (existsSync(path.join(root, 'quests', 'book.mjs'))) {
  execFileSync(process.execPath, [path.join(root, 'quests', 'build.mjs')], { stdio: 'inherit' })
}
// Likewise the RuneScape-style skills (Project MMO config) come from skills/build.mjs.
if (existsSync(path.join(root, 'skills', 'build.mjs'))) {
  execFileSync(process.execPath, [path.join(root, 'skills', 'build.mjs')], { stdio: 'inherit' })
}
// Enchanting: the level caps, the Enchanting skill's unlock table and the pack's own enchantments.
execFileSync(process.execPath, [path.join(root, 'enchanting', 'build.mjs')], { stdio: 'inherit' })
// Gear and capes: scripts, configs and wiki pages generated from their definitions.
execFileSync(process.execPath, [path.join(root, 'gear', 'build.mjs')], { stdio: 'inherit' })
execFileSync(process.execPath, [path.join(root, 'capes', 'build.mjs')], { stdio: 'inherit' })
// The wiki (docs/) goes up next to the feed as site/wiki/, and into the pack as a Patchouli guide book —
// so it has to be built before the pack is exported.
execFileSync(process.execPath, [path.join(root, 'publish', 'docs.mjs')], { stdio: 'inherit' })
execFileSync(process.execPath, [path.join(root, 'publish', 'patchouli.mjs')], { stdio: 'inherit' })
execFileSync(packwiz, ['refresh'], { cwd: packDir, stdio: 'inherit' })

const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const fileName = `${slug}-${version}.mrpack`
mkdirSync(packsDir, { recursive: true })
const output = path.join(packsDir, fileName)
const exportArgs = process.argv.includes('--allow-external') ? ['--restrictDomains=false'] : []
execFileSync(packwiz, ['modrinth', 'export', '-o', output, ...exportArgs], { cwd: packDir, stdio: 'inherit' })
await linkCurseForgeFiles(output)
await moveServerOnlyFiles(output)
await checkLocalJars(output)
copyFileSync(output, path.join(packsDir, 'latest.mrpack'))

const data = readFileSync(output)
const sha1 = createHash('sha1').update(data).digest('hex')
const modCount = (readFileSync(path.join(packDir, 'index.toml'), 'utf8').match(/^metafile\s*=\s*true/gm) ?? []).length

// Optional mods marked `[option] default = false` in their .pw.toml start switched off in the launcher.
// They're identified by Modrinth project id so a player's choice survives mod updates.
const optionalDefaultOff = []
for (const [, file] of readFileSync(path.join(packDir, 'index.toml'), 'utf8').matchAll(/file\s*=\s*"([^"]+\.pw\.toml)"/g)) {
  const toml = readFileSync(path.join(packDir, file), 'utf8')
  const option = toml.split(/^\[option\]\s*$/m)[1]?.split(/^\[/m)[0] ?? ''
  const modId = /^mod-id\s*=\s*"([^"]+)"/m.exec(toml)?.[1]
  if (/^optional\s*=\s*true/m.test(option) && /^default\s*=\s*false/m.test(option) && modId) optionalDefaultOff.push(modId)
}

const feed = JSON.parse(readFileSync(path.join(root, 'publish', 'feed.json'), 'utf8'))
const previous = existsSync(path.join(siteDir, 'launcher.json')) ? JSON.parse(readFileSync(path.join(siteDir, 'launcher.json'), 'utf8')) : null
const launcherJson = {
  schema: 1,
  ...feed,
  pack: { version, url: `packs/${fileName}`, sha1, size: data.length, minecraft, loader, loaderVersion, modCount },
  optionalDefaultOff,
  generatedAt: new Date().toISOString()
}
writeFileSync(path.join(siteDir, 'launcher.json'), JSON.stringify(launcherJson, null, 2) + '\n')
writeFileSync(path.join(siteDir, '.nojekyll'), '')

// Keep a few old versions around so players mid-update never hit a 404.
const old = readdirSync(packsDir)
  .filter((f) => f.endsWith('.mrpack') && f !== 'latest.mrpack' && f !== fileName)
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
for (const f of old.slice(KEEP_OLD_PACKS)) rmSync(path.join(packsDir, f))

console.log(`\nWrote site/launcher.json and site/packs/${fileName} (${modCount} mods, sha1 ${sha1.slice(0, 12)}…)`)
if (previous?.pack?.version === version && previous.pack.sha1 !== sha1) {
  console.log(`Note: the pack changed but its version is still ${version}. Players will still get the update;`)
  console.log('bump "version" in pack/pack.toml so the change shows up in the launcher.')
}
console.log('Upload the site/ folder to your host (or push to GitHub and let the workflow deploy it).')

/**
 * packwiz exports CurseForge mods (e.g. FTB Quests) by copying the jar into the .mrpack's overrides,
 * which would mean re-hosting someone else's file. Replace each copy with a link to CurseForge's own
 * CDN instead, so every player downloads it from CurseForge. Hashes are checked here at publish time.
 */
/**
 * The pack's own jars (pack/mods/*.jar, e.g. lsp_fixes) ride along as overrides. Once, right after a rebuild of
 * one, the export carried the previous build (the index already had the new hash), and a scratch server ran the
 * old code; so every such jar in the .mrpack is compared with the file on disk, and a mismatch stops the publish.
 */
async function checkLocalJars(mrpackPath) {
  const { unzipSync } = await import('fflate')
  const modsDir = path.join(packDir, 'mods')
  const jars = readdirSync(modsDir).filter((f) => f.endsWith('.jar'))
  if (jars.length === 0) return
  const wanted = new Set(jars.map((f) => `overrides/mods/${f}`))
  const entries = unzipSync(readFileSync(mrpackPath), { filter: (f) => wanted.has(f.name) })
  for (const f of jars) {
    const packed = entries[`overrides/mods/${f}`]
    const onDisk = readFileSync(path.join(modsDir, f))
    const hash = (b) => createHash('sha1').update(b).digest('hex')
    if (!packed) throw new Error(`${f} is in pack/mods but not in the exported pack`)
    if (hash(packed) !== hash(onDisk)) throw new Error(`${f} in the exported pack (${packed.length} bytes) is not the one in pack/mods (${onDisk.length} bytes): run the publish again`)
  }
  console.log(`Checked ${jars.length} local jar(s) in the pack against pack/mods`)
}

/** Moves files that only mean something to the dedicated server into server-overrides (packwiz can only emit shared overrides). */
async function moveServerOnlyFiles(mrpackPath) {
  const SERVER_ONLY = ['server-icon.png']
  const { unzipSync, zipSync } = await import('fflate')
  const entries = unzipSync(readFileSync(mrpackPath))
  const moved = SERVER_ONLY.filter((rel) => entries[`overrides/${rel}`])
  if (moved.length === 0) return
  for (const rel of moved) {
    entries[`server-overrides/${rel}`] = entries[`overrides/${rel}`]
    delete entries[`overrides/${rel}`]
  }
  writeFileSync(mrpackPath, zipSync(entries, { level: 9 }))
  console.log(`Server-only: ${moved.join(', ')}`)
}

async function linkCurseForgeFiles(mrpackPath) {
  const cf = []
  for (const [, file] of readFileSync(path.join(packDir, 'index.toml'), 'utf8').matchAll(/file\s*=\s*"([^"]+\.pw\.toml)"/g)) {
    const toml = readFileSync(path.join(packDir, file), 'utf8')
    if (!/^mode\s*=\s*"metadata:curseforge"/m.test(toml)) continue
    cf.push({
      dir: path.posix.dirname(file.replace(/\\/g, '/')),
      filename: tomlString(toml, 'filename'),
      sha1: tomlString(toml, 'hash'),
      fileId: Number(/^file-id\s*=\s*(\d+)/m.exec(toml)?.[1]),
      side: tomlString(toml, 'side') ?? 'both'
    })
  }
  if (cf.length === 0) return

  const { unzipSync, zipSync } = await import('fflate')
  const entries = unzipSync(readFileSync(mrpackPath))
  const index = JSON.parse(new TextDecoder().decode(entries['modrinth.index.json']))
  const env = { both: { client: 'required', server: 'required' }, client: { client: 'required', server: 'unsupported' }, server: { client: 'unsupported', server: 'required' } }
  for (const f of cf) {
    const cdnPath = `files/${Math.floor(f.fileId / 1000)}/${f.fileId % 1000}/${encodeURIComponent(f.filename)}`
    const urls = [`https://mediafilez.forgecdn.net/${cdnPath}`, `https://edge.forgecdn.net/${cdnPath}`]
    const res = await fetch(urls[0])
    if (!res.ok) throw new Error(`CurseForge CDN returned ${res.status} for ${f.filename}`)
    const data = Buffer.from(await res.arrayBuffer())
    const sha1 = createHash('sha1').update(data).digest('hex')
    if (sha1 !== f.sha1) throw new Error(`Hash mismatch for ${f.filename} from CurseForge (expected ${f.sha1}, got ${sha1})`)
    const target = `${f.dir === '.' ? 'mods' : f.dir}/${f.filename}`
    delete entries[`overrides/${target}`]
    index.files = index.files.filter((x) => x.path !== target)
    index.files.push({
      path: target,
      hashes: { sha1, sha512: createHash('sha512').update(data).digest('hex') },
      env: env[f.side] ?? env.both,
      downloads: urls,
      fileSize: data.length
    })
    console.log(`Linked ${f.filename} to CurseForge's CDN`)
  }
  entries['modrinth.index.json'] = new TextEncoder().encode(JSON.stringify(index, null, 1))
  writeFileSync(mrpackPath, zipSync(entries, { level: 9 }))
}
