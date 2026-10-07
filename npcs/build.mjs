#!/usr/bin/env node
// Writes the Lemurton NPCs (npcs/npcs.mjs) and the economy's data:
//   pack/kubejs/data/lemursaucepacket/easy_npc/preset/<model>/lemurton_<id>.npc.snbt   Easy NPC presets
//   pack/kubejs/data/lemursaucepacket/lsp_npcs/<id>.json                               shops, talks, quests (lsp_fixes)
//   pack/kubejs/data/lemursaucepacket/lsp_economy/values.json                          what vendors pay (npcs/values.mjs)
//   pack/kubejs/data/lemursaucepacket/lsp_quests/<quest>.json                          quest steps (npcs/quests.mjs)
// structures/hub.mjs imports the presets in game with `easy_npc preset import data <preset> <pos> <uuid>`.
// Run `node npcs/build.mjs`; publish.mjs does too.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NPCS, QUESTS } from './npcs.mjs'
import { ECONOMY } from './values.mjs'
import { QUEST_STEPS } from './quests.mjs'
import { byte, json, snbt } from './snbt.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const dataDir = path.join(root, 'pack', 'kubejs', 'data', 'lemursaucepacket')
const outDir = path.join(dataDir, 'easy_npc', 'preset')
const npcDir = path.join(dataDir, 'lsp_npcs')
const economyDir = path.join(dataDir, 'lsp_economy')
const questDir = path.join(dataDir, 'lsp_quests')
const blocks = JSON.parse(readFileSync(path.join(root, 'structures', '.blocks.json'), 'utf8'))
const items = new Set(JSON.parse(readFileSync(path.join(root, 'quests', '.registry.json'), 'utf8')).item)
// Items registered after the registry dump (structures/.blocks.json covers block items).
const known = (id) => (items.has(id) || id in blocks) && !id.startsWith('numismatics:')

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
    // lsp_fixes handles right-clicks on these NPCs (talk first, then the shop); this is the fallback without it.
    ActionData: { ActionEventSet: { ON_INTERACTION: [{ Type: 'OPEN_DEFAULT_DIALOG' }] } },
    DialogData: { Type: 'STANDARD', DialogDataSet: dialogs(n, id) },
    HandItems: [item(e.mainhand), item(e.offhand)],
    ArmorItems: [item(e.feet), item(e.legs), item(e.chest), item(e.head)],
    VillagerData: n.model === 'villager' ? villagerData(n.variant) : undefined,
    SkinData: { Type: 'DEFAULT' },
    // The safe zone exempts easy_npc entities anyway; lemurton_npc marks them as the city's own and lsp_npc.<id> tells
    // lsp_fixes which of the townsfolk (lsp_npcs/<id>.json) this is.
    Tags: ['lsp_zone_allowed', 'lemurton_npc', `lsp_npc.${id}`, ...(n.tags ?? [])]
  }
  return {
    PresetMetadata: { access: 'RESTRICTED', author: 'LemurSaucePacket', category: 'Lemurton', description: n.description ?? '', entityTypeId: entityType, name: n.name, variantType: n.variant, version: '1.0.0' },
    data
  }
}

/** What lsp_fixes reads: the shop (goods in Gold Coins), the talks that play before it, and the quests it shows. */
function economy(id, n) {
  const vendor = n.goods?.length > 0
  for (const t of n.talks ?? []) if (!n.dialogs.some((d) => d.label === t.dialog)) throw new Error(`${id}: talk plays missing dialog ${t.dialog}`)
  const talks = [...(n.talks ?? [])]
  // A vendor's first right-click is their greeting; the shop opens from the next one.
  if (vendor) talks.push({ dialog: 'default', intro: true })
  const out = { name: n.name, color: n.color, talks }
  if (vendor) {
    out.shop = {
      goods: n.goods.map((g, i) => {
        const where = `${id} good ${i}`
        if (!known(g.item.id)) throw new Error(`${where}: unknown item ${g.item.id}`)
        if (!(g.price > 0) || !Number.isInteger(g.price)) throw new Error(`${where}: price must be a whole number of coins`)
        return { item: { id: g.item.id, count: g.count, components: g.item.components }, price: g.price }
      }),
      onBuy: n.onBuy ?? []
    }
  }
  if (n.quests?.length) {
    out.quests = n.quests.map((q) => {
      if (!QUESTS[q]) throw new Error(`${id}: unknown quest line ${q}`)
      return QUESTS[q]
    })
  }
  return out
}

rmSync(outDir, { recursive: true, force: true })
rmSync(npcDir, { recursive: true, force: true })
mkdirSync(npcDir, { recursive: true })
let count = 0
for (const [id, n] of Object.entries(NPCS)) {
  const dir = path.join(outDir, n.model)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, `lemurton_${id}.npc.snbt`), snbt(preset(id, n)) + '\n')
  writeFileSync(path.join(npcDir, `${id}.json`), JSON.stringify(economy(id, n), null, 2) + '\n')
  count++
}
// Quest steps: every item they take or give must exist, and every dialog they open must be one of the NPCs'.
const dialogLabels = new Set(Object.values(NPCS).flatMap((n) => n.dialogs.map((d) => d.label)))
rmSync(questDir, { recursive: true, force: true })
mkdirSync(questDir, { recursive: true })
let steps = 0
for (const [id, q] of Object.entries(QUEST_STEPS)) {
  for (const [key, st] of Object.entries(q.steps)) {
    const where = `quest ${id} step ${key}`
    for (const t of st.take ?? []) if (!known(t.id) && !t.id.startsWith('iceandfire:')) throw new Error(`${where}: unknown item ${t.id}`)
    for (const g of st.give ?? []) if (!known(g.id)) throw new Error(`${where}: unknown item ${g.id}`)
    for (const d of [st.ok, st.missing, st.done]) if (d && !dialogLabels.has(d)) throw new Error(`${where}: no NPC has a dialog '${d}'`)
    for (const stage of [...(st.needs ?? []), ...(st.lacks ?? []), st.stage].filter(Boolean)) if (!q.stages.includes(stage) && !/^q_welcome_/.test(stage)) throw new Error(`${where}: stage ${stage} isn't one of the quest's`)
    steps++
  }
  writeFileSync(path.join(questDir, `${id}.json`), JSON.stringify(q, null, 2) + '\n')
}

mkdirSync(economyDir, { recursive: true })
writeFileSync(path.join(economyDir, 'values.json'), JSON.stringify(ECONOMY, null, 2) + '\n')
console.log(`${count} NPC presets -> ${path.relative(root, outDir)}; shops and talks -> ${path.relative(root, npcDir)}; ${Object.keys(ECONOMY.values).length} base values -> ${path.relative(root, economyDir)}; ${Object.keys(QUEST_STEPS).length} quests (${steps} steps) -> ${path.relative(root, questDir)}`)
