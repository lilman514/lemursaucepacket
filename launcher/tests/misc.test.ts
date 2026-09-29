import assert from 'node:assert/strict'
import net, { type AddressInfo } from 'node:net'
import { test } from 'node:test'
import { compareVersions, validateFeed } from '../src/core/feed'
import { offlineUuid } from '../src/core/launch'
import { componentToText, pingServer, readVarInt, writeVarInt } from '../src/core/ping'
import { serversDat } from '../src/core/serversDat'

test('VarInt round-trips', () => {
  for (const n of [0, 1, 127, 128, 255, 25565, 2 ** 31 - 1, -1]) {
    const decoded = readVarInt(writeVarInt(n), 0)
    assert.equal(decoded?.value, n)
  }
  assert.equal(readVarInt(Buffer.from([0x80]), 0), null, 'incomplete VarInt waits for more data')
})

test('chat components flatten to plain text', () => {
  assert.equal(componentToText('§aHello §lworld'), 'Hello world')
  assert.equal(componentToText({ text: 'Create ', extra: [{ text: '§6SMP' }, ' · ok'] }), 'Create SMP · ok')
})

test('pingServer reads a status response and reports offline servers', async (t) => {
  const json = JSON.stringify({
    version: { name: 'NeoForge 1.21.1', protocol: 767 },
    players: { max: 20, online: 3, sample: [{ name: 'Alex', id: '00000000-0000-0000-0000-000000000000' }] },
    description: { text: 'Welcome ', extra: [{ text: 'aboard' }] }
  })
  const server = net.createServer((socket) => {
    socket.once('data', () => {
      const str = Buffer.from(json, 'utf8')
      const payload = Buffer.concat([writeVarInt(0), writeVarInt(str.length), str])
      // Send in two chunks to exercise buffering.
      const packet = Buffer.concat([writeVarInt(payload.length), payload])
      socket.write(packet.subarray(0, 5))
      setTimeout(() => socket.write(packet.subarray(5)), 10)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  t.after(() => server.close())

  const status = await pingServer('127.0.0.1', port, 2000)
  assert.equal(status.online, true)
  assert.equal(status.version, 'NeoForge 1.21.1')
  assert.deepEqual(status.players, { online: 3, max: 20, sample: ['Alex'] })
  assert.equal(status.motd, 'Welcome aboard')

  const closed = net.createServer()
  await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r))
  const deadPort = (closed.address() as AddressInfo).port
  await new Promise<void>((r) => closed.close(() => r()))
  const offline = await pingServer('127.0.0.1', deadPort, 2000)
  assert.equal(offline.online, false)
  assert.equal(offline.error, 'Server is offline')
})

test('servers.dat is valid NBT with one entry', () => {
  const expected = Buffer.concat([
    Buffer.from([0x0a, 0x00, 0x00]), // root compound ""
    Buffer.from([0x09, 0x00, 0x07]),
    Buffer.from('servers'),
    Buffer.from([0x0a, 0x00, 0x00, 0x00, 0x01]), // list of 1 compound
    Buffer.from([0x08, 0x00, 0x04]),
    Buffer.from('name'),
    Buffer.from([0x00, 0x03]),
    Buffer.from('SMP'),
    Buffer.from([0x08, 0x00, 0x02]),
    Buffer.from('ip'),
    Buffer.from([0x00, 0x0b]),
    Buffer.from('mc.host:123'),
    Buffer.from([0x00, 0x00]) // end entry, end root
  ])
  assert.deepEqual(serversDat([{ name: 'SMP', ip: 'mc.host:123' }]), expected)
})

test('offline UUIDs match what the vanilla game derives', () => {
  // Well-known value for "Notch" in offline mode.
  assert.equal(offlineUuid('Notch'), 'b50ad385829d3141a2167e7d7539ba7f')
})

test('compareVersions and feed validation', () => {
  assert.ok(compareVersions('0.1.0', '0.2.0') < 0)
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0)
  assert.equal(compareVersions('1.0', '1.0.0'), 0)
  assert.throws(() => validateFeed({ schema: 2 }), /schema/)
  assert.throws(() => validateFeed({ schema: 1, server: { address: 'x' }, pack: { url: 'p.mrpack', sha1: 'bad' } }), /pack/)
  const ok = validateFeed({ schema: 1, name: 'x', server: { address: 'mc.example.com' }, pack: { version: '1', url: 'p.mrpack', sha1: 'A'.repeat(40) } })
  assert.equal(ok.pack.sha1, 'a'.repeat(40))
})
