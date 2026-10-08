import { readFileSync, writeFileSync } from 'node:fs'
const scan = JSON.parse(readFileSync('jarscan.json', 'utf8'))
const reg = JSON.parse(readFileSync('C:/Create+Modpack/quests/.registry.json', 'utf8'))
const MISSING = ['iceandfire', 'mcwbridges', 'mcwdoors', 'mcwfences', 'mcwlights', 'mcwpaths', 'mcwroofs', 'mcwstairs', 'mcwtrpdoors', 'mcwwindows', 'easy_npc', 'easy_npc_config_ui', 'lsp_fixes']
const items = {}
for (const id of reg.item) {
  const ns = id.split(':')[0]
  if (ns === 'numismatics') continue
  items[id] = { src: 'dump' }
}
for (const ns of MISSING) {
  const ids = new Set([...Object.keys(scan.models).filter((k) => k.startsWith(ns + ':')), ...Object.entries(scan.lang).filter(([k, v]) => k.startsWith(ns + ':') && v.kind === 'item').map(([k]) => k)])
  // block-only lang entries with an item model count; block lang without model: probably no item
  for (const id of ids) items[id] ??= { src: 'jar' }
}
const later = ['prospector_plating', 'aeronaut_rigging', 'duelists_filigree', 'diamond_lattice', 'heart', 'incomplete_heart', 'grave_essence', 'lost_item_compass', 'seekers_compass']
const capes = Object.keys(JSON.parse(readFileSync('C:/Create+Modpack/pack/config/lemursaucepacket/capes.json', 'utf8')).capes)
for (const id of [...later, ...capes]) items[`lemursaucepacket:${id}`] ??= { src: 'kubejs' }
for (const [id, v] of Object.entries(items)) v.name = scan.lang[id]?.name ?? null
writeFileSync('items.json', JSON.stringify(items))
const byNs = {}
for (const id of Object.keys(items)) { const ns = id.split(':')[0]; (byNs[ns] ??= []).push(id) }
console.log(Object.entries(byNs).map(([n, l]) => `${n}:${l.length}`).join(' '))
console.log('total', Object.keys(items).length, 'non-minecraft', Object.keys(items).filter((i) => !i.startsWith('minecraft:')).length)
for (const ns of Object.keys(byNs)) writeFileSync(`list_${ns}.txt`, byNs[ns].sort().map((id) => `${id}\t${items[id].name ?? ''}`).join('\n'))
