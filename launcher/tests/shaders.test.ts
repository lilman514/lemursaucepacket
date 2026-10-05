import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { applyShaderPreset, readIrisConfig, shaderState, SHADERS_OFF } from '../src/core/shaders'
import type { LauncherFeed, Settings } from '../src/shared/types'

const feed = {
  schema: 1,
  name: 'Pack',
  server: { address: 'example.com' },
  pack: { version: '1', url: 'p.mrpack', sha1: '0'.repeat(40) },
  shaderPresets: {
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

async function instance(irisProperties?: string): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'shaders-'))
  const file = path.join(dir, 'config', 'iris.properties')
  if (irisProperties !== undefined) {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, irisProperties)
  }
  return { dir, file }
}

test('a first launch gets shaders off with the default pack ready for K', async () => {
  const { dir } = await instance()
  assert.equal(await applyShaderPreset(dir, feed, base), SHADERS_OFF)
  assert.deepEqual(await readIrisConfig(dir), { exists: true, enabled: false, pack: 'Balanced.zip' })
  assert.deepEqual(await shaderState(dir, feed, { ...base, appliedShaderPreset: SHADERS_OFF }), { active: SHADERS_OFF, pack: 'Balanced.zip', pending: false })
})

test('a pick is written on the next Play once, keeping the rest of Iris config', async () => {
  const { dir, file } = await instance('#Iris settings\nmaxShadowRenderDistance=32\nenableShaders=false\nshaderPack=Balanced.zip\n')
  const lite = { ...base, shaderPreset: 'lite' }
  assert.deepEqual(await shaderState(dir, feed, lite), { active: 'lite', pack: 'Lite.zip', pending: true })
  assert.equal(await applyShaderPreset(dir, feed, lite), 'lite')
  const text = await readFile(file, 'utf8')
  assert.match(text, /^maxShadowRenderDistance=32$/m)
  assert.match(text, /^enableShaders=true$/m)
  assert.match(text, /^shaderPack=Lite\.zip$/m)
  assert.deepEqual(await shaderState(dir, feed, { ...lite, appliedShaderPreset: 'lite' }), { active: 'lite', pack: 'Lite.zip', pending: false })
})

test('what the player changes in game (K, O) survives later launches and shows in Settings', async () => {
  const { dir, file } = await instance('enableShaders=false\nshaderPack=Fancy.zip\n')
  const settings = { ...base, shaderPreset: 'fancy', appliedShaderPreset: 'fancy' }
  assert.equal(await applyShaderPreset(dir, feed, settings), 'fancy')
  assert.match(await readFile(file, 'utf8'), /^enableShaders=false$/m)
  assert.equal((await shaderState(dir, feed, settings)).active, SHADERS_OFF)
  await writeFile(file, 'enableShaders=true\nshaderPack=MyOwnPack.zip\n')
  assert.deepEqual(await shaderState(dir, feed, settings), { active: null, pack: 'MyOwnPack.zip', pending: false })
})

test('picking again in the launcher wins, and Off keeps the pack so K brings it back', async () => {
  const { dir } = await instance('enableShaders=true\nshaderPack=MyOwnPack.zip\n')
  assert.equal(await applyShaderPreset(dir, feed, { ...base, shaderPreset: 'fancy', appliedShaderPreset: '' }), 'fancy')
  assert.deepEqual(await readIrisConfig(dir), { exists: true, enabled: true, pack: 'Fancy.zip' })
  assert.equal(await applyShaderPreset(dir, feed, { ...base, shaderPreset: SHADERS_OFF, appliedShaderPreset: '' }), SHADERS_OFF)
  assert.deepEqual(await readIrisConfig(dir), { exists: true, enabled: false, pack: 'Fancy.zip' })
})

test('a feed without presets leaves Iris alone', async () => {
  const { dir } = await instance()
  const bare = { ...feed, shaderPresets: undefined } as LauncherFeed
  assert.equal(await applyShaderPreset(dir, bare, { ...base, shaderPreset: 'lite' }), '')
  assert.equal((await readIrisConfig(dir)).exists, false)
})
