import { readFileSync, writeFileSync } from 'node:fs'
const scan = JSON.parse(readFileSync('jarscan.json', 'utf8'))
const by = JSON.parse(readFileSync('byResult.json', 'utf8'))
const mods = new Set(['minecraft', 'neoforge', 'c', 'forge'])
for (const j of Object.values(scan.jars)) for (const m of j.modIds) mods.add(m)
const LATE = /^(iceandfire|mcw|easy_npc|lsp_fixes)/
const condOk = (r) => {
  const conds = r['neoforge:conditions'] || r.conditions || r['fabric:load_conditions'] || []
  const walk = (c) => {
    if (!c) return true
    if (Array.isArray(c)) return c.every(walk)
    const t = c.type || c.condition
    if (t === 'neoforge:mod_loaded' || t === 'forge:mod_loaded') return mods.has(c.modid)
    if (t === 'neoforge:not') return !walk(c.value)
    if (t === 'neoforge:and') return (c.values || []).every(walk)
    if (t === 'neoforge:or') return (c.values || []).some(walk)
    return true
  }
  return walk(conds)
}
let fixed = 0
for (const [item, list] of Object.entries(by)) for (const e of list) {
  if (!e.loaded && LATE.test(e.id)) { const r = scan.recipes[e.id]; if (r && condOk(r)) { e.loaded = true; fixed++ } }
}
writeFileSync('byResult.json', JSON.stringify(by))
console.log('fixed', fixed)
