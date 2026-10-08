#!/usr/bin/env node
// Renders the wiki (docs/, GitBook layout) to site/wiki/: the pages GitHub Pages serves next to the launcher feed and
// play.limas.ca/wiki points at, in the website's brass-and-iron look (publish/wiki/wiki.css and wiki.js). Also writes
// docs/mods.md from the pack's mod list and the keybind tables in docs/keybinds.md (publish/keybinds.mjs), so those
// never go stale.
//
// The pages are GitBook markdown, and GitBook reads them as they are. On top of plain markdown this understands:
//   - front matter: description (the line under the title), icon, cover (the picture at the top);
//   - {% hint style="info|success|warning|danger" %} callouts, and {% tabs %} {% tab title="…" %} … {% endtabs %};
//   - <figure> pictures with captions (click to enlarge), <details> sections;
//   - <!-- infobox: Title --> before a two-column table: a RuneScape-wiki style infobox (a row "Image" takes a picture);
//   - a cards table (<table data-view="cards">) as a grid of cards;
//   - <!-- atlas:biomes:forests --> … <!-- /atlas -->: the atlas from wiki/atlas.json (wiki/render.mjs);
//   - SUMMARY.md's groups and nested entries as the contents down the left.
// Every page gets search (site/wiki/search.json, built here), "On this page", and links to the pages either side.
// The front page (README.md) also lists every page by group and the latest news from publish/feed.json.
//
//   node publish/docs.mjs        (publish.mjs runs it too)

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Marked, marked } from 'marked'
import { buildKeybinds } from './keybinds.mjs'
import { banner, expandAtlas } from '../wiki/render.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const outDir = path.join(root, 'site', 'wiki')
const themeDir = path.join(root, 'publish', 'wiki')
const siteAssets = path.join(root, 'website', 'assets')
const REPO = 'https://github.com/lilman514/lemursaucepacket'
const SITE = 'https://play.limas.ca'

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

// ---------------------------------------------------------------- the look: icons and pictures

/** Each page's icon: the website's pixel art (website/assets icons, emblems and skill icons). */
const ICONS = {
  README: 'emblems/mascot.webp',
  'getting-started': 'icons/play.webp',
  'first-week': 'emblems/landfall.webp',
  launcher: 'icons/files.webp',
  faq: 'icons/repair.webp',
  keybinds: 'icons/settings.webp',
  commands: 'icons/link.webp',
  world: 'icons/map.webp',
  biomes: 'icons/map.webp',
  nether: 'emblems/crown_of_fire.webp',
  end: 'emblems/legacy.webp',
  structures: 'icons/claims.webp',
  creatures: 'emblems/bestiary.webp',
  lemurton: 'icons/home.webp',
  waystones: 'icons/link.webp',
  economy: 'emblems/commerce.webp',
  lifesteal: 'icons/disconnect.webp',
  quests: 'emblems/quest_book.webp',
  elvarg: 'emblems/legacy.webp',
  'fight-pits': 'icons/advancements.webp',
  'where-to-find': 'icons/missions.webp',
  skills: 'icons/skills.webp',
  enchanting: 'skills/enchanting.webp',
  gear: 'emblems/tools.webp',
  capes: 'emblems/banners.webp',
  hiscores: 'icons/statistics.webp',
  create: 'emblems/first_rotation.webp',
  'trains-and-airships': 'emblems/skyward.webp',
  'esc-menu': 'icons/settings.webp',
  mods: 'icons/mods.webp'
}
const iconOf = (file) => {
  const slug = file.replace(/\.md$/, '')
  return `assets/${ICONS[slug] ?? (slug.startsWith('biomes-') ? 'icons/map.webp' : 'icons/news.webp')}`
}
/** The picture at the top of a page that has no cover of its own. */
const GROUP_COVERS = {
  'Start here': 'images/lemurton_gate.jpg',
  'The world': 'images/lemurton_corner.jpg',
  'Living here': 'images/lemurton_market.jpg',
  Adventure: 'images/memorial_front.jpg',
  'Your character': 'images/lemurton_cathedral.jpg',
  'Create and building': 'images/lemurton_shops.jpg',
  Reference: 'images/lemurton_walls.jpg'
}

// ---------------------------------------------------------------- the contents (SUMMARY.md)

