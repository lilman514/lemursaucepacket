#!/usr/bin/env node
// The Keybinds page: every key a new player starts with. The game's own default for each key mapping lives in each
// mod's code, so publish/keybinds/defaults.json is a dump from a running test client (as quests/.registry.json is).
// The pack's own changes go on top, from pack/options.txt, which new installs get. pack/kubejs/client_scripts/
// keybinds.js makes the same changes on older installs; this checks that the two agree.
//
// Writes the plain tables between the keybinds markers in docs/keybinds.md (GitBook and the in-game guide book show
// those), and gives publish/docs.mjs the interactive keyboard for the web page: the markup from here, the look and
// the behaviour from publish/keybinds/keyboard.css and keyboard.js. docs.mjs runs this, so publish.mjs does too:
//
//   node publish/keybinds.mjs
//
// To refresh defaults.json after adding, removing or updating a mod that has keys:
//   1. Copy publish/keybinds/dump-keybinds.js into a test client's kubejs/startup_scripts/ (never into pack/).
//   2. From launcher/: npm run headless -- --dir <test dir> --launch --seconds 30
//      At the title screen it writes <test dir>/instance/kubejs/keybinds-dump.json.
//   3. Copy that over publish/keybinds/defaults.json and run this. It names any key mapping the group rules below
//      don't place, and any shared key where it had to guess which action colours the key (see PRIMARY).

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const here = path.join(root, 'publish', 'keybinds')
const PAGE = path.join(root, 'docs', 'keybinds.md')
const REGION = /<!-- keybinds:start[\s\S]*?<!-- keybinds:end -->/
const UNBOUND = 'key.keyboard.unknown'

/** The page's groups, in the order it lists them. keyboard.css gives each one its colour. */
const GROUPS = [
  { id: 'move', title: 'Movement and actions' },
  { id: 'items', title: 'Inventory and items' },
  { id: 'social', title: 'Chat, voice and team' },
  { id: 'maps', title: 'Maps and waypoints' },
  { id: 'quests', title: 'Quests and skills' },
  { id: 'create', title: 'Create' },
  { id: 'recipes', title: 'Recipes and info' },
  { id: 'screen', title: 'Screen and camera' },
  { id: 'replay', title: 'Replays', about: "ReForgedPlay's keys only work in the replay viewer (Replay Viewer, on the title screen), so they share keys with everyday ones." },
  { id: 'admin', title: 'Editing and cheats', about: "Editing quests and JEI's cheat mode only work for admins. JEI's edit mode hides items from your own item list." },
  { id: 'other', title: 'Other' }
]

// Which group a key mapping goes in: admin categories first, then by name, by the mod that adds it, by category.
const ADMIN_CATEGORIES = new Set(['ftbquests.gui_editor', 'ftbquests.gui_quest_panel', 'jei.key.category.cheat.mode', 'jei.key.category.hover.config.button', 'jei.key.category.edit.mode', 'jei.key.category.dev.tools'])
const GROUP_BY_NAME = { 'key.advancements': 'quests' }
const GROUP_BY_MOD = {
  curios: 'items', inventoryessentials: 'items', relics: 'items', sophisticatedbackpacks: 'items', sophisticatedcore: 'items',
  ftbteams: 'social', voicechat: 'social',
  xaerominimap: 'maps', xaeroworldmap: 'maps',
  brassworksmissions: 'quests', ftbquests: 'quests', pmmo: 'quests',
  copycats: 'create', create: 'create', create_cyber_goggles: 'create', createrailwaysnavigator: 'create', ponder: 'create', simulated: 'create',
  jade: 'recipes', jei: 'recipes', kubejs: 'recipes',
  entityculling: 'screen', iris: 'screen', justzoom: 'screen', lsp_fixes: 'screen', modernfix: 'screen', shouldersurfing: 'screen',
  duperautowalk: 'move', replaymod: 'replay'
}
// (Ice and Fire's dragon keys sit in Gameplay, Dynamic FPS and LambDynamicLights in Miscellaneous, Legendary Tooltips in Inventory.)
const GROUP_BY_CATEGORY = { 'key.categories.movement': 'move', 'key.categories.gameplay': 'move', 'key.categories.inventory': 'items', 'key.categories.creative': 'items', 'key.categories.multiplayer': 'social', 'key.categories.misc': 'screen' }

