// TEST-ONLY. Never copy this into pack/. The atlas photo session's driver, a KubeJS client script for the headless
// test client. wiki/photos/prepare.mjs writes it into <instance>/kubejs/client_scripts/zz_atlas_shots.js with the shot
// list filled in. The test client joins a scratch server as an op (`--op Tester`) and this walks the list:
//   biome:    /locate biome, fly there (spectator), pick a viewpoint from the land around it, shoot atlas_b_<key>.png
//   creature: summon it, frozen, on a little stage in the sky (fish in a glass tank), shoot atlas_c_<key>.png
// It logs to <instance>/logs/kubejs/client.log as "[atlas] ..." and ends with "[atlas] all shots done". Then
// wiki/photos/collect.mjs turns the shots into docs/images/atlas/<kind>/<key>.webp for the wiki.
//
// Rhino (KubeJS 2101): only top-level `const`; `let` everywhere else.

const AT_SHOTS = /*SHOTS*/ [] /*END*/
// arrive: ticks after landing before the viewpoint is chosen; settle: the least wait after moving the camera;
// loaded: the share of chunks in reach that must be there before a shot (or `patience` ticks, whichever first);
// distant: ticks more for Distant Horizons to fill in the land past the render distance (open-air views only), and
// peek: also a shot halfway through that wait (`<name>_peek`), to see how far it gets; borderless: the window fills
// the screen without a frame (windowed fullscreen), so it keeps drawing behind other windows.
const AT_OPTS = /*OPTS*/ { arrive: 120, settle: 60, loaded: 0.97, patience: 900, timeout: 1200, locate: 3600, distant: 0, peek: false, borderless: false } /*END*/
// /locate looks 6400 blocks round where it's asked from: a rare biome not found from here is looked for again from these.
const AT_ORIGINS = [
  [14000, 0],
  [-14000, 0]
]

const ATJ = {
  Screenshot: Java.loadClass('net.minecraft.client.Screenshot'),
  GLFW: Java.loadClass('org.lwjgl.glfw.GLFW'),
  Heightmap: Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types'),
  // The keys (none bound to anything in the pack): Enter take the picture, F9 skip, F8 previous spot, Home start view.
  KEY_SHOOT: 257,
  KEY_SHOOT2: 335,
  KEY_SKIP: 298,
  KEY_PREV: 297,
  KEY_BACK: 268
}
const atSay = (s) => console.info(`[atlas] ${s}`)
const atCmd = (c) => Client.player.connection.sendCommand(c)
// The creatures' stage: high in the sky over the world's centre, the sun behind the camera in the morning.
const AT_STAGE = [0, 210, 0]

let atTicks = 0
let atIndex = -1
let atPhase = 'start'
let atSince = 0
let atFound = null
let atFailed = ''
let atTarget = null
let atDim = ''
let atStats = { shot: 0, skipped: [] }

const atPhaseTo = (p) => {
  atPhase = p
  atSince = atTicks
}

// /locate answers in chat: "The nearest <id> is at [x, y, z] (n blocks away)", or 'Could not find a biome of type
// "<id>" ...'. Only an answer naming this shot's biome counts: a slow search can answer during the next shot.
NativeEvents.onEvent('net.neoforged.neoforge.client.event.ClientChatReceivedEvent$System', (e) => {
  if (atPhase !== 'locating') return
  let shot = AT_SHOTS[atIndex]
  let s = ''
  try {
    s = String(e.getMessage().getString())
  } catch (err) {
    return
  }
  if (shot == null || s.indexOf(shot.id) < 0) return
  let m = /\[(-?\d+), (-?\d+|~), (-?\d+)\]/.exec(s)
  if (m) atFound = [Number(m[1]), m[2] === '~' ? null : Number(m[2]), Number(m[3])]
  else if (/could not find|unknown|incorrect|invalid/i.test(s)) atFailed = s
})

