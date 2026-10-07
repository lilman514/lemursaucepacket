#!/usr/bin/env node
// The Kilnfolk's wave fights (docs/fight-pits.md): the Fight Pits, where the Fire Cape is won, and the Inferno, where the
// Infernal Cape is. Writes:
//   pack/kubejs/data/lemursaucepacket/lsp_instances/event/{fight_pits,inferno}.json   the events (lsp_instances)
//   pack/kubejs/data/lemursaucepacket/lsp_pits/mobs.json                             what the bosses call up (lsp_fixes)
//   pack/kubejs/data/lemursaucepacket/damage_type/*.json, data/minecraft/tags/...     the bosses' attacks
// The arenas are structures/buildings/80-kiln.mjs; lsp_fixes (pits/) runs the bosses, the menders and the shield.
// Run `node pits/build.mjs`; publish.mjs does too.
//
// The pit beasts are vanilla creatures, renamed and toughened, each with a job like the TzHaar's: the Kih are embers
// (small magma cubes), the Kek split (bigger ones), the Xil shoot (wither skeletons with flaming bows), the MejKot hit
// hard and heal the others (piglin brutes), the Zek throw fire that Fire Resistance doesn't stop (blazes). Jad is a
// giant blaze whose attacks are telegraphed. The Inferno's Kal- beasts are harder: Nib swarms (vexes), MejRah that
// drain your run (phantoms), Ak that split twice (big magma cubes), ImKot that burrow up beside you (hoglins), Xil,
// Zek that call up vexes (evokers), Kal-Tok-Jads, and Kiln-Kal-Zuk, a giant ghast behind a moving shield.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARENAS } from '../structures/buildings/80-kiln.mjs'
import { byte, double, float, json, snbt } from '../npcs/snbt.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const data = path.join(root, 'pack', 'kubejs', 'data')
const ours = path.join(data, 'lemursaucepacket')

// ---------------------------------------------------------------- the creatures

const NO_DROPS = 'minecraft:empty'
const attr = (id, base) => ({ id: `minecraft:generic.${id}`, base: double(base) })
/** Slimes reset their base health from their size, so their extra health is a modifier. */
const extra = (id, base, amount) => ({ id: `minecraft:generic.${id}`, base: double(base), modifiers: [{ id: 'lemursaucepacket:pits', amount: double(amount), operation: 'add_value' }] })
const item = (id, enchantments) => ({ id, count: 1, components: enchantments ? { 'minecraft:enchantments': { levels: enchantments } } : undefined })
const forever = (effect) => ({ id: effect, amplifier: byte(0), duration: -1, show_particles: byte(0), show_icon: byte(0), ambient: byte(0) })

function creature(id, name, color, { tags = [], attributes = [], visible = false, boss = false, hands, effects, nbt = {} }) {
  return {
    id,
    CustomName: json({ text: name, color }),
    CustomNameVisible: byte(visible ? 1 : 0),
    PersistenceRequired: byte(1),
    DeathLootTable: NO_DROPS,
    Tags: ['lsp_pits', ...tags],
    attributes: [attr('follow_range', 48), ...attributes],
    HandItems: hands ? [hands[0] ?? {}, hands[1] ?? {}] : undefined,
    HandDropChances: hands ? [float(0), float(0)] : undefined,
    ArmorDropChances: [float(0), float(0), float(0), float(0)],
    active_effects: effects,
    ...(boss ? { NoAI: byte(1), NoGravity: byte(1) } : {}),
    ...nbt
  }
}

