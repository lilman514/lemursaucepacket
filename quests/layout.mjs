// Quest map layout for quests/build.mjs (and quests/preview.mjs, which draws the result).
//
// Progression chapters are laid out as a left-to-right layered graph:
//   1. redundant dependencies are dropped (A→C when A→B→C already exists), so fewer lines are drawn;
//   2. each quest's column is its longest dependency chain, and a long line gets a placeholder in every
//      column it passes, so ordering and spacing account for it;
//   3. quests are ordered within columns to avoid crossings (barycentre sweeps, then swapping neighbours
//      while that removes crossings);
//   4. rows are solved so each quest sits level with what it connects to, keeping minimum gaps.
// Quests with no dependencies either way sit in a row under the tree. Collections (Bestiary, Atlas) use
// a centred grid instead.

export const COLUMN = 2.3 // x distance between columns
export const ROW = 1.6 // minimum y distance between two size-1 quests in a column

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const round = (v) => Math.round(v * 20) / 20

/** Drops dependencies implied by others, keeping the unlock order but drawing fewer lines. */
export function reduceDependencies(quests) {
  const deps = new Map(quests.map((q) => [q.key, q.after ?? []]))
  const reach = new Map()
  const reachable = (k) => {
    if (reach.has(k)) return reach.get(k)
    const out = new Set()
    for (const p of deps.get(k) ?? []) {
      out.add(p)
      for (const r of reachable(p)) out.add(r)
    }
    reach.set(k, out)
    return out
  }
  const reduced = new Map()
  for (const [k, ps] of deps) {
    // Keep p unless another direct parent already leads to it.
    reduced.set(k, ps.filter((p) => !ps.some((other) => other !== p && reachable(other).has(p))))
  }
  return reduced
}

/**
 * Minimal-movement placement of one column: y values as close to `desired` as possible (least squares),
 * in the given order, at least `gaps[i]` apart. Isotonic regression (pool adjacent violators).
 */
function placeColumn(desired, gaps) {
  const offset = [0]
  for (const g of gaps) offset.push(offset[offset.length - 1] + g)
  const blocks = []
  desired.forEach((d, i) => {
    blocks.push({ sum: d - offset[i], count: 1 })
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1]
      const a = blocks[blocks.length - 2]
      if (a.sum / a.count <= b.sum / b.count) break
      a.sum += b.sum
      a.count += b.count
      blocks.pop()
    }
  })
  const out = []
  for (const b of blocks) for (let i = 0; i < b.count; i++) out.push(b.sum / b.count + offset[out.length])
  return out
}

