#!/usr/bin/env node
// Writes the Lemurton NPCs (npcs/npcs.mjs) as Easy NPC presets:
//   pack/kubejs/data/lemursaucepacket/easy_npc/preset/<model>/lemurton_<id>.npc.snbt
// structures/hub.mjs imports them in game with `easy_npc preset import data <preset> <pos> <uuid>`.
// Run `node npcs/build.mjs`; publish.mjs does too.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NPCS } from './npcs.mjs'
import { byte, float, json, long, snbt } from './snbt.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const outDir = path.join(root, 'pack', 'kubejs', 'data', 'lemursaucepacket', 'easy_npc', 'preset')
const blocks = JSON.parse(readFileSync(path.join(root, 'structures', '.blocks.json'), 'utf8'))
const items = new Set(JSON.parse(readFileSync(path.join(root, 'quests', '.registry.json'), 'utf8')).item)
// Items registered after the registry dump (structures/.blocks.json covers block items).
const known = (id) => items.has(id) || id in blocks || /^numismatics:(spur|bevel|sprocket|cog|crown|sun)$/.test(id)

const stack = (s, where) => {
  if (!known(s.id)) throw new Error(`${where}: unknown item ${s.id}`)
  return { id: s.id, count: s.count }
}

function dialogs(n, id) {
  return n.dialogs.map((d) => ({
    Label: d.label,
    Name: d.name,
    Priority: d.priority,
    Texts: [{ Text: d.text }],
    Conditions: d.conditions,
    Buttons: d.buttons.length
      ? d.buttons.map((b, i) => ({ Label: `${d.label}_${i}`, Name: b.name, Actions: b.actions, Conditions: b.conditions }))
      : undefined
  })).map((d) => {
    for (const b of d.Buttons ?? []) for (const a of b.Actions) if (a.Type === 'OPEN_NAMED_DIALOG' && !n.dialogs.some((x) => x.label === a.Cmd)) throw new Error(`${id}: button opens missing dialog ${a.Cmd}`)
    return d
  })
}

// Minecraft 1.21.1's merchant offers, {Recipes: [...]}: the shape a saved NPC has (vanilla's villager code reads
// and writes the same tag). Easy NPC also takes a plain list or Offers.Recipes.Recipes, but vanilla logs a warning
// for those.
function offers(n, id) {
  if (!n.trades?.length) return undefined
  const recipes = n.trades.map((t, i) => {
    if (t.get.length !== 1) throw new Error(`${id} trade ${i}: the player can only receive one stack`)
    if (t.pay.length > 2) throw new Error(`${id} trade ${i}: at most two stacks to pay`)
    return {
      buy: stack(t.pay[0], `${id} trade ${i}`),
      buyB: t.pay[1] ? stack(t.pay[1], `${id} trade ${i}`) : undefined,
      sell: stack(t.get[0], `${id} trade ${i}`),
      maxUses: t.maxUses,
      uses: 0,
      rewardExp: byte(0),
      xp: 0,
      priceMultiplier: float(0),
      specialPrice: 0,
      demand: 0
    }
  })
  return { Recipes: recipes }
}

function villagerData(variant) {
  const [biome, ...rest] = variant.toLowerCase().split('_')
  const profession = rest.join('_')
  return { level: 1, profession: `minecraft:${profession === 'none' ? 'none' : profession}`, type: `minecraft:${biome}` }
}

function preset(id, n) {
  const entityType = `easy_npc:${n.model}`
  const e = n.equipment ?? {}
  const item = (x) => (x ? stack({ id: x, count: 1 }, `${id} equipment`) : {})
  const objectives = [{ Type: 'LOOK_AT_PLAYER' }, { Type: 'LOOK_AT_RESET' }, ...(n.lookAround ? [{ Type: 'LOOK_RANDOM_AROUND' }] : [])]
  const data = {
    id: entityType,
    VariantType: n.variant,
    CustomName: json({ text: n.name, color: n.color }),
    CustomNameVisible: byte(1),
    Invulnerable: byte(1),
    PersistenceRequired: byte(1),
    EasyNPCVersion: 3,
    // The town's people: can't be hurt, pushed or knocked about.
    EntityAttribute: { IsInvulnerable: byte(1), IsAttackableByPlayers: byte(0), IsAttackableByMonsters: byte(0), IsPushable: byte(0), IsKnockbackResistant: byte(1) },
    ObjectiveData: { HasObjectives: byte(1), ObjectiveDataSet: objectives },
    ActionData: { ActionEventSet: { ON_INTERACTION: [{ Type: 'OPEN_DEFAULT_DIALOG' }], ON_TRADE: n.onTrade } },
    DialogData: { Type: 'STANDARD', DialogDataSet: dialogs(n, id) },
    TradingData: n.trades?.length ? { TradingDataSet: { Type: 'BASIC', MaxUses: 999, ResetsEveryMin: 60, RewardedXP: 0, LastReset: long(0) } } : undefined,
    Offers: offers(n, id),
    HandItems: [item(e.mainhand), item(e.offhand)],
    ArmorItems: [item(e.feet), item(e.legs), item(e.chest), item(e.head)],
    VillagerData: n.model === 'villager' ? villagerData(n.variant) : undefined,
    SkinData: { Type: 'DEFAULT' },
    // The safe zone exempts easy_npc entities anyway; the tag marks them as the city's own.
    Tags: ['lsp_zone_allowed', 'lemurton_npc']
  }
  return {
    PresetMetadata: { access: 'RESTRICTED', author: 'LemurSaucePacket', category: 'Lemurton', description: n.description ?? '', entityTypeId: entityType, name: n.name, variantType: n.variant, version: '1.0.0' },
    data
  }
}

rmSync(outDir, { recursive: true, force: true })
let count = 0
for (const [id, n] of Object.entries(NPCS)) {
  const dir = path.join(outDir, n.model)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, `lemurton_${id}.npc.snbt`), snbt(preset(id, n)) + '\n')
  count++
}
console.log(`${count} NPC presets -> ${path.relative(root, outDir)}`)
