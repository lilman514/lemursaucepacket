import { createHash } from 'node:crypto'
import { createReadStream, type Stats } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type HashAlgorithm = 'sha1' | 'sha512'

export function hashFile(file: string, algorithm: HashAlgorithm = 'sha1'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm)
    const stream = createReadStream(file)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export function hashBuffer(data: Uint8Array, algorithm: HashAlgorithm = 'sha1'): string {
  return createHash(algorithm).update(data).digest('hex')
}

export class UnsafePathError extends Error {
  constructor(readonly relativePath: string) {
    super(`Refusing to write outside the game folder: "${relativePath}"`)
    this.name = 'UnsafePathError'
  }
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i

/** Normalise a pack-relative path ("mods/x.jar") and reject anything that could escape the root. */
export function normalizeRelative(rel: string): string {
  if (typeof rel !== 'string' || rel.length === 0 || rel.length > 400) throw new UnsafePathError(String(rel))
  const unified = rel.replace(/\\/g, '/')
  if (unified.startsWith('/') || /^[a-zA-Z]:/.test(unified) || unified.includes('\0')) throw new UnsafePathError(rel)
  const segments = unified.split('/').filter((s) => s !== '' && s !== '.')
  if (segments.length === 0) throw new UnsafePathError(rel)
  for (const seg of segments) {
    if (seg === '..' || seg.includes(':') || WINDOWS_RESERVED.test(seg) || /[<>"|?*]/.test(seg)) {
      throw new UnsafePathError(rel)
    }
  }
  return segments.join('/')
}

/** Resolve a pack-relative path inside `root`, guaranteeing the result stays inside it. */
export function safeJoin(root: string, rel: string): string {
  const normalized = normalizeRelative(rel)
  const base = path.resolve(root)
  const prefix = base.endsWith(path.sep) ? base : base + path.sep
  const resolved = path.resolve(base, ...normalized.split('/'))
  if (!resolved.startsWith(prefix)) throw new UnsafePathError(rel)
  return resolved
}

export async function statOrNull(file: string): Promise<Stats | null> {
  try {
    return await stat(file)
  } catch {
    return null
  }
}

export async function exists(file: string): Promise<boolean> {
  return (await statOrNull(file)) !== null
}

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

/** Rename, retrying briefly because antivirus scanners on Windows like to hold fresh files open. */
export async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(from, to)
      return
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY')) throw e
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)))
    }
  }
}

export async function writeFileAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(tmp, data)
    await renameWithRetry(tmp, file)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  await writeFileAtomic(file, JSON.stringify(data, null, 2))
}

/** Run `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}
