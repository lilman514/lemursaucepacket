// Writes SP/progression-proposal.md, SP/progression-proposal.json and SP/progression-items.csv.
import { readFileSync, writeFileSync } from 'node:fs'
import { PROPOSALS, HARDNESS_ADDITIONS, HARDNESS_OPTIONAL, SKIPS } from './proposals.mjs'
import { CRAFT, BREW, CHOP, PLANT, RANGED, RELIC_WEAR } from 'file:///C:/Create+Modpack/skills/unlocks.mjs'
import { HARDNESS } from 'file:///C:/Create+Modpack/enchanting/enchanting.mjs'

const SP = 'C:/Users/Shawn/AppData/Local/Temp/claude/C--Create-Modpack/ab1859ba-46fb-401e-9816-544fdbbd5524/scratchpad'
const classes = JSON.parse(readFileSync('classes.json', 'utf8'))
const gates = JSON.parse(readFileSync('gates.json', 'utf8'))
const items = JSON.parse(readFileSync('items.json', 'utf8'))
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const short = (id) => id.replace(/^[a-z0-9_]+:/, '')
const nameOf = (id) => classes[id]?.name || items[id]?.name || short(id).replace(/_/g, ' ')

// ------------------------------------------------------------------ resolve proposals
const universe = [...new Set([...Object.keys(classes), ...Object.keys(items).filter((i) => i.startsWith('minecraft:'))])]
const warnings = []
function resolveList(list, label) {
  const out = []
  for (const x of list) {
    if (x.startsWith('/')) {
      const re = new RegExp(x.slice(1, x.lastIndexOf('/')))
      const hits = universe.filter((i) => re.test(i) && classes[i]?.cls !== 'technical/creative-only')
      if (!hits.length) warnings.push(`${label}: pattern ${x} matched nothing`)
      out.push(...hits)
    } else if (classes[x] || items[x]) {
      if (classes[x]?.cls === 'technical/creative-only') warnings.push(`${label}: ${x} is ${classes[x].why}`)
      out.push(x)
    } else warnings.push(`${label}: ${x} is not an item in the pack`)
  }
  return [...new Set(out)].sort()
}
const kindOfGate = (g) => (g.startsWith('craft:') ? 'craft' : g.startsWith('pmmo: WEAR') || g.startsWith('quest: wear') || g.startsWith('wear:') ? 'wear' : g.startsWith('pmmo: WEAPON') ? 'hold' : /^pmmo: (TOOL|USE)|^use/.test(g) ? 'use' : g.startsWith('chop') ? 'chop' : g.startsWith('plant') ? 'plant' : g.startsWith('brew') ? 'brew' : g.startsWith('hardness') ? 'hardness' : 'other')
const props = PROPOSALS.map((p, n) => {
  const ids = resolveList(p.items, `${p.mod} ${p.what}`)
  for (const id of ids) for (const g of gates[id] ?? []) {
    const k = kindOfGate(g)
    if (k === p.kind || (k === 'wear' && p.kind === 'hold') || (k === 'use' && p.kind === 'hold' && g.includes('WEAPON'))) warnings.push(`double gate: ${id} already has "${g}" (proposal ${p.what})`)
  }
  return { ...p, n, ids }
})
const propsByItem = {}
for (const p of props) for (const id of p.ids) (propsByItem[id] ??= []).push(p)
const gateText = (p) => `${p.kind} ${cap(p.skill)} ${p.level}${p.machine ? ' (machine)' : ''}`

