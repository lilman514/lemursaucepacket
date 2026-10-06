// The people of Lemurton: Easy NPC presets. `node npcs/build.mjs` writes them to
// pack/kubejs/data/lemursaucepacket/easy_npc/preset/<model>/<id>.npc.snbt; structures/hub.mjs places them
// (shopkeepers and merchants at their buildings' `npc` marks, guards at the gates, the mayor by the waystone).
//
// Dialogs pick themselves: Easy NPC shows the highest-priority dialog whose conditions all pass, and quest steps
// only ever add player tags, so the furthest step wins. Buttons run commands as the NPC: use @initiator for the
// player who clicked. Player tags double as FTB Quests stages (gamestage tasks).
//
// Prices are in spurs (Numismatics: spur 1, bevel 8, sprocket 16, cog 64, crown 512, sun 4096), on the quest
// book's scale (a tier 1 quest pays 8). Shops that buy from players cap how often (maxUses, reset each hour), so a
// farm can't print money.

export const COINS = [
  ['numismatics:sun', 4096],
  ['numismatics:crown', 512],
  ['numismatics:cog', 64],
  ['numismatics:sprocket', 16],
  ['numismatics:bevel', 8],
  ['numismatics:spur', 1]
]

/** A price in spurs as at most two coin stacks (largest coins first); throws if it needs three kinds. */
export function price(spurs) {
  const out = []
  let left = spurs
  for (const [id, v] of COINS) {
    if (left >= v) {
      out.push({ id, count: Math.floor(left / v) })
      left %= v
    }
  }
  if (out.length > 2 || out.some((s) => s.count > 64)) throw new Error(`price ${spurs} needs ${out.length} coin kinds: pick a rounder number`)
  return out
}

// ---------------------------------------------------------------- dialog building blocks

export const cmd = (c) => ({ Type: 'COMMAND', Cmd: c.startsWith('/') ? c : `/${c}` })
export const open = (label) => ({ Type: 'OPEN_NAMED_DIALOG', Cmd: label })
export const tradeScreen = () => ({ Type: 'OPEN_TRADING_SCREEN' })
export const close = () => ({ Type: 'CLOSE_DIALOG' })
export const tag = (t) => ({ Type: 'PLAYER_TAG', Name: t })
/** A dialog button. */
export const button = (name, actions, conditions) => ({ name, actions, conditions })
/** A dialog: `label` is what OPEN_NAMED_DIALOG names; priority -1 means only reachable by name. */
export const dialog = (label, name, text, { priority = -1, buttons = [], conditions } = {}) => ({ label, name, text, priority, buttons, conditions })

const goodbye = button('Goodbye', [close()])

/** The usual shop dialog: a greeting, "let's trade", a line about themselves, goodbye. */
function shopDialogs(greeting, about) {
  return [
    dialog('default', 'Greeting', greeting, { priority: 10, buttons: [button("Let's trade", [tradeScreen()]), button('Tell me about yourself', [open('about')]), goodbye] }),
    dialog('about', 'About', about, { buttons: [button("Let's trade", [tradeScreen()]), goodbye] })
  ]
}

/** A trade: `give` (what the player pays: coin spurs or [item, count]) for `get` ([item, count] or coin spurs). */
export const sell = (item, count, spurs, maxUses = 999) => ({ pay: price(spurs), get: [{ id: item, count }], maxUses })
export const buy = (item, count, spurs, maxUses = 8) => ({ pay: [{ id: item, count }], get: price(spurs), maxUses })

// ---------------------------------------------------------------- the roster

