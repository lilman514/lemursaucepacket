import assert from 'node:assert/strict'
import { test } from 'node:test'
import { UnsafePathError } from '../src/core/fsutil'
import { clientFiles, disabledOptionalPaths, fileKey, fileSide, parseMrpack, resolveGameTarget } from '../src/core/mrpack'
import { makeMrpack, packFile } from './helpers'

test('parseMrpack rejects files that would land outside the game folder', () => {
  assert.throws(() => parseMrpack(makeMrpack({ files: [packFile('../../evil.jar', 'x', 'https://example.com/x')] })), UnsafePathError)
  assert.throws(() => parseMrpack(makeMrpack({ files: [] }, { 'overrides/../evil.txt': 'x' })), UnsafePathError)
})

test('parseMrpack rejects packs without hashes or downloads', () => {
  const bad = packFile('mods/a.jar', 'x', 'https://example.com/a')
  assert.throws(() => parseMrpack(makeMrpack({ files: [{ ...bad, hashes: { sha1: 'nope' } }] })), /sha1/)
  assert.throws(() => parseMrpack(makeMrpack({ files: [{ ...bad, downloads: [] }] })), /download/)
  assert.throws(() => parseMrpack(makeMrpack({ files: [{ ...bad, downloads: ['file:///C:/x.jar'] }] })), /Bad download URL/)
  assert.throws(() => parseMrpack(new Uint8Array([1, 2, 3])), /corrupt|zip/)
})

test('resolveGameTarget picks the loader from dependencies', () => {
  assert.deepEqual(resolveGameTarget({ minecraft: '1.21.1', neoforge: '21.1.252' }), { minecraft: '1.21.1', loader: 'neoforge', loaderVersion: '21.1.252' })
  assert.deepEqual(resolveGameTarget({ minecraft: '1.20.1', forge: '47.3.0' }), { minecraft: '1.20.1', loader: 'forge', loaderVersion: '47.3.0' })
  assert.deepEqual(resolveGameTarget({ minecraft: '1.21.1', 'fabric-loader': '0.16.10' }), { minecraft: '1.21.1', loader: 'fabric', loaderVersion: '0.16.10' })
  assert.deepEqual(resolveGameTarget({ minecraft: '1.21.1' }), { minecraft: '1.21.1', loader: 'vanilla' })
})

test('clientFiles honours env flags and switched-off optional mods', () => {
  const index = parseMrpack(
    makeMrpack({
      files: [
        packFile('mods/both.jar', 'a', 'https://x/a'),
        packFile('mods/server.jar', 'b', 'https://x/b', { client: 'unsupported', server: 'required' }),
        packFile('mods/opt.jar', 'c', 'https://x/c', { client: 'optional', server: 'unsupported' })
      ]
    })
  ).index
  assert.deepEqual(clientFiles(index, new Set()).map((f) => f.path), ['mods/both.jar', 'mods/opt.jar'])
  assert.deepEqual(clientFiles(index, new Set(['mods/opt.jar'])).map((f) => f.path), ['mods/both.jar'])
  assert.deepEqual(index.files.map(fileSide), ['both', 'server', 'client'])
})

test('optional mods: stable keys, pack defaults, and player choices', () => {
  const opt = { client: 'optional', server: 'unsupported' } as const
  const index = parseMrpack(
    makeMrpack({
      files: [
        packFile('mods/map-1.0.jar', 'a', 'https://cdn.modrinth.com/data/AbC123/versions/v1/map-1.0.jar', opt),
        packFile('mods/shaders-2.0.jar', 'b', 'https://cdn.modrinth.com/data/Shd999/versions/v9/shaders-2.0.jar', opt),
        packFile('mods/custom.jar', 'c', 'https://example.com/custom.jar', opt)
      ]
    })
  ).index
  assert.deepEqual(index.files.map(fileKey), ['AbC123', 'Shd999', 'mods/custom.jar'], 'Modrinth project id survives a version bump')
  const defaultOff = new Set(['Shd999'])
  assert.deepEqual([...disabledOptionalPaths(index, {}, defaultOff)], ['mods/shaders-2.0.jar'], 'default-off mods start disabled')
  assert.deepEqual([...disabledOptionalPaths(index, { Shd999: true, AbC123: false }, defaultOff)], ['mods/map-1.0.jar'], 'player choices win')
})
