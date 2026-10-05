// TEST ONLY (headless client; never shipped in the pack). Photographs the spawn city once the server has built
// it: it waits until the plaza's waystone stands two blocks north of the player (spawn is (0, 1, -7) from the
// centre, the waystone (0, 1, -9)), works out the city's centre, then flies a spectator camera through a list of
// views and saves screenshots/hub_<view>.png.

const HP = {
  Screenshot: Java.loadClass('net.minecraft.client.Screenshot'),
  BlockPos: Java.loadClass('net.minecraft.core.BlockPos'),
  settle: 6,
  // [name, camera offset from the centre (x, y above ground, z), point looked at (x, y, z)]
  views: [
    ['overview_south', [0, 95, 150], [0, 0, 0]],
    ['overview_corner', [125, 85, 125], [0, 0, 0]],
    ['plaza', [22, 16, 26], [0, 2, 0]],
    ['market', [12, 9, 0], [0, 2, -13]],
    ['avenue_south_gate', [0, 3, 74], [0, 4, 20]],
    ['towers_outside', [100, 22, 96], [76, 8, 76]],
    ['cottages', [30, 14, 84], [20, 3, 62]]
  ]
}

let hpTicks = 0
let hpCentre = null
let hpStart = 0

const hpSay = (s) => console.info(`[hub-preview] ${s}`)

function hpLookAt(cx, cy, cz, tx, ty, tz) {
  let dx = tx - cx
  let dy = ty - cy
  let dz = tz - cz
  let yaw = (Math.atan2(-dx, dz) * 180) / Math.PI
  let pitch = (-Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * 180) / Math.PI
  return [yaw, pitch]
}

ClientEvents.tick(() => {
  if (Client.player == null || Client.level == null) return
  hpTicks++
  if (hpCentre == null) {
    if (hpTicks % 20 !== 0) return
    let p = Client.player.blockPosition()
    // Macaw's paving is a little under a full block, so the player's block can be the paving itself: look at
    // that height and the one above.
    let found = -1
    for (let dy = 0; dy <= 1; dy++) {
      let id = String(Client.level.getBlockState(new HP.BlockPos(p.getX(), p.getY() + dy, p.getZ() - 2)).getBlock().getDescriptionId())
      if (id.indexOf('waystone') >= 0 && found < 0) found = p.getY() + dy
    }
    if (hpTicks % 200 === 0) hpSay(`waiting for the city (at ${p.getX()} ${p.getY()} ${p.getZ()})`)
    if (found < 0) return
    hpCentre = [p.getX(), found - 1, p.getZ() + 7]
    // Give the server time to catch up (it falls behind while building) before the first teleport.
    hpStart = hpTicks + 400
    hpSay(`city centre ${hpCentre.join(' ')}`)
    ;['gamemode spectator', 'time set 6000', 'weather clear', 'gamerule doDaylightCycle false'].forEach((c) => Client.player.connection.sendCommand(c))
    Client.options.hideGui = true
    return
  }
  if (hpTicks < hpStart) return
  let step = HP.settle + 1
  let t = (hpTicks - hpStart) / 20
  let i = Math.floor(t / step)
  let phase = t - i * step
  if (i >= HP.views.length) {
    if (i === HP.views.length && Math.abs(phase) < 0.025) hpSay('all shots done')
    return
  }
  let v = HP.views[i]
  let c = hpCentre
  let cam = [c[0] + v[1][0], c[1] + v[1][1], c[2] + v[1][2]]
  let look = hpLookAt(cam[0], cam[1] + 1.62, cam[2], c[0] + v[2][0], c[1] + v[2][1], c[2] + v[2][2])
  if (Math.abs(phase) < 0.025) Client.player.connection.sendCommand(`tp @s ${cam[0]} ${cam[1]} ${cam[2]} ${look[0].toFixed(1)} ${look[1].toFixed(1)}`)
  if (Math.abs(phase - HP.settle) < 0.025) HP.Screenshot.grab(Client.gameDirectory, `hub_${v[0]}.png`, Client.getMainRenderTarget(), (msg) => hpSay(`${v[0]}: ${msg.getString()}`))
})
