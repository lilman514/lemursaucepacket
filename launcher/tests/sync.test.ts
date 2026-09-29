import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { DownloadError } from '../src/core/download'
import { parseMrpack } from '../src/core/mrpack'
import { syncPack } from '../src/core/sync'
import { fileServer, makeMrpack, packFile, tempDir } from './helpers'

const optional = { client: 'optional', server: 'unsupported' } as const

test('fresh install, no-op resync, then updates that respect player changes', async (t) => {
  const { dir, cleanup } = tempDir()
  t.after(cleanup)
  const srv = await fileServer({ '/a.jar': 'AAAA', '/b.jar': 'BBBBBB', '/c.jar': 'CCC', '/opt.jar': 'OPT' })
  t.after(srv.close)
  const instance = path.join(dir, 'instance')
  const base = { instanceDir: instance, strictMods: true, verify: 'fast' as const, disabledOptional: new Set<string>() }

  const v1 = parseMrpack(
    makeMrpack(
      {
        files: [
          packFile('mods/a.jar', 'AAAA', srv.url('/a.jar')),
          packFile('mods/b.jar', 'BBBBBB', srv.url('/b.jar')),
          packFile('mods/server-only.jar', 'S', srv.url('/missing'), { client: 'unsupported', server: 'required' }),
          packFile('mods/opt.jar', 'OPT', srv.url('/opt.jar'), optional)
        ]
      },
      {
        'overrides/config/x.toml': 'x=1',
        'overrides/options.txt': 'fov:70',
        'client-overrides/config/x.toml': 'x=2',
        'server-overrides/server.properties': 'motd=hi'
      }
    )
  )
  const r1 = await syncPack({ ...base, pack: v1, packSha1: '1'.repeat(40), previous: null })
  assert.deepEqual(r1.downloaded.sort(), ['mods/a.jar', 'mods/b.jar', 'mods/opt.jar'])
  assert.equal(readFileSync(path.join(instance, 'mods/a.jar'), 'utf8'), 'AAAA')
  assert.equal(existsSync(path.join(instance, 'mods/server-only.jar')), false, 'server-only files stay off the client')
  assert.equal(readFileSync(path.join(instance, 'config/x.toml'), 'utf8'), 'x=2', 'client-overrides win over overrides')
  assert.equal(existsSync(path.join(instance, 'server.properties')), false, 'server-overrides are ignored')

  const hits = srv.hits.get('/a.jar')
  const r2 = await syncPack({ ...base, pack: v1, packSha1: '1'.repeat(40), previous: r1.state })
  assert.equal(r2.downloaded.length, 0, 'an unchanged pack downloads nothing')
  assert.equal(srv.hits.get('/a.jar'), hits)

  // The player tweaks a config, their options, and drops in a mod of their own.
  writeFileSync(path.join(instance, 'config/x.toml'), 'x=player')
  writeFileSync(path.join(instance, 'options.txt'), 'fov:110')
  writeFileSync(path.join(instance, 'mods/extra.jar'), 'not in the pack')

  // v2: b.jar dropped, c.jar added, config unchanged in the pack; the player turned the optional mod off.
  const v2Files = [
    packFile('mods/a.jar', 'AAAA', srv.url('/a.jar')),
    packFile('mods/c.jar', 'CCC', srv.url('/c.jar')),
    packFile('mods/opt.jar', 'OPT', srv.url('/opt.jar'), optional)
  ]
  const v2 = parseMrpack(
    makeMrpack({ versionId: '1.1.0', files: v2Files }, { 'overrides/config/x.toml': 'x=1', 'overrides/options.txt': 'fov:70', 'client-overrides/config/x.toml': 'x=2' })
  )
  const r3 = await syncPack({ ...base, pack: v2, packSha1: '2'.repeat(40), previous: r2.state, disabledOptional: new Set(['mods/opt.jar']) })
  assert.deepEqual(r3.downloaded, ['mods/c.jar'])
  assert.deepEqual(r3.removed.sort(), ['mods/b.jar', 'mods/opt.jar'])
  assert.deepEqual(r3.quarantined, ['extra.jar'])
  assert.equal(readFileSync(path.join(instance, 'mods-disabled/extra.jar'), 'utf8'), 'not in the pack', 'stray mods are moved, never deleted')
  assert.equal(readFileSync(path.join(instance, 'config/x.toml'), 'utf8'), 'x=player', 'config the admin did not change keeps the player edit')
  assert.equal(readFileSync(path.join(instance, 'options.txt'), 'utf8'), 'fov:110', 'options.txt is only written once')
  assert.equal(r3.state.packVersion, '1.1.0')

  // v3: the admin ships a new version of the config, so it replaces the player's copy.
  const v3 = parseMrpack(makeMrpack({ versionId: '1.2.0', files: v2Files }, { 'client-overrides/config/x.toml': 'x=3' }))
  const r4 = await syncPack({ ...base, pack: v3, packSha1: '3'.repeat(40), previous: r3.state })
  assert.equal(readFileSync(path.join(instance, 'config/x.toml'), 'utf8'), 'x=3')
  assert.deepEqual(r4.downloaded, ['mods/opt.jar'], 're-enabling an optional mod downloads it again')
})

