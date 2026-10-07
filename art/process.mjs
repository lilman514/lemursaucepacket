// Turns the generated art in art/generated into the files the pack, launcher and server use.
//   cd art && npm install && npm run process
//   node process.mjs launcherKit      (only the named steps; see the list at the bottom)
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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { buildArmor } from './armor-px.mjs'
import { buildItems } from './items.mjs'
import { DESIGNS as CAPE_DESIGNS, LEGENDARY as LEGENDARY_CAPES, renderCape } from './capes-px.mjs'
import { BOARD, PANELS, PLAQUE, hubLayoutJson, writePauseLayout } from './hub.mjs'
import { STYLE, board, checkbox, panel, plate, plateTile, pmmoAtlas, rowPlate, scroller, scrollerBackground, separator, sliderHandle, tab, textField } from './pixel-kit.mjs'

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
  await iconSheet('emblems.png', [['', '', '', 'capes'], ['', '', '', ''], ['backpack', '', '', 'map'], ['', 'account', 'quests', '']], [[HUB_ASSETS, 64, 0.02], [`${LAUNCHER_ASSETS}/icons`, 96, 0.02]])
  await iconSheet('skill-icons.png', SKILL_ICONS, [['pack/kubejs/assets/lemursaucepacket/textures/skills', 64, 0.02]])
  // Skills added after the sheet was painted have a transparent master of their own.
  for (const [file, name] of [['skill-enchanting.png', 'enchanting']]) {
    await (await squareIcon(await cleanAlpha(source(file)), 64, 0.02)).toFile(target(`pack/kubejs/assets/lemursaucepacket/textures/skills/${name}.png`))
  }
  console.log(`icons: ${HUB_ICONS.flat().length + 3} hub/launcher icons, ${SKILL_ICONS.flat().length} skill icons`)
}

/**
 * Cuts one piece out of the hi-res UI kit sheet: the visible pixels inside `region`, with a little margin. The region
 * must hold the whole piece and none of its neighbours; a piece that touches the region's edge is cut off or has a
 * neighbour's sliver in it, so that gets a warning.
 */
async function kitPiece(sheet, region, name, width) {
  const [left, top, right, bottom] = region
  const cut = await fromRaw(sheet).extract({ left, top, width: right - left, height: bottom - top }).raw().toBuffer({ resolveWithObject: true })
  const raw = { data: cut.data, info: { ...cut.info, channels: 4 } }
  const box = opaqueBounds(raw, 160)
  if (!box.left || !box.top || box.left + box.width === raw.info.width || box.top + box.height === raw.info.height) {
    console.warn(`  ${name}: the art touches the edge of its region [${region}]; the crop is cut off or catches a neighbour`)
  }
  const margin = 6
  const cropped = await fromRaw(raw)
    .extract({ left: Math.max(0, box.left - margin), top: Math.max(0, box.top - margin), width: Math.min(raw.info.width - Math.max(0, box.left - margin), box.width + 2 * margin), height: Math.min(raw.info.height - Math.max(0, box.top - margin), box.height + 2 * margin) })
    .png()
    .toBuffer()
  const out = target(`${LAUNCHER_ASSETS}/ui/${name}.png`)
  const info = await sharp(cropped).resize({ width }).png({ compressionLevel: 9 }).toFile(out)
  console.log(`  ${name}.png ${info.width}x${info.height}`)
}

/**
 * The account ring: only the round brass porthole, with its glass cut out so the player's head shows through.
 * On the sheet the ring sits close to the frame's corner gear and the hover plate, so a box crop catches
 * slivers of both. Instead this flood-fills the ring's own shape from the middle of `region`, measures where
 * the brass band ends on the inside, and keeps only the annulus (with the band's thin dark inner edge).
 */
