// Orchestrates everything behind the Play button and reports progress to the window.

import { app, shell, type BrowserWindow } from 'electron'
import { EventEmitter } from 'node:events'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { AccountInfo, AfterLaunch, GameStatus, LauncherFeed, LoginCode, ModEntry, PackSummary, ProgressInfo, ServerStatus, Settings, ToastMessage } from '../shared/types'
import {
  AuthError,
  exchangeAuthCode,
  loginMinecraft,
  refreshLiveToken,
  refreshMicrosoftToken,
  requestDeviceCode,
  waitForDeviceCode,
  type MicrosoftTokens,
  type SignInFlow
} from '../core/auth'
import { cachedMrpack, compareVersions, fetchFeed, obtainMrpack, validateFeed } from '../core/feed'
import { exists, readJson, writeFileAtomic, writeJson } from '../core/fsutil'
import { installGame } from '../core/game'
import { CancelledError } from '../core/http'
import { launchMinecraft, offlineUuid, type GameHandle, type LaunchAccount } from '../core/launch'
import { lookupBySha1, type ModMeta } from '../core/modrinth'
import { disabledOptionalPaths, fileKey, fileSide, parseMrpack, resolveGameTarget, type ParsedMrpack } from '../core/mrpack'
import { SHADERS_OFF, applyShaderPreset, shaderPresetPatch } from '../core/shaders'
import { pingServer } from '../core/ping'
import { serversDat } from '../core/serversDat'
import { syncPack, type PackState } from '../core/sync'
import { brand, feedUrl, isDev, type DataPaths } from './config'
import { interactiveMicrosoftLogin } from './login'
import { log } from './log'
import type { AccountStore, SettingsStore } from './store'

/** An error whose message is written for players, shown as-is in the UI. */
export class UserError extends Error {}

export interface LauncherEvents {
  progress: [ProgressInfo | null]
  status: [GameStatus]
  toast: [ToastMessage]
  account: [AccountInfo | null]
  loginCode: [LoginCode | null]
}

export class Launcher extends EventEmitter<LauncherEvents> {
  private status: GameStatus = { state: 'idle' }
  private abort: AbortController | null = null
  private game: GameHandle | null = null
  private stopRequested = false
  private feed: LauncherFeed | null = null
  private loginAbort: AbortController | null = null

  constructor(
    private readonly paths: DataPaths,
    private readonly settings: SettingsStore,
    private readonly accounts: AccountStore,
    private readonly getWindow: () => BrowserWindow | null
  ) {
    super()
  }

  // ------------------------------------------------------------------ state

  getStatus(): GameStatus {
    return this.status
  }

  private setStatus(status: GameStatus): void {
    this.status = status
    this.emit('status', status)
  }

  private progress(p: ProgressInfo | null): void {
    this.emit('progress', p)
  }

  private toast(kind: ToastMessage['kind'], text: string): void {
    this.emit('toast', { kind, text })
  }

  async installedSummary(): Promise<PackSummary | null> {
    const state = await readJson<PackState>(this.paths.packState)
    if (!state?.packSha1) return null
    return {
      name: state.name,
      version: state.packVersion,
      minecraft: state.minecraft,
      loader: state.loader,
      loaderVersion: state.loaderVersion,
      modCount: Object.keys(state.files).filter((f) => f.startsWith('mods/')).length
    }
  }

  // ------------------------------------------------------------------ feed & pack

  /** Latest launcher.json, falling back to the last copy we saw when offline. */
  async getFeed(force = false): Promise<LauncherFeed | null> {
    if (this.feed && !force) return this.feed
    return (await this.refreshFeed()).feed
  }

  private async refreshFeed(): Promise<{ feed: LauncherFeed | null; fresh: boolean }> {
    try {
      this.feed = await fetchFeed(feedUrl())
      await writeJson(this.paths.feedCache, this.feed)
      return { feed: this.feed, fresh: true }
    } catch (e) {
      log(`Could not fetch ${feedUrl()}:`, (e as Error).message)
      if (!this.feed) {
        const cached = await readJson<unknown>(this.paths.feedCache)
        this.feed = cached ? validateFeed(cached) : null
      }
      return { feed: this.feed, fresh: false }
    }
  }

  private async currentPack(): Promise<ParsedMrpack | null> {
    const feed = await this.getFeed()
    if (feed) {
      try {
        return parseMrpack((await obtainMrpack(feed, feedUrl(), this.paths.cache)).data)
      } catch (e) {
        log('Could not load the pack from the feed:', (e as Error).message)
      }
    }
    const state = await readJson<PackState>(this.paths.packState)
    const data = state ? await cachedMrpack(this.paths.cache, state.packSha1) : null
    return data ? parseMrpack(data) : null
  }

