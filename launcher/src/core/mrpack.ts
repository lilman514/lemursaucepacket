// Reader for Modrinth's .mrpack format (https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack).
// The pack is a zip holding modrinth.index.json (mods to download) plus overrides/ (configs etc.).

import { unzipSync } from 'fflate'
import type { LoaderId } from '../shared/types'
import { normalizeRelative } from './fsutil'

export type EnvSupport = 'required' | 'optional' | 'unsupported'

export interface MrpackFile {
  path: string
  hashes: { sha1: string; sha512?: string; [algorithm: string]: string | undefined }
  env?: { client?: EnvSupport; server?: EnvSupport }
  downloads: string[]
  fileSize: number
}

export interface MrpackIndex {
  formatVersion: number
  game: string
  versionId: string
  name: string
  summary?: string
  files: MrpackFile[]
  dependencies: Record<string, string>
}

export type PackSide = 'client' | 'server'

export interface ParsedMrpack {
  index: MrpackIndex
  /** Override files for one side (overrides/ merged with <side>-overrides/), keyed by normalised relative path. */
  overrides: Map<string, Uint8Array>
}

export interface GameTarget {
  minecraft: string
  loader: LoaderId
  loaderVersion?: string
}

const HEX40 = /^[0-9a-f]{40}$/i

export function parseMrpack(data: Uint8Array, side: PackSide = 'client'): ParsedMrpack {
  const otherSide = side === 'client' ? 'server-overrides/' : 'client-overrides/'
  let entries: Record<string, Uint8Array>
  try {
    // The other side's overrides are never needed here, so don't inflate them.
    entries = unzipSync(data, { filter: (f) => !f.name.startsWith(otherSide) })
  } catch (e) {
    throw new Error(`The modpack file is corrupt or not a zip: ${(e as Error).message}`)
  }
  const raw = entries['modrinth.index.json']
  if (!raw) throw new Error('Not a valid .mrpack: modrinth.index.json is missing')
  const index = validateIndex(JSON.parse(new TextDecoder().decode(raw)))

  const overrides = new Map<string, Uint8Array>()
  // <side>-overrides/ is applied after overrides/ so it wins on conflicts.
  for (const prefix of ['overrides/', `${side}-overrides/`]) {
    for (const [name, content] of Object.entries(entries)) {
      if (!name.startsWith(prefix) || name.endsWith('/')) continue
      const rel = name.slice(prefix.length)
      if (!rel) continue
      overrides.set(normalizeRelative(rel), content)
    }
  }
  return { index, overrides }
}

function validateIndex(value: unknown): MrpackIndex {
  const index = value as MrpackIndex
  if (!index || typeof index !== 'object') throw new Error('modrinth.index.json is not an object')
  if (index.formatVersion !== 1) throw new Error(`Unsupported mrpack formatVersion ${String(index.formatVersion)}`)
  if (index.game !== 'minecraft') throw new Error(`Unsupported mrpack game "${String(index.game)}"`)
  if (!Array.isArray(index.files)) throw new Error('modrinth.index.json has no files array')
  if (!index.dependencies || typeof index.dependencies.minecraft !== 'string') {
    throw new Error('modrinth.index.json does not declare a Minecraft version')
  }
  for (const file of index.files) {
    file.path = normalizeRelative(file.path)
    if (!file.hashes || !HEX40.test(file.hashes.sha1 ?? '')) throw new Error(`Missing sha1 for ${file.path}`)
    file.hashes.sha1 = file.hashes.sha1.toLowerCase()
    if (!Array.isArray(file.downloads) || file.downloads.length === 0) throw new Error(`No download URL for ${file.path}`)
    for (const url of file.downloads) {
      const protocol = new URL(url).protocol
      if (protocol !== 'https:' && protocol !== 'http:') throw new Error(`Bad download URL for ${file.path}`)
    }
    if (typeof file.fileSize !== 'number' || file.fileSize < 0) throw new Error(`Missing fileSize for ${file.path}`)
  }
  return index
}

export function resolveGameTarget(deps: Record<string, string>): GameTarget {
  const minecraft = deps.minecraft
  if (deps.neoforge) return { minecraft, loader: 'neoforge', loaderVersion: deps.neoforge }
  if (deps.forge) return { minecraft, loader: 'forge', loaderVersion: deps.forge }
  if (deps['fabric-loader']) return { minecraft, loader: 'fabric', loaderVersion: deps['fabric-loader'] }
  if (deps['quilt-loader']) return { minecraft, loader: 'quilt', loaderVersion: deps['quilt-loader'] }
  return { minecraft, loader: 'vanilla' }
}

const MODRINTH_CDN = /^https:\/\/cdn\.modrinth\.com\/data\/([A-Za-z0-9]+)\//

/** Identity of a pack file that survives version bumps: its Modrinth project id, else its path. */
export function fileKey(f: MrpackFile): string {
  for (const url of f.downloads) {
    const m = MODRINTH_CDN.exec(url)
    if (m) return m[1]
  }
  return f.path
}

/** Paths of optional client files that are switched off, from the player's choices and the pack's defaults. */
export function disabledOptionalPaths(index: MrpackIndex, choices: Readonly<Record<string, boolean>>, defaultOff: ReadonlySet<string>): Set<string> {
  const off = new Set<string>()
  for (const f of index.files) {
    if (f.env?.client !== 'optional') continue
    const key = fileKey(f)
    if (!(choices[key] ?? !defaultOff.has(key))) off.add(f.path)
  }
  return off
}

/** Files one side should have, honouring env flags and the optional files that were switched off. */
export function sideFiles(index: MrpackIndex, side: PackSide, disabledOptional: ReadonlySet<string>): MrpackFile[] {
  return index.files.filter((f) => {
    const support = f.env?.[side] ?? 'required'
    if (support === 'unsupported') return false
    if (support === 'optional' && disabledOptional.has(f.path)) return false
    return true
  })
}

export function clientFiles(index: MrpackIndex, disabledOptional: ReadonlySet<string>): MrpackFile[] {
  return sideFiles(index, 'client', disabledOptional)
}

export function fileSide(f: MrpackFile): 'both' | 'client' | 'server' {
  if (f.env?.server === 'unsupported') return 'client'
  if (f.env?.client === 'unsupported') return 'server'
  return 'both'
}