async function kitRing(sheet, region, name, size) {
  const { data, info } = sheet
  const W = info.width
  const [x0, y0, x1, y1] = region
  const at = (x, y) => (y * W + x) * 4
  // The ring and its glass are one opaque blob: its bounds give the ring's centre and outer radii.
  const blob = new Uint8Array(W * info.height)
  const seed = ((y0 + y1) >> 1) * W + ((x0 + x1) >> 1)
  const stack = [seed]
  blob[seed] = 1
  let [left, right, top, bottom] = [x1, x0, y1, y0]
  while (stack.length) {
    const p = stack.pop()
    const x = p % W
    const y = (p - x) / W
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue
      const q = ny * W + nx
      if (!blob[q] && data[q * 4 + 3] >= 128) {
        blob[q] = 1
        stack.push(q)
      }
    }
  }
  const [cx, cy] = [(left + right + 1) / 2, (top + bottom + 1) / 2]
  const [rx, ry] = [(right - left + 1) / 2, (bottom - top + 1) / 2]
  // Walk rays inward until the colour stops being brass: that is the band's inner edge, as a fraction of the
  // radius. Rays through a rivet stop early (its dark outline), so take a low percentile, not the median.
  const brass = (x, y) => {
    const i = at(Math.round(x), Math.round(y))
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const max = Math.max(r, g, b)
    return data[i + 3] >= 128 && 0.299 * r + 0.587 * g + 0.114 * b > 55 && (max - Math.min(r, g, b)) / max > 0.35 && r > b
  }
  const edges = []
  for (let deg = 0; deg < 360; deg++) {
    const [dx, dy] = [Math.cos((deg * Math.PI) / 180) * rx, Math.sin((deg * Math.PI) / 180) * ry]
    let inBand = false
    let gapFrom = null
    for (let rho = 1; rho > 0.2; rho -= 0.002) {
      if (brass(cx + dx * rho - 0.5, cy + dy * rho - 0.5)) {
        inBand = true
        gapFrom = null
      } else if (inBand) {
        gapFrom ??= rho
        if (gapFrom - rho >= 0.03) {
          edges.push(gapFrom)
          break
        }
      }
    }
  }
  edges.sort((a, b) => a - b)
  // Keep about 5 sheet pixels of the dark line between brass and glass as the ring's inner edge.
  const hole = edges[Math.floor(edges.length / 4)] - 5 / rx
  // A square around the ring: alpha only inside the outer edge (with its anti-aliasing) and outside the hole.
  const half = Math.ceil(Math.max(rx, ry)) + 6
  const side = half * 2
  const [ox, oy] = [Math.round(cx) - half, Math.round(cy) - half]
  const out = Buffer.alloc(side * side * 4)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const [sx, sy] = [ox + x, oy + y]
      if (sx < 0 || sy < 0 || sx >= W || sy >= info.height) continue
      const rho = Math.hypot((sx + 0.5 - cx) / rx, (sy + 0.5 - cy) / ry)
      if (rho > 1 + 3 / rx) continue
      const i = at(sx, sy)
      const alpha = Math.round(data[i + 3] * Math.min(1, Math.max(0, (rho - hole) * rx + 0.5)))
      if (!alpha) continue
      const o = (y * side + x) * 4
      out[o] = data[i]
      out[o + 1] = data[i + 1]
      out[o + 2] = data[i + 2]
      out[o + 3] = alpha
    }
  }
  const file = target(`${LAUNCHER_ASSETS}/ui/${name}.png`)
  await sharp(out, { raw: { width: side, height: side, channels: 4 } }).resize(size, size).png({ compressionLevel: 9 }).toFile(file)
  const pct = (r) => ((r / half) * 100).toFixed(1)
  console.log(`  ${name}.png ${size}x${size}: ring ${pct(rx)}% of the half-width, glass cut out inside ${pct(hole * rx)}%`)
}

/**
 * The launcher's hi-res frame kit (CSS border-image sources). On ui-kit.png the frame spans y 95-1506 and the bottom
 * row starts at y 1527: plaque x 33-762, button x 795-1167, hover button x 1206-1579, ring x 1620-2011.
 */
