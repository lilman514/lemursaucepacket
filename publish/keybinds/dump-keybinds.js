// TEST ONLY: a KubeJS startup script for a test client. Not part of the pack, and not a Node script.
//
// Once the title screen is up, writes every key mapping the game registers to kubejs/keybinds-dump.json:
// its name and category (translated too), its default key and NeoForge key modifier (only the running game
// knows these, they live in each mod's code), and which mod's language file names it.
// publish/keybinds.mjs says how to refresh publish/keybinds/defaults.json with it.
const KEYBIND_DUMP_FILE = 'kubejs/keybinds-dump.json'
let keybindDumpDone = false
let keybindDumpFrames = 0
let keybindDumpClient = true
try {
  Java.loadClass('net.minecraft.client.gui.screens.TitleScreen')
} catch (e) {
  keybindDumpClient = false // startup scripts load on a dedicated server too
}

function dumpKeybinds() {
  let mc = Java.loadClass('net.minecraft.client.Minecraft').getInstance()
  let Component = Java.loadClass('net.minecraft.network.chat.Component')
  let Language = Java.loadClass('net.minecraft.locale.Language')
  let ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
  let tr = (key) => String(Component.translatable(key).getString())

  // Names and categories to look up in the language files.
  let wanted = {}
  mc.options.keyMappings.forEach((m) => {
    wanted[String(m.getName())] = true
    wanted[String(m.getCategory())] = true
  })
  // The first (lowest) pack whose en_us.json has a name is the mod that added it; later packs only rename it.
  let owners = {}
  let langErrors = 0
  let resources = mc.getResourceManager()
  resources.getNamespaces().forEach((ns) => {
    let namespace = String(ns)
    resources.getResourceStack(ResourceLocation.fromNamespaceAndPath(namespace, 'lang/en_us.json')).forEach((res) => {
      let pack = String(res.sourcePackId())
      let stream = null
      try {
        stream = res.open()
        Language.loadFromJson(stream, (k, v) => {
          let key = String(k)
          if (wanted[key] === true && owners[key] == null) owners[key] = { pack: pack, namespace: namespace }
        })
      } catch (e) {
        langErrors++
        console.warn(`[keybinds-dump] ${namespace} (${pack}): ${e}`)
      }
      if (stream != null) {
        try {
          stream.close()
        } catch (e) {}
      }
    })
  })

  let mappings = []
  let modIds = {}
  mc.options.keyMappings.forEach((m) => {
    let name = String(m.getName())
    let category = String(m.getCategory())
    let key = m.getDefaultKey()
    let modifier = m.getDefaultKeyModifier()
    let owner = owners[name] || owners[category] || null
    if (owner != null) {
      if (owner.pack.indexOf('mod/') === 0) owner.pack.slice(4).split(',').forEach((id) => (modIds[id] = true))
      else modIds[owner.namespace] = true
    }
    mappings.push({
      name: name,
      title: tr(name),
      category: category,
      categoryTitle: tr(category),
      key: String(key.getName()),
      modifier: String(modifier),
      context: String(m.getKeyConflictContext()).replace(/@[0-9a-f]+$/, ''),
      owner: owner == null ? null : owner.pack,
      ownerNamespace: owner == null ? null : owner.namespace
    })
  })

  let mods = { minecraft: 'Minecraft' }
  Object.keys(modIds).forEach((id) => {
    if (Platform.isLoaded(id)) mods[id] = String(Platform.getInfo(id).getName())
  })

  // Every key's name as the Controls screen shows it ("E", "Left Shift", "Keypad 0"), bound or not.
  let InputType = Java.loadClass('com.mojang.blaze3d.platform.InputConstants$Type')
  let keys = {}
  let addKey = (k) => {
    let id = String(k.getName())
    let translated = tr(id) // letters and digits have no translation, so the screen shows GLFW's name for them
    keys[id] = translated !== id ? translated : String(k.getDisplayName().getString())
  }
  // GLFW key codes: printable keys, then Escape to End, the locks, F1-F12, the keypad, the modifiers.
  let codes = [[32, 32], [39, 39], [44, 57], [59, 59], [61, 61], [65, 93], [96, 96], [256, 269], [280, 284], [290, 301], [320, 336], [340, 348]]
  codes.forEach((range) => {
    for (let code = range[0]; code <= range[1]; code++) addKey(InputType.KEYSYM.getOrCreate(code))
  })
  for (let button = 0; button < 5; button++) addKey(InputType.MOUSE.getOrCreate(button))

  JsonIO.write(KEYBIND_DUMP_FILE, {
    dumped: new Date().toISOString().slice(0, 10),
    minecraft: String(Platform.getMcVersion()),
    neoforge: String(Platform.getInfo('neoforge').getVersion()),
    modifiers: { CONTROL: tr('neoforge.controlsgui.control'), SHIFT: tr('neoforge.controlsgui.shift'), ALT: tr('neoforge.controlsgui.alt') },
    mods: mods,
    keys: keys,
    keyMappings: mappings
  })
  console.info(`[keybinds-dump] wrote ${mappings.length} key mappings (${Object.keys(owners).length} names traced to a language file, ${langErrors} unreadable) to ${KEYBIND_DUMP_FILE}`)
}

if (keybindDumpClient) {
  NativeEvents.onEvent('net.neoforged.neoforge.client.event.ScreenEvent$Render$Post', (event) => {
    if (keybindDumpDone || String(event.getScreen()).indexOf('TitleScreen') < 0) return
    keybindDumpFrames++
    if (keybindDumpFrames < 10) return
    keybindDumpDone = true
    try {
      dumpKeybinds()
    } catch (e) {
      console.error(`[keybinds-dump] failed: ${e}`)
    }
  })
}
