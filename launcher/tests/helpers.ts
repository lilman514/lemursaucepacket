import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { zipSync } from 'fflate'
import type { MrpackFile, MrpackIndex } from '../src/core/mrpack'

export const sha1 = (data: string | Uint8Array): string => createHash('sha1').update(data).digest('hex')
export const sha512 = (data: string | Uint8Array): string => createHash('sha512').update(data).digest('hex')

export function tempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'smp-launcher-test-'))
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

/** Tiny HTTP server serving an in-memory file map; counts requests per path. */
export async function fileServer(files: Record<string, string | Uint8Array>): Promise<{ url: (p: string) => string; hits: Map<string, number>; close: () => Promise<void> }> {
  const hits = new Map<string, number>()
  const server = http.createServer((req, res) => {
    const p = new URL(req.url ?? '/', 'http://x').pathname
    hits.set(p, (hits.get(p) ?? 0) + 1)
    const body = files[p]
    if (body === undefined) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-length': Buffer.byteLength(body) }).end(body)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  return {
    url: (p) => `http://127.0.0.1:${port}${p}`,
    hits,
    close: () => new Promise((r) => server.close(() => r()))
  }
}

export function packFile(rel: string, content: string, url: string, env?: MrpackFile['env']): MrpackFile {
  return { path: rel, hashes: { sha1: sha1(content), sha512: sha512(content) }, env, downloads: [url], fileSize: Buffer.byteLength(content) }
}

export function makeMrpack(index: Partial<MrpackIndex> & { files: MrpackFile[] }, extra: Record<string, string> = {}): Uint8Array {
  const full: MrpackIndex = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '1.0.0',
    name: 'Test Pack',
    dependencies: { minecraft: '1.21.1', neoforge: '21.1.252' },
    ...index
  }
  const entries: Record<string, Uint8Array> = { 'modrinth.index.json': new TextEncoder().encode(JSON.stringify(full)) }
  for (const [name, content] of Object.entries(extra)) entries[name] = new TextEncoder().encode(content)
  return zipSync(entries)
}