const KILN = {
  kih: creature('minecraft:magma_cube', 'Kiln-Kih', 'gold', { nbt: { Size: 0 }, attributes: [extra('max_health', 1, 13)] }),
  kek: creature('minecraft:magma_cube', 'Kiln-Kek', 'gold', { nbt: { Size: 2 }, attributes: [extra('max_health', 9, 31)] }),
  xil: creature('minecraft:wither_skeleton', 'Kiln-Xil', 'gold', {
    attributes: [attr('max_health', 44), attr('scale', 0.9)],
    hands: [item('minecraft:bow', { 'minecraft:power': 2, 'minecraft:flame': 1 })]
  }),
  mejkot: creature('minecraft:piglin_brute', 'Kiln-MejKot', 'gold', {
    tags: ['lsp_pits_mejkot'],
    attributes: [attr('max_health', 80)],
    hands: [item('minecraft:golden_axe')],
    effects: [forever('minecraft:fire_resistance')],
    nbt: { IsImmuneToZombification: byte(1) }
  }),
  zek: creature('minecraft:blaze', 'Kiln-Zek', 'gold', { tags: ['lsp_pits_zek'], attributes: [attr('max_health', 70), attr('scale', 1.25)] }),
  jad: creature('minecraft:blaze', 'Kiln-Tok-Jad', 'red', {
    tags: ['lsp_pits_jad'],
    visible: true,
    boss: true,
    attributes: [attr('max_health', 600), attr('scale', 3), attr('knockback_resistance', 1)]
  }),
  hurkot: creature('minecraft:zombified_piglin', 'Kiln-HurKot', 'yellow', {
    tags: ['lsp_pits_healer'],
    attributes: [attr('max_health', 30)],
    hands: [item('minecraft:golden_sword')],
    nbt: { AngerTime: 0 }
  })
}

const KAL = {
  nib: creature('minecraft:vex', 'Kal-Nib', 'gold', { attributes: [attr('max_health', 10), attr('scale', 0.9)] }),
  mejrah: creature('minecraft:phantom', 'Kal-MejRah', 'gold', { tags: ['lsp_inf_mejrah'], attributes: [attr('max_health', 26)], nbt: { Size: 1 } }),
  ak: creature('minecraft:magma_cube', 'Kal-Ak', 'gold', { nbt: { Size: 3 }, attributes: [extra('max_health', 16, 54)] }),
  imkot: creature('minecraft:hoglin', 'Kal-ImKot', 'gold', {
    tags: ['lsp_inf_imkot'],
    attributes: [attr('max_health', 90), attr('attack_damage', 8)],
    nbt: { IsImmuneToZombification: byte(1) }
  }),
  xil: creature('minecraft:wither_skeleton', 'Kal-Xil', 'gold', {
    attributes: [attr('max_health', 60)],
    hands: [item('minecraft:bow', { 'minecraft:power': 4, 'minecraft:flame': 1 })]
  }),
  zek: creature('minecraft:evoker', 'Kal-Zek', 'gold', { tags: ['lsp_inf_zek'], attributes: [attr('max_health', 80)] }),
  jad: creature('minecraft:blaze', 'Kal-Tok-Jad', 'red', {
    tags: ['lsp_pits_jad', 'lsp_inf_jad'],
    visible: true,
    boss: true,
    attributes: [attr('max_health', 500), attr('scale', 3), attr('knockback_resistance', 1)]
  }),
  zuk: creature('minecraft:ghast', 'Kiln-Kal-Zuk', 'dark_red', {
    tags: ['lsp_inf_zuk'],
    visible: true,
    boss: true,
    // Max health stops at 1024 in Minecraft: Resistance I makes his 1000 last like 1250.
    attributes: [attr('max_health', 1000), attr('scale', 2), attr('knockback_resistance', 1)],
    effects: [{ id: 'minecraft:resistance', amplifier: byte(0), duration: -1, show_particles: byte(0), show_icon: byte(0), ambient: byte(0) }],
    nbt: { ExplosionPower: byte(0) }
  }),
  mejjak: creature('minecraft:zombified_piglin', 'Kal-MejJak', 'yellow', {
    tags: ['lsp_pits_healer'],
    attributes: [attr('max_health', 40)],
    hands: [item('minecraft:golden_sword')],
    nbt: { AngerTime: 0 }
  })
}

// ---------------------------------------------------------------- the waves

const spawn = (mob, count = 1, more = {}) => ({ nbt: snbt(mob, 0), full_health: true, ...(count > 1 ? { count } : {}), ...more })

/** Waves written as 'kek kih*2': a beast's key, then how many. */
function waves(table, roster) {
  return table.map((line) => ({
    spawns: line.split(/\s+/).map((word) => {
      const [key, n] = word.split('*')
      if (!roster[key]) throw new Error(`no beast ${key}`)
      return spawn(roster[key], Number(n ?? 1))
    })
  }))
}

