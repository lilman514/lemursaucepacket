// The ESC menu ("hub"): one set of coordinates shared by the board texture (pixel-kit.mjs draws the recesses
// into it), the FancyMenu layout written here, and the client script that moves the vanilla pause buttons
// into the middle panel (pack/kubejs/client_scripts/pause_hub.js reads the same numbers from HUB_LAYOUT).
//
// Everything is in GUI pixels relative to the screen centre and fits the smallest GUI size Minecraft
// auto-picks (426x240 at 1280x720). Bigger screens just get more margin.

import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

export const BOARD = { x: -208, y: -116, w: 416, h: 232 }
// Recessed panels, relative to the screen centre.
export const PANELS = {
  left: { x: -200, y: -78, w: 90, h: 186 },
  center: { x: -106, y: -78, w: 212, h: 186 },
  right: { x: 110, y: -78, w: 90, h: 186 }
}
export const PLAQUE = { x: -60, y: -110, w: 120, h: 28 }
export const BUTTON = { w: 84, h: 20, pitch: 23 }
// The vanilla pause buttons, packed two per row inside the centre panel (see pause_hub.js).
export const VANILLA = { x: -102, y: -50, fullWidth: 204, halfWidth: 98, pitch: 23, trayY: 88 }

const ASSET = '[source:local]/config/fancymenu/assets/lemursaucepacket'
// A plain mimic is one click. Mods that read the key with isDown() on a client tick (Project MMO's menu key)
// need it held for a moment: FancyMenu's "keybind|||hold|||milliseconds" form.
const KEY = (name, holdMs = 0) => `mimic_keybind;${name}${holdMs ? `|||true|||${holdMs}` : ''}`
const CLOSE_THEN = (action) => `closegui%btnaction_splitter_fm%${action}%btnaction_splitter_fm%`

/** Hub buttons: [id, label, tooltip, action, icon file]. Keys are the pack's defaults (see options.txt). */
export const HUB_BUTTONS = {
  left: [
    ['map', 'Map', 'The world map (M)', CLOSE_THEN(KEY('gui.xaero_open_map')), 'map'],
    ['quests', 'Quests', 'The quest book: guided goals with rewards', CLOSE_THEN('sendmessage;/ftbquests open_book'), 'quests'],
    ['missions', 'Missions', "This week's Create missions (H)", CLOSE_THEN(KEY('key.brassworksmissions.open_missions_ui')), 'missions'],
    ['claims', 'Claims', "Claim land and choose who can use it (')", CLOSE_THEN(KEY('gui.xaero_pac_key_open_menu')), 'claims']
  ],
  right: [
    ['skills', 'Skills', 'Your skills, levels and what they unlock (K)', CLOSE_THEN(KEY('key.pmmo.openMenu', 150)), 'skills'],
    ['backpack', 'Backpack', "Open the backpack you're wearing (B)", CLOSE_THEN(KEY('key.sophisticatedbackpacks.open_backpack')), 'backpack'],
    ['team', 'Team', 'Your team: invite friends, share claims (;)', CLOSE_THEN(KEY('key.ftbteams.open_gui')), 'team'],
    ['voice', 'Voice', 'Voice chat: volume, groups and your microphone (V)', CLOSE_THEN(KEY('key.voice_chat')), 'voice']
  ]
}

// Minecraft's font: 5px glyphs plus 1px spacing for most capitals (I is 3+1), so a label can be centred by hand.
const capsWidth = (s) => [...s].reduce((w, ch) => w + (ch === 'I' ? 4 : ch === ' ' ? 4 : 6), 0) - 1

let counter = 0
const element = (type, id, props) =>
  [`element {`, `  element_type = ${type}`, `  instance_identifier = lsp_pause_${id}_${++counter}`, ...Object.entries(props).map(([k, v]) => `  ${k} = ${v}`), `  stay_on_screen = true`, `}`, ''].join('\n')
