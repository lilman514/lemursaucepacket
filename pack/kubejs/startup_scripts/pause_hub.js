// LemurSaucePacket: moves the vanilla pause-menu buttons into the middle panel of the ESC menu board.
//
// The board, the side panels and their buttons are a FancyMenu layout (config/fancymenu/customization/
// lemursaucepacket_pause.txt); the numbers here come from the same source (art/hub.mjs writes both this
// script's config/lemursaucepacket/hub_layout.json and the layout). Vanilla's buttons are laid out by the
// screen itself, so they are moved just before the screen first draws: that is after every mod's own init
// handler has added its buttons (Create puts one next to "Give Feedback"), and those land in the free slots
// or in a tray under Disconnect, so nothing disappears.
//
// Startup scripts also load on the dedicated server, which has no screens: the whole thing is skipped there.
// (Rhino here only accepts const at the top level, hence the lets below.)

let pauseHubClient = true
let PauseScreenClass = null
let ButtonClass = null
let FancyMenuButtonClass = null
try {
  PauseScreenClass = Java.loadClass('net.minecraft.client.gui.screens.PauseScreen')
  ButtonClass = Java.loadClass('net.minecraft.client.gui.components.Button')
} catch (e) {
  pauseHubClient = false
}
try {
  FancyMenuButtonClass = Java.loadClass('de.keksuccino.fancymenu.util.rendering.ui.widget.button.ExtendedButton')
} catch (e) {}

// Rows of the middle panel, top to bottom. Each row is a list of slots, each slot the keys that may fill it
// (only one of them exists at a time). A row with a single slot spans the full width.
const PAUSE_ROWS = [
  [['menu.returnToGame']],
  [['menu.options'], ['fml.menu.mods']],
  [['gui.advancements'], ['gui.stats']],
  [['menu.playerReporting', 'menu.shareToLan'], ['menu.server_links']],
  [['menu.sendFeedback'], ['menu.reportBugs']],
  [['menu.disconnect', 'menu.returnToMenu']]
]
// (No Array.prototype.flat in this Rhino.)
const PAUSE_KEYS = PAUSE_ROWS.reduce((all, row) => all.concat(row.reduce((keys, slot) => keys.concat(slot), [])), [])
let pauseHubLayout = null
let pauseHubErrorLogged = false
let arrangedScreen = null
let arrangedWidth = 0
let arrangedHeight = 0

const pauseTranslationKey = (widget) => {
  try {
    let contents = widget.getMessage().getContents()
    if (contents != null && typeof contents.getKey === 'function') return String(contents.getKey())
  } catch (e) {}
  return null
}

const arrangePauseScreen = (screen) => {
  if (pauseHubLayout == null) pauseHubLayout = JsonIO.read('config/lemursaucepacket/hub_layout.json')
  if (pauseHubLayout == null) return
  let v = pauseHubLayout.vanilla
  let cx = Math.floor(screen.width / 2)
  let cy = Math.floor(screen.height / 2)
  let byKey = {}
  let extras = []
  screen.children().forEach((w) => {
    if (!(w instanceof ButtonClass)) return
    if (FancyMenuButtonClass != null && w instanceof FancyMenuButtonClass) return
    let key = pauseTranslationKey(w)
    if (key != null && PAUSE_KEYS.indexOf(key) >= 0) byKey[key] = w
    else extras.push(w)
  })
  let row = 0
  let freeSlots = []
  PAUSE_ROWS.forEach((slots) => {
    let found = slots.map((keys) => keys.map((k) => byKey[k]).find((w) => w != null))
    if (found.every((w) => w == null)) return
    let y = cy + v.y + row * v.pitch
    if (slots.length === 1) {
      found[0].setWidth(v.fullWidth)
      found[0].setPosition(cx + v.x, y)
    } else {
      found.forEach((w, i) => {
        let x = cx + v.x + i * (v.halfWidth + 8)
        if (w != null) {
          w.setWidth(v.halfWidth)
          w.setPosition(x, y)
        } else freeSlots.push([x, y])
      })
    }
    row++
  })
  // Small icon buttons go in a tray under Disconnect; wide extras take free half slots, then new rows.
  let trayX = cx + v.x
  extras.forEach((w) => {
    if (w.getWidth() <= 24 && w.getHeight() <= 24) {
      w.setPosition(trayX, cy + v.trayY)
      trayX += w.getWidth() + 4
    } else if (freeSlots.length > 0) {
      let slot = freeSlots.shift()
      w.setWidth(v.halfWidth)
      w.setPosition(slot[0], slot[1])
    } else {
      w.setWidth(v.fullWidth)
      w.setPosition(cx + v.x, cy + v.y + row * v.pitch)
      row++
    }
  })
}

if (pauseHubClient) {
  NativeEvents.onEvent('net.neoforged.neoforge.client.event.ScreenEvent$Render$Pre', (event) => {
    try {
      let screen = event.getScreen()
      if (!(screen instanceof PauseScreenClass)) {
        arrangedScreen = null
        return
      }
      // Once per pause screen, and again after a resize (which re-runs the vanilla layout).
      // (=== compares the wrapped Java objects by identity; equals() isn't exposed to scripts.)
      if (arrangedScreen != null && screen === arrangedScreen && screen.width === arrangedWidth && screen.height === arrangedHeight) return
      arrangePauseScreen(screen)
      arrangedScreen = screen
      arrangedWidth = screen.width
      arrangedHeight = screen.height
    } catch (e) {
      if (!pauseHubErrorLogged) console.error(`[LemurSaucePacket] ESC menu layout error (later ones not logged): ${e}`)
      pauseHubErrorLogged = true
    }
  })
}
