// TEST ONLY (headless client, copied in by structures/preview.mjs; never shipped in the pack).
// Photographs each building on the bake showroom (laid out exactly as bake.js does): a spectator camera flies to
// a three-quarter view from the front right, then the front left, with the HUD hidden, and saves
// screenshots/preview_<name>_<view>.png.

const PV = {
  manifest: 'kubejs/bake/manifest.json',
  showY: 200,
  gap: 18,
  origin: { x: 20000, z: 20000 },
  startAfter: 12, // seconds after joining
  settle: 5, // seconds for chunks to arrive after each move
  views: [
    { id: 'a', azimuth: 35, elevation: 0.32 },
    { id: 'b', azimuth: -40, elevation: 0.22 }
  ],
  Screenshot: Java.loadClass('net.minecraft.client.Screenshot')
}

const pvSay = (s) => console.info(`[preview] ${s}`)
let pvTicks = 0
let pvShots = null

function pvPlan() {
  // Where bake.js put each building (copied over by preview.mjs).
  let layout = JsonIO.read('kubejs/bake/layout.json')
  // preview.mjs --views picks which of PV.views to take.
  let cfg = null
  try {
    cfg = JsonIO.read('kubejs/bake/preview.json')
  } catch (e) {
    cfg = null
  }
  let wanted = cfg != null && cfg.views != null ? String(cfg.views) : 'ab'
  let views = PV.views.filter((v) => wanted.indexOf(v.id) >= 0)
  let shots = []
  layout.slots.forEach((t) => {
    let x = t.x
    let sx = t.size[0]
    let sy = t.size[1]
    let sz = t.size[2]
    // Frame the box of real blocks, not the air the template clears.
    let lo = t.solid ? t.solid.min : [0, 0, 0]
    let hi = t.solid ? t.solid.max : [sx - 1, sy - 1, sz - 1]
    let w = hi[0] - lo[0] + 1
    let h = hi[1] - lo[1] + 1
    let dp = hi[2] - lo[2] + 1
    let tx = x + (lo[0] + hi[0] + 1) / 2
    let ty = PV.showY + lo[1] + h * 0.45
    let tz = t.z + (lo[2] + hi[2] + 1) / 2
    let d = Math.max(w * 1.25, dp * 1.25, h * 1.05) + 3
    // Azimuth 0 looks at the south face; turn to face the door.
    let base = { south: 0, west: -90, north: 180, east: 90 }[t.facing == null ? 'south' : String(t.facing)] || 0
    views.forEach((v) => {
      let a = ((v.azimuth + base) * Math.PI) / 180
      let dx = d * Math.sin(a)
      let dz = d * Math.cos(a)
      let cy = ty + d * v.elevation
      let yaw = (Math.atan2(dx, -dz) * 180) / Math.PI
      let pitch = (Math.atan2(cy - ty, d) * 180) / Math.PI
      shots.push({ name: `${t.name}_${v.id}`, x: tx + dx, y: cy - 1.62, z: tz + dz, yaw: yaw, pitch: pitch })
    })
  })
  return shots
}

ClientEvents.tick(() => {
  if (Client.player == null || Client.level == null) return
  pvTicks++
  let t = pvTicks / 20
  if (pvTicks === PV.startAfter * 20 - 40) {
    ;['gamemode spectator', 'time set 6000', 'weather clear', 'gamerule doDaylightCycle false', 'gamerule doWeatherCycle false'].forEach((c) => Client.player.connection.sendCommand(c))
  }
  if (pvTicks === PV.startAfter * 20) {
    try {
      pvShots = pvPlan()
      pvSay(`${pvShots.length} shots planned`)
    } catch (e) {
      pvSay(`no plan: ${e}`)
      pvShots = []
    }
    Client.options.hideGui = true
  }
  if (pvShots == null || pvTicks < PV.startAfter * 20) return
  let step = PV.settle + 1
  let i = Math.floor((t - PV.startAfter) / step)
  let phase = (t - PV.startAfter) % step
  if (i >= pvShots.length) {
    if (i === pvShots.length && pvTicks % 20 === 0 && phase < 0.05) pvSay('all shots done')
    return
  }
  let s = pvShots[i]
  if (Math.abs(phase) < 0.025) Client.player.connection.sendCommand(`tp @s ${s.x.toFixed(2)} ${s.y.toFixed(2)} ${s.z.toFixed(2)} ${s.yaw.toFixed(1)} ${s.pitch.toFixed(1)}`)
  if (Math.abs(phase - PV.settle) < 0.025) PV.Screenshot.grab(Client.gameDirectory, `preview_${s.name}.png`, Client.getMainRenderTarget(), (msg) => pvSay(`${s.name}: ${msg.getString()}`))
})
