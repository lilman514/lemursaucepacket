#!/usr/bin/env node
// Turns capes/capes.mjs into what the pack needs, and docs/capes.md. Run `node capes/build.mjs`; publish.mjs does.
//   pack/config/lemursaucepacket/capes.json              the list: KubeJS registers the items from it
//                                                        (startup_scripts/capes.js), lsp_fixes reads it (capes package)
//   pack/kubejs/data/lemursaucepacket/curios/...         the "cape" slot, on players and armor stands
//   pack/kubejs/data/curios/tags/item/cape.json          the cape items, the only things the slot takes
//   pack/kubejs/assets/lemursaucepacket/lang/en_us.json  the slot's name (merged into what's there)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPES, NAMESPACE, reclaimOf } from './capes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = (rel, text) => {
  const file = path.join(root, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}
const json = (rel, value) => out(rel, JSON.stringify(value, null, 2) + '\n')

const list = {
  capes: Object.fromEntries(
    CAPES.map((c) => [
      c.id,
      {
        name: c.name,
        kind: c.kind,
        unlock: c.unlock,
        perk: c.perk ?? null,
        perkText: c.perkText ?? null,
        description: c.description,
        texture: `${NAMESPACE}:textures/capes/${c.id}.png`,
        frames: c.animated ?? 1,
        reclaim: reclaimOf(c),
        kit: c.kit ?? null
      }
    ])
  )
}
out('pack/config/lemursaucepacket/capes.json', JSON.stringify(list))

// The Curios slot: one cape, shown on the back (the eye toggles it), dropped on death like the rest of your things.
json('pack/kubejs/data/lemursaucepacket/curios/slots/cape.json', {
  size: 1,
  order: 85,
  icon: `${NAMESPACE}:slot/empty_cape_slot`,
  add_cosmetic: false,
  render_toggle: true,
  use_native_gui: true,
  drop_rule: 'DEFAULT',
  validators: ['curios:tag']
})
json('pack/kubejs/data/lemursaucepacket/curios/entities/capes.json', { entities: ['minecraft:player', 'minecraft:armor_stand'], slots: ['cape'] })
json('pack/kubejs/data/curios/tags/item/cape.json', { replace: false, values: CAPES.map((c) => `${NAMESPACE}:${c.id}`) })

const langFile = path.join(root, 'pack/kubejs/assets/lemursaucepacket/lang/en_us.json')
const lang = existsSync(langFile) ? JSON.parse(readFileSync(langFile, 'utf8')) : {}
lang['curios.identifier.cape'] = 'Cape'
lang['curios.modifiers.cape'] = 'When worn as a cape:'
json('pack/kubejs/assets/lemursaucepacket/lang/en_us.json', lang)

