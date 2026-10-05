// The shader picker's rules, shared by the launcher process and its UI (no Node APIs here).
// Iris is always installed; "Off" is Iris with shaders switched off and the default pack ready for K in game.

import type { LauncherFeed, ShaderPreset } from './types'

export const SHADERS_OFF = 'off'

export function shaderPreset(feed: LauncherFeed | null | undefined, id: string): ShaderPreset | null {
  return feed?.shaderPresets?.presets.find((p) => p.id === id) ?? null
}

export function defaultShaderPreset(feed: LauncherFeed | null | undefined): ShaderPreset | null {
  const shaders = feed?.shaderPresets
  if (!shaders) return null
  return shaders.presets.find((p) => p.id === shaders.defaultPreset) ?? shaders.presets[0] ?? null
}

/** Whether `id` is something the picker can be set to. */
export function isShaderChoice(feed: LauncherFeed | null | undefined, id: string): boolean {
  return id === SHADERS_OFF || shaderPreset(feed, id) !== null
}
