// Find likely duplicate rows across notes files (word overlap of feature + how-to text).
import fs from 'node:fs'
import path from 'node:path'
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const { rows } = JSON.parse(fs.readFileSync(path.join(dir, 'merged.json'), 'utf8'))
const STOP = new Set('the a an and or of to in on for with from by your you it its is are be at as this that into onto over under per all any can not no off out up use using used how what when where which who key keys one two get set show shows click right left shift sneak hold open opens make made new their them they there also only more than then each every some just like its'.split(' '))
const words = (s) => new Set((s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter((w) => !STOP.has(w)))
const W = rows.map((r) => ({ f: words(r.feature), h: words(r.feature + ' ' + r.how) }))
const jac = (a, b) => {
  let i = 0
  for (const x of a) if (b.has(x)) i++
  return i / (a.size + b.size - i || 1)
}
const out = []
for (let i = 0; i < rows.length; i++)
  for (let j = i + 1; j < rows.length; j++) {
    if (rows[i].file === rows[j].file) continue
    const jf = jac(W[i].f, W[j].f)
    const jh = jac(W[i].h, W[j].h)
    if (jf >= 0.5 || jh >= 0.3) out.push([Math.max(jf, jh).toFixed(2), `[${rows[i].file}|${rows[i].topic}] ${rows[i].feature}`, `[${rows[j].file}|${rows[j].topic}] ${rows[j].feature}`])
  }
out.sort((a, b) => b[0] - a[0])
console.log(out.map((o) => o.join('  <>  ')).join('\n'))
console.error(out.length, 'pairs')
