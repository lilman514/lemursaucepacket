// Assemble SP/qol-inventory.md from qol/notes/*.md (worker notes, after review), mods.tsv, modrinth-summary.tsv,
// roles.mjs and qol/gaps.md (the hand-picked "Biggest gaps" list) + qol/intro.md (hand-written intro).
// Usage: node build-final.mjs
import fs from 'node:fs'
import path from 'node:path'
import { ROLES } from './roles.mjs'

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const SP = path.dirname(dir)
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
const files = fs.readdirSync(path.join(dir, 'notes')).filter((f) => f.endsWith('.md')).sort()
const rows = []
const changes = []
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, 'notes', f), 'utf8')
  let topic = null
  let section = ''
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const h = line.match(/^##\s+(.*)$/)
    if (h) {
      section = h[1].trim()
      topic = topicByNorm.get(norm(section)) || null
      continue
    }
    if (/^pack changes found$/i.test(section)) {
      // keep the section verbatim (wrapped lines and nested bullets included)
      if (raw.trim() !== '') changes.push({ file: f, line: raw.replace(/\s+$/, '') })
      continue
    }
    if (!topic || !line.startsWith('|')) continue
    if (/^\|\s*:?-+/.test(line) || /^\|\s*Feature\s*\|/i.test(line)) continue
    let cells = line.replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map((c) => c.trim())
    if (cells.length < 5) throw new Error(`short row in ${f}: ${line}`)
    if (cells.length > 5) cells = [cells[0], cells.slice(1, cells.length - 3).join(' / '), ...cells.slice(cells.length - 3)]
    const [feature, how, mod, docs, value] = cells
    rows.push({ topic, feature, how, mod, docs, value: value.toLowerCase().replace(/[^a-z]/g, ''), file: f })
  }
}
for (const r of rows) {
  r.status = /^missing/i.test(r.docs) ? 'missing' : /missing|partial|wrong/i.test(r.docs) ? 'partial' : 'documented'
  if (!['high', 'medium', 'low'].includes(r.value)) throw new Error(`bad value "${r.value}" in ${r.file}: ${r.feature}`)
}
const rank = { high: 0, medium: 1, low: 2 }
const cell = (s) => s.replace(/\r?\n/g, ' ')

// ---- mods table
const mods = fs.readFileSync(path.join(dir, 'mods.tsv'), 'utf8').trim().split(/\r?\n/).map((l) => l.split('\t'))
const mr = new Map(
  fs
    .readFileSync(path.join(dir, 'modrinth-summary.tsv'), 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split('\t'))
    .map((c) => [c[0], { slug: c[1], client: c[3], server: c[4] }])
)
const CURSE = { 'ftb-library-forge': 404465, 'ftb-quests-forge': 289412, 'ftb-teams-forge': 404468, 'reforgedplay-mod': 1018692 }
const modLines = []
const sorted = mods.slice().sort((a, b) => a[1].replace(/^\W+/, '').localeCompare(b[1].replace(/^\W+/, ''), 'en', { sensitivity: 'base' }))
sorted.forEach(([slug, name, side, id], i) => {
  const m = mr.get(slug)
  const where = m ? `${m.slug} (${id})` : `CurseForge ${CURSE[slug]}`
  const [group, role] = ROLES[slug]
  modLines.push(`| ${i + 1} | ${name.replace(/\s*🔍/, '').replace(/ \| /g, ' / ')} | ${where} | ${side === 'client' ? 'client' : 'both'} | ${group} | ${role} |`)
})
modLines.push(`| ${sorted.length + 1} | LemurSaucePacket Fixes | local jar (lsp_fixes 1.15.1, mods-src/lemursaucepacket-fixes) | both | Pack | skills screens and gates, Construction, coins/vendors/trade, capes, hiscores, lifesteal, safe zones, HUD layout |`)
modLines.push(`| ${sorted.length + 2} | LSP Instances | local jar (lsp_instances 1.1.0, mods-src/lsp-instances) | both | Pack | instanced fights: Elvarg's Lair, Fight Pits, Inferno |`)

// ---- assemble
const out = []
out.push(fs.readFileSync(path.join(dir, 'intro.md'), 'utf8').trim(), '')
out.push('## Totals', '', '| Topic | Entries | MISSING | PARTIAL or WRONG | Documented |', '|---|---|---|---|---|')
let tot = { n: 0, m: 0, p: 0, d: 0 }
for (const t of TOPICS) {
  const list = rows.filter((r) => r.topic === t)
  const m = list.filter((r) => r.status === 'missing').length
  const p = list.filter((r) => r.status === 'partial').length
  out.push(`| [${t}](#${t.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-')}) | ${list.length} | ${m} | ${p} | ${list.length - m - p} |`)
  tot = { n: tot.n + list.length, m: tot.m + m, p: tot.p + p, d: tot.d + list.length - m - p }
}
out.push(`| **All** | **${tot.n}** | **${tot.m}** | **${tot.p}** | **${tot.d}** |`, '')
out.push(`## The mods (${modLines.length})`, '', 'Side is the pack\'s (`client` = client only, `both` = server and client). Libraries have no player-facing features of their own.', '', '| # | Mod | Modrinth slug (id) | Side | Group | Role |', '|---|---|---|---|---|---|', ...modLines, '')
for (const t of TOPICS) {
  const list = rows.filter((r) => r.topic === t).sort((a, b) => rank[a.value] - rank[b.value] || a.mod.localeCompare(b.mod) || a.feature.localeCompare(b.feature))
  out.push(`## ${t}`, '', '| Feature | How to use | Mod | Docs | Value |', '|---|---|---|---|---|')
  for (const r of list) {
    const docs = r.status === 'partial' && !/^(partial|wrong)/i.test(r.docs) ? `PARTIAL: ${r.docs}` : r.docs
    out.push(`| ${cell(r.feature)} | ${cell(r.how)} | ${cell(r.mod)} | ${cell(docs)} | ${r.value} |`)
  }
  out.push('')
}
out.push(
  '## Pack changes from mod defaults',
  '',
  'What the pack changes from each mod\'s defaults (pack/config, pack/options.txt, pack/kubejs, the pack\'s own mods), and mod defaults that shape play here, by mod group. Some facts appear in two groups.',
  ''
)
const GROUPS = [
  ['pack-systems.md', "The pack's own systems (lsp_fixes, lsp_instances, KubeJS)"],
  ['create-core.md', 'Create, Ponder, Cyber Goggles, Nowheel, Create JEI Compat'],
  ['create-addons.md', 'Create add-ons (Aeronautics, Connected, Copycats+, Deco, Enchantment Industry, Crafts & Additions, Ore Excavation, Railways Navigator, Missions, kitchens)'],
  ['inventory-ui.md', 'Inventory, backpacks, recipes and info, quests and teams, graves and loot'],
  ['travel-video.md', 'Maps, waystones, camera, voice, video settings and recording'],
  ['gameplay.md', 'Food, trees, relics, skills, dragons, mobs, building blocks and structures']
]
let nChanges = 0
for (const [file, title] of GROUPS) {
  const lines = changes.filter((c) => c.file === file).map((c) => c.line)
  if (!lines.length) continue
  out.push(`### ${title}`, '', ...lines, '')
  nChanges += lines.filter((l) => /^\s*[-*] /.test(l)).length
}
out.push(fs.readFileSync(path.join(dir, 'gaps.md'), 'utf8').trim(), '')
fs.writeFileSync(path.join(SP, 'qol-inventory.md'), out.join('\n'))
console.log('rows', tot, 'mods', modLines.length, 'change bullets', nChanges)