/** Positions for a progression chapter, keyed by quest key: [x, y] with the tree's top at y = 0. */
export function layoutTree(quests, deps) {
  const size = new Map(quests.map((q) => [q.key, q.size ?? 1]))
  const parentsOf = (k) => deps.get(k) ?? []
  const hasChildren = new Set([...deps.values()].flat())
  const isolated = quests.filter((q) => parentsOf(q.key).length === 0 && !hasChildren.has(q.key)).map((q) => q.key)
  const linked = quests.filter((q) => !isolated.includes(q.key))

  // Columns: longest dependency chain.
  const layerOf = new Map()
  const depth = (k, stack = []) => {
    if (layerOf.has(k)) return layerOf.get(k)
    if (stack.includes(k)) throw new Error(`dependency cycle at ${k}`)
    const ps = parentsOf(k)
    const d = ps.length === 0 ? 0 : 1 + Math.max(...ps.map((p) => depth(p, [...stack, k])))
    layerOf.set(k, d)
    return d
  }
  linked.forEach((q) => depth(q.key))
  const layerCount = linked.length ? Math.max(...linked.map((q) => layerOf.get(q.key))) + 1 : 0

  // The graph, with a placeholder ("via") node in each column a long line passes through.
  const up = new Map()
  const down = new Map()
  const nodes = linked.map((q) => q.key)
  for (const k of nodes) {
    up.set(k, [])
    down.set(k, [])
  }
  const link = (a, b) => {
    down.get(a).push(b)
    up.get(b).push(a)
  }
  for (const q of linked) {
    for (const p of parentsOf(q.key)) {
      let prev = p
      for (let l = layerOf.get(p) + 1; l < layerOf.get(q.key); l++) {
        const via = `${p}>${q.key}@${l}`
        nodes.push(via)
        layerOf.set(via, l)
        up.set(via, [])
        down.set(via, [])
        link(prev, via)
        prev = via
      }
      link(prev, q.key)
    }
  }
  const isVia = (k) => k.includes('>')

  // Ordering within columns. Swapping neighbours can get stuck when two quests have to move together,
  // so the ordering is retried from shuffled starts (seeded, so every build gives the same layout).
  const index = new Map()
  let layers = []
  const reindex = () => layers.forEach((l) => l.forEach((k, i) => index.set(k, i)))
  const sortBy = (layer, neighbours) => {
    const keyed = layer.map((k, i) => {
      const ns = neighbours(k)
      return { k, key: ns.length ? avg(ns.map((n) => index.get(n))) : i, i }
    })
    keyed.sort((a, b) => a.key - b.key || a.i - b.i)
    layer.splice(0, layer.length, ...keyed.map((e) => e.k))
  }
  const crossingsBetween = (left) => {
    const edges = []
    for (const a of left) for (const b of down.get(a)) edges.push([index.get(a), index.get(b)])
    let n = 0
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) if ((edges[i][0] - edges[j][0]) * (edges[i][1] - edges[j][1]) < 0) n++
    return n
  }
  const crossingsAround = (li) => (li > 0 ? crossingsBetween(layers[li - 1]) : 0) + crossingsBetween(layers[li])
  const totalCrossings = () => layers.reduce((n, l) => n + crossingsBetween(l), 0)
  const order = () => {
    reindex()
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 1; i < layers.length; i++) sortBy(layers[i], (k) => up.get(k))
      reindex()
      for (let i = layers.length - 2; i >= 0; i--) sortBy(layers[i], (k) => down.get(k))
      reindex()
    }
    for (let improved = true, rounds = 0; improved && rounds < 50; rounds++) {
      improved = false
      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li]
        for (let i = 0; i + 1 < layer.length; i++) {
          const before = crossingsAround(li)
          ;[layer[i], layer[i + 1]] = [layer[i + 1], layer[i]]
          reindex()
          if (crossingsAround(li) < before) improved = true
          else {
            ;[layer[i], layer[i + 1]] = [layer[i + 1], layer[i]]
            reindex()
          }
        }
      }
    }
    return totalCrossings()
  }
  let seed = 0x2f6b1a3d
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
  const initial = Array.from({ length: layerCount }, () => [])
  for (const k of nodes) initial[layerOf.get(k)].push(k)
  layers = initial.map((l) => [...l])
  let best = { crossings: order(), layers: layers.map((l) => [...l]) }
  for (let attempt = 0; attempt < 40 && best.crossings > 0; attempt++) {
    layers = initial.map((l) => {
      const shuffled = [...l]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled
    })
    const crossings = order()
    if (crossings < best.crossings) best = { crossings, layers: layers.map((l) => [...l]) }
  }
  layers = best.layers
  reindex()

  // Rows: every node (placeholders too) settles level with its neighbours, keeping minimum gaps.
  const radius = (k) => (isVia(k) ? 0.25 : size.get(k) / 2)
  const gap = (a, b) => (isVia(a) && isVia(b) ? 0.6 : ROW - 1 + radius(a) + radius(b) + (isVia(a) || isVia(b) ? 0.15 : 0))
  const y = new Map()
  const place = (layer, desired) => {
    const ys = placeColumn(
      desired,
      layer.slice(1).map((k, i) => gap(layer[i], k))
    )
    layer.forEach((k, i) => y.set(k, ys[i]))
  }
  for (const layer of layers) place(layer, layer.map((k, i) => i * ROW))
  const toward = (k, ns) => (ns.length ? avg(ns.map((n) => y.get(n))) : y.get(k))
  for (let pass = 0; pass < 30; pass++) {
    for (let i = 1; i < layers.length; i++) place(layers[i], layers[i].map((k) => toward(k, up.get(k))))
    for (let i = layers.length - 2; i >= 0; i--) {
      // Quests that have parents follow what they unlock only half-way, so chains stay level with their start.
      place(layers[i], layers[i].map((k) => (up.get(k).length ? (toward(k, down.get(k)) + y.get(k)) / 2 : toward(k, down.get(k)))))
    }
  }

  const positions = new Map()
  let top = Infinity
  let bottom = -Infinity
  for (const q of linked) {
    top = Math.min(top, y.get(q.key) - radius(q.key))
    bottom = Math.max(bottom, y.get(q.key) + radius(q.key))
  }
  if (!Number.isFinite(top)) top = bottom = 0
  for (const q of linked) positions.set(q.key, [round(layerOf.get(q.key) * COLUMN), round(y.get(q.key) - top)])
  isolated.forEach((k, i) => positions.set(k, [round(i * COLUMN), round(bottom - top + (linked.length ? 1.3 : 0) + 0.5)]))
  return positions
}

