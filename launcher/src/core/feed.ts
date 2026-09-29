// Fetches launcher.json and the .mrpack it points to (cached by sha1).

import { readdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import type { LauncherFeed } from '../shared/types'
import { downloadAll } from './download'
import { hashBuffer, statOrNull } from './fsutil'
import { getJson, withRetry } from './http'

export function validateFeed(value: unknown): LauncherFeed {
  const feed = value as LauncherFeed
  if (!feed || typeof feed !== 'object') throw new Error('launcher.json is not an object')
  if (feed.schema !== 1) throw new Error(`launcher.json schema ${String(feed.schema)} is not supported by this launcher version`)
  if (!feed.server?.address) throw new Error('launcher.json is missing server.address')
  if (!feed.pack?.url || !/^[0-9a-f]{40}$/i.test(feed.pack.sha1 ?? '')) throw new Error('launcher.json is missing pack.url or pack.sha1')
  feed.pack.sha1 = feed.pack.sha1.toLowerCase()
  return feed
}

export async function fetchFeed(url: string, signal?: AbortSignal): Promise<LauncherFeed> {
  // Static hosts (GitHub Pages, Cloudflare) cache files for minutes; a unique query string
  // makes sure players see a new pack as soon as it's published.
  const fresh = new URL(url)
  fresh.searchParams.set('t', Date.now().toString(36))
  return validateFeed(await withRetry(() => getJson<unknown>(fresh.toString(), { signal, timeoutMs: 15_000 }), { signal }))
}

/** pack.url may be relative to launcher.json. */
export function resolvePackUrl(feed: LauncherFeed, feedUrl: string): string {
  return new URL(feed.pack.url, feedUrl).toString()
}

export interface MrpackFileResult {
  data: Buffer
  path: string
}

/** Returns the pack bytes, downloading only when the cached copy is missing or stale. */
export async function obtainMrpack(feed: LauncherFeed, feedUrl: string, cacheDir: string, signal?: AbortSignal): Promise<MrpackFileResult> {
  const dir = path.join(cacheDir, 'packs')
  const file = path.join(dir, `${feed.pack.sha1}.mrpack`)
  const cached = await statOrNull(file)
  if (cached?.isFile()) {
    const data = await readFile(file)
    if (hashBuffer(data) === feed.pack.sha1) return { data, path: file }
  }
  await downloadAll([{ urls: [resolvePackUrl(feed, feedUrl)], dest: file, sha1: feed.pack.sha1, size: feed.pack.size, name: 'modpack' }], { signal })
  await pruneOldPacks(dir, file)
  return { data: await readFile(file), path: file }
}

/** The most recently used cached pack, for when launcher.json can't be reached. */
export async function cachedMrpack(cacheDir: string, sha1: string): Promise<Buffer | null> {
  try {
    const data = await readFile(path.join(cacheDir, 'packs', `${sha1}.mrpack`))
    return hashBuffer(data) === sha1 ? data : null
  } catch {
    return null
  }
}

async function pruneOldPacks(dir: string, keep: string): Promise<void> {
  const entries = await readdir(dir).catch(() => [] as string[])
  const packs = await Promise.all(
    entries.filter((f) => f.endsWith('.mrpack')).map(async (f) => ({ f, mtime: (await stat(path.join(dir, f))).mtimeMs }))
  )
  const stale = packs.filter((p) => path.join(dir, p.f) !== keep).sort((a, b) => b.mtime - a.mtime).slice(2)
  for (const p of stale) await rm(path.join(dir, p.f), { force: true })
}

/** Loose semver comparison: returns <0, 0, >0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  const pb = b.split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}
