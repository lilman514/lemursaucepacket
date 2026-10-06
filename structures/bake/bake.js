// TEST ONLY (scratch server, copied in by structures/bake.mjs; never shipped in the pack).
// Bakes the raw templates written by structures/build.mjs: each one is placed high above the world on a bed of
// structure void, the game works out every neighbour-dependent shape (stair corners, fence and pane
// connections, Macaw's roof ridges, window and lamp-post parts), and the result is saved back as
// lsp_baked:<name>. Positions the raw template left unset stay structure void, so they stay unset.
// Then everything is placed again on a grass showroom floor for the preview screenshots.
// Driven by the server tick (callbacks scheduled from ServerEvents.loaded get dropped when the server finishes
// starting). Rhino: no spread, no destructuring, `const` only at the top level.

const BAKE = {
  manifest: 'kubejs/bake/manifest.json',
  y: 230,
  showY: 200,
  gap: 18,
  margin: 40,
  columns: 6,
  origin: { x: 20000, z: 20000 },
  startTick: 60
}

const BK = {
  ResourceLocation: Java.loadClass('net.minecraft.resources.ResourceLocation'),
  BlockPos: Java.loadClass('net.minecraft.core.BlockPos'),
  Blocks: Java.loadClass('net.minecraft.world.level.block.Blocks')
}

let bkTick = 0
let bkPhase = 'idle'
let bkJobs = []
let bkAt = 0
let bkWait = 0
let bkLayoutNow = null

function bkSay(s) {
  console.info(`[bake] ${s}`)
}

/**
 * A grid, BAKE.columns wide, of square cells as big as the largest template plus the gap. Kept compact because
 * /forceload takes at most 256 chunks per call (it's issued one row at a time). Written to kubejs/bake/layout.json
 * so the preview client photographs exactly these spots.
 */
function bkLayout(templates) {
  let cell = BAKE.gap
  templates.forEach((t) => {
    cell = Math.max(cell, t.size[0] + BAKE.gap, t.size[2] + BAKE.gap)
  })
  // A counter, not forEach's index: the manifest's list is a Java List, whose forEach passes no index.
  let slots = []
  let i = 0
  templates.forEach((t) => {
    let col = i % BAKE.columns
    let row = Math.floor(i / BAKE.columns)
    slots.push({ t: t, x: BAKE.origin.x + col * cell, z: BAKE.origin.z + row * cell })
    i++
  })
  let cols = Math.min(BAKE.columns, i)
  let rows = Math.ceil(i / BAKE.columns)
  return { slots: slots, cell: cell, rows: rows, endX: BAKE.origin.x + cols * cell, depth: rows * cell }
}

/** Runs queued jobs for up to 40 ms per tick. True when the queue is empty. */
function bkRunJobs() {
  let until = Date.now() + 40
  while (bkAt < bkJobs.length && Date.now() < until) {
    try {
      bkJobs[bkAt]()
    } catch (e) {
      bkSay(`job ${bkAt} failed: ${e}`)
    }
    bkAt++
  }
  return bkAt >= bkJobs.length
}

/** The way a template's front door faces (its door mark, from structures/import.mjs); our own buildings face south. */
function bkFacing(t) {
  let facing = 'south'
  if (t.marks != null)
    t.marks.forEach((m) => {
      if (String(m.name) === 'door' && m.facing != null) facing = String(m.facing)
    })
  return facing
}

function bkQueue(jobs) {
  bkJobs = jobs
  bkAt = 0
}

