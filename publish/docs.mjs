#!/usr/bin/env node
// Renders the wiki (docs/, GitBook layout) to site/wiki/ as plain HTML in the pack's brass-and-iron look, so the
// same pages are on GitHub Pages next to the launcher feed as well as in GitBook. Also writes docs/mods.md from
// the pack's mod list and the keybind tables in docs/keybinds.md (publish/keybinds.mjs), so those never go stale.
//
// The pages are GitBook markdown: optional front matter (description, icon, cover), {% hint %} callouts, <figure>
// pictures with captions, and on the front page a cards table (<table data-view="cards">). GitBook reads them as
// they are; this script turns the same constructs into HTML of its own (publish/patchouli.mjs does the in-game book).
// The Keybinds page gets an interactive keyboard here in place of its tables (GitBook keeps the tables).
//
//   node publish/docs.mjs        (publish.mjs runs it too)

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { buildKeybinds } from './keybinds.mjs'

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
  const text = `---
description: Every mod in the pack, generated from its mod list.
icon: puzzle-piece
---

# Mods in the pack

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

/**
 * Splits a page's front matter from its markdown. Handles what the wiki uses: `key: value` lines, quoted values and
 * folded `key: >-` blocks; nested blocks (GitBook's `layout:`) are skipped.
 */
function frontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
  if (!m) return { data: {}, body: text }
  const data = {}
  const lines = m[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i])
    if (!kv) continue
    let value = kv[2].trim()
    if (value === '>-' || value === '>' || value === '|' || value === '') {
      const block = []
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) block.push(lines[++i].trim())
      if (value === '') continue
      value = block.join(' ')
    }
    data[kv[1]] = value.replace(/^(['"])(.*)\1$/, '$2')
  }
  return { data, body: text.slice(m[0].length) }
}

const CSS = `
:root{--bg:#191715;--card:#2a2624;--line:#87591a;--text:#f1e4c2;--muted:#b9a98a;--accent:#e0ac46;--hi:#f8d982;--edge:#3a3430}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 'Segoe UI',system-ui,sans-serif}
a{color:var(--hi)}a:hover{color:#fff}
.wrap{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh}
nav{background:#201d1b;border-right:2px solid var(--line);padding:22px 18px;position:sticky;top:0;height:100vh;overflow:auto}
nav .home{display:block;margin:0 0 18px;color:var(--accent);font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:13px;text-decoration:none}
nav h3{margin:18px 0 8px;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#7d7367}
nav ul{list-style:none;margin:0;padding:0}nav li{margin:0 0 5px}nav a{text-decoration:none;color:var(--muted)}nav a.active,nav a:hover{color:var(--hi)}
nav .site{display:inline-block;margin-top:22px;padding:7px 12px;border:1px solid var(--line);border-radius:4px;font-size:14px}
main{padding:0 0 60px;max-width:980px}
.inner{padding:32px 44px 0}
.cover{height:300px;background-size:cover;background-position:center;border-bottom:2px solid var(--line);position:relative}
.cover::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,var(--bg),rgba(25,23,21,0) 60%)}
main h1{margin:0 0 10px;font-size:34px;color:var(--hi)}
.lead{margin:0 0 22px;color:var(--muted);font-size:18px}
main h2{margin:34px 0 10px;font-size:22px;color:var(--accent);border-bottom:1px solid var(--edge);padding-bottom:6px}
main h3{margin:24px 0 8px;font-size:18px;color:var(--text)}
main img{max-width:100%;height:auto;border:2px solid var(--line);box-shadow:0 0 0 1px #14110d,0 12px 30px rgba(0,0,0,.5)}
figure{margin:18px 0 24px}figure img{display:block}figcaption{margin-top:8px;color:var(--muted);font-size:14px;text-align:center}figcaption p{margin:0}
table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid var(--edge);padding:6px 10px;text-align:left;vertical-align:top}th{background:#201d1b;color:var(--accent)}
code{background:#141210;padding:1px 5px;border:1px solid var(--edge);font-size:14px}pre{background:#141210;border:1px solid var(--edge);padding:12px;overflow:auto}
blockquote{margin:12px 0;padding:8px 14px;border-left:3px solid var(--accent);background:#201d1b;color:var(--muted)}
.hint{margin:16px 0;padding:12px 16px;border:1px solid var(--edge);border-left:4px solid #6fb7e8;border-radius:4px;background:#1f1d1c}
.hint p:last-child{margin-bottom:0}.hint p:first-child{margin-top:0}
.hint-success{border-left-color:#8fc44a}.hint-warning{border-left-color:#f2b441}.hint-danger{border-left-color:#e8623a}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin:18px 0 26px}
.cards a{display:block;border:1px solid var(--edge);border-radius:6px;overflow:hidden;background:#211e1c;color:var(--text);text-decoration:none}
.cards a:hover{border-color:var(--accent)}
.cards img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border:0;box-shadow:none}
.cards strong{display:block;padding:10px 12px 2px;color:var(--hi)}.cards span{display:block;padding:0 12px 12px;color:var(--muted);font-size:14px}
.foot{margin-top:40px;color:var(--muted);font-size:13px}
@media(max-width:820px){.wrap{grid-template-columns:1fr}nav{position:static;height:auto;border-right:0;border-bottom:2px solid var(--line)}.inner{padding:22px 18px 0}.cover{height:180px}}
`

const htmlName = (file) => (file === 'README.md' ? 'index.html' : file.replace(/\.md$/, '.html'))

/** Pages that were renamed: the old address keeps working as a redirect to the new page. */
const MOVED = { 'keys.md': 'keybinds.md' }

function redirectPage(to, title) {
  const href = htmlName(to)
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title} · LemurSaucePacket wiki</title><meta name="robots" content="noindex">` +
    `<meta http-equiv="refresh" content="0; url=${href}"><link rel="canonical" href="${href}"><script>location.replace('${href}' + location.hash)</script></head>` +
    `<body style="background:#191715;color:#f1e4c2;font:16px/1.6 'Segoe UI',system-ui,sans-serif;padding:24px"><p>This page is now <a href="${href}" style="color:#f8d982">${title}</a>.</p></body></html>`
  )
}

/** Links between pages (with or without an anchor), in markdown and in HTML attributes. */
const relink = (text) =>
  text
    .replace(/\((README)\.md(#[^)]*)?\)/g, (_, _n, hash) => `(index.html${hash ?? ''})`)
    .replace(/\(([a-z0-9-]+)\.md(#[^)]*)?\)/g, (_, name, hash) => `(${name}.html${hash ?? ''})`)
    .replace(/href="README\.md(#[^"]*)?"/g, (_, hash) => `href="index.html${hash ?? ''}"`)
    .replace(/href="([a-z0-9-]+)\.md(#[^"]*)?"/g, (_, name, hash) => `href="${name}.html${hash ?? ''}"`)

/** A GitBook cards table → a grid of linked cards: title (bold cell), text, cover file, target page. */
function cards(table) {
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].slice(1)
  const items = rows.map((row) => {
    const cells = [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => c[1])
    const title = cells[0]?.replace(/<[^>]+>/g, '') ?? ''
    const text = cells[1]?.replace(/<[^>]+>/g, '') ?? ''
    const cover = /href="([^"]+)"/.exec(cells[2] ?? '')?.[1]
    const target = /href="([^"]+)"/.exec(cells[3] ?? '')?.[1] ?? '#'
    return `<a href="${target}">${cover ? `<img src="${cover}" alt="" loading="lazy">` : ''}<strong>${title}</strong><span>${text}</span></a>`
  })
  return `<div class="cards">${items.join('')}</div>`
}

/** GitBook markdown → HTML: hints become callouts, cards tables become a grid, everything else goes to marked. */
function toHtml(markdown) {
  let text = relink(markdown)
  text = text.replace(/<table data-view="cards">[\s\S]*?<\/table>/g, (t) => cards(t))
  text = text.replace(/{% hint style="(\w+)" %}([\s\S]*?){% endhint %}/g, (_, style, inner) => `<div class="hint hint-${style}">\n\n${inner.trim()}\n\n</div>`)
  return marked.parse(text)
}

function render(keybinds) {
  const summary = readFileSync(path.join(docsDir, 'SUMMARY.md'), 'utf8')
  // SUMMARY.md: "## Group" headings (GitBook sidebar groups) and "* [Title](file.md)" entries.
  const nav = []
  for (const line of summary.split(/\r?\n/)) {
    const group = /^##\s+(.+)$/.exec(line)
    if (group) nav.push({ group: group[1].trim() })
    const entry = /^\s*\*\s+\[([^\]]+)\]\(([^)]+)\)/.exec(line)
    if (entry) nav.push({ title: entry[1], file: entry[2] })
  }
  const pages = nav.filter((n) => n.file)
  mkdirSync(outDir, { recursive: true })
  cpSync(path.join(docsDir, 'images'), path.join(outDir, 'images'), { recursive: true })
  for (const page of pages) {
    const source = path.join(docsDir, page.file)
    if (!existsSync(source)) continue
    const { data, body } = frontMatter(readFileSync(source, 'utf8'))
    // The Keybinds page: the keyboard and its list stand where the markdown has its tables.
    const keyboard = page.file === 'keybinds.md' ? keybinds : null
    let html = toHtml(keyboard ? body.replace(keyboard.region, '<!-- keyboard -->') : body)
    if (keyboard) html = html.replace('<!-- keyboard -->', () => keyboard.html)
    // The description sits under the page title, as in GitBook.
    if (data.description) html = html.replace(/<\/h1>/, `</h1><p class="lead">${data.description}</p>`)
    const cover = data.cover ? `<div class="cover" style="background-image:url('${data.cover}')"></div>` : ''
    const links = nav
      .map((n) => (n.group ? `</ul><h3>${n.group}</h3><ul>` : `<li><a href="${htmlName(n.file)}"${n.file === page.file ? ' class="active"' : ''}>${n.title}</a></li>`))
      .join('')
    const title = /^#\s+(.+)$/m.exec(body)?.[1] ?? page.title
    const doc =
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · LemurSaucePacket wiki</title>` +
      (data.description ? `<meta name="description" content="${data.description.replace(/"/g, '&quot;')}">` : '') +
      `<style>${CSS}${keyboard ? keyboard.css : ''}</style></head><body><div class="wrap"><nav><a class="home" href="index.html">LemurSaucePacket wiki</a><ul>${links}</ul><a class="site" href="https://play.limas.ca">play.limas.ca ↗</a></nav>` +
      `<main>${cover}<div class="inner">${html}<p class="foot">Generated from the pack's docs folder on ${new Date().toISOString().slice(0, 10)}.</p></div></main></div>` +
      `${keyboard ? `<script>${keyboard.js}</script>` : ''}</body></html>`
    writeFileSync(path.join(outDir, htmlName(page.file)), doc.replace('<ul></ul>', ''))
  }
  for (const [from, to] of Object.entries(MOVED)) {
    const target = pages.find((p) => p.file === to)
    if (target) writeFileSync(path.join(outDir, htmlName(from)), redirectPage(to, target.title))
  }
  return pages.length
}

const modCount = writeModsPage()
const keybinds = buildKeybinds()
const pageCount = render(keybinds)
console.log(`wiki: ${pageCount} pages → site/wiki (mods.md lists ${modCount} mods; keybinds.md: ${keybinds.summary})`)
