// The shader picker's rules, shared by the launcher process and its UI (no Node APIs here).

import type { LauncherFeed, Settings, ShaderPreset } from './types'

export const SHADERS_OFF = 'off'

/** Whether the optional Iris mod is on for this player. */
export function irisEnabled(feed: LauncherFeed | null | undefined, choices: Readonly<Record<string, boolean>>): boolean {
  const iris = feed?.shaders?.iris
  if (!iris) return false
  return choices[iris] ?? !(feed?.optionalDefaultOff ?? []).includes(iris)
}

/** The preset in effect: off while Iris is off, else the player's pick (or the pack's default). */
export function effectiveShaderPreset(feed: LauncherFeed | null | undefined, settings: Pick<Settings, 'optionalChoices' | 'shaderPreset'>): ShaderPreset | null {
  const shaders = feed?.shaders
  if (!shaders || !irisEnabled(feed, settings.optionalChoices)) return null
  return shaders.presets.find((p) => p.id === settings.shaderPreset) ?? shaders.presets.find((p) => p.id === shaders.defaultPreset) ?? shaders.presets[0] ?? null
}

/** The settings patch for picking a preset (or SHADERS_OFF) in the launcher. */
export function shaderPresetPatch(feed: LauncherFeed | null | undefined, settings: Settings, id: string): Partial<Settings> {
  const iris = feed?.shaders?.iris
  if (!iris) return {}
  const on = id !== SHADERS_OFF
  return { shaderPreset: on ? id : settings.shaderPreset, optionalChoices: { ...settings.optionalChoices, [iris]: on } }
}
