// The people of Lemurton: Easy NPC presets plus what the lsp_fixes economy needs to know about them. `node npcs/build.mjs`
// writes the presets to pack/kubejs/data/lemursaucepacket/easy_npc/preset/<model>/<id>.npc.snbt and the economy's view
// to pack/kubejs/data/lemursaucepacket/lsp_npcs/<id>.json; structures/hub.mjs places them (shopkeepers and merchants at
// their buildings' `npc` marks, guards at the gates, the mayor by the waystone).
//
// Dialogs pick themselves: Easy NPC shows the highest-priority dialog whose conditions all pass, and quest steps
// only ever add player tags, so the furthest step wins. Buttons run commands as the NPC: use @initiator for the
// player who clicked and @npc-uuid for the NPC. Player tags double as FTB Quests stages (gamestage tasks).
//
// Talking comes first (lsp_fixes, economy/npc): a vendor's first right-click plays their greeting, and a `talks` entry
// (a dialog waiting on quest stages) plays once when its stages line up, each on its own click; after that a
// right-click opens the shop. The shop has a button back to the dialog and shows the vendor's `quests`.
//
// Shops sell their own `goods` for Gold Coins: good(item, count, price) is one lot, a click buys a lot and shift-click
// a stack. Every vendor buys anything at its value (npcs/values.mjs prices raw materials, recipes the rest), never
// more than half of what a vendor charges for it.

// ---------------------------------------------------------------- dialog building blocks

export const cmd = (c) => ({ Type: 'COMMAND', Cmd: c.startsWith('/') ? c : `/${c}` })
export const open = (label) => ({ Type: 'OPEN_NAMED_DIALOG', Cmd: label })
/** Opens this NPC's shop (lsp_fixes): what "Let's trade" buttons run. */
export const shopScreen = () => cmd('lsp shop open @npc-uuid @initiator')
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
    dialog('default', 'Greeting', greeting, { priority: 10, buttons: [button("Let's trade", [shopScreen()]), button('Tell me about yourself', [open('about')]), goodbye] }),
    dialog('about', 'About', about, { buttons: [button("Let's trade", [shopScreen()]), goodbye] })
  ]
}

/** One lot in a shop: `count` of `item` (an id, or { id, components }) for `price` Gold Coins. */
export const good = (item, count, price) => ({ item: typeof item === 'string' ? { id: item } : item, count, price })
const potion = (p) => ({ id: 'minecraft:potion', components: { 'minecraft:potion_contents': { potion: `minecraft:${p}` } } })