// ------------------------------------------------------------------ mods
const MODS = {
  create: 'Create', create_connected: 'Create: Connected', createdeco: 'Create Deco', copycats: 'Create: Copycats+', createaddition: 'Create Crafts & Additions',
  create_enchantment_industry: 'Create: Enchantment Industry', create_dragons_plus: 'Create: Dragons Plus', createoreexcavation: 'Create Ore Excavation',
  createrailwaysnavigator: 'Create Railways Navigator', sliceanddice: 'Create Slice & Dice', createbackpackupgrades: 'Create Backpack Upgrades',
  aeronautics: 'Create Aeronautics', simulated: 'Simulated (Aeronautics bundle)', offroad: 'Offroad (Aeronautics bundle)',
  sophisticatedbackpacks: 'Sophisticated Backpacks', sophisticatedcore: 'Sophisticated Core', waystones: 'Waystones', relics: 'Relics', iceandfire: 'Ice and Fire CE',
  farmersdelight: "Farmer's Delight", friendsandfoes: 'Friends & Foes', illagerinvasion: 'Illager Invasion', piglinproliferation: 'Piglin Proliferation',
  vanillabackport: 'Vanilla Backport (minecraft: ids)', regions_unexplored: 'Regions Unexplored', naturalist: 'Naturalist', creeperoverhaul: 'Creeper Overhaul',
  variantsandventures: 'Variants & Ventures', guardvillagers: 'Guard Villagers', woodworks: 'Woodworks', everycomp: 'Every Compat', mcwfurnitures: "Macaw's Furniture",
  mcwroofs: "Macaw's Roofs", mcwwindows: "Macaw's Windows", mcwdoors: "Macaw's Doors", mcwtrpdoors: "Macaw's Trapdoors", mcwfences: "Macaw's Fences and Walls",
  mcwlights: "Macaw's Lights and Lamps", mcwpaths: "Macaw's Paths and Pavings", mcwbridges: "Macaw's Bridges", mcwstairs: "Macaw's Stairs",
  gravestone: 'GraveStone', lootr: 'Lootr', ftbquests: 'FTB Quests', ftblibrary: 'FTB Library', patchouli: 'Patchouli', moonlight: 'Moonlight Lib', dragonlib: 'DragonLib',
  easy_npc: 'Easy NPC: Core', easy_npc_config_ui: 'Easy NPC: Config UI', lemursaucepacket: 'LemurSaucePacket (KubeJS items)', lsp_fixes: 'lsp_fixes (the companion mod)'
}
const ORDER = Object.keys(MODS)
const JAR_ONLY = new Set(['iceandfire', 'mcwbridges', 'mcwdoors', 'mcwfences', 'mcwlights', 'mcwpaths', 'mcwroofs', 'mcwstairs', 'mcwtrpdoors', 'mcwwindows', 'easy_npc', 'easy_npc_config_ui', 'lsp_fixes'])