async function launcherKit() {
  const sheet = await cleanAlpha(source('ui-kit.png'))
  console.log('launcher kit:')
  await kitPiece(sheet, [0, 0, 2048, 1516], 'frame', 1200)
  await kitPiece(sheet, [0, 1516, 778, 2048], 'plaque', 720)
  await kitPiece(sheet, [778, 1516, 1186, 2048], 'button', 400)
  await kitPiece(sheet, [1186, 1516, 1600, 2048], 'button-hover', 400)
  await kitRing(sheet, [1600, 1516, 2048, 2048], 'ring', 400)
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
  await rowPlate(false).png().toFile(target('pack/kubejs/assets/pmmo/textures/gui/sprites/stat_background.png'))
  await rowPlate(true).png().toFile(target('pack/kubejs/assets/pmmo/textures/gui/sprites/stat_background_highlighted.png'))
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

// Gear icon sheets (art/generated/gear-a.png, gear-b.png): pixel-art cells, cut to 32x32 item textures.
/**
 * Item sprites (the pack's gear, materials, and the Relics effect icons Relics ships without): drawn in code as
 * 16x16 pixel art in the Relics style by art/items.mjs, which replaced the earlier AI sheets (art/generated/gear-*.png
 * stay only as the original references).
 */
async function items() {
  await buildItems()
}

/** Armour as worn: painted set by set in art/armor-px.mjs (needs the client jar for vanilla's layout). */
async function armorLayers() {
  await buildArmor()
}

/**
 * Capes (capes/capes.mjs): every cape is 64x32 pixel art from art/capes-px.mjs, the static ones one texture each, the
 * legendary ones also a frame per animation step (<id>_f0.png …, which the client steps through).
 */
async function capes() {
  const { CAPES } = await import('../capes/capes.mjs')
  const CAPE_TEXTURES = 'pack/kubejs/assets/lemursaucepacket/textures/capes'
  const png = (id, frame = 0) => sharp(renderCape(id, frame), { raw: { width: 64, height: 32, channels: 4 } }).png({ compressionLevel: 9 })
  // A fully transparent cape for "none".
  await sharp({ create: { width: 64, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(target(`${CAPE_TEXTURES}/none.png`))
  let count = 0
  for (const cape of CAPES) {
    if (!CAPE_DESIGNS[cape.id] && !LEGENDARY_CAPES[cape.id]) {
      console.log(`capes: no design for ${cape.id}, skipped`)
      continue
    }
    await png(cape.id).toFile(target(`${CAPE_TEXTURES}/${cape.id}.png`))
    for (let f = 0; f < (cape.animated ?? 0); f++) await png(cape.id, f).toFile(target(`${CAPE_TEXTURES}/${cape.id}_f${f}.png`))
    count++
  }
  console.log(`capes: ${count} cape textures (${CAPES.filter((c) => c.animated).length} animated)`)
}

/**
 * The gear and cape sheets on the website (website/assets/art/gear.webp, capes.webp) and the wiki's Gear and Capes
 * pages (docs/images/gear_sets.jpg, capes_sheet.webp), drawn from the game's own textures and scaled up pixel for pixel:
 * each cape's design (the 10x16 front of its 64x32 texture, as people see it on your back) and each armour piece's icon
 * (the first frame of its shimmer strip). The site's cape sheet moves: its legendary capes step through their frames.
 * (These replaced the AI reference sheets in art/generated/, which never matched the game.)
 */
async function sheets() {
  const { CAPES } = await import('../capes/capes.mjs')
  const { SETS, PIECES } = await import('../gear/gear.mjs')
  const ITEMS = path.join(root, 'pack/kubejs/assets/lemursaucepacket/textures/item')
  const PLATE = '#211e1c'
  const font = 'Segoe UI, Helvetica, Arial, sans-serif'
  const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;')
  const text = (s, w, h, { size = 20, anchor = 'middle', weight = 600, colour = '#f2e6cf' } = {}) => {
    // A name too long for its cell gets smaller, and if that would make it too small, two lines (never cut off).
    const fits = (t, px) => t.length * px * 0.56 <= w - 8
    let lines = [s]
    let px = size
    while (!fits(s, px) && px > 14) px--
    if (!fits(s, px)) {
      const words = s.split(' ')
      let best = null
      for (let i = 1; i < words.length; i++) {
        const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
        if (!best || Math.max(...pair.map((t) => t.length)) < Math.max(...best.map((t) => t.length))) best = pair
      }
      lines = best ?? [s]
      px = size
      while (!lines.every((t) => fits(t, px)) && px > 10) px--
    }
    const x = anchor === 'middle' ? w / 2 : 4
    const ys = lines.length === 1 ? [Math.round(h * 0.68)] : [Math.round(h * 0.42), Math.round(h * 0.42) + px + 2]
    const spans = lines.map((t, i) => `<text x="${x}" y="${ys[i]}" font-family="${font}" font-size="${px}" font-weight="${weight}" fill="${colour}" text-anchor="${anchor}">${escapeXml(t)}</text>`).join('')
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${spans}</svg>`)
  }
  /** A cape's front, scaled up: raw 64x32 RGBA from renderCape, the 10x16 at (1, 1). */
  const capeFace = (id, frame, scale) =>
    sharp(renderCape(id, frame), { raw: { width: 64, height: 32, channels: 4 } }).extract({ left: 1, top: 1, width: 10, height: 16 }).resize(10 * scale, 16 * scale, { kernel: 'nearest' }).png().toBuffer()
  const icon = (id, scale) => sharp(path.join(ITEMS, `${id}.png`)).extract({ left: 0, top: 0, width: 16, height: 16 }).resize(16 * scale, 16 * scale, { kernel: 'nearest' }).png().toBuffer()
  const canvas = (width, height, background) => sharp({ create: { width, height, channels: 4, background } })
  const clear = { r: 0, g: 0, b: 0, alpha: 0 }

  // The wiki: every cape, its name under it, the animated ones stepping through their frames as they do in game (a
  // frame every four ticks), the rest still. Lossless: it's pixel art, and only the moving capes change between frames.
  {
    const scale = 10, cols = 8, gap = 24, label = 40
    const w = 10 * scale, h = 16 * scale
    const rows = Math.ceil(CAPES.length / cols)
    const width = cols * w + (cols + 1) * gap
    const height = rows * (h + label) + (rows + 1) * gap
    const at = (i) => ({ x: gap + (i % cols) * (w + gap), y: gap + Math.floor(i / cols) * (h + label + gap) })
    const labels = CAPES.map((c, i) => ({ input: text(c.name.replace(/ Cape$/, ''), w + gap, label, { size: 17 }), left: at(i).x - gap / 2, top: at(i).y + h }))
    const still = await Promise.all(CAPES.map((c) => capeFace(c.id, 0, scale)))
    const count = Math.max(1, ...CAPES.map((c) => c.animated ?? 1))
    const frames = []
    for (let f = 0; f < count; f++) {
      const parts = [...labels]
      for (let i = 0; i < CAPES.length; i++) parts.push({ input: CAPES[i].animated ? await capeFace(CAPES[i].id, f % CAPES[i].animated, scale) : still[i], left: at(i).x, top: at(i).y })
      frames.push(await canvas(width, height, PLATE).composite(parts).flatten({ background: PLATE }).png().toBuffer())
    }
    await sharp(frames, { join: { animated: true } }).webp({ lossless: true, effort: 6, loop: 0, delay: frames.map(() => 200) }).toFile(target('docs/images/capes_sheet.webp'))
  }
  // The site: twelve capes, the legendary ones moving.
  {
    const pick = ['fire_cape', 'infernal_cape', 'dragonslayer_cape', 'maxed_cape', 'completionist_cape', 'attack_cape', 'strength_cape', 'defence_cape', 'mining_cape', 'skyward_cape', 'hero_cape', 'wings_cape']
    const capes = pick.map((id) => CAPES.find((c) => c.id === id)).filter(Boolean)
    const scale = 12, cols = 4, gap = 24
    const w = 10 * scale, h = 16 * scale
    const rows = Math.ceil(capes.length / cols)
    const width = cols * w + (cols + 1) * gap, height = rows * h + (rows + 1) * gap
    const frames = []
    for (let f = 0; f < 12; f++) {
      const parts = []
      for (let i = 0; i < capes.length; i++) {
        const c = capes[i]
        parts.push({ input: await capeFace(c.id, c.animated ? f % c.animated : 0, scale), left: gap + (i % cols) * (w + gap), top: gap + Math.floor(i / cols) * (h + gap) })
      }
      frames.push(await canvas(width, height, clear).composite(parts).png().toBuffer())
    }
    // A frame every four ticks, as the game steps them.
    await sharp(frames, { join: { animated: true } }).webp({ lossless: true, loop: 0, delay: frames.map(() => 200) }).toFile(target('website/assets/art/capes.webp'))
  }
  // The armour: each set's four pieces (and the single pieces), its name beside them on the wiki.
  const sets = SETS.map((s) => ({ name: s.name, ids: ['helmet', 'chestplate', 'leggings', 'boots'].map((p) => `${s.id}_${p}`) }))
  const singles = { name: PIECES.map((p) => p.name).join(', '), ids: PIECES.map((p) => p.id) }
  {
    const scale = 8, gap = 24, labelW = 330
    const cell = 16 * scale
    const rows = [...sets, singles]
    const width = gap + labelW + 4 * (cell + gap), height = gap + rows.length * (cell + gap)
    const parts = []
    for (let r = 0; r < rows.length; r++) {
      const y = gap + r * (cell + gap)
      parts.push({ input: text(rows[r].name, labelW, cell, { size: rows[r] === singles ? 19 : 24, anchor: 'start' }), left: gap, top: y })
      for (let i = 0; i < rows[r].ids.length; i++) parts.push({ input: await icon(rows[r].ids[i], scale), left: gap + labelW + i * (cell + gap), top: y })
    }
    await canvas(width, height, PLATE).composite(parts).flatten({ background: PLATE }).jpeg({ quality: 90, mozjpeg: true }).toFile(target('docs/images/gear_sets.jpg'))
  }
  {
    const scale = 7, gap = 20
    const cell = 16 * scale
    const width = 4 * cell + 5 * gap, height = sets.length * cell + (sets.length + 1) * gap
    const parts = []
    for (let r = 0; r < sets.length; r++) for (let i = 0; i < 4; i++) parts.push({ input: await icon(sets[r].ids[i], scale), left: gap + i * (cell + gap), top: gap + r * (cell + gap) })
    await canvas(width, height, clear).composite(parts).webp({ lossless: true }).toFile(target('website/assets/art/gear.webp'))
  }
  console.log(`sheets: ${CAPES.length} capes and ${sets.length} armour sets from their textures → docs/images (capes_sheet, gear_sets) and website/assets/art (capes, gear)`)
}

/** The ESC menu layout and the geometry its client script shares. */
async function pauseMenu() {
  await writePauseLayout(target('pack/config/fancymenu/customization/lemursaucepacket_pause.txt'), target(`${MENU_ASSETS}/logo.png`))
  writeFileSync(target('pack/config/lemursaucepacket/hub_layout.json'), JSON.stringify(hubLayoutJson()))
  console.log('ESC menu: lemursaucepacket_pause.txt, config/lemursaucepacket/hub_layout.json')
}

/**
 * The website (website/, play.limas.ca): key art in widths for srcset, the logo, the mascot as favicons, every
 * emblem, hub and skill icon, the social preview card, and the launcher's brass kit at
 * half size (the page draws the frame at 52px and the button at 22px, so that is still 1.5-2x for sharp screens).
 * WebP throughout: the site is served from Vercel, and every byte there counts.
 */
async function website() {
  const WEB = 'website/assets'
  const pic = (input) => sharp(input).webp({ quality: 78, effort: 6 })
  for (const [file, name] of [['keyart-b.png', 'hero'], ['keyart-a.png', 'keyart']]) {
    for (const width of [800, 1280, 1920, 2560]) await pic(source(file)).resize({ width }).toFile(target(`${WEB}/art/${name}-${width}.webp`))
  }
  // The card chat apps and search show for a link: the key art, darkened on the left under the logo.
  const raw = await cleanAlpha(source('logo-a.png'))
  const wordmark = await fromRaw(raw).extract(opaqueBounds(raw)).png().toBuffer()
  const shade = Buffer.from(
    '<svg width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#110e0b" stop-opacity="0.92"/><stop offset="0.55" stop-color="#110e0b" stop-opacity="0.55"/><stop offset="1" stop-color="#110e0b" stop-opacity="0"/>' +
      '</linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>'
  )
  await sharp(source('keyart-b.png'))
    .resize(1200, 630, { fit: 'cover' })
    .composite([{ input: shade }, { input: await sharp(wordmark).resize({ width: 660 }).png().toBuffer(), left: 60, top: 200 }])
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(target('website/og.jpg'))
  for (const width of [720, 1200]) await sharp(wordmark).resize({ width }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(target(`${WEB}/logo-${width}.webp`))

  const iconCells = async (file, names, dir, size) => {
    const sheet = await cleanAlpha(source(file))
    const cell = sheet.info.width / 4
    for (const [row, rowNames] of names.entries()) {
      for (const [col, name] of rowNames.entries()) {
        const cut = await fromRaw(sheet).extract({ left: col * cell, top: row * cell, width: cell, height: cell }).raw().toBuffer({ resolveWithObject: true })
        const raw = { data: cut.data, info: { ...cut.info, channels: 4 } }
        await (await squareIcon(raw, size, 0.03)).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(target(`${WEB}/${dir}/${name}.webp`))
        if (name === 'mascot') {
          for (const s of [32, 180]) await (await squareIcon(raw, s, 0.02)).png({ palette: true, quality: 92, compressionLevel: 9 }).toFile(target(`${WEB}/mascot-${s}.png`))
        }
      }
    }
  }
  await iconCells('emblems.png', EMBLEMS, 'emblems', 160)
  await iconCells('hub-icons.png', HUB_ICONS, 'icons', 128)
  await iconCells('skill-icons.png', SKILL_ICONS, 'skills', 128)
  await (await squareIcon(await cleanAlpha(source('skill-enchanting.png')), 128, 0.03)).webp({ quality: 88, alphaQuality: 100 }).toFile(target(`${WEB}/skills/enchanting.webp`))

  const kit = `${LAUNCHER_ASSETS}/ui`
  for (const [name, width] of [['frame', 600], ['button', 200], ['button-hover', 200], ['plaque', 360], ['ring', 200]]) {
    await sharp(path.join(root, kit, `${name}.png`)).resize({ width }).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toFile(target(`${WEB}/ui/${name}.webp`))
  }
  for (const name of ['plate-plain', 'panel', 'button', 'button-hover']) {
    writeFileSync(target(`${WEB}/pixel/${name}.png`), readFileSync(path.join(root, LAUNCHER_ASSETS, 'pixel', `${name}.png`)))
  }
  console.log('website: key art, og.jpg, logo, favicons, emblem/hub/skill icons, brass kit → website/assets (the gear and cape sheets are the sheets step)')
}

// `node process.mjs` runs every step; naming steps runs only those, e.g. `node process.mjs launcherKit`.
const steps = { backgrounds, logo, emblems, installerArt, questPanel, icons, launcherKit, pixelKit, pauseMenu, items, armorLayers, capes, sheets, website }
const only = process.argv.slice(2)
for (const name of only) if (!(name in steps)) throw new Error(`Unknown step "${name}". Steps: ${Object.keys(steps).join(', ')}`)
for (const [name, step] of Object.entries(steps)) if (!only.length || only.includes(name)) await step()
