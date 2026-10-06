// The LemurSaucePacket quest book. Edit this file, then run `node quests/build.mjs`.
//
// Chapter fields: key, group, title, subtitle, icon, layout ('grid' for collections), and about / unlocks
// (the info card at the top of the chapter: what the questline is for and what finishing it lets you do).
//
// Quest fields: key (stable id, never rename once players have progress), title, subtitle, desc
// (array of lines; "" = blank line; & colour codes), after (quest keys in the same chapter), tier (1-5, see
// TIERS), tasks, reward (extras on top of the tier: { xp, coins (Gold Coins), items,
// tables, rolls, commands }), icon, shape, size, pos ([x, y] to place by hand), minDeps (how many of `after`
// must be done), hideLines, hidden (invisible until `after` is done), milestone (Skills chapter only).
// Task kinds: { item, count, components, match } { kill, count } { structure } { biome } { dimension }
// { advancement } { observe: block id or '#block_tag', ticks } (look at one) { checkmark, title }
// { custom, title } (only a server script completes it). Any task can carry an `icon`.
//
// Rewards: every quest pays its tier's XP and Gold Coins (they feed the server economy) and rolls once
// on the tier's reward table; finales and milestones add fixed prizes players can see coming.

import { QUEST_ITEMS } from '../npcs/quests.mjs'

const tip = (text) => `&7${text}`

/** A Gold Coins stack as an icon: the pile grows with the amount, like the item in game. */
const coinsIcon = (amount) => ({ id: 'lsp_fixes:gold_coins', components: { 'lsp_fixes:coin_amount': amount } })

// The raid captain's banner (vanilla Raid.getLeaderBannerInstance): a white banner with components.
const OMINOUS_BANNER = {
  id: 'minecraft:white_banner',
  components: {
    'minecraft:banner_patterns': [
      ['rhombus', 'cyan'],
      ['stripe_bottom', 'light_gray'],
      ['stripe_center', 'gray'],
      ['border', 'light_gray'],
      ['stripe_middle', 'black'],
      ['half_horizontal', 'light_gray'],
      ['circle', 'light_gray'],
      ['border', 'black']
    ].map(([pattern, color]) => ({ color, pattern: `minecraft:${pattern}` })),
    'minecraft:hide_additional_tooltip': {},
    'minecraft:item_name': '{"translate":"block.minecraft.ominous_banner"}'
  }
}

/** An enchanted book with one stored enchantment (reward item, or a fuzzy-matched task). */
const enchantedBook = (enchantment, level = 1) => ({
  id: 'minecraft:enchanted_book',
  components: { 'minecraft:stored_enchantments': { levels: { [enchantment.includes(':') ? enchantment : `minecraft:${enchantment}`]: level } } }
})
/** A Hardness tome (enchanting/enchanting.mjs): the book a pickaxe needs for harder ores. */
const hardnessTome = (tier) => enchantedBook('lemursaucepacket:hardness', tier)
/** An item task that must carry exactly these components (FTB's fuzzy match: every listed component equal). */
const bookTask = (stack, title) => ({ item: stack.id, components: stack.components, match: 'fuzzy', title })
/** A quest icon drawn from one of the pack's own textures (FTB's custom icon item). */
const textureIcon = (texture) => ({ id: 'ftbquests:custom_icon', components: { 'ftbquests:icon': `lemursaucepacket:textures/${texture}.png` } })
const skillIcon = (skill) => textureIcon(`skills/${skill}`)

// ---------------------------------------------------------------- reward tiers
// Every quest has a tier. The tier pays XP and coins and rolls once on its reward table (below), so the reward
// grows with the difficulty: early tiers give materials, the middle ones Create parts, backpack upgrades and
// food, the hard ones gear, relics, warp items and enchanted books.

export const TIERS = {
  1: { name: 'Settler', xp: 25, coins: 80, table: 'settler_supplies' },
  2: { name: 'Engineer', xp: 60, coins: 240, table: 'engineers_crate' },
  3: { name: 'Artisan', xp: 150, coins: 480, table: 'artisans_crate' },
  4: { name: 'Master', xp: 400, coins: 1280, table: 'masters_cache' },
  5: { name: 'Legend', xp: 1000, coins: 5120, table: 'legends_hoard' }
}

/** The twenty real relics (data/relics/tags/item/relic.json in Relics 0.12.8). */
const RELICS = [
  'leafy_mantle',
  'springy_boot',
  'kinetic_belt',
  'reflective_necklace',
  'jellyfish_necklace',
  'midnight_mantle',
  'roller_skate',
  'chorus_staff',
  'clot_of_time',
  'piglin_mask',
  'chef_hat',
  'cut_glass_boot',
  'rider_flute',
  'ring_of_the_seven_deadly_sins',
  'sphere_of_self_sacrifice',
  'hunting_belt',
  'experience_disperser',
  'glitchy_mantle',
  'ghostly_mantle',
  'shield_of_retaliation'
]
const RELIC_NAMES = {
  leafy_mantle: 'Leafy Mantle',
  springy_boot: 'Springy Boot',
  kinetic_belt: 'Kinetic Belt',
  reflective_necklace: 'Reflective Necklace',
  jellyfish_necklace: 'Jellyfish Necklace',
  midnight_mantle: 'Midnight Mantle',
  roller_skate: 'Roller Skate',
  chorus_staff: 'Chorus Staff',
  clot_of_time: 'Clot of Time',
  piglin_mask: 'Piglin Mask',
  chef_hat: "Chef's Hat",
  cut_glass_boot: 'Cut Glass Boot',
  rider_flute: 'Rider Flute',
  ring_of_the_seven_deadly_sins: 'Ring of the Seven Deadly Sins',
  sphere_of_self_sacrifice: 'Sphere of Self-Sacrifice',
  hunting_belt: 'Hunting Belt',
  experience_disperser: 'Experience Disperser',
  glitchy_mantle: 'Glitchy Mantle',
  ghostly_mantle: 'Ghostly Mantle',
  shield_of_retaliation: 'Shield of Retaliation'
}
/** Where each relic drops (publish/sources.mjs reads the same from the Relics jar). */
const RELIC_WHERE = {
  leafy_mantle: 'forest and jungle chests',
  springy_boot: 'mountain and hill chests',
  kinetic_belt: 'End and stronghold chests',
  reflective_necklace: 'Nether chests',
  jellyfish_necklace: 'ocean, beach and river chests',
  midnight_mantle: 'End and stronghold chests',
  roller_skate: 'any Overworld chest',
  chorus_staff: 'End and stronghold chests',
  clot_of_time: 'End and stronghold chests',
  piglin_mask: 'bastion and piglin chests',
  chef_hat: 'village and pillager chests',
  cut_glass_boot: 'ocean, beach and river chests',
  rider_flute: 'cave, village and pillager chests',
  ring_of_the_seven_deadly_sins: 'Nether chests',
  sphere_of_self_sacrifice: 'Nether chests',
  hunting_belt: 'village and pillager chests',
  experience_disperser: 'any chest',
  glitchy_mantle: 'End and stronghold chests',
  ghostly_mantle: 'Nether chests',
  shield_of_retaliation: 'Nether chests'
}

// Reward tables: [item, count, weight] entries, or { table, weight } to roll another table.
const TABLES = [
  {
    key: 'settler_supplies',
    title: "Settler's Supplies",
    icon: 'minecraft:bread',
    entries: [
      ['minecraft:iron_ingot', 6, 5],
      ['minecraft:copper_ingot', 8, 5],
      ['create:andesite_alloy', 8, 5],
      ['minecraft:torch', 32, 4],
      ['minecraft:bread', 8, 4],
      ['minecraft:coal', 16, 4],
      ['minecraft:cooked_beef', 6, 3],
      ['minecraft:arrow', 16, 3],
      ['minecraft:bone_meal', 16, 3],
      ['create:builders_tea', 3, 3],
      ['minecraft:leather', 4, 3],
      ['minecraft:string', 8, 2],
      ['minecraft:lantern', 4, 2],
      ['create:experience_nugget', 4, 2]
    ]
  },
  {
    key: 'engineers_crate',
    title: "Engineer's Crate",
    icon: 'create:andesite_casing',
    entries: [
      ['create:cogwheel', 8, 5],
      ['create:shaft', 16, 5],
      ['create:andesite_casing', 8, 5],
      ['create:large_cogwheel', 4, 4],
      ['create:iron_sheet', 8, 4],
      ['create:copper_sheet', 8, 4],
      ['create:belt_connector', 8, 3],
      ['create:chute', 4, 3],
      ['create:andesite_funnel', 4, 3],
      ['create:zinc_ingot', 8, 3],
      ['create:experience_nugget', 8, 3],
      ['sophisticatedbackpacks:upgrade_base', 2, 3],
      ['create:depot', 2, 2],
      ['create:andesite_tunnel', 4, 2],
      ['create:super_glue', 1, 2],
      ['create:filter', 2, 2],
      ['create:sand_paper', 2, 2],
      ['create:sweet_roll', 4, 2],
      ['create:honeyed_apple', 2, 2],
      ['minecraft:iron_block', 2, 2],
      ['create:encased_fan', 1, 1],
      ['create:water_wheel', 1, 1],
      ['create:mechanical_saw', 1, 1]
    ]
  },
  {
    key: 'artisans_crate',
    title: "Artisan's Crate",
    icon: 'create:brass_casing',
    entries: [
      ['create:brass_ingot', 8, 5],
      ['create:brass_casing', 4, 4],
      ['create:brass_sheet', 8, 4],
      ['create:golden_sheet', 4, 3],
      ['create:electron_tube', 4, 3],
      ['create:precision_mechanism', 2, 3],
      ['create:experience_nugget', 16, 3],
      ['waystones:warp_scroll', 2, 3],
      ['create:sturdy_sheet', 2, 2],
      ['create:brass_funnel', 2, 2],
      ['create:brass_tunnel', 2, 2],
      ['create:smart_chute', 1, 2],
      ['create:deployer', 1, 2],
      ['create:fluid_tank', 4, 2],
      ['create:mechanical_crafter', 3, 2],
      ['create:bar_of_chocolate', 4, 2],
      ['create:chocolate_glazed_berries', 4, 2],
      ['sophisticatedbackpacks:magnet_upgrade', 1, 2],
      ['sophisticatedbackpacks:feeding_upgrade', 1, 2],
      ['sophisticatedbackpacks:restock_upgrade', 1, 2],
      ['sophisticatedbackpacks:pickup_upgrade', 1, 2],
      ['sophisticatedbackpacks:crafting_upgrade', 1, 2],
      ['waystones:return_scroll', 2, 2],
      ['minecraft:golden_apple', 2, 2],
      ['minecraft:diamond', 2, 2],
      ['create:railway_casing', 4, 1],
      ['sophisticatedbackpacks:void_upgrade', 1, 1],
      ['sophisticatedbackpacks:smelting_upgrade', 1, 1],
      ['farmersdelight:shepherds_pie_block', 1, 1],
      ['farmersdelight:roast_chicken_block', 1, 1],
      ['farmersdelight:honey_glazed_ham_block', 1, 1]
    ]
  },
  {
    key: 'masters_cache',
    title: "Master's Cache",
    icon: 'create:precision_mechanism',
    entries: [
      { table: 'relic_cache', weight: 4 },
      [enchantedBook('unbreaking', 3), 1, 3],
      [enchantedBook('efficiency', 4), 1, 3],
      [enchantedBook('protection', 4), 1, 3],
      [enchantedBook('sharpness', 4), 1, 3],
      [enchantedBook('mending'), 1, 2],
      [enchantedBook('fortune', 3), 1, 2],
      [enchantedBook('silk_touch'), 1, 2],
      [enchantedBook('looting', 3), 1, 2],
      [enchantedBook('feather_falling', 4), 1, 2],
      [enchantedBook('power', 4), 1, 2],
      [enchantedBook('depth_strider', 3), 1, 1],
      [enchantedBook('fire_aspect', 2), 1, 1],
      [enchantedBook('infinity'), 1, 1],
      [enchantedBook('respiration', 3), 1, 1],
      [enchantedBook('lemursaucepacket:telekinesis'), 1, 2],
      ['waystones:warp_scroll', 4, 3],
      ['waystones:return_scroll', 4, 2],
      ['waystones:portal_scroll', 2, 2],
      ['create:precision_mechanism', 8, 3],
      ['create:sturdy_sheet', 8, 2],
      ['create:brass_casing', 16, 2],
      ['create:mechanical_arm', 1, 2],
      ['create:crushing_wheel', 2, 1],
      ['minecraft:diamond', 6, 3],
      ['minecraft:netherite_scrap', 2, 2],
      ['minecraft:golden_apple', 4, 2],
      ['minecraft:experience_bottle', 16, 2],
      ['minecraft:totem_of_undying', 1, 1],
      ['create_enchantment_industry:experience_bucket', 1, 1],
      ['sophisticatedbackpacks:stack_upgrade_tier_1', 1, 2],
      ['createbackpackupgrades:pressing_upgrade', 1, 2],
      ['createbackpackupgrades:mixing_upgrade', 1, 2],
      ['sophisticatedbackpacks:advanced_magnet_upgrade', 1, 1],
      ['sophisticatedbackpacks:advanced_pickup_upgrade', 1, 1],
      ['sophisticatedbackpacks:advanced_feeding_upgrade', 1, 1],
      ['sophisticatedbackpacks:tank_upgrade', 1, 1],
      ['sophisticatedbackpacks:anvil_upgrade', 1, 1],
      ['sophisticatedbackpacks:xp_pump_upgrade', 1, 1],
      ['sophisticatedbackpacks:everlasting_upgrade', 1, 1],
      ['lemursaucepacket:lumber_axe', 1, 1],
      ['lemursaucepacket:prospectors_pickaxe', 1, 1],
      ['lemursaucepacket:harvesters_scythe', 1, 1],
      ['lemursaucepacket:brass_sabre', 1, 1],
      ['lemursaucepacket:anglers_cap', 1, 1]
    ]
  },
  {
    key: 'legends_hoard',
    title: "Legend's Hoard",
    icon: 'lemursaucepacket:compacted_diamond',
    entries: [
      { table: 'relic_cache', weight: 8 },
      ['lemursaucepacket:duelists_pattern', 1, 4],
      ['lemursaucepacket:stormcallers_sabre', 1, 2],
      ['lemursaucepacket:ember_crown', 1, 2],
      ['lemursaucepacket:excavators_pickaxe', 1, 2],
      ['lemursaucepacket:builders_wand', 1, 2],
      ['lemursaucepacket:sturdy_warhammer', 1, 2],
      ['lemursaucepacket:prospector_helmet', 1, 1],
      ['lemursaucepacket:aeronaut_boots', 1, 1],
      ['lemursaucepacket:compacted_diamond', 4, 3],
      ['waystones:warp_stone', 1, 3],
      ['waystones:waystone', 1, 2],
      ['waystones:portal_scroll', 4, 2],
      [enchantedBook('mending'), 1, 3],
      [enchantedBook('unbreaking', 3), 1, 2],
      [enchantedBook('efficiency', 5), 1, 2],
      [enchantedBook('sharpness', 5), 1, 2],
      [enchantedBook('protection', 4), 1, 2],
      [enchantedBook('fortune', 3), 1, 2],
      [enchantedBook('looting', 3), 1, 2],
      [enchantedBook('silk_touch'), 1, 2],
      [enchantedBook('lemursaucepacket:telekinesis'), 1, 2],
      ['minecraft:netherite_ingot', 2, 3],
      ['minecraft:totem_of_undying', 1, 2],
      ['minecraft:enchanted_golden_apple', 1, 2],
      ['minecraft:heart_of_the_sea', 1, 1],
      ['sophisticatedbackpacks:stack_upgrade_tier_2', 1, 2],
      ['sophisticatedbackpacks:everlasting_upgrade', 1, 2],
      ['create_enchantment_industry:experience_bucket', 1, 2],
      ['create:experience_block', 2, 2]
    ]
  },
  {
    key: 'relic_cache',
    title: 'Relic Cache',
    icon: 'relics:clot_of_time',
    entries: RELICS.map((r) => [`relics:${r}`, 1, 1])
  }
]

// ---------------------------------------------------------------- skills
// Mirrors skills/build.mjs (and SKILLS_FOR_CAPES in kubejs/server_scripts/capes.js): id, name, group, what each
// level does, and the levels that unlock something (for the milestone quests' text).

const SKILL_GROUPS = { combat: '&c', gathering: '&a', artisan: '&6', support: '&b' }
const SKILLS = [
  { id: 'attack', name: 'Attack', group: 'combat', perk: 'each level adds melee and bow damage', unlocks: { 5: 'stone swords', 10: 'golden swords', 15: 'iron swords and the crossbow', 20: 'the potato cannon', 25: 'the Brass Sabre', 30: 'diamond swords', 40: 'the trident and the Brass Duelist set', 45: 'the Sturdy Warhammer', 50: 'netherite swords, the mace and the Stormcaller\'s Sabre' } },
  { id: 'strength', name: 'Strength', group: 'combat', perk: '+0.3% melee crit chance per level', unlocks: {} },
  { id: 'defence', name: 'Defence', group: 'combat', perk: '+0.02 armour per level', unlocks: { 5: 'copper diving gear', 10: 'golden and chainmail armour', 15: 'iron armour', 20: 'the turtle helmet', 30: 'diamond armour', 40: 'the Ember Crown', 45: 'the Compacted Diamond set', 50: 'netherite armour and diving gear', 60: 'the Compacted Netherite set' } },
  { id: 'ranged', name: 'Ranged', group: 'combat', perk: '+0.3% ranged crit chance per level', unlocks: {} },
  { id: 'hitpoints', name: 'Hitpoints', group: 'combat', perk: 'a heart every ten levels', unlocks: {} },
  { id: 'mining', name: 'Mining', group: 'gathering', perk: 'faster mining', unlocks: { 5: 'stone picks', 10: 'golden picks and Hardness I (iron, zinc, lapis)', 15: 'iron picks', 20: 'Hardness II (gold, redstone)', 30: 'diamond picks, Hardness III (diamonds, obsidian) and the Prospector\'s Pickaxe', 35: 'the Prospector\'s set', 40: 'Hardness IV (ancient debris) and the Excavator\'s Pickaxe', 50: 'netherite picks and Hardness V' } },
  { id: 'woodcutting', name: 'Woodcutting', group: 'gathering', perk: 'faster chopping', unlocks: { 5: 'stone axes', 10: 'golden axes', 15: 'iron axes', 30: 'diamond axes and the Lumber Axe', 50: 'netherite axes' } },
  { id: 'farming', name: 'Farming', group: 'gathering', perk: 'faster tilling', unlocks: { 5: 'stone hoes', 10: 'golden hoes', 15: 'iron hoes', 30: 'diamond hoes and the Harvester\'s Scythe', 50: 'netherite hoes' } },
  { id: 'fishing', name: 'Fishing', group: 'gathering', perk: 'better catches', unlocks: { 25: 'the Angler\'s Cap' } },
  { id: 'cooking', name: 'Cooking', group: 'artisan', perk: 'XP from every meal', unlocks: {} },
  { id: 'smithing', name: 'Smithing', group: 'artisan', perk: 'XP from ingots and gear', unlocks: {} },
  { id: 'crafting', name: 'Crafting', group: 'artisan', perk: 'XP from everything you craft', unlocks: { 30: 'the Builder\'s Wand' } },
  { id: 'enchanting', name: 'Enchanting', group: 'artisan', perk: 'enchantments past their vanilla max: the caps open with the skill', unlocks: { 20: 'level VI of the raised enchantments', 40: 'level VII', 60: 'level VIII', 80: 'level IX', 99: 'level X' } },
  { id: 'agility', name: 'Agility', group: 'support', perk: 'speed and less fall damage', unlocks: { 30: 'the elytra', 40: 'the Aeronaut\'s set' } }
]
const MILESTONE_LEVELS = [10, 25, 50, 75, 99]
const MILESTONE_TIER = { 10: 1, 25: 2, 50: 3, 75: 4, 99: 5 }
/** Fixed prizes at 50 and 75, on top of the tier: something the skill itself makes useful. */
const SKILL_PRIZES = {
  attack: { 50: [{ item: 'lemursaucepacket:sturdy_warhammer' }], 75: [{ item: 'lemursaucepacket:stormcallers_sabre' }] },
  strength: { 50: [enchantedBook('sharpness', 5)], 75: [{ item: 'relics:ring_of_the_seven_deadly_sins' }] },
  defence: { 50: [{ item: 'lemursaucepacket:compacted_diamond', count: 8 }], 75: [{ item: 'minecraft:totem_of_undying' }, enchantedBook('protection', 5)] },
  ranged: { 50: [enchantedBook('power', 5), { item: 'minecraft:spectral_arrow', count: 32 }], 75: [enchantedBook('infinity'), { item: 'minecraft:trident' }] },
  hitpoints: { 50: [{ item: 'minecraft:golden_apple', count: 8 }], 75: [{ item: 'minecraft:enchanted_golden_apple', count: 2 }, { item: 'minecraft:totem_of_undying' }] },
  mining: { 50: [{ item: 'lemursaucepacket:excavators_pickaxe' }], 75: [enchantedBook('fortune', 5), { item: 'createoreexcavation:diamond_drill' }] },
  woodcutting: { 50: [{ item: 'lemursaucepacket:lumber_axe' }], 75: [enchantedBook('efficiency', 5), { item: 'create:mechanical_saw', count: 4 }] },
  farming: { 50: [{ item: 'lemursaucepacket:harvesters_scythe' }], 75: [{ item: 'sliceanddice:sprinkler', count: 4 }, { item: 'sliceanddice:fertilizer_bucket', count: 2 }] },
  fishing: { 50: [{ item: 'lemursaucepacket:anglers_cap' }], 75: [enchantedBook('luck_of_the_sea', 3), enchantedBook('lure', 3), { item: 'minecraft:heart_of_the_sea' }] },
  cooking: { 50: [{ item: 'relics:chef_hat' }], 75: [{ item: 'farmersdelight:netherite_knife' }, { item: 'farmersdelight:honey_glazed_ham_block', count: 2 }] },
  smithing: { 50: [{ item: 'minecraft:netherite_upgrade_smithing_template', count: 2 }, { item: 'minecraft:netherite_scrap', count: 4 }], 75: [{ item: 'lemursaucepacket:compacted_netherite' }, { item: 'minecraft:netherite_ingot', count: 2 }] },
  crafting: { 50: [{ item: 'lemursaucepacket:builders_wand' }], 75: [{ item: 'sophisticatedbackpacks:crafting_upgrade' }, { item: 'create:mechanical_crafter', count: 9 }] },
  enchanting: { 50: [enchantedBook('mending')], 75: [{ item: 'create_enchantment_industry:experience_bucket', count: 2 }, enchantedBook('unbreaking', 5)] },
  agility: { 50: [{ item: 'lemursaucepacket:aeronaut_boots' }], 75: [{ item: 'minecraft:elytra' }] }
}
const TOTAL_MILESTONES = [
  { total: 100, tier: 2, title: 'Total 100', desc: 'A hundred levels across every skill.' },
  { total: 250, tier: 3, title: 'Total 250', desc: 'Two hundred and fifty levels in all.' },
  { total: 500, tier: 4, title: 'Total 500', desc: 'Half way to the top. Five hundred levels.', coins: 5000 },
  { total: 750, tier: 4, title: 'Total 750', desc: 'Seven hundred and fifty levels.', tables: ['relic_cache'], coins: 5000 },
  { total: 1000, tier: 5, title: 'Total 1000', desc: 'A thousand levels. Very few will get here.', coins: 40000 },
  { total: 1386, tier: 5, title: '&6Maxed', desc: 'Every one of the fourteen skills at 99. The animated Maxed Cape unlocks the moment you get there (/capes).', coins: 80000, tables: ['relic_cache', 'legends_hoard'], size: 1.6, shape: 'gear' }
]

