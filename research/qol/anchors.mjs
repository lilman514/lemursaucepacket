// Build file -> heading anchors for the wiki (GitBook-style slugs) so cited "file.md#anchor" can be checked.
import fs from 'node:fs'
import path from 'node:path'
const DOCS = 'C:/Create+Modpack/docs'
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const slug = (h) => h.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')
const index = {}
for (const f of fs.readdirSync(DOCS).filter((f) => f.endsWith('.md'))) {
  const anchors = []
  for (const line of fs.readFileSync(path.join(DOCS, f), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^#{1,4}\s+(.*)$/)
    if (m) anchors.push(slug(m[1]))
  }
  index[f] = anchors
}
fs.writeFileSync(path.join(dir, 'anchors.json'), JSON.stringify(index, null, 1))
console.log(Object.entries(index).map(([f, a]) => `${f}: ${a.join(', ')}`).join('\n'))
