// Installs the same Java runtime the official launcher uses (Mojang's "java-runtime-*" components),
// so players never have to install or pick a Java version themselves.

import { chmod, mkdir, symlink } from 'node:fs/promises'
import path from 'node:path'
import type { ProgressInfo } from '../shared/types'
import { dedupeByDest, downloadAll, filterNeedsDownload, type DownloadItem } from './download'
import { exists, readJson, safeJoin, writeJson } from './fsutil'
import { getJson, withRetry } from './http'

const RUNTIME_INDEX =
  'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'

interface RuntimeTarget {
  manifest: { sha1: string; size: number; url: string }
  version: { name: string; released: string }
}

type RuntimeEntry =
  | { type: 'directory' }
  | { type: 'link'; target: string }
  | { type: 'file'; executable: boolean; downloads: { raw: { sha1: string; size: number; url: string } } }

interface RuntimeManifest {
  files: Record<string, RuntimeEntry>
}

export interface JavaRuntime {
  /** Console java, used to run loader installers. */
  java: string
  /** Windowless java for the game itself (javaw on Windows). */
  javaw: string
  home: string
  version?: string
}

export interface EnsureJavaOptions {
  runtimeDir: string
  component: string
  verify: 'fast' | 'full'
  signal?: AbortSignal
  onProgress?: (p: ProgressInfo) => void
  log?: (line: string) => void
}

function platformKey(): string {
  const { platform, arch } = process
  if (platform === 'win32') return arch === 'arm64' ? 'windows-arm64' : arch === 'ia32' ? 'windows-x86' : 'windows-x64'
  if (platform === 'darwin') return arch === 'arm64' ? 'mac-os-arm64' : 'mac-os'
  return arch === 'ia32' ? 'linux-i386' : 'linux'
}

function executables(home: string): JavaRuntime {
  if (process.platform === 'win32') {
    return { home, java: path.join(home, 'bin', 'java.exe'), javaw: path.join(home, 'bin', 'javaw.exe') }
  }
  const bin = process.platform === 'darwin' ? path.join(home, 'jre.bundle', 'Contents', 'Home', 'bin') : path.join(home, 'bin')
  return { home, java: path.join(bin, 'java'), javaw: path.join(bin, 'java') }
}

export async function ensureJavaRuntime(o: EnsureJavaOptions): Promise<JavaRuntime> {
  const home = path.join(o.runtimeDir, o.component)
  const exe = executables(home)
  const markerPath = path.join(home, '.launcher-runtime.json')
  const marker = await readJson<{ manifestSha1: string; version: string }>(markerPath)
  const installed = marker !== null && (await exists(exe.javaw))

  // Normal launches: trust a completed install and don't touch the network.
  if (installed && o.verify === 'fast') return { ...exe, version: marker.version }

  o.onProgress?.({ stage: 'java', label: 'Checking Java' })
  let target: RuntimeTarget | undefined
  try {
    const index = await withRetry(() => getJson<Record<string, Record<string, RuntimeTarget[]>>>(RUNTIME_INDEX), { signal: o.signal })
    target = index[platformKey()]?.[o.component]?.[0]
  } catch (e) {
    if (installed) return { ...exe, version: marker.version } // offline, but we already have one
    throw e
  }
  if (!target) throw new Error(`Mojang does not publish Java runtime "${o.component}" for ${platformKey()}`)

  const manifest = await withRetry(() => getJson<RuntimeManifest>(target.manifest.url), { signal: o.signal })
  const items: DownloadItem[] = []
  const executableFiles: string[] = []
  const links: [string, string][] = []
  for (const [rel, entry] of Object.entries(manifest.files)) {
    const dest = safeJoin(home, rel)
    if (entry.type === 'directory') await mkdir(dest, { recursive: true })
    else if (entry.type === 'link') links.push([dest, entry.target])
    else {
      const raw = entry.downloads.raw
      items.push({ urls: [raw.url], dest, sha1: raw.sha1, size: raw.size, name: path.basename(rel) })
      if (entry.executable) executableFiles.push(dest)
    }
  }

  const missing = await filterNeedsDownload(dedupeByDest(items), o.verify === 'full' ? 'hash' : 'size')
  if (missing.length > 0) {
    o.log?.(`Downloading Java ${target.version.name} (${missing.length} files)`)
    await downloadAll(missing, {
      signal: o.signal,
      onProgress: (p) =>
        o.onProgress?.({ stage: 'java', label: `Downloading Java ${target.version.name}`, detail: p.current, current: p.doneBytes, total: p.totalBytes, unit: 'bytes' })
    })
  }
  if (process.platform !== 'win32') {
    for (const file of executableFiles) await chmod(file, 0o755)
    for (const [dest, linkTarget] of links) await symlink(linkTarget, dest).catch(() => {})
  }
  await writeJson(markerPath, { manifestSha1: target.manifest.sha1, version: target.version.name })
  return { ...exe, version: target.version.name }
}
