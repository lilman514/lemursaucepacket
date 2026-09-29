// Installs Minecraft itself plus the mod loader the pack asks for.
// Vanilla files come from Mojang with our own verified downloader; NeoForge/Forge are installed
// by running their official installer headlessly, so new loader releases keep working unchanged.

import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { Version, type ResolvedVersion } from '@xmcl/core'
import { unzipSync } from 'fflate'
import type { ProgressInfo } from '../shared/types'
import { dedupeByDest, downloadAll, filterNeedsDownload, type DownloadItem } from './download'
import { exists, readJson, statOrNull, writeJson } from './fsutil'
import { CancelledError, getJson, request, withRetry } from './http'
import { ensureJavaRuntime, type JavaRuntime } from './java'
import type { GameTarget } from './mrpack'

const VERSION_MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const RESOURCES = 'https://resources.download.minecraft.net/'

export interface InstallGameOptions {
  /** Shared Minecraft folder: versions/, libraries/, assets/. */
  mcDir: string
  runtimeDir: string
  cacheDir: string
  target: GameTarget
  verify: 'fast' | 'full'
  /** Player-chosen java executable; empty to use the managed runtime. */
  javaOverride?: string
  signal?: AbortSignal
  onProgress?: (p: ProgressInfo) => void
  log?: (line: string) => void
}

export interface InstalledGame {
  versionId: string
  java: JavaRuntime
}

interface LoaderMarker {
  versionId: string
  libraries: { path: string; size: number }[]
  installedAt: string
}

const LOADER_NAMES: Record<string, string> = { neoforge: 'NeoForge', forge: 'Forge', fabric: 'Fabric', quilt: 'Quilt' }

export async function installGame(o: InstallGameOptions): Promise<InstalledGame> {
  const { minecraft, loader } = o.target
  await ensureVersionJson(minecraft, o)
  const vanilla = await Version.parse(o.mcDir, minecraft)

  const java: JavaRuntime = o.javaOverride
    ? { java: o.javaOverride, javaw: o.javaOverride, home: path.dirname(path.dirname(o.javaOverride)) }
    : await ensureJavaRuntime({
        runtimeDir: o.runtimeDir,
        component: vanilla.javaVersion?.component || 'jre-legacy',
        verify: o.verify,
        signal: o.signal,
        onProgress: o.onProgress,
        log: o.log
      })

  await ensureVanillaFiles(vanilla, o)

  let versionId = minecraft
  if (loader === 'neoforge' || loader === 'forge') {
    versionId = await ensureForgeLike(o, java.java)
  } else if (loader === 'fabric' || loader === 'quilt') {
    versionId = await ensureFabricLike(o)
    const resolved = await Version.parse(o.mcDir, versionId)
    await downloadLibraries(resolved, o, `Downloading ${LOADER_NAMES[loader]}`, 'loader')
  }
  return { versionId, java }
}

async function ensureVersionJson(id: string, o: InstallGameOptions): Promise<void> {
  const jsonPath = path.join(o.mcDir, 'versions', id, `${id}.json`)
  const have = await exists(jsonPath)
  if (have && o.verify === 'fast') return
  o.onProgress?.({ stage: 'minecraft', label: `Checking Minecraft ${id}` })
  try {
    const manifest = await withRetry(() => getJson<{ versions: { id: string; url: string; sha1: string }[] }>(VERSION_MANIFEST), { signal: o.signal })
    const entry = manifest.versions.find((v) => v.id === id)
    if (!entry) throw new Error(`Minecraft ${id} isn't in Mojang's version list`)
    const missing = await filterNeedsDownload([{ urls: [entry.url], dest: jsonPath, sha1: entry.sha1, name: `${id}.json` }], 'hash')
    await downloadAll(missing, { signal: o.signal })
  } catch (e) {
    if (have && !(e instanceof CancelledError)) {
      o.log?.(`Could not refresh ${id}.json (${(e as Error).message}); using the copy on disk`)
      return
    }
    throw e
  }
}

function libraryItems(version: ResolvedVersion, mcDir: string): DownloadItem[] {
  const items: DownloadItem[] = []
  for (const lib of version.libraries) {
    const d = lib.download
    if (!d?.url || !d.path) continue
    items.push({
      urls: [d.url],
      dest: path.join(mcDir, 'libraries', ...d.path.split('/')),
      sha1: d.sha1 || undefined,
      size: d.size >= 0 ? d.size : undefined,
      name: path.basename(d.path)
    })
  }
  return items
}

