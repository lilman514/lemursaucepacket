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

import { DRAGON_SLAYER_NEEDS, stepCmd } from './quests.mjs'

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
  },
  cooks_assistant: {
    title: "Cook's Assistant",
    steps: [
      { stage: 'q_cook_started', text: 'Offer to help the Cook' },
      { stage: 'q_cook_done', text: 'Bring the Cook milk, an egg and flour' }
    ]
  },
  knights_sword: {
    title: "The Knight's Sword",
    steps: [
      { stage: 'q_sword_started', text: "Hear Squire Asrol's woes" },
      { stage: 'q_sword_brann', text: 'Ask Brann the Smith for a new sword' },
      { stage: 'q_sword_forged', text: 'Bring Brann a brass ingot, a precision mechanism and two iron ingots' },
      { stage: 'q_sword_done', text: 'Give the sword to Squire Asrol' }
    ]
  },
  dragon_slayer: {
    title: 'Dragon Slayer I',
    steps: [
      { stage: 'q_ds_started', text: "Ask the Champions' Guild for a challenge" },
      { stage: 'q_ds_oziach', text: 'Hear about Elvarg from Oziach' },
      { stage: 'q_ds_shield', text: 'Get an anti-dragon shield from the mayor' },
      { stage: 'q_ds_piece1', text: 'Buy a map piece from Lucan the Jeweller' },
      { stage: 'q_ds_piece2', text: "Bring Wizard Traiborn what his spell needs" },
      { stage: 'q_ds_map', text: 'Have Oziach put the map together' },
      { stage: 'q_ds_elvarg', text: 'Slay Elvarg on Crandor' },
      { stage: 'q_ds_done', text: "Bring Elvarg's head to Oziach" }
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
      dialog('ds_after', 'Welcome home', 'Lemurton is glad to have you, @initiator. And proud: not many walk out to face a dragon.', { priority: 46, conditions: [tag('q_ds_shield')], buttons: [button('Tell me about the city again', [open('about')]), goodbye] }),
      dialog('ds_shield', 'An anti-dragon shield', 'An anti-dragon shield? So you mean to face Elvarg... The city has kept one since the old dragon wars. Take it, @initiator, and come back alive.', {
        priority: 45,
        conditions: [tag('q_ds_oziach')],
        buttons: [button('Thank you, mayor', [stepCmd('dragon_slayer', 'shield')])]
      }),
      dialog('ds_shield_given', 'Good luck', 'Hold it up when she breathes. Lemurton will be waiting for news.', { buttons: [goodbye] }),
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
    model: 'villager', variant: 'PLAINS_WEAPONSMITH', name: 'Brann the Smith', color: '#C9C9C9', description: "Smithy; forges the sword for The Knight's Sword.",
    dialogs: [
      ...shopDialogs("Steel for honest folk. What'll it be?", 'I learned my craft in the dwarven halls under the mountain. Keep your blade oiled and it will keep you alive.'),
      dialog('sword_after', 'Brann', "Steel for honest folk. What'll it be? The squire still owes me a drink, by the way.", { priority: 40, conditions: [tag('q_sword_done')], buttons: [button("Let's trade", [shopScreen()]), goodbye] }),
      dialog('sword_take', 'The sword', 'Go on, take that sword to the squire before he cries himself to sleep.', { priority: 33, conditions: [tag('q_sword_forged')], buttons: [button("Let's trade", [shopScreen()]), goodbye] }),
      dialog('sword_wait', 'The makings', 'Got the makings? A brass ingot, a precision mechanism and two iron ingots. Brass from your mixer, the mechanism from a deployer line: you know how.', {
        priority: 32,
        conditions: [tag('q_sword_brann')],
        buttons: [button('Here they are', [stepCmd('knights_sword', 'forge')]), button("Let's trade", [shopScreen()]), goodbye]
      }),
      dialog('sword_ask', "Sir Vyvin's sword", "The squire's lost Sir Vyvin's sword, eh? Ha! I can forge another that he'll never tell apart, if you bring me the makings: a brass ingot, a precision mechanism and two iron ingots.", {
        priority: 31,
        conditions: [tag('q_sword_started')],
        buttons: [button("I'll get them", [cmd('tag @initiator add q_sword_brann'), open('sword_wait')]), button("Let's trade", [shopScreen()]), goodbye]
      }),
      dialog('sword_forged', 'Forged', 'There: as fine a blade as any dwarf ever made. Take it to the squire.', { buttons: [button('Thank you, Brann', [close()])] }),
      dialog('sword_missing', 'Not enough', "That's not everything. A brass ingot, a precision mechanism and two iron ingots, no less.", { buttons: [button("I'll be back", [close()])] })
    ],
    talks: [{ dialog: 'sword_ask', when: ['q_sword_started'], unless: ['q_sword_brann'] }],
    quests: ['knights_sword'],
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
    model: 'villager', variant: 'PLAINS_LIBRARIAN', name: 'Lucan the Jeweller', color: '#E0C35A', description: 'Jeweller; sells a map piece for Dragon Slayer I.',
    dialogs: [
      ...shopDialogs('Precious things, bought and sold.', 'Gold, diamonds, the rare stones of the deep: I pay what they are worth, and not a coin less.'),
      dialog('ds_after', 'Precious things', 'Precious things, bought and sold. Still hunting that dragon?', { priority: 21, conditions: [tag('q_ds_piece1')], buttons: [button("Let's trade", [shopScreen()]), goodbye] }),
      dialog('ds_piece', 'A map piece', "A map piece? Oziach sent you, I'll wager. A sailor sold me this scrap years ago, swore it showed the way to Crandor. It's yours for 10,000 coins.", {
        priority: 20,
        conditions: [tag('q_ds_oziach')],
        buttons: [button('Buy it (10,000 coins)', [stepCmd('dragon_slayer', 'piece1')]), button("Let's trade", [shopScreen()]), button('Too rich for me', [close()])]
      }),
      dialog('ds_piece_sold', 'Sold', "A pleasure doing business. Mind you don't lose it!", { buttons: [goodbye] }),
      dialog('ds_piece_poor', 'Not enough', 'Ten thousand coins, friend, not a coin less. Come back when your purse is heavier.', { buttons: [goodbye] })
    ],
    talks: [{ dialog: 'ds_piece', when: ['q_ds_oziach'], unless: ['q_ds_piece1'] }],
    quests: ['dragon_slayer'],
    goods: [good('minecraft:gold_nugget', 9, 120), good('minecraft:gold_ingot', 1, 120), good('minecraft:golden_apple', 1, 600), good('minecraft:clock', 1, 300), good('minecraft:compass', 1, 150), good('minecraft:name_tag', 1, 400)]
  },
  varrock_general_store: {
    model: 'villager', variant: 'PLAINS_NITWIT', name: 'Pip the Shopkeeper', color: '#8FBF60', description: 'General store.',
    dialogs: shopDialogs('Welcome to the general store! A bit of everything.', 'Torches, buckets, seeds, string: whatever you forgot to bring, I have it.'),
    goods: [good('minecraft:torch', 8, 20), good('minecraft:bread', 2, 30), good('minecraft:wheat_seeds', 8, 20), good('minecraft:oak_sapling', 4, 40), good('minecraft:shears', 1, 60), good('minecraft:map', 1, 120), good('minecraft:bucket', 1, 100), good('minecraft:bowl', 4, 10), good('minecraft:stick', 16, 20), good('minecraft:crafting_table', 1, 20), good('minecraft:chest', 1, 40), good('minecraft:white_bed', 1, 80), good('minecraft:flint_and_steel', 1, 60), good('minecraft:ladder', 8, 30), good('minecraft:coal', 8, 60)]
  },

  // The main quests' people (npcs/quests.mjs has their steps). Each stands at a worker building's npc mark.
  cook: {
    model: 'villager', variant: 'TAIGA_BUTCHER', name: 'Cook', color: '#F2D27A', description: "Lemurton's cook: Cook's Assistant.",
    dialogs: [
      dialog('done', 'The feast', "The mayor's cake was the talk of the feast, @initiator! I couldn't have done it without you.", { priority: 30, conditions: [tag('q_cook_done')], buttons: [goodbye] }),
      dialog('started', 'My ingredients', 'Have you got them? A bucket of milk, an egg and a pot of fine flour.\n\nFlour comes from wheat ground in a millstone, if you have one going.', {
        priority: 20,
        conditions: [tag('q_cook_started')],
        buttons: [button('Here you go', [stepCmd('cooks_assistant', 'deliver')]), button('Where do I get flour?', [open('flour')]), button('Not yet', [close()])]
      }),
      dialog('flour', 'Flour', "Grind wheat in a Create millstone: put the wheat in the top and turn it. One wheat, one pot of flour. There's a mill's worth of wheat in the fields outside the walls.", { buttons: [button('Right, thanks', [close()])] }),
      dialog('default', "What am I to do?", "What am I to do? The mayor's feast is tonight and I haven't a thing for the cake!", { priority: 10, buttons: [button("What's wrong?", [open('ask')]), goodbye] }),
      dialog('ask', 'A cake', "I need a bucket of milk, an egg and a pot of fine flour, and there's no time to fetch them myself. Would you get them for me?", {
        buttons: [button("Yes, I'll help", [cmd('tag @initiator add q_cook_started'), open('started')]), button("Sorry, I'm busy", [close()])]
      }),
      dialog('missing', 'Not everything', "That's not all of it! I need the milk, the egg and the flour. Your chat says what's still missing.", { buttons: [button("I'll be back", [close()])] }),
      dialog('thanks', 'Saved', "You've saved the feast! Here: the city's thanks, and an old bucket back for you.", { buttons: [button('Glad to help', [close()])] })
    ]
  },
  squire: {
    model: 'humanoid', variant: 'KNIGHT_02', name: 'Squire Asrol', color: '#A8C8E8', description: "Sir Vyvin's squire: The Knight's Sword.",
    dialogs: [
      dialog('done', 'Saved', "Sir Vyvin never noticed a thing, @initiator. I owe you everything!", { priority: 40, conditions: [tag('q_sword_done')], buttons: [goodbye] }),
      dialog('forged', 'The sword!', "Is that... Sir Vyvin's sword? Brann did it! May I have it?", {
        priority: 30,
        conditions: [tag('q_sword_forged')],
        buttons: [button('Here you go', [stepCmd('knights_sword', 'return_sword')]), button('In a moment', [close()])]
      }),
      dialog('started', 'Any luck?', 'Have you been to Brann? His smithy is on the ring street. He learned his craft from the dwarves under the mountain: if anyone can forge a sword like Sir Vyvin\'s, he can.', { priority: 20, conditions: [tag('q_sword_started')], buttons: [goodbye] }),
      dialog('default', 'Oh woe', "Oh woe is me! I've lost Sir Vyvin's sword, and he's back tomorrow!", { priority: 10, buttons: [button('What happened?', [open('ask')]), goodbye] }),
      dialog('ask', 'The sword', 'I was polishing it by the well, and it slipped... it\'s gone. The only smith who could make another is Brann at the smithy. Would you ask him for me?', {
        buttons: [button("I'll ask Brann", [cmd('tag @initiator add q_sword_started'), open('started')]), button('Not my problem', [close()])]
      }),
      dialog('no_sword', 'Where is it?', "You haven't got it with you! Bring me the sword Brann made.", { buttons: [button("I'll fetch it", [close()])] }),
      dialog('thanks', 'Thank you', "It's perfect! Sir Vyvin will never know. Please, take this for your trouble.", { buttons: [button('Good luck, squire', [close()])] })
    ]
  },
  guildmaster: {
    model: 'humanoid', variant: 'KNIGHT_01', name: 'Guildmaster Greaves', color: '#E8A33C', description: "Head of the Champions' Guild: starts Dragon Slayer I.",
    equipment: { head: 'minecraft:golden_helmet', chest: 'minecraft:golden_chestplate', mainhand: 'minecraft:diamond_sword' },
    dialogs: [
      dialog('ds_done', 'Champion', 'Elvarg is slain! The whole realm will hear of it. The Champions\' Guild salutes you, @initiator.', { priority: 30, conditions: [tag('q_ds_done')], buttons: [goodbye] }),
      dialog('ds_go', 'Oziach', 'Have you spoken to Oziach? He keeps the armoury on the ring street. He knows more about Elvarg than any man living.', { priority: 20, conditions: [tag('q_ds_started')], buttons: [goodbye] }),
      dialog('default', "The Champions' Guild", "Welcome to the Champions' Guild. Only the realm's finest adventurers drink here.", { priority: 10, buttons: [button('I want to be a champion', [open('ask')]), goodbye] }),
      dialog('ask', 'Prove yourself', 'Then prove yourself. Help the people of Lemurton first: the mayor\'s newcomers, the castle cook, Sir Vyvin\'s squire. Come back when they speak well of you.', {
        buttons: [button('They do. Give me a real challenge', [cmd('tag @initiator add q_ds_started'), open('ds_start')], DRAGON_SLAYER_NEEDS.map(tag)), button("I'll come back", [close()])]
      }),
      dialog('ds_start', 'Elvarg', 'Very well. There is a dragon, Elvarg, on the isle of Crandor. Many have tried to slay her. Oziach, who keeps the armoury on the ring street, came closest: ask him how it is done.', { buttons: [button("I'll find Oziach", [close()])] })
    ]
  },
  oziach: {
    model: 'villager', variant: 'SNOW_ARMORER', name: 'Oziach', color: '#C04A3A', description: 'Old dragon slayer: Dragon Slayer I.',
    dialogs: [
      dialog('ds_done', 'Dragon Slayer', "You did it. You actually did it. You've earned the right to wear dragon armour, @initiator: no one will say otherwise while I live.", { priority: 60, conditions: [tag('q_ds_done')], buttons: [goodbye] }),
      dialog('ds_head', 'Her head?', "You've the look of someone who's been to Crandor. Well? Did you bring me her head?", {
        priority: 50,
        conditions: [tag('q_ds_elvarg')],
        buttons: [button('Here it is', [stepCmd('dragon_slayer', 'head')]), button('Not yet', [close()])]
      }),
      dialog('ds_map', 'Crandor', 'Follow that map to Crandor. Kill Elvarg and bring me her head. Hold your shield up when she breathes.', { priority: 40, conditions: [tag('q_ds_map')], buttons: [goodbye] }),
      dialog('ds_pieces', 'The map', 'Got the three pieces of the map yet? Lucan the Jeweller has one, Wizard Traiborn another, and the Guild gives the third to those who pass its trial.', {
        priority: 30,
        conditions: [tag('q_ds_oziach')],
        buttons: [button('Here they are', [stepCmd('dragon_slayer', 'map')]), button('Where are they again?', [open('ds_where')]), goodbye]
      }),
      dialog('ds_intro', 'Elvarg', "So the Guild sent you. You want to slay Elvarg? Many have tried. She lives on Crandor, an isle no captain will sail to any more, and the only map to it was torn in three.\n\nFind the three pieces and bring them here. And get an anti-dragon shield from the mayor: her breath will cook you in your armour without one.", {
        priority: 20,
        conditions: [tag('q_ds_started')],
        buttons: [button("I'll do it", [cmd('tag @initiator add q_ds_oziach'), open('ds_where')]), button('Maybe later', [close()])]
      }),
      dialog('ds_where', 'The pieces', 'One piece is with Lucan the Jeweller: he bought it off a sailor and he\'ll want paying. One is with Wizard Traiborn in his tower by the wall. The third is the Champions\' Guild\'s: pass its trial (your quest book says how) and it\'s yours.', { buttons: [button("I'm on it", [close()])] }),
      dialog('ds_pieces_missing', 'Three pieces', "That's not all three. I need every piece, or the map is useless.", { buttons: [button("I'll find the rest", [close()])] }),
      dialog('ds_map_made', 'The map', 'There. Crandor. The needle on that will lead you to her isle. Kill Elvarg and bring me her head.', { buttons: [button('I will', [close()])] }),
      dialog('ds_no_head', 'No head', "Where's her head? Bring me proof, or don't come back.", { buttons: [button("I'll get it", [close()])] }),
      dialog('default', 'Oziach', 'Aye? What do you want? Unless you\'re buying, I\'ve work to do.', { priority: 10, buttons: [goodbye] })
    ]
  },
  wizard: {
    model: 'illusioner', variant: 'ILLUSIONER', name: 'Wizard Traiborn', color: '#7A8CF0', description: 'Absent-minded wizard: a map piece for Dragon Slayer I.',
    dialogs: [
      dialog('ds_piece_after', 'Good luck', 'Good luck with the dragon! Remember: fire beats ice, ice beats fire, and neither beats running away.', { priority: 21, conditions: [tag('q_ds_piece2')], buttons: [goodbye] }),
      dialog('ds_piece', 'The box', "A map of Crandor? Yes, yes, I have a piece... somewhere... Ah! Locked in this box, which only opens to a spell.\n\nBring me a ghast tear, a blaze rod and an amethyst shard and I'll open it for you.", {
        priority: 20,
        conditions: [tag('q_ds_oziach')],
        buttons: [button('Here they are', [stepCmd('dragon_slayer', 'piece2')]), button("I'll get them", [close()])]
      }),
      dialog('ds_piece_missing', 'Not yet', 'No, no, the spell needs all three: a ghast tear, a blaze rod and an amethyst shard.', { buttons: [button("I'll be back", [close()])] }),
      dialog('ds_piece_given', 'Open!', 'Hocus... pocus! There. One piece of map, as promised. Mind the dragon.', { buttons: [button('Thank you, wizard', [close()])] }),
      dialog('default', 'Hmm?', 'Hmm? Oh, a visitor! Mind the... no, it\'s gone. What can I do for you?', { priority: 10, buttons: [goodbye] })
    ]
  },

  // At the Crandor memorial, not in the city: lsp_fixes' CrandorMemorial imports him there. Speaking to him opens
  // Elvarg's Lair (lsp_instances, the lsp_event tag); the dialog is only the fallback without that mod.
  ned: {
    model: 'villager', variant: 'PLAINS_FISHERMAN', name: 'Ned', color: '#6FA8DC',
    description: "Old sailor at the Crandor memorial: takes you up to Elvarg, and keeps the things of those who fall to her.",
    tags: ['lsp_event.lemursaucepacket.elvarg'],
    dialogs: [dialog('default', 'Ned', "Elvarg's den is just up the hill. I sailed many a brave soul to Crandor in my day, and I've buried a good few since.\n\nWhen you're ready, I'll see you up there. And if she gets you, I'll keep your things safe till you come back for them.", { priority: 10, buttons: [goodbye] })]
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
  lgc_plains_worker_inn: 'varrock_general_store',
  // The main quests' people (npcs/quests.mjs).
  lgc_plains_worker_butcher_shop_1: 'cook',
  lgc_plains_worker_armorer: 'squire',
  lgc_plains_worker_toolsmith: 'oziach',
  lgc_plains_worker_library_2: 'guildmaster',
  lgc_taiga_house_house_5: 'wizard'
}

/** The market square's traders, placed round its stalls in this order. */
export const MARKET_TRADERS = ['baker', 'fruit_seller', 'gem_trader', 'spice_merchant', 'fishmonger', 'tailor', 'flower_seller', 'butcher']
