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
import { buildItems } from './items.mjs'
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

// Armour as worn: vanilla layer textures tinted per material (see gear/gear.mjs MATERIALS). The vanilla
// textures come from the client jar and are not kept in the repo.
const ARMOR_LAYERS = {
  prospector: ['iron', '#b8862b'],
  aeronaut: ['leather', '#7a5230'],
  duelist: ['iron', '#d9a441'],
  compacted_diamond: ['diamond', '#4fd6d0'],
  compacted_netherite: ['netherite', '#6b5b6f']
}

async function armorLayers() {
  const jar = process.env.MINECRAFT_JAR ?? path.join(process.env.LOCALAPPDATA ?? '', 'Temp', 'claude', 'C--Create-Modpack', 'ab1859ba-46fb-401e-9816-544fdbbd5524', 'scratchpad', 'headless', 'minecraft', 'versions', '1.21.1', '1.21.1.jar')
  if (!existsSync(jar)) {
    console.log('armour layers: no client jar (set MINECRAFT_JAR), skipped')
    return
  }
  const { unzipSync } = await import('fflate')
  const zip = unzipSync(new Uint8Array(readFileSync(jar)), { filter: (f) => f.name.startsWith('assets/minecraft/textures/models/armor/') })
  const tint = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  for (const [material, [base, hex]] of Object.entries(ARMOR_LAYERS)) {
    const [tr, tg, tb] = tint(hex)
    for (const layer of [1, 2]) {
      const name = `assets/minecraft/textures/models/armor/${base}_layer_${layer}.png`
      if (!zip[name]) continue
      const { data, info } = await sharp(Buffer.from(zip[name])).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      // Keep the vanilla shading (luminance) and give it the material's hue; leather's flat grey becomes the colour itself.
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue
        const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
        const k = base === 'leather' ? lum * 1.35 : lum * 1.15
        data[i] = Math.min(255, tr * k)
        data[i + 1] = Math.min(255, tg * k)
        data[i + 2] = Math.min(255, tb * k)
      }
      await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png({ compressionLevel: 9 })
        .toFile(target(`pack/kubejs/assets/lemursaucepacket/textures/models/armor/${material}_layer_${layer}.png`))
    }
  }
  console.log(`armour layers: ${Object.keys(ARMOR_LAYERS).length} materials tinted`)
}

/**
 * Capes (capes/capes.mjs, art/generated/capes-a.png and capes-b.png: 4x4 sheets of cape fronts in that order).
 * Each front becomes a full cape texture in Minecraft's layout at 8x (512x256): front, back (mirrored), and
 * 1-unit edges in the front's border colour. Animated capes get frames with a moving shimmer.
 */
