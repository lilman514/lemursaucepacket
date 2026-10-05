// The shader picker. Iris is always installed and its config (config/iris.properties) is the truth: Iris itself
// rewrites it when the player presses K (shaders on/off) or picks a pack with O. The launcher only writes it
// (a) the first time, with shaders off and the default pack ready, so K turns that one on, and (b) on the next
// Play after the player picks something in Settings. Everything else in the file is left as Iris wrote it.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defaultShaderPreset, SHADERS_OFF, shaderPreset } from '../shared/shaders'
import type { LauncherFeed, Settings, ShaderState } from '../shared/types'

export { SHADERS_OFF, defaultShaderPreset, isShaderChoice, shaderPreset } from '../shared/shaders'

export interface IrisConfig {
  exists: boolean
  enabled: boolean
  pack: string | null
}

const irisFile = (instanceDir: string): string => path.join(instanceDir, 'config', 'iris.properties')
const KEY = /^\s*([^#!=:\s]+)\s*[=:]\s*(.*)$/

/** Iris's own settings: shaders on or off, and the selected pack. Iris treats a missing file as on with no pack. */
export async function readIrisConfig(instanceDir: string): Promise<IrisConfig> {
  const text = await readFile(irisFile(instanceDir), 'utf8').catch(() => null)
  if (text === null) return { exists: false, enabled: false, pack: null }
  const values: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = KEY.exec(line)
    if (m) values[m[1]] = m[2].trim()
  }
  const pack = values.shaderPack ? values.shaderPack : null
  return { exists: true, enabled: values.enableShaders !== 'false' && pack !== null, pack }
}

/** Sets enableShaders and shaderPack in Iris's config, keeping every other line as it is. */
export async function writeIrisConfig(instanceDir: string, enabled: boolean, pack: string): Promise<void> {
  const file = irisFile(instanceDir)
  const lines = (await readFile(file, 'utf8').catch(() => '')).split(/\r?\n/).filter((l, i, all) => l !== '' || i < all.length - 1)
  const wanted: Record<string, string> = { enableShaders: String(enabled), shaderPack: pack }
  const seen = new Set<string>()
  const out = lines.map((line) => {
    const m = KEY.exec(line)
    if (!m || !(m[1] in wanted)) return line
    seen.add(m[1])
    return `${m[1]}=${wanted[m[1]]}`
  })
  for (const [k, v] of Object.entries(wanted)) if (!seen.has(k)) out.push(`${k}=${v}`)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, out.join('\n') + '\n')
}

/**
 * Before a launch: writes a pick the player made in Settings since the last launch, or sets up a first-time Iris
 * config (shaders off, default pack ready). Returns the new Settings.appliedShaderPreset.
 */
export async function applyShaderPreset(instanceDir: string, feed: LauncherFeed | null | undefined, settings: Settings, log: (s: string) => void = () => {}): Promise<string> {
  const fallback = defaultShaderPreset(feed)
  if (!fallback) return settings.appliedShaderPreset
  const config = await readIrisConfig(instanceDir)
  const wanted = settings.shaderPreset
  if (wanted && wanted !== settings.appliedShaderPreset) {
    if (wanted === SHADERS_OFF) {
      // Keep the pack they had, so K brings back the same look.
      await writeIrisConfig(instanceDir, false, config.pack ?? fallback.file)
      log('Shaders: off')
      return wanted
    }
    const preset = shaderPreset(feed, wanted)
    if (preset) {
      await writeIrisConfig(instanceDir, true, preset.file)
      log(`Shaders: ${preset.name} (${preset.file})`)
      return wanted
    }
  }
  if (!config.exists) {
    await writeIrisConfig(instanceDir, false, fallback.file)
    log(`Shaders: off (K in game turns on ${fallback.name})`)
    return SHADERS_OFF
  }
  return settings.appliedShaderPreset
}

/** For the Settings page: what the game will use. */
export async function shaderState(instanceDir: string, feed: LauncherFeed | null | undefined, settings: Settings): Promise<ShaderState> {
  if (settings.shaderPreset && settings.shaderPreset !== settings.appliedShaderPreset) {
    return { active: settings.shaderPreset, pack: shaderPreset(feed, settings.shaderPreset)?.file ?? null, pending: true }
  }
  const config = await readIrisConfig(instanceDir)
  if (!config.enabled) return { active: SHADERS_OFF, pack: config.pack, pending: false }
  const preset = feed?.shaderPresets?.presets.find((p) => p.file === config.pack)
  return { active: preset ? preset.id : null, pack: config.pack, pending: false }
}