/** Groups ("## Name") and their entries ("* [Title](file.md)", nested by two spaces a level). */
function readNav() {
  const groups = []
  let group = null
  const stack = []
  for (const line of readFileSync(path.join(docsDir, 'SUMMARY.md'), 'utf8').split(/\r?\n/)) {
    const g = /^##\s+(.+)$/.exec(line)
    if (g) {
      group = { name: g[1].trim(), items: [] }
      groups.push(group)
      stack.length = 0
      continue
    }
    const e = /^(\s*)\*\s+\[([^\]]+)\]\(([^)]+)\)/.exec(line)
    if (!e) continue
    if (!group) {
      group = { name: '', items: [] }
      groups.push(group)
    }
    const depth = Math.floor(e[1].replace(/\t/g, '  ').length / 2)
    const item = { title: e[2], file: e[3], children: [], group: group.name }
    while (stack.length > depth) stack.pop()
    if (depth > 0 && stack[depth - 1]) {
      item.parent = stack[depth - 1]
      stack[depth - 1].children.push(item)
    } else group.items.push(item)
    stack[depth] = item
  }
  const pages = []
  const walk = (items) => items.forEach((i) => (pages.push(i), walk(i.children)))
  groups.forEach((g) => walk(g.items))
  return { groups, pages }
}

const htmlName = (file) => (file === 'README.md' ? 'index.html' : file.replace(/\.md$/, '.html'))
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const strip = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')

function navHtml(groups, current) {
  const item = (i) => {
    const inside = (n) => n === current || n.children.some(inside)
    const open = inside(i)
    const children = i.children.length ? `<ul>${i.children.map(item).join('')}</ul>` : ''
    return `<li class="${i.children.length ? `parent${open ? '' : ' closed'}` : ''}"><a href="${htmlName(i.file)}"${i === current ? ' aria-current="page"' : ''}><img src="${iconOf(i.file)}" alt="" width="22" height="22">${esc(i.title)}${i.children.length ? '<span class="caret" aria-hidden="true"></span>' : ''}</a>${children}</li>`
  }
  return groups.map((g) => `${g.name ? `<h3>${esc(g.name)}</h3>` : ''}<ul>${g.items.map(item).join('')}</ul>`).join('')
}

// ---------------------------------------------------------------- markdown

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
    return `<a class="card" href="${target}">${cover ? `<img class="cover" src="${cover}" alt="" loading="lazy">` : ''}<strong>${title}</strong><span>${text}</span></a>`
  })
  return `<div class="cards">${items.join('')}</div>`
}

const HINTS = { info: ['i', 'Good to know'], success: ['✓', 'Tip'], warning: ['!', 'Careful'], danger: ['✕', 'Danger'] }

/** A table after <!-- infobox: Title -->: label | value rows, "Image" taking a picture. */
function infobox(title, table) {
  const rows = table
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && !/^\|[\s|:-]+\|$/.test(l))
    .map((l) =>
      l
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim())
    )
    .filter((r) => r.length >= 2 && (r[0] || r[1]))
  let image = ''
  const dl = []
  for (const [label, value] of rows) {
    if (/^image$/i.test(label)) image = `<div class="ib-image">${marked.parseInline(value)}</div>`
    else dl.push(`<dt>${marked.parseInline(label)}</dt><dd>${marked.parseInline(value)}</dd>`)
  }
  return `<aside class="infobox">${title ? `<h4 class="ib-title">${esc(title)}</h4>` : ''}${image}<dl>${dl.join('')}</dl></aside>`
}