const atGround = (x, z) => Client.level.getHeight(ATJ.Heightmap.MOTION_BLOCKING, Math.floor(x), Math.floor(z))
/** Whether the top of a column is water (or another fluid): the heightmap stops at the surface of the sea. */
const atWet = (x, g, z) => {
  try {
    return !Client.level.getFluidState(new BlockPos(Math.floor(x), g - 1, Math.floor(z))).isEmpty()
  } catch (e) {
    return false
  }
}
const atLoaded = (x, z) => {
  try {
    return Client.level.getChunkSource().hasChunk(Math.floor(x) >> 4, Math.floor(z) >> 4)
  } catch (e) {
    return true
  }
}
/** The share of the chunks within `r` chunks of x z that the client has. */
const atLoadedShare = (x, z, r) => {
  let cx = Math.floor(x) >> 4
  let cz = Math.floor(z) >> 4
  let n = 0
  let have = 0
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      n++
      try {
        if (Client.level.getChunkSource().hasChunk(cx + dx, cz + dz)) have++
      } catch (e) {
        have++
      }
    }
  }
  return have / n
}
let atReadyAt = -1
const atBiome = (x, y, z) => {
  try {
    return String(Client.level.getBiome(new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z))).unwrapKey().get().location())
  } catch (e) {
    return ''
  }
}
/** Whether the eye passes through (air, plants, vines, water): what a view can see past. */
const atOpen = (x, y, z) => {
  try {
    let st = Client.level.getBlockState(new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z)))
    return st.isAir() || !st.isSolid()
  } catch (e) {
    return false
  }
}
const atLook = (cx, cy, cz, tx, ty, tz) => {
  let dx = tx - cx
  let dy = ty - cy
  let dz = tz - cz
  return [(Math.atan2(-dx, dz) * 180) / Math.PI, (-Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * 180) / Math.PI]
}
const atTp = (dim, x, y, z, yaw, pitch) => atCmd(`execute in ${dim} run tp @s ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)} ${yaw.toFixed(1)} ${pitch.toFixed(1)}`)

/**
 * A viewpoint over a surface biome: the middle of the biome's land in reach, seen from the east (the morning sun
 * behind the camera), high enough that no hill in between hides it. Returns [x, y, z, yaw, pitch].
 */
const atFrameLand = (shot, T, sea) => {
  let min = Client.level.getMinBuildHeight()
  let pts = []
  let grid = []
  // A wide look round (the land in reach is loaded by now): /locate gives the biome's nearest edge, not its middle.
  for (let dx = -160; dx <= 160; dx += 10) {
    for (let dz = -160; dz <= 160; dz += 10) {
      let x = T[0] + dx
      let z = T[2] + dz
      if (!atLoaded(x, z)) continue
      let g = atGround(x, z)
      if (g <= min + 1) continue
      let mine = atBiome(x, g - 1, z) === shot.id
      let wet = atWet(x, g, z)
      grid.push([x, g, z, mine, wet])
      if (mine) pts.push([x, g, z, wet])
    }
  }
  // A land biome is framed round its land: a coastal strip or an island's middle can lie out at sea.
  if (!sea) {
    let dry = pts.filter((p) => !p[3])
    if (dry.length >= 3) pts = dry
  }
  let M = [T[0], atGround(T[0], T[2]), T[2]]
  let spread = 24
  if (pts.length >= 3) {
    let sx = 0
    let sz = 0
    pts.forEach((p) => {
      sx += p[0]
      sz += p[2]
    })
    M = [sx / pts.length, 0, sz / pts.length]
    M[1] = atGround(M[0], M[2])
    let sd = 0
    pts.forEach((p) => (sd += Math.sqrt((p[0] - M[0]) * (p[0] - M[0]) + (p[2] - M[2]) * (p[2] - M[2]))))
    spread = sd / pts.length
  }
  let dist = Math.max(28, Math.min(64, spread * 1.3))
  // From whichever of eight sides sees the most of the biome's land and the least water (a sea biome is looked at
  // from the east, as before: the sea is the subject).
  let dir = [1, 0]
  if (!sea) {
    let bestScore = -1e9
    for (let k = 0; k < 8; k++) {
      let ux = Math.cos((k * Math.PI) / 4)
      let uz = Math.sin((k * Math.PI) / 4)
      let cx = M[0] + dist * ux
      let cz = M[2] + dist * uz
      let score = 0
      grid.forEach((p) => {
        let vx = p[0] - cx
        let vz = p[2] - cz
        let along = -(vx * ux + vz * uz)
        if (along < 8 || along > 220) return
        if (Math.abs(vx * uz - vz * ux) > along * 0.75) return
        if (p[4]) score -= 1
        else if (p[3]) score += 2
      })
      if (score > bestScore) {
        bestScore = score
        dir = [ux, uz]
      }
    }
  }
  let C = [M[0] + dist * dir[0], 0, M[2] + dist * dir[1]]
  // Look across the biome, at a point past its middle, rather than down at the ground in front.
  let F = [M[0] - dist * 0.8 * dir[0], 0, M[2] - dist * 0.8 * dir[1]]
  let ty = sea ? 63 : Math.max(atGround(F[0], F[2]), min + 1)
  let near = -1e9
  for (let ox = -3; ox <= 3; ox += 3) for (let oz = -3; oz <= 3; oz += 3) near = Math.max(near, atGround(C[0] + ox, C[2] + oz))
  let cy = sea ? 70 : Math.max(near, M[1]) + (shot.lift || 10)
  // Lift the camera until the line to the middle clears every hill between.
  for (let pass = 0; pass < 3; pass++) {
    for (let k = 1; k < 20; k++) {
      let f = k / 20
      let need = atGround(C[0] + (M[0] - C[0]) * f, C[2] + (M[2] - C[2]) * f) + 2
      let line = cy + (M[1] + 2 - cy) * f
      if (line < need) cy += (need - line) / (1 - f)
    }
  }
  cy = Math.min(cy, Math.max(near, M[1]) + 70)
  // Clear of the land round the camera too (hills, peaks, a forest's crowns), so it looks out over the land rather
  // than into a hillside or a canopy.
  let high = shot.lift >= 18
  let r = high ? 40 : shot.lift >= 14 ? 32 : 24
  let around = -1e9
  for (let ox = -r; ox <= r; ox += 8) for (let oz = -r; oz <= r; oz += 8) around = Math.max(around, atGround(C[0] + ox, C[2] + oz))
  if (!sea) cy = Math.max(cy, around + (high ? 12 : 6))
  let a = atLook(C[0], cy + 1.62, C[2], F[0], ty + 4, F[2])
  atSay(`${shot.id}: ${pts.length} spots of it near ${T[0]} ${T[2]}, middle ${M[0].toFixed(0)} ${M[1]} ${M[2].toFixed(0)}, camera ${C[0].toFixed(0)} ${cy.toFixed(0)} ${C[2].toFixed(0)}`)
  return [C[0], cy, C[2], a[0], Math.min(16, Math.max(6, a[1]))]
}

