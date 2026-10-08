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
const AT_OPTS = /*OPTS*/ { arrive: 160, settle: 110, timeout: 600 } /*END*/

const ATJ = {
  Screenshot: Java.loadClass('net.minecraft.client.Screenshot'),
  GLFW: Java.loadClass('org.lwjgl.glfw.GLFW'),
  Heightmap: Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
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

// /locate answers in chat: "The nearest X is at [x, y, z] (n blocks away)", or "Could not find ...".
NativeEvents.onEvent('net.neoforged.neoforge.client.event.ClientChatReceivedEvent$System', (e) => {
  if (atPhase !== 'locating') return
  let s = ''
  try {
    s = String(e.getMessage().getString())
  } catch (err) {
    return
  }
  let m = /\[(-?\d+), (-?\d+|~), (-?\d+)\]/.exec(s)
  if (m) atFound = [Number(m[1]), m[2] === '~' ? null : Number(m[2]), Number(m[3])]
  else if (/could not find|unknown|incorrect|invalid/i.test(s)) atFailed = s
})

const atGround = (x, z) => Client.level.getHeight(ATJ.Heightmap.MOTION_BLOCKING, Math.floor(x), Math.floor(z))
const atLoaded = (x, z) => {
  try {
    return Client.level.getChunkSource().hasChunk(Math.floor(x) >> 4, Math.floor(z) >> 4)
  } catch (e) {
    return true
  }
}
const atBiome = (x, y, z) => {
  try {
    return String(Client.level.getBiome(new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z))).unwrapKey().get().location())
  } catch (e) {
    return ''
  }
}
const atAir = (x, y, z) => {
  try {
    return Client.level.getBlockState(new BlockPos(Math.floor(x), Math.floor(y), Math.floor(z))).isAir()
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
  for (let dx = -96; dx <= 96; dx += 8) {
    for (let dz = -96; dz <= 96; dz += 8) {
      let x = T[0] + dx
      let z = T[2] + dz
      if (!atLoaded(x, z)) continue
      let g = atGround(x, z)
      if (g <= min + 1) continue
      if (atBiome(x, g - 1, z) === shot.id) pts.push([x, g, z])
    }
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
  let dist = Math.max(22, Math.min(64, spread * 1.3))
  let C = [M[0] + dist, 0, M[2]]
  let ty = (sea ? 63 : M[1]) + 3
  let cy = sea ? 70 : Math.max(atGround(C[0], C[2]), M[1]) + (shot.lift || 10)
  // Lift the camera until the line to the target clears every hill between.
  for (let pass = 0; pass < 3; pass++) {
    for (let k = 1; k < 20; k++) {
      let f = k / 20
      let need = atGround(C[0] + (M[0] - C[0]) * f, C[2] + (M[2] - C[2]) * f) + 2
      let line = cy + (ty - cy) * f
      if (line < need) cy += (need - line) / (1 - f)
    }
  }
  cy = Math.min(cy, Math.max(atGround(C[0], C[2]), M[1]) + 70)
  let a = atLook(C[0], cy + 1.62, C[2], M[0], ty + 4, M[2])
  atSay(`${shot.id}: ${pts.length} spots of it near ${T[0]} ${T[2]}, middle ${M[0].toFixed(0)} ${M[1]} ${M[2].toFixed(0)}, camera ${C[0].toFixed(0)} ${cy.toFixed(0)} ${C[2].toFixed(0)}`)
  return [C[0], cy, C[2], a[0], Math.max(a[1], 4)]
}

/** A viewpoint inside a cave biome (or the Nether): the open spot with the longest straight view. */
const atFrameHollow = (shot, T, radius) => {
  let y0 = T[1] != null ? T[1] : 40
  let best = null
  let bestRun = -1
  for (let dy = -Math.floor(radius / 2); dy <= Math.floor(radius / 2) && bestRun < 36; dy += 3) {
    for (let dx = -radius; dx <= radius && bestRun < 36; dx += 3) {
      for (let dz = -radius; dz <= radius && bestRun < 36; dz += 3) {
        let x = T[0] + dx
        let y = y0 + dy
        let z = T[2] + dz
        if (!atAir(x, y, z) || !atAir(x, y + 1, z) || !atAir(x, y - 1, z)) continue
        if (atBiome(x, y, z) !== shot.id) continue
        for (let k = 0; k < 8; k++) {
          let a = (k * Math.PI) / 4
          let n = 1
          while (n < 40 && atAir(x - Math.sin(a) * n, y, z + Math.cos(a) * n)) n++
          if (n > bestRun) {
            bestRun = n
            best = [x + 0.5, y - 1.2, z + 0.5, (a * 180) / Math.PI, 10]
          }
        }
      }
    }
  }
  atSay(`${shot.id}: best open view ${bestRun} blocks${best ? ` at ${best[0].toFixed(0)} ${best[1].toFixed(0)} ${best[2].toFixed(0)}` : ''}`)
  return best
}

const atShoot = (name) => {
  let win = Client.getWindow().getWindow()
  if (ATJ.GLFW.glfwGetWindowAttrib(win, ATJ.GLFW.GLFW_ICONIFIED) === 1) {
    ATJ.GLFW.glfwRestoreWindow(win)
    atSay(`the window was minimised before ${name}: restored it, shooting a second later`)
    return false
  }
  ATJ.Screenshot.grab(Client.gameDirectory, `atlas_${name}.png`, Client.getMainRenderTarget(), (m) => atSay(`${name}: ${m.getString()}`))
  atStats.shot++
  return true
}
const atSkip = (shot, why) => {
  atSay(`skipped ${shot.id}: ${why}`)
  atStats.skipped.push(shot.id)
  atPhaseTo('next')
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
    atPhaseTo('next')
    return
  }
  if (atPhase === 'next') {
    if (t < 10) return
    atIndex++
    shot = AT_SHOTS[atIndex]
    if (shot == null) {
      atSay(`all shots done: ${atStats.shot} taken, ${atStats.skipped.length} skipped (${atStats.skipped.join(', ')})`)
      atPhaseTo('done')
      return
    }
    atSay(`shot ${atIndex + 1}/${AT_SHOTS.length}: ${shot.kind} ${shot.id}`)
    atFound = null
    atFailed = ''
    atDim = shot.dim
    atCmd(shot.dark ? 'effect give @s minecraft:night_vision infinite 0 true' : 'effect clear @s')
    if (shot.kind === 'biome') {
      atCmd(`execute in ${shot.dim} run locate biome ${shot.id}`)
      atPhaseTo('locating')
    } else {
      // To the stage first: its chunk has to be loaded before anything can be built there.
      atTp('minecraft:overworld', AT_STAGE[0] + 0.5, AT_STAGE[1] + 2, AT_STAGE[2] + 8.5, 180, 8)
      atPhaseTo('stage')
    }
    return
  }
  if (atPhase === 'locating') {
    if (atFailed) return atSkip(shot, atFailed)
    if (atFound) {
      atTarget = atFound
      let hollow = shot.how === 'cave' || shot.how === 'nether'
      atTp(shot.dim, atTarget[0] + 0.5, hollow && atTarget[1] != null ? atTarget[1] : shot.how === 'end' ? 110 : 200, atTarget[2] + 0.5, 90, 30)
      atPhaseTo('travelling')
      return
    }
    if (t > AT_OPTS.timeout) atSkip(shot, 'no answer from /locate')
    return
  }
  if (atPhase === 'travelling') {
    let here = Math.abs(Client.player.getX() - atTarget[0]) < 8 && Math.abs(Client.player.getZ() - atTarget[2]) < 8 && String(Client.level.dimension) === shot.dim
    if (here && atLoaded(atTarget[0], atTarget[2])) atPhaseTo('arriving')
    else if (t > AT_OPTS.timeout) atSkip(shot, 'never got there')
    return
  }
  if (atPhase === 'arriving') {
    if (t < AT_OPTS.arrive) return
    let view = null
    try {
      view = shot.how === 'cave' ? atFrameHollow(shot, atTarget, 18) : shot.how === 'nether' ? atFrameHollow(shot, atTarget, 27) : atFrameLand(shot, atTarget, shot.how === 'sea')
    } catch (e) {
      atSay(`${shot.id}: framing failed: ${e}`)
    }
    if (view == null) return atSkip(shot, 'no open view found')
    atTp(shot.dim, view[0], view[1], view[2], view[3], view[4])
    atPhaseTo('settling')
    return
  }
  if (atPhase === 'stage') {
    let x = AT_STAGE[0]
    let y = AT_STAGE[1]
    let z = AT_STAGE[2]
    if (t === 40) {
      // A grass floor (or the creature's own ground), with a glass tank of water for anything that swims.
      atCmd('kill @e[tag=atlas_subject]')
      atCmd(`execute in minecraft:overworld run fill ${x - 6} ${y - 1} ${z - 6} ${x + 6} ${y + 4} ${z + 6} minecraft:air`)
      atCmd(`execute in minecraft:overworld run fill ${x - 6} ${y - 1} ${z - 6} ${x + 6} ${y - 1} ${z + 6} ${shot.floor || 'minecraft:grass_block'}`)
      if (shot.water) {
        atCmd(`execute in minecraft:overworld run fill ${x - 3} ${y} ${z - 3} ${x + 3} ${y + 4} ${z + 3} minecraft:glass`)
        atCmd(`execute in minecraft:overworld run fill ${x - 2} ${y} ${z - 2} ${x + 2} ${y + 4} ${z + 2} minecraft:water`)
      }
    }
    if (t === 50) {
      // Turned to the south-east, three-quarters on to the camera.
      atCmd(`execute in minecraft:overworld run summon ${shot.id} ${x + 0.5} ${y + (shot.water ? 1.5 : 0)} ${z + 0.5} {NoAI:1b,Invulnerable:1b,PersistenceRequired:1b,Silent:1b,Tags:["atlas_subject"],Rotation:[-45f,0f]}`)
    }
    if (t === 90) {
      let e = atSubject()
      if (e == null) return atSkip(shot, 'it did not appear')
      // Back far enough that the whole of it fits, the camera at its middle.
      let h = Number(e.getBbHeight())
      let w = Number(e.getBbWidth())
      let d = Math.max(2.8, Math.max(h * 1.9, w * 2.2) + 1.2)
      let cy = e.getY() + h * 0.55 - 1.62
      let a = atLook(e.getX() + d * 0.35, cy + 1.62, e.getZ() + d, e.getX(), e.getY() + h * 0.5, e.getZ())
      atTp('minecraft:overworld', e.getX() + d * 0.35, cy, e.getZ() + d, a[0], a[1])
      atSay(`${shot.id}: ${w.toFixed(1)} x ${h.toFixed(1)}, camera ${d.toFixed(1)} away`)
      atPhaseTo('settling')
    }
    return
  }
  if (atPhase === 'settling') {
    if (t < (shot.kind === 'biome' ? AT_OPTS.settle : 50)) return
    if (!atShoot(shot.name)) {
      atSince += 20
      return
    }
    atPhaseTo('shot')
    return
  }
  if (atPhase === 'shot') {
    if (t < 10) return
    if (shot.kind === 'creature') atCmd('kill @e[tag=atlas_subject]')
    atPhaseTo('next')
  }
})