/** Renders one page's markdown body to HTML, collecting its headings. */
function markdownToHtml(markdown, page, ctx) {
  const stash = []
  const keep = (html) => {
    stash.push(html)
    return `\n\n<div data-stash="${stash.length - 1}"></div>\n\n`
  }
  let text = relink(markdown)
  // Atlas regions first (their fallback tables would otherwise become tables).
  const atlas = expandAtlas(text, htmlName(page.file), stash)
  text = atlas.text
  ctx.entries.push(...atlas.entries)
  text = text.replace(/<table data-view="cards">[\s\S]*?<\/table>/g, (t) => keep(cards(t)))
  text = text.replace(/<!-- infobox(?::\s*([^>]*?))?\s*-->\s*\n((?:\|.*\|\s*\n?)+)/g, (_, title, table) => keep(infobox(title ?? '', table)))
  text = text.replace(/{% tabs %}([\s\S]*?){% endtabs %}/g, (_, inner) => {
    const tabs = [...inner.matchAll(/{% tab title="([^"]+)" %}([\s\S]*?){% endtab %}/g)]
    const bar = tabs.map((t, i) => `<button type="button" role="tab" aria-selected="${i === 0}">${esc(t[1])}</button>`).join('')
    const panels = tabs.map((t, i) => `<div class="tab-panel" role="tabpanel"${i ? ' hidden' : ''}>${markdownToHtml(t[2], page, { entries: [], headings: [] })}</div>`).join('')
    return keep(`<div class="tabs"><div class="tab-bar" role="tablist">${bar}</div>${panels}</div>`)
  })
  text = text.replace(/{% hint style="(\w+)" %}([\s\S]*?){% endhint %}/g, (_, style, inner) => {
    const [icon, title] = HINTS[style] ?? HINTS.info
    return `<div class="hint hint-${style}"><span class="hint-icon" aria-hidden="true">${icon}</span><div class="hint-body"><span class="hint-title">${title}</span>\n\n${inner.trim()}\n\n</div></div>`
  })

  const used = new Set()
  const renderer = {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens)
      if (depth === 1) return `<h1>${inner}</h1>\n`
      let id = slug(inner) || `section-${used.size + 1}`
      while (used.has(id)) id += '-2'
      used.add(id)
      if (depth <= 3) ctx.headings.push({ depth, id, text: strip(inner) })
      return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h${depth}>\n`
    },
    code({ text: code }) {
      return `<div class="code"><button class="copy" type="button">Copy</button><pre><code>${esc(code)}</code></pre></div>\n`
    }
  }
  let html = new Marked({ renderer }).parse(text)
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>')
  html = html.replace(/<img (?![^>]*loading=)/g, '<img loading="lazy" decoding="async" ')
  html = html.replace(/<div data-stash="(\d+)"><\/div>/g, (_, i) => stash[Number(i)])
  return html
}

// ---------------------------------------------------------------- the page

const TOPNAV = [
  ['Home', `${SITE}/`],
  ['Wiki', 'index.html', true],
  ['How to join', `${SITE}/join`],
  ['Updates', `${SITE}/updates`],
  ['Gallery', `${SITE}/gallery`]
]

function pageHtml({ title, description, cover, painted, icon, crumbs, html, nav, toc, prev, next, extraCss, extraJs, file, portal }) {
  const tocHtml = toc.length >= 2 ? `<aside class="wk-toc" aria-label="On this page"><h4>On this page</h4><ul>${toc.map((h) => `<li><a href="#${h.id}"${h.depth === 3 ? ' class="sub"' : ''}>${esc(h.text)}</a></li>`).join('')}</ul></aside>` : ''
  const pager = (p, cls, label) => (p ? `<a class="${cls}" href="${htmlName(p.file)}"><small>${label}</small><b>${esc(p.title)}</b></a>` : '')
  const og = cover ? `<meta property="og:image" content="https://lilman514.github.io/lemursaucepacket/wiki/${cover}">` : ''
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)} · LemurSaucePacket wiki</title>` +
    (description ? `<meta name="description" content="${esc(description)}">` : '') +
    `<meta property="og:type" content="article"><meta property="og:site_name" content="LemurSaucePacket wiki"><meta property="og:title" content="${esc(title)}">` +
    (description ? `<meta property="og:description" content="${esc(description)}">` : '') +
    og +
    `<meta name="theme-color" content="#191715"><link rel="icon" type="image/png" sizes="32x32" href="assets/mascot-32.png">` +
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
    `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&amp;family=Pixelify+Sans:wght@500;600;700&amp;display=swap">` +
    `<link rel="stylesheet" href="assets/wiki.css">${extraCss ? `<style>${extraCss}</style>` : ''}<script src="assets/wiki.js" defer></script></head><body>` +
    `<a class="skip" href="#article">Skip to the page</a>` +
    `<header class="topbar"><div class="topbar-inner"><a class="brand" href="index.html" aria-label="LemurSaucePacket wiki, front page"><img class="mascot" src="assets/mascot.webp" width="38" height="38" alt=""><img class="wordmark" src="assets/logo-720.webp" width="720" height="165" alt="LemurSaucePacket"><span class="tag">Wiki</span></a>` +
    `<nav class="topnav" aria-label="play.limas.ca">${TOPNAV.map(([t, h, here]) => `<a href="${h}"${here ? ' aria-current="page"' : ''}>${t}</a>`).join('')}<a class="cta" href="${SITE}/download">Download</a></nav>` +
    `<button class="menu-toggle" type="button" aria-expanded="false" aria-label="Contents"><span></span></button></div></header>` +
    `<div class="wk${tocHtml ? '' : ' no-toc'}"><aside class="wk-side"><div class="wk-search"><input type="search" placeholder="Search the wiki" data-search="search.json" aria-label="Search the wiki" autocomplete="off"><kbd>/</kbd><div class="wk-results" hidden></div></div>` +
    `<nav class="wk-nav" aria-label="Wiki pages">${nav}</nav><a class="back" href="${SITE}">← play.limas.ca</a></aside>` +
    `<main class="wk-main" id="article"><header class="wk-hero${cover || painted ? '' : ' plain'}">${cover ? `<img class="bg" src="${cover}" alt="" fetchpriority="high">` : painted ? `<div class="bg painted" aria-hidden="true">${painted}</div>` : ''}` +
    `<p class="crumbs">${crumbs.map((c) => (c.href ? `<a href="${c.href}">${esc(c.text)}</a>` : `<span>${esc(c.text)}</span>`)).join('<span class="sep">›</span>')}</p>` +
    (icon ? `<img class="icon" src="${icon}" width="56" height="56" alt="">` : '') +
    `<h1>${esc(title)}</h1>${description ? `<p class="lead">${esc(description)}</p>` : ''}</header>` +
    // A page with an atlas on it gets the width for its cards; its text keeps a reading measure.
    `<article class="wk-article${portal ? ' portal' : ''}${/<div class="atlas"/.test(html) ? ' wide' : ''}">${html}</article>` +
    `<nav class="wk-pager" aria-label="Pages either side">${pager(prev, 'prev', '← Previous')}${pager(next, 'next', 'Next →')}</nav>` +
    `<footer class="wk-meta">Written by the people who run the pack, and updated with every pack version. Something wrong or missing? Say so in the server chat. · <a href="${REPO}/blob/main/docs/${file}">This page’s source</a> · Built ${new Date().toISOString().slice(0, 10)}</footer>` +
    `</main>${tocHtml}</div>` +
    `<div class="lightbox" hidden><button class="lb-close" type="button" aria-label="Close">×</button><button class="lb-prev" type="button" aria-label="Previous picture">‹</button><img alt=""><button class="lb-next" type="button" aria-label="Next picture">›</button><p></p></div>` +
    (extraJs ? `<script>${extraJs}</script>` : '') +
    `</body></html>`
  )
}

