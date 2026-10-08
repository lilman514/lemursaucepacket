import { readFileSync } from 'node:fs'
const by = JSON.parse(readFileSync('byResult.json', 'utf8'))
const args = process.argv.slice(2)
const all = Object.keys(by)
for (const a of args) {
  const re = new RegExp(a)
  for (const item of all.filter((i) => re.test(i)).sort()) {
    const l = by[item].filter((e) => e.loaded)
    console.log(item, '=>', l.map((e) => `${e.type.replace('minecraft:', '').replace('create:', 'c:')}[${e.id}]{${e.ins.join(',')}}`).join(' | ') || '(none loaded)')
  }
}