export const NPCS = {
  mayor: {
    model: 'humanoid',
    variant: 'PROFESSOR_01',
    name: 'Mayor Thaddeus',
    color: '#E0AC46',
    description: "Lemurton's mayor: greets newcomers and starts the city's first questline.",
    dialogs: [
      dialog('done', 'Welcome home', 'Lemurton is glad to have you, @initiator.\n\nYour quest book will tell you when someone else here needs a hand, and the waystone will always bring you back.', { priority: 40, conditions: [tag('q_welcome_done')], buttons: [button('Tell me about the city again', [open('about')]), goodbye] }),
      dialog('report', 'A loaf from Bessa', 'You found Bessa at the market, I see. Every coin spent in that square keeps this city fed.\n\nWell done, @initiator. Lemurton is your home now.', {
        priority: 30,
        conditions: [tag('q_welcome_met'), tag('q_welcome_bread')],
        buttons: [button('Glad to help', [cmd('tag @initiator add q_welcome_done'), open('done')])]
      }),
      dialog('market', 'The market', 'Go and see Bessa the Baker: her stall is on the far side of the market, past the great tree. Buy yourself a loaf. Here is a little purse from the city to cover it.', { priority: 20, conditions: [tag('q_welcome_met')], buttons: [goodbye] }),
      dialog('default', 'Welcome', 'Welcome to Lemurton, @initiator! I am Thaddeus, mayor of this fine city.\n\nNo fighting and no building inside the walls; everything else is yours to explore.', {
        priority: 10,
        buttons: [
          button('What is this place?', [open('about')]),
          // Only tags: the purse is the first quest's reward, so it can't be clicked for again and again.
          button('Any work for a newcomer?', [cmd('tag @initiator add q_welcome_met'), open('market')]),
          goodbye
        ]
      }),
      dialog('about', 'About Lemurton', 'Lemurton is the first city of the realm. The waystone under the great tree links the roads you discover; the market and the shops on the ring streets buy and sell for coin; the guards keep the peace.\n\nNobody can build or fight inside the walls, so it is the safest place in the land.', { buttons: [button('Any work for a newcomer?', [cmd('tag @initiator add q_welcome_met'), open('market')]), goodbye] })
    ]
  },

  // Market stalls, keyed by the role on their template's npc mark.
  fruit_seller: { model: 'villager', variant: 'PLAINS_FARMER', name: 'Old Wren', color: '#7FCB5A', description: 'Fruit stall.', dialogs: shopDialogs('Fresh from the fields, @initiator! Apples, melons, berries.', 'I have grown fruit outside the walls for forty years. The soil out there is kinder than people think.'), trades: [sell('minecraft:apple', 4, 3), sell('minecraft:melon_slice', 16, 3), sell('minecraft:sweet_berries', 8, 2), buy('minecraft:melon', 8, 4), buy('minecraft:pumpkin', 8, 4)] },
  baker: { model: 'villager', variant: 'PLAINS_BUTCHER', name: 'Bessa the Baker', color: '#E8B76A', description: 'Bakery stall; buying from her counts for the welcome quest.', dialogs: shopDialogs('Bread, cake and pies, all baked this morning!', 'My oven never cools. If you grow wheat, I will buy it from you.'), trades: [sell('minecraft:bread', 4, 4), sell('minecraft:cookie', 8, 4), sell('minecraft:pumpkin_pie', 2, 6), sell('minecraft:cake', 1, 12), buy('minecraft:wheat', 32, 8)], onTrade: [cmd('tag @initiator add q_welcome_bread')] },
  gem_trader: { model: 'villager', variant: 'DESERT_CLERIC', name: 'Imran the Gem Trader', color: '#B774E0', description: 'Buys gems.', dialogs: shopDialogs('Gems, friend? I buy the good ones.', 'Amethyst from the deep geodes, lapis, emeralds from the far villages: bring them and I pay in honest coin.'), trades: [buy('minecraft:amethyst_shard', 16, 8), buy('minecraft:lapis_lazuli', 16, 8), buy('minecraft:emerald', 4, 16), sell('minecraft:amethyst_shard', 4, 4)] },
  tailor: { model: 'villager', variant: 'PLAINS_SHEPHERD', name: 'Maud the Weaver', color: '#6EA5E0', description: 'Cloth stall.', dialogs: shopDialogs('Wool in every colour, and strong string.', 'My sheep graze by the east gate. The best wool in Lemurton!'), trades: [sell('minecraft:white_wool', 8, 4), sell('minecraft:string', 8, 4), sell('minecraft:white_banner', 1, 6), buy('minecraft:white_wool', 16, 4)] },
  fishmonger: { model: 'villager', variant: 'SWAMP_FISHERMAN', name: 'Gil the Fishmonger', color: '#5EC4C4', description: 'Fish stall.', dialogs: shopDialogs('Cod and salmon, cooked or raw!', 'I fish the river at dawn. Bring me your catch and I pay fair.'), trades: [sell('minecraft:cooked_cod', 4, 6), sell('minecraft:cooked_salmon', 4, 8), buy('minecraft:cod', 16, 4), buy('minecraft:salmon', 16, 6)] },
  spice_merchant: { model: 'villager', variant: 'SAVANNA_LIBRARIAN', name: 'Saffi the Spice Merchant', color: '#E08A3C', description: "Spice stall: Farmer's Delight seeds and sweets.", dialogs: shopDialogs('Seeds from the far south, sugar and cocoa!', 'Cabbage, tomato, onion and rice: plant them and your cooking will never be dull again.'), trades: [sell('farmersdelight:cabbage_seeds', 4, 4), sell('farmersdelight:tomato_seeds', 4, 4), sell('farmersdelight:onion', 4, 4), sell('farmersdelight:rice', 4, 4), sell('minecraft:sugar', 8, 4), sell('minecraft:cocoa_beans', 4, 6)] },

  flower_seller: { model: 'villager', variant: 'TAIGA_FARMER', name: 'Posy the Flower Seller', color: '#E07AB0', description: 'Flower stall.', dialogs: shopDialogs('Flowers for the window box, saplings for the garden!', 'Every cottage in Lemurton has my flowers in its window boxes.'), trades: [sell('minecraft:poppy', 4, 2), sell('minecraft:cornflower', 4, 2), sell('minecraft:oxeye_daisy', 4, 2), sell('minecraft:birch_sapling', 2, 4), sell('minecraft:cherry_sapling', 1, 8), sell('minecraft:bone_meal', 8, 4)] },
  butcher: { model: 'villager', variant: 'SNOW_BUTCHER', name: 'Ragnar the Butcher', color: '#B05A3C', description: 'Butcher stall.', dialogs: shopDialogs('Good meat, fairly priced.', 'Pork, beef, mutton: smoked over applewood, the way my father did it.'), trades: [sell('minecraft:cooked_porkchop', 4, 8), sell('minecraft:cooked_beef', 4, 8), sell('minecraft:cooked_mutton', 4, 6), buy('minecraft:porkchop', 16, 6), buy('minecraft:beef', 16, 6)] },

  // Shops on the ring streets, keyed by template name.
  shop_smithy: { model: 'villager', variant: 'PLAINS_WEAPONSMITH', name: 'Brann the Smith', color: '#C9C9C9', description: 'Smithy.', dialogs: shopDialogs("Steel for honest folk. What'll it be?", 'I learned my craft in the dwarven halls under the mountain. Keep your blade oiled and it will keep you alive.'), trades: [sell('minecraft:stone_sword', 1, 4), sell('minecraft:stone_pickaxe', 1, 4), sell('minecraft:stone_axe', 1, 4), sell('minecraft:shield', 1, 16), sell('minecraft:iron_sword', 1, 48)] },
  shop_tailor: { model: 'villager', variant: 'PLAINS_LEATHERWORKER', name: 'Odo the Tailor', color: '#B48C64', description: 'Tailor.', dialogs: shopDialogs('Leathers and cloth, made to measure.', 'A good coat keeps out more than the cold.'), trades: [sell('minecraft:leather_helmet', 1, 6), sell('minecraft:leather_chestplate', 1, 12), sell('minecraft:leather_leggings', 1, 10), sell('minecraft:leather_boots', 1, 6), buy('minecraft:leather', 8, 8)] },
  shop_apothecary: { model: 'villager', variant: 'PLAINS_CLERIC', name: 'Sister Agnes', color: '#D86AA0', description: 'Apothecary.', dialogs: shopDialogs('Tinctures and tonics for what ails you.', 'I brew by the old recipes. Bring me nether wart and I will teach you more.'), trades: [sell('minecraft:glass_bottle', 4, 4), sell('minecraft:honey_bottle', 2, 8), sell('minecraft:golden_carrot', 2, 16), buy('minecraft:nether_wart', 8, 16)] },
  shop_fishing: { model: 'villager', variant: 'TAIGA_FISHERMAN', name: 'Hamish of the Docks', color: '#4F86C6', description: 'Fishing supplies.', dialogs: shopDialogs('Rods, line and bait!', 'The big ones bite in the rain. Everyone knows that.'), trades: [sell('minecraft:fishing_rod', 1, 10), sell('minecraft:bucket', 1, 12), buy('minecraft:tropical_fish', 4, 8), buy('minecraft:pufferfish', 4, 8)] },
  shop_builder: { model: 'villager', variant: 'PLAINS_MASON', name: 'Gerta the Mason', color: '#A88A6A', description: "Builder's merchant.", dialogs: shopDialogs('Stone, brick and timber, by the stack.', 'Half the houses in this city went up on my bricks.'), trades: [sell('minecraft:stone_bricks', 16, 4), sell('minecraft:bricks', 16, 8), sell('minecraft:oak_planks', 32, 4), sell('minecraft:glass', 16, 6), sell('minecraft:lantern', 4, 8)] },
  shop_jeweller: { model: 'villager', variant: 'PLAINS_LIBRARIAN', name: 'Lucan the Jeweller', color: '#E0C35A', description: 'Jeweller: buys precious things.', dialogs: shopDialogs('Precious things, bought and sold.', 'Gold, diamonds, the rare stones of the deep: I pay more than anyone in the realm.'), trades: [buy('minecraft:gold_ingot', 4, 16), buy('minecraft:diamond', 1, 64), sell('minecraft:gold_nugget', 9, 12)] },
  varrock_general_store: { model: 'villager', variant: 'PLAINS_NITWIT', name: 'Pip the Shopkeeper', color: '#8FBF60', description: 'General store.', dialogs: shopDialogs('Welcome to the general store! A bit of everything.', 'Torches, buckets, seeds, string: whatever you forgot to bring, I have it.'), trades: [sell('minecraft:torch', 8, 2), sell('minecraft:bread', 2, 3), sell('minecraft:wheat_seeds', 8, 2), sell('minecraft:oak_sapling', 4, 4), sell('minecraft:shears', 1, 10), sell('minecraft:map', 1, 12), buy('minecraft:wheat', 16, 4), buy('minecraft:potato', 16, 4)] },

  // Guards and townsfolk.
  guard: { model: 'humanoid', variant: 'KNIGHT_01', name: 'City Guard', color: '#9DB4CC', description: 'Gate guard.', equipment: { mainhand: 'minecraft:iron_sword', offhand: 'minecraft:shield', head: 'minecraft:iron_helmet', chest: 'minecraft:iron_chestplate', legs: 'minecraft:iron_leggings', feet: 'minecraft:iron_boots' }, dialogs: [dialog('default', 'Halt', 'Welcome to Lemurton, @initiator. Keep the peace inside the walls: no fighting, no digging, no building.\n\nThe mayor is by the fountain if you need work.', { priority: 10, buttons: [goodbye] })] },
  townsfolk: { model: 'villager', variant: 'PLAINS_NONE', name: 'Townsfolk', color: '#CFCFCF', description: 'Market square ambience.', wander: true, dialogs: [dialog('default', 'Chatter', 'Lovely day, isn\'t it? They say the old towers to the north hide treasure, if you can climb them.', { priority: 10, buttons: [goodbye] })] }
}

/** The preset id `/easy_npc preset import data` takes for an NPC (npcs/build.mjs writes the files). */
export const presetId = (id, model) => `lemursaucepacket:easy_npc/preset/${model}/lemurton_${id}.npc.snbt`

/** Building (its template, see structures/external.json) -> its shopkeeper. */
export const AT_BUILDING = {
  lgc_plains_worker_weaponsmith: 'shop_smithy',
  lgc_plains_worker_tannery: 'shop_tailor',
  lgc_plains_worker_cleric: 'shop_apothecary',
  lgc_plains_worker_fisherman: 'shop_fishing',
  lgc_plains_worker_mason: 'shop_builder',
  lgc_plains_worker_library_1: 'shop_jeweller',
  lgc_plains_worker_inn: 'varrock_general_store'
}

/** The market square's traders, placed round its stalls in this order. */
export const MARKET_TRADERS = ['baker', 'fruit_seller', 'gem_trader', 'spice_merchant', 'fishmonger', 'tailor', 'flower_seller', 'butcher']
