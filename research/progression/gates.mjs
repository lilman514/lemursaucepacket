// Current gates for every item: CRAFT, RELIC_WEAR, RANGED, PMMO rules, Hardness, plant/chop, brew, quest, palette.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { CRAFT, RELIC_WEAR, RANGED, BREW, PLANT, CHOP, PALETTE } from 'file:///C:/Create+Modpack/skills/unlocks.mjs'
import { HARDNESS } from 'file:///C:/Create+Modpack/enchanting/enchanting.mjs'
const require = createRequire('C:/Create+Modpack/package.json')
const { unzipSync } = require('fflate')
const SP = 'C:/Users/Shawn/AppData/Local/Temp/claude/C--Create-Modpack/ab1859ba-46fb-401e-9816-544fdbbd5524/scratchpad'
const scan = JSON.parse(readFileSync('jarscan.json', 'utf8'))
const items = JSON.parse(readFileSync('items.json', 'utf8'))
// Tag resolver: jar tags + NeoForge c: tags + vanilla minecraft tags (vanilla members are irrelevant: only modded ones matter).
const nf = unzipSync(readFileSync(`${SP}/server-test/libraries/net/neoforged/neoforge/21.1.252/neoforge-21.1.252-universal.jar`), { filter: (f) => /^data\/c\/tags\/item\/.+\.json$/.test(f.name) })
const tags = {}
for (const [t, v] of Object.entries(scan.itemTags)) tags[t] = [...v.values]
for (const [p, d] of Object.entries(nf)) { const t = 'c:' + p.replace(/^data\/c\/tags\/item\//, '').replace(/\.json$/, ''); const j = JSON.parse(new TextDecoder().decode(d)); (tags[t] ??= []).push(...j.values.map((x) => (typeof x === 'string' ? x : x.id))) }
const resolve = (id, seen = new Set()) => {
  if (!id.startsWith('#')) return [id]
  const t = id.slice(1); if (seen.has(t)) return []; seen.add(t)
  return (tags[t] ?? []).flatMap((x) => resolve(x, seen))
}
const gate = {} // id -> [strings]
const add = (id, g) => { (gate[id] ??= []).includes(g) || gate[id].push(g) }
for (const c of CRAFT) for (const i of c.items) for (const r of resolve(i)) add(r, `craft: ${c.skill} ${c.level}${c.machine ? ' (machine)' : ''}`)
for (const r of RELIC_WEAR) add(r.item, `wear: ${r.skill} ${r.level} (relic)`)
for (const r of RANGED) for (const i of r.items) add(i, `use/weapon: ranged ${r.level}`)
for (const b of BREW) add(b.item, `brew ingredient: brewing ${b.level}`)
for (const dir of ['C:/Create+Modpack/pack/kubejs/data/lemursaucepacket/pmmo/items', 'C:/Create+Modpack/pack/kubejs/data/lemursaucepacket_gear/pmmo/items']) {
  for (const f of readdirSync(dir)) {
    const j = JSON.parse(readFileSync(path.join(dir, f), 'utf8'))
    if (!j.requirements) continue
    const req = Object.entries(j.requirements).map(([k, v]) => `${k} ${Object.entries(v).map(([s, l]) => `${s} ${l}`).join('+')}`).join(', ')
    for (const i of j.isTagFor) for (const r of resolve(i)) add(r, `pmmo: ${req}`)
  }
}
const seeds = { 'minecraft:beetroots': 'minecraft:beetroot_seeds', 'farmersdelight:cabbages': 'farmersdelight:cabbage_seeds', 'farmersdelight:onions': 'farmersdelight:onion', 'farmersdelight:budding_tomatoes': 'farmersdelight:tomato_seeds', 'farmersdelight:rice': 'farmersdelight:rice' }
for (const p of PLANT) for (const b of p.blocks) add(seeds[b] ?? b, `plant: farming ${p.level}`)
for (const c of CHOP) for (const b of c.blocks) add(b, `chop: woodcutting ${c.level}`)
for (const [tier, list] of Object.entries(HARDNESS.materials)) for (const i of list) for (const r of resolve(i)) add(r, `hardness ${tier} (mining ${HARDNESS.unlock[tier]}) use-gate`)
for (const [tier, list] of Object.entries(HARDNESS.tiers)) for (const i of list) for (const r of resolve(i)) add(r, `hardness ${tier} block (mining ${HARDNESS.unlock[tier]})`)
for (const r of resolve('#lemursaucepacket:dragonslayer_armor')) add(r, 'quest: wear needs q_ds_done (Dragon Slayer I)')
const dsl = JSON.parse(readFileSync('C:/Create+Modpack/pack/kubejs/data/lemursaucepacket/tags/item/dragonslayer_armor.json', 'utf8')).values.map((v) => v.id ?? v)
for (const r of dsl) add(r, 'quest: wear needs q_ds_done (Dragon Slayer I)')
add('lsp_fixes:masons_palette', `use: construction ${PALETTE.level} (palette)`)
for (const c of Object.keys(JSON.parse(readFileSync('C:/Create+Modpack/pack/config/lemursaucepacket/capes.json', 'utf8')).capes)) add(`lemursaucepacket:${c}`, 'earned (cape unlock)')
writeFileSync('gates.json', JSON.stringify(gate))
const modded = Object.keys(gate).filter((i) => !i.startsWith('minecraft:'))
console.log('gated ids', Object.keys(gate).length, 'modded', modded.length)
for (const i of modded.sort()) console.log(i, '|', gate[i].join('; '))
