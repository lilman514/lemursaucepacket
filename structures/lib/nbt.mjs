// A small NBT writer (Java edition, big-endian), enough for structure templates. Values are tagged explicitly
// so a number is never guessed to be the wrong type: int(3), list('int', [1, 2]), compound({ ... }).

import { gunzipSync, gzipSync } from 'node:zlib'

const TAG = { end: 0, byte: 1, short: 2, int: 3, long: 4, float: 5, double: 6, byteArray: 7, string: 8, list: 9, compound: 10, intArray: 11, longArray: 12 }

const tagged = (type, value) => ({ __nbt: type, value })
export const byte = (v) => tagged('byte', v)
export const short = (v) => tagged('short', v)
export const int = (v) => tagged('int', v)
export const long = (v) => tagged('long', BigInt(v))
export const float = (v) => tagged('float', v)
export const double = (v) => tagged('double', v)
export const string = (v) => tagged('string', String(v))
export const list = (type, items) => tagged('list', { type, items })
export const compound = (entries) => tagged('compound', entries)
export const intArray = (v) => tagged('intArray', v)

/** Plain JS values get the obvious tag: strings → string, objects → compound. Numbers must be tagged. */
function normalise(v) {
  if (v && typeof v === 'object' && '__nbt' in v) return v
  if (typeof v === 'string') return string(v)
  if (typeof v === 'boolean') return byte(v ? 1 : 0)
  if (v && typeof v === 'object' && !Array.isArray(v)) return compound(v)
  throw new Error(`NBT value needs an explicit type: ${JSON.stringify(v)}`)
}

class Writer {
  constructor() {
    this.chunks = []
  }
  raw(buf) {
    this.chunks.push(buf)
  }
  u8(v) {
    const b = Buffer.alloc(1)
    b.writeInt8(v)
    this.raw(b)
  }
  i16(v) {
    const b = Buffer.alloc(2)
    b.writeInt16BE(v)
    this.raw(b)
  }
  i32(v) {
    const b = Buffer.alloc(4)
    b.writeInt32BE(v)
    this.raw(b)
  }
  str(s) {
    const b = Buffer.from(s, 'utf8') // fine for the ASCII ids and names used here (Java uses modified UTF-8)
    const len = Buffer.alloc(2)
    len.writeUInt16BE(b.length)
    this.raw(len)
    this.raw(b)
  }
  payload(type, value) {
    switch (type) {
      case 'byte': return this.u8(value)
      case 'short': return this.i16(value)
      case 'int': return this.i32(value)
      case 'long': {
        const b = Buffer.alloc(8)
        b.writeBigInt64BE(value)
        return this.raw(b)
      }
      case 'float': {
        const b = Buffer.alloc(4)
        b.writeFloatBE(value)
        return this.raw(b)
      }
      case 'double': {
        const b = Buffer.alloc(8)
        b.writeDoubleBE(value)
        return this.raw(b)
      }
      case 'string': return this.str(value)
      case 'intArray': {
        this.i32(value.length)
        for (const x of value) this.i32(x)
        return
      }
      case 'list': {
        const { type: inner, items } = value
        this.u8(items.length === 0 && inner === 'end' ? TAG.end : TAG[inner])
        this.i32(items.length)
        for (const item of items) {
          const n = normalise(item)
          if (n.__nbt !== inner) throw new Error(`list of ${inner} holds a ${n.__nbt}`)
          this.payload(inner, n.value)
        }
        return
      }
      case 'compound': {
        for (const [k, v] of Object.entries(value)) {
          if (v === undefined) continue
          const n = normalise(v)
          this.u8(TAG[n.__nbt])
          this.str(k)
          this.payload(n.__nbt, n.value)
        }
        return this.u8(TAG.end)
      }
      default:
        throw new Error(`unknown NBT type ${type}`)
    }
  }
}

/** The bytes of a named root compound (the root name is empty for structure files). */
export function encode(root, name = '') {
  const w = new Writer()
  const n = normalise(root)
  w.u8(TAG.compound)
  w.str(name)
  w.payload('compound', n.value)
  return Buffer.concat(w.chunks)
}

/** Gzipped, as Minecraft stores .nbt structure files. */
export const encodeGzip = (root) => gzipSync(encode(root))

// ---------------------------------------------------------------- reading (baked templates come back from the game)

const NAMES = Object.fromEntries(Object.entries(TAG).map(([k, v]) => [v, k]))

/** Decodes NBT bytes (gzipped or not) into plain JS: compounds → objects, lists → arrays, longs → BigInt. */
export function decode(bytes) {
  let buf = Buffer.from(bytes)
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)
  let at = 0
  const u8 = () => buf.readInt8(at++)
  const i16 = () => {
    const v = buf.readInt16BE(at)
    at += 2
    return v
  }
  const i32 = () => {
    const v = buf.readInt32BE(at)
    at += 4
    return v
  }
  const str = () => {
    const len = buf.readUInt16BE(at)
    at += 2
    const s = buf.toString('utf8', at, at + len)
    at += len
    return s
  }
  const read = (type) => {
    switch (NAMES[type]) {
      case 'byte': return u8()
      case 'short': return i16()
      case 'int': return i32()
      case 'long': {
        const v = buf.readBigInt64BE(at)
        at += 8
        return v
      }
      case 'float': {
        const v = buf.readFloatBE(at)
        at += 4
        return v
      }
      case 'double': {
        const v = buf.readDoubleBE(at)
        at += 8
        return v
      }
      case 'byteArray': {
        const n = i32()
        const v = [...buf.subarray(at, at + n)]
        at += n
        return v
      }
      case 'string': return str()
      case 'list': {
        const inner = u8()
        const n = i32()
        const out = []
        for (let i = 0; i < n; i++) out.push(read(inner))
        return out
      }
      case 'compound': {
        const out = {}
        for (;;) {
          const t = u8()
          if (t === TAG.end) return out
          const name = str()
          out[name] = read(t)
        }
      }
      case 'intArray': {
        const n = i32()
        const out = []
        for (let i = 0; i < n; i++) out.push(i32())
        return out
      }
      case 'longArray': {
        const n = i32()
        const out = []
        for (let i = 0; i < n; i++) {
          out.push(buf.readBigInt64BE(at))
          at += 8
        }
        return out
      }
      default:
        throw new Error(`bad NBT tag ${type} at ${at}`)
    }
  }
  const rootType = u8()
  if (rootType !== TAG.compound) throw new Error('NBT root is not a compound')
  str()
  return read(rootType)
}