/**
 * A viewpoint kept from an earlier session (prepare.mjs --spots): the camera where it stood, looking across the
 * biome's middle as atFrameLand did. The distant land was pre-built round these spots.
 */
const atFrameKept = (shot) => {
  let C = shot.cam
  let M = shot.mid
  let F = [M[0] + 0.8 * (M[0] - C[0]), 0, M[2] + 0.8 * (M[2] - C[2])]
  let ty = shot.how === 'sea' ? 63 : Math.max(atGround(F[0], F[2]), Client.level.getMinBuildHeight() + 1)
  let a = atLook(C[0], C[1] + 1.62, C[2], F[0], ty + 4, F[2])
  return [C[0], C[1], C[2], a[0], Math.min(16, Math.max(6, a[1]))]
}

/** Windowed fullscreen: no frame, the size of the screen, at its corner. */
const atBorderless = () => {
  try {
    let win = Client.getWindow().getWindow()
    let mode = ATJ.GLFW.glfwGetVideoMode(ATJ.GLFW.glfwGetPrimaryMonitor())
    ATJ.GLFW.glfwSetWindowAttrib(win, ATJ.GLFW.GLFW_DECORATED, ATJ.GLFW.GLFW_FALSE)
    ATJ.GLFW.glfwSetWindowPos(win, 0, 0)
    ATJ.GLFW.glfwSetWindowSize(win, mode.width(), mode.height())
    atSay(`borderless window, ${mode.width()}x${mode.height()}`)
  } catch (e) {
    atSay(`couldn't make the window borderless: ${e}`)
  }
}

/**
 * A viewpoint inside a cave biome (or the Nether): standing a little above the floor, looking along the open way
 * nearest `want` blocks long (a far wall in view; the longest view in the Nether is only fog).
 */