  async getServerStatus(): Promise<ServerStatus> {
    const feed = await this.getFeed()
    if (!feed) return { online: false, error: 'No server configured' }
    const target = await this.resolveServer(feed)
    return target.localStatus ?? pingServer(target.host, target.port)
  }

  /**
   * Where to join: the pack's address, or localhost when this PC is running the server itself. Many home
   * routers can't loop a PC's own public address back to it, so the host couldn't join otherwise.
   */
  private async resolveServer(feed: LauncherFeed): Promise<{ host: string; port?: number; localStatus?: ServerStatus }> {
    const { server } = feed
    const port = server.port ?? 25565
    const local = await pingServer('localhost', port, 800).catch(() => null)
    const name = (server.name ?? feed.name).toLowerCase()
    if (local?.online && (local.motd ?? '').toLowerCase().includes(name)) return { host: 'localhost', port, localStatus: { ...local, local: true } }
    return { host: server.address, port: server.port }
  }

  /** The shader picker: a preset id, or SHADERS_OFF to switch Iris off. Applied on the next Play. */
  async setShaderPreset(id: string): Promise<Settings> {
    const shaders = this.feed?.shaders
    if (!shaders) throw new UserError('This pack has no shader presets.')
    if (id !== SHADERS_OFF && !shaders.presets.some((p) => p.id === id)) throw new UserError('Unknown shader preset.')
    return this.settings.update(shaderPresetPatch(this.feed, this.settings.get(), id))
  }

  async getMods(): Promise<ModEntry[]> {
    const pack = await this.currentPack()
    if (!pack) return []
    const choices = this.settings.get().optionalChoices
    const defaultOff = new Set(this.feed?.optionalDefaultOff ?? [])
    const files = pack.index.files.filter((f) => f.path.startsWith('mods/') && f.env?.client !== 'unsupported')
    const meta = await this.modMeta(files.map((f) => f.hashes.sha1))
    return files
      .map((f): ModEntry => {
        const optional = f.env?.client === 'optional'
        const key = fileKey(f)
        const defaultEnabled = !defaultOff.has(key)
        const m = meta[f.hashes.sha1]
        return {
          key,
          path: f.path,
          fileName: path.basename(f.path),
          sha1: f.hashes.sha1,
          size: f.fileSize,
          side: fileSide(f),
          optional,
          defaultEnabled,
          enabled: !optional || (choices[key] ?? defaultEnabled),
          title: m?.title,
          description: m?.description,
          iconUrl: m?.iconUrl,
          slug: m?.slug,
          versionNumber: m?.versionNumber
        }
      })
      .sort((a, b) => (a.title ?? a.fileName).localeCompare(b.title ?? b.fileName))
  }

  /** Modrinth metadata, cached per file hash so the Mods page loads instantly next time. */
  private async modMeta(hashes: string[]): Promise<Record<string, ModMeta>> {
    const cache = (await readJson<Record<string, ModMeta | null>>(this.paths.modMeta)) ?? {}
    const missing = hashes.filter((h) => !(h in cache))
    if (missing.length > 0) {
      try {
        const found = await lookupBySha1(missing)
        for (const h of missing) cache[h] = found[h] ?? null
        await writeJson(this.paths.modMeta, cache)
      } catch (e) {
        log('Modrinth lookup failed:', (e as Error).message)
      }
    }
    const out: Record<string, ModMeta> = {}
    for (const h of hashes) if (cache[h]) out[h] = cache[h]!
    return out
  }

  // ------------------------------------------------------------------ accounts

  /** Your own Azure app once brand.json has its client ID, otherwise Microsoft's shared Minecraft sign-in. */
  private signInFlow(): SignInFlow {
    return brand.microsoft.clientId.trim() ? 'azure' : 'live'
  }

  async login(): Promise<AccountInfo> {
    const flow = this.signInFlow()
    try {
      const ms = flow === 'azure' ? await this.azureSignIn() : await this.liveSignIn()
      const session = await loginMinecraft(ms.accessToken, flow)
      await this.accounts.save({
        type: 'msa',
        flow,
        profile: session.profile,
        msRefreshToken: ms.refreshToken,
        mcAccessToken: session.accessToken,
        mcExpiresAt: session.expiresAt
      })
      log(`Signed in as ${session.profile.name} (${flow})`)
      const info = this.accounts.info()
      this.emit('account', info)
      return info!
    } catch (e) {
      if (e instanceof CancelledError) throw new UserError('Sign-in was cancelled.')
      if (e instanceof AuthError) throw new UserError(e.message)
      throw e
    }
  }

  private async azureSignIn(): Promise<MicrosoftTokens> {
    const { clientId, redirectUri } = brand.microsoft
    const { code, verifier } = await interactiveMicrosoftLogin(this.getWindow(), clientId, redirectUri)
    return exchangeAuthCode(clientId, redirectUri, code, verifier)
  }

