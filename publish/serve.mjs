#!/usr/bin/env node
// Serves site/ on http://localhost:8787 so you can test the launcher before deploying anything.
// Usage: node publish/serve.mjs [port]

import { createReadStream, statSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site')
const port = Number(process.argv[2] ?? process.env.PORT ?? 8787)
const TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.mrpack': 'application/zip',
  '.yml': 'text/yaml; charset=utf-8',
  '.exe': 'application/octet-stream',
  '.blockmap': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.html': 'text/html; charset=utf-8'
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    const file = path.resolve(siteDir, '.' + urlPath)
    if (!file.startsWith(siteDir + path.sep)) {
      res.writeHead(403).end()
      return
    }
    let st
    try {
      st = statSync(file)
    } catch {
      res.writeHead(404).end('not found')
      console.log(`404 ${urlPath}`)
      return
    }
    if (!st.isFile()) {
      res.writeHead(404).end('not found')
      return
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-cache'
    })
    createReadStream(file).pipe(res)
    console.log(`200 ${urlPath}`)
  })
  .listen(port, () => console.log(`Serving ${siteDir} at http://localhost:${port}/launcher.json`))
