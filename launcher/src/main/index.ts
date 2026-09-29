import { app, BrowserWindow, ipcMain, Menu, session, shell, type IpcMainInvokeEvent } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { FolderKind, InitialState, Settings } from '../shared/types'
import { setUserAgent } from '../core/http'
import { brand, dataPaths, feedUrl, isDev } from './config'
import { Launcher, UserError } from './controller'
import { initLog, log } from './log'
import { AccountStore, SettingsStore, systemMemoryMB } from './store'
import { initUpdater, type Updater } from './updater'

// Keep all data under %APPDATA%/<name> regardless of how the exe is named. Dev builds can point
// LAUNCHER_DATA_DIR elsewhere to run a separate copy next to an installed launcher (whose
// single-instance lock would otherwise close the dev copy straight away).
app.setName(brand.name)
const devDataDir = isDev ? process.env.LAUNCHER_DATA_DIR : undefined
app.setPath('userData', devDataDir ? path.resolve(devDataDir) : path.join(app.getPath('appData'), brand.name))
if (process.platform === 'win32') app.setAppUserModelId(brand.appId)

let mainWindow: BrowserWindow | null = null
const BG = '#0f1115'

function send(channel: string, value: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, value)
}

function openExternalSafe(url: string): void {
  try {
    const { protocol } = new URL(url)
    if (protocol === 'https:' || protocol === 'http:') void shell.openExternal(url)
  } catch {
    // not a URL; ignore
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 940,
    minHeight: 600,
    show: false,
    title: brand.name,
    backgroundColor: BG,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : { color: BG, symbolColor: '#9aa3b2', height: 40 },
    icon: isDev ? path.join(__dirname, '../../resources/icon.png') : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: isDev
    }
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault()
      openExternalSafe(url)
    }
  })
  if (isDev && process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  return win
}

/** IPC handlers return {ok,value}|{ok,error} so the renderer sees clean messages instead of Electron's wrapper text. */
function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => Promise<R> | R): void {
  ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return { ok: false, error: 'Unknown sender' }
    try {
      return { ok: true, value: await fn(...(args as A)) }
    } catch (e) {
      const message = e instanceof UserError ? e.message : e instanceof Error ? e.message : String(e)
      if (!(e instanceof UserError)) log(`IPC ${channel} failed:`, e)
      return { ok: false, error: message }
    }
  })
}

async function main(): Promise<void> {
  await app.whenReady()
  const paths = dataPaths()
  initLog(paths.logs)
  log(`Starting ${brand.name} ${app.getVersion()} — feed ${feedUrl()}${isDev ? ' (dev)' : ''}`)
  setUserAgent(`${brand.appId}/${app.getVersion()}${brand.contact ? ` (${brand.contact})` : ''}`)
  Menu.setApplicationMenu(null)
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))

  const firstRun = !existsSync(paths.settings)
  const settings = new SettingsStore(paths.settings)
  const accounts = new AccountStore(paths.account)
  // Offline profiles exist only for development; never carry one into a release build.
  if (!isDev && accounts.load()?.type === 'offline') await accounts.save(null)
  const launcher = new Launcher(paths, settings, accounts, () => mainWindow)
  launcher.on('progress', (p) => send('progress', p))
  launcher.on('status', (s) => send('status', s))
  launcher.on('toast', (t) => send('toast', t))
  launcher.on('account', (a) => send('account', a))
  launcher.on('loginCode', (c) => send('loginCode', c))

  const folders: Record<FolderKind, string> = {
    game: paths.instance,
    mods: path.join(paths.instance, 'mods'),
    logs: path.join(paths.instance, 'logs'),
    'crash-reports': path.join(paths.instance, 'crash-reports'),
    screenshots: path.join(paths.instance, 'screenshots'),
    data: paths.root
  }

  let updater: Updater | null = null
  handle('state:initial', async (): Promise<InitialState> => ({
    brand: { name: brand.name, shortName: brand.shortName, version: app.getVersion(), dev: isDev },
    settings: settings.get(),
    account: accounts.info(),
    systemMemoryMB: systemMemoryMB(),
    installed: await launcher.installedSummary(),
    dataDir: paths.root
  }))
  handle('feed:get', (force?: boolean) => launcher.getFeed(Boolean(force)))
  handle('server:status', () => launcher.getServerStatus())
  handle('mods:list', () => launcher.getMods())
  handle('mods:setOptional', (key: string, enabled: boolean) =>
    settings.update({ optionalChoices: { ...settings.get().optionalChoices, [String(key)]: Boolean(enabled) } })
  )
  handle('settings:update', (patch: Partial<Settings>) => settings.update(patch ?? {}))
  handle('account:login', () => launcher.login())
  handle('account:cancelLogin', () => launcher.cancelLogin())
  handle('account:loginOffline', (name: string) => launcher.loginOffline(String(name ?? '')))
  handle('account:logout', () => launcher.logout())
  handle('game:play', (options?: { repair?: boolean }) => launcher.play({ repair: Boolean(options?.repair) }))
  handle('game:cancel', () => launcher.cancel())
  handle('game:stop', () => launcher.stopGame())
  handle('shell:openFolder', async (kind: FolderKind) => {
    const dir = folders[kind]
    if (!dir) throw new UserError('Unknown folder')
    await mkdir(dir, { recursive: true })
    const error = await shell.openPath(dir)
    if (error) throw new UserError(error)
  })
  handle('shell:openExternal', (url: string) => openExternalSafe(String(url)))
  handle('update:install', () => updater?.install())

  mainWindow = createWindow()
  mainWindow.webContents.on('did-finish-load', () => {
    if (updater) send('update', updater.status())
    send('status', launcher.getStatus())
  })
  updater = initUpdater((s) => send('update', s))

  // Apply the admin's recommended memory the very first time the launcher runs.
  void launcher.getFeed().then((feed) => settings.applyRecommendedMemory(feed?.recommendedMemoryMB, firstRun))

  app.on('before-quit', () => launcher.cancel())
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.on('window-all-closed', () => app.quit())
  main().catch((e) => {
    log('Fatal startup error:', e)
    app.exit(1)
  })
}
