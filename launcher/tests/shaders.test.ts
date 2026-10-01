import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { applyShaderPreset, effectiveShaderPreset, SHADERS_OFF, shaderPresetPatch } from '../src/core/shaders'
import type { LauncherFeed, Settings } from '../src/shared/types'

const feed = {
  schema: 1,
  name: 'Pack',
  server: { address: 'example.com' },
  pack: { version: '1', url: 'p.mrpack', sha1: '0'.repeat(40) },
  optionalDefaultOff: ['iris'],
  shaders: {
    iris: 'iris',
    defaultPreset: 'balanced',
    presets: [
      { id: 'lite', name: 'Lite', description: '', file: 'Lite.zip' },
      { id: 'balanced', name: 'Balanced', description: '', file: 'Balanced.zip' },
      { id: 'fancy', name: 'Fancy', description: '', file: 'Fancy.zip' }
    ]
  }
} as LauncherFeed

const base: Settings = {
  memoryMB: 4096,
  width: 1280,
  height: 720,
  fullscreen: false,
  afterLaunch: 'minimize',
  autoJoin: true,
  javaPath: '',
  jvmArgs: '',
  optionalChoices: {},
  shaderPreset: '',
  appliedShaderPreset: ''
}

test('shaders are off while Iris is off, and default to the pack preset when Iris is on', () => {
  assert.equal(effectiveShaderPreset(feed, base), null)
  assert.equal(effectiveShaderPreset(feed, { ...base, optionalChoices: { iris: true } })?.id, 'balanced')
  assert.equal(effectiveShaderPreset(feed, { ...base, optionalChoices: { iris: true }, shaderPreset: 'fancy' })?.id, 'fancy')
  assert.equal(effectiveShaderPreset(null, { ...base, optionalChoices: { iris: true } }), null)
})

test('picking a preset switches Iris on; Off switches it off and keeps the last pick', () => {
  const fancy = { ...base, ...shaderPresetPatch(feed, base, 'fancy') }
  assert.deepEqual([fancy.shaderPreset, fancy.optionalChoices.iris], ['fancy', true])
  const off = { ...fancy, ...shaderPresetPatch(feed, fancy, SHADERS_OFF) }
  assert.deepEqual([off.shaderPreset, off.optionalChoices.iris], ['fancy', false])
  assert.equal(effectiveShaderPreset(feed, off), null)
})

test('the preset is written into Iris config once, keeping the rest, and an in-game pick then survives', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'shaders-'))
  await mkdir(path.join(dir, 'config'))
  const file = path.join(dir, 'config', 'iris.properties')
  await writeFile(file, '#Iris settings\nmaxShadowRenderDistance=32\nenableShaders=false\n')
  const lite = { ...base, optionalChoices: { iris: true }, shaderPreset: 'lite' }
  assert.equal(await applyShaderPreset(dir, feed, lite), 'lite')
  const text = await readFile(file, 'utf8')
  assert.match(text, /^maxShadowRenderDistance=32$/m)
  assert.match(text, /^enableShaders=true$/m)
  assert.match(text, /^shaderPack=Lite\.zip$/m)
  // The player picks another pack in Iris's own menu; the same preset on the next launch leaves it alone.
  await writeFile(file, text.replace('shaderPack=Lite.zip', 'shaderPack=Other.zip'))
  assert.equal(await applyShaderPreset(dir, feed, { ...lite, appliedShaderPreset: 'lite' }), 'lite')
  assert.match(await readFile(file, 'utf8'), /^shaderPack=Other\.zip$/m)
  // A new preset in the launcher wins again.
  await applyShaderPreset(dir, feed, { ...lite, shaderPreset: 'fancy', appliedShaderPreset: 'lite' })
  assert.match(await readFile(file, 'utf8'), /^shaderPack=Fancy\.zip$/m)
  // Off leaves the file alone and reports nothing applied.
  assert.equal(await applyShaderPreset(dir, feed, base), '')
})
