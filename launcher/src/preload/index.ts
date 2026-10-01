import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { LauncherApi } from '../shared/types'

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (!result.ok) throw new Error(result.error)
  return result.value
}

function subscribe<T>(channel: string, cb: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: LauncherApi = {
  getInitialState: () => call('state:initial'),
  getFeed: (force) => call('feed:get', force),
  getServerStatus: () => call('server:status'),
  getMods: () => call('mods:list'),
  setOptionalMod: (path, enabled) => call('mods:setOptional', path, enabled),
  setShaderPreset: (id) => call('shaders:set', id),
  updateSettings: (patch) => call('settings:update', patch),
  login: () => call('account:login'),
  cancelLogin: () => call('account:cancelLogin'),
  loginOffline: (name) => call('account:loginOffline', name),
  logout: () => call('account:logout'),
  // Only plain data can cross IPC ("An object could not be cloned" otherwise), so rebuild the options.
  play: (options) => call('game:play', { repair: options?.repair === true }),
  cancel: () => call('game:cancel'),
  stopGame: () => call('game:stop'),
  openFolder: (kind) => call('shell:openFolder', kind),
  openExternal: (url) => call('shell:openExternal', url),
  installUpdate: () => call('update:install'),
  onProgress: (cb) => subscribe('progress', cb),
  onGameStatus: (cb) => subscribe('status', cb),
  onUpdateStatus: (cb) => subscribe('update', cb),
  onToast: (cb) => subscribe('toast', cb),
  onAccount: (cb) => subscribe('account', cb),
  onLoginCode: (cb) => subscribe('loginCode', cb)
}

contextBridge.exposeInMainWorld('launcher', api)