function bkStart(server) {
  let manifest = null
  try {
    manifest = JsonIO.read(BAKE.manifest)
  } catch (e) {
    bkSay(`no manifest: ${e}`)
  }
  if (manifest == null || manifest.templates == null) {
    bkPhase = 'done'
    return
  }
  bkLayoutNow = bkLayout(manifest.templates)
  let L = bkLayoutNow
  bkSay(`baking ${L.slots.length} templates`)
  // One forceload per row of cells (the command refuses more than 256 chunks at once).
  // /forceload takes at most 256 chunks a call: a row at a time, split along x where the cells are big.
  let span = Math.max(16, Math.floor(256 / (Math.ceil(L.cell / 16) + 1)) * 16 - 16)
  for (let row = -1; row <= L.rows; row++) {
    let z1 = BAKE.origin.z + row * L.cell
    for (let x = BAKE.origin.x - BAKE.margin; x <= L.endX + BAKE.margin; x += span) server.runCommand(`forceload add ${x} ${z1} ${Math.min(x + span - 1, L.endX + BAKE.margin)} ${z1 + L.cell - 1}`)
  }
  JsonIO.write('kubejs/bake/layout.json', { showY: BAKE.showY, slots: L.slots.map((s) => ({ name: s.t.name, x: s.x, z: s.z, size: s.t.size, solid: s.t.solid, facing: bkFacing(s.t) })) })
  let jobs = bkWipeJobs(server, L)
  L.slots.forEach((s) => {
    let size = s.t.size
    // A bed of structure void exactly the template's size, then the raw template on top of it.
    // Structure void under the whole template, in 32-block cubes (/fill takes at most 32768 blocks at once; a
    // bigger box fails without a word and would leave air, which the save would keep).
    for (let fx = 0; fx < size[0]; fx += 32)
      for (let fy = 0; fy < size[1]; fy += 32)
        for (let fz = 0; fz < size[2]; fz += 32) {
          let x1 = s.x + fx
          let y1 = BAKE.y + fy
          let z1 = s.z + fz
          let x2 = Math.min(s.x + size[0] - 1, x1 + 31)
          let y2 = Math.min(BAKE.y + size[1] - 1, y1 + 31)
          let z2 = Math.min(s.z + size[2] - 1, z1 + 31)
          jobs.push(() => server.runCommandSilent(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} minecraft:structure_void`))
        }
    jobs.push(() => server.runCommand(`place template lsp_raw:${s.t.name} ${s.x} ${BAKE.y} ${s.z}`))
  })
  bkQueue(jobs)
  bkPhase = 'place'
}

function bkSave(server) {
  let level = server.overworld()
  let manager = server.getStructureManager()
  let saved = []
  bkLayoutNow.slots.forEach((s) => {
    let size = s.t.size
    try {
      let id = BK.ResourceLocation.parse(`lsp_baked:${s.t.name}`)
      let template = manager.getOrCreate(id)
      // The size is a Vec3i; KubeJS converts that argument like a BlockPos, so pass a BlockPos (which is a Vec3i).
      template.fillFromWorld(level, new BK.BlockPos(s.x, BAKE.y, s.z), new BK.BlockPos(size[0], size[1], size[2]), false, BK.Blocks.STRUCTURE_VOID)
      if (manager.save(id)) saved.push(s.t.name)
      else bkSay(`could not save ${s.t.name}`)
    } catch (e) {
      bkSay(`bake ${s.t.name} failed: ${e}`)
    }
  })
  bkSay(`saved ${saved.length}/${bkLayoutNow.slots.length}: ${saved.join(' ')}`)
}

/** Air over the whole bake row and showroom (32 x 32 x 32 fills, the command's size limit), floor to sky. */
function bkWipeJobs(server, L) {
  let jobs = []
  let m = BAKE.margin
  for (let x = BAKE.origin.x - m; x <= L.endX + m; x += 32)
    for (let z = BAKE.origin.z - m; z <= BAKE.origin.z + L.depth + m; z += 32)
      for (let y = BAKE.showY - 3; y <= BAKE.y + 48; y += 32) {
        let x1 = x
        let z1 = z
        let y1 = y
        jobs.push(() => server.runCommandSilent(`fill ${x1} ${y1} ${z1} ${x1 + 31} ${Math.min(y1 + 31, 319)} ${z1 + 31} minecraft:air`))
      }
  return jobs
}

/** Clears the bake row again (it hangs over the showroom and would photobomb it). */
function bkClearJobs(server) {
  let jobs = []
  bkLayoutNow.slots.forEach((s) => {
    let size = s.t.size
    for (let fx = 0; fx < size[0]; fx += 32)
      for (let fy = 0; fy < size[1]; fy += 32)
        for (let fz = 0; fz < size[2]; fz += 32) {
          let x1 = s.x + fx
          let y1 = BAKE.y + fy
          let z1 = s.z + fz
          let x2 = Math.min(s.x + size[0] - 1, x1 + 31)
          let y2 = Math.min(BAKE.y + size[1] - 1, y1 + 31)
          let z2 = Math.min(s.z + size[2] - 1, z1 + 31)
          jobs.push(() => server.runCommandSilent(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} minecraft:air`))
        }
  })
  return jobs
}

/** A grass floor (plains biome, so the grass and sky look normal) with every baked building on it, for the photos. */
function bkShowroomJobs(server) {
  let L = bkLayoutNow
  let y = BAKE.showY
  let m = BAKE.margin
  let z1 = BAKE.origin.z - m
  let z2 = BAKE.origin.z + L.depth + m
  let jobs = bkClearJobs(server)
  for (let fx = BAKE.origin.x - m; fx <= L.endX + m; fx += 32) {
    let x1 = fx
    let x2 = Math.min(fx + 31, L.endX + m)
    for (let fz = z1; fz <= z2; fz += 32) {
      let za = fz
      let zb = Math.min(fz + 31, z2)
      jobs.push(() => server.runCommandSilent(`fill ${x1} ${y - 1} ${za} ${x2} ${y - 1} ${zb} minecraft:grass_block`))
      jobs.push(() => server.runCommandSilent(`fill ${x1} ${y - 3} ${za} ${x2} ${y - 2} ${zb} minecraft:dirt`))
      jobs.push(() => server.runCommandSilent(`fillbiome ${x1} ${y - 8} ${za} ${x2} ${y + 24} ${zb} minecraft:plains`))
    }
  }
  L.slots.forEach((s) => jobs.push(() => server.runCommand(`place template lsp_baked:${s.t.name} ${s.x} ${y} ${s.z}`)))
  return jobs
}

ServerEvents.tick((event) => {
  if (bkPhase === 'done') return
  let server = event.server
  bkTick++
  if (bkPhase === 'idle') {
    if (bkTick >= BAKE.startTick) bkStart(server)
    return
  }
  if (bkPhase === 'place') {
    if (bkRunJobs()) {
      bkPhase = 'settle'
      bkWait = 10
    }
    return
  }
  if (bkPhase === 'settle') {
    // A few ticks so every neighbour update has landed.
    if (--bkWait <= 0) {
      bkPhase = 'showroom' // first, so a failing save can't repeat every tick
      try {
        bkSave(server)
      } catch (e) {
        bkSay(`save failed: ${e}`)
      }
      bkQueue(bkShowroomJobs(server))
    }
    return
  }
  if (bkPhase === 'showroom' && bkRunJobs()) {
    bkPhase = 'done'
    bkSay('showroom ready')
  }
})