/** The front page's extras: every page by group, and the latest news. */
function portal(groups, frontMatters) {
  const tiles = groups
    .map((g) => {
      if (!g.name) return ''
      const items = g.items.filter((i) => i.file !== 'README.md')
      if (!items.length) return ''
      const first = items[0]
      return (
        `<section class="portal-group"><h2 id="${slug(g.name)}"><img src="${iconOf(first.file)}" width="34" height="34" alt="">${esc(g.name)}</h2><div class="tiles">` +
        items.map((i) => `<a href="${htmlName(i.file)}"><img src="${iconOf(i.file)}" alt="" width="46" height="46"><b>${esc(i.title)}</b><small>${esc(frontMatters[i.file]?.description ?? '')}</small></a>`).join('') +
        '</div></section>'
      )
    })
    .join('')
  let news = ''
  try {
    const feed = JSON.parse(readFileSync(path.join(root, 'publish', 'feed.json'), 'utf8'))
    news = (feed.news ?? [])
      .slice(0, 3)
      .map((n) => `<article><time datetime="${esc(n.date)}">${esc(n.date)}</time><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`)
      .join('')
  } catch {}
  return {
    top: `<div class="portal-search wk-search"><input type="search" placeholder="Search the wiki: a biome, a quest, a command, a key…" data-search="search.json" aria-label="Search the wiki" autocomplete="off"><div class="wk-results" hidden></div></div>`,
    bottom: `${tiles}${news ? `<section class="portal-group"><h2 id="whats-new"><img src="assets/icons/news.webp" width="34" height="34" alt="">What’s new</h2><div class="news">${news}</div><p><a href="${SITE}/updates">Every update →</a></p></section>` : ''}`
  }
}

