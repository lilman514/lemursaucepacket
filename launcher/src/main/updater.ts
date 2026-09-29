// Self-update from GitHub Releases (configured in brand.json → updates).

import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'
import { updatesConfigured } from './config'
import { log } from './log'

export interface Updater {
  status(): UpdateStatus
  install(): void
}

export function initUpdater(emit: (s: UpdateStatus) => void): Updater {
  let current: UpdateStatus = { state: 'disabled' }
  const set = (s: UpdateStatus): void => {
    current = s
    emit(s)
  }
  if (!app.isPackaged || !updatesConfigured()) {
    return { status: () => current, install: () => {} }
  }

  autoUpdater.logger = { info: (m: unknown) => log('[updater]', m), warn: (m: unknown) => log('[updater]', m), error: (m: unknown) => log('[updater]', m), debug: () => {} }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => set({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => set({ state: 'idle' }))
  autoUpdater.on('update-available', (info) => set({ state: 'available', version: info.version }))
  autoUpdater.on('download-progress', (p) => set({ state: 'downloading', version: current.version, percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (e) => set({ state: 'error', error: e.message }))

  const check = (): void => {
    autoUpdater.checkForUpdates().catch((e: Error) => log('Update check failed:', e.message))
  }
  check()
  setInterval(check, 4 * 60 * 60 * 1000)

  return { status: () => current, install: () => autoUpdater.quitAndInstall(false, true) }
}
