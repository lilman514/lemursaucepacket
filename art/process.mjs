// Turns the generated art in art/generated into the files the pack, launcher and server use.
//   cd art && npm install && npm run process
//
// Sources (made with Higgsfield, GPT Image 2.5):
//   keyart-a.png     title screen background
//   keyart-b.png     loading screen background and launcher hero
//   logo-a.png       "LemurSaucePacket" wordmark (transparent)
//   emblems.png      4x4 sheet: 13 quest chapter emblems, the lemur mascot, a quest book, tools
//   hub-icons.png    4x4 sheet: ESC menu and launcher icons
//   skill-icons.png  4x4 sheet: the 13 skill icons plus total level, XP and level-up
//   ui-kit.png       hi-res brass frame, plaque, button and ring for the launcher
//
// The pixel-crisp in-game widgets (buttons, sliders, tabs, menu backgrounds, the ESC menu board) are not
// generated art: pixel-kit.mjs draws them, and this script writes them over the vanilla sprites through the
// pack's resource pack (pack/kubejs/assets). hub.mjs writes the ESC menu layout from the same geometry.
//
// Re-run after replacing any of them. The FancyMenu layouts in pack/config/fancymenu/customization
// size the logo from its aspect ratio, which this script prints.

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { BOARD, PANELS, PLAQUE, hubLayoutJson, writePauseLayout } from './hub.mjs'
import { STYLE, board, checkbox, panel, plate, plateTile, pmmoAtlas, scroller, scrollerBackground, separator, sliderHandle, tab, textField } from './pixel-kit.mjs'

const artDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(artDir, '..')
const source = (name) => path.join(artDir, 'generated', name)
const target = (rel) => {
  const file = path.join(root, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  return file
}

const MENU_ASSETS = 'pack/config/fancymenu/assets/lemursaucepacket'
const QUEST_TEXTURES = 'pack/kubejs/assets/lemursaucepacket/textures/quests'
const LAUNCHER_ASSETS = 'launcher/src/renderer/src/assets'

// Emblem sheet cells, row by row.
const EMBLEMS = [
  ['landfall', 'first_rotation', 'brass_age', 'banners'],
  ['iron_roads', 'skyward', 'crown_of_fire', 'legacy'],
  ['backpack_workshop', 'homestead', 'bestiary', 'atlas'],
  ['commerce', 'mascot', 'quest_book', 'tools']
]

/**
 * Raw RGBA pixels with the model's near-opaque alpha (it tops out at 254) snapped to fully opaque and
 * its near-invisible haze snapped to fully transparent, so nothing behind the art bleeds through.
 */
async function cleanAlpha(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] >= 248) data[i] = 255
    else if (data[i] <= 6) data[i] = 0
  }
  return { data, info }
}

/** Bounding box of pixels that are clearly visible. */
function opaqueBounds({ data, info }, minAlpha = 24) {
  let left = info.width
  let top = info.height
  let right = -1
  let bottom = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < minAlpha) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

const fromRaw = ({ data, info }) => sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })

/** Crops transparent margins, then centres the art on a square canvas with a little breathing room. */
async function squareIcon(raw, size, padding = 0.06) {
  const box = opaqueBounds(raw)
  const cropped = await fromRaw(raw).extract(box).png().toBuffer()
  const inner = Math.round(size * (1 - padding * 2))
  const fitted = await sharp(cropped).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: 'center' }])
    .png({ compressionLevel: 9 })
}

