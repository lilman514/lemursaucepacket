#!/usr/bin/env node
// Turns the wiki (docs/, GitBook layout) into a Patchouli guide book inside the pack, so the same pages are
// readable in-game. Run `node publish/patchouli.mjs`; publish.mjs does.
//
// Book:      pack/kubejs/data/lemursaucepacket/patchouli_books/guide/book.json
// Content:   pack/kubejs/assets/lemursaucepacket/patchouli_books/guide/en_us/{categories,entries}/*.json
// Pictures:  pack/kubejs/assets/lemursaucepacket/textures/patchouli/*.png (docs/images, padded to a square)
//
// Markdown → Patchouli: headings start a new page (title), paragraphs and lists become text pages, tables
// become "cell — cell" lines, images become image pages, links to other docs pages become book links.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from '../art/node_modules/sharp/lib/index.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const NS = 'lemursaucepacket'
const BOOK = 'guide'
const dataDir = path.join(root, 'pack', 'kubejs', 'data', NS, 'patchouli_books', BOOK)
const assetDir = path.join(root, 'pack', 'kubejs', 'assets', NS, 'patchouli_books', BOOK, 'en_us')
const imageDir = path.join(root, 'pack', 'kubejs', 'assets', NS, 'textures', 'patchouli')
const PAGE_CHARS = 620 // what a Patchouli text page comfortably holds

const write = (file, obj) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(obj, null, 2))
}

/** Inline markdown → Patchouli formatting. */
function inline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$(bold)$1$()')
    .replace(/\*([^*]+)\*/g, '$(italic)$1$()')
    .replace(/`([^`]+)`/g, '$(#e0ac46)$1$()')
    .replace(/\[([^\]]+)\]\(([a-z0-9-]+)\.md\)/g, (_, label, page) => `$(l:${NS}:${page})${label}$(/l)`)
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_, label, url) => `$(l:${url})${label}$(/l)`)
    .replace(/—/g, '-')
}

/** Splits one markdown page into Patchouli pages. */
function convert(markdown, slug) {
  const pages = []
  let title = slug
  let buffer = [] // text chunks for the current page
  let pageTitle = null
  const flush = () => {
    const text = buffer.join('$(br2)').trim()
    if (text) {
      // Long sections become several pages; only the first carries the title.
      let rest = text
      let first = true
      while (rest.length > 0) {
        let cut = rest.length <= PAGE_CHARS ? rest.length : rest.lastIndexOf('$(br2)', PAGE_CHARS)
        if (cut <= 0) cut = Math.min(rest.length, PAGE_CHARS)
        const chunk = rest.slice(0, cut).replace(/\$\(br2\)$/, '')
        pages.push({ type: 'patchouli:text', ...(first && pageTitle ? { title: pageTitle } : {}), text: chunk })
        rest = rest.slice(cut).replace(/^\$\(br2\)/, '')
        first = false
      }
    }
    buffer = []
    pageTitle = null
  }
  const lines = markdown.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^# /.test(line)) {
      title = line.slice(2).trim()
      i++
      continue
    }
    if (/^##+ /.test(line)) {
      flush()
      pageTitle = line.replace(/^#+ /, '').trim()
      i++
      continue
    }
    const image = /^!\[([^\]]*)\]\(images\/([^)]+)\)/.exec(line)
    if (image) {
      flush()
      pages.push({ type: 'patchouli:image', images: [`${NS}:textures/patchouli/${image[2].replace(/\.[a-z]+$/, '')}.png`], title: image[1] || undefined, border: true })
      i++
      continue
    }
    if (/^\|/.test(line)) {
      const rows = []
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim())
        if (!cells.every((c) => /^-+$/.test(c))) rows.push(cells)
        i++
      }
      const [header, ...body] = rows
      const text = body.map((r) => r.map((c, k) => (k === 0 ? `$(bold)${inline(c)}$()` : inline(c))).filter(Boolean).join(' - ')).join('$(br)')
      buffer.push((header && header.some((h) => h) ? `$(#b9a98a)${header.filter(Boolean).map(inline).join(' - ')}$()$(br)` : '') + text)
      continue
    }
    if (/^[-*] /.test(line)) {
      const items = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(`$(li)${inline(lines[i].replace(/^[-*] /, ''))}`)
        i++
      }
      buffer.push(items.join('$(br)'))
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    // A paragraph: consecutive non-empty lines.
    const para = []
    while (i < lines.length && lines[i].trim() !== '' && !/^(#|!\[|\||[-*] )/.test(lines[i])) {
      para.push(lines[i].trim())
      i++
    }
    buffer.push(inline(para.join(' ')))
  }
  flush()
  return { title, pages }
}

async function images() {
  mkdirSync(imageDir, { recursive: true })
  const source = path.join(docsDir, 'images')
  let count = 0
  for (const file of readdirSync(source)) {
    // Patchouli draws image pages into a square; letterbox the screenshot on a dark plate.
    const inner = await sharp(path.join(source, file)).resize(512, 512, { fit: 'contain', background: { r: 36, g: 33, b: 32, alpha: 1 } }).png().toBuffer()
    await sharp(inner).png({ compressionLevel: 9 }).toFile(path.join(imageDir, file.replace(/\.[a-z]+$/, '.png')))
    count++
  }
  return count
}

const summary = readFileSync(path.join(docsDir, 'SUMMARY.md'), 'utf8')
const pagesInOrder = [...summary.matchAll(/\*\s+\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => ({ title: m[1], file: m[2] })).filter((p) => p.file !== 'README.md')

rmSync(assetDir, { recursive: true, force: true })
write(path.join(dataDir, 'book.json'), {
  name: 'LemurSaucePacket Guide',
  landing_text: 'Everything about the server, from the launcher to the last cape. The same pages as the wiki, kept current with every pack version.$(br2)Press $(bold)ESC$() in-game for the menu that reaches most of what this book describes.',
  version: 1,
  creative_tab: 'minecraft:tools_and_utilities',
  book_texture: 'patchouli:textures/gui/book_brown.png',
  model: 'patchouli:book_brown',
  use_resource_pack: true,
  show_progress: false,
  text_color: '1a1409',
  header_color: '5a3a10',
  nameplate_color: '3a2a10',
  link_color: '7a4a10',
  link_hover_color: 'b8862b'
})
write(path.join(assetDir, 'categories', 'wiki.json'), { name: 'The wiki', description: 'The pages of the LemurSaucePacket wiki, in order.', icon: 'minecraft:writable_book', sortnum: 0 })

const icons = { 'getting-started': 'minecraft:oak_door', launcher: 'minecraft:compass', world: 'minecraft:grass_block', 'esc-menu': 'create:brass_casing', quests: 'ftbquests:book', skills: 'minecraft:experience_bottle', gear: 'lemursaucepacket:brass_sabre', capes: 'minecraft:white_banner', keys: 'minecraft:tripwire_hook', mods: 'minecraft:chest', faq: 'minecraft:lantern' }
let pageCount = 0
for (const [index, page] of pagesInOrder.entries()) {
  const slug = page.file.replace(/\.md$/, '')
  const file = path.join(docsDir, page.file)
  if (!existsSync(file)) continue
  const { title, pages } = convert(readFileSync(file, 'utf8'), slug)
  write(path.join(assetDir, 'entries', `${slug}.json`), { name: title, category: `${NS}:wiki`, icon: icons[slug] ?? 'minecraft:paper', sortnum: index, pages })
  pageCount += pages.length
}
const imageCount = await images()
console.log(`guide book: ${pagesInOrder.length} entries, ${pageCount} pages, ${imageCount} pictures → Patchouli book ${NS}:${BOOK}`)