// Thirty waves, each beast introduced alone and then in company, the champion last.
const PITS_WAVES = [
  'kih', 'kih*2', 'kek', 'kek kih', 'kek kih*2', 'kek*2',
  'xil', 'xil kih', 'xil kih*2', 'xil kek', 'xil kek kih', 'xil*2',
  'mejkot', 'mejkot kih*2', 'mejkot kek', 'mejkot xil', 'mejkot xil kih*2', 'mejkot xil kek', 'mejkot*2',
  'zek', 'zek kih*2', 'zek kek', 'zek xil', 'zek xil kek', 'zek mejkot', 'zek mejkot xil', 'zek mejkot xil kek', 'zek*2', 'zek*2 mejkot xil'
]
// The Inferno: every wave brings a Nib swarm, the rest grow; then a Kal-Tok-Jad, two at once, and Zuk.
const INFERNO_WAVES = [
  'nib*3 mejrah', 'nib*3 mejrah*2', 'nib*3 ak', 'nib*3 ak mejrah', 'nib*3 ak*2',
  'nib*3 imkot', 'nib*3 imkot mejrah', 'nib*3 imkot ak', 'nib*3 imkot*2',
  'nib*3 xil', 'nib*3 xil mejrah', 'nib*3 xil ak', 'nib*3 xil imkot', 'nib*3 xil*2',
  'nib*3 zek', 'nib*3 zek mejrah', 'nib*3 zek ak', 'nib*3 zek imkot', 'nib*3 zek xil', 'nib*3 zek xil ak', 'nib*3 zek xil imkot',
  'nib*3 zek*2', 'nib*3 zek*2 xil mejrah', 'nib*3 zek*2 xil imkot', 'nib*3 zek xil*2 imkot ak', 'nib*3 zek*2 xil*2 imkot'
]

const pits = ARENAS.fight_pits
const inf = ARENAS.inferno
const hover = (a, up) => ({ y: a.floorY + 1 + up })

const fightPits = {
  name: 'The Fight Pits',
  description: [
    "Thirty waves of the Kilnfolk's pit beasts, one after another, and last of all their champion, Kiln-Tok-Jad.",
    "You fight alone. Fall, and Grull pulls you out alive with everything you had: only the run is lost.",
    'Jad draws in flame (raise your shield) or rises to slam (get out of the ring). Win, and the Fire Cape is yours.'
  ],
  arena: 'lemursaucepacket:fight_pits',
  strip_containers: true,
  max_players: 1,
  time_limit: 5400,
  loot_time: 20,
  start_requires: { tags: ['q_pits_allowed'], message: 'Elder Ashka must vouch for you before Grull lets you in.' },
  radius: pits.radius,
  trial: {
    waves: [...waves(PITS_WAVES, KILN), { spawns: [spawn(KILN.jad, 1, { boss: true, at: { x: pits.jad.x, z: pits.jad.z, ...hover(pits, 0) } })] }],
    rest: 6,
    safe_deaths: true,
    win_commands: [
      'lsp cape flag {player} pits:fire_cape',
      'tag {player} add q_pits_fire',
      'lsp coins give {player} 10000',
      'tellraw @a {"text":"{player} has defeated Kiln-Tok-Jad and earned a Fire Cape!","color":"gold"}'
    ]
  }
}

const inferno = {
  name: 'The Inferno',
  description: [
    "The Kilnfolk's oldest pit: harder beasts, Kal-Tok-Jads, and Kiln-Kal-Zuk, who burns everything in front of him.",
    "When Zuk's eyes burn, be behind the shield that drifts along the lava's edge. Win, and the Infernal Cape is yours.",
    'You fight alone. Fall, and Zarn pulls you out alive with everything you had: only the run is lost.'
  ],
  arena: 'lemursaucepacket:inferno',
  strip_containers: true,
  max_players: 1,
  time_limit: 7200,
  loot_time: 20,
  start_requires: { tags: ['q_ash_done'], message: 'The seal only opens for one Elder Ashka has made ready.' },
  radius: inf.radius,
  trial: {
    waves: [
      ...waves(INFERNO_WAVES, KAL),
      { spawns: [spawn(KAL.jad, 1, { at: { x: 0, z: -6, ...hover(inf, 0) } })] },
      { spawns: [spawn(KAL.jad, 1, { at: { x: -9, z: -4, ...hover(inf, 0) } }), spawn(KAL.jad, 1, { at: { x: 9, z: -4, ...hover(inf, 0) } })] },
      { spawns: [spawn(KAL.zuk, 1, { boss: true, at: { x: inf.zuk.x, z: inf.zuk.z, ...hover(inf, 1) } })] }
    ],
    rest: 8,
    safe_deaths: true,
    win_commands: [
      'lsp cape flag {player} pits:infernal_cape',
      'tag {player} add q_inf_cape',
      'lsp coins give {player} 40000',
      'tellraw @a {"text":"{player} has survived the Inferno and earned an Infernal Cape!","color":"red","bold":true}'
    ]
  }
}