// Where a key works, when that isn't everywhere: by name (now and then, or `menu` for a screen), then by category
// and by NeoForge key conflict context (both screens).
const WHERE_BY_NAME = [
  [/^key\.dragon_/, 'riding a dragon'],
  [/^key\.(save|load)ToolbarActivator$/, 'in Creative mode'],
  [/^key\.shouldersurfing\.adjust_camera_/, 'in the over-the-shoulder view'],
  [/^create\.keyinfo\.toolbelt$/, 'hold it near a Toolbox'],
  [/^key\.ponder\.ponder$/, 'hold it over an item in a menu', 'menu'],
  [/^key\.replaymod\.(?!settings$)/, 'in the replay viewer'],
  // Their conflict context says any menu, but they only act in Sophisticated's own screens (tryCallTransferToStorage).
  [/^key\.sophisticatedcore\.transfer_to_(storage|inventory)$/, 'in a backpack or storage screen']
]
const WHERE_BY_CATEGORY = {
  'ftbquests.gui': 'in the quest book',
  'ftbquests.gui_editor': 'editing quests',
  'ftbquests.gui_quest_panel': 'editing a quest',
  'jei.key.category.cheat.mode': "in JEI's cheat mode",
  'jei.key.category.edit.mode': "in JEI's edit mode",
  'jei.key.category.recipe.gui': 'in a recipe screen',
  'jei.key.category.search': "in JEI's search bar"
}
const WHERE_BY_CONTEXT = {
  GUI: 'in menus',
  JEI_GUI_HOVER: 'over an item in a menu',
  JEI_GUI_HOVER_SEARCH: "over JEI's search bar",
  JEI_GUI_HOVER_CHEAT_MODE: "over an item, in JEI's cheat mode",
  JEI_GUI_HOVER_CONFIG_BUTTON: "over JEI's config button",
  'net.p3pp3rf1y.sophisticatedcore.client.ClientEventHandler$SophisticatedScreenKeyConflictContext': 'in a backpack or storage screen',
  'net.p3pp3rf1y.sophisticatedcore.client.ClientEventHandler$ContainerScreenKeyConflictContext': 'in menus'
}

/** A few words more on what an action does in this pack. */
const NOTES = {
  'key.inventory': 'with your skills panel: click a skill for what every level unlocks',
  'key.sophisticatedbackpacks.open_backpack': "the one you're wearing",
  'key.brassworksmissions.open_missions_ui': "this week's missions",
  'key.ftbteams.open_gui': 'your team',
  'key.duperautowalk.autowalk': 'press it again, or walk backwards, to stop'
}

/** The action that colours a key, where the rules (fewest conditions first, then Minecraft's own) would pick a less useful one. */
const PRIMARY = { 'key.keyboard.r': 'iris.keybind.reload' }

/** Unbound key mappings the page doesn't suggest binding. */
const NOT_LISTED = new Set([
  'key.pmmo.openMenu', // the glossary crashes with Sodium in this pack (keybinds.js); the inventory's skills panel is the skills screen
  'key.pmmo.showVein', 'key.pmmo.addVein', 'key.pmmo.subVein', 'key.pmmo.cyclevein', 'key.pmmo.vein', // vein mining is off
  'key.inventoryessentials.sort_inventory', // Inventory Profiles Next does the sorting
  'key.kubejs.kubedex', 'key.jei.copy.recipe.id', 'key.entityculling.toggle', 'iris.keybind.wireframe', 'key.modernfix.config' // tools for pack makers
])

