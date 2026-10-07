#!/usr/bin/env node
// Turns capes/capes.mjs into pack/config/lemursaucepacket/capes.json (read by the server and client cape
// scripts) and docs/capes.md. Run `node capes/build.mjs`; publish.mjs does.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPES, NAMESPACE } from './capes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = (rel, text) => {
  const file = path.join(root, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, text)
}

const json = {
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
        frames: c.animated ?? 1
      }
    ])
  )
}
out('pack/config/lemursaucepacket/capes.json', JSON.stringify(json))

const KIND_TITLE = { skill: 'Skill capes', quest: 'Quest capes', achievement: 'Achievement capes', legendary: 'Legendary capes', owner: "The owner's cape" }
const KIND_TEXT = {
  skill: 'One per skill, at level 99. Each has a perk while worn.',
  quest: 'Finish a chapter of the quest book (its last quest hands the cape over).',
  achievement: 'Vanilla advancements that take real effort.',
  legendary: 'Animated, and exceedingly hard to earn.',
  owner: 'Not earnable.'
}
const lines = [
  '---',
  'description: >-',
  '  Cosmetics you earn, never buy: a cape for every skill at 99, for finished chapters and for real feats.',
  'icon: user-shield',
  '---',
  '',
  '# Capes',
  '',
  '<figure><img src="images/capes_sheet.jpg" alt="Sixteen capes with skill and chapter emblems"><figcaption><p>Some of the capes there are to earn</p></figcaption></figure>',
  '',
  'Capes are cosmetics you earn, not items: nothing to craft, nothing to lose. Everyone on the server sees the cape you wear. Some capes have a **perk** while worn; the legendary ones are **animated**.',
  '',
  '**Wardrobe:** ESC → Capes, or `/capes`. It lists what you have unlocked; click a cape to wear it, or `/capes off` for none. Unlocks announce themselves in chat.',
  ''
]
// In-game pictures (website/tools/capes.mjs makes them from a photo session): a sheet per kind, and the animated capes
// moving side by side.
const picture = (file, alt, caption) => `<figure><img src="images/${file}" alt="${alt}"><figcaption><p>${caption}</p></figcaption></figure>`
for (const kind of ['skill', 'quest', 'achievement', 'legendary', 'owner']) {
  const list = CAPES.filter((c) => c.kind === kind)
  if (list.length === 0) continue
  lines.push(`## ${KIND_TITLE[kind]}`, '', KIND_TEXT[kind], '')
  if (existsSync(path.join(root, 'docs', 'images', `capes_${kind}.jpg`))) lines.push(picture(`capes_${kind}.jpg`, `The ${KIND_TITLE[kind].toLowerCase()} as worn in game`, `The ${KIND_TITLE[kind].toLowerCase()}, worn`), '')
  if (kind === 'legendary' && existsSync(path.join(root, 'docs', 'images', 'capes_animated.webp'))) lines.push(picture('capes_animated.webp', 'The animated capes in motion', 'In motion'), '')
  lines.push('| Cape | How to earn it | Perk |', '|---|---|---|')
  for (const c of list) lines.push(`| ${c.name}${c.animated ? ' *(animated)*' : ''} | ${c.description} | ${c.perkText ?? '—'} |`)
  lines.push('')
}
lines.push('Generated from `capes/capes.mjs`, so this page matches the game.', '')
out('docs/capes.md', lines.join('\n'))
console.log(`capes: ${CAPES.length} capes (${CAPES.filter((c) => c.animated).length} animated); capes.json and docs/capes.md`)
