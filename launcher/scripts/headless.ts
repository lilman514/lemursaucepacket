// Runs the launcher's whole pipeline without Electron: feed -> pack sync -> game install -> launch.
//
//   npx tsx scripts/headless.ts [--feed URL] [--dir PATH] [--full] [--launch] [--name Player] [--seconds 60]
//
// --launch starts the game with an OFFLINE dev profile (singleplayer / offline-mode servers only)
// and kills it after --seconds once the window is up. Useful for testing packs and loader installs.

import { execFile } from 'node:child_process'
import path from 'node:path'
import type { ProgressInfo } from '../src/shared/types'
import { fetchFeed, obtainMrpack } from '../src/core/feed'
import { readJson, writeJson } from '../src/core/fsutil'
import { installGame } from '../src/core/game'
import { setUserAgent } from '../src/core/http'
import { buildLaunchArguments, launchMinecraft, offlineUuid } from '../src/core/launch'
import { disabledOptionalPaths, parseMrpack, resolveGameTarget } from '../src/core/mrpack'
import { syncPack, type PackState } from '../src/core/sync'

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`)

const feedUrl = arg('feed', 'http://localhost:8787/launcher.json')!
const dataDir = path.resolve(arg('dir', path.join(__dirname, '..', '.headless'))!)
const verify = flag('full') ? 'full' : 'fast'
const dirs = {
  mc: path.join(dataDir, 'minecraft'),
  runtime: path.join(dataDir, 'runtime'),
  cache: path.join(dataDir, 'cache'),
  instance: path.join(dataDir, 'instance'),
  state: path.join(dataDir, 'pack-state.json')
}

const t0 = Date.now()
const stamp = (): string => `[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s]`
let lastLine = ''
let lastPrint = 0
function onProgress(p: ProgressInfo): void {
  const pct = p.total ? ` ${Math.floor(((p.current ?? 0) / p.total) * 100)}%` : ''
  const line = `${p.stage.padEnd(9)} ${p.label}${pct}`
  const now = Date.now()
  if (line === lastLine || (now - lastPrint < 1500 && line.split(' ')[0] === lastLine.split(' ')[0])) return
  lastLine = line
  lastPrint = now
  console.log(`${stamp()} ${line}${p.detail ? `  · ${p.detail}` : ''}`)
}
const log = (s: string): void => console.log(`${stamp()} ${s}`)

/** Crash Assistant (in the pack) watches the game from its own process and opens a window when we kill the game; close ours. */
function closeCrashAssistant(): Promise<void> {
  if (process.platform !== 'win32') return Promise.resolve()
  const quote = (s: string): string => `'${s.replace(/'/g, "''")}'`
  const script =
    `Get-CimInstance Win32_Process -Filter "Name='javaw.exe' OR Name='java.exe'" | ` +
    `Where-Object { $_.CommandLine -and $_.CommandLine.Contains('crash_assistant') -and $_.CommandLine.Contains(${quote(dataDir)}) } | ` +
    `ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`
  return new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], () => resolve()))
}

