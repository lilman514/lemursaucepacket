import type { ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, type WriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { createMinecraftProcessWatcher, generateArguments, launch, type LaunchOption } from '@xmcl/core'

/** The official launcher's G1 defaults — a safe baseline for heavily modded clients. */
const DEFAULT_JVM_ARGS = [
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+UseG1GC',
  '-XX:G1NewSizePercent=20',
  '-XX:G1ReservePercent=20',
  '-XX:MaxGCPauseMillis=50',
  '-XX:G1HeapRegionSize=32M'
]

export interface LaunchAccount {
  name: string
  /** UUID without dashes. */
  uuid: string
  accessToken: string
  userType: 'msa' | 'legacy'
}

export interface LaunchParams {
  mcDir: string
  instanceDir: string
  versionId: string
  javaPath: string
  account: LaunchAccount
  memoryMB: number
  resolution?: { width: number; height: number; fullscreen: boolean }
  /** Join this server as soon as the game has loaded. Without a port the game resolves SRV records itself. */
  server?: { host: string; port?: number }
  extraJvmArgs?: string[]
  launcherName: string
  launcherVersion: string
}

export interface GameHandle {
  process: ChildProcess
  /** Fires once the game window is up. */
  onReady(cb: () => void): void
  /** Fires when the game exits; `tail` holds the last lines of output. */
  onExit(cb: (info: { code: number | null; crashReport?: string; crashReportLocation?: string; tail: string[] }) => void): void
  /** Every line the game prints (stdout and stderr). */
  onLine(cb: (line: string) => void): void
  logFile: string
}

function launchOptions(p: LaunchParams): LaunchOption {
  return {
    gamePath: p.instanceDir,
    resourcePath: p.mcDir,
    javaPath: p.javaPath,
    version: p.versionId,
    gameProfile: { name: p.account.name, id: p.account.uuid },
    accessToken: p.account.accessToken,
    // xmcl's typings predate "msa", but it passes the value straight through to --userType.
    userType: p.account.userType as LaunchOption['userType'],
    maxMemory: p.memoryMB,
    resolution: p.resolution,
    quickPlayMultiplayer: p.server ? (p.server.port ? `${p.server.host}:${p.server.port}` : p.server.host) : undefined,
    extraJVMArgs: [...DEFAULT_JVM_ARGS, ...(p.extraJvmArgs ?? [])],
    launcherName: p.launcherName,
    launcherBrand: p.launcherVersion,
    extraExecOption: { windowsHide: true }
  }
}

export async function buildLaunchArguments(p: LaunchParams): Promise<string[]> {
  return generateArguments(launchOptions(p))
}

export async function launchMinecraft(p: LaunchParams): Promise<GameHandle> {
  const logDir = path.join(p.instanceDir, 'logs')
  await mkdir(logDir, { recursive: true })
  const logFile = path.join(logDir, 'launcher-output.log')
  const log: WriteStream = createWriteStream(logFile, { flags: 'w' })

  log.on('error', () => {}) // a full or locked disk must not take the launcher down

  const child = await launch(launchOptions(p))
  const watcher = createMinecraftProcessWatcher(child)
  const tail: string[] = []
  const lineListeners: ((line: string) => void)[] = []
  const collect = (line: string): void => {
    if (!log.writableEnded) log.write(line + '\n')
    tail.push(line)
    if (tail.length > 200) tail.shift()
    for (const cb of lineListeners) cb(line)
  }
  if (child.stdout) createInterface({ input: child.stdout }).on('line', collect)
  if (child.stderr) createInterface({ input: child.stderr }).on('line', collect)

  type ExitInfo = Parameters<Parameters<GameHandle['onExit']>[0]>[0]
  let exitListeners: ((info: ExitInfo) => void)[] = []
  let exited = false
  const fireExit = (info: ExitInfo): void => {
    if (exited) return
    exited = true
    log.end()
    for (const cb of exitListeners) cb(info)
    exitListeners = []
  }
  // The watcher reports on 'exit', which can fire before stdout is drained; finish on 'close'
  // so the tail and log file include the game's last words.
  let crash: { code: number | null; crashReport?: string; crashReportLocation?: string } | null = null
  watcher.on('minecraft-exit', ({ code, crashReport, crashReportLocation }) => {
    crash = { code, crashReport: crashReport || undefined, crashReportLocation: crashReportLocation || undefined }
  })
  child.once('close', (code: number | null) => fireExit({ ...(crash ?? { code }), tail: tail.slice() }))
  watcher.on('error', (e: Error) => {
    collect(`[launcher] ${e.message}`)
    fireExit({ code: null, tail: tail.slice() })
  })

  return {
    process: child,
    logFile,
    onReady: (cb) => watcher.once('minecraft-window-ready', cb),
    onExit: (cb) => {
      exitListeners.push(cb)
    },
    onLine: (cb) => {
      lineListeners.push(cb)
    }
  }
}

/** Same UUID the vanilla game derives for offline players ("OfflinePlayer:<name>", MD5, version 3). */
export function offlineUuid(name: string): string {
  const md5 = createHash('md5').update(`OfflinePlayer:${name}`).digest()
  md5[6] = (md5[6] & 0x0f) | 0x30
  md5[8] = (md5[8] & 0x3f) | 0x80
  return md5.toString('hex')
}
