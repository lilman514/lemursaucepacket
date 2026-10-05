// Development-only stand-in for the Electron bridge, so the UI can be worked on in a plain browser
// (npm run dev, then open the renderer URL). Never included in production builds.
// Pick a scenario with the URL hash: #signedout, #crashed, #offline

import type { AccountInfo, GameStatus, InitialState, LauncherApi, LauncherFeed, LoginCode, ModEntry, ProgressInfo, Settings, ToastMessage, UpdateStatus } from '../../../shared/types'
import sampleMods from './sampleMods.json'

interface Events {
  progress: ProgressInfo | null
  status: GameStatus
  update: UpdateStatus
  toast: ToastMessage
  account: AccountInfo | null
  loginCode: LoginCode | null
}

export function installMockLauncher(): void {
  const scenario = new Set(location.hash.slice(1).split(','))
  const listeners: { [K in keyof Events]: Set<(value: Events[K]) => void> } = {
    progress: new Set(),
    status: new Set(),
    update: new Set(),
    toast: new Set(),
    account: new Set(),
    loginCode: new Set()
  }
  const emit = <K extends keyof Events>(key: K, value: Events[K]): void => listeners[key].forEach((cb) => cb(value))
  const on =
    <K extends keyof Events>(key: K) =>
    (cb: (value: Events[K]) => void): (() => void) => {
      listeners[key].add(cb)
      return () => listeners[key].delete(cb)
    }
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
  let loginCancelled = false

  let account: AccountInfo | null = scenario.has('signedout') ? null : { name: 'Steve', uuid: '8667ba71b85a4004af54457a9734eed7', type: 'msa' }
  let settings: Settings = { memoryMB: 6144, width: 1280, height: 720, fullscreen: false, afterLaunch: 'minimize', autoJoin: true, javaPath: '', jvmArgs: '', optionalChoices: {}, shaderPreset: '', appliedShaderPreset: '' }
  let cancelled = false

  const feed: LauncherFeed = {
    schema: 1,
    name: 'LemurSaucePacket',
    description: 'Build factories, trains and airships with friends. The launcher keeps your mods in sync with the server automatically.',
    server: { name: 'LemurSaucePacket', address: 'play.example.com' },
    pack: { version: '1.0.1', url: 'packs/lemursaucepacket-1.0.1.mrpack', sha1: '0'.repeat(40), minecraft: '1.21.1', loader: 'neoforge', loaderVersion: '21.1.252', modCount: 13 },
    recommendedMemoryMB: 6144,
    shaderPresets: {
      defaultPreset: 'balanced',
      presets: [
        { id: 'lite', name: 'Lite', file: 'MakeUp-UltraFast.zip', description: 'MakeUp Ultra Fast. Soft lighting, shadows and water for any PC that can run the pack.' },
        { id: 'balanced', name: 'Balanced', file: 'ComplementaryReimagined.zip', description: 'Complementary Reimagined. Keeps the Minecraft look with good shadows, water and sky. Needs a decent graphics card.' },
        { id: 'fancy', name: 'Fancy', file: 'ComplementaryUnbound.zip', description: 'Complementary Unbound. The most realistic lighting, clouds and reflections. For strong graphics cards.' }
      ]
    },
    links: [{ label: 'Discord', url: 'https://discord.gg/your-invite' }],
    news: [
      { title: 'Aeronautics is here', date: '2026-09-26', body: 'Create Aeronautics has been added to the pack. Build airships and fly them around spawn — the launcher already downloaded everything for you.' },
      { title: 'Welcome to LemurSaucePacket', date: '2026-09-20', body: 'Press Play. The launcher downloads Minecraft, NeoForge and every mod for you, keeps them up to date, and drops you straight into the server.' }
    ]
  }

  const init: InitialState = {
    brand: { name: 'LemurSaucePacket Launcher', shortName: 'LemurSaucePacket', version: '0.1.0', dev: true },
    settings,
    account,
    systemMemoryMB: 32768,
    installed: { name: 'LemurSaucePacket', version: '1.0.0', minecraft: '1.21.1', loader: 'neoforge', loaderVersion: '21.1.252', modCount: 13 },
    dataDir: 'C:\\Users\\Steve\\AppData\\Roaming\\LemurSaucePacket Launcher'
  }

  const stages: ProgressInfo[] = [
    { stage: 'feed', label: 'Checking for updates' },
    { stage: 'mods', label: 'Checking mods', current: 13, total: 13, unit: 'files' },
    { stage: 'mods', label: 'Downloading mods (1/2)', detail: 'create-aeronautics-bundled-1.21.1-1.3.2.jar', current: 0, total: 46_109_267, unit: 'bytes' },
    { stage: 'minecraft', label: 'Verifying game files', current: 3960, total: 3960, unit: 'files' },
    { stage: 'loader', label: 'Installing NeoForge', detail: 'binarypatcher: Patching input' },
    { stage: 'launch', label: 'Starting Minecraft' }
  ]

  const api: LauncherApi = {
    getInitialState: async () => ({ ...init, settings, account }),
    getFeed: async () => (scenario.has('offline') ? null : feed),
    getServerStatus: async () => {
      await wait(400)
      return scenario.has('offline')
        ? { online: false, error: 'Server is offline' }
        : { online: true, latencyMs: 38, version: 'NeoForge 1.21.1', players: { online: 7, max: 40, sample: ['Alex', 'Kai', 'Noor', 'Mateo', 'Sam', 'Yuki', 'Jo'] }, motd: 'LemurSaucePacket · Season 3 · Airships allowed!' }
    },
    getMods: async () => {
      await wait(500)
      return (sampleMods as Omit<ModEntry, 'key' | 'defaultEnabled'>[]).map((m) => {
        const key = m.path
        return { ...m, key, defaultEnabled: true, enabled: !m.optional || (settings.optionalChoices[key] ?? true) }
      })
    },
    setOptionalMod: async (key, enabled) => {
      settings = { ...settings, optionalChoices: { ...settings.optionalChoices, [key]: enabled } }
      return settings
    },
    setShaderPreset: async (id) => {
      settings = { ...settings, shaderPreset: id, appliedShaderPreset: '' }
      return settings
    },
    // The mock game has shaders off, with the default pack ready.
    getShaderState: async () =>
      settings.shaderPreset && settings.shaderPreset !== settings.appliedShaderPreset
        ? { active: settings.shaderPreset, pack: null, pending: true }
        : { active: 'off', pack: 'ComplementaryReimagined.zip', pending: false },
    updateSettings: async (patch) => (settings = { ...settings, ...patch }),
    login: async () => {
      // Mirrors the real device-code sign-in: a code appears, then the "browser" approves it.
      loginCancelled = false
      emit('loginCode', { userCode: 'MOCK-CODE', url: 'https://www.microsoft.com/link?otc=MOCK-CODE', expiresAt: Date.now() + 900_000 })
      for (let i = 0; i < 40 && !loginCancelled; i++) await wait(100)
      emit('loginCode', null)
      if (loginCancelled) throw new Error('Sign-in was cancelled.')
      account = { name: 'Steve', uuid: '8667ba71b85a4004af54457a9734eed7', type: 'msa' }
      emit('account', account)
      return account
    },
    cancelLogin: async () => {
      loginCancelled = true
    },
    loginOffline: async (name) => {
      account = { name, uuid: '0'.repeat(32), type: 'offline' }
      emit('account', account)
      return account
    },
    logout: async () => {
      account = null
      emit('account', null)
    },
    play: async () => {
      cancelled = false
      emit('status', { state: 'preparing' })
      for (const s of stages) {
        if (cancelled) break
        if (s.unit === 'bytes' && s.total) {
          for (let b = 0; b <= s.total && !cancelled; b += s.total / 25) {
            emit('progress', { ...s, current: b })
            await wait(80)
          }
        } else {
          emit('progress', s)
          await wait(700)
        }
      }
      emit('progress', null)
      if (cancelled) {
        emit('status', { state: 'idle' })
        return
      }
      if (scenario.has('crashed')) {
        emit('status', { state: 'crashed', code: 1, tail: ['[Render thread/ERROR]: Mixin apply failed', 'java.lang.RuntimeException: example crash', '\tat net.minecraft.client.main.Main.main(Main.java:230)'] })
        return
      }
      emit('status', { state: 'running', since: Date.now() })
      emit('toast', { kind: 'info', text: 'Updated the pack to 1.0.1.' })
    },
    cancel: async () => {
      cancelled = true
    },
    stopGame: async () => emit('status', { state: 'idle' }),
    openFolder: async () => emit('toast', { kind: 'info', text: '(mock) folder opened' }),
    openExternal: async (url) => void window.open(url, '_blank'),
    installUpdate: async () => {},
    onProgress: on('progress'),
    onGameStatus: on('status'),
    onUpdateStatus: on('update'),
    onToast: on('toast'),
    onAccount: on('account'),
    onLoginCode: on('loginCode')
  }
  window.launcher = api
}
