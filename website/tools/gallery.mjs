#!/usr/bin/env node
// Writes website/gallery.html from the list below: the head and footer come from updates.html (so the pages share
// them), the tiles from website/assets/shots (see shots.mjs). Run after adding or renaming a screenshot.
//
//   node website/tools/gallery.mjs

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// [name, caption, filter tags, wide tile]
const G = [
  ['lemurton_hero', 'Lemurton from the south-west, in the afternoon', 'city', true],
  ['lemurton_market', 'The market square and its great tree', 'city'],
  ['lemurton_cathedral', 'The cathedral', 'city'],
  ['lemurton_south', 'The south walls on a clear morning', 'city'],
  ['lemurton_gate', 'The south gatehouse in the late sun', 'city'],
  ['lemurton_walls', 'The wall walk at sunset', 'city', true],
  ['lemurton_shops', 'Shops on the ring street', 'city'],
  ['lemurton_fountain', 'The fountain square', 'city'],
  ['lemurton_avenue', 'The avenue from the south gate', 'city'],
  ['lemurton_corner', 'The north-east corner', 'city'],
  ['lemurton_low', 'Over the rooftops to the market', 'city', true],
  ['lemurton_east', 'From the east at noon', 'city'],
  ['lemurton_golden', 'The southern towers in the evening light', 'city'],
  ['lemurton_outskirts', 'Gardens inside the north-east wall', 'city'],
  ['lemurton_towers', 'The south-east towers', 'city'],
  ['lemurton_night', 'The market by night', 'city night', true],
  ['lemurton_night_street', 'The avenue after dark', 'city night'],
  ['lemurton_night_air', 'Lemurton at dusk', 'city night'],
  ['npc_mayor', 'Mayor Thaddeus has work for newcomers', 'people'],
  ['npc_guard', 'A city guard at the gate', 'people'],
  ['npc_oziach', 'Oziach, the old dragon slayer, in his armoury', 'people'],
  ['npc_ned', 'Ned, at the Crandor memorial', 'people crandor'],
  ['memorial_front', 'The Crandor memorial', 'crandor', true],
  ['memorial_diag', 'The memorial and its braziers', 'crandor'],
  ['memorial_low', 'The skull on its dais', 'crandor'],
  ['memorial_above', "The memorial below Elvarg's hill", 'crandor'],
  ['memorial_wide', "Crandor's jungle", 'crandor'],
  ['memorial_dusk', 'Dusk at the memorial', 'crandor'],
  ['elvarg', 'Elvarg on her hoard', 'crandor', true],
  ['elvarg_side', 'A fire dragon in her prime', 'crandor'],
  ['elvarg_rear', 'Elvarg and her gold', 'crandor'],
  ['elvarg_low', 'Too close for comfort', 'crandor'],
  ['lair_wide', 'Her lair: a clearing she burnt for herself', 'crandor'],
  ['event_window', "Ned's window: fight alone or open a co-op fight", 'interface crandor'],
  ['esc_menu', 'The ESC menu', 'interface', true],
  ['inventory', 'The inventory and the skills panel', 'interface'],
  ['xp_tracker', 'XP as it comes in', 'interface'],
  ['hud_market', 'The HUD in Lemurton', 'interface'],
  ['gear_tooltip', 'Gear tooltips: rarity, stats and requirements', 'interface'],
  ['coins_tooltip', 'Gold Coins: one stack, however many', 'interface'],
  ['shop', "Bessa the Baker's stall", 'interface'],
  ['shop_smith', "Brann the Smith's shop", 'interface'],
  ['npc_dialog', 'Talking to the mayor', 'interface'],
  ['quest_book_landfall', 'The quest book: Landfall', 'interface'],
  ['quest_book_welcome', 'The quest book: Welcome to Lemurton', 'interface'],
  ['missions', 'Brassworks missions', 'interface'],
  ['waystone_menu', 'The waystone menu', 'interface'],
  ['world_map', 'The world map', 'interface'],
  ['launcher_home', 'The launcher: Home', 'launcher', true],
  ['launcher_mods', 'The launcher: Mods', 'launcher'],
  ['launcher_settings', 'The launcher: Settings', 'launcher'],
  ['launcher_graphics', 'The launcher: shaders and more', 'launcher']
]