// What lsp_fixes calls up mid-fight, and the shield's line (from Zuk's spot: forward is toward the party, south).
const mobs = {
  jad_menders: snbt(KILN.hurkot, 0),
  zuk_menders: snbt(KAL.mejjak, 0),
  zuk_jad: snbt(KAL.jad, 0),
  zuk_sets: [snbt(KAL.xil, 0), snbt(KAL.zek, 0)],
  zuk_shield: { forward: inf.shield.z - inf.zuk.z, from: inf.shield.from, to: inf.shield.to, lip: inf.lip - inf.zuk.z }
}

// ---------------------------------------------------------------- the attacks

// Jad's and Zuk's attacks hurt by a share of your health, through armour and Protection, and aren't fire (Fire
// Resistance doesn't stop them). lsp_fixes decides whether a shield or the moving shield caught them first.
const DAMAGE = {
  jad_volley: { message_id: 'lsp.jad_volley', effects: 'burning' },
  jad_slam: { message_id: 'lsp.jad_slam', effects: 'hurt' },
  zuk_volley: { message_id: 'lsp.zuk_volley', effects: 'burning' },
  kiln_fire: { message_id: 'lsp.kiln_fire', effects: 'burning' }
}
const PROPORTIONAL = ['jad_volley', 'jad_slam', 'zuk_volley']

// ---------------------------------------------------------------- write

const eventDir = path.join(ours, 'lsp_instances', 'event')
mkdirSync(eventDir, { recursive: true })
writeFileSync(path.join(eventDir, 'fight_pits.json'), JSON.stringify(fightPits, null, 2) + '\n')
writeFileSync(path.join(eventDir, 'inferno.json'), JSON.stringify(inferno, null, 2) + '\n')
const pitsDir = path.join(ours, 'lsp_pits')
rmSync(pitsDir, { recursive: true, force: true })
mkdirSync(pitsDir, { recursive: true })
writeFileSync(path.join(pitsDir, 'mobs.json'), JSON.stringify(mobs, null, 2) + '\n')
const damageDir = path.join(ours, 'damage_type')
mkdirSync(damageDir, { recursive: true })
for (const [id, d] of Object.entries(DAMAGE)) writeFileSync(path.join(damageDir, `${id}.json`), JSON.stringify({ message_id: d.message_id, scaling: 'never', exhaustion: 0.1, effects: d.effects }, null, 2) + '\n')
const tagDir = path.join(data, 'minecraft', 'tags', 'damage_type')
mkdirSync(tagDir, { recursive: true })
for (const tag of ['bypasses_armor', 'bypasses_enchantments', 'bypasses_shield', 'bypasses_cooldown', 'no_knockback'])
  writeFileSync(path.join(tagDir, `${tag}.json`), JSON.stringify({ replace: false, values: PROPORTIONAL.map((id) => `lemursaucepacket:${id}`) }, null, 2) + '\n')

const count = (ws) => ws.reduce((n, w) => n + w.spawns.reduce((m, s) => m + (s.count ?? 1), 0), 0)
console.log(`pits: the Fight Pits (${fightPits.trial.waves.length} waves, ${count(fightPits.trial.waves)} beasts), the Inferno (${inferno.trial.waves.length} waves, ${count(inferno.trial.waves)} beasts); mobs.json; ${Object.keys(DAMAGE).length} damage types`)
