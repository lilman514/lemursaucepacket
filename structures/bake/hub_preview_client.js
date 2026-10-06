// TEST ONLY (headless client; never shipped in the pack). Photographs the spawn city once the server has built
// it: it asks to be taken there (/lsp hub goto, every 10 s until the city exists), waits until the waystone stands
// where config/lemursaucepacket/hub_plan.json puts it relative to the arrival point, works out the city's centre
// from the same plan, then flies a spectator camera through a list of views and saves screenshots/hub_<view>.png.

const HP = {
  Screenshot: Java.loadClass('net.minecraft.client.Screenshot'),
  BlockPos: Java.loadClass('net.minecraft.core.BlockPos'),
  settle: 6,
  // [name, camera offset from the centre (x, y above ground, z), point looked at (x, y, z)]
  views: [
    ['overview_south', [0, 110, 175], [0, 0, 0]],
    ['overview_corner', [145, 100, 145], [0, 0, 0]],
    ['market', [32, 22, 36], [0, 2, 0]],
    ['market_street', [-1, 2, 14], [-6, 3, -2]],
    ['cathedral', [-6, 5, -18], [-15, 14, -42]],
    ['shops_east', [20, 4, 8], [34, 6, -10]],
    ['fountain', [0, 9, 31], [0, 3, 44]],
    ['avenue_south_gate', [0, 3, 84], [0, 4, 20]],
    ['mayor_nametag', [-6, 2, 22], [-5, 3.4, 17]],
    ['guards_north', [0, 2, -76], [0, 3.2, -82]],
    ['gate_outside', [6, 4, 112], [0, 7, 88]],
    ['wall_walk', [-30, 13, -84], [-70, 13, -74]],
    ['walls_corner', [130, 30, 130], [70, 8, 70]],
    ['outskirts', [40, 18, 94], [28, 3, 70]],
    ['towers_outside', [112, 24, 108], [86, 8, 86]]
  ]
}

let hpTicks = 0
let hpPlan = null
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
    if (hpPlan == null) {
      // The pack ships the plan to clients too. Spawn and waystone are relative to the city's centre.
      let plan = JsonIO.read('config/lemursaucepacket/hub_plan.json')
      hpPlan = { arrival: [Number(plan.arrival[0]), Number(plan.arrival[1]), Number(plan.arrival[2])], waystone: [Number(plan.waystone.p[0]), Number(plan.waystone.p[1]), Number(plan.waystone.p[2])] }
    }
    if (hpTicks % 200 === 20) Client.player.connection.sendCommand('lsp hub goto')
    let wdx = hpPlan.waystone[0] - hpPlan.arrival[0]
    let wdz = hpPlan.waystone[2] - hpPlan.arrival[2]
    // Macaw's paving is a little under a full block, so the player's block can be the paving itself: look at
    // that height and the one above.
    let found = -1
    for (let dy = 0; dy <= 1; dy++) {
      let id = String(Client.level.getBlockState(new HP.BlockPos(p.getX() + wdx, p.getY() + dy, p.getZ() + wdz)).getBlock().getDescriptionId())
      if (id.indexOf('waystone') >= 0 && found < 0) found = p.getY() + dy
    }
    if (hpTicks % 200 === 0) hpSay(`waiting for the city (at ${p.getX()} ${p.getY()} ${p.getZ()})`)
    if (found < 0) return
    hpCentre = [p.getX() - hpPlan.arrival[0], found - 1, p.getZ() - hpPlan.arrival[2]]
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