const attr = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
const shown = G.filter(([n]) => existsSync(path.join(site, 'assets', 'shots', `${n}-640.webp`)))
for (const [n] of G) if (!shown.find((g) => g[0] === n)) console.warn(`  no pictures for ${n}, left out`)
const tiles = shown
  .map(([n, cap, tags, wide]) => {
    const height = n.startsWith('launcher') ? 800 : 720
    const sizes = wide ? '(max-width: 960px) 100vw, 600px' : '(max-width: 640px) 100vw, (max-width: 960px) 50vw, 300px'
    return (
      `      <a class="shot${wide ? ' wide' : ''}" href="/assets/shots/${n}-1920.webp" data-lightbox="gallery" data-tags="${tags}" data-caption="${attr(cap)}">` +
      `<img src="/assets/shots/${n}-${wide ? 1280 : 640}.webp" srcset="/assets/shots/${n}-640.webp 640w, /assets/shots/${n}-1280.webp 1280w" sizes="${sizes}" width="1280" height="${height}" loading="lazy" decoding="async" alt="${attr(cap)}">` +
      `<figcaption>${attr(cap)}</figcaption></a>`
    )
  })
  .join('\n')

const page = readFileSync(path.join(site, 'updates.html'), 'utf8')
const head = page
  .slice(0, page.indexOf('<main id="main">'))
  .replace('<title>Updates · LemurSaucePacket</title>', '<title>Gallery · LemurSaucePacket</title>')
  .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="Screenshots from the LemurSaucePacket server: Lemurton, the Crandor memorial, Elvarg's Lair, the menus and the launcher.">`)
  .replace('https://play.limas.ca/updates"', 'https://play.limas.ca/gallery"')
  .replace('https://play.limas.ca/updates"', 'https://play.limas.ca/gallery"')
  .replace('<meta property="og:title" content="LemurSaucePacket updates">', '<meta property="og:title" content="LemurSaucePacket gallery">')
  .replace('<meta property="og:description" content="Every pack update, newest first.">', '<meta property="og:description" content="Lemurton, Crandor, Elvarg and the menus, in screenshots.">')
  .replace('<a href="/gallery">Gallery</a>', '<a href="/gallery" aria-current="page">Gallery</a>')
  .replace('<a href="/updates" aria-current="page">Updates</a>', '<a href="/updates">Updates</a>')
const foot = page.slice(page.indexOf('</main>'))
const main = `<main id="main">
<section class="page-hero">
  <img class="bg" src="/assets/shots/lemurton_low-1280.webp" srcset="/assets/shots/lemurton_low-640.webp 640w, /assets/shots/lemurton_low-1280.webp 1280w, /assets/shots/lemurton_low-1920.webp 1920w" sizes="100vw" width="1280" height="720" alt="">
  <div class="wrap">
    <p class="kicker"><img src="/assets/emblems/atlas.webp" width="36" height="36" alt="">Gallery</p>
    <h1>Have a look round</h1>
    <p>Every screenshot comes from the server's own world, taken in game with the launcher's Fancy shaders (Complementary Unbound) and the render distance turned up. Click one to see it large; the arrow keys page through.</p>
  </div>
</section>

<section class="section tight">
  <div class="wrap">
    <div class="gallery-filters" role="group" aria-label="Show">
      <button type="button" data-filter="all" aria-pressed="true">Everything</button>
      <button type="button" data-filter="city" aria-pressed="false">Lemurton</button>
      <button type="button" data-filter="night" aria-pressed="false">By night</button>
      <button type="button" data-filter="people" aria-pressed="false">Townsfolk</button>
      <button type="button" data-filter="crandor" aria-pressed="false">Crandor and Elvarg</button>
      <button type="button" data-filter="interface" aria-pressed="false">Menus</button>
      <button type="button" data-filter="launcher" aria-pressed="false">Launcher</button>
    </div>
    <div class="gallery">
${tiles}
    </div>
  </div>
</section>
`
writeFileSync(path.join(site, 'gallery.html'), head + main + foot)
console.log(`gallery: ${shown.length} pictures → website/gallery.html`)