/** Keys built into Minecraft. The Controls screen doesn't list them, so the dump can't see them. */
const BUILT_IN = [
  { name: 'builtin.escape', title: 'Open the ESC menu', key: 'key.keyboard.escape' },
  { name: 'builtin.f1', title: 'Hide the HUD', key: 'key.keyboard.f1' },
  { name: 'builtin.f3', title: 'Show the debug screen', key: 'key.keyboard.f3' }
]

// The keyboard, a full-size one in key units, row by row: `_n` is a gap, `name:w:h` a key w wide and h tall.
const BLOCKS = {
  main: [
    'escape _1 f1 f2 f3 f4 _.5 f5 f6 f7 f8 _.5 f9 f10 f11 f12',
    'grave.accent 1 2 3 4 5 6 7 8 9 0 minus equal backspace:2',
    'tab:1.5 q w e r t y u i o p left.bracket right.bracket backslash:1.5',
    'caps.lock:1.75 a s d f g h j k l semicolon apostrophe enter:2.25',
    'left.shift:2.25 z x c v b n m comma period slash right.shift:2.75',
    'left.control:1.25 left.win:1.25 left.alt:1.25 space:6.25 right.alt:1.25 right.win:1.25 menu:1.25 right.control:1.25'
  ],
  nav: ['print.screen scroll.lock pause', 'insert home page.up', 'delete end page.down', '', '_1 up', 'left down right'],
  pad: [
    '',
    'num.lock keypad.divide keypad.multiply keypad.subtract',
    'keypad.7 keypad.8 keypad.9 keypad.add:1:2',
    'keypad.4 keypad.5 keypad.6',
    'keypad.1 keypad.2 keypad.3 keypad.enter:1:2',
    'keypad.0:2 keypad.decimal'
  ]
}
const LABELS = {
  escape: 'Esc', backspace: 'Backspace', tab: 'Tab', 'caps.lock': 'Caps Lock', enter: 'Enter', 'left.shift': 'Shift', 'right.shift': 'Shift',
  'left.control': 'Ctrl', 'right.control': 'Ctrl', 'left.win': 'Win', 'right.win': 'Win', 'left.alt': 'Alt', 'right.alt': 'Alt', menu: 'Menu', space: 'Space',
  'print.screen': 'PrtSc', 'scroll.lock': 'ScrLk', pause: 'Pause', insert: 'Ins', home: 'Home', 'page.up': 'PgUp', delete: 'Del', end: 'End', 'page.down': 'PgDn',
  up: '↑', left: '←', down: '↓', right: '→', 'num.lock': 'Num', 'keypad.enter': 'Enter', 'keypad.decimal': '.'
}
const MOUSE = [
  ['left', 'Left'],
  ['middle', ''],
  ['right', 'Right'],
  ['4', '4'],
  ['5', '5']
]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const groupIndex = (id) => GROUPS.findIndex((g) => g.id === id)

/** pack/options.txt's key lines: name → { key, modifier }. */
function readOptions() {
  const options = new Map()
  for (const line of readFileSync(path.join(root, 'pack', 'options.txt'), 'utf8').split(/\r?\n/)) {
    const m = /^key_([^:]+):([^:\s]+)(?::(\w+))?/.exec(line)
    if (m) options.set(m[1], { key: m[2], modifier: m[3] ?? 'NONE' })
  }
  return options
}

/** keybinds.js's KEYBIND_RULES: [name, only if on, move to]. */
function readRules() {
  const text = readFileSync(path.join(root, 'pack', 'kubejs', 'client_scripts', 'keybinds.js'), 'utf8')
  const block = /KEYBIND_RULES\s*=\s*\[([\s\S]*?)\n\]/.exec(text)?.[1] ?? ''
  return [...block.matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)].map((m) => m.slice(1))
}