test('scripts and configs the pack drops are removed, unless someone edited them', async (t) => {
  const { dir, cleanup } = tempDir()
  t.after(cleanup)
  const base = { instanceDir: dir, strictMods: false, verify: 'fast' as const, disabledOptional: new Set<string>() }
  const v1 = parseMrpack(
    makeMrpack(
      { files: [] },
      {
        'overrides/kubejs/server_scripts/old.js': 'old()',
        'overrides/kubejs/server_scripts/tweaked.js': 'tweak()',
        'overrides/config/ftbquests/quests/chapters/renamed.snbt': '{}'
      }
    )
  )
  const r1 = await syncPack({ ...base, pack: v1, packSha1: '1'.repeat(40), previous: null })
  writeFileSync(path.join(dir, 'kubejs/server_scripts/tweaked.js'), 'tweak(); mine()')

  const v2 = parseMrpack(makeMrpack({ files: [] }, { 'overrides/config/ftbquests/quests/chapters/new_name.snbt': '{}' }))
  const r2 = await syncPack({ ...base, pack: v2, packSha1: '2'.repeat(40), previous: r1.state })
  assert.deepEqual(r2.removed.sort(), ['config/ftbquests/quests/chapters/renamed.snbt', 'kubejs/server_scripts/old.js'])
  assert.equal(existsSync(path.join(dir, 'config/ftbquests/quests/chapters/new_name.snbt')), true)
  assert.equal(readFileSync(path.join(dir, 'kubejs/server_scripts/tweaked.js'), 'utf8'), 'tweak(); mine()', 'edited files stay')
  assert.equal(existsSync(path.join(dir, 'config/ftbquests/quests/chapters')), true, 'folders still in use stay')

  const v3 = parseMrpack(makeMrpack({ files: [] }, { 'overrides/config/other.toml': 'a=1' }))
  await syncPack({ ...base, pack: v3, packSha1: '3'.repeat(40), previous: (await syncPack({ ...base, pack: v2, packSha1: '2'.repeat(40), previous: r2.state })).state })
  assert.equal(existsSync(path.join(dir, 'config/ftbquests')), false, 'folders emptied by the cleanup are removed')
  assert.equal(existsSync(path.join(dir, 'config/other.toml')), true)
  assert.equal(existsSync(path.join(dir, 'kubejs/server_scripts/tweaked.js')), true)
})

test('damaged mods are detected and replaced', async (t) => {
  const { dir, cleanup } = tempDir()
  t.after(cleanup)
  const srv = await fileServer({ '/a.jar': 'AAAA' })
  t.after(srv.close)
  const instance = path.join(dir, 'instance')
  const pack = parseMrpack(makeMrpack({ files: [packFile('mods/a.jar', 'AAAA', srv.url('/a.jar'))] }))
  const base = { instanceDir: instance, pack, packSha1: '1'.repeat(40), strictMods: true, disabledOptional: new Set<string>() }
  const first = await syncPack({ ...base, previous: null, verify: 'fast' })
  const jar = path.join(instance, 'mods/a.jar')

  // Same size, different content, new mtime: the fast check notices the mtime and re-hashes.
  writeFileSync(jar, 'ZZZZ')
  const fixed = await syncPack({ ...base, previous: first.state, verify: 'fast' })
  assert.deepEqual(fixed.downloaded, ['mods/a.jar'])
  assert.equal(readFileSync(jar, 'utf8'), 'AAAA')

  // A same-size edit whose size+mtime match the recorded state slips past 'fast' (that trust is what
  // keeps normal launches instant), but a repair ('full') re-hashes everything.
  writeFileSync(jar, 'ZZZZ')
  const st = statSync(jar)
  const recorded = fixed.state.files['mods/a.jar']
  const forged = { ...fixed.state, files: { ...fixed.state.files, 'mods/a.jar': { ...recorded, size: st.size, mtimeMs: st.mtimeMs } } }
  const trusted = await syncPack({ ...base, previous: forged, verify: 'fast' })
  assert.deepEqual(trusted.downloaded, [])
  const repaired = await syncPack({ ...base, previous: forged, verify: 'full' })
  assert.deepEqual(repaired.downloaded, ['mods/a.jar'])
  assert.equal(readFileSync(jar, 'utf8'), 'AAAA')
})

test('a download that does not match its hash fails and leaves nothing behind', async (t) => {
  const { dir, cleanup } = tempDir()
  t.after(cleanup)
  const srv = await fileServer({ '/a.jar': 'EVIL' })
  t.after(srv.close)
  const instance = path.join(dir, 'instance')
  const pack = parseMrpack(makeMrpack({ files: [packFile('mods/a.jar', 'AAAA', srv.url('/a.jar'))] }))
  await assert.rejects(
    syncPack({ instanceDir: instance, pack, packSha1: '1'.repeat(40), previous: null, strictMods: true, verify: 'fast', disabledOptional: new Set() }),
    DownloadError
  )
  assert.deepEqual(readdirSync(path.join(instance, 'mods')), [], 'no partial or bad file is left in mods/')
})
