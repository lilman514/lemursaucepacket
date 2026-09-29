// Installs or updates a dedicated server from the published pack, using the same sync engine as the
// launcher (server-side files only, server-overrides applied). Run it again after every publish.
//
//   npm run server -- --dir D:\LemurSaucePacket-Server [--feed URL] [--memory 10] [--accept-eula]
//
// Then start the server with start.bat in that folder. Testing flags: --offline (online-mode=false),
// --run (start after installing), --stop-after N (seconds after "Done"), --op NAME.

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'
import brand from '../brand.json'
import type { ProgressInfo } from '../src/shared/types'
import { fetchFeed, obtainMrpack } from '../src/core/feed'
import { exists, readJson, writeJson } from '../src/core/fsutil'
import { installServer } from '../src/core/game'
import { setUserAgent } from '../src/core/http'
import { parseMrpack, resolveGameTarget } from '../src/core/mrpack'
import { syncPack, type PackState } from '../src/core/sync'

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`)

const dirArg = arg('dir')
if (!dirArg) {
  console.error('Usage: npm run server -- --dir <server folder> [--feed URL] [--memory GB] [--accept-eula]')
  process.exit(2)
}
const serverDir = path.resolve(dirArg)
const feedUrl = arg('feed', brand.feedUrl)!
const memoryGB = Number(arg('memory', '10'))
const meta = path.join(serverDir, '.launcher')

const t0 = Date.now()
const log = (s: string): void => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s] ${s}`)
let lastProgress = 0
const onProgress = (p: ProgressInfo): void => {
  if (Date.now() - lastProgress < 2000) return
  lastProgress = Date.now()
  log(`${p.label}${p.total ? ` ${Math.floor(((p.current ?? 0) / p.total) * 100)}%` : ''}${p.detail ? ` · ${p.detail}` : ''}`)
}

/** Aikar's G1 flags: the long-standing default for Minecraft servers. */
function jvmArgs(gb: number): string {
  const big = gb >= 12
  return [
    `-Xms${gb}G`,
    `-Xmx${gb}G`,
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    `-XX:G1NewSizePercent=${big ? 40 : 30}`,
    `-XX:G1MaxNewSizePercent=${big ? 50 : 40}`,
    `-XX:G1HeapRegionSize=${big ? 16 : 8}M`,
    `-XX:G1ReservePercent=${big ? 15 : 20}`,
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    `-XX:InitiatingHeapOccupancyPercent=${big ? 20 : 15}`,
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1'
  ].join('\n')
}

const DEFAULT_PROPERTIES: Record<string, string> = {
  motd: `\\u00A76${brand.shortName}\\u00A77 \\u2014 Create SMP`,
  pvp: 'true',
  difficulty: 'normal',
  'max-players': '12',
  'view-distance': '10',
  'simulation-distance': '8',
  // Create contraptions and Aeronautics airships carry players through the air; without this the
  // vanilla anti-fly check kicks them.
  'allow-flight': 'true',
  'online-mode': 'true',
  'enforce-secure-profile': 'true',
  'white-list': 'false',
  // Claims (Open Parties and Claims) protect builds; vanilla spawn protection would just get in the way.
  'spawn-protection': '0',
  'sync-chunk-writes': 'false',
  'network-compression-threshold': '256',
  // Heavy worldgen or a big contraption can exceed the watchdog's 60s and kill the server.
  'max-tick-time': '-1'
}