async function ensureVanillaFiles(vanilla: ResolvedVersion, o: InstallGameOptions): Promise<void> {
  const mc = vanilla.minecraftVersion
  const items: DownloadItem[] = []
  const client = vanilla.downloads.client
  if (client) {
    items.push({ urls: [client.url], dest: path.join(o.mcDir, 'versions', mc, `${mc}.jar`), sha1: client.sha1, size: client.size, name: `minecraft-${mc}.jar` })
  }
  items.push(...libraryItems(vanilla, o.mcDir))

  const logging = vanilla.logging?.client?.file
  if (logging) {
    items.push({ urls: [logging.url], dest: path.join(o.mcDir, 'assets', 'log_configs', logging.id), sha1: logging.sha1, size: logging.size })
  }

  const assetIndex = vanilla.assetIndex
  if (assetIndex) {
    const indexPath = path.join(o.mcDir, 'assets', 'indexes', `${assetIndex.id}.json`)
    const indexItem = { urls: [assetIndex.url], dest: indexPath, sha1: assetIndex.sha1, size: assetIndex.size, name: 'asset index' }
    await downloadAll(await filterNeedsDownload([indexItem], 'hash'), { signal: o.signal })
    const index = JSON.parse(await readFile(indexPath, 'utf8')) as { objects: Record<string, { hash: string; size: number }> }
    for (const [name, { hash, size }] of Object.entries(index.objects)) {
      const prefix = hash.slice(0, 2)
      items.push({ urls: [`${RESOURCES}${prefix}/${hash}`], dest: path.join(o.mcDir, 'assets', 'objects', prefix, hash), sha1: hash, size, name })
    }
  }

  const all = dedupeByDest(items)
  const missing = await filterNeedsDownload(all, o.verify === 'full' ? 'hash' : 'size', (done, total) =>
    o.onProgress?.({ stage: 'minecraft', label: 'Verifying game files', current: done, total, unit: 'files' })
  )
  if (missing.length === 0) return
  o.log?.(`Downloading ${missing.length} Minecraft file(s)`)
  await downloadAll(missing, {
    concurrency: 16,
    signal: o.signal,
    onProgress: (p) =>
      o.onProgress?.({
        stage: 'minecraft',
        label: `Downloading Minecraft ${mc} (${p.doneFiles}/${p.totalFiles})`,
        detail: p.current,
        current: p.doneBytes,
        total: p.totalBytes,
        unit: 'bytes'
      })
  })
}

async function downloadLibraries(version: ResolvedVersion, o: InstallGameOptions, label: string, stage: ProgressInfo['stage']): Promise<void> {
  const missing = await filterNeedsDownload(dedupeByDest(libraryItems(version, o.mcDir)), o.verify === 'full' ? 'hash' : 'size')
  await downloadAll(missing, {
    signal: o.signal,
    onProgress: (p) => o.onProgress?.({ stage, label, detail: p.current, current: p.doneBytes, total: p.totalBytes, unit: 'bytes' })
  })
}

// ---------------------------------------------------------------- NeoForge / Forge

