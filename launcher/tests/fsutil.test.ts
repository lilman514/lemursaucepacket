import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { normalizeRelative, safeJoin, UnsafePathError } from '../src/core/fsutil'

test('normalizeRelative accepts ordinary pack paths', () => {
  assert.equal(normalizeRelative('mods/create.jar'), 'mods/create.jar')
  assert.equal(normalizeRelative('config\\create-common.toml'), 'config/create-common.toml')
  assert.equal(normalizeRelative('./config//jei/./jei.toml'), 'config/jei/jei.toml')
})

test('normalizeRelative rejects anything that could escape the game folder', () => {
  for (const bad of [
    '../evil.jar',
    'mods/../../evil.jar',
    '/etc/passwd',
    '\\\\server\\share\\x',
    'C:\\Windows\\system32\\x.dll',
    'c:relative',
    'mods/evil.jar:stream',
    'con',
    'mods/NUL.txt',
    'mods/a|b.jar',
    '',
    '.',
    'mods/\0.jar'
  ]) {
    assert.throws(() => normalizeRelative(bad), UnsafePathError, `should reject ${JSON.stringify(bad)}`)
  }
})

test('safeJoin keeps results inside the root', () => {
  const root = path.resolve('/tmp/instance')
  assert.equal(safeJoin(root, 'mods/a.jar'), path.join(root, 'mods', 'a.jar'))
  assert.throws(() => safeJoin(root, '../instance-evil/a.jar'), UnsafePathError)
})
