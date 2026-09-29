// LemurSaucePacket capes, client side: draws the cape each player wears (capes.js on the server says who
// wears what). CapeJS maps a player to one texture location for the whole session (its map entry can't be
// changed afterwards), so every player gets a location of their own here, and the texture registered
// behind that location is swapped whenever their cape changes. Animated capes swap to the next frame's PNG
// on a timer; each swap registers a fresh SimpleTexture, and the texture manager closes the previous one.

const CLIENT_CAPES = JsonIO.read('config/lemursaucepacket/capes.json').capes
const CapeRegistryClass = Java.loadClass('dev.thestaticvoid.capejs.CapeRegistry')
const CapeRL = Java.loadClass('net.minecraft.resources.ResourceLocation')
const CapeSimpleTexture = Java.loadClass('net.minecraft.client.renderer.texture.SimpleTexture')
const CAPE_NONE = 'lemursaucepacket:textures/capes/none.png'
const CAPE_FRAME_TICKS = 4

let capeWearing = {} // uuid -> cape id ('' for none)
let capeRegistered = {} // uuid -> true once CapeJS knows the player's location
let capeClientErrorLogged = false
const capeClientError = (where, e) => {
  if (!capeClientErrorLogged) console.error(`[LemurSaucePacket] cape client error in ${where} (later ones not logged): ${e}`)
  capeClientErrorLogged = true
}

const capeKey = (uuid) => CapeRL.parse(`lemursaucepacket:textures/capes/player_${String(uuid).replace(/-/g, '')}.png`)

/** The PNG to show for a cape: its texture, or frame N of an animated one (id_f0.png, id_f1.png, …). */
const capeTextureFor = (id, frame) => {
  let cape = CLIENT_CAPES[id]
  if (cape == null) return CAPE_NONE
  if (cape.frames > 1) return cape.texture.replace(/\.png$/, `_f${frame % cape.frames}.png`)
  return cape.texture
}

function capeShow(uuid, id, frame) {
  let key = capeKey(uuid)
  if (!capeRegistered[uuid]) {
    CapeRegistryClass.addCapeToMap(String(uuid), key)
    capeRegistered[uuid] = true
  }
  Client.getTextureManager().register(key, new CapeSimpleTexture(CapeRL.parse(capeTextureFor(id, frame))))
}

// The data arrives as NBT: event.data is a CompoundTag, so its "capes" entry is read with the tag API.
NetworkEvents.dataReceived('lemursaucepacket:capes', (event) => {
  try {
    let capes = event.data.get('capes')
    if (capes == null) return
    let seen = []
    capes.getAllKeys().forEach((uuid) => {
      let id = String(capes.getString(uuid) || '')
      seen.push(`${uuid}=${id || '-'}`)
      if (capeWearing[uuid] === id) return
      capeWearing[uuid] = id
      capeShow(uuid, id, 0)
    })
    console.info(`[LemurSaucePacket] capes received: ${seen.join(', ')}`)
  } catch (e) {
    capeClientError('receive', e)
  }
})

// Animation: every few ticks, every player wearing an animated cape gets the next frame.
let capeTicks = 0
ClientEvents.tick((event) => {
  capeTicks++
  if (capeTicks % CAPE_FRAME_TICKS !== 0) return
  try {
    let step = capeTicks / CAPE_FRAME_TICKS
    Object.keys(capeWearing).forEach((uuid) => {
      let id = capeWearing[uuid]
      let cape = CLIENT_CAPES[id]
      if (cape == null || cape.frames <= 1) return
      capeShow(uuid, id, step)
    })
  } catch (e) {
    capeClientError('animate', e)
  }
})
