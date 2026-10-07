// LemurSaucePacket capes: cosmetics you earn, not items. Edit this file, then run `node capes/build.mjs`
// (publish.mjs does). It is the single source for the cape list the server and client scripts read
// (pack/config/lemursaucepacket/capes.json), the wiki page docs/capes.md, and the art cut in art/process.mjs.
//
// Unlocks:  { type: 'skill', skill, level }        one skill reaching a level
//           { type: 'all_skills', level }            every skill at that level
//           { type: 'advancement', id }              a vanilla advancement
//           { type: 'flags', flags: [...] }          flags set by quest rewards (`lsp cape flag {p} <flag>`)
//           { type: 'flags_prefix', prefix, count }  that many flags starting with the prefix
//           { type: 'command' }                      only `/lsp cape unlock <player> <id>` (the owner)
// Perks are what the cape does while worn (pack/kubejs/server_scripts/capes.js implements them):
//   stats { critChance, critDamage }   attributes { armor, toughness, health, speed, luck, breakSpeed }
//   effects [{ effect, amplifier }]     special: 'log_xp' | 'double_crops' | 'eat_heal' | 'mend'
// `design` describes the cape's front (drawn as pixel art in art/capes-px.mjs). `animated` capes get that many
// frames of pixel animation (art/capes-px.mjs LEGENDARY), stepped by the client every few ticks.

export const NAMESPACE = 'lemursaucepacket'

const skillCape = (skill, name, design, perk, perkText) => ({
  id: `${skill}_cape`,
  name,
  kind: 'skill',
  unlock: { type: 'skill', skill, level: 99 },
  perk,
  perkText,
  description: `${name.replace(' Cape', '')} 99.`,
  design
})