const KIND_TITLE = { skill: 'Skill capes', quest: 'Quest capes', achievement: 'Achievement capes', legendary: 'Legendary capes', owner: "The owner's cape" }
const KIND_TEXT = {
  skill: 'One per skill, at level 99. Each has a perk while worn.',
  quest: 'Finish a chapter of the quest book (its last quest hands the cape over).',
  achievement: 'Vanilla advancements that take real effort.',
  legendary: 'Animated, and exceedingly hard to earn.',
  owner: 'Not earnable.'
}
const coins = (n) => n.toLocaleString('en-US')
const lines = [
  '---',
  'description: >-',
  '  Capes you earn and wear in their own slot: one for every skill at 99, for finished chapters and for real feats. Hang',
  '  them on armor stands; lose one and you can have another made.',
  'icon: user-shield',
  '---',
  '',
  '# Capes',
  '',
  '<figure><img src="images/capes_sheet.webp" alt="Every cape\'s design as its texture in game, with its name; the legendary ones move as they do in game"><figcaption><p>Every cape there is to earn (the legendary ones move)</p></figcaption></figure>',
  '',
  "Capes are items you earn. When you earn one it goes into your bag. Everyone on the server sees the cape you wear; some have a **perk** while worn, and the legendary ones are **animated**.",
  '',
  '- **Wear it:** right-click the cape, or put it in the **Cape** slot of the Curios panel in your inventory. The eye on the slot hides it without taking it off. Only someone who has earned a cape can wear it.',
  '- **Show it off:** right-click an **armor stand** with a cape to hang it there (the one already on it comes back to you). Sneak and right-click the stand with an empty hand to take it back. A broken stand drops its cape. Any cape can go on a stand, earned or not.',
  '- **Your collection:** ESC → Capes, or `/capes`. Every cape there is: the ones you have, how to earn the rest (with how far along you are), each perk, and where to get another if you lose one. It also puts a cape from your bag on, or takes yours off.',
  '',
  // Screenshots from the 1.13 photo session (web only: a captioned figure stays out of the in-game guide).
  `<figure><img src="images/capes_collection.jpg" alt="The Capes screen: every cape by kind with how many are earned, and the chosen cape's picture, how to earn it, its perk and who makes another"><figcaption><p>ESC → Capes: your collection</p></figcaption></figure>`,
  '',
  `<figure><img src="images/capes_slot.jpg" alt="The inventory with the Curios panel open: the Infernal Cape in the Cape slot, and an Agility Cape's tooltip in the bag"><figcaption><p>The Cape slot in the Curios panel, and a cape's tooltip</p></figcaption></figure>`,
  '',
  `<figure><img src="images/capes_stands.jpg" alt="Five armor stands in Lemurton's square, each in a gear set with a cape hung on its back"><figcaption><p>Capes on armor stands</p></figcaption></figure>`,
  '',
  'Unlocks announce themselves in chat. On death a cape goes where the rest of your things go (your grave).',
  ''
]
// In-game pictures (website/tools/capes.mjs makes them from a photo session): a sheet per kind, and the animated capes
// moving side by side.
const picture = (file, alt, caption) => `<figure><img src="images/${file}" alt="${alt}"><figcaption><p>${caption}</p></figcaption></figure>`
for (const kind of ['skill', 'quest', 'achievement', 'legendary', 'owner']) {
  const capes = CAPES.filter((c) => c.kind === kind)
  if (capes.length === 0) continue
  lines.push(`## ${KIND_TITLE[kind]}`, '', KIND_TEXT[kind], '')
  // "The skill capes", "The owner's cape" (its title already starts with "The").
  const what = `The ${KIND_TITLE[kind].replace(/^The /, '').toLowerCase()}`
  if (existsSync(path.join(root, 'docs', 'images', `capes_${kind}.jpg`))) lines.push(picture(`capes_${kind}.jpg`, `${what} as worn in game`, `${what}, worn`), '')
  if (kind === 'legendary' && existsSync(path.join(root, 'docs', 'images', 'capes_animated.webp'))) lines.push(picture('capes_animated.webp', 'The animated capes in motion', 'In motion'), '')
  lines.push('| Cape | How to earn it | Perk |', '|---|---|---|')
  for (const c of capes) lines.push(`| ${c.name}${c.animated ? ' *(animated)*' : ''} | ${c.description} | ${c.perkText ?? '—'} |`)
  lines.push('')
}
lines.push('## Lost a cape?', '', "Whoever makes a cape will make you another, as long as you earned it: speak to them and choose *I've lost a cape*. Your collection shows who makes each cape and what it costs.", '')
lines.push('| Cape | Who makes another | Coins |', '|---|---|---|')
const reclaimRows = new Map()
for (const c of CAPES) {
  const r = reclaimOf(c)
  const key = r ? `${r.where}|${r.coins}|${r.note}` : 'owner'
  if (!reclaimRows.has(key)) reclaimRows.set(key, { names: [], r, kind: c.kind })
  reclaimRows.get(key).names.push(c.name)
}
for (const { names, r, kind } of reclaimRows.values()) {
  const what = kind === 'skill' && names.length > 3 ? 'Any skill cape' : names.join(', ')
  if (!r) lines.push(`| ${what} | Ask the server owner | — |`)
  else lines.push(`| ${what} | ${r.where}${r.note ? '. ' + r.note : ''} | ${coins(r.coins)} |`)
}
lines.push('', 'Every win in the Fight Pits or the Inferno hands over another of its cape, so a lost Fire or Infernal Cape can also be won back.', '')
lines.push('Generated from `capes/capes.mjs`, so this page matches the game.', '')
out('docs/capes.md', lines.join('\n'))
console.log(`capes: ${CAPES.length} capes (${CAPES.filter((c) => c.animated).length} animated); capes.json, the Curios slot and tag, docs/capes.md`)