const atFrameHollow = (shot, T, radius, want, pitch) => {
  let y0 = T[1] != null ? T[1] : 40
  let best = null
  let bestScore = -1e9
  for (let dy = -Math.floor(radius / 2); dy <= Math.floor(radius / 2); dy += 3) {
    for (let dx = -radius; dx <= radius; dx += 3) {
      for (let dz = -radius; dz <= radius; dz += 3) {
        if (bestScore >= 9) break
        let x = T[0] + dx
        let y = y0 + dy
        let z = T[2] + dz
        if (!atOpen(x, y, z) || !atOpen(x, y + 1, z)) continue
        let f = 1
        while (f <= 4 && atOpen(x, y - f, z)) f++
        if (f > 4) continue
        if (atBiome(x, y, z) !== shot.id) continue
        for (let k = 0; k < 8; k++) {
          let a = (k * Math.PI) / 4
          let n = 1
          while (n < 48 && atOpen(x - Math.sin(a) * n, y + 1, z + Math.cos(a) * n)) n++
          let score = 10 - Math.abs(n - want) / 2
          if (score > bestScore) {
            bestScore = score
            best = [x + 0.5, y - f + 2, z + 0.5, (a * 180) / Math.PI, pitch]
          }
        }
      }
    }
  }
  atSay(`${shot.id}: view score ${bestScore.toFixed(1)}${best ? ` at ${best[0].toFixed(0)} ${best[1].toFixed(0)} ${best[2].toFixed(0)}` : ''}`)
  return best
}

const atShoot = (name) => {
  let win = Client.getWindow().getWindow()
  if (ATJ.GLFW.glfwGetWindowAttrib(win, ATJ.GLFW.GLFW_ICONIFIED) === 1) {
    ATJ.GLFW.glfwRestoreWindow(win)
    atSay(`the window was minimised before ${name}: restored it, shooting a second later`)
    return false
  }
  try {
    Client.getToasts().clear()
  } catch (e) {}
  ATJ.Screenshot.grab(Client.gameDirectory, `atlas_${name}.png`, Client.getMainRenderTarget(), (m) => atSay(`${name}: ${m.getString()}`))
  atStats.shot++
  return true
}
const atSkip = (shot, why) => {
  atSay(`skipped ${shot.id}: ${why}`)
  atStats.skipped.push(shot.id)
  atPhaseTo('next')
}

// --- Shots taken by hand: the driver takes the camera to each spot and frames it; whoever is watching waits as long
// as they like, adjusts the view (fly and look as usual in spectator mode) and presses Enter. The frame that's saved
// has no keys reminder, no HUD and no minimap.
let atOver = { title: '', line: '', hide: false }
let atFrames = 0
let atHideFrame = 0
let atView = null
let atOverFailed = false
let atDown = {}
const AT_KEYS_LINE = '[Enter] take the picture   [F9] skip   [F8] previous spot   [Home] back to the start view'

NativeEvents.onEvent('net.neoforged.neoforge.client.event.RenderGuiEvent$Post', (e) => {
  atFrames++
  if (atOver.hide || (atOver.title === '' && atOver.line === '')) return
  try {
    let g = e.getGuiGraphics()
    let font = Client.font
    let w = g.guiWidth()
    let rows = [atOver.title, atOver.line].filter((r) => r !== '')
    rows.forEach((r, i) => {
      let tw = font.width(r)
      let x0 = Math.floor((w - tw) / 2)
      let y0 = 6 + i * 14
      g.fill(x0 - 5, y0 - 3, x0 + tw + 5, y0 + 10, -1442840576)
      // By signature: drawString has int and float versions this script can't tell apart.
      g['drawString(net.minecraft.client.gui.Font,java.lang.String,int,int,int,boolean)'](font, r, x0, y0, i === 0 ? 16769610 : 16777215, false)
    })
  } catch (err) {
    if (!atOverFailed) {
      atOverFailed = true
      atSay(`overlay failed: ${err}`)
    }
  }
})

/** A fresh press of a key since the last tick (not while a menu or chat is open). */
const atKey = (key) => {
  let down = false
  try {
    down = ATJ.GLFW.glfwGetKey(Client.getWindow().getWindow(), key) === ATJ.GLFW.GLFW_PRESS
  } catch (e) {}
  let was = atDown[key] === true
  atDown[key] = down
  return down && !was && Client.screen == null
}

// The subject on the stage: the nearest living thing that isn't us.
const atSubject = () => {
  let hit = null
  let best = 1e9
  Client.level.entitiesForRendering().forEach((e) => {
    if (e === Client.player || !e.isAlive()) return
    let d = e.distanceToSqr(AT_STAGE[0] + 0.5, AT_STAGE[1], AT_STAGE[2] + 0.5)
    if (d < best && d < 64) {
      best = d
      hit = e
    }
  })
  return hit
}