export const CAPES = [
  // Skill capes: one per skill at level 99, each with a perk.
  skillCape('attack', 'Attack Cape', 'crossed iron swords over a red field', { stats: { critChance: 0.05 } }, '+5% crit chance'),
  skillCape('strength', 'Strength Cape', 'a brass gauntlet fist over a dark red field', { stats: { critDamage: 0.1 } }, '+10% crit damage'),
  skillCape('defence', 'Defence Cape', 'a round iron shield with a brass boss over a blue field', { attributes: { armor: 2 } }, '+2 armour'),
  skillCape('ranged', 'Ranged Cape', 'a brass bow and arrow over a green field', { stats: { critChance: 0.05 } }, '+5% crit chance'),
  skillCape('hitpoints', 'Hitpoints Cape', 'a red heart in a brass frame over a crimson field', { attributes: { health: 2 } }, '+1 heart'),
  skillCape('mining', 'Mining Cape', 'a crossed pickaxe and lantern over a slate grey field', { attributes: { breakSpeed: 0.15 } }, '+15% dig speed'),
  skillCape('woodcutting', 'Woodcutting Cape', 'an axe in an oak stump over a forest green field', { special: 'log_xp' }, '+25% Woodcutting XP from logs'),
  skillCape('farming', 'Farming Cape', 'a golden wheat sheaf over a brown field', { special: 'double_crops' }, '20% chance of double crop drops'),
  skillCape('fishing', 'Fishing Cape', 'a fish on a hook over a sea blue field', { attributes: { luck: 3 } }, '+3 luck'),
  skillCape('cooking', 'Cooking Cape', 'a steaming cauldron over an orange field', { special: 'eat_heal' }, 'eating heals 2 extra hearts'),
  skillCape('smithing', 'Smithing Cape', 'an anvil and hammer over a charcoal field', { attributes: { toughness: 1 } }, '+1 armour toughness'),
  skillCape('crafting', 'Crafting Cape', 'a brass cog over a wooden-plank pattern', { special: 'mend' }, 'the item in your hand mends one durability every ten seconds'),
  skillCape('agility', 'Agility Cape', 'a winged boot over a teal field', { attributes: { speed: 0.1 } }, '+10% speed'),
  skillCape('enchanting', 'Enchanting Cape', 'a gold star over a royal purple field', { special: 'enchant_xp' }, '+20% Enchanting XP'),
  // Quest capes: finishing a chapter's last quest sets a flag.
  { id: 'settlers_cape', name: "Settler's Cape", kind: 'quest', unlock: { type: 'flags', flags: ['chapter:landfall'] }, description: 'Finish the Landfall chapter.', design: 'a small cottage over a plain linen field' },
  { id: 'brass_age_cape', name: 'Brass Age Cape', kind: 'quest', unlock: { type: 'flags', flags: ['chapter:brass_age'] }, description: 'Finish the Brass Age chapter.', design: 'a brass cog with a flame at its heart over a bronze field' },
  { id: 'iron_roads_cape', name: 'Iron Roads Cape', kind: 'quest', unlock: { type: 'flags', flags: ['chapter:iron_roads'] }, description: 'Finish the Iron Roads chapter.', design: 'a steam locomotive front over an iron grey field' },
  { id: 'skyward_cape', name: 'Skyward Cape', kind: 'quest', unlock: { type: 'flags', flags: ['chapter:skyward'] }, description: 'Finish the Skyward chapter.', design: 'a cream airship over a sky blue field with clouds' },
  { id: 'crown_of_fire_cape', name: 'Crown of Fire Cape', kind: 'quest', unlock: { type: 'flags', flags: ['chapter:crown_of_fire'] }, description: 'Finish the Crown of Fire chapter.', design: 'a burning crown over a black field' },
  { id: 'legacy_cape', name: 'Legacy Cape', kind: 'quest', unlock: { type: 'flags', flags: ['chapter:legacy'] }, perk: { attributes: { health: 2 } }, perkText: '+1 heart', description: 'Finish the Legacy chapter.', design: 'a purple dragon egg on a pedestal over a deep purple field' },
  { id: 'armory_cape', name: 'Armory Cape', kind: 'quest', unlock: { type: 'flags', flags: ['chapter:armory'] }, description: 'Finish the Armory chapter.', design: 'a brass sabre crossed with a warhammer over a dark iron field' },
  // Achievement capes: vanilla advancements.
  { id: 'explorer_cape', name: 'Explorer Cape', kind: 'achievement', unlock: { type: 'advancement', id: 'minecraft:adventure/adventuring_time' }, description: 'Visit every Overworld biome (Adventuring Time).', design: 'a brass compass rose over a parchment map field' },
  { id: 'hero_cape', name: 'Hero of the Village Cape', kind: 'achievement', unlock: { type: 'advancement', id: 'minecraft:adventure/hero_of_the_village' }, description: 'Save a village from a raid.', design: 'a brass bell over a green and white striped field' },
  { id: 'beacon_cape', name: 'Beaconeer Cape', kind: 'achievement', unlock: { type: 'advancement', id: 'minecraft:nether/create_full_beacon' }, description: 'Build a full-power beacon.', design: 'a white beam rising from a beacon over a midnight blue field' },
  { id: 'wings_cape', name: 'Wings Cape', kind: 'achievement', unlock: { type: 'advancement', id: 'minecraft:end/elytra' }, description: 'Find an elytra.', design: 'grey elytra wings spread over a pale violet field' },
  // Legendary, animated: the rarest feats.
  { id: 'maxed_cape', name: 'Maxed Cape', kind: 'legendary', animated: 12, unlock: { type: 'all_skills', level: 99 }, perk: { stats: { critChance: 0.05, critDamage: 0.05 }, attributes: { health: 2 } }, perkText: '+5% crit chance, +5% crit damage, +1 heart', description: 'Every skill at 99.', design: 'a radiant brass star with thirteen small stars around it over a black field with gold trim' },
  { id: 'completionist_cape', name: 'Completionist Cape', kind: 'legendary', animated: 12, unlock: { type: 'flags_prefix', prefix: 'chapter:', count: 7 }, perk: { attributes: { speed: 0.1 } }, perkText: '+10% speed', description: 'Every chapter of the quest book finished.', design: 'an open book with a brass cog on its pages over a royal purple field with gold trim' },
  { id: 'dragonslayer_cape', name: 'Dragonslayer Cape', kind: 'legendary', animated: 12, unlock: { type: 'advancement', id: 'minecraft:end/kill_dragon' }, perk: { effects: [{ effect: 'minecraft:fire_resistance', amplifier: 0 }] }, perkText: 'Fire Resistance', description: 'Kill the Ender Dragon.', design: 'a black dragon head breathing purple fire over a dark red field with gold trim' },
  // The Fight Pits and the Inferno (the Kilnfolk's trials): lava that moves.
  { id: 'fire_cape', name: 'Fire Cape', kind: 'legendary', animated: 12, unlock: { type: 'flags', flags: ['pits:fire_cape'] }, perk: { stats: { critDamage: 0.12 }, effects: [{ effect: 'minecraft:fire_resistance', amplifier: 0 }] }, perkText: '+12% crit damage, Fire Resistance', description: 'Defeat the champion of the Fight Pits.', design: 'Minecraft lava pouring down the cloth, edged in obsidian' },
  { id: 'infernal_cape', name: 'Infernal Cape', kind: 'legendary', animated: 12, unlock: { type: 'flags', flags: ['pits:infernal_cape'] }, perk: { stats: { critDamage: 0.2, critChance: 0.05 }, attributes: { health: 2 }, effects: [{ effect: 'minecraft:fire_resistance', amplifier: 0 }] }, perkText: '+20% crit damage, +5% crit chance, +1 heart, Fire Resistance', description: 'Survive the Inferno.', design: 'black obsidian split by glowing cracks of lava that pulse from a molten core' },
  // The owner's.
  { id: 'lemur_cape', name: 'Lemur Cape', kind: 'owner', unlock: { type: 'command' }, description: 'Given by the server owner.', design: 'a cheerful ring-tailed lemur face in a brass cog over a warm brown field' }
]

/** Which chapter's last quest sets which flag (quests/book.mjs adds the command reward). */
export const CHAPTER_FLAGS = { landfall: 'chapter:landfall', brass_age: 'chapter:brass_age', iron_roads: 'chapter:iron_roads', skyward: 'chapter:skyward', crown_of_fire: 'chapter:crown_of_fire', legacy: 'chapter:legacy', armory: 'chapter:armory' }
