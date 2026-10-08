// One-off: turns the reviewed proposal (proposals.mjs) into the pack's skills/modded.mjs, with every /pattern/ expanded
// to the real ids from the item scan (items.json), plus the owner-call entries decided in review.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROPOSALS } from './proposals.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const ids = Object.keys(JSON.parse(readFileSync(path.join(here, 'items.json'), 'utf8')))
const expand = (list) => list.flatMap((x) => {
  if (!x.startsWith('/')) return [x]
  const re = new RegExp(x.slice(1, x.lastIndexOf('/')))
  const hits = ids.filter((id) => re.test(id)).sort()
  if (!hits.length) throw new Error(`pattern ${x} matched nothing`)
  return hits
})

const extra = [
  { mod: 'minecraft', items: ['minecraft:totem_of_undying'], skill: 'hitpoints', level: 50, kind: 'wear', what: 'Totems of undying (to be saved by one)', why: 'A second life on a PvP server with lifesteal: with the survival relics, Hitpoints 50. Holding one without the level slows you (Project MMO); lsp_fixes stops it saving you.' }
]
const gates = [...PROPOSALS, ...extra].map((p) => ({ ...p, items: expand(p.items) }))

const NAMES = {
  create: 'Create', create_connected: 'Create: Connected', createdeco: 'Create Deco', createaddition: 'Create Crafts & Additions',
  create_enchantment_industry: 'Create: Enchantment Industry', createoreexcavation: 'Create Ore Excavation', sliceanddice: 'Create Slice & Dice',
  offroad: 'Offroad', aeronautics: 'Create Aeronautics', createbackpackupgrades: 'Create Backpack Upgrades', sophisticatedbackpacks: 'Sophisticated Backpacks',
  sophisticatedcore: 'Sophisticated Core', waystones: 'Waystones', relics: 'Relics', iceandfire: 'Ice and Fire CE', farmersdelight: "Farmer's Delight",
  friendsandfoes: 'Friends & Foes', illagerinvasion: 'Illager Invasion', piglinproliferation: 'Piglin Proliferation', vanillabackport: 'Vanilla Backport',
  regions_unexplored: 'Regions Unexplored', minecraft: 'Vanilla'
}
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const lines = []
let mod = null
for (const g of gates) {
  if (g.mod !== mod) {
    mod = g.mod
    lines.push('', `  // ${NAMES[mod] ?? mod}`)
  }
  const head = [`kind: ${q(g.kind)}`, `skill: ${q(g.skill)}`, `level: ${g.level}`, ...(g.machine ? ['machine: true'] : []), `what: ${q(g.what)}`]
  lines.push(`  { mod: ${q(g.mod)}, ${head.join(', ')},`)
  lines.push(`    items: [${g.items.map(q).join(', ')}],`)
  lines.push(`    why: ${q(g.why)} },`)
}
const out = `/**
 * Skill gates for the pack's modded items and blocks (2026-10-08): everything with real gameplay value gets the skill
 * and level its usefulness calls for, beside the vanilla anchors in unlocks.mjs (iron gear Smithing 15, diamond gear
 * Crafting 30, ender chests Crafting 50, netherite Smithing 50, shulker boxes Crafting 65, beacons Crafting 75...).
 * Decoration, building blocks, plain materials, ingots and everyday food stay free; creative and technical items too.
 *
 * kind: what the level is for, and what enforces it (skills/build.mjs and unlocks.mjs read this list):
 *   craft  making it (crafting grid, smithing table, cooking pot, Create's blueprint): joins CRAFT, enforced by lsp_fixes.
 *          machine: true = a Create-style machine milestone (listed with the Create machines).
 *   chop   breaking its logs: joins CHOP (Project MMO BREAK).
 *   brew   using it as a brewing ingredient: joins BREW.
 *   hold   hitting with it: Project MMO WEAPON, and Weakness while held without the level.
 *   use    mining or right-clicking with it: Project MMO TOOL / USE.
 *   wear   wearing it (armour, curios, a held totem): Project MMO WEAR with Slowness; relics and totems are also stopped
 *          from working by lsp_fixes (SkillGates.wear), as the Climbing Boots are.
 *   place  placing the block: Project MMO PLACE.
 * Things only Create's mechanical crafters make get a use, hold or place gate instead of a craft gate (a making gate
 * would lock them for everyone, since no player is there to check).
 */
export const MODDED = [${lines.join('\n')}
]
`
writeFileSync('C:/Create+Modpack/skills/modded.mjs', out)
console.log(`${gates.length} gates, ${gates.reduce((n, g) => n + g.items.length, 0)} items`)
