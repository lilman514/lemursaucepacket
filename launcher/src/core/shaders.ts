// The shader picker. Iris is an optional mod in the pack; the feed lists presets, each a shader pack in
// shaderpacks/. "Off" is Iris switched off. Picking a preset switches Iris on, and on the next launch the
// launcher writes that pack into Iris's config, once: a pack the player then picks in-game (Iris's own menu)
// stays until they pick another preset here.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { effectiveShaderPreset } from '../shared/shaders'
import type { LauncherFeed, Settings, ShaderPreset } from '../shared/types'

export { SHADERS_OFF, effectiveShaderPreset, irisEnabled, shaderPresetPatch } from '../shared/shaders'

/**
 * Points Iris at the preset's pack (config/iris.properties: enableShaders, shaderPack), keeping the rest of
 * the player's Iris settings. Returns true when it wrote the file.
 */
export async function writeIrisPreset(instanceDir: string, preset: ShaderPreset): Promise<boolean> {
  const file = path.join(instanceDir, 'config', 'iris.properties')
  const lines = (await readFile(file, 'utf8').catch(() => '')).split(/\r?\n/).filter((l, i, all) => l !== '' || i < all.length - 1)
  const wanted: Record<string, string> = { enableShaders: 'true', shaderPack: preset.file }
  const seen = new Set<string>()
  const out = lines.map((line) => {
    const m = /^\s*([^#!=:\s]+)\s*[=:]/.exec(line)
    if (!m || !(m[1] in wanted)) return line
    seen.add(m[1])
    return `${m[1]}=${wanted[m[1]]}`
  })
  for (const [k, v] of Object.entries(wanted)) if (!seen.has(k)) out.push(`${k}=${v}`)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, out.join('\n') + '\n')
  return true
}

/**
 * After a sync: write the effective preset into Iris's config when it changed since the last launch (or the
 * file is gone). Returns the preset id now applied ('' when shaders are off), for Settings.appliedShaderPreset.
 */
export async function applyShaderPreset(instanceDir: string, feed: LauncherFeed | null | undefined, settings: Settings, log: (s: string) => void = () => {}): Promise<string> {
  const preset = effectiveShaderPreset(feed, settings)
  if (!preset) return ''
  const file = path.join(instanceDir, 'config', 'iris.properties')
  const current = await readFile(file, 'utf8').catch(() => null)
  if (settings.appliedShaderPreset === preset.id && current !== null && /^\s*shaderPack\s*[=:]/m.test(current)) return preset.id
  await writeIrisPreset(instanceDir, preset)
  log(`Shaders: ${preset.name} (${preset.file})`)
  return preset.id
}
