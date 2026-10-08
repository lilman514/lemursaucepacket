import { readFileSync } from 'node:fs'
const scan = JSON.parse(readFileSync('jarscan.json', 'utf8'))
const reg = JSON.parse(readFileSync('C:/Create+Modpack/quests/.registry.json', 'utf8'))
const dumpNs = new Set(reg.item.map((i) => i.split(':')[0]))
// namespaces with items per jar
const nsItems = {}
for (const [id, v] of Object.entries(scan.lang)) if (true) { const ns = id.split(':')[0]; (nsItems[ns] ??= { lang: 0, model: 0, jars: new Set() }); nsItems[ns].lang++; nsItems[ns].jars.add(v.jar) }
for (const [id, jar] of Object.entries(scan.models)) { const ns = id.split(':')[0]; (nsItems[ns] ??= { lang: 0, model: 0, jars: new Set() }); nsItems[ns].model++; nsItems[ns].jars.add(jar) }
const rows = Object.entries(nsItems).map(([ns, v]) => [ns, v.lang, v.model, dumpNs.has(ns) ? 'DUMP' : '----', [...v.jars].join(',')])
rows.sort((a, b) => a[3].localeCompare(b[3]) || a[0].localeCompare(b[0]))
for (const r of rows) console.log(r.join(' | '))
console.log('\nDump namespaces not in any jar:', [...dumpNs].filter((n) => !nsItems[n]))
for (const [j, v] of Object.entries(scan.jars)) console.log('JAR', j, '=>', v.modIds.join(','), '| ns:', v.namespaces.join(','))
