#!/usr/bin/env node
// Serves website/ on http://localhost:5050 the way Vercel does: clean URLs (/join → join.html), the redirects in
// vercel.json, and the functions in api/ (/api/hiscores runs api/hiscores.js's GET, with DATABASE_URL from the
// environment). For previewing changes before a deploy.
//
//   node website/tools/serve.mjs [port]

import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.argv[2] ?? 5050)
const config = JSON.parse(readFileSync(path.join(site, 'vercel.json'), 'utf8'))
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' }

/** vercel.json redirect sources: literal paths and one :param segment. */
function redirect(urlPath) {
  for (const r of config.redirects ?? []) {
    const pattern = new RegExp('^' + r.source.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$')
    const m = pattern.exec(urlPath)
    if (m) return r.destination.replace(/:(\w+)/g, (_, k) => m.groups?.[k] ?? '')
  }
  return null
}

/** /api/<name>: the function's handler for the request's method, called with a web Request, as Vercel does. */
async function api(req, res, name) {
  const file = path.join(site, 'api', `${name}.js`)
  if (!/^[a-z0-9-]+$/.test(name) || !existsSync(file)) {
    res.writeHead(404)
    return res.end()
  }
  const handler = (await import(pathToFileURL(file).href))[req.method]
  if (!handler) {
    res.writeHead(405)
    return res.end()
  }
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks)
  const request = new Request(new URL(req.url, `http://localhost:${port}`), { method: req.method, headers: req.headers, body })
  const response = await handler(request)
  res.writeHead(response.status, Object.fromEntries(response.headers))
  res.end(Buffer.from(await response.arrayBuffer()))
}

createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (urlPath.startsWith('/api/')) {
    api(req, res, urlPath.slice(5)).catch((err) => {
      console.error(err)
      res.writeHead(500)
      res.end(String(err))
    })
    return
  }
  const to = redirect(urlPath)
  if (to) {
    res.writeHead(307, { Location: to })
    return res.end()
  }
  let file = path.join(site, urlPath)
  if (!file.startsWith(site)) {
    res.writeHead(403)
    return res.end()
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
  else if (!existsSync(file) && existsSync(file + '.html')) file += '.html'
  if (!existsSync(file) || path.relative(site, file).startsWith('tools')) {
    res.writeHead(404, { 'Content-Type': types['.html'] })
    return res.end(existsSync(path.join(site, '404.html')) ? readFileSync(path.join(site, '404.html')) : 'Not found')
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}).listen(port, () => console.log(`website on http://localhost:${port}`))
