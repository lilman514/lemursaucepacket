// Minecraft "Server List Ping" — the same status query the multiplayer menu uses.
// https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping

import { resolveSrv } from 'node:dns/promises'
import net from 'node:net'
import type { ServerStatus } from '../shared/types'

export function writeVarInt(value: number): Buffer {
  const bytes: number[] = []
  let v = value >>> 0
  do {
    let b = v & 0x7f
    v >>>= 7
    if (v !== 0) b |= 0x80
    bytes.push(b)
  } while (v !== 0)
  return Buffer.from(bytes)
}

export function readVarInt(buf: Buffer, offset: number): { value: number; size: number } | null {
  let value = 0
  let shift = 0
  let i = offset
  for (;;) {
    if (i >= buf.length) return null
    const b = buf[i++]
    value |= (b & 0x7f) << shift
    if ((b & 0x80) === 0) break
    shift += 7
    if (shift > 28) throw new Error('VarInt too long')
  }
  return { value, size: i - offset }
}

function mcString(s: string): Buffer {
  const bytes = Buffer.from(s, 'utf8')
  return Buffer.concat([writeVarInt(bytes.length), bytes])
}

function packet(id: number, ...fields: Buffer[]): Buffer {
  const body = Buffer.concat([writeVarInt(id), ...fields])
  return Buffer.concat([writeVarInt(body.length), body])
}

export async function resolveAddress(host: string, port?: number): Promise<{ host: string; port: number }> {
  if (port) return { host, port }
  if (net.isIP(host) === 0 && host !== 'localhost') {
    try {
      const records = await resolveSrv(`_minecraft._tcp.${host}`)
      if (records.length > 0) return { host: records[0].name, port: records[0].port }
    } catch {
      // No SRV record; use the default port.
    }
  }
  return { host, port: 25565 }
}

type Component = string | { text?: string; translate?: string; extra?: Component[] }

/** Flatten a chat component (or legacy string) to plain text without § formatting codes. */
export function componentToText(c: Component | undefined): string {
  if (c === undefined || c === null) return ''
  if (typeof c === 'string') return c.replace(/§./g, '')
  const own = (c.text ?? c.translate ?? '').replace(/§./g, '')
  return own + (c.extra ?? []).map(componentToText).join('')
}

export function pingServer(address: string, port?: number, timeoutMs = 5000): Promise<ServerStatus> {
  return resolveAddress(address, port).then(
    (target) =>
      new Promise<ServerStatus>((resolve) => {
        const started = Date.now()
        let buffer = Buffer.alloc(0)
        let settled = false
        const socket = net.createConnection({ host: target.host, port: target.port })
        const finish = (status: ServerStatus): void => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          socket.destroy()
          resolve(status)
        }
        const timer = setTimeout(() => finish({ online: false, error: 'No response' }), timeoutMs)

        socket.on('connect', () => {
          const portBytes = Buffer.alloc(2)
          portBytes.writeUInt16BE(target.port)
          // Handshake (protocol -1 = "just asking"), next state 1 = status; then the status request.
          socket.write(packet(0x00, writeVarInt(-1), mcString(target.host), portBytes, writeVarInt(1)))
          socket.write(packet(0x00))
        })
        socket.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk])
          try {
            const length = readVarInt(buffer, 0)
            if (!length || buffer.length < length.size + length.value) return
            const id = readVarInt(buffer, length.size)
            if (!id || id.value !== 0x00) return finish({ online: false, error: 'Unexpected reply' })
            const strLen = readVarInt(buffer, length.size + id.size)
            if (!strLen) return
            const start = length.size + id.size + strLen.size
            const json = JSON.parse(buffer.subarray(start, start + strLen.value).toString('utf8')) as {
              version?: { name?: string }
              players?: { online?: number; max?: number; sample?: { name: string }[] }
              description?: Component
              favicon?: string
            }
            finish({
              online: true,
              latencyMs: Date.now() - started,
              version: json.version?.name,
              players: {
                online: json.players?.online ?? 0,
                max: json.players?.max ?? 0,
                sample: (json.players?.sample ?? []).map((p) => p.name).filter((n) => n && !n.startsWith('§'))
              },
              motd: componentToText(json.description).trim(),
              favicon: json.favicon?.startsWith('data:image/') ? json.favicon : undefined
            })
          } catch (e) {
            finish({ online: false, error: (e as Error).message })
          }
        })
        socket.on('error', (e: NodeJS.ErrnoException) => {
          const friendly: Record<string, string> = {
            ECONNREFUSED: 'Server is offline',
            ENOTFOUND: 'Address not found',
            ETIMEDOUT: 'No response',
            EHOSTUNREACH: 'Host unreachable'
          }
          finish({ online: false, error: friendly[e.code ?? ''] ?? e.message })
        })
      })
  )
}
