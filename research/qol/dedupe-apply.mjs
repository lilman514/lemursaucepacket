// Remove duplicate rows (by file + exact feature name) and apply renames, in qol/notes/*.md.
import fs from 'node:fs'
import path from 'node:path'
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
const REMOVE = {
  'pack-systems.md': [
    "Machines won't make gated items",
    'Machines earn no skill XP',
    "Don't bind Project MMO's glossary",
    'Level-up chat lines',
    'Trains through Nether portals',
    'Create machine milestones',
    'JEI info tab',
    'Cooking recipes need Cooking'
  ],
  'inventory-ui.md': ['Graves cost Grave Essence', 'The Guide book', 'Guide in a browser', 'Talking to NPCs'],
  'gameplay.md': ['Ice and Fire axes fell trees too', "Hopper-fed pots use the last opener's level", 'Lumber Axe fells whole trees', 'Crops need Farming levels'],
  'create-core.md': ["Create-made items' worth"],
  'travel-video.md': ['Waystones on airships', 'Move the minimap and voice icons'],
  'create-addons.md': ['Ships in replays']
}
const RENAME = { 'create-addons.md': { 'Fan Catalysts': 'Fan Catalyst blocks' } }
for (const [file, features] of Object.entries(REMOVE)) {
  const p = path.join(dir, 'notes', file)
  let lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  for (const feat of features) {
    const idx = lines.findIndex((l) => l.startsWith('| ' + feat + ' |'))
    if (idx < 0) throw new Error(`not found: ${file}: ${feat}`)
    lines.splice(idx, 1)
  }
  for (const [from, to] of Object.entries(RENAME[file] || {})) {
    const idx = lines.findIndex((l) => l.startsWith('| ' + from + ' |'))
    if (idx < 0) throw new Error(`rename not found: ${file}: ${from}`)
    lines[idx] = lines[idx].replace('| ' + from + ' |', '| ' + to + ' |')
  }
  fs.writeFileSync(p, lines.join('\n'))
  console.log(file, 'removed', features.length)
}