// Why an ungated group stays ungated: per mod and class, then per class.
const KEEP = {
  'aeronautics|transport': 'Airships stay open by design (pack 1.13.0: the physics assembler and flight parts are not gated).',
  'simulated|transport': 'Airship and contraption parts stay open by design (pack 1.13.0).',
  'simulated|machine/automation': 'Sensors and transmissions for contraptions: open with the airships.',
  'simulated|tool': 'A laser pointer for sensors: no power.',
  'offroad|transport': 'Vehicle wheels: open, like the airships they ship with.',
  'aeronautics|armour': "Aviator's goggles: Create goggles with leather, cosmetic.",
  'create|machine/automation': "Kinetics, contraption parts, redstone and the open machines (press, mixer, blaze burner, deployer, millstone, crushing wheels). Create's own progression covers them; more gates would be 'too crazy'.",
  'create|storage/logistics': 'Belts, funnels, tunnels, pipes, tanks, packagers, frogports and postboxes: basic logistics, open.',
  'create|transport': 'Track, signals, minecart contraptions: the gate is the train station and controls (Agility 35).',
  'create|tool': 'Wrench, clipboard, schedule, blueprint, super glue, linked controller: everyday Create tools.',
  'create|armour': 'Goggles and cardboard disguise armour (no protection).',
  'create|weapon': 'Cardboard sword (knockback toy).',
  'create|food': 'Machine-made foods (spout and mixer), which only a machine makes: a gate would lock them for everyone.',
  'create_connected|machine/automation': 'Gearboxes, clutches, brakes, crank wheels, kinetic batteries, links: kinetics, open.',
  'create_connected|storage/logistics': 'Fluid vessel, brass chute, inventory access port and bridge: logistics, open.',
  'create_dragons_plus|storage/logistics': 'Fluid hatches and fragile tanks: fluid logistics, open.',
  'createaddition|machine/automation': 'Alternator, rolling mill, connectors, relays, portable energy interface, and the motor, accumulator and tesla coil (gated through the capacitor).',
  'createaddition|tool': 'Diamond-grit sandpaper and the pale gold amulet (recharges items): small conveniences.',
  'createaddition|light source': 'Lights on wires.',
  'create_enchantment_industry|magic/enchanting': 'The experience hatch (machine-made): open.',
  'createoreexcavation|machine/automation': 'The drilling machine, extractor and sample drill are mechanical-crafted; the drill heads carry the gate (Mining 50/65/80).',
  'createrailwaysnavigator|utility block': 'Station displays and clocks: information.',
  'createrailwaysnavigator|transport': 'The navigator plans train routes: information, no power.',
  'sophisticatedbackpacks|storage/logistics': 'The leather backpack (day one), jukebox upgrades (music), stack downgrades, the everlasting upgrade (already behind an end crystal, Crafting 60, and a nether star) and the XP pump (needs the switched-off pump upgrade, so it cannot be made).',
  'farmersdelight|storage/logistics': 'Cabinets, baskets, crates and the rice bag: chest-class storage.',
  'farmersdelight|utility block': 'Cooking pot, stove, cutting board, signs, rope, safety nets, tatami, rich soil: the gate is on the dishes, not the kitchen.',
  'farmersdelight|food': 'Ingredients, cuts and snacks (cooked rice, patties, cookies, popsicles, apple cider, dog food, horse feed): low value, or already gated (see above).',
  'iceandfire|magic/enchanting': "Dragon staff, flute and meals, bestiary, chains: tools for a dragon you already hatched (the egg is the gate).",
  'iceandfire|armour': 'Armour for a tamed dragon (only matters once you hatch one) and the blindfold.',
  'iceandfire|food': 'Dragon flesh and stews (dragon food) and odd foods.',
  'iceandfire|tool': 'Chains, the bestiary and the fishing spear (no recipe here).',
  'iceandfire|utility block': 'Podiums, lecterns, nests: display blocks.',
  'iceandfire|machine/automation': 'Dragonforge bricks and inputs: the core carries the gate.',
  'relics|food': 'Meatballs from the Chef\'s Hat.',
  'relics|crafting material': 'Golden teeth, pet bones and relic experience bottles.',
  'friendsandfoes|machine/automation': 'Copper buttons and lightning rods.',
  'friendsandfoes|utility block': 'Beehives in every wood.',
  'illagerinvasion|crafting material': 'Dusts, gems and essences dropped by illagers; their uses are gated.',
  'piglinproliferation|tool': "The Traveler's Compass: a curiosity.",
  'naturalist|tool': 'Capture net and whistle: no power.',
  'naturalist|storage/logistics': 'The knapsack: small.',
  'vanillabackport|transport': 'Pale oak boats, and the dried ghast (the harness is the gate for riding).',
  'vanillabackport|utility block': 'The creaking heart: a mob spawner block from the pale garden.',
  'waystones|crafting material': 'Warp dust, shards and the epitaph: materials.',
  'waystones|transport': 'Blank and bound scrolls, attuned shards and the twinbound feather: cheap or made in the world from gated things.',
  'lemursaucepacket|tool': "The lifesteal compasses (Lost Item, Seeker's): the owner's lifesteal design, left as it is.",
  'lemursaucepacket|magic/enchanting': 'The Heart: the lifesteal currency (a late sequenced assembly), left as it is.',
  'lemursaucepacket|crafting material': 'Compacted diamond and netherite, the Duelist pattern (loot-only), Grave Essence, the incomplete Heart.',
  'mcwfurnitures|storage/logistics': 'Drawers, wardrobes, cabinets, counters and desks with a few slots: chest-class storage, decoration first.',
  'everycomp|storage/logistics': 'Every Compat wood variants of chests, cabinets and furniture with storage: chest-class.',
  'woodworks|storage/logistics': 'Wooden chests and closets: vanilla chest-class.',
  'createdeco|storage/logistics': '(see the shipping containers above)',
  'regions_unexplored|transport': 'Boats in the new woods: vanilla-level.',
  'mcwdoors|tool': 'The garage door remote.',
  'regions_unexplored|crafting material': 'Prismarite crystals, and redstone buds, bulbs and pointed redstone, which only give or smelt into redstone (already use-gated at tier II).',
  'regions_unexplored|decoration/building block': 'Plants, soils, stone and the oak-like woods (small oak, silver birch, alpha and dead trees stay free like oak and birch).',
  'gravestone|utility block': 'A decorative grave (the real graves need Grave Essence).'
}
const KEEP_CLASS = {
  'decoration/building block': 'Decoration and building blocks stay free (the design rule).',
  'light source': 'Light sources are decoration.',
  'crafting material': 'Plain materials stay free; where they matter, what they make is gated.',
  'utility block': 'Cheap utility blocks with no power to gate.',
  'storage/logistics': 'Chest-class storage and basic logistics.',
  food: 'Everyday food.',
  'technical/creative-only': 'Excluded: spawn eggs, creative or debug items, mod-internal items, or switched off in this pack (JEI-hidden).',
  transport: 'Vanilla-level transport.',
  tool: 'Small tools.',
  weapon: 'Minor weapons.',
  armour: 'Cosmetic or minor armour.',
  'machine/automation': 'Basic parts.',
  'magic/enchanting': 'Minor magic.'
}
const listIds = (ids, max = 6) => {
  const names = ids.map((i) => `\`${short(i)}\``)
  return names.length <= max ? names.join(', ') : `${names.slice(0, max - 1).join(', ')} and ${names.length - max + 1} more`
}
const clsOf = (ids) => [...new Set(ids.map((i) => classes[i]?.cls ?? 'vanilla item'))].join(', ')
const currentOf = (ids) => {
  const gs = [...new Set(ids.flatMap((i) => gates[i] ?? []))]
  return gs.length ? gs.join('; ') : 'none'
}

