// Merge the workers' notes (qol/notes/*.md) into one table per topic.
// Usage: node merge.mjs > merged.md   (also writes merged.json and stats to stderr)
import fs from 'node:fs'
import path from 'node:path'

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const TOPICS = [
  'Controls & keys',
  'Inventory, sorting & storage',
  'Building & decoration',
  'Movement & travel',
  'Maps & navigation',
  'Combat & PvP',
  'Farming, food & animals',
  'Redstone',
  'Create automation tips',
  'Tools & mining',
  'UI, HUD & settings',
  'Chat & social',
  'Server-specific systems',
  'Performance & video settings',
  'Recording & screenshots'
]
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '')
const topicByNorm = new Map(TOPICS.map((t) => [norm(t), t]))
const files = fs.readdirSync(path.join(dir, 'notes')).filter((f) => f.endsWith('.md'))
const rows = []
const mods = []
const unknownTopics = new Set()
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, 'notes', f), 'utf8')
  let topic = null
  let section = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const h = line.match(/^##\s+(.*)$/)
    if (h) {
      section = h[1].trim()
      topic = topicByNorm.get(norm(section)) || null
      if (!topic && !/mods covered|pack changes|top gaps/i.test(section)) unknownTopics.add(`${f}: ${section}`)
      continue
    }
    if (/mods covered/i.test(section || '') && line.startsWith('- ')) {
      mods.push({ file: f, line: line.slice(2) })
      continue
    }
    if (!topic || !line.startsWith('|')) continue
    if (/^\|\s*-+/.test(line) || /^\|\s*Feature\s*\|/i.test(line)) continue
    let cells = line.replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((c) => c.trim())
    if (cells.length < 5) {
      console.error('SHORT ROW', f, line.slice(0, 120))
      continue
    }
    if (cells.length > 5) cells = [cells[0], cells.slice(1, cells.length - 3).join(' / '), ...cells.slice(cells.length - 3)]
    const [feature, how, mod, docs, value] = cells
    rows.push({ topic, feature, how, mod, docs, value: value.toLowerCase(), file: f })
  }
}
const rank = { high: 0, medium: 1, low: 2 }
// Docs status: missing (starts with MISSING), partial (cites a page but says part is MISSING), documented.
const anchors = JSON.parse(fs.readFileSync(path.join(dir, 'anchors.json'), 'utf8'))
const badCites = []
for (const r of rows) {
  r.status = /^missing/i.test(r.docs) ? 'missing' : /missing|partial|wrong/i.test(r.docs) ? 'partial' : 'documented'
  for (const m of r.docs.matchAll(/([a-z0-9-]+\.md)(?:#([a-z0-9-]+))?/gi)) {
    const [_, file, anchor] = m
    if (!anchors[file]) badCites.push(`${r.file}: no such page ${file} (${r.feature})`)
    else if (anchor && !anchors[file].includes(anchor)) badCites.push(`${r.file}: no anchor ${file}#${anchor} (${r.feature})`)
  }
}
const out = []
const stats = {}
for (const t of TOPICS) {
  const list = rows.filter((r) => r.topic === t).sort((a, b) => (rank[a.value] ?? 3) - (rank[b.value] ?? 3) || a.mod.localeCompare(b.mod) || a.feature.localeCompare(b.feature))
  const missing = list.filter((r) => r.status === 'missing').length
  const partial = list.filter((r) => r.status === 'partial').length
  stats[t] = { rows: list.length, missing, partial }
  out.push(`## ${t}`, '', `| Feature | How to use | Mod | Docs | Value | src |`, `|---|---|---|---|---|---|`)
  for (const r of list) out.push(`| ${r.feature} | ${r.how} | ${r.mod} | ${r.docs} | ${r.value} | ${r.file.replace('.md', '')} |`)
  out.push('')
}
fs.writeFileSync(path.join(dir, 'merged.json'), JSON.stringify({ rows, mods }, null, 1))
console.log(out.join('\n'))
console.error(JSON.stringify(stats, null, 1))
console.error('total rows', rows.length, 'missing', rows.filter((r) => r.status === 'missing').length, 'partial', rows.filter((r) => r.status === 'partial').length, 'mods lines', mods.length)
if (badCites.length) console.error('BAD CITES\n' + badCites.join('\n'))
if (unknownTopics.size) console.error('UNKNOWN SECTIONS', [...unknownTopics])
