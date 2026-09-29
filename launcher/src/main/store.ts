import { safeStorage } from 'electron'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import type { AccountInfo, AfterLaunch, Settings } from '../shared/types'
import { writeJson } from '../core/fsutil'
import { log } from './log'

export const systemMemoryMB = (): number => Math.floor(os.totalmem() / (1024 * 1024))

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

/** Half the machine's RAM, capped at what the admin recommends (default 6 GB), never below 2 GB. */
export function defaultMemoryMB(recommended = 6144): number {
  return Math.max(2048, roundTo(Math.min(recommended, systemMemoryMB() / 2), 512))
}

function readJsonSync<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

const AFTER_LAUNCH: AfterLaunch[] = ['minimize', 'close', 'keep']

export class SettingsStore {
  private value: Settings

  constructor(private readonly file: string) {
    this.value = this.sanitize(readJsonSync<Partial<Settings>>(file) ?? {}, this.defaults())
  }

  private defaults(): Settings {
    return {
      memoryMB: defaultMemoryMB(),
      width: 1280,
      height: 720,
      fullscreen: false,
      afterLaunch: 'minimize',
      autoJoin: true,
      javaPath: '',
      jvmArgs: '',
      optionalChoices: {}
    }
  }

  /** Anything the renderer sends is untrusted: keep only well-typed, in-range values. */
  private sanitize(input: Partial<Settings>, base: Settings): Settings {
    const out = { ...base }
    const int = (v: unknown, min: number, max: number): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined
    out.memoryMB = int(input.memoryMB, 1024, Math.max(2048, systemMemoryMB())) ?? base.memoryMB
    out.width = int(input.width, 640, 7680) ?? base.width
    out.height = int(input.height, 480, 4320) ?? base.height
    if (typeof input.fullscreen === 'boolean') out.fullscreen = input.fullscreen
    if (typeof input.autoJoin === 'boolean') out.autoJoin = input.autoJoin
    if (AFTER_LAUNCH.includes(input.afterLaunch as AfterLaunch)) out.afterLaunch = input.afterLaunch as AfterLaunch
    if (typeof input.javaPath === 'string') out.javaPath = input.javaPath.trim()
    if (typeof input.jvmArgs === 'string') out.jvmArgs = input.jvmArgs.slice(0, 2000)
    if (input.optionalChoices && typeof input.optionalChoices === 'object' && !Array.isArray(input.optionalChoices)) {
      out.optionalChoices = Object.fromEntries(
        Object.entries(input.optionalChoices)
          .filter(([k, v]) => typeof k === 'string' && k.length <= 400 && typeof v === 'boolean')
          .slice(0, 500)
      )
    }
    return out
  }

  get(): Settings {
    return { ...this.value, optionalChoices: { ...this.value.optionalChoices } }
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    this.value = this.sanitize(patch, this.value)
    await writeJson(this.file, this.value)
    return this.get()
  }

  /** Applies the admin's recommended memory on first run only. */
  async applyRecommendedMemory(recommended: number | undefined, firstRun: boolean): Promise<void> {
    if (firstRun && recommended) await this.update({ memoryMB: defaultMemoryMB(recommended) })
  }
}

/** On disk the two token fields hold sealed strings; in memory they're plain. */
export interface Account {
  type: 'msa' | 'offline'
  /** Which Microsoft sign-in the refresh token belongs to (see core/auth.ts). Missing means 'azure'. */
  flow?: 'azure' | 'live'
  profile: { id: string; name: string }
  msRefreshToken?: string
  mcAccessToken?: string
  mcExpiresAt?: number
}

/** Tokens are sealed with the OS keychain (DPAPI on Windows) when available. */
function seal(secret: string | undefined): string | undefined {
  if (!secret) return undefined
  if (safeStorage.isEncryptionAvailable()) return `enc:${safeStorage.encryptString(secret).toString('base64')}`
  return `b64:${Buffer.from(secret).toString('base64')}`
}

function unseal(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    if (value.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
    if (value.startsWith('b64:')) return Buffer.from(value.slice(4), 'base64').toString('utf8')
  } catch (e) {
    log('Could not decrypt stored token:', (e as Error).message)
  }
  return undefined
}

export class AccountStore {
  constructor(private readonly file: string) {}

  load(): Account | null {
    const raw = readJsonSync<Account>(this.file)
    if (!raw?.profile?.id) return null
    return { ...raw, msRefreshToken: unseal(raw.msRefreshToken), mcAccessToken: unseal(raw.mcAccessToken) }
  }

  async save(account: Account | null): Promise<void> {
    const stored = account ? { ...account, msRefreshToken: seal(account.msRefreshToken), mcAccessToken: seal(account.mcAccessToken) } : {}
    await writeJson(this.file, stored)
  }

  info(): AccountInfo | null {
    const a = this.load()
    return a ? { name: a.profile.name, uuid: a.profile.id, type: a.type } : null
  }
}
