// Fetch Modrinth project data (title, slug, sides, description, body) for every mod in mods.tsv.
// Uses the bulk endpoint in batches, sequentially.
import fs from 'node:fs'
import path from 'node:path'

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const rows = fs.readFileSync(path.join(dir, 'mods.tsv'), 'utf8').trim().split(/\r?\n/).map((l) => l.split('\t'))
const out = path.join(dir, 'modrinth')
fs.mkdirSync(out, { recursive: true })
const byId = new Map()
for (const [slug, name, side, id] of rows) if (id) byId.set(id, slug)
const ids = [...byId.keys()]
const UA = 'lemursaucepacket-wiki-research (github.com/lilman514/lemursaucepacket)'
const summary = []
for (let i = 0; i < ids.length; i += 40) {
  const batch = ids.slice(i, i + 40)
  const url = 'https://api.modrinth.com/v2/projects?ids=' + encodeURIComponent(JSON.stringify(batch))
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) { console.error('HTTP', res.status, await res.text()); process.exit(1) }
  const list = await res.json()
  for (const p of list) {
    const slug = byId.get(p.id)
    fs.writeFileSync(path.join(out, slug + '.md'), `# ${p.title} (${p.slug}, ${p.id})\nclient: ${p.client_side} server: ${p.server_side}\n> ${p.description}\n\n${p.body}\n`)
    summary.push([slug, p.slug, p.title, p.client_side, p.server_side, p.description.replace(/\s+/g, ' ')].join('\t'))
  }
  console.log('batch', i / 40 + 1, 'got', list.length)
}
fs.writeFileSync(path.join(dir, 'modrinth-summary.tsv'), summary.join('\n') + '\n')
console.log('done', summary.length)