/** The key mappings the ESC menu's buttons press (FancyMenu's mimic_keybind actions). */
function readEscMenu() {
  const text = readFileSync(path.join(root, 'pack', 'config', 'fancymenu', 'customization', 'lemursaucepacket_pause.txt'), 'utf8')
  return new Set([...text.matchAll(/mimic_keybind;([^%|\s]+)/g)].map((m) => m[1]))
}

/** options.txt and keybinds.js must move the same keys: one is for new installs, the other for older ones. */
function checkRules(mappings, options, rules) {
  const problems = []
  const byName = new Map(mappings.map((m) => [m.name, m]))
  for (const [name, from, to] of rules) {
    const m = byName.get(name)
    if (!m) problems.push(`keybinds.js moves ${name}, which the game doesn't have`)
    else if (m.key === from && options.get(name)?.key !== to) problems.push(`keybinds.js moves ${name} to ${to}, but options.txt has ${options.get(name)?.key ?? 'nothing for it'}`)
  }
  for (const [name, set] of options) {
    const m = byName.get(name)
    if (!m) problems.push(`options.txt sets ${name}, which the game doesn't have`)
    else if ((set.key !== m.key || set.modifier !== m.modifier) && !rules.some(([n, from, to]) => n === name && from === m.key && to === set.key))
      problems.push(`options.txt moves ${name} from ${m.key} to ${set.key}, but keybinds.js doesn't move it on older installs`)
  }
  return problems
}

/** Everything the page shows, from the dump and the pack. */
function buildModel() {
  const dump = JSON.parse(readFileSync(path.join(here, 'defaults.json'), 'utf8'))
  const options = readOptions()
  const escMenu = readEscMenu()
  const problems = checkRules(dump.keyMappings, options, readRules())
  const notes = []
  const keyName = (id) => dump.keys[id] ?? id
  const keyLabel = (key, modifier) => (modifier === 'NONE' ? keyName(key) : (dump.modifiers[modifier] ?? `${modifier} + %s`).replace('%s', keyName(key)))

  const bound = []
  const unbound = []
  dump.keyMappings.forEach((m, order) => {
    const modId = m.owner?.startsWith('mod/') ? m.owner.slice(4).split(',')[0] : m.owner === 'vanilla' ? 'minecraft' : m.ownerNamespace
    if (!modId) problems.push(`${m.name}: no language file names it, so its mod is unknown`)
    let group = ADMIN_CATEGORIES.has(m.category) ? 'admin' : GROUP_BY_NAME[m.name] ?? GROUP_BY_MOD[modId] ?? GROUP_BY_CATEGORY[m.category]
    if (!group) {
      problems.push(`${m.name} (${m.categoryTitle}, ${modId}) has no group: add its mod or category to the group rules`)
      group = 'other'
    }
    const byName = WHERE_BY_NAME.find(([re]) => re.test(m.name))
    const where = byName?.[1] ?? WHERE_BY_CATEGORY[m.category] ?? WHERE_BY_CONTEXT[m.context] ?? ''
    // Rank: how many conditions the key has, so the key's colour comes from what it does in plain play.
    const rank = (byName ? (byName[2] === 'menu' ? 2 : 1) : where ? 2 : 0) + (group === 'admin' ? 6 : 0)
    const set = options.get(m.name)
    const key = set ? set.key : m.key
    const modifier = set ? set.modifier : m.modifier
    const moved = !set || (set.key === m.key && set.modifier === m.modifier) ? '' : m.key === UNBOUND ? 'set by the pack' : `moved from ${keyLabel(m.key, m.modifier)} by the pack`
    const b = { name: m.name, action: m.title, group, modId, mod: dump.mods[modId] ?? modId ?? m.categoryTitle, key, modifier, where, note: NOTES[m.name] ?? '', escMenu: escMenu.has(m.name), moved, rank: rank + (modifier === 'NONE' ? 0 : 3), order }
    if (key !== UNBOUND) bound.push(b)
    else if (!NOT_LISTED.has(m.name)) unbound.push(b)
  })
  for (const k of BUILT_IN) bound.push({ name: k.name, action: k.title, group: 'screen', modId: 'minecraft', mod: 'Minecraft', key: k.key, modifier: 'NONE', where: '', note: "built into Minecraft, can't be changed", escMenu: false, moved: '', rank: 0, order: -1 })
  for (const name of escMenu) if (!bound.some((b) => b.name === name)) problems.push(`the ESC menu presses ${name}, which has no key`)

  const mouse = (b) => b.key.startsWith('key.mouse.')
  bound.sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || a.rank - b.rank || mouse(a) - mouse(b) || a.order - b.order)
  bound.forEach((b, i) => {
    b.i = i
    b.label = keyLabel(b.key, b.modifier)
  })
  unbound.sort((a, b) => groupIndex(a.group) - groupIndex(b.group) || a.order - b.order)

  // Each key's actions, the one that colours it first: a pick from PRIMARY, then fewest conditions, Minecraft's own,
  // the group with the most actions on the key, the page's group order.
  const byKey = new Map()
  for (const b of bound) byKey.set(b.key, [...(byKey.get(b.key) ?? []), b])
  for (const [key, list] of byKey) {
    const count = {}
    for (const b of list) count[b.group] = (count[b.group] ?? 0) + 1
    const pick = PRIMARY[key]
    const tie = (a, b) => a.rank - b.rank || (b.modId === 'minecraft') - (a.modId === 'minecraft') || count[b.group] - count[a.group]
    list.sort((a, b) => (b.name === pick) - (a.name === pick) || tie(a, b) || groupIndex(a.group) - groupIndex(b.group) || a.i - b.i)
    if (!pick && list.length > 1 && list[0].group !== list[1].group && tie(list[0], list[1]) === 0)
      notes.push(`${keyName(key)}: ${list[0].action} (${list[0].mod}) colours it over ${list[1].action} (${list[1].mod}) only by group order; PRIMARY can pick`)
  }
  return { bound, unbound, byKey, keyName, problems, notes }
}