/** Line crossings and lines drawn through other quests, for judging a layout. */
export function layoutQuality(quests, deps, positions) {
  const size = new Map(quests.map((q) => [q.key, q.size ?? 1]))
  const edges = []
  for (const q of quests) for (const p of deps.get(q.key) ?? []) edges.push([p, q.key])
  const at = (k) => positions.get(k)
  const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  const cross = (a, b, c, d) => side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0
  let crossings = 0
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i]
      const [c, d] = edges[j]
      if (a === c || a === d || b === c || b === d) continue
      if (cross(at(a), at(b), at(c), at(d))) crossings++
    }
  }
  const through = []
  for (const [a, b] of edges) {
    const [ax, ay] = at(a)
    const [bx, by] = at(b)
    for (const q of quests) {
      if (q.key === a || q.key === b) continue
      const [px, py] = at(q.key)
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2))
      if (Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))) < size.get(q.key) / 2 + 0.05) through.push(`${a}→${b} through ${q.key}`)
    }
  }
  return { crossings, through }
}

/** Collections: a centred grid, `columns` wide, top row at y = 0. */
export function layoutGrid(quests, columns = 5) {
  const rows = Math.ceil(quests.length / columns)
  return new Map(
    quests.map((q, i) => {
      const row = Math.floor(i / columns)
      const inRow = row === rows - 1 ? quests.length - row * columns : columns
      const col = i % columns
      return [q.key, [round((col - (inRow - 1) / 2) * 2.1 + ((columns - 1) / 2) * 2.1), round(0.5 + row * 1.9)]]
    })
  )
}

// ---------------------------------------------------------------- text measured like Minecraft's font

const NARROW = { i: 2, l: 3, t: 4, f: 5, k: 5, I: 4, ' ': 4, '.': 2, ',': 2, ':': 2, ';': 2, '!': 2, "'": 2, '|': 2, '`': 3, '"': 4, '(': 4, ')': 4, '[': 4, ']': 4, '{': 4, '}': 4, '<': 5, '>': 5, '*': 4 }

/** Width in Minecraft font pixels, ignoring & formatting codes (bold adds a pixel per glyph). */
export function textWidth(text) {
  let width = 0
  let bold = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '&' && i + 1 < text.length && /[0-9a-fk-or]/i.test(text[i + 1])) {
      const code = text[++i].toLowerCase()
      if (code === 'l') bold = true
      else if (code === 'r' || /[0-9a-f]/.test(code)) bold = false
      continue
    }
    width += (NARROW[c] ?? 6) + (bold ? 1 : 0)
  }
  return width
}

/**
 * Word wrap to at most `maxWidth` font pixels with lines as even as possible, so a paragraph never ends
 * on a stray word; `prefix` (e.g. a colour code) starts every line.
 */
export function wrap(text, maxWidth, prefix = '') {
  const greedy = (width) => {
    const lines = []
    let line = ''
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (line && textWidth(prefix + next) > width) {
        lines.push(prefix + line)
        line = word
      } else line = next
    }
    if (line) lines.push(prefix + line)
    return lines
  }
  const count = greedy(maxWidth).length
  // The narrowest width that still needs no more lines.
  let lo = 1
  let hi = maxWidth
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (greedy(mid).length <= count) hi = mid
    else lo = mid + 1
  }
  return greedy(hi)
}