async function backgrounds() {
  const jpeg = { quality: 88, mozjpeg: true }
  await sharp(source('keyart-a.png')).resize(1920, 1080, { fit: 'cover' }).jpeg(jpeg).toFile(target(`${MENU_ASSETS}/title.jpg`))
  await sharp(source('keyart-b.png')).resize(1920, 1080, { fit: 'cover' }).jpeg(jpeg).toFile(target(`${MENU_ASSETS}/loading.jpg`))
  // The launcher hero is a wide strip; keep the town and castle on the right in frame.
  await sharp(source('keyart-b.png')).resize(1600, 900, { fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toFile(target(`${LAUNCHER_ASSETS}/hero.jpg`))
  console.log('backgrounds: title.jpg, loading.jpg, launcher hero.jpg')
}

async function logo() {
  const raw = await cleanAlpha(source('logo-a.png'))
  const box = opaqueBounds(raw)
  const trimmed = await fromRaw(raw).extract(box).png().toBuffer()
  await sharp(trimmed).resize({ width: 1200 }).png({ compressionLevel: 9 }).toFile(target(`${MENU_ASSETS}/logo.png`))
  await sharp(trimmed).resize({ width: 720 }).png({ compressionLevel: 9 }).toFile(target(`${LAUNCHER_ASSETS}/logo.png`))
  console.log(`logo: ${box.width}x${box.height} after trimming (aspect ${(box.width / box.height).toFixed(3)})`)
}

async function emblems() {
  const sheet = await cleanAlpha(source('emblems.png'))
  const cell = sheet.info.width / 4
  for (const [row, names] of EMBLEMS.entries()) {
    for (const [col, name] of names.entries()) {
      const cut = await fromRaw(sheet)
        .extract({ left: col * cell, top: row * cell, width: cell, height: cell })
        .raw()
        .toBuffer({ resolveWithObject: true })
      const raw = { data: cut.data, info: { ...cut.info, channels: 4 } }
      await (await squareIcon(raw, 256)).toFile(target(`${QUEST_TEXTURES}/${name}.png`))
      if (name === 'mascot') {
        // Server list icon must be exactly 64x64. The launcher icon feeds electron-builder's .ico.
        await (await squareIcon(raw, 64, 0.02)).toFile(target('pack/server-icon.png'))
        await (await squareIcon(raw, 512, 0.04)).toFile(target('launcher/resources/icon.png'))
        await (await squareIcon(raw, 128, 0.02)).toFile(target(`${LAUNCHER_ASSETS}/mascot.png`))
      }
    }
  }
  console.log(`emblems: ${EMBLEMS.flat().length} quest textures, server-icon.png, launcher icon.png and mascot.png`)
}

/** 24-bit bottom-up BMP, the only image format NSIS installer pages accept. */
function bmp24({ data, info }) {
  const { width, height, channels } = info
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const out = Buffer.alloc(54 + rowSize * height)
  out.write('BM', 0)
  out.writeUInt32LE(out.length, 2)
  out.writeUInt32LE(54, 10)
  out.writeUInt32LE(40, 14)
  out.writeInt32LE(width, 18)
  out.writeInt32LE(height, 22)
  out.writeUInt16LE(1, 26)
  out.writeUInt16LE(24, 28)
  out.writeUInt32LE(rowSize * height, 34)
  out.writeInt32LE(2835, 38)
  out.writeInt32LE(2835, 42)
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      out[row + x * 3] = data[i + 2]
      out[row + x * 3 + 1] = data[i + 1]
      out[row + x * 3 + 2] = data[i]
    }
  }
  return out
}

