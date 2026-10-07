// The main quests, RuneScape style: each is started by talking to someone and only then appears in the quest book.
// This file holds what the quests share between the NPCs (npcs/npcs.mjs dialogs), the quest book (quests/book.mjs
// chapters) and lsp_fixes (the steps a dialog button runs): the stage tags, the quest items and the hand-in steps.
// npcs/build.mjs writes the steps to pack/kubejs/data/lemursaucepacket/lsp_quests/<quest>.json.
//
// A step (run by a dialog button: /lsp quest step @initiator <quest> <step> @npc-uuid) needs some stage tags, lacks
// others, takes items and coins, gives items, sets a stage and opens the NPC's next dialog ("ok"), or says what is
// missing and opens "missing" instead. Stages are player tags and double as FTB Quests stage tasks.
//
// The main questline: Cook's Assistant and The Knight's Sword, then Dragon Slayer I (the Champions' Guild only sends
// proven adventurers after Elvarg).

const name = (text, color) => JSON.stringify({ text, color, italic: false })
const lore = (...lines) => lines.map((text) => JSON.stringify({ text, color: 'gray', italic: false }))
const questItem = (id, key, title, color, lines) => ({ id, count: 1, components: { 'minecraft:custom_name': name(title, color), 'minecraft:lore': lore(...lines), 'minecraft:custom_data': { lsp_quest: key } } })

/** Items the quests hand out; `lsp_quest` in their custom data is how a step knows them. */
export const QUEST_ITEMS = {
  vyvin_sword: questItem('minecraft:iron_sword', 'vyvin_sword', "Sir Vyvin's Sword", 'aqua', ['Forged by Brann the Smith,', 'for the squire to give back.']),
  antidragon_shield: questItem('minecraft:shield', 'antidragon_shield', 'Anti-dragon Shield', 'gold', ['Lemurton has kept it since', 'the old dragon wars.']),
  map_piece_1: questItem('minecraft:paper', 'map_piece_1', 'Map Part (1 of 3)', 'yellow', ['A torn scrap of an old sea chart.', 'Lucan the Jeweller sold it to you.']),
  map_piece_2: questItem('minecraft:paper', 'map_piece_2', 'Map Part (2 of 3)', 'yellow', ['Wizard Traiborn kept it in a', 'box only a spell could open.']),
  map_piece_3: questItem('minecraft:paper', 'map_piece_3', 'Map Part (3 of 3)', 'yellow', ["The Champions' Guild gives it", 'to those who pass its trial.']),
  infernal_key: questItem('minecraft:ominous_trial_key', 'infernal_key', 'Infernal Key', 'red', ['Forged by Brakka from a', 'nether star and netherite.', 'It opens the Inferno.'])
}

const take = (id, count = 1, quest) => ({ id, count, quest })
const piece = (n) => take('minecraft:paper', 1, `map_piece_${n}`)

/** Each quest's stage tags (in order) and the steps its NPCs' buttons run. */
export const QUEST_STEPS = {
  cooks_assistant: {
    title: "Cook's Assistant",
    stages: ['q_cook_started', 'q_cook_done'],
    steps: {
      deliver: {
        needs: ['q_cook_started'],
        lacks: ['q_cook_done'],
        take: [take('minecraft:milk_bucket'), take('minecraft:egg'), take('create:wheat_flour')],
        commands: ['give {player} minecraft:bucket'],
        stage: 'q_cook_done',
        message: 'You hand over the milk, the egg and the flour.',
        ok: 'thanks',
        missing: 'missing',
        done: 'done'
      }
    }
  },
  knights_sword: {
    title: "The Knight's Sword",
    stages: ['q_sword_started', 'q_sword_brann', 'q_sword_forged', 'q_sword_done'],
    steps: {
      forge: {
        needs: ['q_sword_brann'],
        lacks: ['q_sword_forged'],
        take: [take('create:brass_ingot'), take('create:precision_mechanism'), take('minecraft:iron_ingot', 2)],
        give: [QUEST_ITEMS.vyvin_sword],
        stage: 'q_sword_forged',
        message: "Brann forges a fine blade: Sir Vyvin's Sword.",
        ok: 'sword_forged',
        missing: 'sword_missing'
      },
      return_sword: {
        needs: ['q_sword_forged'],
        lacks: ['q_sword_done'],
        take: [take('minecraft:iron_sword', 1, 'vyvin_sword')],
        stage: 'q_sword_done',
        message: "You give the squire Sir Vyvin's sword.",
        ok: 'thanks',
        missing: 'no_sword',
        done: 'done'
      }
    }
  },
  dragon_slayer: {
    title: 'Dragon Slayer I',
    stages: ['q_ds_started', 'q_ds_oziach', 'q_ds_shield', 'q_ds_piece1', 'q_ds_piece2', 'q_ds_map', 'q_ds_elvarg', 'q_ds_done'],
    steps: {
      shield: { needs: ['q_ds_oziach'], lacks: ['q_ds_shield'], give: [QUEST_ITEMS.antidragon_shield], stage: 'q_ds_shield', message: 'The mayor gives you an Anti-dragon Shield.', ok: 'ds_shield_given' },
      piece1: { needs: ['q_ds_oziach'], lacks: ['q_ds_piece1'], coins: 10000, give: [QUEST_ITEMS.map_piece_1], stage: 'q_ds_piece1', message: 'You buy a scrap of old map from Lucan.', ok: 'ds_piece_sold', missing: 'ds_piece_poor' },
      piece2: {
        needs: ['q_ds_oziach'],
        lacks: ['q_ds_piece2'],
        take: [take('minecraft:ghast_tear'), take('minecraft:blaze_rod'), take('minecraft:amethyst_shard')],
        give: [QUEST_ITEMS.map_piece_2],
        stage: 'q_ds_piece2',
        message: 'Traiborn opens his box and hands you a piece of map.',
        ok: 'ds_piece_given',
        missing: 'ds_piece_missing'
      },
      map: { needs: ['q_ds_oziach'], lacks: ['q_ds_map'], take: [piece(1), piece(2), piece(3)], special: ['crandor_map'], stage: 'q_ds_map', message: 'Oziach puts the three pieces together: a Map to Crandor.', ok: 'ds_map_made', missing: 'ds_pieces_missing' },
      head: {
        needs: ['q_ds_elvarg'],
        lacks: ['q_ds_done'],
        take: [take('iceandfire:dragon_skull_fire', 1, 'elvarg_head')],
        stage: 'q_ds_done',
        message: "You give Oziach Elvarg's head.",
        ok: 'ds_done',
        missing: 'ds_no_head'
      }
    }
  }
}