// ---------------------------------------------------------------- the markdown (GitBook, the guide book)

// The admins' keys and the unbound list stay out of the in-game book (publish/patchouli.mjs skips book:skip parts).
const BOOK_SKIP = new Set(['admin'])

function markdown(model) {
  const extras = (b) => [b.where, b.note, b.escMenu ? 'also on the ESC menu' : ''].filter(Boolean)
  const lines = ['<!-- keybinds:start: publish/keybinds.mjs writes this part from the game and pack/options.txt; change those, not this -->', '', '## Every keybind', '']
  for (const g of GROUPS) {
    const rows = model.bound.filter((b) => b.group === g.id)
    if (rows.length === 0) continue
    if (BOOK_SKIP.has(g.id)) lines.push('<!-- book:skip -->', '')
    lines.push(`### ${g.title}`, '')
    if (g.about) lines.push(g.about, '')
    lines.push('| Key | Action | Mod |', '|---|---|---|')
    for (const b of rows) lines.push(`| ${b.label} | ${b.action}${extras(b).length ? ` (${extras(b).join('; ')})` : ''} | ${b.mod} |`)
    lines.push('')
    if (BOOK_SKIP.has(g.id)) lines.push('<!-- book:end -->', '')
  }
  if (model.unbound.length > 0) {
    lines.push('<!-- book:skip -->', '', '### Not bound by default', '', 'These have no key until you give them one in Key Binds.', '', '| Mod | Actions |', '|---|---|')
    for (const [mod, list] of unboundByMod(model.unbound)) lines.push(`| ${mod} | ${list.map((b) => b.action).join(', ')} |`)
    lines.push('', '<!-- book:end -->', '')
  }
  lines.push('<!-- keybinds:end -->')
  return lines.join('\n')
}

/** Unbound actions by mod, in the page's group order. */
function unboundByMod(list) {
  const byMod = new Map()
  for (const b of list) byMod.set(b.mod, [...(byMod.get(b.mod) ?? []), b])
  return byMod
}

