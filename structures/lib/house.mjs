// A house from a spec: foundation, one or more storeys (rough stone or timber frame, upper ones optionally
// jettied out over the street), a roof (Macaw's pieces), a door, windows with shutters and flower boxes, a
// chimney and an interior callback. Footprint x 0..w-1, z 0..d-1, front door on the south wall (z = d-1),
// ground floor at y = 0. Every RuneScape-style house type is a spec plus a few details on top of this.

import { OPPOSITE, STEP, log, slab, stairs, state } from './blocks.mjs'
import { chimney as chimneyPart, door as doorPart, flowerBox, gableRoof, hipRoof, hollow, mix, shutters, timberFrame, walls, windowCol } from './parts.mjs'

/** Rough RuneScape stonework: mostly cobble with stone, andesite and a little moss. */
export const STONE_MIX = [[6, 'minecraft:cobblestone'], [2, 'minecraft:stone'], [2, 'minecraft:andesite'], [1, 'minecraft:mossy_cobblestone']]
export const DRESSED_MIX = [[8, 'minecraft:stone_bricks'], [1, 'minecraft:cracked_stone_bricks'], [1, 'minecraft:mossy_stone_bricks']]
export const FOUNDATION_MIX = [[6, 'minecraft:cobblestone'], [3, 'minecraft:mossy_cobblestone'], [1, 'minecraft:andesite']]

/**
 * spec: {
 *   w, d, r (rng),
 *   foundation: { depth = 2, mix = FOUNDATION_MIX },
 *   floor: block for the ground floor inside,
 *   storeys: [{ h = 4, walls: 'stone' | 'timber' | 'dressed', jetty: { south: 1, north: 0 }, mix, post, infill, postEvery }],
 *   roof: { material, pitch = 'steep', ridge = 'x' | 'z', overhang = 1, kind = 'gable' | 'hip', gable: 'timber' | 'stone' | 'dressed' },
 *   door: { x, id, hinge },
 *   windows: [{ wall: 'south' | 'north' | 'east' | 'west', at, storey = 0, h = 2, id, shutters, flowers }],
 *   chimney: { wall: 'east' | 'west' | 'north', at, mix },
 *   interior(c, box, storeyIndex): furnishing for each storey's inside box,
 *   timber: { post, beam, infill }  (defaults for timber storeys and gables)
 * }
 * Returns facts placement code needs: { ridgeY, top, door, storeys: [{ base, h, box }] }.
 */