/** The Kilnfolk's quests (Kiln Hollow): the Fight Pits for the Fire Cape, then Ashes of the Kiln and the Inferno. */
Object.assign(QUEST_STEPS, {
  fight_pits: {
    title: 'The Fight Pits',
    stages: ['q_pits_started', 'q_pits_elder', 'q_pits_offering', 'q_pits_trial', 'q_pits_allowed', 'q_pits_fire', 'q_pits_done'],
    steps: {
      pass: { needs: ['q_ds_done'], lacks: ['q_pits_started'], special: ['kiln_pass'], stage: 'q_pits_started', message: 'Guildmaster Greaves gives you a Kilnfolk Pass.', ok: 'pits_pass_given' },
      offering: {
        needs: ['q_pits_elder'],
        lacks: ['q_pits_offering'],
        take: [take('minecraft:magma_cream', 8), take('minecraft:blaze_rod', 4), take('minecraft:obsidian', 16)],
        stage: 'q_pits_offering',
        message: 'You lay the offering before the Kiln.',
        ok: 'pits_offering_ok',
        missing: 'pits_offering_missing',
        done: 'pits_check'
      },
      allowed: {
        needs: ['q_pits_elder', 'q_pits_offering', 'q_pits_trial'],
        lacks: ['q_pits_allowed'],
        skills: { defence: 50, hitpoints: 50, 'attack|ranged': 50 },
        stage: 'q_pits_allowed',
        message: 'Elder Ashka vouches for you: the Fight Pits are open to you.',
        ok: 'pits_allowed',
        missing: 'pits_not_ready',
        done: 'pits_not_ready'
      },
      done: { needs: ['q_pits_fire'], lacks: ['q_pits_done'], stage: 'q_pits_done', message: 'Elder Ashka honours your Fire Cape.', ok: 'pits_thanks' }
    }
  },
  ashes: {
    title: 'Ashes of the Kiln',
    stages: ['q_ash_started', 'q_ash_beasts', 'q_ash_key', 'q_ash_done'],
    steps: {
      key: {
        needs: ['q_ash_started'],
        lacks: ['q_ash_key'],
        take: [take('minecraft:nether_star'), take('minecraft:netherite_ingot', 4), take('minecraft:crying_obsidian', 16), take('minecraft:blaze_rod', 16)],
        give: [QUEST_ITEMS.infernal_key],
        stage: 'q_ash_key',
        message: 'Brakka forges you an Infernal Key.',
        ok: 'key_forged',
        missing: 'key_missing'
      },
      ready: {
        needs: ['q_ash_started', 'q_ash_beasts', 'q_ash_key'],
        lacks: ['q_ash_done'],
        skills: { defence: 80, hitpoints: 80, 'attack|ranged': 80 },
        take: [take('minecraft:ominous_trial_key', 1, 'infernal_key')],
        stage: 'q_ash_done',
        message: "Elder Ashka takes your Infernal Key: the Inferno's seal will open for you.",
        ok: 'ash_ready',
        missing: 'ash_not_ready',
        done: 'ash_not_ready'
      }
    }
  },
  inferno: {
    title: 'The Inferno',
    stages: ['q_inf_cape', 'q_inf_done'],
    steps: {
      done: { needs: ['q_inf_cape'], lacks: ['q_inf_done'], stage: 'q_inf_done', message: 'Elder Ashka honours your Infernal Cape.', ok: 'inf_thanks' }
    }
  }
})

/** What the main quests ask before Dragon Slayer I: the Champions' Guild wants proven adventurers. */
export const DRAGON_SLAYER_NEEDS = ['q_welcome_done', 'q_cook_done', 'q_sword_done']

/** A dialog button that runs a quest step. */
export const stepCmd = (quest, step) => ({ Type: 'COMMAND', Cmd: `/lsp quest step @initiator ${quest} ${step} @npc-uuid` })
