// LemurSaucePacket's hiscores, RuneScape style: every skill, the combat level, activities, bosses and collections,
// ranked over everyone who has played on the server. One source for:
//   - the server (pack/config/lemursaucepacket/hiscores.json): what lsp_fixes' hiscores package records for each
//     player, ranks for /hiscores in game, and uploads to the website;
//   - the website (website/assets/hiscores-defs.json): the names, icons and order play.limas.ca/hiscores shows.
// `node hiscores/build.mjs` writes both (publish/publish.mjs runs it).
//
// Item and entity matchers, as elsewhere in the pack: an id, a tag ('#relics:relic'), a whole mod ('@relics') or a
// regex over the id ('~^minecraft:music_disc_.*').

import { QUEST_STEPS } from '../npcs/quests.mjs'

/** The skills, in RuneScape's order where there's one to follow (Enchanting where Magic is, Brewing for Herblore). */
export const SKILLS = [
  'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'enchanting', 'cooking', 'woodcutting',
  'fishing', 'crafting', 'smithing', 'mining', 'brewing', 'agility', 'farming', 'construction'
]

/** Each main quest's quest points (as its page in the quest book says), paid once its last stage tag is set. */
const POINTS = { cooks_assistant: 1, knights_sword: 1, dragon_slayer: 2, dragon_slayer_2: 3, fight_pits: 2, ashes: 2, inferno: 3 }
export const QUEST_POINTS = Object.entries(POINTS).map(([quest, points]) => {
  const steps = QUEST_STEPS[quest]
  if (!steps) throw new Error(`hiscores: no quest ${quest} in npcs/quests.mjs`)
  return { quest: steps.title, tag: steps.stages[steps.stages.length - 1], points }
})

/**
 * Activities. `stat` is a vanilla statistic (minecraft:custom), divided by `divide` (play time is in ticks);
 * the rest lsp_fixes works out: quest points (above), capes earned, quests done in the quest book, and the collection
 * log (every kind of item a player has had).
 */
export const ACTIVITIES = [
  { id: 'quest_points', name: 'Quest points', what: 'Quest points from the main quests' },
  { id: 'capes', name: 'Capes earned', what: 'Capes of every kind: skill, quest and feat capes' },
  { id: 'collection', name: 'Collection log', what: "Every kind of item you've had: held, worn, picked up or crafted" },
  { id: 'quests', name: 'Quest book quests', what: 'Quests finished in the quest book' },
  { id: 'raids', name: 'Raids won', what: 'Villages saved from a raid', stat: 'minecraft:raid_win' },
  { id: 'monsters', name: 'Monsters slain', what: 'Creatures killed, of every kind', stat: 'minecraft:mob_kills' },
  { id: 'players', name: 'Players slain', what: 'Other players killed', stat: 'minecraft:player_kills' },
  { id: 'hours', name: 'Hours played', what: 'Time on the server', stat: 'minecraft:play_time', divide: 72000 }
]

/**
 * Bosses, by kill count: the kill statistics of one or more entities, or a counter lsp_fixes keeps (Elvarg: everyone in
 * the fight when she falls; the Fight Pits and the Inferno: a win, counted by the trial's win commands).
 */
export const BOSSES = [
  { id: 'elvarg', name: 'Elvarg', what: "Elvarg's Lair: everyone in the fight when she falls", counter: true },
  { id: 'fight_pits', name: 'Kiln-Tok-Jad', note: 'Fight Pits wins', what: 'Fight Pits wins', counter: true },
  { id: 'inferno', name: 'Kiln-Kal-Zuk', note: 'Inferno wins', what: 'Inferno wins', counter: true },
  { id: 'ender_dragon', name: 'Ender Dragon', kills: ['minecraft:ender_dragon'] },
  { id: 'wither', name: 'Wither', kills: ['minecraft:wither'] },
  { id: 'warden', name: 'Warden', kills: ['minecraft:warden'] },
  { id: 'elder_guardian', name: 'Elder Guardian', kills: ['minecraft:elder_guardian'] },
  { id: 'invoker', name: 'Invoker', kills: ['illagerinvasion:invoker'] },
  { id: 'dragons', name: 'Ice and Fire dragons', what: 'Fire, ice and lightning dragons slain', kills: ['iceandfire:fire_dragon', 'iceandfire:ice_dragon', 'iceandfire:lightning_dragon'] }
]

/**
 * Collections: the kinds of item a player has had, held (lsp_fixes looks at the bag, armour and Curios every few
 * minutes), picked up or crafted. "Collection log" counts every kind there is; the rest count a set, out of its size.
 */
export const COLLECTIONS = [
  { id: 'relics', name: 'Relics', what: "The Relics mod's artefacts", match: ['#relics:relic'] },
  { id: 'music_discs', name: 'Music discs', what: 'Every music disc', match: ['~^minecraft:music_disc_.*'] },
  { id: 'trims', name: 'Armour trims', what: 'Armour trim smithing templates', match: ['~^minecraft:.*_armor_trim_smithing_template$'] },
  { id: 'sherds', name: 'Pottery sherds', what: 'Pottery sherds from the trail ruins and the rest', match: ['~^minecraft:.*_pottery_sherd$'] },
  { id: 'heads', name: 'Mob heads', what: 'Skeleton, wither skeleton, zombie, creeper, piglin and dragon heads', match: ['minecraft:skeleton_skull', 'minecraft:wither_skeleton_skull', 'minecraft:zombie_head', 'minecraft:creeper_head', 'minecraft:piglin_head', 'minecraft:dragon_head'] }
]

/** How often the server records everyone online, and uploads what changed (seconds). */
export const RECORD_EVERY = 300
export const UPLOAD_EVERY = 600

/** Where the server sends its records: the website's ingest function (signed with the server's own key). */
export const UPLOAD_URL = 'https://play.limas.ca/api/hiscores-ingest'