// ------------------------------------------------------------------ per-mod tables
const mods = {}
for (const [id, v] of Object.entries(classes)) (mods[v.mod] ??= []).push(id)
const modOrder = [...ORDER.filter((m) => mods[m]), ...Object.keys(mods).filter((m) => !ORDER.includes(m)).sort()]
const md = []
const tableFor = (mod) => {
  const ids = mods[mod].sort()
  const rows = []
  const mine = props.filter((p) => p.mod === mod)
  for (const p of mine) rows.push([listIds(p.ids), clsOf(p.ids), currentOf(p.ids), `**${gateText(p)}**`, p.why])
  for (const h of HARDNESS_ADDITIONS) { const list = h.resolved.filter((i) => classes[i]?.mod === mod); if (list.length) rows.push([listIds(list), clsOf(list), currentOf(list), '**Hardness ' + h.tier + ' (Mining ' + HARDNESS.unlock[h.tier] + ')**' + (h.blocks.length ? ': breaking and use' : ': use-gate'), h.why]) }
  const covered = new Set([...mine.flatMap((p) => p.ids), ...HARDNESS_ADDITIONS.flatMap((h) => h.resolved)])
  // already gated, no new proposal
  const byGate = {}
  for (const id of ids) if (!covered.has(id) && gates[id]?.length) (byGate[gates[id].join('; ')] ??= []).push(id)
  for (const [g, list] of Object.entries(byGate)) rows.push([listIds(list), clsOf(list), g, 'keep', g.startsWith('earned') ? 'Earned, never crafted.' : 'Already gated: no second gate.'])
  // the rest, by class
  const byCls = {}
  for (const id of ids) if (!covered.has(id) && !gates[id]?.length) (byCls[classes[id].cls] ??= []).push(id)
  for (const [c, list] of Object.entries(byCls).sort((a, b) => b[1].length - a[1].length)) {
    rows.push([`${list.length} item${list.length === 1 ? '' : 's'}: ${listIds(list, 5)}`, c, 'none', 'none', KEEP[`${mod}|${c}`] ?? KEEP_CLASS[c]])
  }
  return rows
}
const esc = (s) => String(s).replace(/\|/g, '\\|')

// ------------------------------------------------------------------ numbers for the overview
const clsTotals = {}
for (const v of Object.values(classes)) clsTotals[v.cls] = (clsTotals[v.cls] || 0) + 1
const perSkill = {}
const perSkillItems = {}
for (const p of props) { perSkill[p.skill] = (perSkill[p.skill] || 0) + 1; perSkillItems[p.skill] = (perSkillItems[p.skill] || 0) + p.ids.length }
const perKind = {}
for (const p of props) perKind[p.kind] = (perKind[p.kind] || 0) + 1
const top = [...props].sort((a, b) => b.impact - a.impact || a.level - b.level).slice(0, 20)
const proposedItems = new Set(props.flatMap((p) => p.ids))