async function capes() {
  const { CAPES } = await import('../capes/capes.mjs')
  const CAPE_TEXTURES = 'pack/kubejs/assets/lemursaucepacket/textures/capes'
  const S = 8
  const sheets = ['capes-a.png', 'capes-b.png'].filter((f) => existsSync(source(f)))
  // A fully transparent cape for "none".
  await sharp({ create: { width: 64, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(target(`${CAPE_TEXTURES}/none.png`))
  if (sheets.length === 0) {
    console.log('capes: no sheets, skipped')
    return
  }
  const fronts = []
  for (const file of sheets) {
    const sheet = await cleanAlpha(source(file))
    const cell = sheet.info.width / 4
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const cut = await fromRaw(sheet).extract({ left: col * cell, top: row * cell, width: cell, height: cell }).raw().toBuffer({ resolveWithObject: true })
        const raw = { data: cut.data, info: { ...cut.info, channels: 4 } }
        const box = opaqueBounds(raw, 120)
        fronts.push(await fromRaw(raw).extract(box).resize(10 * S, 16 * S, { fit: 'fill' }).removeAlpha().png().toBuffer())
      }
    }
  }
  const layout = async (front) => {
    const back = await sharp(front).flop().toBuffer()
    // Edge colour: the front's average, darkened a little.
    const { dominant } = await sharp(front).stats()
    const edge = { r: Math.round(dominant.r * 0.7), g: Math.round(dominant.g * 0.7), b: Math.round(dominant.b * 0.7), alpha: 1 }
    const strip = (w, h) => sharp({ create: { width: w, height: h, channels: 4, background: edge } }).png().toBuffer()
    return sharp({ create: { width: 64 * S, height: 32 * S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
      { input: await strip(1 * S, 16 * S), left: 0, top: 1 * S }, // left edge
      { input: front, left: 1 * S, top: 1 * S }, // front
      { input: await strip(1 * S, 16 * S), left: 11 * S, top: 1 * S }, // right edge
      { input: back, left: 12 * S, top: 1 * S }, // back
      { input: await strip(10 * S, 1 * S), left: 1 * S, top: 0 }, // top
      { input: await strip(10 * S, 1 * S), left: 11 * S, top: 0 } // bottom
    ])
  }
  let count = 0
  for (const [i, cape] of CAPES.entries()) {
    const front = fronts[i]
    if (!front) {
      console.log(`capes: no art for ${cape.id}, skipped`)
      continue
    }
    await (await layout(front)).png({ compressionLevel: 9 }).toFile(target(`${CAPE_TEXTURES}/${cape.id}.png`))
    count++
    for (let f = 0; f < (cape.animated ?? 0); f++) {
      // A soft diagonal highlight that travels down the cape, plus a few drifting sparkles.
      const phase = f / cape.animated
      const y = Math.round(16 * S * phase)
      const shimmer = Buffer.from(
        `<svg width="${10 * S}" height="${16 * S}"><defs><linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1">` +
          `<stop offset="${Math.max(0, phase - 0.25)}" stop-color="#fff" stop-opacity="0"/><stop offset="${phase}" stop-color="#ffe9a8" stop-opacity="0.55"/><stop offset="${Math.min(1, phase + 0.25)}" stop-color="#fff" stop-opacity="0"/>` +
          `</linearGradient></defs><rect width="${10 * S}" height="${16 * S}" fill="url(#g)"/>` +
          [0, 1, 2, 3].map((k) => `<circle cx="${((k * 37 + f * 11) % (10 * S - 8)) + 4}" cy="${((k * 53 + y) % (16 * S - 8)) + 4}" r="${2 + (k % 2)}" fill="#fff8d0" fill-opacity="0.85"/>`).join('') +
          `</svg>`
      )
      const frame = await sharp(front).composite([{ input: shimmer, blend: 'screen' }]).png().toBuffer()
      await (await layout(frame)).png({ compressionLevel: 9 }).toFile(target(`${CAPE_TEXTURES}/${cape.id}_f${f}.png`))
    }
  }
  console.log(`capes: ${count} cape textures (${CAPES.filter((c) => c.animated).length} animated)`)
}

/** The ESC menu layout and the geometry its client script shares. */
async function pauseMenu() {
  await writePauseLayout(target('pack/config/fancymenu/customization/lemursaucepacket_pause.txt'), target(`${MENU_ASSETS}/logo.png`))
  writeFileSync(target('pack/config/lemursaucepacket/hub_layout.json'), JSON.stringify(hubLayoutJson()))
  console.log('ESC menu: lemursaucepacket_pause.txt, config/lemursaucepacket/hub_layout.json')
}

// `node process.mjs` runs every step; naming steps runs only those, e.g. `node process.mjs launcherKit`.
const steps = { backgrounds, logo, emblems, installerArt, questPanel, icons, launcherKit, pixelKit, pauseMenu, items, armorLayers, capes }
const only = process.argv.slice(2)
for (const name of only) if (!(name in steps)) throw new Error(`Unknown step "${name}". Steps: ${Object.keys(steps).join(', ')}`)
for (const [name, step] of Object.entries(steps)) if (!only.length || only.includes(name)) await step()