export function house(c, spec) {
  const r = spec.r
  const w = spec.w
  const d = spec.d
  const timber = { post: 'minecraft:stripped_dark_oak_log', beam: 'minecraft:stripped_dark_oak_log', infill: 'minecraft:white_terracotta', ...(spec.timber ?? {}) }
  const pickStone = mix(STONE_MIX, r)
  const pickDressed = mix(DRESSED_MIX, r)

  // Foundation under the whole ground footprint, going down into the terrain.
  const fd = spec.foundation?.depth ?? 2
  const pickFoundation = mix(spec.foundation?.mix ?? FOUNDATION_MIX, r)
  c.fill(0, -fd, 0, w - 1, -1, d - 1, () => pickFoundation())
  c.fill(1, 0, 1, w - 2, 0, d - 2, state(spec.floor ?? 'minecraft:spruce_planks'))
  c.fill(0, 0, 0, w - 1, 0, 0, () => pickFoundation())
  c.fill(0, 0, d - 1, w - 1, 0, d - 1, () => pickFoundation())
  c.fill(0, 0, 0, 0, 0, d - 1, () => pickFoundation())
  c.fill(w - 1, 0, 0, w - 1, 0, d - 1, () => pickFoundation())

  // Storeys.
  let base = 0
  let fp = { x0: 0, x1: w - 1, z0: 0, z1: d - 1 }
  const storeys = []
  spec.storeys.forEach((st, i) => {
    const h = st.h ?? 4
    const jet = st.jetty ?? {}
    if (i > 0) {
      fp = { x0: fp.x0 - (jet.west ?? 0), x1: fp.x1 + (jet.east ?? 0), z0: fp.z0 - (jet.north ?? 0), z1: fp.z1 + (jet.south ?? 0) }
      // The floor between storeys: a log beam course outside, planks inside (with a ladder hole).
      for (let x = fp.x0; x <= fp.x1; x++)
        for (let z = fp.z0; z <= fp.z1; z++) {
          const edgeX = x === fp.x0 || x === fp.x1
          const edgeZ = z === fp.z0 || z === fp.z1
          if (edgeX || edgeZ) c.set(x, base, z, log(timber.beam, edgeZ ? 'x' : 'z'))
          else c.set(x, base, z, state(st.floor ?? 'minecraft:spruce_planks'))
        }
      // Corbels under a jetty: upside-down stairs at the posts.
      for (const [side, amount] of Object.entries(jet)) {
        if (!amount) continue
        const along = side === 'south' || side === 'north' ? 'x' : 'z'
        const out = side
        const fixed = side === 'south' ? fp.z1 : side === 'north' ? fp.z0 : side === 'east' ? fp.x1 : fp.x0
        const from = along === 'x' ? fp.x0 : fp.z0
        const to = along === 'x' ? fp.x1 : fp.z1
        for (let t = from; t <= to; t += 2) {
          const [x, z] = along === 'x' ? [t, fixed] : [fixed, t]
          c.set(x, base - 1, z, stairs('minecraft:dark_oak_stairs', OPPOSITE[out], 'top'))
        }
      }
    }
    const box = { x0: fp.x0, x1: fp.x1, z0: fp.z0, z1: fp.z1, y0: base + 1, y1: base + h }
    const kind = st.walls ?? 'stone'
    if (kind === 'timber') {
      timberFrame(c, box, { post: st.post ?? timber.post, beam: st.beam ?? timber.beam, infill: () => state(st.infill ?? timber.infill), postEvery: st.postEvery ?? 3 })
    } else {
      const pick = st.mix ? mix(st.mix, r) : kind === 'dressed' ? pickDressed : pickStone
      walls(c, box, () => pick())
      // Dressed quoins at the corners give rough walls a crisp edge.
      for (let y = box.y0; y <= box.y1; y++)
        for (const [x, z] of [[box.x0, box.z0], [box.x1, box.z0], [box.x0, box.z1], [box.x1, box.z1]])
          c.set(x, y, z, state((y - box.y0) % 2 === 0 ? 'minecraft:stone_bricks' : 'minecraft:polished_andesite'))
    }
    hollow(c, { x0: box.x0 + 1, x1: box.x1 - 1, z0: box.z0 + 1, z1: box.z1 - 1, y0: box.y0, y1: box.y1 })
    storeys.push({ base, h, box })
    base += h + 1
  })

  // The roof sits on the top storey's walls.
  const top = storeys[storeys.length - 1].box
  const roof = spec.roof
  const roofY = top.y1 + 1
  let ridgeY
  // The wall-plate course: a log beam right under the roof all the way round.
  for (let x = top.x0; x <= top.x1; x++)
    for (let z = top.z0; z <= top.z1; z++) if (x === top.x0 || x === top.x1 || z === top.z0 || z === top.z1) c.set(x, top.y1, z, log(timber.beam, z === top.z0 || z === top.z1 ? 'x' : 'z'))
  for (const [x, z] of [[top.x0, top.z0], [top.x1, top.z0], [top.x0, top.z1], [top.x1, top.z1]]) c.set(x, top.y1, z, log(timber.post, 'y'))
  const gablePick = gableFiller(roof.gable ?? 'timber', top, roof.ridge ?? 'x', timber, pickStone, pickDressed)
  if ((roof.kind ?? 'gable') === 'hip') ridgeY = hipRoof(c, { ...top, y: roofY, material: roof.material, pitch: roof.pitch ?? 'steep', overhang: roof.overhang ?? 1 })
  else ridgeY = gableRoof(c, { ...top, y: roofY, ridge: roof.ridge ?? 'x', material: roof.material, pitch: roof.pitch ?? 'steep', overhang: roof.overhang ?? 1, gable: gablePick })
  // Clear the loft under the roof (only where the roof didn't put a block), so terrain never fills it.
  for (let y = roofY; y <= ridgeY; y++) for (let x = top.x0 + 1; x <= top.x1 - 1; x++) for (let z = top.z0 + 1; z <= top.z1 - 1; z++) c.setIfEmpty(x, y, z, state('minecraft:air'))

  // Door (front wall, ground floor) with a step and lanterns.
  const dx = spec.door?.x ?? Math.floor(w / 2)
  doorPart(c, dx, 1, d - 1, spec.door?.id ?? 'mcwdoors:oak_cottage_door', 'south', spec.door?.hinge ?? 'left')
  // The floor is level with the ground, so the doorstep is a short paved path out from the door.
  for (let i = 0; i < (spec.door?.path ?? 2); i++) {
    // A full block (Macaw's "*_paving" blocks are thin overlays and would leave a hole at street level).
    c.set(dx, 0, d + i, state(spec.door?.paving ?? 'minecraft:cobblestone'))
    c.set(dx, -1, d + i, state('minecraft:cobblestone'))
  }
  if (spec.door?.lanterns !== false) {
    c.set(dx - 1, 3, d, state('mcwlights:chain_wall_lantern', { facing: 'south' }))
    c.set(dx + 1, 3, d, state('mcwlights:chain_wall_lantern', { facing: 'south' }))
  }
  c.mark('door', dx, 1, d - 1, { facing: 'south' })
  c.mark('front', dx, 1, d + 1)

  // Windows.
  for (const win of spec.windows ?? []) {
    const st = storeys[win.storey ?? 0]
    const b = st.box
    const y = b.y0 + 1
    const h = win.h ?? 2
    const out = win.wall
    const [x, z] = out === 'south' ? [b.x0 + win.at, b.z1] : out === 'north' ? [b.x0 + win.at, b.z0] : out === 'east' ? [b.x1, b.z0 + win.at] : [b.x0, b.z0 + win.at]
    windowCol(c, x, y, z, win.id ?? 'mcwwindows:spruce_window', out, h)
    if (win.shutters) shutters(c, x, y, z, win.shutters, out, h)
    if (win.flowers && (win.storey ?? 0) === 0) flowerBox(c, x, y - 1, z, out, {}, r)
  }

  // Chimney outside a wall, from the foundation to above the ridge.
  if (spec.chimney) {
    const ch = spec.chimney
    const pick = mix(ch.mix ?? [[7, 'minecraft:bricks'], [2, 'minecraft:mud_bricks'], [1, 'minecraft:stone_bricks']], r)
    const g = storeys[0].box
    const [cx, cz] = ch.wall === 'east' ? [g.x1 + 1, ch.at] : ch.wall === 'west' ? [g.x0 - 1, ch.at] : [ch.at, g.z0 - 1]
    // Two blocks wide along the wall (one on small houses), so it reads as a chimney and not a pipe. On a gable
    // end it rises past the ridge; on an eave side it only clears the roof edge (or it stands like a smokestack).
    const wide = ch.wide ?? (w >= 9 || d >= 9 ? 2 : 1)
    const alongX = ch.wall === 'north'
    const ridgeAxis = roof.ridge ?? 'x'
    const onGable = (ridgeAxis === 'x' && (ch.wall === 'east' || ch.wall === 'west')) || (ridgeAxis === 'z' && ch.wall === 'north')
    const top = onGable || (roof.kind ?? 'gable') === 'hip' ? ridgeY + 1 : roofY + 4
    chimneyPart(c, { x: cx, z: cz, y0: -fd, y1: top, w: alongX ? wide : 1, d: alongX ? 1 : wide }, () => pick())
  }

  // Furnishing.
  if (spec.interior) storeys.forEach((st, i) => spec.interior(c, { x0: st.box.x0 + 1, x1: st.box.x1 - 1, z0: st.box.z0 + 1, z1: st.box.z1 - 1, y: st.box.y0, h: st.h }, i))

  return { ridgeY, storeys, door: { x: dx, z: d - 1 } }
}

/** What fills a gable's triangle: a timber pattern (posts every other block), rough or dressed stone. */
function gableFiller(kind, top, ridge, timber, pickStone, pickDressed) {
  if (kind === 'stone') return () => pickStone()
  if (kind === 'dressed') return () => pickDressed()
  const v0 = ridge === 'x' ? top.z0 : top.x0
  const v1 = ridge === 'x' ? top.z1 : top.x1
  const mid = (v0 + v1) / 2
  return (u, y, v) => (Math.abs(v - mid) < 0.6 || (v - v0) % 2 === 0 ? log(timber.post, 'y') : state(timber.infill))
}

export { slab }