// ------------------------------------------------------------------ markdown
const SKILL_ORDER = ['attack', 'strength', 'defence', 'ranged', 'hitpoints', 'mining', 'woodcutting', 'farming', 'fishing', 'cooking', 'smithing', 'crafting', 'enchanting', 'brewing', 'construction', 'agility']
md.push('# LemurSaucePacket: progression proposal for modded items', '')
md.push(`A proposal only: nothing under the pack was changed. Built ${new Date().toISOString().slice(0, 10)} from the pack's gate tables (\`skills/unlocks.mjs\`, \`skills/build.mjs\`, \`enchanting/enchanting.mjs\`, \`gear/gear.mjs\`, the Project MMO rules under \`pack/kubejs/data\`), the registry dump of 2026-09-29 and the server's mod jars. The per-item list (class, current gate, proposed gate for all ${Object.keys(classes).length} items) is in \`progression-items.csv\`; the machine-readable proposal is \`progression-proposal.json\`.`, '')
md.push('## What was counted', '')
md.push(`- **${Object.keys(classes).length} modded items**: the dump's ${items ? 6821 : 0} ids minus vanilla and minus Numismatics (62 ids; the mod has since been removed), plus ${Object.values(classes).filter((v) => v.src === 'jar').length} items read from the jars of mods added after the dump and ${Object.values(classes).filter((v) => v.src === 'kubejs').length} KubeJS items registered after it. Vanilla Backport's ${Object.values(classes).filter((v) => v.mod === 'vanillabackport').length} additions use \`minecraft:\` ids and are counted as modded.`)
md.push('- **Mods missing from the registry dump** (their items were read from `assets/<mod>/models/item` and `lang/en_us.json`): Ice and Fire CE 2.0; the nine Macaw\'s building mods (Bridges, Doors, Fences and Walls, Lights and Lamps, Paths and Pavings, Roofs, Stairs, Trapdoors, Windows); Easy NPC Core and Config UI; and `lsp_fixes` (the companion mod: Climbing Boots, Mason\'s Palette, coins). Also newer than the dump: the KubeJS hand-made parts (Prospector\'s Plating, Aeronaut\'s Rigging, Duelist\'s Filigree, Diamond Lattice), the five lifesteal items and the 33 cape items. Create: Let The Adventure Begin and Dungeons and Taverns register no items (their keys, maps and potions are vanilla items with components).')
md.push(`- **By class:** ${Object.entries(clsTotals).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', ')}.`, '')

md.push('## The tier logic', '')
md.push('Levels follow the RuneScape curve the pack already uses (level 50 is under 1% of the XP to 99, so the 1 to 50 range is where most play happens) and sit next to the anchors already in the tables, so a new gate always lands beside something of the same power:', '')
md.push('| Band | Levels | What lives there (existing anchors in bold) |', '|---|---|---|')
md.push('| Settler | 1 to 15 | Day-one conveniences: **leather 5, gold gear Smithing 10, iron gear Smithing 15, the drill/saw/harvester Mining/Woodcutting/Farming 15**. Proposed: copper backpacks, pickup upgrades, toolboxes, pine trees, the smelting upgrade. |')
md.push('| Andesite and iron | 15 to 30 | **Anvils and hoppers Smithing 20, crossbows 20, the encased fan Cooking 20, Climbing Boots**. Proposed: item vaults, mechanical arms, iron backpacks, silver gear, elevators, return scrolls, the slicer, organic compost, willows. |')
md.push('| Brass and Nether | 30 to 45 | **Diamond gear Crafting 30, mechanical crafters 30, steam engines Smithing 35, trains Agility 35, the blaze enchanter Enchanting 35, the enchanting table Crafting 40**. Proposed: gold backpacks, magnets and compacting, electricity (the capacitor), portstones and warp plates, the happy ghast harness, the stock-keeping network, the alchemy upgrade, maples. |')
md.push('| End prep | 45 to 60 | **Ender chests Crafting 50, netherite Smithing 50, the printer Enchanting 50, the eye of ender Brewing 55, end crystals Crafting 60**. Proposed: waystones 45, the warp stone 50, diamond backpacks and ender linkers 50, sharestones 55, dragonbone gear 55, the blaze forger 55, netherite backpacks 55, the Chorus Staff and Clot of Time, dragonscale armour 60. |')
md.push('| End and dragons | 60 to 80 | **Shulker boxes Crafting 65, compacted netherite Smithing 65, the mace Smithing 70, conduits 70, beacons Crafting 75, respawn anchors 80**. Proposed: the imbuing table 65, summoning crystals 65, the Glitchy and Ghostly Mantles, dragon eggs and the dragonforge 70, redwoods 70, dragonsteel weapons and tools 75, dragonsteel making Smithing 80. |')
md.push('| Mastery | 80 to 99 | **The netherite drill head Mining 80, capes 99**. Nothing new is proposed above 80: the top of each skill stays the cape. |', '')
md.push('Which skill a gate uses follows what the item does, the way the existing tables do (the train station sits on Agility, the encased fan on Cooking):', '')
md.push('- **Crafting**: storage, logistics, electronics and the finer magical things (backpacks, vaults, the stock network, capacitors, summoning crystals). **Smithing**: metal gear, forges and metalwork in a backpack. **Cooking** and **Brewing**: dishes, kitchen machines, potions and potion devices. **Enchanting**: experience and enchanting machines. **Construction**: building tools and base defences.')
md.push('- **Agility**: everything that moves you (waystones, scrolls, mounts, mobility relics). **Mining**, **Woodcutting**, **Farming**: their tools, prospecting, trees (the CHOP ladder), husbandry (dragon eggs). **Attack**: weapons by tier; **Defence**: armour, shields and defensive relics; **Ranged**: bows and cannons.')
md.push('- **Strength** and **Hitpoints** unlock nothing today but their perks and quest steps; they get the damage relics and heavy weapons (Strength) and the survival relics and totems (Hitpoints). Fishing has nothing new to gate.', '')

