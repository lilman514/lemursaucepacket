#!/usr/bin/env node
// Renders the wiki (docs/, GitBook layout) to site/wiki/ as plain HTML in the pack's brass-and-iron look, so the
// same pages are on GitHub Pages next to the launcher feed as well as in GitBook. Also writes docs/mods.md from
// the pack's mod list, so that page never goes stale.
//
//   node publish/docs.mjs        (publish.mjs runs it too)

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const outDir = path.join(root, 'site', 'wiki')

function tomlString(text, key) {
  return new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm').exec(text)?.[1]
}

/** docs/mods.md: every mod in pack/mods, grouped by which side needs it. */
function writeModsPage() {
  const modsDir = path.join(root, 'pack', 'mods')
  const mods = readdirSync(modsDir)
    .filter((f) => f.endsWith('.pw.toml'))
    .map((f) => {
      const text = readFileSync(path.join(modsDir, f), 'utf8')
      const modId = /mod-id\s*=\s*"([^"]*)"/.exec(text)?.[1]
      return { name: tomlString(text, 'name') ?? f, side: tomlString(text, 'side') ?? 'both', url: modId && text.includes('[update.modrinth]') ? `https://modrinth.com/project/${modId}` : undefined }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const list = (side) =>
    mods
      .filter((m) => m.side === side)
      .map((m) => `- ${m.url ? `[${m.name}](${m.url})` : m.name}`)
      .join('\n')
  const text = `# Mods in the pack

${mods.length} mods, kept identical to the server's by the launcher. This page is generated from the pack's mod list, so it's always current.

## On the server and every client (${mods.filter((m) => m.side === 'both').length})

${list('both')}

## Client only (${mods.filter((m) => m.side === 'client').length})

Visuals, sound, performance and interface. The ones marked optional in the launcher's Mods tab can be switched off.

${list('client')}

## Server only (${mods.filter((m) => m.side === 'server').length})

${list('server') || '- (none)'}
`
  writeFileSync(path.join(docsDir, 'mods.md'), text)
  return mods.length
}

const CSS = `
:root{--bg:#191715;--card:#2a2624;--line:#87591a;--text:#f1e4c2;--muted:#b9a98a;--accent:#e0ac46;--hi:#f8d982}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 'Segoe UI',system-ui,sans-serif}
a{color:var(--hi)}a:hover{color:#fff}
.wrap{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}
nav{background:#201d1b;border-right:2px solid var(--line);padding:22px 18px}
nav h2{margin:0 0 14px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
nav ul{list-style:none;margin:0;padding:0}nav li{margin:0 0 6px}nav a{text-decoration:none;color:var(--muted)}nav a.active,nav a:hover{color:var(--hi)}
main{padding:32px 44px 60px;max-width:900px}
main h1{margin:0 0 18px;font-size:32px;color:var(--hi)}main h2{margin:30px 0 10px;font-size:20px;color:var(--accent);border-bottom:1px solid #3a3430;padding-bottom:6px}
main img{max-width:100%;border:2px solid var(--line);box-shadow:0 0 0 1px #14110d,0 12px 30px rgba(0,0,0,.5)}
table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #3a3430;padding:6px 10px;text-align:left;vertical-align:top}th{background:#201d1b;color:var(--accent)}
code{background:#141210;padding:1px 5px;border:1px solid #3a3430;font-size:14px}pre{background:#141210;border:1px solid #3a3430;padding:12px;overflow:auto}
blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid var(--accent);background:#201d1b;color:var(--muted)}
.foot{margin-top:40px;color:var(--muted);font-size:13px}
@media(max-width:760px){.wrap{grid-template-columns:1fr}nav{border-right:0;border-bottom:2px solid var(--line)}main{padding:22px 18px}}
`

function render() {
  const summary = readFileSync(path.join(docsDir, 'SUMMARY.md'), 'utf8')
  const pages = [...summary.matchAll(/\*\s+\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => ({ title: m[1], file: m[2] }))
  mkdirSync(path.join(outDir, 'images'), { recursive: true })
  for (const image of readdirSync(path.join(docsDir, 'images'))) copyFileSync(path.join(docsDir, 'images', image), path.join(outDir, 'images', image))
  const htmlName = (file) => (file === 'README.md' ? 'index.html' : file.replace(/\.md$/, '.html'))
  for (const page of pages) {
    const source = path.join(docsDir, page.file)
    if (!existsSync(source)) continue
    const body = marked.parse(readFileSync(source, 'utf8').replace(/\(([a-z0-9-]+)\.md\)/g, (_, name) => `(${htmlName(`${name}.md`)})`).replace(/\(README\.md\)/g, '(index.html)'))
    const nav = pages.map((p) => `<li><a href="${htmlName(p.file)}"${p.file === page.file ? ' class="active"' : ''}>${p.title}</a></li>`).join('')
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${page.title} · LemurSaucePacket</title><style>${CSS}</style></head><body><div class="wrap"><nav><h2>LemurSaucePacket</h2><ul>${nav}</ul></nav><main>${body}<p class="foot">Generated from the pack's docs folder on ${new Date().toISOString().slice(0, 10)}.</p></main></div></body></html>`
    writeFileSync(path.join(outDir, htmlName(page.file)), html)
  }
  return pages.length
}

const modCount = writeModsPage()
const pageCount = render()
console.log(`wiki: ${pageCount} pages → site/wiki (mods.md lists ${modCount} mods)`)
