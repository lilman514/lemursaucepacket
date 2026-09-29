// Brings the player's game folder in line with the pack: downloads new/changed mods, removes
// ones the admin dropped, applies config overrides, and (optionally) quarantines stray jars.

import { mkdir, readdir, rename, rm, rmdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { LoaderId, ProgressInfo } from '../shared/types'
import { dedupeByDest, downloadAll, type DownloadItem } from './download'
import { hashBuffer, hashFile, mapLimit, safeJoin, statOrNull, writeFileAtomic } from './fsutil'
import { resolveGameTarget, sideFiles, type PackSide, type ParsedMrpack } from './mrpack'
import { throwIfAborted } from './http'

export interface ManagedFile {
  sha1: string
  size: number
  mtimeMs: number
}

/** What the launcher last installed. Stored next to the instance so a repair can compare against it. */
export interface PackState {
  schema: 1
  name: string
  packVersion: string
  packSha1: string
  minecraft: string
  loader: LoaderId
  loaderVersion?: string
  /** Files the launcher owns (downloaded mods + override files inside mods/ etc.). */
  files: Record<string, ManagedFile>
  /** sha1 of each override file as shipped in the pack the last time we applied it. */
  overrides: Record<string, string>
}

export interface SyncOptions {
  instanceDir: string
  /** Which env flags to honour (default client). The pack must have been parsed for the same side. */
  side?: PackSide
  pack: ParsedMrpack
  packSha1: string
  previous: PackState | null
  disabledOptional: ReadonlySet<string>
  strictMods: boolean
  /** 'fast' trusts files whose size+mtime match the last sync; 'full' re-hashes everything. */
  verify: 'fast' | 'full'
  signal?: AbortSignal
  onProgress?: (p: ProgressInfo) => void
  log?: (line: string) => void
}

export interface SyncResult {
  state: PackState
  downloaded: string[]
  removed: string[]
  quarantined: string[]
}

/** Written once and then left to the player (keybinds, video settings, their server list). */
const PRESERVE_IF_EXISTS = new Set(['options.txt', 'optionsof.txt', 'optionsshaders.txt', 'servers.dat'])

/** Content folders where a file the pack no longer lists must go away. */
const MANAGED_DIRS = ['mods/', 'resourcepacks/', 'shaderpacks/']
const isManagedPath = (rel: string): boolean => MANAGED_DIRS.some((d) => rel.startsWith(d))

export async function syncPack(o: SyncOptions): Promise<SyncResult> {
  const log = o.log ?? (() => {})
  const progress = o.onProgress ?? (() => {})
  const { index, overrides } = o.pack
  const prev = o.previous?.packSha1 ? o.previous : null
  const target = resolveGameTarget(index.dependencies)

  // 1. Work out which pack files are missing or changed.
  const wanted = sideFiles(index, o.side ?? 'client', o.disabledOptional)
  const files: Record<string, ManagedFile> = {}
  const toDownload: { key: string; item: DownloadItem }[] = []
  let checked = 0
  progress({ stage: 'mods', label: 'Checking mods', current: 0, total: wanted.length, unit: 'files' })

  await mapLimit(wanted, 16, async (f) => {
    throwIfAborted(o.signal)
    const dest = safeJoin(o.instanceDir, f.path)
    const st = await statOrNull(dest)
    const known = prev?.files[f.path]
    let ok = false
    if (st?.isFile() && st.size === f.fileSize) {
      if (o.verify === 'fast' && known && known.sha1 === f.hashes.sha1 && known.size === st.size && known.mtimeMs === st.mtimeMs) {
        ok = true
      } else {
        ok = (await hashFile(dest, 'sha1')) === f.hashes.sha1
      }
    }
    if (ok && st) {
      files[f.path] = { sha1: f.hashes.sha1, size: st.size, mtimeMs: st.mtimeMs }
    } else {
      toDownload.push({
        key: f.path,
        item: { urls: f.downloads, dest, size: f.fileSize, sha1: f.hashes.sha1, sha512: f.hashes.sha512, name: path.basename(f.path) }
      })
    }
    progress({ stage: 'mods', label: 'Checking mods', current: ++checked, total: wanted.length, unit: 'files' })
  })

  // 2. Download them.
  if (toDownload.length > 0) {
    log(`Downloading ${toDownload.length} pack file(s)`)
    await downloadAll(dedupeByDest(toDownload.map((d) => d.item)), {
      signal: o.signal,
      onProgress: (p) =>
        progress({
          stage: 'mods',
          label: `Downloading mods (${p.doneFiles}/${p.totalFiles})`,
          detail: p.current,
          current: p.doneBytes,
          total: p.totalBytes,
          unit: 'bytes'
        })
    })
    for (const { key, item } of toDownload) {
      const st = await stat(item.dest)
      files[key] = { sha1: item.sha1!, size: st.size, mtimeMs: st.mtimeMs }
    }
  }

  // 3. Overrides (configs, bundled files). Re-apply a file only when the pack's copy changed,
  //    so tweaks a player made to a config survive until the admin ships a new version of it.
  progress({ stage: 'pack', label: 'Applying configs' })
  const appliedOverrides: Record<string, string> = {}
  for (const [rel, content] of overrides) {
    throwIfAborted(o.signal)
    const dest = safeJoin(o.instanceDir, rel)
    const sha = hashBuffer(content)
    appliedOverrides[rel] = sha
    const managed = isManagedPath(rel)
    const st = await statOrNull(dest)
    if (st?.isFile()) {
      if (PRESERVE_IF_EXISTS.has(rel)) continue
      const unchangedInPack = prev?.overrides[rel] === sha
      const identical = st.size === content.byteLength && (await hashFile(dest, 'sha1')) === sha
      if (identical || (!managed && unchangedInPack)) {
        if (managed) files[rel] = { sha1: sha, size: st.size, mtimeMs: st.mtimeMs }
        continue
      }
    }
    await writeFileAtomic(dest, content)
    if (managed) {
      const written = await stat(dest)
      files[rel] = { sha1: sha, size: written.size, mtimeMs: written.mtimeMs }
    }
  }

  // 4. Delete files we installed earlier that the pack no longer contains (or the player disabled).
  const removed: string[] = []
  for (const rel of Object.keys(prev?.files ?? {})) {
    if (files[rel]) continue
    try {
      await rm(safeJoin(o.instanceDir, rel), { force: true })
      removed.push(rel)
    } catch (e) {
      log(`Could not remove ${rel}: ${(e as Error).message}`)
    }
  }
  // Config/script overrides the pack dropped (a deleted KubeJS script, a renamed quest chapter) go
  // too, but only while they are still exactly what we shipped: someone's edits are left alone.
  for (const [rel, sha] of Object.entries(prev?.overrides ?? {})) {
    if (rel in appliedOverrides || isManagedPath(rel) || PRESERVE_IF_EXISTS.has(rel)) continue
    try {
      const dest = safeJoin(o.instanceDir, rel)
      if (!(await statOrNull(dest))?.isFile() || (await hashFile(dest, 'sha1')) !== sha) continue
      await rm(dest, { force: true })
      removed.push(rel)
      // Tidy folders that only held pack files (rmdir refuses anything non-empty).
      for (let dir = path.dirname(dest); dir.startsWith(path.resolve(o.instanceDir) + path.sep); dir = path.dirname(dir)) {
        if (!(await rmdir(dir).then(() => true, () => false))) break
      }
    } catch (e) {
      log(`Could not remove ${rel}: ${(e as Error).message}`)
    }
  }
  if (removed.length) log(`Removed ${removed.length} file(s) no longer in the pack`)

  // 5. Strict mode: anything else in mods/ is moved aside (never deleted) so the client matches the server.
  const quarantined: string[] = []
  if (o.strictMods) {
    const modsDir = path.join(o.instanceDir, 'mods')
    const entries = await readdir(modsDir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(jar|zip)$/i.test(entry.name)) continue
      if (files[`mods/${entry.name}`]) continue
      const aside = path.join(o.instanceDir, 'mods-disabled')
      await mkdir(aside, { recursive: true })
      let target = path.join(aside, entry.name)
      if (await statOrNull(target)) target = path.join(aside, `${Date.now()}-${entry.name}`)
      await rename(path.join(modsDir, entry.name), target)
      quarantined.push(entry.name)
    }
    if (quarantined.length) log(`Moved ${quarantined.length} unrecognised mod(s) to mods-disabled/`)
  }

  const state: PackState = {
    schema: 1,
    name: index.name,
    packVersion: index.versionId,
    packSha1: o.packSha1,
    minecraft: target.minecraft,
    loader: target.loader,
    loaderVersion: target.loaderVersion,
    files,
    overrides: appliedOverrides
  }
  return { state, downloaded: toDownload.map((d) => d.key), removed, quarantined }
}
