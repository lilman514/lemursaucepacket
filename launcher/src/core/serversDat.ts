// Writes a minimal servers.dat (uncompressed NBT) so the SMP shows up in the Multiplayer list.

function nbtString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8')
  const len = Buffer.alloc(2)
  len.writeUInt16BE(bytes.length)
  return Buffer.concat([len, bytes])
}

function namedTag(type: number, name: string, payload: Buffer): Buffer {
  return Buffer.concat([Buffer.from([type]), nbtString(name), payload])
}

const TAG_END = 0
const TAG_STRING = 8
const TAG_LIST = 9
const TAG_COMPOUND = 10

export function serversDat(servers: { name: string; ip: string }[]): Buffer {
  const entries = servers.map((s) =>
    Buffer.concat([namedTag(TAG_STRING, 'name', nbtString(s.name)), namedTag(TAG_STRING, 'ip', nbtString(s.ip)), Buffer.from([TAG_END])])
  )
  const count = Buffer.alloc(4)
  count.writeInt32BE(entries.length)
  const list = namedTag(TAG_LIST, 'servers', Buffer.concat([Buffer.from([TAG_COMPOUND]), count, ...entries]))
  return namedTag(TAG_COMPOUND, '', Buffer.concat([list, Buffer.from([TAG_END])]))
}