function forgeLikeInstaller(loader: 'neoforge' | 'forge', mc: string, version: string): { url: string; fileName: string } {
  if (loader === 'neoforge') {
    // NeoForge's first release (1.20.1) still used the old "forge" artifact and version scheme.
    if (mc === '1.20.1') {
      const v = version.startsWith('1.20.1-') ? version : `1.20.1-${version}`
      return { url: `https://maven.neoforged.net/releases/net/neoforged/forge/${v}/forge-${v}-installer.jar`, fileName: `neoforge-${v}-installer.jar` }
    }
    return { url: `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`, fileName: `neoforge-${version}-installer.jar` }
  }
  const v = version.startsWith(`${mc}-`) ? version : `${mc}-${version}`
  return { url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${v}/forge-${v}-installer.jar`, fileName: `forge-${v}-installer.jar` }
}

async function loaderIntact(mcDir: string, marker: LoaderMarker): Promise<boolean> {
  if (!(await exists(path.join(mcDir, 'versions', marker.versionId, `${marker.versionId}.json`)))) return false
  for (const lib of marker.libraries) {
    const st = await statOrNull(path.join(mcDir, 'libraries', ...lib.path.split('/')))
    if (!st || st.size !== lib.size) return false
  }
  return true
}

async function ensureForgeLike(o: InstallGameOptions, javaExe: string): Promise<string> {
  const loader = o.target.loader as 'neoforge' | 'forge'
  const name = LOADER_NAMES[loader]
  const { minecraft: mc, loaderVersion } = o.target
  if (!loaderVersion) throw new Error(`The pack doesn't say which ${name} version to use`)

  const markersPath = path.join(o.mcDir, 'versions', '.launcher-loaders.json')
  const markers = (await readJson<Record<string, LoaderMarker>>(markersPath)) ?? {}
  const key = `${loader}-${mc}-${loaderVersion}`
  const marker = markers[key]
  // A repair ('full') always re-runs the installer; otherwise trust a complete previous install.
  if (marker && o.verify === 'fast' && (await loaderIntact(o.mcDir, marker))) return marker.versionId

  const installer = forgeLikeInstaller(loader, mc, loaderVersion)
  const installerPath = path.join(o.cacheDir, 'installers', installer.fileName)
  o.onProgress?.({ stage: 'loader', label: `Downloading ${name} installer` })
  const sha1 = await request(`${installer.url}.sha1`, { signal: o.signal, timeoutMs: 15_000 })
    .then(async (r) => (r.ok ? (await r.text()).trim().slice(0, 40) : undefined))
    .catch(() => undefined)
  await downloadAll(await filterNeedsDownload([{ urls: [installer.url], dest: installerPath, sha1, name: installer.fileName }], 'hash'), {
    signal: o.signal,
    onProgress: (p) => o.onProgress?.({ stage: 'loader', label: `Downloading ${name} installer`, current: p.doneBytes, total: p.totalBytes, unit: 'bytes' })
  })

  const versionId = installerVersionId(await readFile(installerPath))
  // The installer insists on seeing a launcher profile file in the target folder.
  const profiles = path.join(o.mcDir, 'launcher_profiles.json')
  if (!(await exists(profiles))) await writeJson(profiles, { profiles: {}, settings: {}, version: 3 })

  o.log?.(`Running ${name} installer for ${versionId}`)
  await runInstaller(javaExe, installerPath, ['--install-client', o.mcDir], name, o)

  if (!(await exists(path.join(o.mcDir, 'versions', versionId, `${versionId}.json`)))) {
    throw new Error(`The ${name} installer finished but did not create ${versionId}`)
  }
  const resolved = await Version.parse(o.mcDir, versionId)
  const libraries: LoaderMarker['libraries'] = []
  for (const lib of resolved.libraries) {
    const file = path.join(o.mcDir, 'libraries', ...lib.download.path.split('/'))
    const st = await statOrNull(file)
    if (!st) throw new Error(`${name} install is incomplete: missing ${lib.download.path}`)
    libraries.push({ path: lib.download.path, size: st.size })
  }
  markers[key] = { versionId, libraries, installedAt: new Date().toISOString() }
  await writeJson(markersPath, markers)
  return versionId
}

function installerVersionId(jar: Uint8Array): string {
  const entries = unzipSync(jar, { filter: (f) => f.name === 'version.json' })
  const raw = entries['version.json']
  if (!raw) throw new Error('Loader installer has no version.json (legacy installers are not supported)')
  const id = (JSON.parse(new TextDecoder().decode(raw)) as { id?: string }).id
  if (!id) throw new Error('Loader installer version.json has no id')
  return id
}

/** Installer chatter we don't need in the log: per-class output, classpaths, per-library checks. */
const INSTALLER_NOISE =
  /(\.class|\/)$|^(Considering library|File .* exists\.|Download completed|Downloaded file locally|Downloading library from|MainClass:|Classpath:|Args:|Input:|Output:|Key:|Host:|[A-Za-z]:\\|={10,})/
/** Lines worth showing under the progress bar. */
const INSTALLER_STEP = /^(Extracting json|Downloading libraries|Building Processors|Processor: |Splitting |Injecting profile|Successfully installed)/

function runInstaller(
  java: string,
  jar: string,
  installerArgs: string[],
  name: string,
  o: Pick<InstallGameOptions, 'signal' | 'onProgress' | 'log'>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(java, ['-jar', jar, ...installerArgs], { cwd: path.dirname(jar), windowsHide: true })
    const tail: string[] = []
    const onLine = (line: string): void => {
      const text = line.trim()
      if (!text) return
      tail.push(text)
      if (tail.length > 40) tail.shift()
      if (!INSTALLER_NOISE.test(text)) o.log?.(`[${name} installer] ${text}`)
      if (INSTALLER_STEP.test(text)) {
        const detail = text.replace(/^Processor: [\w.-]+:/, '')
        o.onProgress?.({ stage: 'loader', label: `Installing ${name}`, detail: detail.length > 90 ? `${detail.slice(0, 87)}…` : detail })
      }
    }
    createInterface({ input: child.stdout }).on('line', onLine)
    createInterface({ input: child.stderr }).on('line', onLine)
    const abort = (): void => {
      child.kill()
    }
    o.signal?.addEventListener('abort', abort, { once: true })
    child.on('error', (e) => reject(new Error(`Could not start Java to install ${name}: ${e.message}`)))
    child.on('close', (code) => {
      o.signal?.removeEventListener('abort', abort)
      if (o.signal?.aborted) reject(new CancelledError())
      else if (code === 0) resolve()
      else reject(new Error(`${name} installer failed (exit code ${code}).\n${tail.slice(-6).join('\n')}`))
    })
  })
}

