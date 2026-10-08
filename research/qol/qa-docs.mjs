// QA for the Docs column. (1) MISSING rows: look for the feature's distinctive words in the wiki and print hits
// to review (possible false MISSING). (2) Cited rows: check the cited page mentions at least one distinctive word
// of the feature (possible wrong citation).
import fs from 'node:fs'
import path from 'node:path'
const DOCS = 'C:/Create+Modpack/docs'
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const pages = {}
for (const f of fs.readdirSync(DOCS).filter((f) => f.endsWith('.md') && f !== 'mods.md' && f !== 'SUMMARY.md')) pages[f] = fs.readFileSync(path.join(DOCS, f), 'utf8')
const STOP = new Set('the a an and or of to in on for with from by your you it its is are be at as this that into onto over under per all any can not no off out up down use using used how what when where which who key keys item items block blocks mod mods more less one two get set show shows screen menu button buttons click right left shift sneak hold open opens make made new list mode modes info settings setting option options default value values player players own others other each every some just also than then them they there here does do'.split(' '))
const words = (s) => [...new Set(s.toLowerCase().replace(/\(.*?\)/g, ' ').match(/[a-z][a-z'-]{3,}/g) || [])].filter((w) => !STOP.has(w))
const merged = JSON.parse(fs.readFileSync(path.join(dir, 'merged.json'), 'utf8'))
const mode = process.argv[2] || 'missing'
for (const r of merged.rows) {
  const status = /^missing/i.test(r.docs) ? 'missing' : /missing|partial|wrong/i.test(r.docs) ? 'partial' : 'documented'
  const ws = words(r.feature)
  if (mode === 'missing' && status === 'missing') {
    const hits = []
    for (const [f, text] of Object.entries(pages)) {
      const lines = text.split(/\r?\n/)
      lines.forEach((line, i) => {
        const l = line.toLowerCase()
        const n = ws.filter((w) => l.includes(w)).length
        if (ws.length && n >= Math.min(2, ws.length) && n / ws.length >= 0.5) hits.push(`${f}:${i + 1} ${line.trim().slice(0, 140)}`)
      })
    }
    if (hits.length) console.log(`\n## [${r.file}] ${r.feature}  (words: ${ws.join(',')})\n  ` + hits.slice(0, 6).join('\n  '))
  }
  if (mode === 'cited' && status !== 'missing') {
    const cited = [...r.docs.matchAll(/([a-z0-9-]+\.md)/gi)].map((m) => m[1]).filter((f) => pages[f])
    if (!cited.length) continue
    const ok = cited.some((f) => ws.some((w) => pages[f].toLowerCase().includes(w)))
    if (!ok) console.log(`[${r.file}] ${r.feature} -> ${r.docs}  (words: ${ws.join(',')})`)
  }
}
