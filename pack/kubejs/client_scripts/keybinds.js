// LemurSaucePacket: the pack's key layout, for installs that already have an options.txt.
//
// New installs get these from the pack's options.txt. Existing installs keep theirs, so once per rule
// version this moves a key only if it's still on the default that clashes (e.g. Project MMO's glossary on P,
// which is also Social Interactions): anything a player rebound themselves is left alone.
// The ESC menu's buttons press some of these keys (config/fancymenu/customization/lemursaucepacket_pause.txt).
const KEYBIND_RULES_VERSION = 3
const KEYBIND_RULES = [
  // [keybind, only if currently on, move to]
  // Iris (always installed since 1.2.6) opens its shader pack screen with O, which is the pack's mute key.
  ['iris.keybind.shaderPackSelection', 'key.keyboard.o', 'key.keyboard.i'],
  // Project MMO's glossary crashes with Sodium in this pack (it registers a texture per biome off the render
  // thread), so it stays unbound; the inventory's skills panel is the skills screen.
  ['key.pmmo.openMenu', 'key.keyboard.p', 'key.keyboard.unknown'],
  ['key.pmmo.openMenu', 'key.keyboard.k', 'key.keyboard.unknown'],
  ['key.kubejs.kubedex', 'key.keyboard.k', 'key.keyboard.unknown'],
  ['key.pmmo.showList', 'key.keyboard.left.alt', 'key.keyboard.unknown'], // Left Alt is Create's toolbelt
  ['key.pmmo.showVein', 'key.keyboard.tab', 'key.keyboard.unknown'], // Tab is the player list
  ['key.pmmo.cyclevein', 'key.keyboard.apostrophe', 'key.keyboard.unknown'], // vein mining is off in this pack
  ['key.pmmo.addVein', 'key.keyboard.left.bracket', 'key.keyboard.unknown'],
  ['key.pmmo.subVein', 'key.keyboard.right.bracket', 'key.keyboard.unknown'],
  ['key.hide_icons', 'key.keyboard.h', 'key.keyboard.unknown'], // H opens Missions (ESC menu)
  ['key.brassworksmissions.track_missions_ui', 'key.keyboard.t', 'key.keyboard.unknown'], // T is chat
  ['key.inventoryessentials.sort_inventory', 'key.mouse.middle', 'key.keyboard.unknown'], // Sophisticated sorts
  ['key.ftbteams.open_gui', 'key.keyboard.unknown', 'key.keyboard.semicolon'], // Team (ESC menu)
  // Defaults the pack's options.txt already set, for installs made before them.
  ['key.mute_microphone', 'key.keyboard.m', 'key.keyboard.o'], // M is the world map (ESC menu)
  ['gui.xaero_new_waypoint', 'key.keyboard.b', 'key.keyboard.j'], // B is the backpack
  ['key.voice_chat_group', 'key.keyboard.g', 'key.keyboard.unknown'], // G is Curios
  ['gui.xaero_enlarge_map', 'key.keyboard.z', 'key.keyboard.unknown'], // Z is zoom
  ['key.shouldersurfing.swap_shoulder', 'key.keyboard.u', 'key.keyboard.unknown'], // U is waypoints
  ['key.shouldersurfing.free_look', 'key.keyboard.left.alt', 'key.keyboard.unknown']
]
const KEYBIND_MARKER = 'config/lemursaucepacket/keybinds.json'

// Client scripts only load on the client. Runs when joining a world or server (the launcher usually connects
// straight away, so the title screen isn't a reliable moment).
let keybindsChecked = false
ClientEvents.loggedIn((event) => {
  if (keybindsChecked) return
  keybindsChecked = true
  let done = JsonIO.read(KEYBIND_MARKER)
  if (done != null && done.version >= KEYBIND_RULES_VERSION) return
  let InputConstants = Java.loadClass('com.mojang.blaze3d.platform.InputConstants')
  let options = Client.options
  let moved = []
  options.keyMappings.forEach((mapping) => {
    // A keybind can have several rules (one per clashing default), so match the current key too.
    let current = String(mapping.saveString())
    let rule = KEYBIND_RULES.find((r) => r[0] === String(mapping.getName()) && r[1] === current)
    if (rule != null) {
      mapping.setKey(InputConstants.getKey(rule[2]))
      moved.push(`${rule[0]} -> ${rule[2]}`)
    }
  })
  if (moved.length > 0) {
    Java.loadClass('net.minecraft.client.KeyMapping').resetMapping()
    options.save()
  }
  JsonIO.write(KEYBIND_MARKER, { version: KEYBIND_RULES_VERSION })
  console.info(`[LemurSaucePacket] key layout v${KEYBIND_RULES_VERSION}: moved ${moved.length} key(s) ${moved.join(', ')}`)
})