async function main(): Promise<void> {
  setUserAgent('smp-launcher-headless/0.1.0')
  log(`Feed ${feedUrl}  →  ${dataDir}  (verify: ${verify})`)
  const feed = await fetchFeed(feedUrl)
  log(`${feed.name}: pack ${feed.pack.version} (${feed.pack.sha1.slice(0, 10)}), server ${feed.server.address}`)

  const mrpack = await obtainMrpack(feed, feedUrl, dirs.cache)
  const pack = parseMrpack(mrpack.data)
  const target = resolveGameTarget(pack.index.dependencies)
  log(`Pack "${pack.index.name}" ${pack.index.versionId}: ${pack.index.files.length} files, ${pack.overrides.size} overrides → ${target.loader} ${target.loaderVersion ?? ''} for ${target.minecraft}`)

  const previous = await readJson<PackState>(dirs.state)
  const sync = await syncPack({
    instanceDir: dirs.instance,
    pack,
    packSha1: feed.pack.sha1,
    previous,
    // Same rule the launcher uses: optional mods follow the pack's defaults (no player choices here).
    disabledOptional: disabledOptionalPaths(pack.index, {}, new Set(feed.optionalDefaultOff ?? [])),
    strictMods: feed.strictMods ?? true,
    verify,
    onProgress,
    log
  })
  await writeJson(dirs.state, sync.state)
  log(`Sync done: ${sync.downloaded.length} downloaded, ${sync.removed.length} removed, ${sync.quarantined.length} quarantined`)

  const game = await installGame({ mcDir: dirs.mc, runtimeDir: dirs.runtime, cacheDir: dirs.cache, target, verify, onProgress, log })
  log(`Game ready: version ${game.versionId}, java ${game.java.version ?? '?'} at ${game.java.javaw}`)

  const name = arg('name', 'DevPlayer')!
  const params = {
    mcDir: dirs.mc,
    instanceDir: dirs.instance,
    versionId: game.versionId,
    javaPath: game.java.javaw,
    account: { name, uuid: offlineUuid(name), accessToken: '0', userType: 'legacy' as const },
    memoryMB: Number(arg('memory', '4096')),
    resolution: { width: 1280, height: 720, fullscreen: false },
    // --join host:port connects straight to a server after loading (Quick Play).
    server: arg('join') ? { host: arg('join')!.split(':')[0], port: Number(arg('join')!.split(':')[1] ?? 25565) } : undefined,
    launcherName: 'smp-launcher-headless',
    launcherVersion: '0.1.0'
  }
  const args = await buildLaunchArguments(params)
  log(`Launch command has ${args.length} arguments; main class ${args.find((a) => /^(cpw|net)\.|\.main\.|Main$/.test(a)) ?? '?'}`)

  if (!flag('launch')) {
    log('Done (pass --launch to start the game).')
    return
  }
  const seconds = Number(arg('seconds', '60'))
  // "Loaded" = the title screen is up (ModernFix prints its timing then); override with --until.
  const until = new RegExp(arg('until', 'Game took [\\d.]+ seconds to start')!)
  const failure = new RegExp(
    'Mod loading has failed|Missing or unsupported mandatory dependencies|ModLoadingException|Failed to create mod instance|Crash report saved to|' +
      'Encountered an unexpected exception|Error during pre-loading phase|broken mod state' +
      (arg('join') ? '|Disconnected from server|Couldn.t connect to server|Connection refused|Mismatched mod|Incompatible client|disconnect\\.' : '')
  )
  const timeoutSec = Number(arg('timeout', '600'))
  const handle = await launchMinecraft(params)
  log(`Game started (pid ${handle.process.pid}); output → ${handle.logFile}`)
  let outcome = 'timeout'
  const stop = (why: string, delaySec: number): void => {
    // A failure always wins, even after the game looked loaded.
    if (outcome === 'failed' || (outcome !== 'timeout' && why !== 'failed')) return
    outcome = why
    setTimeout(() => handle.process.kill(), delaySec * 1000)
  }
  const watchdog = setTimeout(() => stop('timeout', 0), timeoutSec * 1000)
  handle.onReady(() => log('Game window is up'))
  handle.onLine((line) => {
    if (until.test(line)) {
      log(`Loaded: ${line.replace(/^.*?\]: /, '').slice(0, 120)}. Leaving it running for ${seconds}s…`)
      stop('loaded', seconds)
    } else if (failure.test(line)) {
      log(`FAILURE: ${line.slice(0, 200)}`)
      stop('failed', 5)
    }
  })
  await new Promise<void>((resolve) =>
    handle.onExit((info) => {
      clearTimeout(watchdog)
      log(`Game exited with code ${info.code} (outcome: ${outcome})${info.crashReportLocation ? `; crash report: ${info.crashReportLocation}` : ''}`)
      if (outcome !== 'loaded') console.log(info.tail.slice(-40).join('\n'))
      process.exitCode = outcome === 'loaded' ? 0 : 1
      resolve()
    })
  )
  await closeCrashAssistant()
}

main().catch((e) => {
  console.error(`${stamp()} FAILED:`, e instanceof Error ? e.stack : e)
  process.exit(1)
})