// ---------------------------------------------------------------- the web page's keyboard and list

function blockKeys(rows) {
  const keys = []
  rows.forEach((row, r) => {
    let x = 0
    for (const token of row.split(' ').filter(Boolean)) {
      if (token.startsWith('_')) {
        x += Number(token.slice(1))
        continue
      }
      const [id, w = 1, h = 1] = token.split(':')
      // Grid rows: the function row, a thin gap, then the five main rows.
      keys.push({ id, x, y: r === 0 ? 1 : r + 2, w: Number(w), h: Number(h) })
      x += Number(w)
    }
  })
  return keys
}

function keyButton(model, id, label, style, extraClass = '') {
  const list = model.byKey.get(id) ?? []
  const name = model.keyName(id)
  const groups = [...new Set(list.map((b) => b.group))]
  const aria = list.length === 0 ? `${name}: not bound` : `${name}: ${list[0].action}${list.length > 1 ? `, and ${list.length - 1} more` : ''}`
  const cls = ['k', label.length > 3 ? 's' : '', list.length ? `g-${list[0].group}` : '', extraClass].filter(Boolean).join(' ')
  const marks = list.length === 0 ? '' : `<i class="lip">${groups.map((g) => `<b class="g-${g}"></b>`).join('')}</i>${list.length > 1 ? `<em>${list.length}</em>` : ''}`
  return `<button type="button" class="${cls}"${style ? ` style="${style}"` : ''} data-k="${id}" data-n="${esc(name)}"${list.length ? ` data-b="${list.map((b) => b.i).join(' ')}"` : ''} aria-label="${esc(aria)}" tabindex="-1">${esc(label)}${marks}</button>`
}

function keyboardHtml(model) {
  const blocks = Object.entries(BLOCKS).map(([block, rows]) => {
    const keys = blockKeys(rows)
    const cols = Math.max(...keys.map((k) => (k.x + k.w) * 4))
    const buttons = keys.map((k) => {
      // The cap shows the game's own name for the key ("Q", "F1", ";"), shortened where it's long.
      const name = model.keyName(`key.keyboard.${k.id}`)
      const label = LABELS[k.id] ?? (k.id.startsWith('keypad.') ? name.replace(/^Keypad /, '') : name)
      return keyButton(model, `key.keyboard.${k.id}`, label, `grid-area:${k.y}/${k.x * 4 + 1}/span ${k.h}/span ${k.w * 4}`)
    })
    return `<div class="kb-block kb-${block}" style="--cols:${cols}">${buttons.join('')}</div>`
  })
  // The mouse: its three buttons, and the side buttons only when something is bound to them.
  const mouse = MOUSE.filter(([id]) => ['left', 'middle', 'right'].includes(id) || model.byKey.has(`key.mouse.${id}`)).map(([id, label]) => keyButton(model, `key.mouse.${id}`, label, '', `m-${id}`))
  return `<div class="kb-keys" role="group" aria-label="Keyboard">${blocks.join('')}</div><div class="kb-mouse" role="group" aria-label="Mouse">${mouse.join('')}<span class="m-body"></span></div><div class="kb-info"></div>`
}

