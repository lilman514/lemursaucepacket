// Turns the generated art in art/generated into the files the pack, launcher and server use.
//   cd art && npm install && npm run process
//
// Sources (made with Higgsfield, GPT Image 2.5):
//   keyart-a.png   title screen background
//   keyart-b.png   loading screen background and launcher hero
//   logo-a.png     "LemurSaucePacket" wordmark (transparent)
//   emblems.png    4x4 sheet: 13 quest chapter emblems, the lemur mascot, a quest book, tools
//
// Re-run after replacing any of them. The FancyMenu layouts in pack/config/fancymenu/customization
// size the logo from its aspect ratio, which this script prints.

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

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

await backgrounds()
await logo()
await emblems()
await installerArt()
await questPanel()
