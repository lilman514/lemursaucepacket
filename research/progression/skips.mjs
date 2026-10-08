import { readFileSync } from 'node:fs'
import { CRAFT, RANGED, BREW } from 'file:///C:/Create+Modpack/skills/unlocks.mjs'
const by = JSON.parse(readFileSync('byResult.json', 'utf8'))
const scan = JSON.parse(readFileSync('jarscan.json', 'utf8'))
const gated = new Map()
for (const c of CRAFT) for (const i of c.items) if (!i.startsWith('#')) gated.set(i, `${c.skill} ${c.level}`)
// trim templates tag
for (const v of scan.itemTags['minecraft:trim_templates']?.values ?? []) gated.set(v, 'smithing 40 (trim templates)')
const COVERED = /^(minecraft:crafting|minecraft:smithing|create:mechanical_crafting|create:mixing|create:compacting|farmersdelight:cooking|sophisticatedbackpacks:backpack_upgrade|sophisticatedbackpacks:smithing_backpack_upgrade|minecraft:crafting_special)/
for (const [item, gate] of gated) {
  const l = (by[item] || []).filter((e) => e.loaded)
  const other = l.filter((e) => !COVERED.test(e.type) || (e.type.startsWith('minecraft:crafting') && !e.id.startsWith('minecraft:')))
  if (other.length) console.log(item, `[${gate}]`, '=>', other.map((e) => `${e.type}[${e.id}]{${e.ins.join(',')}}`).join(' | '))
}
