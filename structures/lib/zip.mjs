// A minimal zip reader (enough for mod jars): lists entries and inflates the ones asked for.

import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

/** Opens a zip file; returns { names, read(name) → Buffer }. */
export function openZip(file) {
  const buf = readFileSync(file)
  // The end-of-central-directory record is in the last 64 KiB (it may be followed by a comment).
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error(`${file}: not a zip`)
  const count = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const entries = new Map()
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error(`${file}: bad central directory`)
    const method = buf.readUInt16LE(at + 10)
    const compressed = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    entries.set(name, { method, compressed, local })
    at += 46 + nameLen + extraLen + commentLen
  }
  return {
    names: [...entries.keys()],
    read(name) {
      const e = entries.get(name)
      if (!e) throw new Error(`${file}: no entry ${name}`)
      const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28)
      const data = buf.subarray(start, start + e.compressed)
      if (e.method === 0) return Buffer.from(data)
      if (e.method === 8) return inflateRawSync(data)
      throw new Error(`${file}: ${name} uses compression method ${e.method}`)
    }
  }
}