ClientEvents.tick(() => {
  if (Client.player == null || Client.level == null) return
  atTicks++
  if (atTicks < 300) return
  let t = atTicks - atSince
  let shot = AT_SHOTS[atIndex]

  if (atPhase === 'start') {
    atSay(`${AT_SHOTS.length} shots to take`)
    ;['gamemode spectator', 'gamerule doDaylightCycle false', 'gamerule doWeatherCycle false', 'time set 3000', 'weather clear', 'effect clear @s'].forEach(atCmd)
    Client.options.hideGui = true
    try {
      Client.options.fov().set(70)
    } catch (e) {}
    if (AT_OPTS.borderless) atBorderless()
    atPhaseTo('next')
    return
  }
  if (atPhase === 'next') {
    if (t < 10) return
    atIndex++
    shot = AT_SHOTS[atIndex]
    if (shot == null) {
      atSay(`all shots done: ${atStats.shot} taken, ${atStats.skipped.length} skipped (${atStats.skipped.join(', ')})`)
      atOver.title = `All done: ${atStats.shot} pictures, ${atStats.skipped.length} skipped`
      atOver.line = 'You can close the game.'
      atPhaseTo('done')
      return
    }
    atSay(`shot ${atIndex + 1}/${AT_SHOTS.length}: ${shot.kind} ${shot.id}`)
    atOver.title = `${shot.id}   (${atIndex + 1} of ${AT_SHOTS.length})`
    atFound = null
    atFailed = ''
    atDim = shot.dim
    atCmd(shot.dark ? 'effect give @s minecraft:night_vision infinite 0 true' : 'effect clear @s')
    if (shot.kind === 'biome' && shot.cam) {
      // A kept spot: straight there, no /locate.
      atTarget = shot.cam
      atTp(shot.dim, shot.cam[0], shot.cam[1], shot.cam[2], 90, 10)
      atPhaseTo('travelling')
    } else if (shot.kind === 'biome') {
      let from = shot.origin ? `positioned ${shot.origin[0]} 100 ${shot.origin[1]} ` : ''
      atCmd(`execute in ${shot.dim} ${from}run locate biome ${shot.id}`)
      atPhaseTo('locating')
    } else {
      // To the stage first: its chunk has to be loaded before anything can be built there.
      atTp('minecraft:overworld', AT_STAGE[0] + 0.5, AT_STAGE[1] + 2, AT_STAGE[2] + 8.5, 180, 8)
      atPhaseTo('stage')
    }
    return
  }
  if (atPhase === 'locating') {
    atOver.line = 'Finding it...'
    let gaveUp = atFailed || (t > AT_OPTS.locate ? 'no answer from /locate' : '')
    if (gaveUp) {
      // Rare: look again later from far away, after everything else.
      let tries = shot.tries || 0
      if (tries < AT_ORIGINS.length) {
        AT_SHOTS.push({ kind: shot.kind, id: shot.id, name: shot.name, dim: shot.dim, how: shot.how, dark: shot.dark, lift: shot.lift, tries: tries + 1, origin: AT_ORIGINS[tries] })
        atSay(`${shot.id}: ${gaveUp}; will look again from ${AT_ORIGINS[tries].join(' ')} at the end`)
        atPhaseTo('next')
        return
      }
      return atSkip(shot, gaveUp)
    }
    if (atFound) {
      atTarget = atFound
      let hollow = shot.how === 'cave' || shot.how === 'nether'
      atTp(shot.dim, atTarget[0] + 0.5, hollow && atTarget[1] != null ? atTarget[1] : shot.how === 'end' ? 110 : 200, atTarget[2] + 0.5, 90, 30)
      atPhaseTo('travelling')
    }
    return
  }
  if (atPhase === 'travelling') {
    atOver.line = 'On the way...'
    let here = Math.abs(Client.player.getX() - atTarget[0]) < 8 && Math.abs(Client.player.getZ() - atTarget[2]) < 8 && String(Client.level.dimension) === shot.dim
    if (here && atLoaded(atTarget[0], atTarget[2])) atPhaseTo('arriving')
    else if (t > AT_OPTS.timeout) atSkip(shot, 'never got there')
    return
  }
  if (atPhase === 'arriving') {
    atOver.line = 'Arriving...'
    if (t < AT_OPTS.arrive) return
    let view = null
    try {
      view = shot.cam ? atFrameKept(shot) : shot.how === 'cave' ? atFrameHollow(shot, atTarget, 30, 22, 12) : shot.how === 'nether' ? atFrameHollow(shot, atTarget, 30, 24, 18) : atFrameLand(shot, atTarget, shot.how === 'sea')
    } catch (e) {
      atSay(`${shot.id}: framing failed: ${e}`)
    }
    if (view == null) return atSkip(shot, 'no open view found')
    atTp(shot.dim, view[0], view[1], view[2], view[3], view[4])
    atView = view
    atPhaseTo('waiting')
    return
  }
  if (atPhase === 'stage') {
    let x = AT_STAGE[0]
    let y = AT_STAGE[1]
    let z = AT_STAGE[2]
    if (t === 40) {
      // A bare stage: its own floor (grass, or netherrack or end stone), nothing else standing on it, no snow falling.
      atCmd(`execute in minecraft:overworld positioned ${x} ${y} ${z} run kill @e[type=!minecraft:player,distance=..20]`)
      atCmd('weather clear')
      atCmd(`execute in minecraft:overworld run fill ${x - 6} ${y - 1} ${z - 6} ${x + 6} ${y + 4} ${z + 6} minecraft:air`)
      atCmd(`execute in minecraft:overworld run fill ${x - 6} ${y - 1} ${z - 6} ${x + 6} ${y - 1} ${z + 6} ${shot.floor || 'minecraft:grass_block'}`)
    }
    if (t === 50) {
      // Turned to the south-east, three-quarters on to the camera. Swimmers hang in the air like specimens (water and
      // glass between them and the camera only blur them).
      let swim = shot.water ? ',NoGravity:1b' : ''
      atCmd(`execute in minecraft:overworld run summon ${shot.id} ${x + 0.5} ${y + (shot.water ? 0.8 : 0)} ${z + 0.5} {NoAI:1b,Invulnerable:1b,PersistenceRequired:1b,Silent:1b${swim},Tags:["atlas_subject"],Rotation:[-45f,0f]}`)
    }
    if (t === 90) {
      let e = atSubject()
      if (e == null) return atSkip(shot, 'it did not appear')
      // Back far enough that the whole of it fits, the camera at its middle.
      let h = Number(e.getBbHeight())
      let w = Number(e.getBbWidth())
      let d = Math.max(1.8, Math.max(h, w) * 1.6 + 0.8)
      let cy = e.getY() + h * 0.55 - 1.62
      let a = atLook(e.getX() + d * 0.35, cy + 1.62, e.getZ() + d, e.getX(), e.getY() + h * 0.5, e.getZ())
      atTp('minecraft:overworld', e.getX() + d * 0.35, cy, e.getZ() + d, a[0], a[1])
      atView = [e.getX() + d * 0.35, cy, e.getZ() + d, a[0], a[1]]
      atSay(`${shot.id}: ${w.toFixed(1)} x ${h.toFixed(1)}, camera ${d.toFixed(1)} away`)
      atPhaseTo('waiting')
    }
    return
  }
  if (atPhase === 'waiting') {
    atOver.title = `${shot.id}   (${atIndex + 1} of ${AT_SHOTS.length})`
    atOver.line = AT_KEYS_LINE
    if (atKey(ATJ.KEY_SKIP)) return atSkip(shot, 'skipped by hand')
    if (atKey(ATJ.KEY_PREV)) {
      // Back one: the next spot taken is the one before this.
      atSay(`${shot.id}: back to the spot before`)
      atIndex = Math.max(-1, atIndex - 2)
      atPhaseTo('next')
      return
    }
    if (atKey(ATJ.KEY_BACK) && atView != null) atTp(shot.dim, atView[0], atView[1], atView[2], atView[3], atView[4])
    if (!(atKey(ATJ.KEY_SHOOT) || atKey(ATJ.KEY_SHOOT2))) return
    // Nothing but the view in the saved frame: hide the reminder and the HUD (minimap and all), let a few frames
    // draw, then shoot.
    atOver.hide = true
    Client.options.hideGui = true
    atHideFrame = atFrames
    atPhaseTo('shooting')
    return
  }
  if (atPhase === 'shooting') {
    if (Client.screen != null || atFrames < atHideFrame + 3) return
    if (!atShoot(shot.name)) {
      atHideFrame = atFrames + 20
      return
    }
    atOver.hide = false
    atOver.line = 'Saved.'
    atPhaseTo('shot')
    return
  }
  if (atPhase === 'shot') {
    if (t < 20) return
    atOver.title = ''
    atOver.line = ''
    if (shot.kind === 'creature') atCmd('kill @e[tag=atlas_subject]')
    atPhaseTo('next')
  }
})