/** Setup wizard art: the Welcome/Finish sidebar (164x314) and the inner pages' header (150x57). */
async function installerArt() {
  // A tall slice of the title key art (windmill and water wheel), darkened at the bottom under the mascot.
  const slice = await sharp(source('keyart-a.png')).extract({ left: 220, top: 0, width: 794, height: 1520 }).resize(164, 314).toBuffer()
  const shade = Buffer.from(
    `<svg width="164" height="314"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0.45" stop-color="#0d0f14" stop-opacity="0"/><stop offset="1" stop-color="#0d0f14" stop-opacity="0.85"/>` +
      `</linearGradient></defs><rect width="164" height="314" fill="url(#g)"/></svg>`
  )
  const mascot = await sharp(target(`${QUEST_TEXTURES}/mascot.png`)).resize(96, 96).toBuffer()
  const sidebar = await sharp(slice)
    .composite([{ input: shade }, { input: mascot, left: 34, top: 202 }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  writeFileSync(target('launcher/resources/installerSidebar.bmp'), bmp24(sidebar))

  // The header sits on the wizard's white banner: the wordmark, fitted with a little margin.
  const wordmark = await sharp(target(`${MENU_ASSETS}/logo.png`)).resize(142, 49, { fit: 'inside' }).toBuffer()
  const header = await sharp({ create: { width: 150, height: 57, channels: 3, background: '#ffffff' } })
    .composite([{ input: wordmark, gravity: 'center' }])
    .raw()
    .toBuffer({ resolveWithObject: true })
  writeFileSync(target('launcher/resources/installerHeader.bmp'), bmp24(header))
  console.log('installer: installerSidebar.bmp (164x314), installerHeader.bmp (150x57)')
}

/**
 * The quest book's info-card background: a flat translucent panel (FTB stretches it to each card).
 * Also a fully transparent image for spacers that steer where FTB centres a chapter (see quests/build.mjs).
 */
async function questPanel() {
  await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 12, g: 14, b: 20, alpha: 0.74 } } })
    .png()
    .toFile(target(`${QUEST_TEXTURES}/panel.png`))
  await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png()
    .toFile(target(`${QUEST_TEXTURES}/blank.png`))
  console.log('quests: panel.png, blank.png')
}

// Hub icon sheet cells, row by row: ESC menu buttons and launcher pages.
const HUB_ICONS = [
  ['mods', 'missions', 'claims', 'skills'],
  ['team', 'settings', 'advancements', 'statistics'],
  ['disconnect', 'home', 'play', 'news'],
  ['voice', 'repair', 'files', 'link']
]
// Skill icon sheet cells: the skills in skills/build.mjs, then three extras.
const SKILL_ICONS = [
  ['attack', 'strength', 'defence', 'ranged'],
  ['hitpoints', 'mining', 'woodcutting', 'farming'],
  ['fishing', 'cooking', 'smithing', 'crafting'],
  ['agility', 'total_level', 'experience', 'level_up']
]
const MC_GUI = 'pack/kubejs/assets/minecraft/textures/gui'
const HUB_ASSETS = `${MENU_ASSETS}/icons`

/** Cuts a 4x4 sheet into square icons, one file per named cell, at each of the given sizes. */
async function iconSheet(file, names, outputs) {
  const sheet = await cleanAlpha(source(file))
  const cell = sheet.info.width / 4
  for (const [row, rowNames] of names.entries()) {
    for (const [col, name] of rowNames.entries()) {
      if (!name) continue
      const cut = await fromRaw(sheet).extract({ left: col * cell, top: row * cell, width: cell, height: cell }).raw().toBuffer({ resolveWithObject: true })
      const raw = { data: cut.data, info: { ...cut.info, channels: 4 } }
      for (const [dir, size, padding] of outputs) await (await squareIcon(raw, size, padding)).toFile(target(`${dir}/${name}.png`))
    }
  }
}

/** ESC menu icons (FancyMenu draws them at 14 GUI px), launcher icons, and the skill icons Project MMO shows. */
async function icons() {
  await iconSheet('hub-icons.png', HUB_ICONS, [[HUB_ASSETS, 64, 0.02], [`${LAUNCHER_ASSETS}/icons`, 96, 0.02]])
  // Three hub buttons reuse quest emblems, so the menu and the quest book share symbols.
  await iconSheet('emblems.png', [['', '', '', ''], ['', '', '', ''], ['backpack', '', '', 'map'], ['', 'account', 'quests', '']], [[HUB_ASSETS, 64, 0.02], [`${LAUNCHER_ASSETS}/icons`, 96, 0.02]])
  await iconSheet('skill-icons.png', SKILL_ICONS, [['pack/kubejs/assets/lemursaucepacket/textures/skills', 64, 0.02]])
  console.log(`icons: ${HUB_ICONS.flat().length + 3} hub/launcher icons, ${SKILL_ICONS.flat().length} skill icons`)
}

