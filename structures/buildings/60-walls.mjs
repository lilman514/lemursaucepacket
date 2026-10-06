// Lemurton's curtain wall (structures/lib/walls.mjs) as four templates, one per quarter of the loop (each starts at
// its gatehouse and runs clockwise to the next). Drawn in city coordinates, so each template's offset is where it
// goes: structures/hub.mjs places them unturned at those offsets.

import { drawWalls } from '../lib/walls.mjs'

const { blocks, nodes } = drawWalls()
const QUARTERS = ['north', 'east', 'south', 'west']

export const buildings = QUARTERS.map((q) => ({
  name: `lemurton_wall_${q}`,
  kind: 'wall',
  notes: `Lemurton's curtain wall, from the ${q} gate clockwise`,
  build: (c) => {
    for (const b of blocks.values()) if (b.piece === q) c.set(b.x, b.y, b.z, b.s)
    // The way the quarter looks (out of the town at its gate), for the previews.
    const gate = nodes.find((n) => n.kind === 'gate' && n.side === q)
    c.mark('door', gate.p[0], 1, gate.p[1], { facing: q })
  }
}))
