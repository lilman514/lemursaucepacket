import { app } from 'electron'
import path from 'node:path'
import brand from '../../brand.json'

export { brand }

export const isDev = !app.isPackaged

/** LAUNCHER_FEED_URL overrides everything, handy for testing a staging feed. */
export function feedUrl(): string {
  return process.env.LAUNCHER_FEED_URL || (isDev && brand.devFeedUrl ? brand.devFeedUrl : brand.feedUrl)
}

export const updatesConfigured = (): boolean => Boolean(brand.updates.owner && brand.updates.repo)

export interface DataPaths {
  root: string
  mc: string
  runtime: string
  cache: string
  instance: string
  settings: string
  account: string
  packState: string
  feedCache: string
  modMeta: string
  logs: string
}

export function dataPaths(): DataPaths {
  const root = app.getPath('userData')
  return {
    root,
    mc: path.join(root, 'minecraft'),
    runtime: path.join(root, 'runtime'),
    cache: path.join(root, 'cache'),
    instance: path.join(root, 'instance'),
    settings: path.join(root, 'settings.json'),
    account: path.join(root, 'account.json'),
    packState: path.join(root, 'pack-state.json'),
    feedCache: path.join(root, 'cache', 'launcher.json'),
    modMeta: path.join(root, 'cache', 'modrinth-meta.json'),
    logs: path.join(root, 'logs')
  }
}