function listHtml(model) {
  const kbd = (label) => label.split(' + ').map((part) => `<kbd>${esc(part)}</kbd>`).join(' + ')
  let html = '<h2 id="every-keybind">Every keybind</h2><p class="kb-count" aria-live="polite"></p>'
  for (const g of GROUPS) {
    const rows = model.bound.filter((b) => b.group === g.id)
    if (rows.length === 0) continue
    html += `<section class="kb-sec" data-g="${g.id}"><h3 id="kb-${g.id}"><i class="kb-sw g-${g.id}"></i>${esc(g.title)}</h3>${g.about ? `<p>${esc(g.about)}</p>` : ''}`
    html += '<table><thead><tr><th scope="col">Key</th><th scope="col">Action</th><th scope="col">Mod</th></tr></thead><tbody>'
    for (const b of rows) {
      const small = [b.where, b.note].filter(Boolean).join('; ')
      const tags = [b.escMenu ? 'ESC menu' : '', b.moved].filter(Boolean)
      html +=
        `<tr data-i="${b.i}" data-k="${b.key}" data-g="${b.group}" data-m="${b.modifier}"><td>${kbd(b.label)}</td>` +
        `<td><span class="kb-act">${esc(b.action)}</span>${small ? ` <small>${esc(small)}</small>` : ''}${tags.map((t) => ` <span class="kb-tag">${esc(t)}</span>`).join('')}<span class="kb-mod">${esc(b.mod)}</span></td>` +
        `<td>${esc(b.mod)}</td></tr>`
    }
    html += '</tbody></table></section>'
  }
  if (model.unbound.length > 0) {
    html += '<section class="kb-sec kb-free"><h3 id="kb-unbound">Not bound by default</h3><p>These have no key until you give them one in Key Binds.</p>'
    html += '<table><thead><tr><th scope="col">Mod</th><th scope="col">Actions</th></tr></thead><tbody>'
    for (const [mod, list] of unboundByMod(model.unbound))
      html += `<tr data-mod="${esc(mod)}"><td>${esc(mod)}</td><td>${list.map((b) => `<span class="kb-u" data-g="${b.group}">${esc(b.action)}</span>`).join(' ')}</td></tr>`
    html += '</tbody></table>'
    html += '</section>'
  }
  return html
}

function widgetHtml(model) {
  const count = (id) => model.bound.filter((b) => b.group === id).length
  const chips = [
    `<button type="button" class="kb-chip" data-g="" aria-pressed="true">All <span>${model.bound.length}</span></button>`,
    ...GROUPS.filter((g) => count(g.id) > 0).map((g) => `<button type="button" class="kb-chip g-${g.id}" data-g="${g.id}" data-t="${esc(g.title)}" aria-pressed="false"><i></i>${esc(g.title)} <span>${count(g.id)}</span></button>`)
  ]
  return (
    '<div class="kb" id="keyboard">' +
    `<div class="kb-bar"><input class="kb-find" type="search" placeholder="Find an action" aria-label="Find an action" autocomplete="off" spellcheck="false"><div class="kb-chips" role="group" aria-label="Show only">${chips.join('')}</div></div>` +
    `<p class="kb-help">The keys you start with are lit, in the colour of what they're for. Point at a key, tap it, or reach it with the arrow keys to see everything it does. Click an action in the list to find its key.</p>` +
    `<div class="kb-board">${keyboardHtml(model)}</div><p class="kb-say" aria-live="polite"></p>` +
    `<div class="kb-list">${listHtml(model)}</div>` +
    '</div>'
  )
}

/** Writes docs/keybinds.md's generated part and returns the web page's keyboard for docs.mjs. */
export function buildKeybinds() {
  const model = buildModel()
  const page = readFileSync(PAGE, 'utf8')
  if (!REGION.test(page)) throw new Error('docs/keybinds.md needs the <!-- keybinds:start --> and <!-- keybinds:end --> markers, each on a line of its own')
  const next = page.replace(REGION, markdown(model))
  if (next !== page) writeFileSync(PAGE, next)
  for (const p of model.problems) console.warn(`keybinds: ${p}`)
  for (const n of model.notes) console.log(`keybinds: note: ${n}`)
  const asset = (file) => readFileSync(path.join(here, file), 'utf8')
  return {
    region: REGION,
    html: widgetHtml(model),
    css: asset('keyboard.css'),
    js: asset('keyboard.js'),
    summary: `${model.bound.length} keybinds on ${model.byKey.size} keys, ${model.unbound.length} more not bound`
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(`keybinds: ${buildKeybinds().summary}; docs/keybinds.md`)
}