/** Cuts one piece out of the hi-res UI kit sheet: the visible pixels inside `region`, with a little margin. */
async function kitPiece(sheet, region, name, width) {
  const [left, top, right, bottom] = region
  const cut = await fromRaw(sheet).extract({ left, top, width: right - left, height: bottom - top }).raw().toBuffer({ resolveWithObject: true })
  const raw = { data: cut.data, info: { ...cut.info, channels: 4 } }
  const box = opaqueBounds(raw, 160)
  const margin = 6
  const cropped = await fromRaw(raw)
    .extract({ left: Math.max(0, box.left - margin), top: Math.max(0, box.top - margin), width: Math.min(raw.info.width - Math.max(0, box.left - margin), box.width + 2 * margin), height: Math.min(raw.info.height - Math.max(0, box.top - margin), box.height + 2 * margin) })
    .png()
    .toBuffer()
  const out = target(`${LAUNCHER_ASSETS}/ui/${name}.png`)
  const info = await sharp(cropped).resize({ width }).png({ compressionLevel: 9 }).toFile(out)
  console.log(`  ${name}.png ${info.width}x${info.height}`)
}

/** The launcher's hi-res frame kit (CSS border-image sources). */
async function launcherKit() {
  const sheet = await cleanAlpha(source('ui-kit.png'))
  console.log('launcher kit:')
  await kitPiece(sheet, [0, 0, 2048, 1490], 'frame', 1200)
  await kitPiece(sheet, [0, 1490, 760, 2048], 'plaque', 720)
  await kitPiece(sheet, [760, 1490, 1140, 2048], 'button', 400)
  await kitPiece(sheet, [1140, 1490, 1520, 2048], 'button-hover', 400)
  await kitPiece(sheet, [1520, 1440, 2048, 2048], 'ring', 400)
}

function nineSlice(file, width, height, border) {
  writeFileSync(`${file}.mcmeta`, JSON.stringify({ gui: { scaling: { type: 'nine_slice', width, height, border } } }))
}

/**
 * The pixel kit, written over the vanilla GUI sprites (same sizes and nine-slice borders as the originals,
 * except buttons and sliders, whose brass band needs a 4px border) and into FancyMenu's assets.
 */