md.push('## Kinds of gate, and what each needs', '')
md.push('| Kind | Meaning | Enforced by | Count |', '|---|---|---|---|')
md.push(`| craft | Making it at a crafting grid, smithing table, cooking pot, Create's blueprint or the backpack crafting upgrade | A \`CRAFT\` entry (\`machine: true\` for Create-style machines): works today | ${perKind.craft ?? 0} |`)
md.push(`| wear | Wearing it (armour, curios, or held for totems) | Project MMO \`WEAR\` (+ Slowness). Relics need a \`RELIC_WEAR\` entry and an ability check in lsp_fixes like the Climbing Boots', or they keep working | ${perKind.wear ?? 0} |`)
md.push(`| hold | Hitting with it | Project MMO \`WEAPON\` (+ \`WEAR\` for the held penalty), as the vanilla swords | ${perKind.hold ?? 0} |`)
md.push(`| use | Using it (right-click, mining with it, placing an egg) | Project MMO \`USE\` / \`TOOL\` | ${perKind.use ?? 0} |`)
md.push(`| place | Placing the block | Project MMO \`PLACE\` on the block: new in \`skills/build.mjs\` (only crops use PLACE today) | ${perKind.place ?? 0} |`)
md.push(`| chop | Breaking the logs | A \`CHOP\` entry (Project MMO \`BREAK\`): works today | ${perKind.chop ?? 0} |`)
md.push(`| brew | Using it as a brewing ingredient | A \`BREW\` entry; the potion-level map (\`POTION_LEVEL\`) is keyed \`minecraft:<id>\`, so modded potions (\`friendsandfoes:reaching\`, \`illagerinvasion:berserking\`) need their own ids for the XP | ${perKind.brew ?? 0} |`, '')
md.push('## Rules kept', '')
md.push('- **The machine rule.** Mechanical crafters, the Crafter and basins never make a gated item, so nothing that only a mechanical crafter makes gets a `craft` gate (it would lock it for everyone). Those get a `place` or `use` gate (waystones, the warp stone, the wand of symmetry, the extendo grip, the mounted potato cannon), or the gear sets\' trick: a crafting-table part carries the gate (the capacitor for electric motors and tesla coils). Machines with no player that make something (the dragonforge, the slicer, sprinklers, the blaze forger) are gated on being built.')
md.push('- **Open on purpose:** the press, mixer, blaze burner and deployer, airships (Aeronautics, Simulated, Offroad wheels), and anything only a machine makes (Create\'s foods, the enchanting templates). No land-claim mods.')
md.push('- **No double gates.** Items that already have a gate keep it and get nothing of the same kind (checked by the generator). Dragonscale and dragonsteel armour keep their quest gate (Dragon Slayer I) for wearing and only gain a making gate; a Defence level on top is left as an option.')
md.push('- **Free by design:** ingots (dragonsteel and silver included), emeralds, decoration and building blocks, plain materials, and everyday food.', '')
md.push(`## Summary`, '')
md.push(`${props.length} proposed gates over ${proposedItems.size} items, ${HARDNESS_ADDITIONS.length} Hardness additions (${new Set(HARDNESS_ADDITIONS.flatMap((h) => h.resolved)).size} items) and ${SKIPS.length - 1} gate skips to fix.`, '')
md.push('| Skill | Gates | Items |', '|---|---|---|')
for (const s of SKILL_ORDER) if (perSkill[s]) md.push(`| ${cap(s)} | ${perSkill[s]} | ${perSkillItems[s]} |`)
md.push('', '**The 20 with the most effect on play:**', '')
top.forEach((p, i) => md.push(`${i + 1}. ${p.what}: ${gateText(p)} (${MODS[p.mod] ?? p.mod})`))
md.push('')
if (warnings.length) md.push('Generator notes: ' + warnings.join('; '), '')