// ---------------------------------------------------------------- Dedicated server

export interface InstallServerOptions {
  serverDir: string
  runtimeDir: string
  cacheDir: string
  target: GameTarget
  /** Re-run the loader installer even if this version is already installed. */
  force?: boolean
  signal?: AbortSignal
  onProgress?: (p: ProgressInfo) => void
  log?: (line: string) => void
}

export interface InstalledServer {
  java: JavaRuntime
  /** Arguments after the java executable (JVM args file, loader args file, nogui). */
  args: string[]
}

/** Installs a NeoForge/Forge dedicated server into serverDir with the official installer. */
export async function installServer(o: InstallServerOptions): Promise<InstalledServer> {
  const { minecraft: mc, loader, loaderVersion } = o.target
  if ((loader !== 'neoforge' && loader !== 'forge') || !loaderVersion) {
    throw new Error(`Server install currently supports NeoForge/Forge packs (this pack uses ${loader})`)
  }
  const name = LOADER_NAMES[loader]
  const manifest = await withRetry(() => getJson<{ versions: { id: string; url: string }[] }>(VERSION_MANIFEST), { signal: o.signal })
  const entry = manifest.versions.find((v) => v.id === mc)
  if (!entry) throw new Error(`Minecraft ${mc} isn't in Mojang's version list`)
  const versionJson = await withRetry(() => getJson<{ javaVersion?: { component: string } }>(entry.url), { signal: o.signal })
  const java = await ensureJavaRuntime({
    runtimeDir: o.runtimeDir,
    component: versionJson.javaVersion?.component ?? 'java-runtime-delta',
    verify: 'fast',
    signal: o.signal,
    onProgress: o.onProgress,
    log: o.log
  })

  const argsFileRel = loader === 'neoforge' && mc !== '1.20.1'
    ? `libraries/net/neoforged/neoforge/${loaderVersion}/${process.platform === 'win32' ? 'win' : 'unix'}_args.txt`
    : `libraries/net/minecraftforge/forge/${mc}-${loaderVersion.replace(`${mc}-`, '')}/${process.platform === 'win32' ? 'win' : 'unix'}_args.txt`
  const markerPath = path.join(o.serverDir, '.launcher-server.json')
  const marker = await readJson<{ key: string }>(markerPath)
  const key = `${loader}-${mc}-${loaderVersion}`
  if (o.force || marker?.key !== key || !(await exists(path.join(o.serverDir, argsFileRel)))) {
    const installer = forgeLikeInstaller(loader, mc, loaderVersion)
    const installerPath = path.join(o.cacheDir, 'installers', installer.fileName)
    await downloadAll(await filterNeedsDownload([{ urls: [installer.url], dest: installerPath, name: installer.fileName }], 'size'), { signal: o.signal })
    o.log?.(`Installing ${name} ${loaderVersion} server into ${o.serverDir}`)
    await runInstaller(java.java, installerPath, ['--install-server', o.serverDir], name, o)
    if (!(await exists(path.join(o.serverDir, argsFileRel)))) throw new Error(`${name} server install did not produce ${argsFileRel}`)
    await writeJson(markerPath, { key, installedAt: new Date().toISOString() })
  }
  return { java, args: ['@user_jvm_args.txt', `@${argsFileRel}`, 'nogui'] }
}

// ---------------------------------------------------------------- Fabric / Quilt

async function ensureFabricLike(o: InstallGameOptions): Promise<string> {
  const { minecraft: mc, loader, loaderVersion } = o.target
  if (!loaderVersion) throw new Error(`The pack doesn't say which ${LOADER_NAMES[loader]} version to use`)
  const prefix = loader === 'fabric' ? 'fabric-loader' : 'quilt-loader'
  const expectedId = `${prefix}-${loaderVersion}-${mc}`
  const jsonPath = path.join(o.mcDir, 'versions', expectedId, `${expectedId}.json`)
  if (o.verify === 'fast' && (await exists(jsonPath))) return expectedId

  const base = loader === 'fabric' ? 'https://meta.fabricmc.net/v2' : 'https://meta.quiltmc.org/v3'
  o.onProgress?.({ stage: 'loader', label: `Installing ${LOADER_NAMES[loader]}` })
  const profile = await withRetry(
    () => getJson<{ id: string }>(`${base}/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(loaderVersion)}/profile/json`),
    { signal: o.signal }
  )
  const id = profile.id || expectedId
  await writeJson(path.join(o.mcDir, 'versions', id, `${id}.json`), profile)
  return id
}