async function writeProperties(file: string): Promise<void> {
  const props = new Map<string, string>()
  if (await exists(file)) {
    const { readFile } = await import('node:fs/promises')
    for (const line of (await readFile(file, 'utf8')).split(/\r?\n/)) {
      const m = /^([^#=][^=]*)=(.*)$/.exec(line)
      if (m) props.set(m[1].trim(), m[2])
    }
  } else {
    for (const [k, v] of Object.entries(DEFAULT_PROPERTIES)) props.set(k, v)
  }
  if (flag('offline')) props.set('online-mode', 'false')
  if (arg('port')) props.set('server-port', arg('port')!)
  await writeFile(file, [...props].map(([k, v]) => `${k}=${v}`).join('\n') + '\n')
}

async function main(): Promise<void> {
  setUserAgent(`${brand.appId}-server/0.1.0`)
  await mkdir(meta, { recursive: true })
  log(`Installing ${brand.shortName} server into ${serverDir} (feed ${feedUrl})`)
  const feed = await fetchFeed(feedUrl)
  const mrpack = await obtainMrpack(feed, feedUrl, path.join(meta, 'cache'))
  const pack = parseMrpack(mrpack.data, 'server')
  const target = resolveGameTarget(pack.index.dependencies)
  log(`Pack ${pack.index.versionId}: ${pack.index.files.length} files → ${target.loader} ${target.loaderVersion} for ${target.minecraft}`)

  const statePath = path.join(meta, 'pack-state.json')
  const sync = await syncPack({
    instanceDir: serverDir,
    side: 'server',
    pack,
    packSha1: feed.pack.sha1,
    previous: await readJson<PackState>(statePath),
    disabledOptional: new Set(),
    // Leave admin-added server mods alone; the pack only manages its own files.
    strictMods: false,
    verify: flag('repair') ? 'full' : 'fast',
    onProgress,
    log
  })
  await writeJson(statePath, sync.state)
  log(`Mods: ${sync.downloaded.length} downloaded, ${sync.removed.length} removed`)

  const server = await installServer({
    serverDir,
    runtimeDir: path.join(meta, 'runtime'),
    cacheDir: path.join(meta, 'cache'),
    target,
    onProgress,
    log
  })
  await writeFile(path.join(serverDir, 'user_jvm_args.txt'), jvmArgs(memoryGB) + '\n')
  const javaRel = path.relative(serverDir, server.java.java)
  await writeFile(
    path.join(serverDir, 'start.bat'),
    [
      '@echo off',
      `title ${brand.shortName} server`,
      'cd /d "%~dp0"',
      ':loop',
      `"${javaRel}" ${server.args.join(' ')}`,
      'echo.',
      'echo Server stopped. Restarting in 10 seconds (close this window to stop for good)...',
      'timeout /t 10',
      'goto loop',
      ''
    ].join('\r\n')
  )
  await writeProperties(path.join(serverDir, 'server.properties'))
  if (flag('accept-eula')) await writeFile(path.join(serverDir, 'eula.txt'), 'eula=true\n')
  else if (!(await exists(path.join(serverDir, 'eula.txt')))) {
    log('Not starting: accept the Minecraft EULA (https://aka.ms/MinecraftEULA) by rerunning with --accept-eula, or set eula=true in eula.txt.')
  }
  log(`Ready. Start it with ${path.join(serverDir, 'start.bat')}`)

  if (flag('run')) await run(server.java.java, server.args)
}

/** Test helper: start the server, wait for "Done", optionally op someone, stop after N seconds. */
function run(java: string, args: string[]): Promise<void> {
  const stopAfter = Number(arg('stop-after', '0'))
  return new Promise((resolve, reject) => {
    const child = spawn(java, args, { cwd: serverDir, windowsHide: true })
    let ready = false
    const onLine = (line: string): void => {
      if (/Done \([\d.]+s\)!/.test(line) && !ready) {
        ready = true
        log(`Server is up: ${line.replace(/^.*?\]: /, '')}`)
        if (arg('op')) child.stdin.write(`op ${arg('op')}\n`)
        if (stopAfter > 0) setTimeout(() => child.stdin.write('stop\n'), stopAfter * 1000)
      }
      if (/joined the game|left the game|Exception|ERROR|FATAL|Crash report|Stopping the server/.test(line)) log(line.slice(0, 220))
    }
    createInterface({ input: child.stdout }).on('line', onLine)
    createInterface({ input: child.stderr }).on('line', onLine)
    child.on('error', reject)
    child.on('close', (code) => {
      log(`Server exited with code ${code}`)
      process.exitCode = ready ? 0 : 1
      resolve()
    })
  })
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.stack : e)
  process.exit(1)
})