  /** Device code: the player approves in their own browser (already signed in to Microsoft there, usually). */
  private async liveSignIn(): Promise<MicrosoftTokens> {
    this.loginAbort?.abort()
    const abort = new AbortController()
    this.loginAbort = abort
    try {
      const code = await requestDeviceCode()
      this.emit('loginCode', { userCode: code.userCode, url: code.verificationUriComplete, expiresAt: code.expiresAt })
      void shell.openExternal(code.verificationUriComplete)
      return await waitForDeviceCode(code, abort.signal)
    } finally {
      if (this.loginAbort === abort) this.loginAbort = null
      this.emit('loginCode', null)
    }
  }

  cancelLogin(): void {
    this.loginAbort?.abort()
  }

  /** Dev builds only: an offline profile for testing singleplayer or an offline-mode test server. */
  async loginOffline(name: string): Promise<AccountInfo> {
    if (!isDev) throw new UserError('Offline accounts are only available in development builds.')
    const clean = name.trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(clean)) throw new UserError('Use 3–16 letters, numbers or underscores.')
    await this.accounts.save({ type: 'offline', profile: { id: offlineUuid(clean), name: clean } })
    const info = this.accounts.info()
    this.emit('account', info)
    return info!
  }

  async logout(): Promise<void> {
    await this.accounts.save(null)
    this.emit('account', null)
  }

  /** A Minecraft access token that's valid for at least a few more minutes. */
  private async session(): Promise<LaunchAccount> {
    const account = this.accounts.load()
    if (!account) throw new UserError('Sign in with your Microsoft account to play.')
    if (account.type === 'offline') {
      if (!isDev) throw new UserError('Offline accounts are only available in development builds.')
      return { name: account.profile.name, uuid: account.profile.id, accessToken: '0', userType: 'legacy' }
    }
    if (account.mcAccessToken && (account.mcExpiresAt ?? 0) > Date.now() + 5 * 60_000) {
      return { name: account.profile.name, uuid: account.profile.id, accessToken: account.mcAccessToken, userType: 'msa' }
    }
    const flow = account.flow ?? 'azure'
    if (!account.msRefreshToken || (flow === 'azure' && !brand.microsoft.clientId.trim())) {
      await this.logout()
      throw new UserError('Please sign in again.')
    }
    try {
      const ms =
        flow === 'live' ? await refreshLiveToken(account.msRefreshToken) : await refreshMicrosoftToken(brand.microsoft.clientId, account.msRefreshToken)
      const session = await loginMinecraft(ms.accessToken, flow)
      await this.accounts.save({
        type: 'msa',
        flow,
        profile: session.profile,
        msRefreshToken: ms.refreshToken,
        mcAccessToken: session.accessToken,
        mcExpiresAt: session.expiresAt
      })
      if (session.profile.name !== account.profile.name) this.emit('account', this.accounts.info())
      return { name: session.profile.name, uuid: session.profile.id, accessToken: session.accessToken, userType: 'msa' }
    } catch (e) {
      if (e instanceof AuthError && e.code === 'MS_REAUTH') {
        await this.logout()
        throw new UserError('Your sign-in expired. Please sign in again.')
      }
      if (e instanceof AuthError) throw new UserError(e.message)
      throw e
    }
  }

  // ------------------------------------------------------------------ play

  async play(options: { repair?: boolean } = {}): Promise<void> {
    if (this.status.state === 'preparing' || this.status.state === 'running') return
    const abort = new AbortController()
    this.abort = abort
    this.setStatus({ state: 'preparing' })
    const verify = options.repair ? 'full' : 'fast'
    const onProgress = (p: ProgressInfo): void => this.progress(p)

    try {
      this.progress({ stage: 'auth', label: 'Signing in' })
      const account = await this.session()

      this.progress({ stage: 'feed', label: 'Checking for updates' })
      const { feed, fresh } = await this.refreshFeed()
      const previous = await readJson<PackState>(this.paths.packState)
      let packData: Buffer
      let packSha1: string
      if (feed && fresh) {
        if (feed.minLauncherVersion && compareVersions(app.getVersion(), feed.minLauncherVersion) < 0) {
          throw new UserError(`The server needs launcher version ${feed.minLauncherVersion} or newer. Restart the launcher to update it.`)
        }
        this.progress({ stage: 'pack', label: 'Downloading modpack' })
        packData = (await obtainMrpack(feed, feedUrl(), this.paths.cache, abort.signal)).data
        packSha1 = feed.pack.sha1
      } else {
        const cached = previous ? await cachedMrpack(this.paths.cache, previous.packSha1) : null
        if (!previous || !cached) throw new UserError("Can't reach the update server and the pack isn't installed yet. Check your internet connection.")
        this.toast('warn', "Couldn't reach the update server. Launching the version you already have.")
        packData = cached
        packSha1 = previous.packSha1
      }

      const pack = parseMrpack(packData)
      const target = resolveGameTarget(pack.index.dependencies)
      const settings = this.settings.get()
      const sync = await syncPack({
        instanceDir: this.paths.instance,
        pack,
        packSha1,
        previous,
        disabledOptional: disabledOptionalPaths(pack.index, settings.optionalChoices, new Set(feed?.optionalDefaultOff ?? [])),
        strictMods: feed?.strictMods ?? true,
        verify,
        signal: abort.signal,
        onProgress,
        log
      })
      await writeJson(this.paths.packState, sync.state)
      const appliedShaders = await applyShaderPreset(this.paths.instance, feed, settings, log)
      if (appliedShaders !== settings.appliedShaderPreset) await this.settings.update({ appliedShaderPreset: appliedShaders })
      if (sync.quarantined.length > 0) {
        this.toast('info', `Moved ${sync.quarantined.length} mod(s) that aren't part of the pack into mods-disabled.`)
      }
      if (previous && previous.packVersion !== sync.state.packVersion) {
        this.toast('info', `Updated the pack to ${sync.state.packVersion}.`)
      }

      const game = await installGame({
        mcDir: this.paths.mc,
        runtimeDir: this.paths.runtime,
        cacheDir: this.paths.cache,
        target,
        verify,
        javaOverride: settings.javaPath || undefined,
        signal: abort.signal,
        onProgress,
        log
      })

      const server = feed?.server
      if (server) await this.ensureServerListed(server.name ?? feed.name, server.address, server.port)
      const join = feed && settings.autoJoin ? await this.resolveServer(feed) : null
      if (join?.localStatus) log('This PC is running the server; joining it at localhost')

      this.progress({ stage: 'launch', label: 'Starting Minecraft' })
      if (abort.signal.aborted) throw new CancelledError()
      const handle = await launchMinecraft({
        mcDir: this.paths.mc,
        instanceDir: this.paths.instance,
        versionId: game.versionId,
        javaPath: game.java.javaw,
        account,
        memoryMB: settings.memoryMB,
        resolution: { width: settings.width, height: settings.height, fullscreen: settings.fullscreen },
        server: join ? { host: join.host, port: join.port } : undefined,
        extraJvmArgs: [...(feed?.jvmArgs ?? []), ...splitArgs(settings.jvmArgs)],
        launcherName: brand.name,
        launcherVersion: app.getVersion()
      })
      this.watchGame(handle, settings.afterLaunch)
      this.progress(null)
      this.setStatus({ state: 'running', since: Date.now() })
      log(`Launched ${game.versionId} (pid ${handle.process.pid})`)
    } catch (e) {
      this.progress(null)
      this.setStatus({ state: 'idle' })
      if (e instanceof CancelledError || abort.signal.aborted) {
        log('Launch cancelled')
        return
      }
      log('Launch failed:', e)
      throw e
    } finally {
      if (this.abort === abort) this.abort = null
    }
  }

  private watchGame(handle: GameHandle, afterLaunch: AfterLaunch): void {
    this.game = handle
    this.stopRequested = false
    handle.onReady(() => {
      const win = this.getWindow()
      if (afterLaunch === 'minimize') win?.minimize()
      else if (afterLaunch === 'close') app.quit()
    })
    handle.onExit(({ code, crashReport, tail }) => {
      this.game = null
      const win = this.getWindow()
      if (win?.isMinimized()) win.restore()
      log(`Game exited with code ${code}`)
      if (code === 0 || this.stopRequested) this.setStatus({ state: 'idle' })
      else this.setStatus({ state: 'crashed', code, crashReport, tail: tail.slice(-40) })
    })
  }

  cancel(): void {
    this.abort?.abort()
  }

  stopGame(): void {
    if (!this.game) return
    this.stopRequested = true
    this.game.process.kill()
  }

  /** Add the SMP to the Multiplayer list the first time; after that it's the player's list. */
  private async ensureServerListed(name: string, address: string, port?: number): Promise<void> {
    const file = path.join(this.paths.instance, 'servers.dat')
    if (await exists(file)) return
    await mkdir(this.paths.instance, { recursive: true })
    await writeFileAtomic(file, serversDat([{ name, ip: port ? `${address}:${port}` : address }]))
  }
}

/** Split a JVM argument string on whitespace, keeping "quoted values" together. */
function splitArgs(input: string): string[] {
  return (input.match(/"[^"]*"|\S+/g) ?? []).map((a) => a.replace(/^"(.*)"$/, '$1'))
}