function skillsChapter() {
  const quests = []
  const colX = (i) => Math.round(i * 1.7 * 20) / 20
  const left = SKILLS.filter((s) => s.group === 'combat' || s.group === 'support')
  const right = SKILLS.filter((s) => s.group === 'gathering' || s.group === 'artisan')
  const place = (list, x0) => {
    list.forEach((skill, row) => {
      const colour = SKILL_GROUPS[skill.group]
      MILESTONE_LEVELS.forEach((level, i) => {
        const prev = i > 0 ? MILESTONE_LEVELS[i - 1] : 0
        const unlocked = Object.entries(skill.unlocks)
          .filter(([at]) => Number(at) > prev && Number(at) <= level)
          .map(([at, what]) => `${at}: ${what}`)
        const desc = [`Reach &e${skill.name} ${level}&r. ${skill.name} gives ${skill.perk}.`]
        if (unlocked.length) desc.push('', '&eUnlocked on the way:&r', ...unlocked.map((u) => `• ${u}`))
        if (i === 0) desc.push('', tip('Milestones complete by themselves: the server checks your levels every few seconds. Rewards wait here to be claimed.'))
        if (level === 99) desc.push('', `&6The ${skill.name} Cape is yours at 99.&r Open /capes to wear it.`)
        const reward = { items: [...(SKILL_PRIZES[skill.id]?.[level] ?? [])] }
        if (level === 99) {
          reward.coins = 40000
          reward.tables = ['relic_cache', 'legends_hoard']
          reward.xp = 2000
        }
        quests.push({
          key: `${skill.id}_${level}`,
          title: `${colour}${skill.name} ${level}`,
          milestone: { skill: skill.id, level, name: skill.name },
          tier: MILESTONE_TIER[level],
          after: i > 0 ? [`${skill.id}_${prev}`] : undefined,
          icon: skillIcon(skill.id),
          shape: level === 99 ? 'gear' : undefined,
          size: level === 99 ? 1.2 : undefined,
          pos: [x0 + colX(i), Math.round(row * 1.5 * 20) / 20],
          desc,
          tasks: [{ custom: true, title: `${skill.name} level ${level}`, icon: textureIcon('skills/level_up') }],
          reward
        })
      })
    })
  }
  place(left, 0)
  place(right, 10.5)
  const totalY = Math.round((Math.max(left.length, right.length) * 1.5 + 0.8) * 20) / 20
  TOTAL_MILESTONES.forEach((m, i) => {
    quests.push({
      key: `total_${m.total}`,
      title: `&e${m.title}`,
      milestone: { total: m.total },
      tier: m.tier,
      after: i > 0 ? [`total_${TOTAL_MILESTONES[i - 1].total}`] : undefined,
      icon: textureIcon('skills/total_level'),
      shape: m.shape,
      size: m.size,
      pos: [Math.round((3.15 + i * 2.2) * 20) / 20, totalY],
      desc: [m.desc, '', tip('Your total level is every skill added together, 14 to 1386.')],
      tasks: [{ custom: true, title: `Total level ${m.total}`, icon: textureIcon('skills/total_level') }],
      reward: { items: m.items, tables: m.tables, coins: m.coins }
    })
  })
  return quests
}

// ---------------------------------------------------------------- helpers

/** Grid positions for collections laid out by hand: index → [x, y]. */
const gridPos = (i, cols, x0 = 0, y0 = 0, dx = 2.1, dy = 1.9) => [Math.round((x0 + (i % cols) * dx) * 20) / 20, Math.round((y0 + Math.floor(i / cols) * dy) * 20) / 20]