md.push('## Decisions for the owner', '')
md.push('- **Create Backpack Upgrades** (pressing 30, mixing 35): the owner asked for this mod by name (2026-09-29) and said not to nerf it without asking.')
md.push('- **Dragon armour**: wearing it stays quest-gated (Dragon Slayer I). A Defence level on top (60 for dragonscale, 75 for dragonsteel) would be the RuneScape way, but it is a second gate on the same act, so it is not proposed.')
md.push('- **Totems**: the Friends & Foes totems are proposed; the vanilla Totem of Undying (ungated today) would fit at Hitpoints 50.')
md.push("- **Create's ore stones**: the optional Hardness entries below narrow a machine route the design leaves open on purpose.", '')
md.push('## How to apply (once agreed)', '')
md.push('1. `skills/unlocks.mjs`: the `craft` rows become `CRAFT` entries (`machine: true` where marked); the `chop` rows `CHOP` entries; the `brew` rows `BREW` entries (and `POTION_LEVEL` needs to accept modded potion ids, since `skills/build.mjs` writes `minecraft:<id>`); the relic rows `RELIC_WEAR` entries.')
md.push('2. `skills/build.mjs`: `hold` rows become `{ WEAPON, WEAR }` requirements with Weakness (as the tier swords), `use` rows `{ TOOL, USE }`, `wear` rows `{ WEAR }` with Slowness, and `place` rows a new block rule `{ PLACE }` per block (the way the PLANT rules are written). Add them to `writeGuideData` so the skill screens list them.')
md.push("3. Relics: Project MMO alone only slows the wearer; the abilities need a check like the Climbing Boots' (`SkillGates.wear`), hooked where Relics ticks or triggers an ability.")
md.push('4. `enchanting/enchanting.mjs` `HARDNESS`: add the blocks to `tiers` and the materials to `materials` as listed below.')
md.push("5. The skips below: extend the machine rule to Create's spout, deployer and sequenced assembly (or remove those recipes), and test the backpack smithing and anvil tabs, the imbuing table and the blaze forger against the gates.")
md.push('6. Check the server log line `Skill gates in: …` after a rebuild, and rerun the skills test kit (crafting refusals) on the scratch server.', '')
md.push('## Per mod', '')
md.push('Each table lists the proposals first, then what is already gated, then the rest by class with the reason it stays free.', '')
for (const m of modOrder) {
  const ids = mods[m]
  const counts = {}
  for (const id of ids) counts[classes[id].cls] = (counts[classes[id].cls] || 0) + 1
  md.push(`### ${MODS[m] ?? m} (\`${m === 'vanillabackport' ? 'minecraft' : m}\`)`, '')
  md.push(`${ids.length} item${ids.length === 1 ? '' : 's'}${JAR_ONLY.has(m) ? ', read from the jar (not in the registry dump)' : ''}: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${n} ${c}`).join(', ')}.`, '')
  md.push('| Item(s) | Class | Current gate | Proposed gate | Reason |', '|---|---|---|---|---|')
  for (const r of tableFor(m)) md.push(`| ${r.map(esc).join(' | ')} |`)
  md.push('')
}
// vanilla items used by modded content
const vanillaProps = props.filter((p) => p.ids.some((i) => i.startsWith('minecraft:') && !classes[i]))
if (vanillaProps.length) {
  md.push('### Vanilla items that a mod gives a new use', '')
  md.push('| Item(s) | Class | Current gate | Proposed gate | Reason |', '|---|---|---|---|---|')
  for (const p of vanillaProps) md.push(`| ${esc(listIds(p.ids.filter((i) => !classes[i])))} | vanilla item | ${esc(currentOf(p.ids))} | **${gateText(p)}** | ${esc(p.why)} |`)
  md.push('')
}

md.push('## Hardness additions', '')
md.push(`The Hardness tiers today: ${Object.entries(HARDNESS.tiers).map(([t, l]) => `${t} = ${l.join(', ')} (Mining ${HARDNESS.unlock[t]})`).join('; ')}. Create's zinc is already in tier I through its \`c:\` tags, and Regions Unexplored's raw redstone block is already in tier II (NeoForge's \`c:ores/redstone\` includes \`#minecraft:redstone_ores\`, which it joins).`, '')
md.push('| Tier | Blocks (break) | Materials (use-gate) | Resolves to | Why |', '|---|---|---|---|---|')
for (const h of HARDNESS_ADDITIONS) md.push(`| ${h.tier} (Mining ${HARDNESS.unlock[h.tier]}) | ${h.blocks.length ? h.blocks.map((b) => `\`${b}\``).join(', ') : '-'} | ${h.items.map((b) => `\`${b}\``).join(', ')} | ${h.resolved.map((b) => `\`${b}\``).join(', ')} | ${esc(h.why)} |`)
md.push('', 'Optional (not recommended unless the Create route matters):', '')
md.push('| Tier | Materials | Why |', '|---|---|---|')
for (const h of HARDNESS_OPTIONAL) md.push(`| ${h.tier} | ${h.items.map((b) => `\`${b}\``).join(', ')} | ${esc(h.why)} |`)
md.push('')
md.push('## Recipes and routes that skip a gate', '')
md.push('| Gate | Item(s) | Route | Fix |', '|---|---|---|---|')
for (const s of SKIPS) md.push(`| ${esc(s.gate)} | ${s.items.map((b) => `\`${b}\``).join(', ')} | ${esc(s.route)} | ${esc(s.fix)} |`)
md.push('')
writeFileSync(`${SP}/progression-proposal.md`, md.join('\n'))

// ------------------------------------------------------------------ json
const json = {
  about: 'LemurSaucePacket progression proposal (not applied). kind: craft = making it (CRAFT; machine: true = Create-style machine), wear = Project MMO WEAR (relics: RELIC_WEAR), hold = WEAPON (+WEAR penalty), use = USE/TOOL, place = PLACE on the block, chop = CHOP (BREAK on logs), brew = BREW ingredient. impact: 1-5.',
  proposals: props.map(({ mod, ids, skill, level, kind, machine, what, why, impact }) => ({ mod, items: ids, skill, level, kind, ...(machine ? { machine } : {}), what, why, impact })),
  hardness: HARDNESS_ADDITIONS.map(({ tier, blocks, items: it, resolved, why }) => ({ tier, items: resolved, blockTags: blocks, materialEntries: it, why })),
  hardnessOptional: HARDNESS_OPTIONAL,
  skips: SKIPS
}
writeFileSync(`${SP}/progression-proposal.json`, JSON.stringify(json, null, 2) + '\n')

// ------------------------------------------------------------------ csv
const csvEsc = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s))
const lines = ['mod,id,name,class,class_note,current_gate,proposed_gate']
for (const m of modOrder) for (const id of mods[m].sort()) {
  const v = classes[id]
  lines.push([m, id, v.name ?? '', v.cls, v.why, (gates[id] ?? []).join('; '), [...(propsByItem[id] ?? []).map(gateText), ...HARDNESS_ADDITIONS.filter((h) => h.resolved.includes(id)).map((h) => 'hardness ' + h.tier + ' (Mining ' + HARDNESS.unlock[h.tier] + ')')].join('; ')].map(csvEsc).join(','))
}
writeFileSync(`${SP}/progression-items.csv`, lines.join('\n') + '\n')

console.log('proposals', props.length, 'items', proposedItems.size, 'per skill', JSON.stringify(perSkill), 'per kind', JSON.stringify(perKind))
console.log('warnings:\n' + warnings.join('\n'))
console.log('top20:\n' + top.map((p) => `${p.impact} ${p.what} ${gateText(p)}`).join('\n'))
