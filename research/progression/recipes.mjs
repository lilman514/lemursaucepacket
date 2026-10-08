// Index recipes by result item: which recipe types make each item (jar recipes, minus KubeJS removals, plus KubeJS additions).
import { readFileSync, writeFileSync } from 'node:fs'
const scan = JSON.parse(readFileSync('jarscan.json', 'utf8'))
const reg = JSON.parse(readFileSync('C:/Create+Modpack/quests/.registry.json', 'utf8'))
const loadedRecipes = new Set(reg.recipe)
const removed = (id) => /^waystones:/.test(id) || ['copper_backpack', 'iron_backpack', 'iron_backpack_from_copper', 'gold_backpack', 'diamond_backpack', 'stack_upgrade_tier_2'].some((x) => id === `sophisticatedbackpacks:${x}`) || /^createoreexcavation:(ore_vein_type|drilling)\/(diamond|hardened_diamond|emerald|netherite)$/.test(id) || /^createoreexcavation:cutting\/(diamond|emerald)_cutting$/.test(id)
const outs = (r) => {
  const res = []
  const take = (x) => {
    if (!x) return
    if (typeof x === 'string') res.push(x)
    else if (Array.isArray(x)) x.forEach(take)
    else if (x.id) res.push(x.id)
    else if (x.item) res.push(x.item)
    else if (x.result) take(x.result)
  }
  take(r.result); take(r.results); take(r.output); take(r.outputs)
  return res.filter((s) => typeof s === 'string' && s.includes(':'))
}
const ins = (r) => {
  const res = new Set()
  const walk = (x) => {
    if (!x) return
    if (typeof x === 'string') { if (/^#?[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(x)) res.add(x); return }
    if (Array.isArray(x)) return x.forEach(walk)
    if (typeof x === 'object') {
      if (x.item) res.add(x.item)
      if (x.tag) res.add('#' + x.tag)
      for (const [k, v] of Object.entries(x)) if (!['item', 'tag', 'type', 'count', 'amount', 'chance'].includes(k)) walk(v)
    }
  }
  walk(r.key); walk(r.ingredients); walk(r.ingredient); walk(r.base); walk(r.addition); walk(r.template); walk(r.input); walk(r.inputs)
  return [...res]
}
const byResult = {}
const stats = { total: 0, removed: 0, notLoaded: 0 }
for (const [id, r] of Object.entries(scan.recipes)) {
  stats.total++
  if (removed(id)) { stats.removed++; continue }
  const loaded = loadedRecipes.has(id) || !reg.recipe.length
  for (const o of outs(r)) (byResult[o] ??= []).push({ id, type: r.type, loaded, ins: ins(r).slice(0, 12) })
  if (!loaded) stats.notLoaded++
}
// KubeJS additions (read by hand from pack/kubejs/server_scripts and gear/gear.mjs)
const add = (item, type, id, insList = []) => (byResult[item] ??= []).push({ id, type, loaded: true, kubejs: true, ins: insList })
const SB = 'sophisticatedbackpacks'
for (const x of ['copper_backpack', 'iron_backpack', 'gold_backpack', 'diamond_backpack']) add(`${SB}:${x}`, `${SB}:backpack_upgrade`, `lemursaucepacket:backpacks/${x}`)
add(`${SB}:stack_upgrade_tier_2`, 'minecraft:crafting_shaped', 'lemursaucepacket:backpacks/stack_upgrade_tier_2')
const WS = 'waystones'
add(`${WS}:warp_dust`, 'create:mixing', 'ws'); add(`${WS}:dormant_shard`, 'create:compacting', 'ws'); add(`${WS}:deepslate_shard`, 'create:compacting', 'ws')
for (const x of ['blank_scroll', 'return_scroll', 'warp_scroll', 'portal_scroll', 'epitaph']) add(`${WS}:${x}`, 'minecraft:crafting_shaped', 'ws')
add(`${WS}:twinbound_feather`, 'minecraft:crafting_shapeless', 'ws')
add(`${WS}:warp_stone`, 'create:mechanical_crafting', 'ws')
for (const x of ['waystone', 'mossy_waystone', 'sandy_waystone', 'deepslate_waystone', 'blackstone_waystone', 'end_stone_waystone', 'red_nether_bricks_waystone', 'purpur_waystone', 'prismarine_waystone', 'mud_bricks_waystone']) { add(`${WS}:${x}`, 'create:mechanical_crafting', 'ws'); add(`${WS}:${x}`, 'minecraft:crafting_shapeless(restyle)', 'ws') }
const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
for (const c of COLORS) { if (c !== 'white') add(`${WS}:${c}_sharestone`, 'create:mechanical_crafting', 'ws'); add(`${WS}:${c}_portstone`, 'create:mechanical_crafting', 'ws') }
add(`${WS}:warp_plate`, 'create:mechanical_crafting', 'ws')
add('lemursaucepacket:grave_essence', 'create:mixing', 'lifesteal'); add('lemursaucepacket:heart', 'create:sequenced_assembly', 'lifesteal')
add('lemursaucepacket:lost_item_compass', 'create:mechanical_crafting', 'lifesteal'); add('lemursaucepacket:seekers_compass', 'create:mechanical_crafting', 'lifesteal')
for (const [it, t] of [['compacted_diamond', 'create:compacting'], ['compacted_netherite', 'create:compacting'], ['lumber_axe', 'create:mechanical_crafting'], ['excavators_pickaxe', 'create:mechanical_crafting'], ['prospectors_pickaxe', 'create:mechanical_crafting'], ['harvesters_scythe', 'create:mechanical_crafting'], ['builders_wand', 'create:mechanical_crafting'], ['brass_sabre', 'create:mechanical_crafting'], ['sturdy_warhammer', 'create:mechanical_crafting'], ['anglers_cap', 'minecraft:crafting_shaped'], ['prospector_plating', 'minecraft:crafting_shaped'], ['aeronaut_rigging', 'minecraft:crafting_shaped'], ['duelists_filigree', 'minecraft:crafting_shaped'], ['diamond_lattice', 'minecraft:crafting_shaped']]) add(`lemursaucepacket:${it}`, t, 'gear')
for (const s of ['prospector', 'aeronaut', 'duelist', 'compacted_diamond']) for (const p of ['helmet', 'chestplate', 'leggings', 'boots']) add(`lemursaucepacket:${s}_${p}`, 'create:mechanical_crafting', 'gear')
for (const p of ['helmet', 'chestplate', 'leggings', 'boots']) add(`lemursaucepacket:compacted_netherite_${p}`, 'minecraft:smithing_transform', 'gear')
for (const n of ['stone', 'blackstone', 'deepslate', 'end_stone', 'netherrack']) { add(`piglinproliferation:${n}_fire_ring`, 'minecraft:crafting_shaped', 'fixes'); add(`piglinproliferation:${n}_soul_fire_ring`, 'minecraft:crafting_shaped', 'fixes') }
writeFileSync('byResult.json', JSON.stringify(byResult))
console.log(stats, 'results', Object.keys(byResult).length)