async function pixelKit() {
  const widget = async (name, pix, border) => {
    const file = target(`${MC_GUI}/sprites/widget/${name}.png`)
    await pix.png().toFile(file)
    if (border !== undefined) nineSlice(file, pix.w, pix.h, border)
  }
  await widget('button', plate(200, 20, STYLE.normal), 4)
  await widget('button_highlighted', plate(200, 20, STYLE.hover), 4)
  await widget('button_disabled', plate(200, 20, STYLE.disabled), 4)
  await widget('slider', plate(200, 20, STYLE.recessed), 4)
  await widget('slider_highlighted', plate(200, 20, STYLE.recessedHover), 4)
  await widget('slider_handle', sliderHandle(false), { left: 2, top: 2, right: 2, bottom: 3 })
  await widget('slider_handle_highlighted', sliderHandle(true), { left: 2, top: 2, right: 2, bottom: 3 })
  await widget('tab', tab(false, false), { left: 2, top: 2, right: 2, bottom: 0 })
  await widget('tab_highlighted', tab(false, true), { left: 2, top: 2, right: 2, bottom: 0 })
  await widget('tab_selected', tab(true, false), { left: 2, top: 2, right: 2, bottom: 0 })
  await widget('tab_selected_highlighted', tab(true, true), { left: 2, top: 2, right: 2, bottom: 0 })
  await widget('text_field', textField(false), 2)
  await widget('text_field_highlighted', textField(true), 2)
  await widget('scroller', scroller(), 1)
  await widget('scroller_background', scrollerBackground(), 1)
  await widget('checkbox', checkbox(false, false))
  await widget('checkbox_highlighted', checkbox(false, true))
  await widget('checkbox_selected', checkbox(true, false))
  await widget('checkbox_selected_highlighted', checkbox(true, true))
  // Screen backgrounds: riveted plates out of the world, a warm dark tint over the world.
  await plateTile().png().toFile(target(`${MC_GUI}/menu_background.png`))
  await plateTile({ rivets: false, face: [25, 23, 21, 255] }).png().toFile(target(`${MC_GUI}/menu_list_background.png`))
  await plateTile({ rivets: false, face: [20, 17, 13, 150], alpha: 150 }).png().toFile(target(`${MC_GUI}/inworld_menu_background.png`))
  await plateTile({ rivets: false, face: [12, 10, 8, 170], alpha: 170 }).png().toFile(target(`${MC_GUI}/inworld_menu_list_background.png`))
  await plateTile({ rivets: false }).png().toFile(target(`${MC_GUI}/tab_header_background.png`))
  for (const name of ['header_separator', 'footer_separator']) {
    await separator().png().toFile(target(`${MC_GUI}/${name}.png`))
    await separator(200).png().toFile(target(`${MC_GUI}/inworld_${name}.png`))
  }
  // The same plate behind the quest book (see pack/kubejs/assets/ftbquests/ftb_quests_theme.txt).
  await plateTile().png().toFile(target('pack/kubejs/assets/lemursaucepacket/textures/gui/plate.png'))
  // Project MMO's skill rows and small buttons.
  await plate(123, 24, STYLE.normal).png().toFile(target('pack/kubejs/assets/pmmo/textures/gui/sprites/stat_background.png'))
  await plate(123, 24, STYLE.hover).png().toFile(target('pack/kubejs/assets/pmmo/textures/gui/sprites/stat_background_highlighted.png'))
  await plate(20, 18, STYLE.normal, { rivets: false }).png().toFile(target('pack/kubejs/assets/pmmo/textures/gui/sprites/pmmo_button.png'))
  await plate(20, 18, STYLE.hover, { rivets: false }).png().toFile(target('pack/kubejs/assets/pmmo/textures/gui/sprites/pmmo_button_highlighted.png'))
  await pmmoAtlas().png().toFile(target('pack/kubejs/assets/pmmo/textures/gui/player_stats.png'))
  // FancyMenu: a nine-slice panel (border 8) and the ESC menu board at its final size.
  await panel(48, 48).png().toFile(target(`${MENU_ASSETS}/ui/panel.png`))
  // The launcher draws its buttons, fields and card frames from the same sprites (CSS border-image, 3x).
  const pixel = (name, pix) => pix.png().toFile(target(`${LAUNCHER_ASSETS}/pixel/${name}.png`))
  await pixel('button', plate(200, 20, STYLE.normal))
  await pixel('button-hover', plate(200, 20, STYLE.hover))
  await pixel('button-disabled', plate(200, 20, STYLE.disabled))
  await pixel('slider', plate(200, 20, STYLE.recessed))
  await pixel('slider-handle', sliderHandle(false))
  await pixel('field', textField(false))
  await pixel('field-focus', textField(true))
  await pixel('panel', panel(48, 48))
  await pixel('plate', plateTile())
  await pixel('plate-plain', plateTile({ rivets: false, face: [25, 23, 21, 255] }))
  const rel = (r) => ({ x: r.x - BOARD.x, y: r.y - BOARD.y, w: r.w, h: r.h })
  await board(BOARD.w, BOARD.h, Object.values(PANELS).map(rel), { plaque: rel(PLAQUE) }).png().toFile(target(`${MENU_ASSETS}/ui/board.png`))
  console.log('pixel kit: 19 vanilla widget sprites, 10 menu backgrounds/separators, plate.png, 4 Project MMO sprites, panel.png, board.png')
}

/** The ESC menu layout and the geometry its client script shares. */
async function pauseMenu() {
  await writePauseLayout(target('pack/config/fancymenu/customization/lemursaucepacket_pause.txt'), target(`${MENU_ASSETS}/logo.png`))
  writeFileSync(target('pack/config/lemursaucepacket/hub_layout.json'), JSON.stringify(hubLayoutJson()))
  console.log('ESC menu: lemursaucepacket_pause.txt, config/lemursaucepacket/hub_layout.json')
}

await backgrounds()
await logo()
await emblems()
await installerArt()
await questPanel()
await icons()
await launcherKit()
await pixelKit()
await pauseMenu()