export default {
  title: 'LemurSaucePacket',
  icon: 'create:cogwheel',
  tiers: TIERS,
  tables: TABLES,
  groups: [
    { key: 'lemurton', title: 'Lemurton' },
    { key: 'main_quests', title: 'Main Quests' },
    { key: 'ages', title: 'The Ages' },
    { key: 'industry', title: 'Industry' },
    { key: 'expeditions', title: 'Expeditions' },
    { key: 'guides', title: 'Field Guides' },
    { key: 'mastery', title: 'Mastery' }
  ],
  chapters: [
    // ================================================================= LEMURTON
    // The spawn city's questlines, given by its people (npcs/npcs.mjs). Steps are game stages (player tags) that
    // NPC dialog buttons set; rewards hand themselves over (auto) as you talk.
    {
      key: 'lemurton_welcome',
      group: 'lemurton',
      title: 'Welcome to Lemurton',
      subtitle: 'Find the capital, meet the mayor and find your way around.',
      about: "Lemurton is the realm's first city, a short walk from where you wake up, and a safe zone: no fighting, digging or building inside the walls. Its people trade and hand out quests: right-click one to talk.",
      unlocks: 'a purse of coins, a loaf of bread, and the run of the city.',
      icon: 'waystones:waystone',
      quests: [
        {
          key: 'find_lemurton',
          title: '&6Find Lemurton',
          subtitle: 'The capital',
          shape: 'gear',
          size: 1.5,
          icon: 'minecraft:compass',
          tier: 1,
          auto: true,
          desc: ['Lemurton, the capital, is a few minutes from where you woke up: you got a &6Compass to Lemurton&r, and a line in chat says how far and which way.', '', 'Walk in through any of its four gates.', '', tip('Every town you find has a name; it shows on screen as you walk in.')],
          tasks: [{ stage: 'q_lemurton_found', title: 'Walk into Lemurton', icon: 'minecraft:compass' }]
        },
        {
          key: 'meet_mayor',
          title: '&6Meet the Mayor',
          subtitle: 'By the market',
          after: ['find_lemurton'],
          icon: 'minecraft:bell',
          tier: 1,
          auto: true,
          desc: ['Mayor Thaddeus greets newcomers at the south edge of the market, in the middle of the city.', '', 'Right-click him and ask for work.', '', tip('Everyone in Lemurton talks: shopkeepers, market traders, guards, townsfolk.')],
          tasks: [{ stage: 'q_welcome_met', title: 'Ask the mayor for work', icon: 'minecraft:bell' }],
          reward: { coins: 160 }
        },
        {
          key: 'market_day',
          title: 'Market Day',
          after: ['meet_mayor'],
          icon: 'minecraft:bread',
          tier: 1,
          auto: true,
          desc: ['Bessa the Baker has a stall on the far side of the market, past the great tree from the waystone.', '', "Right-click her: she has a word for you first. Then right-click her again (or press &eLet's trade&r) for her shop, and buy something. The coins from the last quest are enough.", '', tip('Every trader and shopkeeper sells their own goods for Gold Coins and buys anything you bring: with their shop open, click it in your inventory.')],
          tasks: [{ stage: 'q_welcome_bread', title: 'Buy something from Bessa', icon: 'minecraft:bread' }]
        },
        {
          key: 'report_back',
          title: 'Report Back',
          after: ['market_day'],
          icon: 'minecraft:writable_book',
          tier: 1,
          auto: true,
          desc: ['Tell the mayor how you got on.', '', tip("Lemurton's people have troubles of their own: the Cook, Sir Vyvin's squire, the Champions' Guild. Their quests appear in your book once they give them to you.")],
          tasks: [{ stage: 'q_welcome_done', title: 'Talk to the mayor', icon: 'minecraft:bell' }],
          reward: { coins: 240, items: [{ item: 'minecraft:bread', count: 4 }] }
        }
      ]
    },

    // ================================================================= MAIN QUESTS
    // RuneScape-style quests, given by Lemurton's people (npcs/npcs.mjs, steps in npcs/quests.mjs). Each chapter's first
    // quest is invisible until its start stage is set, so a quest only appears in the book once someone has given it to
    // you; the steps after it show one at a time (hidden until the step before is done). Rewards hand themselves over.
    {
      key: 'cooks_assistant',
      group: 'main_quests',
      title: "Cook's Assistant",
      subtitle: 'Main quest · Novice · 1 quest point',
      about: "Lemurton's Cook is in a panic: the mayor's feast is tonight and there is nothing for the cake.",
      unlocks: 'the Cook\'s thanks, Cooking XP, and the first step towards the Champions\' Guild.',
      icon: 'minecraft:cake',
      quests: [
        {
          key: 'start',
          title: "&6Cook's Assistant",
          subtitle: 'Started by the Cook',
          shape: 'gear',
          size: 1.5,
          invisible: true,
          icon: 'minecraft:cake',
          tier: 1,
          auto: true,
          desc: ['The Cook, in the butcher\'s shop on the ring street, needs a bucket of milk, an egg and a pot of fine flour for the mayor\'s cake.', '', tip('Quests like this one only appear in your book once someone gives them to you. Talk to everyone.')],
          tasks: [{ stage: 'q_cook_started', title: 'Offer to help the Cook', icon: 'minecraft:cake' }]
        },
        {
          key: 'ingredients',
          title: 'The Ingredients',
          after: ['start'],
          hidden: true,
          optional: true,
          tier: 1,
          desc: ['A bucket of milk, an egg, and a pot of flour: grind wheat in a Create millstone.', '', 'Take them to the Cook.'],
          tasks: [{ item: 'minecraft:milk_bucket' }, { item: 'minecraft:egg' }, { item: 'create:wheat_flour' }]
        },
        {
          key: 'done',
          title: '&aQuest complete!',
          subtitle: "Cook's Assistant",
          after: ['start'],
          hidden: true,
          shape: 'gear',
          size: 1.3,
          icon: 'minecraft:cake',
          tier: 2,
          auto: true,
          desc: ["You saved the mayor's feast.", '', '&eRewards:&r 1 quest point, 3,000 Cooking XP, coins.'],
          tasks: [{ stage: 'q_cook_done', title: 'Give the Cook the ingredients', icon: 'minecraft:cake' }],
          reward: { coins: 500, commands: ['pmmo admin {p} add cooking xp 3000'] }
        }
      ]
    },
    {
      key: 'knights_sword',
      group: 'main_quests',
      title: "The Knight's Sword",
      subtitle: 'Main quest · Intermediate · 1 quest point',
      about: "Sir Vyvin's squire has lost his master's sword, and Sir Vyvin is back tomorrow.",
      unlocks: 'Smithing XP, coins, and the squire\'s undying gratitude.',
      icon: 'minecraft:iron_sword',
      quests: [
        {
          key: 'start',
          title: "&6The Knight's Sword",
          subtitle: 'Started by Squire Asrol',
          shape: 'gear',
          size: 1.5,
          invisible: true,
          icon: 'minecraft:iron_sword',
          tier: 1,
          auto: true,
          desc: ['Squire Asrol, at the armourer\'s on the ring street, dropped Sir Vyvin\'s sword down a well. Only a smith taught by the dwarves could forge another.'],
          tasks: [{ stage: 'q_sword_started', title: 'Hear the squire out', icon: 'minecraft:iron_sword' }]
        },
        {
          key: 'brann',
          title: 'Brann the Smith',
          after: ['start'],
          hidden: true,
          tier: 1,
          auto: true,
          icon: 'minecraft:anvil',
          desc: ['Brann learned his craft in the dwarven halls. Ask him at the smithy on the ring street.'],
          tasks: [{ stage: 'q_sword_brann', title: 'Ask Brann for a new sword', icon: 'minecraft:anvil' }]
        },
        {
          key: 'makings',
          title: 'The Makings',
          after: ['brann'],
          hidden: true,
          optional: true,
          tier: 2,
          desc: ['Brann needs a brass ingot, a precision mechanism and two iron ingots.', '', tip('Brass comes from a mixer (copper and zinc, heated); the precision mechanism from a sequenced assembly line.')],
          tasks: [{ item: 'create:brass_ingot' }, { item: 'create:precision_mechanism' }, { item: 'minecraft:iron_ingot', count: 2 }]
        },
        {
          key: 'forged',
          title: "Sir Vyvin's Sword",
          after: ['brann'],
          hidden: true,
          tier: 1,
          auto: true,
          icon: 'minecraft:iron_sword',
          desc: ['Give Brann the makings and he forges a sword Sir Vyvin will never tell from his own.'],
          tasks: [{ stage: 'q_sword_forged', title: 'Have Brann forge the sword', icon: 'minecraft:iron_sword' }]
        },
        {
          key: 'done',
          title: '&aQuest complete!',
          subtitle: "The Knight's Sword",
          after: ['forged'],
          hidden: true,
          shape: 'gear',
          size: 1.3,
          icon: 'minecraft:iron_sword',
          tier: 3,
          auto: true,
          desc: ['Sir Vyvin will never know.', '', '&eRewards:&r 1 quest point, 8,000 Smithing XP, coins.'],
          tasks: [{ stage: 'q_sword_done', title: 'Give the sword to Squire Asrol', icon: 'minecraft:iron_sword' }],
          reward: { coins: 1500, commands: ['pmmo admin {p} add smithing xp 8000'] }
        }
      ]
    },
    {
      key: 'dragon_slayer',
      group: 'main_quests',
      title: 'Dragon Slayer I',
      subtitle: 'Main quest · Experienced · 2 quest points',
      about: "The Champions' Guild sends its proven adventurers after Elvarg, the dragon of Crandor.",
      unlocks: 'the right to wear dragonscale and dragonsteel armour, Attack and Defence XP, and a fortune.',
      icon: 'iceandfire:dragon_skull_fire',
      quests: [
        {
          key: 'start',
          title: '&6Dragon Slayer I',
          subtitle: "Started by the Champions' Guild",
          shape: 'gear',
          size: 1.6,
          invisible: true,
          icon: 'iceandfire:dragon_skull_fire',
          tier: 2,
          auto: true,
          desc: ["Guildmaster Greaves of the Champions' Guild wants proof that you're a champion: slay Elvarg, the dragon of Crandor.", '', "Needs Welcome to Lemurton, Cook's Assistant and The Knight's Sword."],
          tasks: [{ stage: 'q_ds_started', title: "Ask the Champions' Guild for a challenge", icon: 'iceandfire:dragon_skull_fire' }]
        },
        {
          key: 'oziach',
          title: 'Oziach',
          after: ['start'],
          hidden: true,
          tier: 1,
          auto: true,
          icon: 'minecraft:iron_chestplate',
          desc: ['Oziach keeps the armoury on the ring street. He came closer to killing Elvarg than anyone.'],
          tasks: [{ stage: 'q_ds_oziach', title: 'Hear about Elvarg from Oziach', icon: 'minecraft:iron_chestplate' }]
        },
        {
          key: 'shield',
          title: 'An Anti-dragon Shield',
          after: ['oziach'],
          hidden: true,
          tier: 1,
          auto: true,
          icon: 'minecraft:shield',
          desc: ["Elvarg's breath cooks people in their armour. The mayor keeps the city's old anti-dragon shield: hold it and her fire does a fifth of the harm."],
          tasks: [{ stage: 'q_ds_shield', title: 'Get the shield from the mayor', icon: 'minecraft:shield' }]
        },
        {
          key: 'piece1',
          title: 'Map Part: Lucan',
          after: ['oziach'],
          hidden: true,
          tier: 2,
          auto: true,
          icon: 'minecraft:paper',
          desc: ['Lucan the Jeweller bought a scrap of the map from a sailor. He wants 10,000 coins for it.'],
          tasks: [{ stage: 'q_ds_piece1', title: 'Buy the piece from Lucan', icon: 'minecraft:paper' }]
        },
        {
          key: 'piece2',
          title: 'Map Part: The Wizard',
          after: ['oziach'],
          hidden: true,
          tier: 2,
          auto: true,
          icon: 'minecraft:paper',
          desc: ['Wizard Traiborn, in his tower by the wall, keeps a piece in a box that only opens to a spell.', '', 'The spell needs a ghast tear, a blaze rod and an amethyst shard.'],
          tasks: [{ stage: 'q_ds_piece2', title: 'Bring Traiborn what his spell needs', icon: 'minecraft:paper' }]
        },
        {
          key: 'piece3',
          title: "Map Part: The Guild's Trial",
          after: ['oziach'],
          hidden: true,
          tier: 3,
          auto: true,
          icon: 'minecraft:paper',
          desc: ["The Champions' Guild gives its piece to those who prove their arm against the dead."],
          tasks: [{ kill: 'minecraft:zombie', count: 20 }, { kill: 'minecraft:skeleton', count: 10 }],
          reward: { items: [QUEST_ITEMS.map_piece_3] }
        },
        {
          key: 'map',
          title: 'The Map to Crandor',
          after: ['oziach'],
          hidden: true,
          tier: 2,
          auto: true,
          icon: 'minecraft:compass',
          desc: ['Bring Oziach all three pieces and he puts them together: a map whose needle points to Crandor.'],
          tasks: [{ stage: 'q_ds_map', title: 'Have Oziach make the map', icon: 'minecraft:compass' }]
        },
        {
          key: 'elvarg',
          title: '&cElvarg',
          after: ['map'],
          hidden: true,
          shape: 'gear',
          size: 1.4,
          tier: 4,
          auto: true,
          icon: 'iceandfire:dragon_skull_fire',
          desc: ['Follow the map to Crandor. Elvarg rises when you reach her isle: a fire dragon in her prime.', '', 'Everyone on this step who is nearby when she falls gets her head.', '', tip('Hold the Anti-dragon Shield when she breathes. Bring food, potions and friends.')],
          tasks: [{ stage: 'q_ds_elvarg', title: 'Slay Elvarg', icon: 'iceandfire:dragon_skull_fire' }]
        },
        {
          key: 'done',
          title: '&aQuest complete!',
          subtitle: 'Dragon Slayer I',
          after: ['elvarg'],
          hidden: true,
          shape: 'gear',
          size: 1.6,
          icon: 'iceandfire:dragon_skull_fire',
          tier: 5,
          auto: true,
          desc: ['You slew Elvarg, the dragon of Crandor.', '', '&eRewards:&r 2 quest points, the right to wear dragonscale and dragonsteel armour, 20,000 Attack and Defence XP, a fortune in coins.'],
          tasks: [{ stage: 'q_ds_done', title: "Bring Elvarg's head to Oziach", icon: 'iceandfire:dragon_skull_fire' }],
          reward: { coins: 25000, commands: ['pmmo admin {p} add attack xp 20000', 'pmmo admin {p} add defence xp 20000'] }
        }
      ]
    },

    // ================================================================= THE AGES
    {
      key: 'landfall',
      group: 'ages',
      title: 'Landfall',
      subtitle: 'Find your feet in a world that has been reworked.',
      about: "Start here. Learn the server's rules, settle a base, and gather the basics every other chapter builds on.",
      unlocks: 'your first backpack, a bed in a village, and the wrench that starts Create.',
      icon: 'minecraft:oak_sapling',
      quests: [
        {
          key: 'welcome',
          title: '&6Welcome to LemurSaucePacket',
          subtitle: 'Read me first',
          shape: 'gear',
          size: 2,
          icon: 'create:cogwheel',
          tier: 1,
          desc: [
            'This is a Create server that still feels like Minecraft.',
            '',
            '&eThe rules of the world:&r',
            '• &cPvP is on&r and there are no land claims. Pick your spot with care and keep valuables close.',
            '• Die and your items wait in a &egrave&r where you fell.',
            '• &eWaystones&r stand around the world. Activate one and you can warp back to it later. Everyday travel is by &etrain, airship, horse and happy ghast&r.',
            '• The launcher keeps everyone on the same mods. Your own extras live in its Mods tab.',
            '',
            tip('Quests never lock content. They are a road map, and every one pays XP, coins and a roll on a reward crate. The harder the quest, the better the crate.')
          ],
          tasks: [{ checkmark: true, title: 'I have read this' }],
          reward: { items: [{ item: 'minecraft:bread', count: 8 }, { item: 'minecraft:torch', count: 16 }] }
        },
        {
          key: 'field_notes',
          title: 'Field Notes',
          after: ['welcome'],
          icon: 'minecraft:book',
          tier: 1,
          desc: [
            'Three keys that answer most questions:',
            '• &eR&r on an item: how to make it (JEI). &eU&r: what it is used for.',
            '• Hold &eW&r over a Create item: a Ponder scene shows it working.',
            '• Wear &eEngineer\'s Goggles&r to read speed and stress off machines.',
            '• &eF5&r cycles to an over-the-shoulder camera, handy for exploring and fights.',
            '• &eCtrl + mouse wheel&r zooms this quest map.',
            '',
            tip('The Mods tab in the launcher lists every mod with a short description.')
          ],
          tasks: [{ checkmark: true, title: 'Got it' }]
        },
        {
          key: 'workbench',
          title: 'First Things First',
          after: ['welcome'],
          tier: 1,
          tasks: [{ item: 'minecraft:crafting_table' }]
        },
        {
          key: 'stone',
          title: 'Stone Age',
          after: ['workbench'],
          tier: 1,
          tasks: [{ advancement: 'minecraft:story/upgrade_tools', title: 'Make a stone pickaxe' }],
          icon: 'minecraft:stone_pickaxe'
        },
        {
          key: 'night',
          title: 'Survive the Night',
          after: ['workbench'],
          tier: 1,
          tasks: [{ advancement: 'minecraft:adventure/sleep_in_bed', title: 'Sleep in a bed' }],
          icon: 'minecraft:red_bed'
        },
        {
          key: 'iron',
          title: 'Iron',
          after: ['stone'],
          tier: 1,
          desc: [
            'Iron ore needs a pickaxe with &eHardness I&r: a tome made on the crafting table from andesite, copper ingots and a book, applied at an anvil, and it works from Mining 10.',
            'Before that, iron comes from zombies, chests and village golems. &eCreate drills&r mine iron and zinc ore without a tome, and Mining 10 lets your furnaces and machines take the raw ore: you can hold gated ore before that, you cannot craft with it yet.'
          ],
          tasks: [{ item: 'minecraft:iron_ingot', count: 8 }],
          reward: { items: [hardnessTome(1)] }
        },
        {
          key: 'andesite',
          title: 'The Grey Stone',
          after: ['stone'],
          tier: 1,
          desc: ['Andesite is everywhere, and Create is built on it. Gather a stack.'],
          tasks: [{ item: 'minecraft:andesite', count: 64 }]
        },
        {
          key: 'backpack',
          title: 'Pack Mule',
          after: ['iron'],
          tier: 2,
          desc: [
            'A leather backpack is your first real storage on the move. Wear it in the &eback slot&r (the Curios tab in your inventory) and open it with &eB&r.',
            '',
            tip('The Backpack Workshop chapter covers the upgrades.')
          ],
          tasks: [{ item: 'sophisticatedbackpacks:backpack' }],
          reward: { items: [{ item: 'sophisticatedbackpacks:upgrade_base', count: 2 }] }
        },
        {
          key: 'village',
          title: 'Neighbours',
          after: ['night'],
          tier: 2,
          desc: ['Find a village. Villages here come in many new shapes, and some have taverns.'],
          tasks: [{ structure: '#minecraft:village' }],
          icon: 'minecraft:bell'
        },
        {
          key: 'landfall_done',
          title: '&aLandfall',
          subtitle: 'On to the First Rotation',
          after: ['iron', 'andesite', 'backpack'],
          shape: 'gear',
          size: 1.5,
          tier: 2,
          desc: ['You have the basics. Everything from here turns on rotation.', '', '&eChapter prize:&r a starter crate of alloy and cogs, and the Settler\'s Cape.'],
          tasks: [{ item: 'create:wrench' }],
          reward: { commands: ['lsp cape flag {p} chapter:landfall'], items: [{ item: 'create:andesite_alloy', count: 32 }, { item: 'create:cogwheel', count: 8 }, { item: 'create:shaft', count: 16 }] }
        }
      ]
    },
    {
      key: 'first_rotation',
      group: 'ages',
      title: 'First Rotation',
      subtitle: 'The Andesite Age: power, presses and belts.',
      about: 'Turn water and wind into rotational power, then use it to press sheets, wash ores and move items on belts.',
      unlocks: 'automatic ore and sheet processing, moving contraptions, and infinite ore veins to mine.',
      icon: 'create:water_wheel',
      quests: [
        {
          key: 'alloy',
          title: 'Andesite Alloy',
          tier: 1,
          desc: ['Andesite plus iron nuggets (or zinc) makes the alloy almost every early machine needs.'],
          tasks: [{ item: 'create:andesite_alloy', count: 16 }]
        },
        {
          key: 'shafts',
          title: 'Shafts and Cogs',
          after: ['alloy'],
          tier: 1,
          desc: ['Shafts carry rotation in a line; cogwheels turn corners and change speed.'],
          tasks: [
            { item: 'create:shaft', count: 16 },
            { item: 'create:cogwheel', count: 8 },
            { item: 'create:large_cogwheel', count: 2 }
          ]
        },
        {
          key: 'gearshift',
          title: 'Shifting Gears',
          after: ['shafts'],
          tier: 1,
          desc: ['A large cogwheel driving a small one doubles the speed and halves the strength. Do it once and Create tells you.'],
          tasks: [{ advancement: 'create:shifting_gears', title: 'Connect a large cogwheel to a small one' }],
          icon: 'create:large_cogwheel'
        },
        {
          key: 'hand_crank',
          title: 'Elbow Grease',
          after: ['shafts'],
          tier: 1,
          desc: ['A hand crank turns anything, slowly, at the cost of your hunger. Crank until you are exhausted.'],
          tasks: [{ advancement: 'create:hand_crank_000', title: 'Use a hand crank until exhausted' }],
          icon: 'create:hand_crank'
        },
        {
          key: 'water_wheel',
          title: 'Water Power',
          after: ['shafts'],
          tier: 1,
          desc: ['A water wheel next to flowing water gives steady rotation, day and night.'],
          tasks: [{ item: 'create:water_wheel' }]
        },
        {
          key: 'windmill',
          title: 'Wind Power',
          after: ['shafts'],
          tier: 2,
          desc: ['A windmill bearing plus sails (wool, or sail blocks) glued together turns in the wind. More sails, more power.'],
          tasks: [{ item: 'create:windmill_bearing' }]
        },
        {
          key: 'press',
          title: 'Under Pressure',
          after: ['water_wheel'],
          tier: 2,
          desc: ['A mechanical press over a depot or belt flattens ingots into sheets. Sheets are the core of the Andesite Age.'],
          tasks: [{ item: 'create:mechanical_press' }]
        },
        {
          key: 'sheets',
          title: 'Sheet Metal',
          after: ['press'],
          tier: 2,
          tasks: [
            { item: 'create:iron_sheet', count: 16 },
            { item: 'create:copper_sheet', count: 16 }
          ]
        },
        {
          key: 'millstone',
          title: 'Grinding',
          after: ['windmill'],
          tier: 1,
          desc: ['A millstone grinds ores and crops. Crushed ore gives extra nuggets when you wash it.'],
          tasks: [{ item: 'create:millstone' }]
        },
        {
          key: 'saw',
          title: 'Cutting Edge',
          after: ['water_wheel'],
          tier: 2,
          desc: ['A mechanical saw cuts logs into planks on a belt, fells trees on a contraption, and is a part of the Lumber Axe.'],
          tasks: [{ item: 'create:mechanical_saw' }]
        },
        {
          key: 'fan',
          title: 'Bulk Processing',
          after: ['press'],
          tier: 2,
          desc: [
            'An encased fan blows items through whatever is in front of it:',
            '• water: &ewashing&r   • fire: &esmoking&r   • lava: &eblasting&r',
            'Point one at a belt and let the fan cook for you.'
          ],
          tasks: [{ item: 'create:encased_fan' }]
        },
        {
          key: 'belts',
          title: 'Conveyor',
          after: ['press'],
          tier: 2,
          tasks: [
            { item: 'create:belt_connector', count: 8 },
            { item: 'create:depot', count: 2 }
          ]
        },
        {
          key: 'goggles',
          title: "Engineer's Goggles",
          after: ['sheets'],
          tier: 2,
          desc: [
            'With goggles on you can read speed and stress off any machine. Every network has a stress budget; add more wheels when it runs out.',
            '',
            tip("Cyber Goggles (optional, in the launcher's Mods tab) show exact numbers.")
          ],
          tasks: [{ item: 'create:goggles' }]
        },
        {
          key: 'contraptions',
          title: 'It Moves!',
          after: ['sheets'],
          tier: 3,
          desc: [
            'Glue blocks to a mechanical bearing or piston and they move as one contraption. Drills and saws mine and cut as they go.',
            '',
            tip('Drills on a contraption mine iron and zinc ore without a Hardness tome. This is how the Andesite Age gets its metal.')
          ],
          tasks: [
            { item: 'create:mechanical_bearing' },
            { item: 'create:super_glue' },
            { item: 'create:mechanical_drill' }
          ],
          icon: 'create:mechanical_drill'
        },
        {
          key: 'zinc',
          title: 'Zinc Hunt',
          after: ['sheets'],
          tier: 2,
          desc: [
            'Zinc hides in the middle and lower layers. Press &eR&r on zinc ore in JEI to see the heights it spawns at.',
            'Zinc ore needs &eHardness I&r on your pickaxe (a crafting-table tome, Mining 10). Drill contraptions and the chests of Create ruins give raw zinc too, and Mining 10 is what lets a machine take it. You will need a lot of it for brass.'
          ],
          tasks: [{ item: 'create:raw_zinc', count: 16 }]
        },
        {
          key: 'veins',
          title: 'Prospector',
          after: ['zinc'],
          tier: 3,
          desc: [
            'Deep under the world lie ore veins that never run dry. A vein finder points at the nearest one; a drilling machine on top mines it forever.',
            '',
            tip('No diamond, emerald or netherite veins: those you still dig for.')
          ],
          tasks: [{ item: 'createoreexcavation:vein_finder' }]
        },
        {
          key: 'andesite_age',
          title: '&aThe Andesite Age',
          subtitle: 'Casing up',
          after: ['fan', 'belts', 'contraptions'],
          shape: 'gear',
          size: 1.75,
          tier: 3,
          desc: ['Andesite casing is the mark of a finished early factory.', '', '&eChapter prize:&r a magnet upgrade for your backpack and a chest of alloy.'],
          tasks: [{ item: 'create:andesite_casing', count: 32 }],
          reward: { items: [{ item: 'sophisticatedbackpacks:magnet_upgrade' }, { item: 'create:andesite_alloy', count: 64 }, { item: 'create:mechanical_drill', count: 2 }] }
        }
      ]
    },
    {
      key: 'brass_age',
      group: 'ages',
      title: 'Brass Age',
      subtitle: 'Heat, mixing and precision.',
      about: "Capture a blaze to heat your basins. Brass and precision mechanisms are the gateway to Create's smarter machines.",
      unlocks: 'mechanical arms and crafters, sorting with brass tunnels, steam engines and electricity.',
      icon: 'create:brass_ingot',
      quests: [
        {
          key: 'nether',
          title: 'Through the Portal',
          tier: 1,
          desc: ['Brass needs heat, and heat means blazes. Build a portal.', '', tip('Obsidian as an item needs Hardness III. Cast the frame in place with lava and water, or use a ruined portal.')],
          tasks: [{ dimension: 'minecraft:the_nether' }],
          icon: 'minecraft:obsidian'
        },
        {
          key: 'blaze_burner',
          title: 'Captive Flame',
          after: ['nether'],
          tier: 2,
          desc: ['Right-click a blaze with an empty blaze burner to capture it. Feed it fuel to heat whatever sits on top.'],
          tasks: [{ item: 'create:blaze_burner' }]
        },
        {
          key: 'mixer',
          title: 'Mix It Up',
          after: ['nether'],
          tier: 2,
          desc: ['A mechanical mixer above a basin combines ingredients, heated or not.'],
          tasks: [
            { item: 'create:basin' },
            { item: 'create:mechanical_mixer' }
          ],
          icon: 'create:mechanical_mixer'
        },
        {
          key: 'brass',
          title: 'Brass',
          after: ['blaze_burner', 'mixer'],
          tier: 2,
          desc: ['Copper and zinc in a heated basin give brass.'],
          tasks: [{ item: 'create:brass_ingot', count: 16 }]
        },
        {
          key: 'rose_quartz',
          title: 'Rose Quartz',
          after: ['mixer'],
          tier: 2,
          desc: ['Redstone mixed into quartz, then polished on a belt with sandpaper or a deployer.'],
          tasks: [{ item: 'create:polished_rose_quartz', count: 8 }]
        },
        {
          key: 'tubes',
          title: 'Electron Tubes',
          after: ['rose_quartz'],
          tier: 2,
          tasks: [{ item: 'create:electron_tube', count: 8 }]
        },
        {
          key: 'brass_casing',
          title: 'Brass Casing',
          after: ['brass'],
          tier: 3,
          tasks: [{ item: 'create:brass_casing', count: 16 }]
        },
        {
          key: 'deployer',
          title: 'A Helping Hand',
          after: ['brass_casing', 'tubes'],
          tier: 2,
          desc: ['Deployers use items the way a player would: placing, using, applying.'],
          tasks: [{ item: 'create:deployer' }]
        },
        {
          key: 'precision',
          title: 'Precision Mechanism',
          after: ['deployer'],
          tier: 3,
          desc: [
            'Made by sequenced assembly: a golden sheet goes round a loop of deployers and a press, several times.',
            tip('JEI shows every step. Long recipes have pages: scroll to flip.')
          ],
          tasks: [{ item: 'create:precision_mechanism', count: 4 }]
        },
        {
          key: 'sturdy',
          title: 'The Sturdiest Rocks',
          after: ['precision'],
          tier: 3,
          desc: ['Powdered obsidian, washed into sturdy sheets. Trains, waystones and the best gear all start here.', '', tip('Obsidian is a Mining 30 material: Hardness III to mine it, and Mining 30 before any machine takes it, chest obsidian included.')],
          tasks: [{ item: 'create:sturdy_sheet', count: 4 }]
        },
        {
          key: 'arm',
          title: 'Mechanical Arm',
          after: ['precision'],
          tier: 3,
          desc: ['Arms pick items up and put them down wherever you point them, even into machines.'],
          tasks: [{ item: 'create:mechanical_arm' }]
        },
        {
          key: 'crafters',
          title: 'Mechanical Crafting',
          after: ['brass_casing'],
          tier: 3,
          desc: ['Link a grid of mechanical crafters for recipes too big for a crafting table: gear, waystones and Hardness tomes.'],
          tasks: [{ item: 'create:mechanical_crafter', count: 9 }]
        },
        {
          key: 'sorting',
          title: 'Smart Logistics',
          after: ['brass_casing'],
          tier: 3,
          tasks: [
            { item: 'create:smart_chute' },
            { item: 'create:brass_tunnel', count: 2 },
            { item: 'create:brass_funnel', count: 2 }
          ],
          icon: 'create:brass_tunnel'
        },
        {
          key: 'steam',
          title: 'Full Steam',
          after: ['brass_casing'],
          tier: 3,
          desc: ['Fluid tanks over heated blaze burners, fed with water, drive steam engines: the strongest early power.'],
          tasks: [
            { item: 'create:steam_engine' },
            { item: 'create:fluid_tank', count: 4 }
          ],
          icon: 'create:steam_engine'
        },
        {
          key: 'electricity',
          title: 'Sparks',
          after: ['brass'],
          tier: 3,
          desc: ['Crafts & Additions turns rotation into electricity and back. Handy for long distances and for charging tools.'],
          tasks: [
            { item: 'createaddition:alternator' },
            { item: 'createaddition:electric_motor' }
          ],
          icon: 'createaddition:electric_motor'
        },
        {
          key: 'brass_age_done',
          title: '&aThe Brass Age',
          subtitle: 'Controlled speed',
          after: ['arm', 'crafters', 'steam'],
          shape: 'gear',
          size: 1.75,
          tier: 4,
          desc: ['A rotation speed controller lets one network run machines at exactly the speed you choose.', '', '&eChapter prize:&r precision mechanisms, brass casing and the Brass Age Cape.'],
          tasks: [{ item: 'create:rotation_speed_controller' }],
          reward: { commands: ['lsp cape flag {p} chapter:brass_age'], items: [{ item: 'create:precision_mechanism', count: 4 }, { item: 'create:brass_casing', count: 8 }, { item: 'create:mechanical_arm' }] }
        }
      ]
    },
    {
      key: 'banners',
      group: 'ages',
      title: 'Banners of the Overworld',
      subtitle: 'Outposts, forts and ruined factories. Salvage what you can.',
      about: 'Pillagers hold the high ground and old Create ruins dot the world. Fight, explore and bring the loot home.',
      unlocks: 'raid and fort loot, salvaged Create parts, and cheaper trades as Hero of the Village.',
      icon: OMINOUS_BANNER,
      quests: [
        {
          key: 'outpost',
          title: 'Outpost',
          tier: 2,
          desc: ['Pillagers hold the high ground, and their outposts now come in a style for every biome.'],
          tasks: [{ structure: '#minecraft:pillager_outpost' }],
          icon: 'minecraft:crossbow'
        },
        {
          key: 'raiders',
          title: 'Hold the Line',
          after: ['outpost'],
          tier: 2,
          tasks: [
            { kill: 'minecraft:pillager', count: 10 },
            { kill: 'minecraft:vindicator', count: 5 }
          ],
          icon: 'minecraft:iron_axe'
        },
        {
          key: 'hero',
          title: 'Hero of the Village',
          after: ['raiders'],
          tier: 4,
          desc: ['Defeat a raid. Villages remember who stood with them, and the Hero cape is yours.'],
          tasks: [{ advancement: 'minecraft:adventure/hero_of_the_village' }],
          icon: 'minecraft:emerald',
          reward: { items: [{ item: 'minecraft:emerald', count: 16 }] }
        },
        {
          key: 'illager_fort',
          title: 'The Illager Fort',
          after: ['outpost'],
          tier: 3,
          desc: ['Illager Invasion adds fortified camps with new illagers: basher, provoker, invoker. Bring friends.'],
          tasks: [{ structure: 'illagerinvasion:illager_fort' }],
          icon: 'minecraft:stone_bricks'
        },
        {
          key: 'invoker',
          title: 'The Invoker',
          after: ['illager_fort'],
          tier: 4,
          tasks: [{ kill: 'illagerinvasion:invoker' }],
          icon: 'minecraft:totem_of_undying'
        },
        {
          key: 'rustic_windmill',
          title: 'Rustic Windmill',
          tier: 1,
          desc: ['An old working windmill. See how it was built, then build your own.'],
          tasks: [{ structure: 'create_rustic_structures:rustic_windmill' }],
          icon: 'create:windmill_bearing'
        },
        {
          key: 'quarry',
          title: 'Abandoned Quarry',
          after: ['rustic_windmill'],
          tier: 2,
          tasks: [{ structure: 'create_ltab:quarry' }],
          icon: 'create:mechanical_drill'
        },
        {
          key: 'lost_station',
          title: 'The Lost Station',
          after: ['quarry'],
          tier: 3,
          desc: ['Somewhere a train station was abandoned mid-schedule. Salvage its parts.'],
          tasks: [{ structure: 'create_structures_arise:createlosttrainstation' }],
          icon: 'create:track_station'
        },
        {
          key: 'sky_pirates',
          title: 'Sky Pirates',
          after: ['lost_station'],
          tier: 3,
          desc: ['Pillagers have learned to fly. Find one of their steam-powered airships.'],
          tasks: [{ structure: 'create_structures_arise:pillagersteampunkairship' }],
          icon: 'create:propeller'
        },
        {
          key: 'kings_castle',
          title: "The King's Castle",
          after: ['sky_pirates'],
          tier: 4,
          desc: ['A castle full of Create machinery. Explore it carefully.'],
          tasks: [{ structure: 'create_ltab:kings_castle' }],
          icon: 'minecraft:golden_helmet'
        },
        {
          key: 'banners_done',
          title: '&aBanners of the Overworld',
          after: ['hero', 'invoker', 'kings_castle'],
          shape: 'gear',
          size: 1.5,
          tier: 4,
          desc: ['Raise your own banner over what you have taken back.', '', '&eChapter prize:&r a totem, a relic from the cache and a roll on the Legend\'s Hoard.'],
          tasks: [{ item: 'minecraft:white_banner' }],
          reward: { items: [{ item: 'minecraft:totem_of_undying' }], tables: ['relic_cache', 'legends_hoard'] }
        }
      ]
    },
    {
      key: 'iron_roads',
      group: 'ages',
      title: 'Iron Roads',
      subtitle: 'Trains, stations, freight and waystones.',
      about: 'Lay track between bases, run trains on schedules, and let parcels and stock links move your goods. Waystones take one traveller home in a blink.',
      unlocks: 'fast travel between towns, automated freight, ordering items from anywhere on your network, and a waystone of your own.',
      icon: 'create:track',
      quests: [
        {
          key: 'waystone_found',
          title: 'Standing Stones',
          tier: 1,
          desc: [
            'Waystones stand in villages, on top of lone towers, at shrines, and now and then out in the wild.',
            'Right-click one to activate it. It joins your list and shows on your map.',
            '',
            tip('Found waystones can be taken: mine one with a pickaxe. Silk Touch keeps its name.')
          ],
          tasks: [{ observe: '#waystones:waystones', title: 'Find a waystone' }],
          icon: 'waystones:waystone'
        },
        {
          key: 'warp_dust',
          title: 'Warp Dust',
          after: ['waystone_found'],
          tier: 2,
          desc: [
            'Ender pearls and amethyst, mixed over a blaze burner. Every warp item starts here.',
            tip('Warp scrolls (dust, brass nuggets, ink and paper) jump you to any activated waystone, free of XP.')
          ],
          tasks: [{ item: 'waystones:warp_dust', count: 8 }]
        },
        {
          key: 'warp_stone',
          title: 'Warp Stone',
          after: ['warp_dust'],
          tier: 3,
          desc: [
            'Mechanical crafters set a precision mechanism in amethyst and warp dust.',
            'Hold right-click to warp to any waystone you have activated. Each jump costs a few XP points: 1 per 100 blocks, 27 at most.'
          ],
          tasks: [{ item: 'waystones:warp_stone' }]
        },
        {
          key: 'own_waystone',
          title: 'A Waystone of Your Own',
          after: ['waystone_found'],
          tier: 4,
          desc: [
            'Take one you found, or build one on mechanical crafters: a warp stone, a precision mechanism, a brass casing, two sturdy sheets and an eye of ender.',
            'Put it at home and you can always find your way back.',
            '',
            tip('No claims here: anyone can mine a waystone. Keep yours where you can watch it.')
          ],
          tasks: [{ checkmark: true, title: 'A waystone stands at my base' }],
          icon: 'waystones:mossy_waystone',
          reward: { items: [{ item: 'waystones:warp_scroll', count: 4 }] }
        },
        {
          key: 'track',
          title: 'Lay Track',
          tier: 2,
          desc: ['Train track is laid by clicking two points; it curves and climbs on its own.'],
          tasks: [{ item: 'create:track', count: 64 }]
        },
        {
          key: 'station',
          title: 'Station',
          after: ['track'],
          tier: 2,
          tasks: [{ item: 'create:track_station' }]
        },
        {
          key: 'train',
          title: 'Your First Train',
          after: ['station'],
          tier: 3,
          desc: [
            'Place bogeys on the track at a station, build a carriage from railway casing, add train controls and assemble it at the station.',
            tip('Hold W over the station item for the Ponder walkthrough.')
          ],
          tasks: [
            { item: 'create:railway_casing', count: 16 },
            { item: 'create:controls' }
          ],
          icon: 'create:controls'
        },
        {
          key: 'schedule',
          title: 'On Schedule',
          after: ['train'],
          tier: 2,
          desc: ['A schedule tells a train where to go and when. Give it to a conductor: any seated mob, or a blaze burner.'],
          tasks: [{ item: 'create:schedule' }]
        },
        {
          key: 'signals',
          title: 'Signals',
          after: ['train'],
          tier: 2,
          desc: ['Signals split track into blocks so several trains share a line without crashing.'],
          tasks: [{ item: 'create:track_signal', count: 4 }]
        },
        {
          key: 'navigator',
          title: 'Timetables',
          after: ['schedule'],
          tier: 3,
          desc: ['Railways Navigator adds a route planner and station clocks, like a real rail network.'],
          tasks: [
            { item: 'createrailwaysnavigator:navigator' },
            { item: 'createrailwaysnavigator:train_station_clock' }
          ],
          icon: 'createrailwaysnavigator:navigator'
        },
        {
          key: 'boards',
          title: 'Departure Board',
          after: ['schedule'],
          tier: 2,
          tasks: [
            { item: 'create:display_board', count: 4 },
            { item: 'create:display_link' }
          ],
          icon: 'create:display_board'
        },
        {
          key: 'packager',
          title: 'Parcels',
          after: ['station'],
          tier: 3,
          desc: ['Create packs items into parcels with a packager. Parcels can be addressed and sent anywhere a frogport or train reaches.'],
          tasks: [
            { item: 'create:packager' },
            { item: 'create:package_frogport' }
          ],
          icon: 'create:packager'
        },
        {
          key: 'stock',
          title: 'Stock Keeping',
          after: ['packager'],
          tier: 3,
          desc: ['Stock links network your storage; a stock keeper lets you order from all of it at once.'],
          tasks: [
            { item: 'create:stock_link' },
            { item: 'create:stock_ticker' }
          ],
          icon: 'create:stock_ticker'
        },
        {
          key: 'factory_gauge',
          title: 'Factory Gauges',
          after: ['stock'],
          tier: 4,
          desc: ['Factory gauges keep a factory topped up: set a target and it requests ingredients by itself.'],
          tasks: [
            { item: 'create:factory_gauge', count: 2 },
            { item: 'create:redstone_requester' }
          ],
          icon: 'create:factory_gauge'
        },
        {
          key: 'connect',
          title: 'Connect Two Towns',
          after: ['signals', 'navigator'],
          shape: 'gear',
          size: 1.5,
          tier: 4,
          desc: [
            "Run a line from your base to another player's, with a station at each end.",
            '',
            '&cNote:&r trains can cross Nether portals, but riding through one is still buggy. Send freight across unmanned.',
            '',
            '&eChapter prize:&r railway casing for the next carriage, a warp stone and the Iron Roads Cape.'
          ],
          tasks: [{ checkmark: true, title: 'Our towns are connected' }],
          icon: 'create:track_station',
          reward: { commands: ['lsp cape flag {p} chapter:iron_roads'], items: [{ item: 'create:railway_casing', count: 16 }, { item: 'waystones:warp_stone' }] }
        }
      ]
    },
    {
      key: 'skyward',
      group: 'ages',
      title: 'Skyward',
      subtitle: 'Create Aeronautics: balloons, propellers and airships.',
      about: 'Build ships that fly. Lift, thrust and steering all come from real Create machinery, and a physics assembler turns the build into a ship.',
      unlocks: 'flying bases, travel over any terrain, and docking, naming and navigating your own fleet.',
      icon: 'aeronautics:propeller_bearing',
      quests: [
        {
          key: 'propeller',
          title: 'Propeller',
          tier: 2,
          desc: ['A propeller bearing with blades attached pushes air. Mount one on anything you want to move.'],
          tasks: [
            { item: 'aeronautics:propeller_bearing' },
            { item: 'aeronautics:wooden_propeller' }
          ],
          icon: 'aeronautics:wooden_propeller'
        },
        {
          key: 'thrust',
          title: 'In Thrust We Trust',
          after: ['propeller'],
          tier: 2,
          desc: ['Assemble a propeller bearing and let it push. Create Aeronautics counts the thrust.'],
          tasks: [{ advancement: 'aeronautics:in_thrust_we_trust', title: 'Assemble a propeller bearing' }],
          icon: 'aeronautics:andesite_propeller'
        },
        {
          key: 'assembler',
          title: 'Applied Kinematics',
          after: ['propeller'],
          tier: 2,
          desc: ['The physics assembler is the heart of every ship: glue the hull together, place the assembler on it and the whole build becomes one moving body.'],
          tasks: [{ advancement: 'simulated:applied_kinematics', title: 'Obtain a physics assembler' }],
          icon: 'simulated:physics_assembler'
        },
        {
          key: 'handle',
          title: 'Get a Grip',
          after: ['assembler'],
          tier: 1,
          desc: ['A handle on the hull lets you hold on while the ship moves. Sneak-grab moves the ship instead of you.'],
          tasks: [{ advancement: 'simulated:get_a_grip', title: 'Grab a handle' }],
          icon: 'simulated:iron_handle'
        },
        {
          key: 'nameplate',
          title: 'I Declare Thee...',
          after: ['assembler'],
          tier: 2,
          desc: ['Every ship deserves a name. A nameplate on the hull sets it.'],
          tasks: [{ advancement: 'simulated:i_declare_thee', title: 'Name a ship with a nameplate' }],
          icon: 'simulated:white_nameplate',
          reward: { items: [{ item: 'simulated:white_nameplate', count: 2 }] }
        },
        {
          key: 'envelope',
          title: 'Lift',
          after: ['propeller'],
          tier: 3,
          desc: ['Envelopes filled with hot air lift a ship; an adjustable burner controls how much.'],
          tasks: [
            { item: 'aeronautics:white_envelope', count: 16 },
            { item: 'aeronautics:adjustable_burner' }
          ],
          icon: 'aeronautics:white_envelope'
        },
        {
          key: 'hot_air',
          title: 'Head in the Clouds',
          after: ['envelope'],
          tier: 3,
          desc: ['Seal an envelope structure airtight and fill it with hot air from a burner.'],
          tasks: [{ advancement: 'aeronautics:head_in_the_clouds', title: 'Fill an airtight envelope with hot air' }],
          icon: 'aeronautics:adjustable_burner'
        },
        {
          key: 'levitite',
          title: 'Levitite',
          after: ['envelope'],
          tier: 3,
          desc: ['Levitite floats on its own. Ships built with it need less balloon.'],
          tasks: [{ item: 'aeronautics:levitite', count: 4 }]
        },
        {
          key: 'pearlescent',
          title: 'Now Available in Pink',
          after: ['levitite'],
          tier: 3,
          desc: ['Crystallise levitite blend the other way and it comes out pearlescent.'],
          tasks: [{ advancement: 'aeronautics:now_available_in_pink', title: 'Crystallise pearlescent levitite' }],
          icon: 'aeronautics:pearlescent_levitite'
        },
        {
          key: 'goggles',
          title: 'Aviator',
          after: ['propeller'],
          tier: 2,
          tasks: [{ item: 'aeronautics:aviators_goggles' }]
        },
        {
          key: 'helm',
          title: 'Take the Helm',
          after: ['assembler'],
          tier: 3,
          desc: ['A steering wheel and a throttle lever on the deck put the ship in your hands.'],
          tasks: [
            { item: 'simulated:steering_wheel' },
            { item: 'simulated:throttle_lever' }
          ],
          icon: 'simulated:steering_wheel'
        },
        {
          key: 'engine',
          title: 'Steamless Engine',
          after: ['helm'],
          tier: 3,
          desc: ['A portable engine burns fuel for rotation on board, no boiler needed.'],
          tasks: [{ advancement: 'simulated:steamless_engine', title: 'Place and power a portable engine' }],
          icon: 'simulated:red_portable_engine'
        },
        {
          key: 'smart',
          title: 'Steering',
          after: ['envelope'],
          tier: 3,
          desc: ['Smart and gyroscopic propellers give you finer control over thrust and direction.'],
          tasks: [
            { item: 'aeronautics:smart_propeller' },
            { item: 'aeronautics:gyroscopic_propeller_bearing' }
          ],
          icon: 'aeronautics:smart_propeller'
        },
        {
          key: 'instruments',
          title: 'Instruments',
          after: ['helm'],
          tier: 3,
          desc: ['An altitude sensor reads your height; a navigation table points the way to a target.'],
          tasks: [
            { item: 'simulated:altitude_sensor' },
            { item: 'simulated:navigation_table' }
          ],
          icon: 'simulated:navigation_table'
        },
        {
          key: 'docking',
          title: 'A Calculated Connection',
          after: ['helm'],
          tier: 4,
          desc: ['Two docking connectors, lined up and locked: a ship moored to a tower, or two ships made one.'],
          tasks: [{ advancement: 'simulated:a_calculated_connection', title: 'Connect two docking connectors' }],
          icon: 'simulated:docking_connector'
        },
        {
          key: 'far_from_home',
          title: 'Far From Home',
          after: ['instruments'],
          tier: 4,
          desc: ['Set a navigation table to a target more than 5000 blocks away, and go.'],
          tasks: [{ advancement: 'simulated:far_from_home', title: 'Navigate to a target 5000 blocks away' }],
          icon: 'minecraft:compass'
        },
        {
          key: 'ghostbuster',
          title: 'Ghostbuster',
          after: ['goggles'],
          tier: 4,
          desc: ['A mounted potato cannon on deck, a phantom in the night sky. You know what to do.'],
          tasks: [{ advancement: 'aeronautics:ghostbuster', title: 'Kill a phantom with a mounted potato cannon' }],
          icon: 'aeronautics:mounted_potato_cannon'
        },
        {
          key: 'maiden_voyage',
          title: '&aMaiden Voyage',
          after: ['smart', 'levitite', 'engine'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Fly a ship you built from one of your bases to another without touching the ground.', '', "&eChapter prize:&r the Aeronaut's Jacket, a warp stone, the Skyward Cape and a roll on the Legend's Hoard."],
          tasks: [{ checkmark: true, title: 'I flew it' }],
          icon: 'aeronautics:propeller_bearing',
          reward: { commands: ['lsp cape flag {p} chapter:skyward'], items: [{ item: 'lemursaucepacket:aeronaut_chestplate' }, { item: 'waystones:warp_stone' }] }
        }
      ]
    },
    {
      key: 'crown_of_fire',
      group: 'ages',
      title: 'Crown of Fire',
      subtitle: 'The Nether, properly.',
      about: "Brave fortresses and bastions for blaze rods, netherite and the Wither's star.",
      unlocks: 'superheated blaze burners for the hardest recipes, netherite gear, and a beacon.',
      icon: 'minecraft:blaze_powder',
      quests: [
        {
          key: 'fortress',
          title: 'Fortress',
          tier: 2,
          desc: ['Nether fortresses are bigger and meaner now. Blazes live here.'],
          tasks: [{ structure: '#lemursaucepacket:fortresses' }],
          icon: 'minecraft:nether_bricks'
        },
        {
          key: 'blaze_rods',
          title: 'Blaze Rods',
          after: ['fortress'],
          tier: 2,
          tasks: [{ item: 'minecraft:blaze_rod', count: 12 }]
        },
        {
          key: 'wither_skeletons',
          title: 'Bone Collector',
          after: ['fortress'],
          tier: 3,
          tasks: [{ kill: 'minecraft:wither_skeleton', count: 10 }],
          icon: 'minecraft:wither_skeleton_skull'
        },
        {
          key: 'citadel',
          title: 'A Fortress? No, a Citadel',
          after: ['fortress'],
          tier: 3,
          desc: ['Friends & Foes builds citadels in the Nether. The wildfire, a blaze queen, rules one.'],
          tasks: [{ advancement: 'friendsandfoes:nether/find_citadel', title: 'Enter a Nether citadel' }],
          icon: 'friendsandfoes:wildfire_crown_fragment'
        },
        {
          key: 'anchor',
          title: 'Respawn Anchor',
          after: ['fortress'],
          tier: 2,
          desc: ['Crying obsidian and glowstone: a bed for the Nether. Charge it before you need it.'],
          tasks: [{ advancement: 'minecraft:nether/charge_respawn_anchor', title: 'Charge a respawn anchor' }],
          icon: 'minecraft:respawn_anchor'
        },
        {
          key: 'piglins',
          title: 'The Piglin Castes',
          tier: 2,
          desc: ['Piglins now have castes: travellers wander the wastes, alchemists brew. Bartering with them is worth your gold.'],
          tasks: [{ kill: 'piglinproliferation:piglin_alchemist' }],
          icon: 'minecraft:gold_ingot'
        },
        {
          key: 'travelers_compass',
          title: 'Journey of a Thousand Blocks',
          after: ['piglins'],
          tier: 3,
          desc: ["Barter with a piglin traveler for a traveler's compass. It points at what you ask it for."],
          tasks: [{ advancement: 'piglinproliferation:nether/obtain_travelers_compass', title: "Obtain a traveler's compass" }],
          icon: 'piglinproliferation:travelers_compass'
        },
        {
          key: 'bastion',
          title: 'Bastion',
          after: ['piglins'],
          tier: 3,
          desc: ['Piglin bastions hold gold and ancient debris. Some have been taken over by Create machinery.'],
          tasks: [{ structure: '#lemursaucepacket:bastions' }],
          icon: 'minecraft:gilded_blackstone'
        },
        {
          key: 'superheated',
          title: 'Superheated',
          after: ['blaze_rods'],
          tier: 3,
          desc: ['Feed a blaze burner a blaze cake and it burns hot enough for the toughest recipes.'],
          tasks: [{ item: 'create:blaze_cake', count: 4 }]
        },
        {
          key: 'netherite',
          title: 'Netherite',
          after: ['bastion'],
          tier: 4,
          desc: ['Ancient debris needs &eHardness IV&r on your pickaxe and Mining 40, to mine and to smelt. Bastion chests carry netherite scrap, which has no gate.'],
          tasks: [{ item: 'minecraft:netherite_ingot' }],
          reward: { items: [{ item: 'minecraft:netherite_upgrade_smithing_template' }] }
        },
        {
          key: 'wither',
          title: '&cThe Wither',
          after: ['wither_skeletons', 'superheated'],
          shape: 'gear',
          size: 1.5,
          tier: 5,
          desc: ['Three skulls on soul sand. Bring friends and a plan.', '', "&eChapter prize:&r two netherite ingots, the Crown of Fire Cape and a roll on the Legend's Hoard."],
          tasks: [{ kill: 'minecraft:wither' }],
          icon: 'minecraft:nether_star',
          reward: { commands: ['lsp cape flag {p} chapter:crown_of_fire'], items: [{ item: 'minecraft:netherite_ingot', count: 2 }] }
        }
      ]
    },
    {
      key: 'legacy',
      group: 'ages',
      title: 'Legacy',
      subtitle: 'The End, and what you leave behind.',
      about: 'Face the dragon, earn your wings, and turn enchanting into an assembly line.',
      unlocks: 'elytra flight, automated enchanting, banking, and a build the whole server will remember.',
      icon: 'minecraft:dragon_egg',
      quests: [
        {
          key: 'stronghold',
          title: 'The Stronghold',
          tier: 3,
          tasks: [{ structure: 'betterstrongholds:stronghold' }],
          icon: 'minecraft:ender_eye',
          reward: { commands: ['lsp cape flag {p} chapter:legacy'] }
        },
        {
          key: 'the_end',
          title: 'The End',
          after: ['stronghold'],
          tier: 3,
          tasks: [{ dimension: 'minecraft:the_end' }],
          icon: 'minecraft:end_stone'
        },
        {
          key: 'dragon',
          title: '&5The Dragon',
          after: ['the_end'],
          tier: 5,
          desc: ['The Dragonslayer Cape is yours when it falls.'],
          tasks: [{ kill: 'minecraft:ender_dragon' }],
          icon: 'minecraft:dragon_head',
          reward: { tables: ['relic_cache'] }
        },
        {
          key: 'elytra',
          title: 'Wings',
          after: ['dragon'],
          tier: 4,
          desc: ['End ships carry them. Agility 30 lets you wear one.'],
          tasks: [{ item: 'minecraft:elytra' }]
        },
        {
          key: 'crushing',
          title: 'Crushing Wheels',
          tier: 3,
          desc: ['A pair of crushing wheels doubles ore output and eats almost anything.'],
          tasks: [{ item: 'create:crushing_wheel', count: 2 }]
        },
        {
          key: 'enchanting',
          title: 'Enchantment Industry',
          after: ['crushing'],
          tier: 3,
          desc: ['Liquid experience, blaze enchanters and printers turn enchanting into a production line. The Arcane Works chapter goes deeper.'],
          tasks: [
            { item: 'create_enchantment_industry:blaze_enchanter' },
            { item: 'create_enchantment_industry:printer' },
            { item: 'create_enchantment_industry:experience_bucket' }
          ],
          icon: 'create_enchantment_industry:blaze_enchanter'
        },
        {
          key: 'bank',
          title: 'Millionaire',
          after: ['enchanting'],
          tier: 5,
          desc: ['Hold a million Gold Coins at once. Vendors buy anything you make, so a factory that sells its output fills a purse fast.'],
          tasks: [{ stage: 'econ_purse_1m', title: 'Hold 1,000,000 coins', icon: coinsIcon(10000) }],
          icon: coinsIcon(10000)
        },
        {
          key: 'legacy',
          title: '&6Legacy',
          after: ['elytra', 'bank'],
          shape: 'gear',
          size: 2,
          tier: 5,
          desc: ['Build something the whole server will still be using long after you log off: a station, a market, a monument. Then tick this.', '', "&eChapter prize:&r 40,000 coins, a relic and two rolls on the Legend's Hoard."],
          tasks: [{ checkmark: true, title: 'I built my legacy' }],
          icon: 'minecraft:beacon',
          reward: { coins: 40000, tables: ['relic_cache', 'legends_hoard'] }
        }
      ]
    },

    // ================================================================= INDUSTRY
    {
      key: 'factory_floor',
      group: 'industry',
      title: 'Factory Floor',
      subtitle: 'Automate everything: farms, processing, assembly and stock.',
      about: 'A factory takes raw materials in one end and puts finished goods in a vault at the other. Build one line at a time and let Create keep score.',
      unlocks: 'hands-free farms, ore processing, sequenced assembly and a stock system that orders its own ingredients.',
      icon: 'create:mechanical_crafter',
      quests: [
        {
          key: 'blueprint',
          title: 'Plan the Floor',
          tier: 1,
          desc: [
            'Every factory is the same shape: an &einput&r (farm, drill, vein), &emachines&r on belts, and &estorage&r at the end.',
            'Sketch yours before you build. Create pays for each stage below.'
          ],
          tasks: [{ checkmark: true, title: 'I have a plan' }],
          icon: 'create:schematic_and_quill'
        },
        {
          key: 'fan_processing',
          title: 'Processing by Particle',
          after: ['blueprint'],
          tier: 2,
          desc: ['Blow items through water, fire or lava with an encased fan. Washing crushed ore is the classic first line.'],
          tasks: [{ advancement: 'create:fan_processing', title: 'Process materials with an encased fan' }],
          icon: 'create:encased_fan'
        },
        {
          key: 'harvesters',
          title: 'Harvest Season',
          after: ['blueprint'],
          tier: 2,
          desc: ['Harvesters and ploughs on a moving contraption reap a whole field in one pass.'],
          tasks: [
            { item: 'create:mechanical_harvester', count: 2 },
            { item: 'create:mechanical_plough' }
          ],
          icon: 'create:mechanical_harvester'
        },
        {
          key: 'actors',
          title: 'Moving with Purpose',
          after: ['harvesters'],
          tier: 2,
          desc: ['Put drills, saws or harvesters on a contraption and run it: a tree farm, a quarry or a crop field that works itself.'],
          tasks: [{ advancement: 'create:contraption_actors', title: 'Run a contraption with drills, saws or harvesters' }],
          icon: 'create:mechanical_saw'
        },
        {
          key: 'compacting',
          title: 'Compactification',
          after: ['fan_processing'],
          tier: 2,
          desc: ['A press over a basin turns many items into fewer: nuggets into ingots, ingots into blocks, diamonds into compacted diamond.'],
          tasks: [{ advancement: 'create:compacting', title: 'Compact items in a basin' }],
          icon: 'create:basin'
        },
        {
          key: 'assembly',
          title: 'Automated Assembly',
          after: ['compacting'],
          tier: 3,
          desc: ['Mechanical crafters, fed by arms or funnels, craft without you.'],
          tasks: [{ advancement: 'create:mechanical_crafter', title: 'Craft with mechanical crafters' }],
          icon: 'create:mechanical_crafter'
        },
        {
          key: 'sequenced',
          title: 'Complex Curiosities',
          after: ['assembly'],
          tier: 3,
          desc: ['Sequenced assembly: a belt loop of deployers and a press that builds precision mechanisms on their own.'],
          tasks: [{ advancement: 'create:precision_mechanism', title: 'Assemble a precision mechanism' }],
          icon: 'create:precision_mechanism'
        },
        {
          key: 'arm_targets',
          title: 'Organize-o-Tron',
          after: ['assembly'],
          tier: 4,
          desc: ['Program one mechanical arm with ten or more outputs. One arm, a whole sorting wall.'],
          tasks: [{ advancement: 'create:arm_many_targets', title: 'Give an arm 10 or more outputs' }],
          icon: 'create:mechanical_arm'
        },
        {
          key: 'psi',
          title: 'Drive-by Exchange',
          after: ['actors'],
          tier: 3,
          desc: ['A portable storage interface unloads a passing contraption. Your quarry empties itself every lap.'],
          tasks: [{ advancement: 'create:portable_storage_interface', title: 'Move items through a portable storage interface' }],
          icon: 'create:portable_storage_interface'
        },
        {
          key: 'vault',
          title: 'Bulk Storage',
          after: ['psi'],
          tier: 3,
          desc: ['Item vaults join into one big inventory. Eight is a small warehouse.'],
          tasks: [{ item: 'create:item_vault', count: 8 }]
        },
        {
          key: 'stress',
          title: 'Perfectly Stressed',
          after: ['sequenced'],
          tier: 3,
          desc: ['Get a stressometer to read exactly 100%. Every last bit of power used, nothing wasted.'],
          tasks: [{ advancement: 'create:stressometer_maxed', title: 'Read 100% on a stressometer' }],
          icon: 'create:stressometer'
        },
        {
          key: 'full_steam',
          title: 'Full Steam',
          after: ['stress'],
          tier: 4,
          desc: ['A level 8 boiler: 18 tanks, 9 heaters, and water enough to feed it. Run it at maximum.'],
          tasks: [{ advancement: 'create:steam_engine_maxed', title: 'Run a boiler at maximum power' }],
          icon: 'create:steam_engine'
        },
        {
          key: 'factory_done',
          title: '&aHigh Logistics',
          after: ['full_steam', 'arm_targets', 'vault'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Factory gauges request their own ingredients: set a target stock and watch packages arrive. That is a factory.', '', "&eChapter prize:&r two mechanical arms, eight precision mechanisms and a roll on the Legend's Hoard."],
          tasks: [{ advancement: 'create:factory_gauge', title: 'Trigger an automatic package request' }],
          icon: 'create:factory_gauge',
          reward: { items: [{ item: 'create:mechanical_arm', count: 2 }, { item: 'create:precision_mechanism', count: 8 }] }
        }
      ]
    },
    {
      key: 'railway',
      group: 'industry',
      title: 'Railway Company',
      subtitle: 'Long trains, long journeys and a network that runs itself.',
      about: 'Iron Roads got you a line. This chapter makes it a railway: signals, timetables, whistles, a track factory and a train six carriages long.',
      unlocks: 'freight and passenger lines across the whole map, and the Grand Central prize.',
      icon: 'create:train_door',
      quests: [
        {
          key: 'locomotive_age',
          title: 'The Locomotive Age',
          tier: 2,
          desc: ['Sturdy sheets make railway casing, the frame of every carriage.'],
          tasks: [{ advancement: 'create:train_casing_00', title: 'Make railway casing' }],
          icon: 'create:railway_casing'
        },
        {
          key: 'all_aboard',
          title: 'All Aboard!',
          after: ['locomotive_age'],
          tier: 2,
          desc: ['Assemble a train at a station.'],
          tasks: [{ advancement: 'create:train', title: 'Assemble a train' }],
          icon: 'create:controls'
        },
        {
          key: 'whistle',
          title: 'Choo Choo!',
          after: ['all_aboard'],
          tier: 2,
          desc: ['A steam whistle on the locomotive. Pull it while driving.'],
          tasks: [{ advancement: 'create:train_whistle', title: 'Sound a whistle while driving' }],
          icon: 'create:steam_whistle'
        },
        {
          key: 'conductor',
          title: 'Conductor Instructor',
          after: ['all_aboard'],
          tier: 2,
          desc: ['Hand a schedule to a seated mob or a blaze burner and the train drives itself.'],
          tasks: [{ advancement: 'create:conductor', title: 'Give a driver a schedule' }],
          icon: 'create:schedule'
        },
        {
          key: 'traffic',
          title: 'Traffic Control',
          after: ['conductor'],
          tier: 2,
          desc: ['Signals split the line into blocks; track observers tell redstone when a train passes.'],
          tasks: [
            { advancement: 'create:track_signal', title: 'Place a train signal' },
            { item: 'create:track_observer' }
          ],
          icon: 'create:track_signal'
        },
        {
          key: 'timetable',
          title: 'Dynamic Timetables',
          after: ['conductor'],
          tier: 3,
          desc: ['A display board fed by display links forecasts the next arrival.'],
          tasks: [{ advancement: 'create:display_board_0', title: 'Forecast an arrival on a display board' }],
          icon: 'create:display_board'
        },
        {
          key: 'nether_express',
          title: 'Dimensional Commuter',
          after: ['traffic'],
          tier: 3,
          desc: ['Track through a Nether portal links two worlds. Ride it once; send freight through unmanned after that.'],
          tasks: [{ advancement: 'create:train_portal', title: 'Ride a train through a portal' }],
          icon: 'minecraft:obsidian'
        },
        {
          key: 'field_trip',
          title: 'Field Trip',
          after: ['traffic'],
          tier: 4,
          desc: ['Leave a train seat more than 5000 blocks from where you boarded. That is a real journey.'],
          tasks: [{ advancement: 'create:long_travel', title: 'Travel 5000 blocks by train' }],
          icon: 'create:track'
        },
        {
          key: 'ambitious',
          title: 'Ambitious Endeavours',
          after: ['whistle'],
          tier: 4,
          desc: ['A train with six carriages or more. Freight, passengers, a dining car.'],
          tasks: [{ advancement: 'create:long_train', title: 'Assemble a train of six carriages' }],
          icon: 'create:train_door'
        },
        {
          key: 'track_factory',
          title: 'Track Factory',
          after: ['timetable'],
          tier: 4,
          desc: ['One mechanical press that has made more than a thousand tracks. Automate it and let it run.'],
          tasks: [{ advancement: 'create:track_crafting_factory', title: 'Press 1000 tracks on one press' }],
          icon: 'create:mechanical_press'
        },
        {
          key: 'grand_central',
          title: '&aGrand Central',
          after: ['field_trip', 'ambitious', 'track_factory'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['A station where three lines meet, with a board that tells everyone what is coming. Build it, then tick this.', '', "&eChapter prize:&r a stack of track, railway casing, a portal scroll bundle and a roll on the Legend's Hoard."],
          tasks: [{ checkmark: true, title: 'Three lines meet at my station' }],
          icon: 'create:track_station',
          reward: { items: [{ item: 'create:track', count: 64 }, { item: 'create:railway_casing', count: 16 }, { item: 'waystones:portal_scroll', count: 4 }] }
        }
      ]
    },
    {
      key: 'foundry',
      group: 'industry',
      title: 'The Foundry',
      subtitle: 'Nether industry: lava, crushing wheels, sturdy sheets and netherite.',
      about: 'Heavy industry lives where the heat is. Tap infinite lava, crush at full speed, refine obsidian into sturdy sheets and press netherite into something harder.',
      unlocks: 'infinite fuel, doubled ores, industrial iron, and the Compacted Netherite that ends the armour race.',
      icon: 'create:industrial_iron_block',
      quests: [
        {
          key: 'lava',
          title: 'Tapping the Mantle',
          tier: 3,
          desc: ['A hose pulley over a lava lake big enough to count as infinite. Blaze burners never go hungry again.'],
          tasks: [{ advancement: 'create:hose_pulley_lava', title: 'Pump from an infinite lava lake' }],
          icon: 'create:hose_pulley'
        },
        {
          key: 'burners',
          title: 'Bank of Flames',
          after: ['lava'],
          tier: 3,
          desc: ['Eight blaze burners in a row: a boiler, a mixer line and a superheater all at once.'],
          tasks: [{ item: 'create:blaze_burner', count: 8 }]
        },
        {
          key: 'crushing',
          title: 'Crushing It',
          after: ['lava'],
          tier: 4,
          desc: ['Run a pair of crushing wheels at maximum speed. Everything that goes in comes out doubled.'],
          tasks: [{ advancement: 'create:crusher_maxed_0000', title: 'Run crushing wheels at maximum speed' }],
          icon: 'create:crushing_wheel'
        },
        {
          key: 'sturdy',
          title: 'The Sturdiest Rocks',
          after: ['crushing'],
          tier: 3,
          desc: ['Obsidian, crushed to powder and refined into sturdy sheets. Hardness III on the pickaxe first.'],
          tasks: [{ advancement: 'create:sturdy_sheet', title: 'Refine a sturdy sheet' }],
          icon: 'create:sturdy_sheet'
        },
        {
          key: 'industrial_iron',
          title: 'Industrial Iron',
          after: ['sturdy'],
          tier: 3,
          desc: ['Industrial iron blocks: the foundry\'s floor, and the base of the heaviest machines.'],
          tasks: [{ item: 'create:industrial_iron_block', count: 16 }]
        },
        {
          key: 'foundry_find',
          title: 'Iron Maiden',
          after: ['burners'],
          tier: 3,
          desc: ['Somewhere in the Nether stands a foundry from before the bastions. Find it.'],
          tasks: [{ advancement: 'dungeons_arise:find_foundry', title: 'Find a Foundry' }],
          icon: 'minecraft:anvil'
        },
        {
          key: 'debris',
          title: 'Ancient Debris',
          after: ['foundry_find'],
          tier: 3,
          desc: ['Hardness IV and Mining 40 open the netherite layer. Eight pieces of debris.'],
          tasks: [{ item: 'minecraft:ancient_debris', count: 8 }]
        },
        {
          key: 'netherite',
          title: 'Netherite Ingots',
          after: ['debris'],
          tier: 4,
          desc: ['Four scrap, four gold, one ingot. Four ingots is a serious pile.'],
          tasks: [{ item: 'minecraft:netherite_ingot', count: 4 }]
        },
        {
          key: 'compacted',
          title: 'Compacted Netherite',
          after: ['netherite', 'industrial_iron'],
          tier: 4,
          desc: ['Four netherite ingots in a basin under a superheated press. The material of the last armour you will need.'],
          tasks: [{ item: 'lemursaucepacket:compacted_netherite' }]
        },
        {
          key: 'diving',
          title: 'Swimming with the Striders',
          after: ['netherite'],
          tier: 4,
          desc: ['Netherite diving gear and a backtank: take a walk on the lava floor.'],
          tasks: [{ advancement: 'create:diving_suit_lava', title: 'Dive in lava with netherite diving gear' }],
          icon: 'create:netherite_diving_helmet'
        },
        {
          key: 'foundry_done',
          title: '&aThe Foundry',
          after: ['compacted', 'diving'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Four compacted netherite: sixteen ingots pressed into the hardest metal on the server.', '', "&eChapter prize:&r two netherite upgrade templates, the Ember Crown and a roll on the Legend's Hoard."],
          tasks: [{ item: 'lemursaucepacket:compacted_netherite', count: 4 }],
          reward: { items: [{ item: 'minecraft:netherite_upgrade_smithing_template', count: 2 }, { item: 'lemursaucepacket:ember_crown' }] }
        }
      ]
    },
    {
      key: 'enchanter',
      group: 'industry',
      title: 'The Enchanter',
      subtitle: 'The Enchanting skill, Hardness tomes and levels past the vanilla max.',
      about: 'Enchanting is a skill here. The table trains it, and the skill decides how far an enchantment can go: Sharpness X at 99. Hardness tomes let your pickaxe break harder ores.',
      unlocks: 'enchantments up to level X, Telekinesis, and the Hardness tomes for iron, gold, diamonds, obsidian and ancient debris.',
      icon: 'minecraft:enchanting_table',
      quests: [
        {
          key: 'table',
          title: 'The First Table',
          tier: 2,
          desc: [
            'Four obsidian, two diamonds and a book. Obsidian and diamonds are Mining 30 materials, to mine and to craft with (chest finds included), so the first table of your own waits for Hardness III. Until then, enchant at one you find: mage towers, wizard towers and village libraries have them.',
            '',
            tip('Each enchant pays Enchanting XP. The third slot scales with the skill: 30 levels at 1, 150 at 99.')
          ],
          tasks: [{ item: 'minecraft:enchanting_table' }]
        },
        {
          key: 'shelves',
          title: 'Fifteen Shelves',
          after: ['table'],
          tier: 2,
          desc: ['Fifteen bookshelves around the table for full power.'],
          tasks: [{ item: 'minecraft:bookshelf', count: 15 }]
        },
        {
          key: 'first_enchant',
          title: 'First Enchantment',
          after: ['table'],
          tier: 1,
          tasks: [{ advancement: 'minecraft:story/enchant_item', title: 'Enchant an item at the table' }],
          icon: 'minecraft:lapis_lazuli'
        },
        {
          key: 'telekinesis',
          title: 'Telekinesis',
          after: ['first_enchant'],
          tier: 3,
          desc: ["The pack's own enchantment: blocks you break and mobs you kill drop straight into your inventory. It rolls at the table on tools and weapons, and turns up in loot and trades. Get it on a book."],
          tasks: [bookTask(enchantedBook('lemursaucepacket:telekinesis'), 'A book of Telekinesis')],
          icon: enchantedBook('lemursaucepacket:telekinesis')
        },
        {
          key: 'past_the_limit',
          title: 'Past the Limit',
          after: ['shelves'],
          tier: 3,
          desc: ['At Enchanting 20 the raised enchantments allow level VI. Combine two Sharpness V books at an anvil, or roll it at the table.'],
          tasks: [bookTask(enchantedBook('sharpness', 6), 'A book of Sharpness VI')],
          icon: enchantedBook('sharpness', 6)
        },
        {
          key: 'mending',
          title: 'Mending',
          after: ['first_enchant'],
          tier: 3,
          desc: ['Mending never rolls at the table. Librarians, loot chests and the reward crates carry it.'],
          tasks: [bookTask(enchantedBook('mending'), 'A book of Mending')],
          icon: enchantedBook('mending')
        },
        {
          key: 'sharpness_8',
          title: 'Sharpness VIII',
          after: ['past_the_limit'],
          tier: 4,
          desc: ['Enchanting 60 allows level VIII.'],
          tasks: [bookTask(enchantedBook('sharpness', 8), 'A book of Sharpness VIII')],
          icon: enchantedBook('sharpness', 8)
        },
        {
          key: 'hardness_1',
          title: 'Hardness I',
          tier: 2,
          desc: [
            'A Hardness tome is an enchanted book applied to a pickaxe at an anvil. Tier I is a crafting-table recipe: andesite, copper ingots and a book. It opens iron, zinc and lapis ore at Mining 10.',
            '',
            tip("Tomes don't stack: craft the next tier instead. Create drills mine tier I and II ores without a tome; using what they dig still needs the Mining level.")
          ],
          tasks: [bookTask(hardnessTome(1), 'A Hardness I tome')],
          icon: hardnessTome(1)
        },
        {
          key: 'hardness_2',
          title: 'Hardness II',
          after: ['hardness_1'],
          tier: 2,
          desc: [
            'From here on tomes are mechanical crafting: tier II is iron sheets, lapis and a book. It opens gold and redstone ore at Mining 20.',
            'The catch: the Mechanical Crafter needs brass (a blaze burner, so a Nether trip through a portal cast with lava and water) and an electron tube, which needs redstone your pickaxe cannot break yet. A &eMechanical Drill&r on a contraption can, and so can an Ore Excavation vein, witches, jungle temples and mineshaft chests.'
          ],
          tasks: [bookTask(hardnessTome(2), 'A Hardness II tome')],
          icon: hardnessTome(2)
        },
        {
          key: 'hardness_3',
          title: 'Hardness III',
          after: ['hardness_2'],
          tier: 3,
          desc: ['Golden sheets and redstone. Diamonds, emeralds and obsidian, at Mining 30. Obsidian means sturdy sheets, ender chests and enchanting tables of your own.'],
          tasks: [bookTask(hardnessTome(3), 'A Hardness III tome')],
          icon: hardnessTome(3)
        },
        {
          key: 'hardness_4',
          title: 'Hardness IV',
          after: ['hardness_3'],
          tier: 4,
          desc: ['Diamonds, precision mechanisms and iron sheets. Ancient debris, at Mining 40.'],
          tasks: [bookTask(hardnessTome(4), 'A Hardness IV tome')],
          icon: hardnessTome(4)
        },
        {
          key: 'hardness_5',
          title: 'Hardness V',
          after: ['hardness_4'],
          tier: 4,
          desc: ['Sturdy sheets and diamonds. Reinforced deepslate and budding amethyst, at Mining 50. Reinforced deepslate drops itself.'],
          tasks: [bookTask(hardnessTome(5), 'A Hardness V tome')],
          icon: hardnessTome(5)
        },
        {
          key: 'sharpness_10',
          title: '&aSharpness X',
          after: ['sharpness_8', 'hardness_5', 'telekinesis'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Enchanting 99. The third slot costs 150 levels and gives level X. A book of Sharpness X is the proof.', '', "&eChapter prize:&r a bucket of liquid experience, a Telekinesis book, a relic and a roll on the Legend's Hoard."],
          tasks: [bookTask(enchantedBook('sharpness', 10), 'A book of Sharpness X')],
          icon: enchantedBook('sharpness', 10),
          reward: { items: [{ item: 'create_enchantment_industry:experience_bucket' }, enchantedBook('lemursaucepacket:telekinesis')], tables: ['relic_cache'] }
        }
      ]
    },
    {
      key: 'arcane_works',
      group: 'industry',
      title: 'Arcane Works',
      subtitle: 'Create: Enchantment Industry. Enchanting as a production line.',
      about: 'Grindstones turn old gear into liquid experience, blaze enchanters spend it on new enchantments, printers copy books. Nothing here needs a lapis budget.',
      unlocks: 'automated enchanting, disenchanting, book copying and templates that stamp enchantments on anything.',
      icon: 'create_enchantment_industry:blaze_enchanter',
      quests: [
        {
          key: 'nuggets',
          title: 'Experienced Engineer',
          tier: 1,
          desc: ['Nuggets of experience: Create\'s way of storing XP as an item.'],
          tasks: [{ advancement: 'create_enchantment_industry:experienced_engineer', title: 'Obtain nuggets of experience' }],
          icon: 'create:experience_nugget'
        },
        {
          key: 'grindstone',
          title: 'Gone with the Foil',
          after: ['nuggets'],
          tier: 2,
          desc: ['A mechanical grindstone strips an enchanted item and drains the enchantment into liquid experience.'],
          tasks: [{ advancement: 'create_enchantment_industry:gone_with_the_foil', title: 'Disenchant an item on a mechanical grindstone' }],
          icon: 'create_enchantment_industry:mechanical_grindstone'
        },
        {
          key: 'hatch',
          title: 'Spirit-Taking',
          after: ['nuggets'],
          tier: 2,
          desc: ['An experience hatch stores your own levels as liquid, and gives them back.'],
          tasks: [{ advancement: 'create_enchantment_industry:spirit_taking', title: 'Store experience in an experience hatch' }],
          icon: 'create_enchantment_industry:experience_hatch'
        },
        {
          key: 'enchanter',
          title: 'Blaze Enchantry',
          after: ['grindstone', 'hatch'],
          tier: 3,
          desc: ['A blaze enchanter drinks liquid experience and enchants what passes underneath.'],
          tasks: [{ advancement: 'create_enchantment_industry:blaze_enchantery', title: 'Obtain a blaze enchanter' }],
          icon: 'create_enchantment_industry:blaze_enchanter'
        },
        {
          key: 'first_blaze_enchant',
          title: 'Blazing Enchantment',
          after: ['enchanter'],
          tier: 3,
          tasks: [{ advancement: 'create_enchantment_industry:blazing_enchantment', title: 'Enchant an item with a blaze enchanter' }],
          icon: 'minecraft:enchanted_book'
        },
        {
          key: 'printer',
          title: 'Copiable Mystery',
          after: ['enchanter'],
          tier: 3,
          desc: ['A printer copies a book, enchanted or written, for ink and experience.'],
          tasks: [{ advancement: 'create_enchantment_industry:copiable_mystery', title: 'Copy an enchanted book with a printer' }],
          icon: 'create_enchantment_industry:printer'
        },
        {
          key: 'forger',
          title: 'Born Talent of Fire',
          after: ['enchanter'],
          tier: 3,
          desc: ['A blaze forger merges and strips enchantments the way an anvil does, but never gets too expensive.'],
          tasks: [{ advancement: 'create_enchantment_industry:born_talent_of_fire', title: 'Obtain a blaze forger' }],
          icon: 'create_enchantment_industry:blaze_forger'
        },
        {
          key: 'fusion',
          title: 'Blazing Fusion',
          after: ['forger'],
          tier: 3,
          tasks: [{ advancement: 'create_enchantment_industry:blazing_fusion', title: 'Merge two of the same item in a blaze forger' }],
          icon: 'minecraft:anvil'
        },
        {
          key: 'template',
          title: 'Sigil Forging',
          after: ['fusion', 'first_blaze_enchant'],
          tier: 4,
          desc: ['Enchanting templates hold a set of enchantments. Forge one, then stamp it onto item after item.'],
          tasks: [{ advancement: 'create_enchantment_industry:sigil_forging', title: 'Add an enchantment to an enchanting template' }],
          icon: 'create_enchantment_industry:enchanting_template'
        },
        {
          key: 'lantern',
          title: 'Lumen Nexus',
          after: ['hatch'],
          tier: 3,
          desc: ['An experience lantern collects XP orbs around it.'],
          tasks: [{ advancement: 'create_enchantment_industry:lumen_nexus', title: 'Obtain an experience lantern' }],
          icon: 'create_enchantment_industry:experience_lantern'
        },
        {
          key: 'super_xp',
          title: 'Lightning Catalysis',
          after: ['template'],
          tier: 4,
          desc: ['Super experience: liquid experience struck by lightning, for the enchantments no table gives.'],
          tasks: [{ advancement: 'create_enchantment_industry:lightning_catalysis', title: 'Obtain super experience' }],
          icon: 'create_enchantment_industry:super_experience_nugget'
        },
        {
          key: 'thousand_runes',
          title: '&aThousand Runes',
          after: ['super_xp', 'printer', 'lantern'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['A blaze enchanter that has enchanted a thousand times. Only a real production line gets there.', '', "&eChapter prize:&r a Mending book, two buckets of liquid experience and a roll on the Legend's Hoard."],
          tasks: [{ advancement: 'create_enchantment_industry:thousand_runes', title: 'Use a blaze enchanter 1000 times' }],
          icon: 'create_enchantment_industry:classic_blaze_enchanter',
          reward: { items: [enchantedBook('mending'), { item: 'create_enchantment_industry:experience_bucket', count: 2 }] }
        }
      ]
    },
    {
      key: 'warehouse',
      group: 'industry',
      title: 'The Warehouse',
      subtitle: 'Storage that sorts, packs and delivers itself.',
      about: 'Vaults, chain conveyors, frogports and stock keepers on the Create side; magnets, stacks and Create upgrades on the backpack side. Never dig through a chest again.',
      unlocks: 'a stock network you can order from anywhere, packages that find their own way, and a backpack that presses and mixes.',
      icon: 'create:item_vault',
      quests: [
        {
          key: 'shelving',
          title: 'Shelving',
          tier: 1,
          desc: ['Sixteen barrels. Label them. Every warehouse starts as a wall of barrels.'],
          tasks: [{ item: 'minecraft:barrel', count: 16 }]
        },
        {
          key: 'vaults',
          title: 'Item Vault',
          after: ['shelving'],
          tier: 2,
          desc: ['Vaults join into one inventory up to 3x3x3. Four is a start.'],
          tasks: [{ item: 'create:item_vault', count: 4 }]
        },
        {
          key: 'sorting',
          title: 'Sorting Line',
          after: ['vaults'],
          tier: 3,
          desc: ['Brass funnels with attribute filters pull items off a belt by what they are: all ores here, all food there.'],
          tasks: [
            { item: 'create:brass_funnel', count: 8 },
            { item: 'create:attribute_filter', count: 2 }
          ],
          icon: 'create:attribute_filter'
        },
        {
          key: 'chain',
          title: 'Chain Conveyor',
          after: ['vaults'],
          tier: 3,
          desc: ['Chain conveyors carry packages between buildings, over anything.'],
          tasks: [{ item: 'create:chain_conveyor', count: 4 }]
        },
        {
          key: 'frogport',
          title: 'Hungry Hoppers',
          after: ['chain'],
          tier: 3,
          desc: ['A frogport catches packages off a chain conveyor and drops them into your storage.'],
          tasks: [{ advancement: 'create:frogport', title: 'Catch a package with a frogport' }],
          icon: 'create:package_frogport'
        },
        {
          key: 'stock_links',
          title: 'Stock Links',
          after: ['sorting'],
          tier: 3,
          desc: ['A stock link on every vault puts the whole warehouse in one list.'],
          tasks: [{ item: 'create:stock_link', count: 4 }]
        },
        {
          key: 'order_up',
          title: 'Order Up!',
          after: ['stock_links'],
          tier: 3,
          desc: ['Seat a mob at a stock ticker and place your first order. It arrives in a package.'],
          tasks: [{ advancement: 'create:stock_ticker', title: 'Order from a stock ticker' }],
          icon: 'create:stock_ticker'
        },
        {
          key: 'requester',
          title: 'Redstone Requester',
          after: ['order_up', 'frogport'],
          tier: 4,
          desc: ['A redstone requester orders a fixed shopping list on a pulse. Wire it to a button by the door.'],
          tasks: [{ item: 'create:redstone_requester' }]
        },
        {
          key: 'compacting_upgrade',
          title: 'Backpack Compacting',
          after: ['shelving'],
          tier: 2,
          desc: ['A compacting upgrade turns nuggets and gems into blocks inside the backpack.'],
          tasks: [{ item: 'sophisticatedbackpacks:compacting_upgrade' }]
        },
        {
          key: 'create_upgrades',
          title: 'Backpack Press and Mixer',
          after: ['compacting_upgrade'],
          tier: 3,
          desc: ['Create Backpack Upgrades: a press and a mixer that work inside the bag. Pressable items on the left, results on the right.'],
          tasks: [
            { item: 'createbackpackupgrades:pressing_upgrade' },
            { item: 'createbackpackupgrades:mixing_upgrade' }
          ],
          icon: 'createbackpackupgrades:pressing_upgrade'
        },
        {
          key: 'advanced_magnet',
          title: 'Advanced Magnet',
          after: ['create_upgrades'],
          tier: 3,
          desc: ['The advanced magnet pulls items and experience from further away, with a filter.'],
          tasks: [{ item: 'sophisticatedbackpacks:advanced_magnet_upgrade' }]
        },
        {
          key: 'warehouse_done',
          title: '&aThe Warehouse',
          after: ['requester', 'advanced_magnet'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Thirty-two vaults, stock-linked, with packages arriving by chain and train. Tick it when the warehouse runs without you.', '', "&eChapter prize:&r a tank upgrade, an everlasting upgrade, a stack upgrade and a roll on the Legend's Hoard."],
          tasks: [{ item: 'create:item_vault', count: 32 }],
          icon: 'create:item_vault',
          reward: { items: [{ item: 'sophisticatedbackpacks:tank_upgrade' }, { item: 'sophisticatedbackpacks:everlasting_upgrade' }, { item: 'sophisticatedbackpacks:stack_upgrade_tier_1' }] }
        }
      ]
    },
    {
      key: 'kitchen',
      group: 'industry',
      title: 'Grand Kitchen',
      subtitle: "Farmer's Delight from first knife to Master Chef.",
      about: 'Homestead got you cooking. This is the full menu: compost, rice paddies, feasts, chocolate, and every meal in the book.',
      unlocks: "the Chef's Hat relic, a netherite knife, and food that keeps you fed and healthy for whole days.",
      icon: 'farmersdelight:stove',
      quests: [
        {
          key: 'skillet',
          title: 'Portable Cooking',
          tier: 1,
          desc: ['A skillet cooks on the go: stand near heat and hold food in your other hand.'],
          tasks: [{ advancement: 'farmersdelight:main/use_skillet', title: 'Cook with a skillet' }],
          icon: 'farmersdelight:skillet'
        },
        {
          key: 'straw',
          title: 'Grasping at Straws',
          tier: 1,
          desc: ['Harvest grass, wheat or rice with a knife for straw.'],
          tasks: [{ advancement: 'farmersdelight:main/harvest_straw', title: 'Collect straw with a knife' }],
          icon: 'farmersdelight:straw'
        },
        {
          key: 'ham',
          title: 'Wild Butcher',
          tier: 1,
          desc: ['A knife on a pig or a hoglin gives ham.'],
          tasks: [{ advancement: 'farmersdelight:main/get_ham', title: 'Extract ham with a knife' }],
          icon: 'farmersdelight:ham'
        },
        {
          key: 'rice',
          title: 'Dipping Your Roots',
          after: ['straw'],
          tier: 1,
          desc: ['Rice grows in a shallow puddle.'],
          tasks: [{ advancement: 'farmersdelight:main/plant_rice', title: 'Plant rice in water' }],
          icon: 'farmersdelight:rice'
        },
        {
          key: 'compost',
          title: 'Advanced Composting',
          after: ['straw'],
          tier: 2,
          desc: ['Organic compost decays into rich soil with sun, water and mushrooms nearby.'],
          tasks: [{ advancement: 'farmersdelight:main/place_organic_compost', title: 'Place organic compost' }],
          icon: 'farmersdelight:organic_compost'
        },
        {
          key: 'tallmato',
          title: 'Tall-mato',
          after: ['rice'],
          tier: 2,
          desc: ['Rope above a tomato crop and it climbs.'],
          tasks: [{ advancement: 'farmersdelight:main/harvest_ropelogged_tomato', title: 'Harvest a rope-grown tomato' }],
          icon: 'farmersdelight:tomato'
        },
        {
          key: 'mushroom_colony',
          title: 'Fungus Among Us',
          after: ['compost'],
          tier: 3,
          desc: ['Mushrooms on rich soil grow into colonies. Shear a full one.'],
          tasks: [{ advancement: 'farmersdelight:main/get_mushroom_colony', title: 'Shear a mature mushroom colony' }],
          icon: 'farmersdelight:brown_mushroom_colony'
        },
        {
          key: 'feast',
          title: 'A Glorious Feast',
          after: ['ham'],
          tier: 2,
          desc: ['Some meals are big enough to place down and share.'],
          tasks: [{ advancement: 'farmersdelight:main/place_feast', title: 'Place a feast' }],
          icon: 'farmersdelight:roast_chicken_block'
        },
        {
          key: 'nourishing',
          title: 'Nourishing!',
          after: ['feast'],
          tier: 2,
          desc: ['A proper meal gives Nourishment: fed and healthy for a long while.'],
          tasks: [{ advancement: 'farmersdelight:main/eat_nourishing_food', title: 'Eat a nourishing meal' }],
          icon: 'farmersdelight:steak_and_potatoes'
        },
        {
          key: 'chocolate',
          title: 'A World of Imagination',
          after: ['skillet'],
          tier: 2,
          desc: ['Cocoa and milk, mixed and heated: a bucket of chocolate.'],
          tasks: [{ advancement: 'create:chocolate_bucket', title: 'Fill a bucket with chocolate' }],
          icon: 'create:chocolate_bucket'
        },
        {
          key: 'spout_foods',
          title: 'Balanced Diet',
          after: ['chocolate'],
          tier: 3,
          desc: ['One spout, three sweets: chocolate glazed berries, a honeyed apple and a sweet roll.'],
          tasks: [{ advancement: 'create:foods', title: 'Make all three spout foods' }],
          icon: 'create:sweet_roll'
        },
        {
          key: 'crop_rotation',
          title: 'Crop Rotation',
          after: ['tallmato', 'mushroom_colony'],
          tier: 3,
          desc: ['Grow every food plant there is: vegetables, fruit, fungi and roots.'],
          tasks: [{ advancement: 'farmersdelight:main/plant_all_crops', title: 'Cultivate every crop' }],
          icon: 'farmersdelight:cabbage'
        },
        {
          key: 'netherite_knife',
          title: "If You Can't Take the Heat...",
          after: ['nourishing'],
          tier: 4,
          desc: ['A whole netherite ingot on a knife.'],
          tasks: [{ advancement: 'farmersdelight:main/obtain_netherite_knife', title: 'Obtain a netherite knife' }],
          icon: 'farmersdelight:netherite_knife'
        },
        {
          key: 'master_chef',
          title: '&aMaster Chef',
          after: ['crop_rotation', 'spout_foods', 'netherite_knife'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Eat a course of every meal there is.', '', "&eChapter prize:&r the Chef's Hat relic, two feasts and a roll on the Legend's Hoard."],
          tasks: [{ advancement: 'farmersdelight:main/master_chef', title: 'Eat every meal' }],
          icon: 'farmersdelight:cooking_pot',
          reward: { items: [{ item: 'relics:chef_hat' }, { item: 'farmersdelight:honey_glazed_ham_block' }, { item: 'farmersdelight:shepherds_pie_block' }] }
        }
      ]
    },

    // ================================================================= EXPEDITIONS
    {
      key: 'cartographer',
      group: 'expeditions',
      title: 'Cartographer',
      subtitle: 'Maps, waypoints, dungeons and towers.',
      about: 'The world is full of places worth a pin on the map: When Dungeons Arise, Dungeons and Taverns, Towers of the Wild and Structory. Lootr gives every player their own loot in each chest, so nobody arrives too late.',
      unlocks: 'the Explorer Cape for Adventuring Time, and every crate in between.',
      icon: 'minecraft:filled_map',
      quests: [
        {
          key: 'waypoint',
          title: 'Waypoints',
          tier: 1,
          desc: ['&eM&r opens the map, &eU&r the waypoint list. Drop a waypoint at your base before you wander. Activated waystones show on the map too.'],
          tasks: [{ checkmark: true, title: 'I set a waypoint at my base' }],
          icon: 'minecraft:compass',
          reward: { items: [{ item: 'minecraft:spyglass' }] }
        },
        {
          key: 'map',
          title: 'Filled Map',
          after: ['waypoint'],
          tier: 1,
          desc: ['A paper map still has its uses: it fits in an item frame, and a cartographer sells treasure maps.'],
          tasks: [{ item: 'minecraft:filled_map' }]
        },
        {
          key: 'first_chest',
          title: "'X' Marks the Spot",
          after: ['waypoint'],
          tier: 1,
          desc: ['Loot chests are instanced: a Lootr chest gives each player their own loot. Open your first.'],
          tasks: [{ advancement: 'lootr:1chest', title: 'Open a Lootr chest' }],
          icon: 'lootr:lootr_chest'
        },
        {
          key: 'loot_10',
          title: 'Delightful Decade',
          after: ['first_chest'],
          tier: 2,
          tasks: [{ advancement: 'lootr:10loot', title: 'Open 10 Lootr containers' }],
          icon: 'lootr:lootr_barrel'
        },
        {
          key: 'loot_50',
          title: 'Half-Century',
          after: ['loot_10'],
          tier: 3,
          tasks: [{ advancement: 'lootr:50loot', title: 'Open 50 Lootr containers' }],
          icon: 'lootr:lootr_trapped_chest'
        },
        {
          key: 'loot_100',
          title: 'Centennial',
          after: ['loot_50'],
          tier: 4,
          desc: ['A hundred chests opened. Lootr hands out a trophy.'],
          tasks: [{ advancement: 'lootr:100loot', title: 'Open 100 Lootr containers' }],
          icon: 'lootr:trophy'
        },
        {
          key: 'keep_kayra',
          title: 'Keep Kayra',
          after: ['map'],
          tier: 3,
          desc: ['A castle keep from When Dungeons Arise. Every room is a fight.'],
          tasks: [{ structure: 'dungeons_arise:keep_kayra' }],
          icon: 'minecraft:stone_bricks'
        },
        {
          key: 'bandit_towers',
          title: 'Bandit Towers',
          after: ['map'],
          tier: 3,
          tasks: [{ structure: 'dungeons_arise:bandit_towers' }],
          icon: 'minecraft:crossbow'
        },
        {
          key: 'mining_complex',
          title: 'Mining Complex',
          after: ['map'],
          tier: 3,
          desc: ['A sprawling mine with more than ore in it.'],
          tasks: [{ structure: 'dungeons_arise:mining_complex' }],
          icon: 'minecraft:rail'
        },
        {
          key: 'shiraz',
          title: 'Shiraz Palace',
          after: ['keep_kayra'],
          tier: 3,
          tasks: [{ structure: 'dungeons_arise:shiraz_palace' }],
          icon: 'minecraft:sandstone'
        },
        {
          key: 'plague_asylum',
          title: 'Plague Asylum',
          after: ['bandit_towers'],
          tier: 4,
          desc: ['Not a place to visit alone.'],
          tasks: [{ structure: 'dungeons_arise:plague_asylum' }],
          icon: 'minecraft:skeleton_skull'
        },
        {
          key: 'heavenly',
          title: 'Ghost Riders in the Sky',
          after: ['mining_complex'],
          tier: 4,
          desc: ['The Heavenly Conqueror is a ship in the clouds. An airship or a very tall tower gets you there.'],
          tasks: [{ structure: 'dungeons_arise:heavenly_conqueror' }],
          icon: 'minecraft:phantom_membrane'
        },
        {
          key: 'wizard_tower',
          title: 'Wizard Tower',
          after: ['map'],
          tier: 3,
          desc: ['Structory Towers: a wizard lived here. Check the top floor.'],
          tasks: [{ structure: 'structory_towers:wizard_tower' }],
          icon: 'minecraft:enchanting_table'
        },
        {
          key: 'tower_of_the_wild',
          title: 'Tower of the Wild',
          after: ['map'],
          tier: 2,
          desc: ['Tall, mossy and full of loot at the top. Some have a waystone.'],
          tasks: [{ structure: 'totw_modded:regular' }],
          icon: 'minecraft:mossy_cobblestone'
        },
        {
          key: 'combat_shrine',
          title: 'Combat Shrine',
          after: ['map'],
          tier: 2,
          desc: ['Dungeons and Taverns builds shrines in tiers. The first is a warm-up.'],
          tasks: [{ structure: 'nova_structures:shrine_combat_tier_1' }],
          icon: 'minecraft:iron_sword'
        },
        {
          key: 'illager_manor',
          title: 'Illager Manor',
          after: ['combat_shrine'],
          tier: 3,
          tasks: [{ structure: 'nova_structures:illager_manor' }],
          icon: 'minecraft:dark_oak_planks'
        },
        {
          key: 'pioneer',
          title: 'Pioneer',
          after: ['tower_of_the_wild'],
          tier: 5,
          desc: ['Regions Unexplored counts its surface biomes. Visit every one.'],
          tasks: [{ advancement: 'regions_unexplored:pioneer', title: 'Explore every Regions Unexplored surface biome' }],
          icon: 'minecraft:oak_sapling'
        },
        {
          key: 'adventuring_time',
          title: '&aAdventuring Time',
          after: ['plague_asylum', 'heavenly', 'shiraz', 'illager_manor'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Every Overworld biome, Terralith included. The Explorer Cape comes with it.', '', "&eChapter prize:&r a waystone of your own, a warp stone, a relic and a roll on the Legend's Hoard."],
          tasks: [{ advancement: 'minecraft:adventure/adventuring_time', title: 'Visit every Overworld biome' }],
          icon: 'minecraft:filled_map',
          reward: { items: [{ item: 'waystones:waystone' }, { item: 'waystones:warp_stone' }], tables: ['relic_cache'] }
        }
      ]
    },
    {
      key: 'deep_dark',
      group: 'expeditions',
      title: 'Deep Dark',
      subtitle: 'Sculk, the ancient city and the thing that guards it.',
      about: 'Below the deepslate lies the deep dark. Sneak past the sensors, loot the city, and decide whether to wake the Warden.',
      unlocks: 'swift sneak, echo shards, the silence trim, and the Warden kill nobody will believe.',
      icon: 'minecraft:sculk_catalyst',
      quests: [
        {
          key: 'sculk',
          title: 'Sculk',
          tier: 2,
          desc: ['Silk touch a few sculk blocks. Without it they only give XP.'],
          tasks: [{ item: 'minecraft:sculk', count: 16 }]
        },
        {
          key: 'sneak',
          title: 'Sneak 100',
          after: ['sculk'],
          tier: 2,
          desc: ['Walk within range of a sculk sensor or shrieker without setting it off.'],
          tasks: [{ advancement: 'minecraft:adventure/avoid_vibration', title: 'Sneak past a sculk sensor' }],
          icon: 'minecraft:sculk_sensor'
        },
        {
          key: 'ancient_city',
          title: 'The Ancient City',
          after: ['sneak'],
          tier: 3,
          desc: ['Deep, dark and silent. The chests hold what no other place does.'],
          tasks: [{ structure: 'minecraft:ancient_city' }],
          icon: 'minecraft:reinforced_deepslate'
        },
        {
          key: 'catalyst',
          title: 'It Spreads',
          after: ['sculk'],
          tier: 2,
          desc: ['Kill a mob near a sculk catalyst and watch the sculk grow.'],
          tasks: [{ advancement: 'minecraft:adventure/kill_mob_near_sculk_catalyst', title: 'Kill a mob near a sculk catalyst' }],
          icon: 'minecraft:sculk_catalyst'
        },
        {
          key: 'echo',
          title: 'Echo Shards',
          after: ['ancient_city'],
          tier: 3,
          tasks: [{ item: 'minecraft:echo_shard', count: 4 }]
        },
        {
          key: 'recovery',
          title: 'Recovery Compass',
          after: ['echo'],
          tier: 3,
          desc: ['Eight echo shards around a compass: it points at the place you last died. Your grave is there.'],
          tasks: [{ item: 'minecraft:recovery_compass' }]
        },
        {
          key: 'disc',
          title: 'Disc 5',
          after: ['ancient_city'],
          tier: 3,
          desc: ['Nine fragments, scattered through the city chests, make one disc.'],
          tasks: [{ item: 'minecraft:music_disc_5' }]
        },
        {
          key: 'ward',
          title: 'Ward Trim',
          after: ['ancient_city'],
          tier: 3,
          tasks: [{ item: 'minecraft:ward_armor_trim_smithing_template' }]
        },
        {
          key: 'silence',
          title: 'Silence Trim',
          after: ['ward'],
          tier: 4,
          desc: ['The rarest trim in the game.'],
          tasks: [{ item: 'minecraft:silence_armor_trim_smithing_template' }]
        },
        {
          key: 'warden',
          title: '&cThe Warden',
          after: ['recovery', 'disc', 'silence'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Wake it on purpose, and win. Bring the whole server.', '', "&eChapter prize:&r a totem, a relic and two rolls on the Legend's Hoard."],
          tasks: [{ kill: 'minecraft:warden' }],
          icon: 'minecraft:sculk_shrieker',
          reward: { items: [{ item: 'minecraft:totem_of_undying' }], tables: ['relic_cache', 'legends_hoard'] }
        }
      ]
    },
    {
      key: 'beyond',
      group: 'expeditions',
      title: 'Beyond the Dragon',
      subtitle: 'The outer End: cities, ships, castles and the void.',
      about: 'The dragon is only the door. Out past the gateways are end cities, Nullscape\'s strange biomes and the castles Dungeons and Taverns left in the dark.',
      unlocks: 'shulker boxes, dragon breath, the levitation trick, and a second dragon fight on your terms.',
      icon: 'minecraft:end_crystal',
      quests: [
        {
          key: 'gateway',
          title: 'The Gateway',
          tier: 3,
          desc: ['After the dragon a gateway opens. An ender pearl through it puts you in the outer End.'],
          tasks: [{ advancement: 'minecraft:end/enter_end_gateway', title: 'Enter an end gateway' }],
          icon: 'minecraft:end_portal_frame'
        },
        {
          key: 'chorus',
          title: 'Chorus',
          after: ['gateway'],
          tier: 2,
          desc: ['Chorus fruit teleports you when eaten, and pops into purpur when cooked.'],
          tasks: [{ item: 'minecraft:chorus_fruit', count: 16 }]
        },
        {
          key: 'end_city',
          title: 'End City',
          after: ['gateway'],
          tier: 3,
          tasks: [{ structure: 'minecraft:end_city' }],
          icon: 'minecraft:purpur_block'
        },
        {
          key: 'shulkers',
          title: 'Shulker Shells',
          after: ['end_city'],
          tier: 3,
          desc: ['Two shells and a chest make a box that keeps its contents when broken.'],
          tasks: [
            { item: 'minecraft:shulker_shell', count: 2 },
            { item: 'minecraft:shulker_box' }
          ],
          icon: 'minecraft:shulker_shell'
        },
        {
          key: 'levitate',
          title: 'Great View From Up Here',
          after: ['end_city'],
          tier: 3,
          desc: ['Let a shulker hit you and levitate 50 blocks up.'],
          tasks: [{ advancement: 'minecraft:end/levitate', title: 'Levitate 50 blocks from shulker attacks' }],
          icon: 'minecraft:shulker_box'
        },
        {
          key: 'dragon_breath',
          title: "Dragon's Breath",
          after: ['gateway'],
          tier: 3,
          desc: ['Bottle the purple cloud. Lingering potions need it.'],
          tasks: [{ advancement: 'minecraft:end/dragon_breath', title: "Collect dragon's breath" }],
          icon: 'minecraft:dragon_breath'
        },
        {
          key: 'nullscape',
          title: 'The Far End',
          after: ['gateway'],
          tier: 3,
          desc: ['Nullscape reshapes the outer End into crystal peaks, shadowlands and void barrens. Stand in all three.'],
          tasks: [
            { biome: 'nullscape:crystal_peaks' },
            { biome: 'nullscape:shadowlands' },
            { biome: 'nullscape:void_barrens' }
          ],
          icon: 'minecraft:end_rod'
        },
        {
          key: 'end_lighthouse',
          title: 'End Lighthouse',
          after: ['nullscape'],
          tier: 3,
          tasks: [{ structure: 'nova_structures:end_lighthouse' }],
          icon: 'minecraft:sea_lantern'
        },
        {
          key: 'end_castle',
          title: 'End Castle',
          after: ['end_lighthouse'],
          tier: 4,
          desc: ['Dungeons and Taverns\' castle in the void. The relics of the End wait in its chests.'],
          tasks: [{ structure: 'nova_structures:end_castle' }],
          icon: 'minecraft:end_stone_bricks'
        },
        {
          key: 'end_tower',
          title: 'End Tower',
          after: ['nullscape'],
          tier: 3,
          tasks: [{ structure: 'structory_towers:end/end_tower' }],
          icon: 'minecraft:end_stone'
        },
        {
          key: 'respawn',
          title: '&aThe End... Again',
          after: ['end_castle', 'shulkers', 'levitate', 'dragon_breath'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Four end crystals on the portal frame bring the dragon back. Fight it on your own terms.', '', "&eChapter prize:&r 5,000 coins, an end stone waystone, a relic and two rolls on the Legend's Hoard."],
          tasks: [{ advancement: 'minecraft:end/respawn_dragon', title: 'Respawn the ender dragon' }],
          icon: 'minecraft:dragon_head',
          reward: { coins: 5000, items: [{ item: 'waystones:end_stone_waystone' }], tables: ['relic_cache', 'legends_hoard'] }
        }
      ]
    },
    {
      key: 'village_life',
      group: 'expeditions',
      title: 'Village Life',
      subtitle: 'Trade, defend, cure and become the Hero of the Village.',
      about: 'Villages come in dozens of new styles and they need friends. Trade with them, arm their guards, cure their lost, and stand with them when the raid comes.',
      unlocks: 'the Hero cape, discounts everywhere, and a village that fights back.',
      icon: 'minecraft:bell',
      quests: [
        {
          key: 'trade',
          title: 'First Trade',
          tier: 1,
          tasks: [{ advancement: 'minecraft:adventure/trade', title: 'Trade with a villager' }],
          icon: 'minecraft:emerald'
        },
        {
          key: 'towns',
          title: 'Towns and Towers',
          after: ['trade'],
          tier: 2,
          desc: ['Towns & Towers rebuilds villages for every biome: swamp, jungle, snowy slopes, mushroom fields. Find one that is not on the plains.'],
          tasks: [{ structure: '#towns_and_towers:town' }],
          icon: 'minecraft:oak_door'
        },
        {
          key: 'bell',
          title: 'Ring the Bell',
          after: ['trade'],
          tier: 1,
          desc: ['A bell calls villagers home when a raid starts. Every village of yours needs one.'],
          tasks: [{ item: 'minecraft:bell' }]
        },
        {
          key: 'golem',
          title: 'Iron Guardian',
          after: ['bell'],
          tier: 2,
          desc: ['Four iron blocks and a pumpkin.'],
          tasks: [{ advancement: 'minecraft:adventure/summon_iron_golem', title: 'Summon an iron golem' }],
          icon: 'minecraft:carved_pumpkin'
        },
        {
          key: 'guards',
          title: 'Guards',
          after: ['golem'],
          tier: 2,
          desc: ['Guard Villagers: hand a nitwit or an unemployed villager a sword or a crossbow and they take up arms. Give them armour too.'],
          tasks: [{ checkmark: true, title: 'I armed a guard' }],
          icon: 'minecraft:iron_sword'
        },
        {
          key: 'emeralds',
          title: 'Emerald Standard',
          after: ['trade'],
          tier: 2,
          tasks: [{ item: 'minecraft:emerald_block', count: 4 }]
        },
        {
          key: 'cure',
          title: 'Zombie Doctor',
          after: ['emeralds'],
          tier: 3,
          desc: ['A golden apple and a weakness potion bring a zombie villager back. They remember, and their prices drop.'],
          tasks: [{ advancement: 'minecraft:story/cure_zombie_villager', title: 'Cure a zombie villager' }],
          icon: 'minecraft:golden_apple'
        },
        {
          key: 'fortified',
          title: 'Fortified Village',
          after: ['towns'],
          tier: 3,
          desc: ['Terralith builds villages with walls. Find one.'],
          tasks: [{ structure: '#terralith:fortified_villages' }],
          icon: 'minecraft:cobblestone_wall'
        },
        {
          key: 'exile',
          title: 'Voluntary Exile',
          after: ['guards'],
          tier: 2,
          desc: ['Kill a raid captain and carry the bad omen. Do not walk into a village until you mean it.'],
          tasks: [{ advancement: 'minecraft:adventure/voluntary_exile', title: 'Kill a raid captain' }],
          icon: OMINOUS_BANNER
        },
        {
          key: 'hero',
          title: '&aHero of the Village',
          after: ['exile', 'cure', 'fortified'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Bring the raid to a village you have made strong, and win. The Hero cape is yours, and so are the discounts.', '', "&eChapter prize:&r four emerald blocks, a relic and a roll on the Legend's Hoard."],
          tasks: [{ advancement: 'minecraft:adventure/hero_of_the_village', title: 'Defeat a raid' }],
          icon: 'minecraft:bell',
          reward: { items: [{ item: 'minecraft:emerald_block', count: 4 }], tables: ['relic_cache'] }
        }
      ]
    },
    {
      key: 'relic_hunter',
      group: 'expeditions',
      title: 'Relic Hunter',
      subtitle: 'Twenty relics hide in the chests of the world. Find them, level them, pair them.',
      about: 'Relics are trinkets with abilities that grow as you use them. They only drop in loot chests, each in the kind of place it belongs. Some pair with the pack\'s armour sets for a synergy.',
      unlocksLabel: 'Rewards',
      unlocks: 'a crate for every relic found, relics from the cache for collecting them, and the Relic Master prize.',
      icon: 'relics:clot_of_time',
      quests: [
        {
          key: 'guide',
          title: 'How Relics Work',
          tier: 1,
          pos: [4.2, 0],
          desc: [
            '• A relic goes in a &eCurios slot&r (the extra slots in your inventory), not your hand.',
            '• Using its ability earns the relic experience; levels give upgrade points for its abilities.',
            '• &eResearch&r an ability by holding the relic\'s tooltip open: it costs player XP.',
            '• Rank up a relic to raise its quality; that resets its upgrades.',
            '• Some armour sets have a &esynergy&r relic: the Prospector\'s set with the Clot of Time, the Aeronaut\'s with the Kinetic Belt, the Brass Duelist with the Ring of the Seven Deadly Sins.',
            '',
            tip('The "Found in" line on each relic\'s tooltip says which chests to open. Lootr means every chest is fresh for you.')
          ],
          tasks: [{ checkmark: true, title: 'Understood' }],
          icon: 'minecraft:book'
        },
        ...RELICS.map((r, i) => ({
          key: r,
          title: RELIC_NAMES[r],
          tier: 3,
          pos: gridPos(i, 5, 0, 1.9),
          desc: [`Found in ${RELIC_WHERE[r]}.`],
          tasks: [{ item: `relics:${r}` }]
        })),
        {
          key: 'first_relic',
          title: 'First Relic',
          after: RELICS,
          minDeps: 1,
          hideLines: true,
          tier: 3,
          pos: [0, 9.9],
          desc: ['Any one of the twenty. Put it on and try its ability.'],
          tasks: [{ checkmark: true, title: 'I found my first relic' }],
          icon: 'relics:roller_skate',
          reward: { items: [{ item: 'minecraft:experience_bottle', count: 16 }] }
        },
        {
          key: 'researcher',
          title: 'Researcher',
          after: ['first_relic'],
          tier: 3,
          pos: [2.1, 9.9],
          desc: ['Research an ability and raise a relic to level 5.'],
          tasks: [{ checkmark: true, title: 'A relic of mine is level 5' }],
          icon: 'minecraft:experience_bottle',
          reward: { items: [{ item: 'minecraft:experience_bottle', count: 32 }] }
        },
        {
          key: 'collector_5',
          title: 'Collector',
          after: RELICS,
          minDeps: 5,
          hideLines: true,
          tier: 4,
          pos: [4.2, 9.9],
          desc: ['Five different relics.'],
          tasks: [{ checkmark: true, title: 'Five relics found' }],
          icon: 'relics:hunting_belt',
          reward: { tables: ['relic_cache'] }
        },
        {
          key: 'collector_10',
          title: 'Curator',
          after: RELICS,
          minDeps: 10,
          hideLines: true,
          tier: 4,
          pos: [6.3, 9.9],
          desc: ['Ten different relics.'],
          tasks: [{ checkmark: true, title: 'Ten relics found' }],
          icon: 'relics:midnight_mantle',
          reward: { tables: ['relic_cache', 'relic_cache'] }
        },
        {
          key: 'synergy',
          title: 'Synergy',
          after: ['researcher'],
          tier: 4,
          pos: [2.1, 12.2],
          desc: ['Wear a full armour set with its synergy relic: the Prospector\'s with the Clot of Time, the Aeronaut\'s with the Kinetic Belt, or the Brass Duelist with the Ring of the Seven Deadly Sins.'],
          tasks: [{ checkmark: true, title: 'A set and its relic, together' }],
          icon: 'lemursaucepacket:prospector_helmet',
          reward: { items: [{ item: 'lemursaucepacket:duelists_pattern' }] }
        },
        {
          key: 'relic_master',
          title: '&aRelic Master',
          after: RELICS,
          minDeps: 15,
          hideLines: true,
          shape: 'gear',
          size: 1.75,
          tier: 5,
          pos: [4.2, 12.2],
          desc: ['Fifteen of the twenty.', '', "&eChapter prize:&r two relics from the cache, 40,000 coins and two rolls on the Legend's Hoard."],
          tasks: [{ checkmark: true, title: 'Fifteen relics found' }],
          icon: 'relics:ring_of_the_seven_deadly_sins',
          reward: { coins: 40000, tables: ['relic_cache', 'relic_cache', 'legends_hoard'] }
        }
      ]
    },

    // ================================================================= FIELD GUIDES
    {
      key: 'backpack_workshop',
      group: 'guides',
      title: 'Backpack Workshop',
      subtitle: "Fair backpacks: every tier is built from its age's Create parts.",
      about: 'Backpacks here follow your Create progress: each tier needs parts from the matching age.',
      unlocks: 'more room on the move, plus pickup, magnet, feeding and restock upgrades.',
      icon: 'sophisticatedbackpacks:backpack',
      quests: [
        {
          key: 'rules',
          title: 'How Backpacks Work Here',
          tier: 1,
          desc: [
            '• Wear one backpack in the &eback slot&r. Only that one runs its upgrades; others in your inventory are plain storage.',
            '• Carry more than &e3&r and you slow down.',
            '• No backpacks inside backpacks, and none found in loot.',
            '• One stack upgrade per backpack, at most &e4x&r.',
            '• Pump, battery and mob-catcher upgrades are off: Create does those jobs.'
          ],
          tasks: [{ checkmark: true, title: 'Understood' }],
          icon: 'minecraft:leather'
        },
        {
          key: 'leather',
          title: 'Leather Backpack',
          after: ['rules'],
          tier: 1,
          tasks: [{ item: 'sophisticatedbackpacks:backpack' }]
        },
        {
          key: 'copper',
          title: 'Copper Backpack',
          after: ['leather'],
          tier: 2,
          desc: ['Copper sheets and andesite alloy around your backpack. Everything inside comes along.'],
          tasks: [{ item: 'sophisticatedbackpacks:copper_backpack' }]
        },
        {
          key: 'iron',
          title: 'Iron Backpack',
          after: ['copper'],
          tier: 2,
          desc: ['Iron sheets and andesite casing.'],
          tasks: [{ item: 'sophisticatedbackpacks:iron_backpack' }]
        },
        {
          key: 'gold',
          title: 'Gold Backpack',
          after: ['iron'],
          tier: 3,
          desc: ['Golden sheets and brass casing: this one waits for the Brass Age.'],
          tasks: [{ item: 'sophisticatedbackpacks:gold_backpack' }]
        },
        {
          key: 'diamond',
          title: 'Diamond Backpack',
          after: ['gold'],
          tier: 4,
          desc: ['Diamonds and precision mechanisms.'],
          tasks: [{ item: 'sophisticatedbackpacks:diamond_backpack' }]
        },
        {
          key: 'netherite',
          title: 'Netherite Backpack',
          after: ['diamond'],
          shape: 'gear',
          size: 1.5,
          tier: 5,
          desc: ['The last backpack.', '', "&eChapter prize:&r an advanced pickup upgrade, a stack upgrade II and a roll on the Legend's Hoard."],
          tasks: [{ item: 'sophisticatedbackpacks:netherite_backpack' }],
          reward: { items: [{ item: 'sophisticatedbackpacks:advanced_pickup_upgrade' }, { item: 'sophisticatedbackpacks:stack_upgrade_tier_2' }] }
        },
        {
          key: 'upgrade_base',
          title: 'Upgrade Base',
          after: ['leather'],
          tier: 1,
          tasks: [{ item: 'sophisticatedbackpacks:upgrade_base', count: 2 }]
        },
        {
          key: 'pickup',
          title: 'Pickup and Magnet',
          after: ['upgrade_base'],
          tier: 2,
          tasks: [
            { item: 'sophisticatedbackpacks:pickup_upgrade' },
            { item: 'sophisticatedbackpacks:magnet_upgrade' }
          ],
          icon: 'sophisticatedbackpacks:magnet_upgrade'
        },
        {
          key: 'feeding',
          title: 'Feeding and Restock',
          after: ['upgrade_base'],
          tier: 2,
          tasks: [
            { item: 'sophisticatedbackpacks:feeding_upgrade' },
            { item: 'sophisticatedbackpacks:restock_upgrade' }
          ],
          icon: 'sophisticatedbackpacks:feeding_upgrade'
        },
        {
          key: 'stack_1',
          title: 'Stack Upgrade I',
          after: ['upgrade_base'],
          tier: 2,
          tasks: [{ item: 'sophisticatedbackpacks:stack_upgrade_tier_1' }]
        },
        {
          key: 'stack_2',
          title: 'Stack Upgrade II',
          after: ['stack_1', 'gold'],
          tier: 3,
          desc: ['The highest stack upgrade on this server (4x). It needs brass casing.'],
          tasks: [{ item: 'sophisticatedbackpacks:stack_upgrade_tier_2' }]
        }
      ]
    },
    {
      key: 'homestead',
      group: 'guides',
      title: 'Homestead',
      subtitle: 'Farms, kitchens and the happy ghast.',
      about: 'Grow new crops, cook proper meals, breed animals and raise a happy ghast.',
      unlocks: 'food that lasts far longer, automated kitchens, and a friendly flying mount.',
      icon: 'farmersdelight:cooking_pot',
      quests: [
        {
          key: 'knife',
          title: 'Kitchen Knife',
          tier: 1,
          tasks: [{ item: 'farmersdelight:flint_knife' }]
        },
        {
          key: 'board',
          title: 'Cutting Board',
          after: ['knife'],
          tier: 1,
          tasks: [{ item: 'farmersdelight:cutting_board' }]
        },
        {
          key: 'pot',
          title: 'Cooking Pot',
          after: ['knife'],
          tier: 2,
          desc: ['Set a cooking pot over a fire or stove. Hearty meals keep you fed far longer than bread.'],
          tasks: [{ item: 'farmersdelight:cooking_pot' }]
        },
        {
          key: 'crops',
          title: 'New Crops',
          after: ['knife'],
          tier: 2,
          desc: ['Wild tomatoes, cabbages, onions and rice grow around the world. Replant them at home.'],
          tasks: [
            { item: 'farmersdelight:tomato' },
            { item: 'farmersdelight:cabbage' },
            { item: 'farmersdelight:onion' },
            { item: 'farmersdelight:rice' }
          ],
          icon: 'farmersdelight:tomato'
        },
        {
          key: 'rich_soil',
          title: 'Rich Soil',
          after: ['crops'],
          tier: 2,
          tasks: [{ item: 'farmersdelight:rich_soil', count: 16 }]
        },
        {
          key: 'automated',
          title: 'Automated Kitchen',
          after: ['pot', 'board'],
          tier: 3,
          desc: ['Slice & Dice adds a slicer and sprinklers; Central Kitchen lets Create machines run cooking pots and cutting boards.'],
          tasks: [
            { item: 'sliceanddice:slicer' },
            { item: 'sliceanddice:sprinkler' }
          ],
          icon: 'sliceanddice:slicer'
        },
        {
          key: 'feast',
          title: 'Feast',
          after: ['pot'],
          tier: 3,
          tasks: [{ item: 'farmersdelight:shepherds_pie_block' }]
        },
        {
          key: 'breeding',
          title: 'Herd',
          after: ['crops'],
          tier: 1,
          tasks: [{ advancement: 'minecraft:husbandry/breed_an_animal' }],
          icon: 'minecraft:wheat'
        },
        {
          key: 'happy_ghast',
          title: 'Happy Ghast',
          after: ['breeding', 'feast'],
          shape: 'gear',
          size: 1.5,
          tier: 4,
          desc: [
            'A dried ghast placed in water slowly revives into a ghastling, and grows into a gentle happy ghast. Saddle it with a harness and it will carry up to four players.',
            tip('The friendliest way to fly before you have an airship.'),
            '',
            '&eChapter prize:&r a harness, a feast and a roll on the Master\'s Cache.'
          ],
          tasks: [
            { item: 'minecraft:dried_ghast' },
            { item: 'minecraft:white_harness' }
          ],
          icon: 'minecraft:dried_ghast',
          reward: { items: [{ item: 'minecraft:white_harness' }, { item: 'farmersdelight:roast_chicken_block' }] }
        }
      ]
    },
    {
      key: 'bestiary',
      group: 'guides',
      title: 'Bestiary',
      subtitle: 'New faces, old foes.',
      about: 'The world has new creatures and tougher bosses. Track down each one.',
      unlocksLabel: 'Rewards',
      unlocks: 'a crate for every first encounter, and tips on what each creature does.',
      icon: 'minecraft:creeper_head',
      layout: 'grid',
      quests: [
        {
          key: 'creepers',
          title: 'Creepers of Every Kind',
          tier: 2,
          desc: ['Creepers now match their biome, and each variant has its own trick.'],
          tasks: [
            { kill: 'creeperoverhaul:desert_creeper' },
            { kill: 'creeperoverhaul:jungle_creeper' },
            { kill: 'creeperoverhaul:snowy_creeper' },
            { kill: 'creeperoverhaul:cave_creeper' }
          ],
          icon: 'minecraft:creeper_head'
        },
        {
          key: 'variants',
          title: 'Undead Variants',
          tier: 2,
          desc: ['Zombies and skeletons adapt to their homes: frozen gelids, swamp murks, jungle thickets.'],
          tasks: [
            { kill: 'variantsandventures:gelid' },
            { kill: 'variantsandventures:murk' },
            { kill: 'variantsandventures:thicket' }
          ],
          icon: 'minecraft:zombie_head'
        },
        {
          key: 'iceologer',
          title: 'The Iceologer',
          tier: 2,
          desc: ['An illager who throws ice. Look for it in the cold.'],
          tasks: [{ kill: 'friendsandfoes:iceologer' }],
          icon: 'minecraft:ice'
        },
        {
          key: 'illusioner',
          title: 'The Illusioner',
          tier: 2,
          tasks: [{ kill: 'friendsandfoes:illusioner' }],
          icon: 'minecraft:bow'
        },
        {
          key: 'wildfire',
          title: 'Wildfire',
          tier: 4,
          desc: ['A blaze queen shielded by a ring of fire. She lives in the Nether citadels. Bring fire resistance.'],
          tasks: [{ kill: 'friendsandfoes:wildfire' }],
          icon: 'minecraft:fire_charge'
        },
        {
          key: 'breeze',
          title: 'Breeze',
          tier: 2,
          desc: ['Found in trial chambers deep underground.'],
          tasks: [{ kill: 'minecraft:breeze', count: 2 }],
          icon: 'minecraft:wind_charge'
        },
        {
          key: 'friends',
          title: 'Friends',
          tier: 2,
          desc: [
            'Not everything wants to fight. Meet a moobloom, a glare and a rascal, and the wildlife of the world: bears, deer, snails, butterflies.',
            tip('Glares point out dark places where mobs can spawn.')
          ],
          tasks: [{ checkmark: true, title: 'I made some friends' }],
          icon: 'minecraft:poppy'
        },
        {
          key: 'creaking',
          title: 'The Creaking',
          tier: 3,
          desc: ['In the pale garden, something only moves when you look away. Break its heart to stop it.'],
          tasks: [{ item: 'minecraft:creaking_heart' }],
          icon: 'minecraft:creaking_heart'
        },
        {
          key: 'mauler',
          title: 'It Bites',
          tier: 3,
          desc: ['Maulers lurk in deserts, savannas and badlands. They steal enchantments, and killing one gives some back.'],
          tasks: [{ advancement: 'friendsandfoes:adventure/it_bites', title: 'Kill a mauler' }],
          icon: 'minecraft:rotten_flesh'
        },
        {
          key: 'elder_guardian',
          title: 'The Elder Guardian',
          tier: 4,
          desc: ['Three of them guard every ocean monument. Mining Fatigue is their welcome.'],
          tasks: [{ kill: 'minecraft:elder_guardian' }],
          icon: 'minecraft:prismarine_shard'
        }
      ]
    },
    {
      key: 'atlas',
      group: 'guides',
      title: 'Atlas',
      subtitle: 'A world worth crossing by rail.',
      about: 'Terralith biomes and rebuilt structures are worth the trip. Visit each landmark once.',
      unlocksLabel: 'Rewards',
      unlocks: 'a crate for exploring, and a head start on where to lay rail lines.',
      icon: 'minecraft:filled_map',
      layout: 'grid',
      quests: [
        { key: 'cherry', title: 'Cherry Grove', tier: 1, tasks: [{ biome: 'minecraft:cherry_grove' }], icon: 'minecraft:cherry_sapling' },
        { key: 'pale', title: 'Pale Garden', tier: 2, tasks: [{ biome: 'minecraft:pale_garden' }], icon: 'minecraft:pale_oak_sapling' },
        { key: 'moonlight', title: 'Moonlight Grove', tier: 2, tasks: [{ biome: 'terralith:moonlight_grove' }], icon: 'minecraft:spruce_sapling' },
        { key: 'yellowstone', title: 'Yellowstone', tier: 2, tasks: [{ biome: 'terralith:yellowstone' }], icon: 'minecraft:yellow_terracotta' },
        { key: 'volcanic', title: 'Volcanic Peaks', tier: 2, tasks: [{ biome: 'terralith:volcanic_peaks' }], icon: 'minecraft:basalt' },
        { key: 'mirage', title: 'Mirage Isles', tier: 2, tasks: [{ biome: 'terralith:mirage_isles' }], icon: 'minecraft:prismarine' },
        { key: 'skylands', title: 'Skylands', tier: 3, desc: ['Islands floating high above the clouds. Easier to reach by airship.'], tasks: [{ biome: '#lemursaucepacket:skylands' }], icon: 'minecraft:grass_block' },
        { key: 'amethyst', title: 'Amethyst Canyon', tier: 2, tasks: [{ biome: 'terralith:amethyst_canyon' }], icon: 'minecraft:amethyst_cluster' },
        { key: 'lavender', title: 'Lavender Valley', tier: 1, tasks: [{ biome: 'terralith:lavender_valley' }], icon: 'minecraft:lilac' },
        { key: 'sakura', title: 'Sakura Valley', tier: 1, tasks: [{ biome: 'terralith:sakura_valley' }], icon: 'minecraft:pink_petals' },
        { key: 'tavern', title: 'A Warm Tavern', tier: 2, desc: ['Taverns sit along the roads. Travellers trade here.'], tasks: [{ structure: '#lemursaucepacket:taverns' }], icon: 'minecraft:barrel' },
        { key: 'monument', title: 'Ocean Monument', tier: 3, tasks: [{ structure: 'betteroceanmonuments:ocean_monument' }], icon: 'minecraft:prismarine_bricks' },
        { key: 'desert_temple', title: 'Desert Temple', tier: 2, tasks: [{ structure: 'betterdeserttemples:desert_temple' }], icon: 'minecraft:sandstone' },
        { key: 'jungle_temple', title: 'Jungle Temple', tier: 2, tasks: [{ structure: 'betterjungletemples:jungle_temple' }], icon: 'minecraft:mossy_cobblestone' },
        { key: 'trial', title: 'Trial Chambers', tier: 3, tasks: [{ structure: 'minecraft:trial_chambers' }], icon: 'minecraft:trial_key' },
        { key: 'mage_tower', title: 'Mage Tower', tier: 2, desc: ['Terralith\'s mage towers change with the season they were built in.'], tasks: [{ structure: '#terralith:mage_towers' }], icon: 'minecraft:amethyst_shard' },
        { key: 'glacial_chasm', title: 'Glacial Chasm', tier: 3, tasks: [{ biome: 'terralith:glacial_chasm' }], icon: 'minecraft:blue_ice' },
        { key: 'ancient_sands', title: 'Ancient Sands', tier: 2, tasks: [{ biome: 'terralith:ancient_sands' }], icon: 'minecraft:red_sand' },
        { key: 'emerald_peaks', title: 'Emerald Peaks', tier: 2, tasks: [{ biome: 'terralith:emerald_peaks' }], icon: 'minecraft:emerald' },
        { key: 'mansion', title: 'Woodland Mansion', tier: 4, tasks: [{ structure: 'minecraft:mansion' }], icon: 'minecraft:dark_oak_log' }
      ]
    },
    {
      key: 'commerce',
      group: 'guides',
      title: 'Coin & Commerce',
      subtitle: 'Gold Coins, vendors and trading.',
      about: 'Every quest pays Gold Coins. The vendors in the towns sell their own goods for them and buy anything you bring; other players trade with you through the trade window.',
      unlocks: "a purse that grows with your factory, and the coins to buy what you can't make yet.",
      icon: coinsIcon(1000),
      quests: [
        {
          key: 'coins',
          title: 'Coinage',
          tier: 1,
          desc: [
            'Gold Coins are the one currency. However many you have, they are one stack: the slot shows &e2.3k&r and the tooltip the exact amount.',
            '',
            '• Right-click a coin stack in your inventory to take half, or &eShift + right-click&r to take an exact amount.',
            '• Coins you pick up join the stack you already carry.',
            '• Mission rewards come as &eCoin Pouches&r: right-click one to open it.',
            '',
            tip('/purse tells you how many coins you carry.')
          ],
          tasks: [{ item: 'lsp_fixes:gold_coins' }],
          icon: coinsIcon(25)
        },
        {
          key: 'first_sale',
          title: 'Sold!',
          after: ['coins'],
          tier: 1,
          desc: [
            'Every vendor buys everything. Open any shop (right-click a trader in a town) and click something in your inventory to sell it; shift-click sells every stack of it.',
            '',
            'The tooltip shows what a thing fetches, and /worth tells you for what you hold. Sold the wrong thing? The hopper slot buys it back.'
          ],
          tasks: [{ stage: 'econ_sold', title: 'Sell something to a vendor', icon: 'minecraft:hopper' }],
          icon: 'minecraft:hopper'
        },
        {
          key: 'first_buy',
          title: 'Shopping',
          after: ['coins'],
          tier: 1,
          desc: ['Each vendor sells their own line: the baker bread and pies, the smith tools and weapons, the mason building blocks. Click a good to buy one lot, shift-click for a stack.'],
          tasks: [{ stage: 'econ_bought', title: 'Buy something from a vendor', icon: 'minecraft:bread' }],
          icon: 'minecraft:bread'
        },
        {
          key: 'trade',
          title: 'Fair Trade',
          after: ['coins'],
          tier: 2,
          desc: [
            '&e/trade <player>&r, or sneak and right-click them with an empty hand. When they ask you back, the trade window opens.',
            '',
            'Click things in your inventory to put them up, the gold button to add coins, then accept. Any change restarts a short deal timer, so nothing can be swapped at the last second.'
          ],
          tasks: [{ stage: 'econ_traded', title: 'Trade with another player', icon: 'minecraft:lime_terracotta' }],
          icon: 'minecraft:lime_terracotta'
        },
        {
          key: 'table_cloth',
          title: 'Open for Business',
          after: ['coins'],
          tier: 2,
          desc: ["Create's table cloths sell while you're away: lay one out, put items up and name a price in any item you like."],
          tasks: [{ advancement: 'create:table_cloth_shop', title: 'Sell items on a table cloth' }],
          icon: 'create:white_table_cloth'
        },
        {
          key: 'purse_10k',
          title: 'Deep Pockets',
          after: ['first_sale', 'first_buy'],
          tier: 3,
          desc: ['Hold 10,000 coins at once.'],
          tasks: [{ stage: 'econ_purse_10k', title: 'Hold 10,000 coins', icon: coinsIcon(1000) }],
          icon: coinsIcon(1000)
        },
        {
          key: 'crown',
          title: '&aA Fortune',
          after: ['purse_10k', 'trade'],
          shape: 'gear',
          size: 1.5,
          tier: 4,
          desc: ['Hold 100,000 coins at once. Quests pay them, vendors buy anything, and a factory never sleeps.', '', "&eChapter prize:&r 10,000 coins and a roll on the Master's Cache."],
          tasks: [{ stage: 'econ_purse_100k', title: 'Hold 100,000 coins', icon: coinsIcon(10000) }],
          icon: coinsIcon(10000),
          reward: { coins: 10000 }
        }
      ]
    },
    {
      key: 'armory',
      group: 'guides',
      title: 'The Armory',
      subtitle: "The pack's own gear: tools that save time, weapons with real stats, armour sets with bonuses.",
      about: 'Everything here is made with Create and gated by skills. Tooltips show the stats and how to get each piece; JEI (R on an item) has the recipe and an info page with the same text.',
      unlocks: 'a tree-felling axe, a 3x3 pickaxe, an auto-smelting pickaxe, a scythe, a wand, and five armour sets.',
      icon: 'lemursaucepacket:brass_sabre',
      quests: [
        {
          key: 'rules',
          title: 'How Gear Works',
          tier: 1,
          desc: [
            '• Every piece has &estats&r in its tooltip: damage, crit chance, crit damage, defense, speed, luck.',
            '• A &efull set&r (all four pieces) adds a bonus; some pieces have a perk on their own.',
            '• A set plus one specific &dRelics&r item is a &esynergy&r: stronger than either alone.',
            '• Recipes are Create mechanical crafting and compacting. Some pieces only drop in dungeons.',
            '• Each piece needs a skill level. Item tooltips say which.'
          ],
          tasks: [{ checkmark: true, title: 'Understood' }],
          icon: 'lemursaucepacket:compacted_diamond'
        },
        {
          key: 'lumber_axe',
          title: 'Lumber Axe',
          after: ['rules'],
          tier: 3,
          desc: ['Iron sheets, andesite alloy and a mechanical saw in the mechanical crafter. Chop one log and the whole tree comes down.', tip('Needs Woodcutting 30.')],
          tasks: [{ item: 'lemursaucepacket:lumber_axe' }]
        },
        {
          key: 'prospectors_pickaxe',
          title: "Prospector's Pickaxe",
          after: ['lumber_axe'],
          tier: 3,
          desc: ['A blaze burner in the head: ores come out already smelted.', tip('Needs Mining 30.')],
          tasks: [{ item: 'lemursaucepacket:prospectors_pickaxe' }]
        },
        {
          key: 'excavators_pickaxe',
          title: "Excavator's Pickaxe",
          after: ['prospectors_pickaxe'],
          tier: 4,
          desc: ['A mechanical drill and brass: mines a 3x3. Sneak to mine one block.', tip('Needs Mining 40.')],
          tasks: [{ item: 'lemursaucepacket:excavators_pickaxe' }]
        },
        {
          key: 'harvesters_scythe',
          title: "Harvester's Scythe",
          after: ['lumber_axe'],
          tier: 3,
          desc: ['A mechanical harvester on a handle. Right-click a ripe crop: a 5x5 is harvested and replanted.', tip('Needs Farming 30.')],
          tasks: [{ item: 'lemursaucepacket:harvesters_scythe' }]
        },
        {
          key: 'builders_wand',
          title: "Builder's Wand",
          after: ['harvesters_scythe'],
          tier: 4,
          desc: ['Brass, a precision mechanism and a schematicannon. Right-click a block face to extend it with matching blocks from your inventory, up to 32 at a time.', tip('Needs Crafting 30.')],
          tasks: [{ item: 'lemursaucepacket:builders_wand' }]
        },
        {
          key: 'brass_sabre',
          title: 'Brass Sabre',
          after: ['rules'],
          tier: 3,
          desc: ['Fast, with +10% crit chance. Brass ingots and a sturdy sheet.', tip('Needs Attack 25.')],
          tasks: [{ item: 'lemursaucepacket:brass_sabre' }]
        },
        {
          key: 'sturdy_warhammer',
          title: 'Sturdy Warhammer',
          after: ['brass_sabre'],
          tier: 4,
          desc: ['Slow and heavy, and it sends things flying. Sturdy sheets and a precision mechanism.', tip('Needs Attack 45.')],
          tasks: [{ item: 'lemursaucepacket:sturdy_warhammer' }]
        },
        {
          key: 'stormcallers_sabre',
          title: "Stormcaller's Sabre",
          after: ['sturdy_warhammer'],
          tier: 5,
          desc: ['No recipe. It waits in pillager outposts and Dungeons Arise chests; one hit in ten shocks the target.', tip('Needs Attack 50.')],
          tasks: [{ item: 'lemursaucepacket:stormcallers_sabre' }]
        },
        {
          key: 'anglers_cap',
          title: "Angler's Cap",
          after: ['rules'],
          tier: 2,
          desc: ['Leather and a fishing rod. +2 Luck: better catches, better loot.', tip('Needs Fishing 25.')],
          tasks: [{ item: 'lemursaucepacket:anglers_cap' }]
        },
        {
          key: 'prospector_set',
          title: "Prospector's Set",
          after: ['anglers_cap'],
          tier: 4,
          desc: ['Brass casings, andesite alloy and a lantern. The lamp alone gives Night Vision underground; the full set gives Haste and a chance of double ore drops.', tip('Needs Mining 35. With the Clot of Time relic: Haste II.')],
          tasks: [
            { item: 'lemursaucepacket:prospector_helmet' },
            { item: 'lemursaucepacket:prospector_chestplate' },
            { item: 'lemursaucepacket:prospector_leggings' },
            { item: 'lemursaucepacket:prospector_boots' }
          ]
        },
        {
          key: 'aeronaut_set',
          title: "Aeronaut's Set",
          after: ['prospector_set'],
          tier: 4,
          desc: ['Leather, sturdy sheets and propeller bearings. The boots alone cancel fall damage; the full set makes you faster, lets you step up whole blocks and swim faster.', tip('Needs Agility 40. With the Kinetic Belt relic: faster still.')],
          tasks: [
            { item: 'lemursaucepacket:aeronaut_helmet' },
            { item: 'lemursaucepacket:aeronaut_chestplate' },
            { item: 'lemursaucepacket:aeronaut_leggings' },
            { item: 'lemursaucepacket:aeronaut_boots' }
          ]
        },
        {
          key: 'duelist_set',
          title: 'Brass Duelist Set',
          after: ['aeronaut_set'],
          tier: 5,
          desc: ["Brass sheets, precision mechanisms and a Duelist's Pattern per piece. Patterns only drop in Dungeons Arise, stronghold and ancient city chests. Every piece adds crit chance; the full set adds crit damage.", tip('Needs Attack 40. With the Ring of the Seven Deadly Sins relic: more crit damage.')],
          tasks: [
            { item: 'lemursaucepacket:duelist_helmet' },
            { item: 'lemursaucepacket:duelist_chestplate' },
            { item: 'lemursaucepacket:duelist_leggings' },
            { item: 'lemursaucepacket:duelist_boots' }
          ]
        },
        {
          key: 'compacted_diamond',
          title: 'Compacted Diamond',
          after: ['rules'],
          tier: 3,
          desc: ['Four diamonds in a basin under a mechanical press.'],
          tasks: [{ item: 'lemursaucepacket:compacted_diamond', count: 4 }]
        },
        {
          key: 'compacted_diamond_set',
          title: 'Compacted Diamond Set',
          after: ['compacted_diamond'],
          tier: 5,
          desc: ['Compacted diamond, sturdy sheets and precision mechanisms. Bulwark: the full set takes 10% less damage from everything.', tip('Needs Defence 45.')],
          tasks: [
            { item: 'lemursaucepacket:compacted_diamond_helmet' },
            { item: 'lemursaucepacket:compacted_diamond_chestplate' },
            { item: 'lemursaucepacket:compacted_diamond_leggings' },
            { item: 'lemursaucepacket:compacted_diamond_boots' }
          ]
        },
        {
          key: 'compacted_netherite_set',
          title: '&aCompacted Netherite Set',
          after: ['compacted_diamond_set'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Four netherite ingots compacted under a heated press, then smithed over compacted diamond. +4 hearts and Bulwark. The last armour you will need.', tip('Needs Defence 60.'), '', "&eChapter prize:&r the Armory Cape, 40,000 coins, a relic and two rolls on the Legend's Hoard."],
          tasks: [
            { item: 'lemursaucepacket:compacted_netherite_helmet' },
            { item: 'lemursaucepacket:compacted_netherite_chestplate' },
            { item: 'lemursaucepacket:compacted_netherite_leggings' },
            { item: 'lemursaucepacket:compacted_netherite_boots' }
          ],
          reward: { commands: ['lsp cape flag {p} chapter:armory'], coins: 40000, tables: ['relic_cache', 'legends_hoard'] }
        },
        {
          key: 'ember_crown',
          title: 'Ember Crown',
          after: ['compacted_diamond'],
          tier: 5,
          desc: ['No recipe: Nether fortress and bastion chests. Fire Resistance while worn, and +1 damage.', tip('Needs Defence 40.')],
          tasks: [{ item: 'lemursaucepacket:ember_crown' }]
        }
      ]
    },
    {
      key: 'hearts',
      group: 'guides',
      title: 'Hearts & Graves',
      subtitle: 'Every death costs a heart. Run out and everything you built goes with you.',
      about: 'You start with ten hearts and lose one every time you die, dropped where you fell for anyone to take. Graves cost Grave Essence, compasses find what you dropped, and a new Heart is the hardest thing in the pack to make.',
      unlocks: 'graves that keep your items, compasses for what you lost, a spare Heart for a friend, and the recipe that makes hearts from a Heart of the Sea.',
      icon: 'lemursaucepacket:heart',
      quests: [
        {
          key: 'rules',
          title: 'The Rules of the Heart',
          tier: 1,
          desc: [
            '• You have &c10 hearts&r, plus one per ten Hitpoints levels. &e/hearts&r shows the count.',
            '• Every death costs one. It drops as a &cHeart&r item where you fell, and anyone can take and use it.',
            '• New players, and the same killer within 30 minutes, cost you nothing.',
            '• &cAt zero hearts you are eliminated.&r The death screen asks you to confirm it, and that erases &leverything you ever placed and everything you own&r, in every chest and machine on the server. Wait instead: a friend holding a Heart can bring you back with &e/revive <your name>&r.',
            '• A grave only appears if you carry &eGrave Essence&r. Your Heart is never inside it.',
            '',
            tip('The wiki page "Hearts, graves and elimination" has every number.')
          ],
          tasks: [{ checkmark: true, title: 'I know what a death costs' }],
          icon: 'gravestone:gravestone'
        },
        {
          key: 'essence',
          title: 'Grave Essence',
          after: ['rules'],
          tier: 2,
          desc: ['Soul sand, a bone block and two experience nuggets, mixed over a blaze burner: two Grave Essence. A few also lie in dungeon and ancient city chests.'],
          tasks: [{ item: 'lemursaucepacket:grave_essence' }]
        },
        {
          key: 'stocked',
          title: 'Three in the Pocket',
          after: ['essence'],
          tier: 2,
          desc: ['Keep a small stack on you. It counts in your inventory, hotbar, off-hand or a backpack you carry, and one is used per death.'],
          tasks: [{ item: 'lemursaucepacket:grave_essence', count: 3 }],
          reward: { items: [{ item: 'lemursaucepacket:grave_essence', count: 2 }] }
        },
        {
          key: 'lost_item_compass',
          title: 'Lost Item Compass',
          after: ['stocked'],
          tier: 3,
          desc: ['Mechanical crafters: a compass, three ender pearls, four polished rose quartz and a brass sheet. Right-click it to pick one of your dropped items; the needle points at it anywhere in the dimension.'],
          tasks: [{ item: 'lemursaucepacket:lost_item_compass' }]
        },
        {
          key: 'seekers_compass',
          title: "Seeker's Compass",
          after: ['lost_item_compass'],
          tier: 4,
          desc: ['The Lost Item Compass, a sculk sensor, two comparators and a precision mechanism. Its switch adds &eanything&r: it also points at chests and players holding your item, without saying which.'],
          tasks: [{ item: 'lemursaucepacket:seekers_compass' }]
        },
        {
          key: 'heart',
          title: "Someone's Second Chance",
          after: ['essence'],
          hidden: true,
          tier: 3,
          desc: ['Hold a Heart. Yours from a death you walked back to, or one you took from someone else. Right-click to use it, or keep it for a friend who needs &e/revive&r.'],
          tasks: [{ item: 'lemursaucepacket:heart' }]
        },
        {
          key: 'heart_of_the_sea',
          title: 'Heart of the Sea',
          after: ['stocked'],
          tier: 3,
          desc: ['Buried treasure only, one per chest; treasure maps come from shipwrecks and ocean ruins. Every new Heart starts with one.'],
          tasks: [{ item: 'minecraft:heart_of_the_sea' }]
        },
        {
          key: 'incomplete',
          title: 'Heart in Progress',
          after: ['heart_of_the_sea'],
          tier: 4,
          desc: ['Sequenced assembly on the Heart of the Sea, five stations: deploy a compacted diamond, deploy a nether star, fill with 1000 mB of liquid experience, deploy a totem of undying, press. The unfinished piece looks like this.'],
          tasks: [{ item: 'lemursaucepacket:incomplete_heart' }]
        },
        {
          key: 'new_heart',
          title: '&aA New Heart',
          after: ['incomplete', 'seekers_compass'],
          shape: 'gear',
          size: 1.75,
          tier: 5,
          desc: ['Finish the assembly. Hearts are otherwise only ever moved between players; this is the one way to make one.', '', "&eChapter prize:&r a Heart, and a roll on the Legend's Hoard."],
          tasks: [{ item: 'lemursaucepacket:heart' }],
          reward: { items: [{ item: 'lemursaucepacket:heart' }] }
        }
      ]
    },

    // ================================================================= MASTERY
    {
      key: 'skills',
      group: 'mastery',
      title: 'Skills',
      subtitle: 'Fourteen skills, five milestones each, and the total-level ladder.',
      about: 'Every skill pays out at 10, 25, 50, 75 and 99. The server checks your Project MMO levels every few seconds and completes the milestones for you; the rewards wait here to be claimed. Level 99 comes with a skill cape and a sun coin.',
      unlocksLabel: 'Rewards',
      unlocks: 'crates that grow with the level, a prize built for the skill at 50 and 75, and 40,000 coins, a relic and the Legend\'s Hoard at 99.',
      icon: textureIcon('skills/total_level'),
      quests: skillsChapter()
    },
    {
      key: 'contracts',
      group: 'mastery',
      title: 'Contracts',
      subtitle: 'Brassworks Missions: six jobs a week, paid in coin pouches.',
      about: 'Press H for the mission board. Missions are Create jobs: press this, mix that, deliver the other. Each pays Coin Pouches on its own (right-click one: 100 coins; rerolls cost pouches); these quests pay again for keeping at it.',
      unlocksLabel: 'Rewards',
      unlocks: 'a crate at 10, 50, 100, 250 and 500 missions, and the Legendary Fixer prize at 1000.',
      icon: 'minecraft:writable_book',
      quests: [
        {
          key: 'board',
          title: 'The Mission Board',
          tier: 1,
          desc: ['Press &eH&r. Six missions a week, refreshed on a timer. Pick the ones your factory already does.'],
          tasks: [{ checkmark: true, title: 'I opened the board' }],
          icon: 'minecraft:writable_book'
        },
        {
          key: 'missions_10',
          title: 'Budding Contractor',
          after: ['board'],
          tier: 2,
          tasks: [{ advancement: 'brassworksmissions:missions_10', title: 'Complete 10 missions' }],
          icon: coinsIcon(100)
        },
        {
          key: 'missions_50',
          title: 'Seasoned Agent',
          after: ['missions_10'],
          tier: 3,
          tasks: [{ advancement: 'brassworksmissions:missions_50', title: 'Complete 50 missions' }],
          icon: coinsIcon(250)
        },
        {
          key: 'missions_100',
          title: 'Expert Operative',
          after: ['missions_50'],
          tier: 4,
          tasks: [{ advancement: 'brassworksmissions:missions_100', title: 'Complete 100 missions' }],
          icon: coinsIcon(1000)
        },
        {
          key: 'missions_250',
          title: 'Master of Contracts',
          after: ['missions_100'],
          tier: 4,
          tasks: [{ advancement: 'brassworksmissions:missions_250', title: 'Complete 250 missions' }],
          icon: coinsIcon(10000),
          reward: { coins: 5000, tables: ['relic_cache'] }
        },
        {
          key: 'missions_500',
          title: 'Mission Virtuoso',
          after: ['missions_250'],
          tier: 5,
          tasks: [{ advancement: 'brassworksmissions:missions_500', title: 'Complete 500 missions' }],
          icon: coinsIcon(10000),
          reward: { coins: 10000 }
        },
        {
          key: 'missions_1000',
          title: '&6Legendary Fixer',
          after: ['missions_500'],
          shape: 'gear',
          size: 1.6,
          tier: 5,
          desc: ['A thousand missions. Years of contracts.', '', "&eChapter prize:&r 80,000 coins, a relic and two rolls on the Legend's Hoard."],
          tasks: [{ advancement: 'brassworksmissions:missions_1000', title: 'Complete 1000 missions' }],
          icon: coinsIcon(10000),
          reward: { coins: 80000, tables: ['relic_cache', 'legends_hoard'] }
        }
      ]
    }
  ]
}