const image = (id, source, x, y, width, height, extra = {}) => element('image', id, { source, anchor_point: 'mid-centered', x, y, width, height, ...extra })
// FancyMenu clips text to the element box (minus text_border), so the box is one line high with no border.
const text = (id, source, x, y, width, color = '#F8D982') =>
  element('text_v2', id, { source_mode: 'direct', source, anchor_point: 'mid-centered', x, y: y - 3, width: width + 4, height: 16, text_border: 0, base_color: color, shadow: true, auto_line_wrapping: false, enable_scrolling: false })
const title = (label, centerX, y) => text(`title_${label.toLowerCase().replace(/\W/g, '_')}`, label, centerX - Math.floor(capsWidth(label) / 2), y, capsWidth(label) + 2)

function hubButton([id, label, description, buttonaction, icon], x, y) {
  return (
    element('custom_button', id, { anchor_point: 'mid-centered', x, y, width: BUTTON.w, height: BUTTON.h, label, description, buttonaction }) +
    image(`${id}_icon`, `${ASSET}/icons/${icon}.png`, x + 3, y + 3, 14, 14)
  )
}

/** The pause screen layout. The logo's width comes from its aspect ratio, so re-running after new art keeps it right. */
export async function pauseLayout(logoFile) {
  counter = 0
  const meta = await sharp(logoFile).metadata()
  const logoH = 22
  const logoW = Math.round((logoH * meta.width) / meta.height)
  const column = (side, x, top) => HUB_BUTTONS[side].map((b, i) => hubButton(b, x, top + i * BUTTON.pitch)).join('')
  const info = (line, i) => text(`info_${i}`, line, PANELS.left.x + 4, 48 + i * 11, PANELS.left.w - 8, '#E8DCC0')
  const placeholder = (name) => `{"placeholder":"${name}"}`
  const replace = (text, search, replacement) => `{"placeholder":"replace_text","values":{"text":"${text}","search":"${search}","replacement":"${replacement}"}}`
  return [
    'type = fancymenu_layout',
    '',
    'layout-meta {',
    '  identifier = pause_screen',
    '  render_custom_elements_behind_vanilla = true',
    '  last_edited_time = 1790000000000',
    '  is_enabled = true',
    '  randommode = false',
    '  randomgroup = 1',
    '  randomonlyfirsttime = false',
    '  layout_index = 0',
    '}',
    '',
    'customization {',
    '  action = backgroundoptions',
    '  keepaspectratio = false',
    '}',
    '',
    image('board', `${ASSET}/ui/board.png`, BOARD.x, BOARD.y, BOARD.w, BOARD.h),
    image('logo', `${ASSET}/logo.png`, -Math.round(logoW / 2), PLAQUE.y + Math.round((PLAQUE.h - logoH) / 2), logoW, logoH),
    title('ADVENTURE', PANELS.left.x + PANELS.left.w / 2, PANELS.left.y + 4),
    title('GAME MENU', 0, PANELS.center.y + 4),
    title('PLAYER', PANELS.right.x + PANELS.right.w / 2, PANELS.right.y + 4),
    column('left', PANELS.left.x + 3, -50),
    column('right', PANELS.right.x + 3, 10),
    // The player, as they look right now, at the top of the right panel with their name under them.
    element('player_entity_v2', 'player', {
      anchor_point: 'mid-centered',
      x: PANELS.right.x + 20,
      y: -66,
      width: 50,
      height: 58,
      copy_client_player: true,
      showname: false,
      head_follows_mouse: true,
      body_follows_mouse: false,
      body_movement: false
    }),
    text('player_name', placeholder('playername'), PANELS.right.x + 4, -4, PANELS.right.w - 8),
    // Where the player is, under the adventure buttons.
    info(`X ${placeholder('player_x_coordinate')}  Z ${placeholder('player_z_coordinate')}`, 0),
    info(`Y ${placeholder('player_y_coordinate')}  ${placeholder('world_daytime_hour')}:${placeholder('world_daytime_minute')}`, 1),
    info(replace(replace(placeholder('current_biome'), 'minecraft:', ''), '_', ' '), 2)
  ].join('\n')
}

export async function writePauseLayout(file, logoFile) {
  writeFileSync(file, await pauseLayout(logoFile))
}

/** The same numbers for the client script, as JSON it can read with JsonIO. */
export function hubLayoutJson() {
  return { board: BOARD, panels: PANELS, vanilla: VANILLA }
}
