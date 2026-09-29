import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { once } from 'node:events'
import path from 'node:path'
import { CancelledError, getUserAgent, HttpError, sleep, throwIfAborted } from './http'
import { hashFile, mapLimit, renameWithRetry, statOrNull } from './fsutil'

export interface DownloadItem {
  /** Mirrors to try, in order. */
  urls: string[]
  dest: string
  size?: number
  sha1?: string
  sha512?: string
  /** Shown in progress output. */
  name?: string
}

export interface DownloadProgress {
  doneBytes: number
  totalBytes: number
  doneFiles: number
  totalFiles: number
  current?: string
}

export interface DownloadOptions {
  concurrency?: number
  retries?: number
  signal?: AbortSignal
  onProgress?: (p: DownloadProgress) => void
  /** Abort a transfer that receives no data for this long. */
  idleTimeoutMs?: number
}

export class DownloadError extends Error {
  constructor(readonly failures: { item: DownloadItem; error: unknown }[]) {
    const first = failures[0]
    const reason = first.error instanceof Error ? first.error.message : String(first.error)
    super(
      failures.length === 1
        ? `Failed to download ${first.item.name ?? path.basename(first.item.dest)}: ${reason}`
        : `Failed to download ${failures.length} files (first: ${first.item.name ?? path.basename(first.item.dest)}: ${reason})`
    )
    this.name = 'DownloadError'
  }
}

class ChecksumError extends Error {
  constructor(name: string, expected: string, actual: string) {
    super(`Checksum mismatch for ${name} (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`)
    this.name = 'ChecksumError'
  }
}

export type VerifyMode = 'size' | 'hash'

/** True when the file at item.dest is missing or doesn't match what we expect. */
export async function needsDownload(item: DownloadItem, verify: VerifyMode): Promise<boolean> {
  const st = await statOrNull(item.dest)
  if (!st || !st.isFile()) return true
  const sizeKnown = item.size !== undefined && item.size >= 0
  if (sizeKnown && st.size !== item.size) return true
  // Without a known size the cheap check proves nothing, so fall back to the hash.
  if (verify === 'hash' || !sizeKnown) {
    if (item.sha1) return (await hashFile(item.dest, 'sha1')) !== item.sha1.toLowerCase()
    if (item.sha512) return (await hashFile(item.dest, 'sha512')) !== item.sha512.toLowerCase()
  }
  return false
}

export async function filterNeedsDownload(
  items: DownloadItem[],
  verify: VerifyMode,
  onChecked?: (done: number, total: number) => void
): Promise<DownloadItem[]> {
  let done = 0
  const flags = await mapLimit(items, 32, async (item) => {
    const result = await needsDownload(item, verify)
    onChecked?.(++done, items.length)
    return result
  })
  return items.filter((_, i) => flags[i])
}

/** Remove duplicate destinations (the same library can be listed by several version jsons). */
export function dedupeByDest(items: DownloadItem[]): DownloadItem[] {
  const seen = new Map<string, DownloadItem>()
  for (const item of items) {
    const key = path.resolve(item.dest).toLowerCase()
    if (!seen.has(key)) seen.set(key, item)
  }
  return [...seen.values()]
}

export async function downloadAll(items: DownloadItem[], opts: DownloadOptions = {}): Promise<void> {
  const { concurrency = 12, retries = 3, signal, onProgress, idleTimeoutMs = 30_000 } = opts
  const progress: DownloadProgress = {
    doneBytes: 0,
    totalBytes: items.reduce((sum, i) => sum + (i.size && i.size > 0 ? i.size : 0), 0),
    doneFiles: 0,
    totalFiles: items.length
  }
  let lastEmit = 0
  const emit = (force = false): void => {
    const now = Date.now()
    if (!onProgress || (!force && now - lastEmit < 100)) return
    lastEmit = now
    onProgress({ ...progress, totalBytes: Math.max(progress.totalBytes, progress.doneBytes) })
  }
  emit(true)
  if (items.length === 0) return

  const failures: { item: DownloadItem; error: unknown }[] = []
  const queue = items.slice()
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      throwIfAborted(signal)
      const item = queue.shift()!
      progress.current = item.name ?? path.basename(item.dest)
      try {
        await downloadWithRetry(item, retries, idleTimeoutMs, signal, (n) => {
          progress.doneBytes += n
          emit()
        })
        progress.doneFiles++
        emit()
      } catch (error) {
        if (signal?.aborted) throw new CancelledError()
        failures.push({ item, error })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  emit(true)
  if (failures.length > 0) throw new DownloadError(failures)
}

async function downloadWithRetry(
  item: DownloadItem,
  retries: number,
  idleTimeoutMs: number,
  signal: AbortSignal | undefined,
  onBytes: (n: number) => void
): Promise<void> {
  if (item.urls.length === 0) throw new Error('no download URL')
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    throwIfAborted(signal)
    const url = item.urls[attempt % item.urls.length]
    let received = 0
    try {
      await downloadOnce(url, item, idleTimeoutMs, signal, (n) => {
        received += n
        onBytes(n)
      })
      return
    } catch (e) {
      onBytes(-received) // roll the progress bar back for the failed attempt
      if (signal?.aborted) throw new CancelledError()
      lastError = e
      // A 404 won't fix itself on the same mirror; move on without waiting.
      if (!(e instanceof HttpError && e.status === 404)) await sleep(400 * 2 ** attempt, signal)
    }
  }
  throw lastError
}

async function downloadOnce(
  url: string,
  item: DownloadItem,
  idleTimeoutMs: number,
  signal: AbortSignal | undefined,
  onBytes: (n: number) => void
): Promise<void> {
  const name = item.name ?? path.basename(item.dest)
  await mkdir(path.dirname(item.dest), { recursive: true })
  const tmp = `${item.dest}.${Math.random().toString(36).slice(2, 8)}.part`

  const idle = new AbortController()
  let idleTimer: NodeJS.Timeout | undefined
  const armIdle = (): void => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => idle.abort(new Error(`No data received for ${idleTimeoutMs / 1000}s`)), idleTimeoutMs)
  }
  armIdle()

  const sha1 = createHash('sha1')
  const sha512 = item.sha512 ? createHash('sha512') : null
  let written = 0
  const out = createWriteStream(tmp)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': getUserAgent() },
      signal: signal ? AbortSignal.any([signal, idle.signal]) : idle.signal
    })
    if (!res.ok || !res.body) {
      await res.body?.cancel().catch(() => {})
      throw new HttpError(url, res.status, '')
    }
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      armIdle()
      sha1.update(value)
      sha512?.update(value)
      written += value.length
      onBytes(value.length)
      if (!out.write(value)) await once(out, 'drain')
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
  } catch (e) {
    out.destroy()
    await rm(tmp, { force: true })
    throw e
  } finally {
    clearTimeout(idleTimer)
  }

  try {
    if (item.size !== undefined && item.size >= 0 && written !== item.size) {
      throw new Error(`Size mismatch for ${name} (expected ${item.size} bytes, got ${written})`)
    }
    const gotSha1 = sha1.digest('hex')
    if (item.sha1 && gotSha1 !== item.sha1.toLowerCase()) throw new ChecksumError(name, item.sha1, gotSha1)
    if (sha512 && item.sha512) {
      const got = sha512.digest('hex')
      if (got !== item.sha512.toLowerCase()) throw new ChecksumError(name, item.sha512, got)
    }
    await renameWithRetry(tmp, item.dest)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
}
