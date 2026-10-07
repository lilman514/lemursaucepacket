#!/usr/bin/env node
// Turns in-game screenshots into the website's pictures (website/assets/shots/<name>-{640,1280,1920}.webp) and the
// wiki's (docs/images/<name>.jpg, 1600 wide), from the list below. The screenshots themselves stay out of the repo:
// they come from a photo session in a test instance (see website/README.md).
//
//   node website/tools/shots.mjs <folder with shot_<name>.png files> [only-these-names...]
//
// Needs sharp, which lives under art/ (npm install there).

import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const sharp = (await import(pathToFileURL(path.join(root, 'art', 'node_modules', 'sharp', 'lib', 'index.js')).href)).default

// name: the published name; from: the screenshot (default shot_<name>.png); crop: [left, top, width, height] as
// fractions of the screenshot (UI close-ups); wiki: also write docs/images/<name>.jpg; web: false skips the site.
export const SHOTS = [
  { name: 'lemurton_hero', from: 'shot_air_southwest_afternoon.png', wiki: true },
  { name: 'lemurton_south', from: 'shot_air_south_morning.png' },
  { name: 'lemurton_corner', from: 'shot_air_northeast_morning.png', wiki: true },
  { name: 'lemurton_low', from: 'shot_air_low_market.png' },
  { name: 'lemurton_east', from: 'shot_air_east_noon.png' },
  { name: 'lemurton_golden', from: 'shot_air_south_golden.png' },
  { name: 'lemurton_market', wiki: true },
  { name: 'lemurton_cathedral', wiki: true },
  { name: 'lemurton_shops', wiki: true },
  { name: 'lemurton_fountain' },
  { name: 'lemurton_avenue' },
  { name: 'lemurton_gate', wiki: true },
  { name: 'lemurton_walls', wiki: true },
  { name: 'lemurton_outskirts' },
  { name: 'lemurton_towers' },
  { name: 'lemurton_night', from: 'shot_night_market.png', wiki: true },
  { name: 'lemurton_night_street', from: 'shot_night_street.png' },
  { name: 'lemurton_night_air', from: 'shot_night_air.png' },
  { name: 'npc_mayor', wiki: true },
  { name: 'npc_guard' },
  { name: 'npc_oziach' },
  { name: 'npc_ned', wiki: true },
  { name: 'hud_market', wiki: true },
  { name: 'xp_tracker', from: 'shot_xp_tracker_b.png' },
  { name: 'xp_tracker_cards', from: 'shot_xp_tracker_b.png', crop: [0.3, 0.06, 0.4, 0.42], web: false, wiki: true },
  { name: 'inventory', wiki: true },
  { name: 'coins_tooltip', wiki: true },
  { name: 'gear_tooltip', wiki: true },
  { name: 'esc_menu', wiki: true },
  { name: 'quest_book_landfall', wiki: true },
  { name: 'quest_book_welcome', wiki: true },
  { name: 'npc_dialog', wiki: true },
  { name: 'shop', wiki: true },
  { name: 'shop_smith', wiki: true },
  { name: 'event_window', wiki: true },
  { name: 'waystone_menu', wiki: true },
  { name: 'missions', wiki: true },
  { name: 'world_map', wiki: true },
  { name: 'memorial_front', from: 'shot_memorial_close.png', wiki: true },
  { name: 'memorial_diag' },
  { name: 'memorial_low' },
  { name: 'memorial_above' },
  { name: 'memorial_wide' },
  { name: 'memorial_dusk' },
  { name: 'elvarg', from: 'shot_elvarg_front.png', wiki: true },
  { name: 'elvarg_low' },
  { name: 'elvarg_side' },
  { name: 'elvarg_rear' },
  { name: 'lair_wide', wiki: true },
  // The Kilnfolk (1.8): Kiln Hollow, the Fight Pits and the Inferno. The bosses are shot as timed series (pits_jad_<n>,
  // inferno_zuk_<n>, inferno_shield_<n>); copy the best frame over shot_<name>.png before converting.
  { name: 'kiln_hollow', wiki: true },
  { name: 'kiln_aerial', wiki: true },
  { name: 'kiln_forge' },
  { name: 'kiln_dusk', wiki: true },
  { name: 'kiln_elder', wiki: true },
  { name: 'kiln_people' },
  { name: 'pits_window', wiki: true },
  { name: 'pits_arena', wiki: true },
  { name: 'pits_jad', wiki: true },
  { name: 'pits_jad_side' },
  { name: 'pits_menders', wiki: true },
  { name: 'inferno_arena', wiki: true },
  { name: 'inferno_zuk', wiki: true },
  { name: 'inferno_shield', wiki: true },
  { name: 'inferno_wide' },
  { name: 'set_prospector', wiki: true },
  { name: 'set_aeronaut', wiki: true },
  { name: 'set_duelist', wiki: true },
  { name: 'set_compacted_diamond', wiki: true },
  { name: 'set_compacted_netherite', wiki: true },
  { name: 'cape_fire_cape' },
  { name: 'cape_infernal_cape' },
  { name: 'armor_icons', crop: [0.40698, 0.29861, 0.18605, 0.40278], web: false, wiki: true },
  { name: 'launcher_home', from: 'launcher_home.png', wiki: true },
  { name: 'launcher_mods', from: 'launcher_mods.png', wiki: true },
  { name: 'launcher_settings', from: 'launcher_settings.png', wiki: true },
  { name: 'launcher_graphics', from: 'launcher_graphics.png' }
]

const [from, ...only] = process.argv.slice(2)
if (!from) {
  console.error('usage: node website/tools/shots.mjs <screenshot folder> [names...]')
  process.exit(1)
}
const webDir = path.join(root, 'website', 'assets', 'shots')
const wikiDir = path.join(root, 'docs', 'images')
mkdirSync(webDir, { recursive: true })
let done = 0
for (const shot of SHOTS) {
  if (only.length && !only.includes(shot.name)) continue
  const file = path.join(from, shot.from ?? `shot_${shot.name}.png`)
  if (!existsSync(file)) {
    console.warn(`  missing ${path.basename(file)} (for ${shot.name})`)
    continue
  }
  let image = sharp(file)
  if (shot.crop) {
    const meta = await image.metadata()
    const [l, t, w, h] = shot.crop
    image = sharp(file).extract({ left: Math.round(l * meta.width), top: Math.round(t * meta.height), width: Math.round(w * meta.width), height: Math.round(h * meta.height) })
  }
  const buffer = await image.png().toBuffer()
  if (shot.web !== false) {
    for (const width of [640, 1280, 1920]) {
      await sharp(buffer).resize({ width, withoutEnlargement: true }).webp({ quality: width > 1280 ? 80 : 78, effort: 6 }).toFile(path.join(webDir, `${shot.name}-${width}.webp`))
    }
  }
  if (shot.wiki) await sharp(buffer).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(wikiDir, `${shot.name}.jpg`))
  done++
}
console.log(`shots: ${done} converted → website/assets/shots and docs/images`)