/** A quest line as the shop's quest slot shows it: each step is done once the player has its stage tag. */
export const QUESTS = {
  welcome: {
    title: 'Welcome to Lemurton',
    steps: [
      { stage: 'q_lemurton_found', text: 'Find Lemurton' },
      { stage: 'q_welcome_met', text: 'Ask Mayor Thaddeus for work' },
      { stage: 'q_welcome_bread', text: 'Buy something from Bessa the Baker' },
      { stage: 'q_welcome_done', text: 'Report back to the mayor' }
    ]
  }
}

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
  fruit_seller: {
    model: 'villager', variant: 'PLAINS_FARMER', name: 'Old Wren', color: '#7FCB5A', description: 'Fruit and vegetable stall.',
    dialogs: shopDialogs('Fresh from the fields, @initiator! Apples, melons, berries.', 'I have grown fruit outside the walls for forty years. The soil out there is kinder than people think.'),
    goods: [good('minecraft:apple', 1, 8), good('minecraft:melon_slice', 8, 12), good('minecraft:sweet_berries', 8, 15), good('minecraft:glow_berries', 4, 30), good('minecraft:carrot', 4, 12), good('minecraft:potato', 4, 12), good('minecraft:beetroot', 4, 12), good('minecraft:pumpkin', 1, 15), good('minecraft:melon', 1, 25)]
  },
  baker: {
    model: 'villager', variant: 'PLAINS_BUTCHER', name: 'Bessa the Baker', color: '#E8B76A', description: 'Bakery stall; buying from her counts for the welcome quest.',
    dialogs: [
      ...shopDialogs('Bread, cake and pies, all baked this morning!', 'My oven never cools. If you grow wheat, I will buy it from you.'),
      dialog('quest_market', 'The mayor sent you', 'You must be the newcomer the mayor sent! Every loaf on this stall came out of my oven this morning.\n\nPick whatever you like, @initiator.', { buttons: [button("Let's trade", [shopScreen()]), goodbye] })
    ],
    talks: [{ dialog: 'quest_market', when: ['q_welcome_met'], unless: ['q_welcome_bread'] }],
    quests: ['welcome'],
    goods: [good('minecraft:bread', 4, 40), good('minecraft:cookie', 8, 40), good('minecraft:pumpkin_pie', 2, 60), good('minecraft:cake', 1, 120), good('farmersdelight:apple_pie_slice', 2, 40), good('farmersdelight:sweet_berry_cookie', 8, 40), good('farmersdelight:honey_cookie', 8, 50), good('farmersdelight:chocolate_pie_slice', 2, 60)],
    // Only counts once the mayor has sent you (a purchase before that is just shopping).
    onBuy: ['execute as {player} if entity @s[tag=q_welcome_met] run tag @s add q_welcome_bread']
  },
  gem_trader: {
    model: 'villager', variant: 'DESERT_CLERIC', name: 'Imran the Gem Trader', color: '#B774E0', description: 'Gems and crystals.',
    dialogs: shopDialogs('Gems, friend? The finest stones of the deep, and I buy anything you bring.', 'Amethyst from the deep geodes, lapis, emeralds from the far villages: I have travelled the whole realm for them.'),
    goods: [good('minecraft:amethyst_shard', 4, 60), good('minecraft:lapis_lazuli', 8, 80), good('minecraft:quartz', 8, 80), good('minecraft:emerald', 1, 60), good('minecraft:glowstone_dust', 8, 60), good('minecraft:prismarine_crystals', 4, 60)]
  },
  spice_merchant: {
    model: 'villager', variant: 'SAVANNA_LIBRARIAN', name: 'Saffi the Spice Merchant', color: '#E08A3C', description: "Spice stall: Farmer's Delight seeds and sweets.",
    dialogs: shopDialogs('Seeds from the far south, sugar and cocoa!', 'Cabbage, tomato, onion and rice: plant them and your cooking will never be dull again.'),
    goods: [good('farmersdelight:cabbage_seeds', 4, 40), good('farmersdelight:tomato_seeds', 4, 40), good('farmersdelight:onion', 4, 40), good('farmersdelight:rice', 4, 40), good('minecraft:sugar', 8, 40), good('minecraft:cocoa_beans', 4, 60), good('minecraft:pumpkin_seeds', 4, 20), good('minecraft:melon_seeds', 4, 20)]
  },
  fishmonger: {
    model: 'villager', variant: 'SWAMP_FISHERMAN', name: 'Gil the Fishmonger', color: '#5EC4C4', description: 'Fish stall.',
    dialogs: shopDialogs('Cod and salmon, cooked or raw!', 'I fish the river at dawn. Bring me your catch and I pay fair.'),
    goods: [good('minecraft:cooked_cod', 4, 60), good('minecraft:cooked_salmon', 4, 80), good('minecraft:cod', 4, 30), good('minecraft:salmon', 4, 40), good('minecraft:ink_sac', 2, 30), good('minecraft:kelp', 8, 20)]
  },
  tailor: {
    model: 'villager', variant: 'PLAINS_SHEPHERD', name: 'Maud the Weaver', color: '#6EA5E0', description: 'Cloth stall.',
    dialogs: shopDialogs('Wool in every colour, and strong string.', 'My sheep graze by the east gate. The best wool in Lemurton!'),
    goods: [good('minecraft:white_wool', 8, 40), ...['red', 'yellow', 'green', 'blue', 'black'].map((c) => good(`minecraft:${c}_wool`, 8, 50)), good('minecraft:string', 8, 40), good('minecraft:white_carpet', 8, 30), good('minecraft:white_banner', 1, 60)]
  },
  flower_seller: {
    model: 'villager', variant: 'TAIGA_FARMER', name: 'Posy the Flower Seller', color: '#E07AB0', description: 'Flower stall.',
    dialogs: shopDialogs('Flowers for the window box, saplings for the garden!', 'Every cottage in Lemurton has my flowers in its window boxes.'),
    goods: [...['poppy', 'dandelion', 'cornflower', 'oxeye_daisy', 'allium', 'blue_orchid', 'azure_bluet'].map((f) => good(`minecraft:${f}`, 4, 20)), good('minecraft:birch_sapling', 2, 40), good('minecraft:cherry_sapling', 1, 80), good('minecraft:bone_meal', 8, 40), good('minecraft:flower_pot', 1, 20)]
  },
  butcher: {
    model: 'villager', variant: 'SNOW_BUTCHER', name: 'Ragnar the Butcher', color: '#B05A3C', description: 'Butcher stall.',
    dialogs: shopDialogs('Good meat, fairly priced.', 'Pork, beef, mutton: smoked over applewood, the way my father did it.'),
    goods: [good('minecraft:cooked_porkchop', 4, 80), good('minecraft:cooked_beef', 4, 80), good('minecraft:cooked_mutton', 4, 60), good('minecraft:cooked_chicken', 4, 60), good('minecraft:rabbit_stew', 1, 50)]
  },

  // Shops on the ring streets, keyed by template name.
  shop_smithy: {
    model: 'villager', variant: 'PLAINS_WEAPONSMITH', name: 'Brann the Smith', color: '#C9C9C9', description: 'Smithy.',
    dialogs: shopDialogs("Steel for honest folk. What'll it be?", 'I learned my craft in the dwarven halls under the mountain. Keep your blade oiled and it will keep you alive.'),
    goods: [...['sword', 'pickaxe', 'axe', 'shovel'].map((t) => good(`minecraft:stone_${t}`, 1, 30)), good('minecraft:iron_sword', 1, 150), good('minecraft:iron_pickaxe', 1, 180), good('minecraft:iron_axe', 1, 180), good('minecraft:shield', 1, 80), good('minecraft:bow', 1, 80), good('minecraft:arrow', 16, 40)]
  },
  shop_tailor: {
    model: 'villager', variant: 'PLAINS_LEATHERWORKER', name: 'Odo the Tailor', color: '#B48C64', description: 'Tailor.',
    dialogs: shopDialogs('Leathers and cloth, made to measure.', 'A good coat keeps out more than the cold.'),
    goods: [good('minecraft:leather_helmet', 1, 60), good('minecraft:leather_chestplate', 1, 120), good('minecraft:leather_leggings', 1, 100), good('minecraft:leather_boots', 1, 60), good('minecraft:leather', 2, 40), good('minecraft:saddle', 1, 300), good('minecraft:lead', 1, 60)]
  },
  shop_apothecary: {
    model: 'villager', variant: 'PLAINS_CLERIC', name: 'Sister Agnes', color: '#D86AA0', description: 'Apothecary.',
    dialogs: shopDialogs('Tinctures and tonics for what ails you.', 'I brew by the old recipes. Bring me nether wart and I will teach you more.'),
    goods: [good(potion('healing'), 1, 150), good(potion('swiftness'), 1, 150), good(potion('night_vision'), 1, 150), good('minecraft:glass_bottle', 4, 40), good('minecraft:honey_bottle', 2, 80), good('minecraft:golden_carrot', 2, 160), good('minecraft:glistering_melon_slice', 1, 120), good('minecraft:nether_wart', 4, 80), good('minecraft:brewing_stand', 1, 200)]
  },
  shop_fishing: {
    model: 'villager', variant: 'TAIGA_FISHERMAN', name: 'Hamish of the Docks', color: '#4F86C6', description: 'Fishing supplies.',
    dialogs: shopDialogs('Rods, line and bait!', 'The big ones bite in the rain. Everyone knows that.'),
    goods: [good('minecraft:fishing_rod', 1, 80), good('minecraft:bucket', 1, 100), good('minecraft:water_bucket', 1, 110), good('minecraft:oak_boat', 1, 40), good('minecraft:lily_pad', 4, 20), good('minecraft:string', 8, 40), good('minecraft:lantern', 1, 30)]
  },
  shop_builder: {
    model: 'villager', variant: 'PLAINS_MASON', name: 'Gerta the Mason', color: '#A88A6A', description: "Builder's merchant.",
    dialogs: shopDialogs('Stone, brick and timber, by the stack.', 'Half the houses in this city went up on my bricks.'),
    goods: [good('minecraft:cobblestone', 64, 40), good('minecraft:stone_bricks', 16, 40), good('minecraft:smooth_stone', 16, 40), good('minecraft:bricks', 16, 80), good('minecraft:terracotta', 16, 60), good('minecraft:oak_log', 16, 60), good('minecraft:oak_planks', 32, 40), good('minecraft:spruce_planks', 32, 40), good('minecraft:glass', 16, 60), good('minecraft:lantern', 4, 80)]
  },
  shop_jeweller: {
    model: 'villager', variant: 'PLAINS_LIBRARIAN', name: 'Lucan the Jeweller', color: '#E0C35A', description: 'Jeweller.',
    dialogs: shopDialogs('Precious things, bought and sold.', 'Gold, diamonds, the rare stones of the deep: I pay what they are worth, and not a coin less.'),
    goods: [good('minecraft:gold_nugget', 9, 120), good('minecraft:gold_ingot', 1, 120), good('minecraft:golden_apple', 1, 600), good('minecraft:clock', 1, 300), good('minecraft:compass', 1, 150), good('minecraft:name_tag', 1, 400)]
  },
  varrock_general_store: {
    model: 'villager', variant: 'PLAINS_NITWIT', name: 'Pip the Shopkeeper', color: '#8FBF60', description: 'General store.',
    dialogs: shopDialogs('Welcome to the general store! A bit of everything.', 'Torches, buckets, seeds, string: whatever you forgot to bring, I have it.'),
    goods: [good('minecraft:torch', 8, 20), good('minecraft:bread', 2, 30), good('minecraft:wheat_seeds', 8, 20), good('minecraft:oak_sapling', 4, 40), good('minecraft:shears', 1, 60), good('minecraft:map', 1, 120), good('minecraft:bucket', 1, 100), good('minecraft:bowl', 4, 10), good('minecraft:stick', 16, 20), good('minecraft:crafting_table', 1, 20), good('minecraft:chest', 1, 40), good('minecraft:white_bed', 1, 80), good('minecraft:flint_and_steel', 1, 60), good('minecraft:ladder', 8, 30), good('minecraft:coal', 8, 60)]
  },

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