function render(keybinds) {
  const { groups, pages } = readNav()
  mkdirSync(path.join(outDir, 'assets'), { recursive: true })
  cpSync(path.join(docsDir, 'images'), path.join(outDir, 'images'), { recursive: true })
  for (const f of readdirSync(themeDir)) cpSync(path.join(themeDir, f), path.join(outDir, 'assets', f))
  for (const dir of ['icons', 'emblems', 'skills']) cpSync(path.join(siteAssets, dir), path.join(outDir, 'assets', dir), { recursive: true })
  cpSync(path.join(siteAssets, 'emblems', 'mascot.webp'), path.join(outDir, 'assets', 'mascot.webp'))
  cpSync(path.join(siteAssets, 'logo-720.webp'), path.join(outDir, 'assets', 'logo-720.webp'))
  cpSync(path.join(siteAssets, 'mascot-32.png'), path.join(outDir, 'assets', 'mascot-32.png'))
  cpSync(path.join(siteAssets, 'pixel', 'plate-plain.png'), path.join(outDir, 'assets', 'plate-plain.png'))

  const sources = {}
  const frontMatters = {}
  for (const page of pages) {
    const source = path.join(docsDir, page.file)
    if (!existsSync(source)) continue
    sources[page.file] = frontMatter(readFileSync(source, 'utf8'))
    frontMatters[page.file] = sources[page.file].data
  }
  const search = []
  for (const [i, page] of pages.entries()) {
    const src = sources[page.file]
    if (!src) continue
    const { data, body } = src
    const ctx = { entries: [], headings: [] }
    // The Keybinds page: the keyboard and its list stand where the markdown has its tables.
    const keyboard = page.file === 'keybinds.md' ? keybinds : null
    const title = /^#\s+(.+)$/m.exec(body)?.[1]?.trim() ?? page.title
    const withoutTitle = body.replace(/^#\s+.+\r?\n/m, '')
    let html = markdownToHtml(keyboard ? withoutTitle.replace(keyboard.region, '<!-- keyboard -->') : withoutTitle, page, ctx)
    if (keyboard) html = html.replace('<!-- keyboard -->', () => keyboard.html)
    let isPortal = false
    if (page.file === 'README.md') {
      const p = portal(groups, frontMatters)
      html = p.top + html + p.bottom
      isPortal = true
    }
    const crumbs = [{ text: 'Wiki', href: 'index.html' }]
    if (page.group && page.file !== 'README.md') crumbs.push({ text: page.group })
    if (page.parent) crumbs.push({ text: page.parent.title, href: htmlName(page.parent.file) })
    // A biome page without a cover of its own shows its biome: the photo once there is one, a painting until then.
    const hero = data.cover ? null : banner(page.file)
    const cover = data.cover ?? hero?.cover ?? GROUP_COVERS[page.group]
    const doc = pageHtml({
      title,
      description: data.description,
      cover: !hero?.svg && cover && existsSync(path.join(docsDir, cover)) ? cover : null,
      painted: hero?.svg,
      icon: page.file === 'README.md' ? null : iconOf(page.file),
      crumbs: page.file === 'README.md' ? [{ text: 'The LemurSaucePacket wiki' }] : crumbs,
      html,
      nav: navHtml(groups, page),
      toc: ctx.headings.filter((h) => h.depth === 2 || h.depth === 3),
      prev: pages[i - 1],
      next: pages[i + 1],
      extraCss: keyboard ? keyboard.css : '',
      extraJs: keyboard ? keyboard.js : '',
      file: page.file,
      portal: isPortal
    })
    writeFileSync(path.join(outDir, htmlName(page.file)), doc)

    // Search: the page, each of its sections, and every atlas card on it.
    const url = htmlName(page.file)
    search.push({ t: title, g: page.group, s: '', x: data.description ?? '', u: url })
    const parts = html.split(/(?=<h[23] id=")/)
    for (const part of parts) {
      const m = /^<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/.exec(part)
      if (!m) continue
      search.push({ t: title, s: strip(m[3]).replace(/^#\s*/, ''), x: strip(part.slice(m[0].length)).slice(0, 360), u: `${url}#${m[2]}` })
    }
    for (const e of ctx.entries) search.push({ t: title, ...e })
  }
  writeFileSync(path.join(outDir, 'search.json'), JSON.stringify(search))
  for (const [from, to] of Object.entries(MOVED)) {
    const target = pages.find((p) => p.file === to)
    if (target) writeFileSync(path.join(outDir, htmlName(from)), redirectPage(to, target.title))
  }
  return { pages: pages.length, entries: search.length }
}

const modCount = writeModsPage()
const keybinds = buildKeybinds()
const result = render(keybinds)
console.log(`wiki: ${result.pages} pages, ${result.entries} search entries → site/wiki (mods.md lists ${modCount} mods; keybinds.md: ${keybinds.summary})`)
