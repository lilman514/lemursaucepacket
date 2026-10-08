// A biome painted as a little landscape, as an SVG string: the atlas card's picture (and a biome page's banner) until
// the photo session has taken the real one. Everything comes from wiki/atlas.json: the biome's own sky, grass, foliage
// and water colours, its climate, and what grows there (spruces draw as spruces, a desert gets its cacti, a cave its
// dripstone), so no two biomes look alike. A seeded random keeps each picture the same from build to build.

const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const hex = (v) => `#${v.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('')}`
export const mix = (a, b, t) => {
  const x = rgb(a)
  const y = rgb(b)
  return hex(x.map((v, i) => v + (y[i] - v) * t))
}
const dark = (c, t) => mix(c, '#000000', t)
const light = (c, t) => mix(c, '#ffffff', t)
const f = (n) => (Math.round(n * 10) / 10).toString()

/** How many 16:9 pictures wide this one is: a wide banner gets that many more hills, trees and clouds. */
const spreadOf = (W, H) => Math.max(1, W / H / (320 / 180))
const times = (n, spread) => Math.round(n * spread)

function seeded(seed) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A line of hills across the picture: its path, and how high it is anywhere along it. */
function ridge(W, H, rand, { base, amp, n, sharp = false, top = false }) {
  n = times(n, spreadOf(W, H))
  const xs = Array.from({ length: n + 1 }, (_, i) => (i / n) * W)
  const ys = xs.map(() => (top ? base + rand() * amp : base - rand() * amp))
  const edge = top ? 0 : H
  let d = `M0,${edge} L0,${f(ys[0])}`
  if (sharp) for (let i = 1; i <= n; i++) d += ` L${f(xs[i])},${f(ys[i])}`
  else {
    for (let i = 0; i < n; i++) d += ` Q${f(xs[i])},${f(ys[i])} ${f((xs[i] + xs[i + 1]) / 2)},${f((ys[i] + ys[i + 1]) / 2)}`
    d += ` L${W},${f(ys[n])}`
  }
  d += ` L${W},${edge} Z`
  const step = W / n
  const at = (x) => {
    x = Math.min(W, Math.max(0, x))
    if (sharp) {
      const i = Math.min(n - 1, Math.floor(x / step))
      return ys[i] + (ys[i + 1] - ys[i]) * ((x - xs[i]) / step)
    }
    // Each curve runs from one midpoint to the next, bending towards the point between them.
    const i = Math.floor(x / step + 0.5)
    if (i >= n) {
      const mx = (xs[n - 1] + xs[n]) / 2
      const my = (ys[n - 1] + ys[n]) / 2
      return my + (ys[n] - my) * ((x - mx) / (W - mx))
    }
    const y0 = i === 0 ? ys[0] : (ys[i - 1] + ys[i]) / 2
    const y2 = (ys[i] + ys[i + 1]) / 2
    const t = i === 0 ? Math.sqrt(x / (step / 2)) : (x - (i - 0.5) * step) / step
    return (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ys[i] + t * t * y2
  }
  return { d, at, xs, ys }
}

/** Snow on each peak of a sharp ridge that rises above the snow line, with a ragged lower edge. */
function snowcaps(r, H, line, rand) {
  let d = ''
  const down = (x0, y0, x1, y1, depth) => {
    const t = Math.min(1, depth / Math.max(0.001, y1 - y0))
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
  }
  for (let i = 1; i < r.ys.length - 1; i++) {
    const [x, y] = [r.xs[i], r.ys[i]]
    if (!(y < r.ys[i - 1] && y < r.ys[i + 1]) || y > line) continue
    const depth = Math.min(line - y + H * 0.04, H * (0.06 + rand() * 0.07))
    const [lx, ly] = down(x, y, r.xs[i - 1], r.ys[i - 1], depth)
    const [rx, ry] = down(x, y, r.xs[i + 1], r.ys[i + 1], depth)
    d += `M${f(x)},${f(y)} L${f(rx)},${f(ry)} L${f(rx + (lx - rx) * 0.3)},${f(y + depth * 0.62)} L${f(rx + (lx - rx) * 0.62)},${f(y + depth * 1.05)} L${f(lx)},${f(ly)} Z `
  }
  return d
}

/** The shaded side of every peak, for a cut-stone look. */
function facets(r, H) {
  let d = ''
  for (let i = 1; i < r.ys.length - 1; i++) {
    if (!(r.ys[i] < r.ys[i - 1] && r.ys[i] < r.ys[i + 1])) continue
    d += `M${f(r.xs[i])},${f(r.ys[i])} L${f(r.xs[i + 1])},${f(r.ys[i + 1])} L${f(r.xs[i + 1])},${H} L${f(r.xs[i] + (r.xs[i + 1] - r.xs[i]) * 0.25)},${H} Z `
  }
  return d
}

/** Snow, stars, spores: small dots scattered over the picture. */
function flakes(rand, W, H, n, colour, size = 1) {
  let s = ''
  n = times(n, spreadOf(W, H))
  for (let i = 0; i < n; i++) s += `<circle cx="${f(rand() * W)}" cy="${f(rand() * H * 0.9)}" r="${f((0.5 + rand()) * size)}" fill="${colour}" opacity="${f(0.35 + rand() * 0.5)}"/>`
  return s
}

// ---------------------------------------------------------------- trees and other things that stand on the ground

const TRUNK = '#4f3a2a'
const TREES = {
  conifer(x, y, h, c, o) {
    const w = h * 0.34
    let s = `<path d="M${f(x)},${f(y - h)} L${f(x + w * 0.62)},${f(y - h * 0.42)} L${f(x + w * 0.34)},${f(y - h * 0.42)} L${f(x + w)},${f(y - h * 0.1)} L${f(x - w)},${f(y - h * 0.1)} L${f(x - w * 0.34)},${f(y - h * 0.42)} L${f(x - w * 0.62)},${f(y - h * 0.42)} Z" fill="${c}"/>`
    s += `<rect x="${f(x - h * 0.035)}" y="${f(y - h * 0.11)}" width="${f(h * 0.07)}" height="${f(h * 0.12)}" fill="${o.trunk}"/>`
    if (o.snow) s += `<path d="M${f(x)},${f(y - h)} L${f(x + w * 0.3)},${f(y - h * 0.72)} L${f(x - w * 0.3)},${f(y - h * 0.72)} Z M${f(x - w * 0.62)},${f(y - h * 0.42)} L${f(x + w * 0.62)},${f(y - h * 0.42)} L${f(x + w * 0.5)},${f(y - h * 0.36)} L${f(x - w * 0.5)},${f(y - h * 0.36)} Z" fill="#f1f6fa" opacity=".9"/>`
    return s
  },
  broad(x, y, h, c, o) {
    const r = h * 0.3
    return (
      `<rect x="${f(x - h * 0.045)}" y="${f(y - h * 0.55)}" width="${f(h * 0.09)}" height="${f(h * 0.56)}" fill="${o.trunk}"/>` +
      `<circle cx="${f(x - r * 0.62)}" cy="${f(y - h * 0.55)}" r="${f(r * 0.78)}" fill="${c}"/><circle cx="${f(x + r * 0.62)}" cy="${f(y - h * 0.57)}" r="${f(r * 0.74)}" fill="${c}"/>` +
      `<circle cx="${f(x)}" cy="${f(y - h * 0.72)}" r="${f(r)}" fill="${c}"/><circle cx="${f(x - r * 0.3)}" cy="${f(y - h * 0.8)}" r="${f(r * 0.45)}" fill="${light(c, 0.12)}" opacity=".7"/>`
    )
  },
  acacia(x, y, h, c, o) {
    const lean = (o.rand() - 0.5) * h * 0.4
    return (
      `<path d="M${f(x)},${f(y)} Q${f(x + lean * 0.2)},${f(y - h * 0.5)} ${f(x + lean)},${f(y - h * 0.82)}" stroke="${o.trunk}" stroke-width="${f(h * 0.07)}" fill="none"/>` +
      `<ellipse cx="${f(x + lean)}" cy="${f(y - h * 0.86)}" rx="${f(h * 0.5)}" ry="${f(h * 0.1)}" fill="${c}"/><ellipse cx="${f(x + lean - h * 0.12)}" cy="${f(y - h * 0.95)}" rx="${f(h * 0.3)}" ry="${f(h * 0.07)}" fill="${light(c, 0.1)}"/>`
    )
  },
  jungle(x, y, h, c, o) {
    const r = h * 0.2
    return (
      `<rect x="${f(x - h * 0.035)}" y="${f(y - h * 0.82)}" width="${f(h * 0.07)}" height="${f(h * 0.83)}" fill="${o.trunk}"/>` +
      `<circle cx="${f(x - r)}" cy="${f(y - h * 0.8)}" r="${f(r)}" fill="${dark(c, 0.12)}"/><circle cx="${f(x + r)}" cy="${f(y - h * 0.82)}" r="${f(r)}" fill="${dark(c, 0.12)}"/>` +
      `<circle cx="${f(x)}" cy="${f(y - h * 0.93)}" r="${f(r * 1.15)}" fill="${c}"/><path d="M${f(x - r * 1.2)},${f(y - h * 0.75)} l0,${f(h * 0.25)} M${f(x + r * 1.4)},${f(y - h * 0.76)} l0,${f(h * 0.18)}" stroke="${dark(c, 0.25)}" stroke-width="${f(h * 0.02)}"/>`
    )
  },
  palm(x, y, h, c, o) {
    const tx = x + h * 0.18
    const ty = y - h * 0.9
    let s = `<path d="M${f(x)},${f(y)} Q${f(x - h * 0.05)},${f(y - h * 0.5)} ${f(tx)},${f(ty)}" stroke="#8b6b45" stroke-width="${f(h * 0.06)}" fill="none"/>`
    for (const [dx, dy] of [[-0.42, 0.18], [-0.3, -0.12], [0.05, -0.2], [0.36, -0.08], [0.45, 0.2]]) s += `<path d="M${f(tx)},${f(ty)} q${f(dx * h * 0.6)},${f(-h * 0.14)} ${f(dx * h)},${f(dy * h)}" stroke="${c}" stroke-width="${f(h * 0.06)}" stroke-linecap="round" fill="none"/>`
    return s
  },
  willow(x, y, h, c, o) {
    let s = `<rect x="${f(x - h * 0.045)}" y="${f(y - h * 0.6)}" width="${f(h * 0.09)}" height="${f(h * 0.61)}" fill="${o.trunk}"/><ellipse cx="${f(x)}" cy="${f(y - h * 0.68)}" rx="${f(h * 0.42)}" ry="${f(h * 0.22)}" fill="${c}"/>`
    for (let i = -3; i <= 3; i++) s += `<path d="M${f(x + i * h * 0.11)},${f(y - h * 0.6)} l0,${f(h * (0.2 + o.rand() * 0.2))}" stroke="${dark(c, 0.1)}" stroke-width="${f(h * 0.035)}"/>`
    if (o.roots) s += `<path d="M${f(x - h * 0.2)},${f(y)} q${f(h * 0.2)},${f(-h * 0.3)} ${f(h * 0.4)},0 M${f(x - h * 0.1)},${f(y)} q${f(h * 0.1)},${f(-h * 0.2)} ${f(h * 0.2)},0" stroke="${o.trunk}" stroke-width="${f(h * 0.035)}" fill="none"/>`
    return s
  },
  dead(x, y, h, c, o) {
    return `<path d="M${f(x)},${f(y)} L${f(x)},${f(y - h * 0.7)} M${f(x)},${f(y - h * 0.45)} L${f(x + h * 0.22)},${f(y - h * 0.68)} M${f(x)},${f(y - h * 0.55)} L${f(x - h * 0.2)},${f(y - h * 0.75)} M${f(x)},${f(y - h * 0.7)} L${f(x + h * 0.08)},${f(y - h * 0.85)}" stroke="#5c4a3a" stroke-width="${f(h * 0.05)}" stroke-linecap="round" fill="none"/>`
  },
  mushroom(x, y, h, c, o) {
    const red = o.rand() < 0.5
    let s = `<rect x="${f(x - h * 0.06)}" y="${f(y - h * 0.62)}" width="${f(h * 0.12)}" height="${f(h * 0.63)}" fill="#e3d6c0"/>`
    if (red) {
      s += `<path d="M${f(x - h * 0.32)},${f(y - h * 0.58)} Q${f(x - h * 0.32)},${f(y - h * 0.95)} ${f(x)},${f(y - h * 0.95)} Q${f(x + h * 0.32)},${f(y - h * 0.95)} ${f(x + h * 0.32)},${f(y - h * 0.58)} Z" fill="#c4302b"/>`
      s += `<circle cx="${f(x - h * 0.12)}" cy="${f(y - h * 0.8)}" r="${f(h * 0.045)}" fill="#f4ece0"/><circle cx="${f(x + h * 0.13)}" cy="${f(y - h * 0.72)}" r="${f(h * 0.04)}" fill="#f4ece0"/>`
    } else s += `<ellipse cx="${f(x)}" cy="${f(y - h * 0.64)}" rx="${f(h * 0.42)}" ry="${f(h * 0.1)}" fill="#9a7150"/>`
    return s
  },
  bamboo(x, y, h, c, o) {
    let s = ''
    for (const dx of [-0.08, 0, 0.09]) {
      const hh = h * (0.75 + o.rand() * 0.25)
      s += `<rect x="${f(x + dx * h - h * 0.015)}" y="${f(y - hh)}" width="${f(h * 0.03)}" height="${f(hh)}" fill="#7aa83c"/><path d="M${f(x + dx * h)},${f(y - hh * 0.8)} l${f(h * 0.08)},${f(-h * 0.05)}" stroke="#5f8f2c" stroke-width="${f(h * 0.025)}"/>`
    }
    return s
  },
  bush(x, y, h, c, o) {
    return `<ellipse cx="${f(x)}" cy="${f(y - h * 0.16)}" rx="${f(h * 0.34)}" ry="${f(h * 0.2)}" fill="${c}"/><ellipse cx="${f(x - h * 0.08)}" cy="${f(y - h * 0.24)}" rx="${f(h * 0.16)}" ry="${f(h * 0.1)}" fill="${light(c, 0.12)}" opacity=".6"/>`
  },
  cactus(x, y, h, c, o) {
    const w = h * 0.13
    return `<g fill="#5a8d3a"><rect x="${f(x - w / 2)}" y="${f(y - h)}" width="${f(w)}" height="${f(h)}" rx="${f(w / 2)}"/><rect x="${f(x - w * 2)}" y="${f(y - h * 0.62)}" width="${f(w * 0.8)}" height="${f(h * 0.3)}" rx="${f(w * 0.4)}"/><rect x="${f(x - w * 2)}" y="${f(y - h * 0.38)}" width="${f(w * 1.6)}" height="${f(w * 0.8)}" rx="${f(w * 0.4)}"/></g>`
  },
  crimson(x, y, h, c, o) {
    return `<rect x="${f(x - h * 0.05)}" y="${f(y - h * 0.7)}" width="${f(h * 0.1)}" height="${f(h * 0.71)}" fill="#5c1d2b"/><path d="M${f(x - h * 0.38)},${f(y - h * 0.62)} Q${f(x - h * 0.36)},${f(y - h * 1.02)} ${f(x)},${f(y - h)} Q${f(x + h * 0.36)},${f(y - h * 1.02)} ${f(x + h * 0.38)},${f(y - h * 0.62)} Z" fill="${c}"/><circle cx="${f(x + h * 0.12)}" cy="${f(y - h * 0.7)}" r="${f(h * 0.06)}" fill="#f7a541"/>`
  },
  crystal(x, y, h, c, o) {
    const w = h * 0.16
    return `<path d="M${f(x - w)},${f(y)} L${f(x - w * 0.4)},${f(y - h)} L${f(x + w * 0.5)},${f(y - h * 0.8)} L${f(x + w)},${f(y)} Z" fill="${c}"/><path d="M${f(x - w * 0.4)},${f(y - h)} L${f(x + w * 0.05)},${f(y)} L${f(x - w)},${f(y)} Z" fill="${light(c, 0.25)}" opacity=".6"/>`
  },
  chorus(x, y, h, c, o) {
    const s = h * 0.12
    return `<path d="M${f(x)},${f(y)} v${f(-h * 0.55)} h${f(s * 2)} v${f(-h * 0.3)} M${f(x)},${f(y - h * 0.4)} h${f(-s * 2.2)} v${f(-h * 0.35)}" stroke="#7a5a86" stroke-width="${f(s)}" fill="none"/><rect x="${f(x + s * 1.4)}" y="${f(y - h * 0.92)}" width="${f(s * 1.3)}" height="${f(s * 1.3)}" fill="#cfa6dc"/><rect x="${f(x - s * 2.8)}" y="${f(y - h * 0.82)}" width="${f(s * 1.3)}" height="${f(s * 1.3)}" fill="#cfa6dc"/>`
  }
}

/** The tree shapes a biome's plants call for: "Big spruce trees" draw as spruces, "Cherry trees" as blossom. */
function treeShapes(b) {
  const out = []
  for (const p of b.plants) {
    const s = p.toLowerCase()
    if (/giant mushrooms/.test(s)) out.push('mushroom')
    else if (/bamboo/.test(s)) out.push('bamboo')
    else if (!/trees/.test(s)) continue
    else
      out.push(
        /palm/.test(s) ? 'palm'
        : /acacia|baobab/.test(s) ? 'acacia'
        : /jungle|kapok/.test(s) ? 'jungle'
        : /mangrove/.test(s) ? 'mangrove'
        : /willow|cypress/.test(s) ? 'willow'
        : /spruce|pine|fir\b|redwood|larch|cedar/.test(s) ? 'conifer'
        : /dead/.test(s) ? 'dead'
        : /cherry|sakura|magnolia/.test(s) ? 'blossom'
        : /maple/.test(s) ? 'autumn'
        : /dark oak/.test(s) ? 'darkoak'
        : /birch/.test(s) ? 'birch'
        : 'broad'
      )
  }
  return out
}
const AUTUMN = ['#d4612a', '#e39a35', '#bf432a', '#e7b347']

function drawTree(shape, x, y, h, colours, o) {
  const leaf = colours.leaf
  if (o.autumn && (shape === 'broad' || shape === 'darkoak' || shape === 'birch')) return TREES.broad(x, y, h, mix(AUTUMN[Math.floor(o.rand() * AUTUMN.length)], o.hazeC ?? '#000000', o.haze ?? 0), shape === 'birch' ? { ...o, trunk: '#e2ddd0' } : o)
  switch (shape) {
    case 'conifer':
      return TREES.conifer(x, y, h, colours.needle, o)
    case 'birch':
      return TREES.broad(x, y, h, colours.birch, { ...o, trunk: '#e2ddd0' })
    case 'blossom':
      return TREES.broad(x, y, h, o.rand() < 0.5 ? '#f0a2c4' : '#f7c4da', { ...o, trunk: '#4a2f2a' })
    case 'autumn':
      return TREES.broad(x, y, h, AUTUMN[Math.floor(o.rand() * AUTUMN.length)], o)
    case 'darkoak':
      return TREES.broad(x, y, h * 0.9, dark(leaf, 0.3), o)
    case 'mangrove':
      return TREES.willow(x, y, h, leaf, { ...o, roots: true })
    default:
      return (TREES[shape] ?? TREES.broad)(x, y, h, leaf, o)
  }
}

// ---------------------------------------------------------------- the Overworld's surface

/** The sky: most pictures by day, some at golden hour, the wettest under cloud. */
function skyOf(b, id, W, H, rand, cold) {
  const t = b.climate.temperature
  const skyC = b.colours.sky ?? '#78a7ff'
  const golden = rand() < 0.3
  const overcast = !golden && b.climate.precipitation && b.climate.downfall >= 0.8 && rand() < 0.5
  const warm = golden ? '#ffb36b' : t >= 1.5 ? '#ffd79a' : cold ? '#e8f0fb' : '#ffe6b5'
  const top = golden ? mix(skyC, '#2b1d33', 0.5) : mix(skyC, '#0f0d0b', overcast ? 0.5 : 0.38)
  const low = mix(overcast ? mix(skyC, '#b9bec4', 0.5) : skyC, warm, golden ? 0.62 : 0.4)
  let defs = `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".72" stop-color="${low}"/></linearGradient>`
  let svg = `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>`
  const sunX = W * (0.15 + rand() * 0.7)
  const sunY = golden ? H * (0.4 + rand() * 0.1) : H * (0.14 + rand() * 0.14)
  if (!overcast) {
    defs += `<radialGradient id="${id}-sun"><stop offset="0" stop-color="${warm}" stop-opacity="${golden ? 0.7 : 0.45}"/><stop offset="1" stop-color="${warm}" stop-opacity="0"/></radialGradient>`
    svg += `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(H * 0.36)}" fill="url(#${id}-sun)"/><circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(H * (golden ? 0.06 : 0.045))}" fill="${light(warm, golden ? 0.25 : 0.6)}"/>`
  }
  // Clouds: a few soft heaps, a sky full of them when it's grey.
  const cloud = golden ? mix('#ffd2a8', '#ffffff', 0.25) : overcast ? '#d9dde2' : '#ffffff'
  const n = times(overcast ? 7 : 2 + Math.floor(rand() * 3), spreadOf(W, H))
  for (let i = 0; i < n; i++) {
    const cx = rand() * W
    const cy = H * (0.06 + rand() * (overcast ? 0.3 : 0.26))
    const w = W * (0.08 + rand() * 0.14)
    const o = overcast ? 0.75 : 0.45 + rand() * 0.3
    svg += `<g fill="${cloud}" opacity="${f(o)}"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w)}" ry="${f(w * 0.2)}"/><ellipse cx="${f(cx - w * 0.3)}" cy="${f(cy - w * 0.12)}" rx="${f(w * 0.42)}" ry="${f(w * 0.24)}"/><ellipse cx="${f(cx + w * 0.22)}" cy="${f(cy - w * 0.16)}" rx="${f(w * 0.36)}" ry="${f(w * 0.26)}"/></g>`
  }
  return { defs, svg, low, warm, sunX, sunY, golden }
}

/** What sort of land this is, for the shapes of its hills and what stands on them. */
function landOf(b) {
  const id = b.id.split(':')[1]
  if (/skylands|sky_islands|floating/.test(id)) return 'skylands'
  if (/mushroom/.test(id) && b.plants.includes('Giant mushrooms')) return 'mushroom'
  if (b.category === 'oceans') return /river/.test(id) ? 'river' : /beach|shore|coast|dune/.test(id) ? 'beach' : 'sea'
  if (/badlands|mesa/.test(id) && b.category === 'snowy') return 'badlands'
  if (b.category === 'deserts') return /badlands|mesa|canyon|red|outback|painted|bryce/.test(id) ? 'badlands' : 'desert'
  if (b.category === 'mountains') return 'mountains'
  if (b.category === 'snowy') return /peak|mountain|slope|alps|glacier|summit|cliff|chasm|heights/.test(id) ? 'snowpeaks' : 'snow'
  return b.category
}

const ROCKS = [
  [/basalt|volcan|caldera|ashen|crater/, '#4f4c55'],
  [/chalk|white|calcite|marble/, '#d6d3c8'],
  [/granite|scarlet/, '#9a6656'],
  [/emerald|jade/, '#6f8a79'],
  [/painted|amethyst/, '#9b7bb0'],
  [/sandstone|desert|arid/, '#c4a576'],
  [/haze|mist|cloud/, '#9ca5b1']
]
const GRASSY = /highland|meadow|field|slope|hill|grove|valley|wisteria|savanna|jungle|cherry|forest|lowland|plateau/

function overworld(b, id, W, H, rand) {
  const c = b.colours
  const t = b.climate.temperature
  const path = b.id.split(':')[1]
  const land = landOf(b)
  const cold = t < 0.2 || land === 'snow' || land === 'snowpeaks'
  const sky = skyOf(b, id, W, H, rand, cold)
  let { defs, svg } = sky
  const haze = mix(sky.low, '#ffffff', 0.08)
  const grass = c.grass ?? '#79c05a'
  const foliage = c.foliage ?? '#59ae30'
  const water = c.water ?? '#3f76e4'
  const colours = { leaf: dark(foliage, 0.18), needle: dark('#619961', 0.32), birch: dark('#80a755', 0.12) }
  const autumn = /autumn|maple|fall/.test(path)
  const o = { rand, trunk: TRUNK, snow: cold, autumn }
  const back = { ...o, haze: 0.35, hazeC: haze }
  const hazy = { leaf: mix(colours.leaf, haze, 0.35), needle: mix(colours.needle, haze, 0.35), birch: mix(colours.birch, haze, 0.35) }

  // Trees this biome grows, and how thick on the ground.
  const shapes = treeShapes(b)
  if (!shapes.length) {
    if (b.category === 'forests') shapes.push('broad')
    else if (b.category === 'jungles') shapes.push('jungle')
    else if (/bayou|swamp/.test(path)) shapes.push('willow')
    else if (/shrub|bush|brush|steppe|prairie|scrub/.test(path)) shapes.push('bush')
  }
  const pick = () => shapes[Math.floor(rand() * shapes.length)]
  const big = b.plants.some((p) => /^Big /.test(p)) ? 1.25 : 1

  // Open water: the sea and the beach.
  if (land === 'sea' || land === 'beach') {
    const hz = H * (land === 'sea' ? 0.56 : 0.5)
    const deep = /deep/.test(path)
    defs += `<linearGradient id="${id}-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(water, haze, 0.5)}"/><stop offset="1" stop-color="${dark(water, deep ? 0.55 : 0.35)}"/></linearGradient>`
    if (rand() < 0.6 && !/frozen/.test(path)) {
      const ix = W * (0.12 + rand() * 0.6)
      svg += `<path d="M${f(ix)},${f(hz)} q${f(W * 0.08)},${f(-H * 0.09)} ${f(W * 0.2)},0 Z" fill="${mix(foliage, haze, 0.6)}"/>`
    }
    svg += `<rect y="${f(hz)}" width="${W}" height="${f(H - hz)}" fill="url(#${id}-sea)"/>`
    // The sun's glint, and waves.
    if (sky.sunY < hz) for (let i = 0; i < 9; i++) {
      const y = hz + 2 + i * ((H - hz) / 10)
      const w = 4 + i * 2.2 + rand() * 4
      svg += `<path d="M${f(sky.sunX - w / 2 + (rand() - 0.5) * 6)},${f(y)} h${f(w)}" stroke="${light(sky.warm, 0.4)}" stroke-width="1.2" stroke-linecap="round" opacity="${f(0.55 - i * 0.04)}"/>`
    }
    for (let i = 0; i < times(14, spreadOf(W, H)); i++) {
      const y = hz + 4 + rand() * (H - hz - 6)
      const w = 6 + rand() * 18 * ((y - hz) / (H - hz) + 0.4)
      svg += `<path d="M${f(rand() * W)},${f(y)} h${f(w)}" stroke="${light(water, 0.45)}" stroke-width="${f(0.6 + (y - hz) / 50)}" stroke-linecap="round" opacity=".3"/>`
    }
    if (/frozen/.test(path) || b.plants.includes('Icebergs')) {
      for (let i = 0; i < 5; i++) {
        const x = rand() * W
        const y = hz + 6 + rand() * (H - hz - 14)
        const w = 8 + rand() * 26
        svg += `<path d="M${f(x)},${f(y)} l${f(w * 0.2)},${f(-w * 0.12)} h${f(w * 0.6)} l${f(w * 0.2)},${f(w * 0.12)} Z" fill="#eef5fa" opacity=".92"/>`
      }
      if (b.plants.includes('Icebergs')) {
        const x = W * (0.2 + rand() * 0.6)
        svg += `<path d="M${f(x)},${f(hz + 2)} l${f(W * 0.04)},${f(-H * 0.2)} l${f(W * 0.03)},${f(H * 0.08)} l${f(W * 0.05)},${f(-H * 0.05)} l${f(W * 0.05)},${f(H * 0.17)} Z" fill="#e3eef6"/><path d="M${f(x + W * 0.04)},${f(hz - H * 0.18)} l${f(W * 0.03)},${f(H * 0.08)} l${f(-W * 0.02)},${f(H * 0.1)} l${f(-W * 0.05)},0 Z" fill="#bcd3e4"/>`
      }
    }
    if (land === 'beach') {
      const sand = /snowy/.test(path) ? '#eef3f6' : /stony|stone|rocky|gravel/.test(path) ? '#8e9094' : '#ead6a0'
      const r = ridge(W, H, rand, { base: H * 0.84, amp: H * 0.08, n: 3 })
      svg += `<path d="${r.d}" fill="${sand}"/>`
      const palms = shapes.includes('palm') || t >= 0.9
      if (shapes.length || t >= 0.9) for (let i = 0; i < 2; i++) {
        const x = W * (0.12 + rand() * 0.76)
        svg += drawTree(palms ? 'palm' : pick(), x, r.at(x) + 2, H * (0.32 + rand() * 0.1), { ...colours, leaf: palms ? '#4f8a3a' : colours.leaf }, o)
      }
    }
    if (cold && land === 'sea') svg += flakes(rand, W, H, 26, '#ffffff')
    return { defs, svg }
  }

  // The Skylands: islands adrift above the clouds.
  if (land === 'skylands') {
    const winter = /winter/.test(path)
    for (let i = 0; i < 3; i++) {
      const w = W * (0.26 + rand() * 0.18)
      const cx = W * (0.18 + i * 0.32) + (rand() - 0.5) * W * 0.08
      const cy = H * (0.42 + rand() * 0.3)
      const fade = i === 1 ? 0 : 0.3
      const top = winter ? '#eef3f7' : mix(grass, haze, fade)
      svg += `<path d="M${f(cx - w / 2)},${f(cy)} L${f(cx - w * 0.36)},${f(cy + w * 0.16)} L${f(cx - w * 0.18)},${f(cy + w * 0.24)} L${f(cx - w * 0.04)},${f(cy + w * 0.5)} L${f(cx + w * 0.1)},${f(cy + w * 0.3)} L${f(cx + w * 0.3)},${f(cy + w * 0.2)} L${f(cx + w / 2)},${f(cy)} Z" fill="${mix('#6f604f', haze, fade)}"/>`
      svg += `<rect x="${f(cx - w / 2)}" y="${f(cy - w * 0.03)}" width="${f(w)}" height="${f(w * 0.05)}" rx="${f(w * 0.02)}" fill="${top}"/>`
      if (rand() < 0.6) svg += `<rect x="${f(cx + w * 0.18)}" y="${f(cy + w * 0.02)}" width="1.6" height="${f(H - cy)}" fill="${light(water, 0.3)}" opacity=".55"/>`
      for (let k = 0; k < 3; k++) {
        if (!shapes.length) break
        const x = cx - w * 0.38 + rand() * w * 0.76
        svg += drawTree(pick(), x, cy - w * 0.02, w * (0.2 + rand() * 0.1), fade ? hazy : colours, fade ? back : o)
      }
    }
    svg += `<rect y="${f(H * 0.86)}" width="${W}" height="${f(H * 0.14)}" fill="#ffffff" opacity=".45"/>`
    if (winter) svg += flakes(rand, W, H, 30, '#ffffff')
    return { defs, svg }
  }

  // Three bands of land, far to near: far ones fade into the haze.
  let far = mix(foliage, haze, 0.55)
  let mid = mix(grass, haze, 0.22)
  let near = dark(grass, 0.08)
  let shape = { far: { base: H * 0.6, amp: H * 0.14, n: 5 }, mid: { base: H * 0.74, amp: H * 0.1, n: 4 }, near: { base: H * 0.88, amp: H * 0.07, n: 3 } }
  if (/gravel/.test(path)) {
    far = mix('#a19b95', haze, 0.4)
    mid = '#8f8a85'
    near = '#9a958f'
  } else if (land === 'snow' || land === 'snowpeaks') {
    far = mix('#c9d6e2', haze, 0.4)
    mid = '#dfe7ee'
    near = '#f0f4f7'
  } else if (land === 'desert') {
    far = mix('#dcc38a', haze, 0.45)
    mid = '#e5cf98'
    near = '#efdba6'
  } else if (land === 'badlands') {
    far = mix('#c06d42', haze, 0.35)
    mid = '#b35d38'
    near = cold ? '#eef3f6' : '#c97c4a'
  } else if (land === 'mushroom') {
    far = mix('#8d7f94', haze, 0.45)
    mid = '#86778c'
    near = '#7d6e84'
  }
  const peaks = land === 'mountains' || land === 'snowpeaks'
  if (peaks) shape = { far: { base: H * 0.58, amp: H * 0.36, n: 7, sharp: true }, mid: { base: H * 0.78, amp: H * 0.24, n: 6, sharp: true }, near: { base: H * 0.92, amp: H * 0.08, n: 3 } }
  if (peaks && GRASSY.test(path)) shape.mid = { base: H * 0.8, amp: H * 0.1, n: 4 }
  if (land === 'plains' || land === 'savannas' || land === 'wetlands') shape = { far: { base: H * 0.64, amp: H * 0.08, n: 5 }, mid: { base: H * 0.76, amp: H * 0.06, n: 4 }, near: { base: H * 0.9, amp: H * 0.04, n: 3 } }
  if (land === 'desert') shape = { far: { base: H * 0.64, amp: H * 0.12, n: 4 }, mid: { base: H * 0.78, amp: H * 0.12, n: 3 }, near: { base: H * 0.92, amp: H * 0.08, n: 2 } }
  if (land === 'river') shape.near = { base: H * 0.98, amp: H * 0.05, n: 3 }

  const rf = ridge(W, H, rand, shape.far)
  const rm = ridge(W, H, rand, shape.mid)
  const rn = ridge(W, H, rand, shape.near)
  if (land === 'badlands') {
    // Flat-topped mesas, banded like terracotta.
    defs += `<linearGradient id="${id}-bands" gradientUnits="userSpaceOnUse" x1="0" y1="${f(H * 0.35)}" x2="0" y2="${f(H * 0.85)}"><stop offset=".0" stop-color="#c8774c"/><stop offset=".18" stop-color="#c8774c"/><stop offset=".18" stop-color="#e3b07c"/><stop offset=".26" stop-color="#e3b07c"/><stop offset=".26" stop-color="#a9553a"/><stop offset=".44" stop-color="#a9553a"/><stop offset=".44" stop-color="#d8c3a6"/><stop offset=".5" stop-color="#d8c3a6"/><stop offset=".5" stop-color="#9b4b33"/><stop offset=".7" stop-color="#9b4b33"/><stop offset=".7" stop-color="#c06a3e"/><stop offset="1" stop-color="#c06a3e"/></linearGradient>`
    let d = `M0,${H}`
    let caps = ''
    let x = 0
    while (x < W) {
      const w = W * (0.12 + rand() * 0.22)
      const top = H * (0.36 + rand() * 0.22)
      const gap = W * (0.03 + rand() * 0.1)
      d += ` L${f(x)},${H * 0.8} L${f(x + w * 0.12)},${f(top)} L${f(x + w * 0.88)},${f(top)} L${f(x + w)},${H * 0.8} L${f(x + w + gap)},${H * 0.8}`
      if (cold) caps += `M${f(x + w * 0.12)},${f(top)} L${f(x + w * 0.88)},${f(top)} L${f(x + w * 0.9)},${f(top + 3)} L${f(x + w * 0.1)},${f(top + 3)} Z `
      x += w + gap
    }
    svg += `<path d="${d} L${W},${H} Z" fill="url(#${id}-bands)" opacity=".92"/>${caps ? `<path d="${caps}" fill="#f2f6f9"/>` : ''}<rect y="${f(H * 0.78)}" width="${W}" height="${f(H * 0.22)}" fill="${mix(far, haze, 0.15)}" opacity=".35"/>`
  } else if (peaks) {
    const rock = land === 'snowpeaks' ? '#aab4bf' : ROCKS.find(([re]) => re.test(path))?.[1] ?? '#8a8f96'
    const capped = land === 'snowpeaks' || t <= 0.35 || /snow|frozen|jagged|peaks|alps|glacier/.test(path)
    svg += `<path d="${rf.d}" fill="${mix(rock, haze, 0.45)}"/><path d="${facets(rf, H)}" fill="#000" opacity=".1"/>`
    if (capped) svg += `<path d="${snowcaps(rf, H, H * 0.42, rand)}" fill="#f2f6f9" opacity=".9"/>`
    if (/volcan|caldera|crater/.test(path)) {
      const i = rf.ys.indexOf(Math.min(...rf.ys))
      svg += `<ellipse cx="${f(rf.xs[i])}" cy="${f(rf.ys[i] + 1)}" rx="5" ry="1.6" fill="#ff7a2a"/><g fill="#8d8a90" opacity=".5"><circle cx="${f(rf.xs[i] + 3)}" cy="${f(rf.ys[i] - 8)}" r="5"/><circle cx="${f(rf.xs[i] + 9)}" cy="${f(rf.ys[i] - 17)}" r="7"/><circle cx="${f(rf.xs[i] + 17)}" cy="${f(rf.ys[i] - 27)}" r="9"/></g>`
    }
    if (GRASSY.test(path)) svg += `<path d="${rm.d}" fill="${mix(grass, haze, 0.15)}"/>`
    else {
      svg += `<path d="${rm.d}" fill="${mix(rock, '#3a3d42', 0.25)}"/><path d="${facets(rm, H)}" fill="#000" opacity=".12"/>`
      if (capped) svg += `<path d="${snowcaps(rm, H, H * 0.62, rand)}" fill="#e9eff4" opacity=".92"/>`
    }
  } else svg += `<path d="${rf.d}" fill="${far}"/><path d="${rm.d}" fill="${mid}"/>`

  // A river winding across, between the middle hills and the near bank.
  if (land === 'river') {
    const frozen = /frozen/.test(path)
    const y0 = H * (0.8 + rand() * 0.04)
    const y1 = H * (0.8 + rand() * 0.04)
    defs += `<linearGradient id="${id}-river" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${frozen ? '#dbe8f2' : mix(water, haze, 0.35)}"/><stop offset="1" stop-color="${frozen ? '#b9cfe0' : dark(water, 0.25)}"/></linearGradient>`
    svg += `<path d="M0,${f(y0)} Q${f(W * 0.3)},${f(H * 0.74)} ${f(W * 0.55)},${f(H * 0.8)} T${W},${f(y1)} L${W},${H} L0,${H} Z" fill="url(#${id}-river)"/>`
    for (let i = 0; i < 6; i++) svg += `<path d="M${f(rand() * W)},${f(H * (0.84 + rand() * 0.1))} h${f(8 + rand() * 12)}" stroke="#ffffff" stroke-width=".8" opacity="${frozen ? 0.5 : 0.3}"/>`
  }

  // Trees: smaller and hazier on the middle band, bigger in front.
  const dense = b.category === 'forests' || b.category === 'jungles' || /forest|grove|woods|taiga|jungle|rainforest|thicket/.test(path)
  const sparse = /sparse|plains|meadow|field|steppe|shrub|barren|clearing/.test(path)
  const count = (shapes.length ? (dense ? [14, 6] : sparse ? [3, 1] : land === 'savannas' ? [4, 2] : peaks ? [5, 0] : land === 'river' ? [6, 0] : [6, 2]) : [0, 0]).map((n) => times(n, spreadOf(W, H)))
  for (let i = 0; i < count[0]; i++) {
    const x = ((i + rand() * 0.8) / count[0]) * W
    svg += drawTree(pick(), x, (peaks && !GRASSY.test(path) ? rn : rm).at(x) + 2, H * (0.12 + rand() * 0.06) * big, hazy, back)
  }
  svg += `<path d="${rn.d}" fill="${peaks ? dark(grass, 0.12) : near}"/>`
  // Grass in tufts where the ground is green.
  const green = !['desert', 'badlands', 'snow', 'snowpeaks', 'mushroom'].includes(land) && !/gravel/.test(path)
  if (green) for (let i = 0; i < times(34, spreadOf(W, H)); i++) {
    const x = rand() * W
    const y = rn.at(x) + 2 + rand() * (H - rn.at(x) - 3)
    svg += `<path d="M${f(x)},${f(y)} l-1.2,-3 M${f(x)},${f(y)} l0,-3.8 M${f(x)},${f(y)} l1.2,-3" stroke="${dark(grass, 0.3)}" stroke-width=".7" opacity=".6"/>`
  }
  for (let i = 0; i < count[1]; i++) {
    const x = W * (0.06 + rand() * 0.88)
    svg += drawTree(pick(), x, rn.at(x) + 3, H * (0.28 + rand() * 0.14) * big, colours, o)
  }

  // What grows low: water and reeds in the wetlands, flowers, cacti.
  if (land === 'wetlands') {
    for (let i = 0; i < times(3, spreadOf(W, H)); i++) {
      const x = W * (0.1 + rand() * 0.8)
      const y = rn.at(x) + H * (0.04 + rand() * 0.04)
      const rx = W * (0.07 + rand() * 0.08)
      svg += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(H * 0.025)}" fill="${mix(water, sky.low, 0.25)}" opacity=".9"/>`
      if (b.plants.includes('Lily pads')) svg += `<ellipse cx="${f(x + 4)}" cy="${f(y)}" rx="2.6" ry="1" fill="#3f7a2c"/><ellipse cx="${f(x - 7)}" cy="${f(y + 1)}" rx="2.2" ry=".9" fill="#3f7a2c"/>`
      for (let k = 0; k < 4; k++) svg += `<path d="M${f(x + rx * (k < 2 ? -1 : 1) * (0.8 + k * 0.08))},${f(y + 1)} l${f((rand() - 0.5) * 2)},${f(-7 - rand() * 5)}" stroke="${dark(grass, 0.2)}" stroke-width=".9"/>`
    }
  }
  if (b.plants.some((p) => /Flowers|Sunflowers|Lavender/.test(p)) && land !== 'desert' && land !== 'badlands') {
    const field = /flower|poppy|lavender|sunflower|blooming|meadow|clover/.test(path)
    const palette = b.plants.includes('Lavender') ? ['#a98be0', '#c2a6ef'] : b.plants.includes('Sunflowers') ? ['#f5c42c', '#f7d65a'] : /poppy/.test(path) ? ['#e2453c', '#f06a50'] : ['#f2d14a', '#e8645a', '#f4f0e6', '#c78be0', '#7fb6f0']
    for (let i = 0; i < times(field ? 120 : 34, spreadOf(W, H)); i++) {
      const x = rand() * W
      const y = rn.at(x) + 2 + rand() * (H - rn.at(x) - 3)
      const r = (1 + rand() * 1.1) * (0.6 + ((y - rn.at(x)) / (H - rn.at(x) + 1)) * 0.6)
      svg += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${palette[i % palette.length]}"/>`
    }
    if (field) for (let i = 0; i < times(40, spreadOf(W, H)); i++) {
      const x = rand() * W
      svg += `<circle cx="${f(x)}" cy="${f(rm.at(x) + 1 + rand() * 6)}" r=".7" fill="${mix(palette[i % palette.length], haze, 0.3)}"/>`
    }
  }
  if (b.plants.includes('Cacti')) for (let i = 0; i < times(3, spreadOf(W, H)); i++) {
    const x = W * (0.08 + rand() * 0.84)
    svg += TREES.cactus(x, rn.at(x) + 2, H * (0.12 + rand() * 0.1), '#5a8d3a', o)
  }
  if (b.plants.includes('Dead bushes')) for (let i = 0; i < times(3, spreadOf(W, H)); i++) {
    const x = rand() * W
    svg += TREES.dead(x, rn.at(x) + 3, H * 0.07, '', o)
  }
  if (b.plants.includes('Ice spikes')) for (let i = 0; i < 3; i++) {
    const x = W * (0.1 + rand() * 0.8)
    svg += TREES.crystal(x, rm.at(x) + 2, H * (0.25 + rand() * 0.2), '#d5e9f6', o)
  }
  if (b.plants.includes('Hot springs')) for (let i = 0; i < 2; i++) {
    const x = W * (0.15 + rand() * 0.7)
    const y = rn.at(x) + 6
    svg += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="12" ry="2.6" fill="#5fd0d8"/><g fill="#ffffff" opacity=".35"><circle cx="${f(x - 2)}" cy="${f(y - 8)}" r="4"/><circle cx="${f(x + 2)}" cy="${f(y - 16)}" r="5.5"/><circle cx="${f(x - 1)}" cy="${f(y - 26)}" r="7"/></g>`
  }
  if (cold && b.climate.precipitation) svg += flakes(rand, W, H, 30, '#ffffff')
  return { defs, svg }
}

// ---------------------------------------------------------------- the Nether

const NETHER = {
  'minecraft:nether_wastes': { sky: '#2b0a08', glow: '#ff6a1f', far: '#4a1715', near: '#6b2523', lava: true },
  'minecraft:crimson_forest': { sky: '#2a0606', glow: '#ff4a2a', far: '#4d0f12', near: '#8c1f1f', trees: 'crimson', cap: '#b0262c', motes: '#ff6a5a' },
  'minecraft:warped_forest': { sky: '#12061a', glow: '#3fd9c4', far: '#1f2b45', near: '#16656b', trees: 'crimson', cap: '#159a8f', motes: '#c48af0' },
  'minecraft:soul_sand_valley': { sky: '#0d2626', glow: '#45e0ea', far: '#253a3a', near: '#4c3a2f', bones: true, motes: '#9ff3f7' },
  'minecraft:basalt_deltas': { sky: '#2e2a33', glow: '#ff7a2a', far: '#3a3740', near: '#4a4a52', sharp: true, motes: '#ffffff' },
  'regions_unexplored:blackstone_basin': { sky: '#06091b', glow: '#535bf3', far: '#1c1a24', near: '#2b2830', sharp: true, motes: '#8f96ff' },
  'regions_unexplored:glistering_meadow': { sky: '#2a0842', glow: '#e64fd1', far: '#3d1458', near: '#5b2a6e', crystals: '#e9a8f5', motes: '#f3c6ff' },
  'regions_unexplored:infernal_holt': { sky: '#2a1209', glow: '#ff8a3a', far: '#4a2416', near: '#6f3a28', trees: 'crimson', cap: '#d4602a', motes: '#ffb36b' },
  'regions_unexplored:mycotoxic_undergrowth': { sky: '#2e280a', glow: '#d7c33a', far: '#4a4214', near: '#6a5e22', trees: 'mushroom', motes: '#e9df7a' }
}

function nether(b, id, W, H, rand) {
  const fog = b.colours.fog ?? '#330808'
  const p = NETHER[b.id] ?? { sky: dark(fog, 0.3), glow: mix(fog, '#ff7a1f', 0.6), far: mix(fog, '#4a1715', 0.5), near: mix(fog, '#6b2523', 0.5) }
  let defs = `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dark(p.sky, 0.4)}"/><stop offset=".75" stop-color="${mix(p.sky, p.glow, 0.35)}"/></linearGradient>`
  defs += `<radialGradient id="${id}-glow" cx=".5" cy="1" r=".75"><stop offset="0" stop-color="${p.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>`
  let svg = `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/><rect width="${W}" height="${H}" fill="url(#${id}-glow)"/>`
  // The Nether has a roof: a ragged ceiling of rock overhead.
  const ceiling = ridge(W, H, rand, { base: H * 0.06, amp: H * 0.16, n: 14, sharp: true, top: true })
  svg += `<path d="${ceiling.d}" fill="${dark(p.far, 0.45)}"/>`
  const rf = ridge(W, H, rand, { base: H * 0.66, amp: H * 0.22, n: p.sharp ? 9 : 5, sharp: p.sharp })
  const rn = ridge(W, H, rand, { base: H * 0.88, amp: H * 0.1, n: p.sharp ? 6 : 3, sharp: p.sharp })
  svg += `<path d="${rf.d}" fill="${p.far}"/>`
  if (p.lava) svg += `<rect y="${f(H * 0.8)}" width="${W}" height="${f(H * 0.2)}" fill="#ff7a1f" opacity=".85"/><rect y="${f(H * 0.8)}" width="${W}" height="1.5" fill="#ffd27a" opacity=".9"/>`
  const many = times(6, spreadOf(W, H))
  if (p.trees === 'crimson' || p.trees === 'mushroom') for (let i = 0; i < many; i++) {
    const x = ((i + rand() * 0.8) / many) * W
    svg += p.trees === 'crimson' ? TREES.crimson(x, rf.at(x) + 2, H * (0.16 + rand() * 0.08), mix(p.cap, p.sky, 0.3), { rand }) : TREES.mushroom(x, rf.at(x) + 2, H * (0.16 + rand() * 0.08), '', { rand })
  }
  svg += `<path d="${rn.d}" fill="${p.near}"/>`
  if (p.trees === 'crimson') for (let i = 0; i < times(2, spreadOf(W, H)); i++) {
    const x = W * (0.12 + rand() * 0.76)
    svg += TREES.crimson(x, rn.at(x) + 3, H * (0.34 + rand() * 0.1), p.cap, { rand })
  }
  if (p.bones) {
    // Great fossil arches, and soul fire burning blue.
    for (let i = 0; i < 2; i++) {
      const x = W * (0.12 + i * 0.45 + rand() * 0.2)
      const w = W * (0.16 + rand() * 0.1)
      const y = rf.at(x + w / 2) + 4
      const h = H * (0.22 + rand() * 0.12)
      svg += `<path d="M${f(x)},${f(y)} Q${f(x + w / 2)},${f(y - h * 1.6)} ${f(x + w)},${f(y)} M${f(x + w * 0.2)},${f(y)} Q${f(x + w / 2)},${f(y - h * 1.05)} ${f(x + w * 0.8)},${f(y)}" stroke="#e2dbc3" stroke-width="${f(h * 0.09)}" fill="none" opacity=".9"/>`
    }
    for (let i = 0; i < 5; i++) {
      const x = rand() * W
      const y = rn.at(x) + 3
      svg += `<circle cx="${f(x)}" cy="${f(y - 4)}" r="9" fill="${p.glow}" opacity=".18"/><path d="M${f(x)},${f(y)} c-2.6,-2.4 -2,-6 0,-9 c2,3 2.6,6.6 0,9 Z" fill="#7ff0f4"/>`
    }
  }
  if (p.sharp) for (let i = 0; i < times(7, spreadOf(W, H)); i++) {
    // Basalt columns.
    const x = rand() * W
    const w = W * (0.035 + rand() * 0.035)
    const top = rf.at(x) - H * (0.03 + rand() * 0.14)
    svg += `<rect x="${f(x)}" y="${f(top)}" width="${f(w)}" height="${f(H - top)}" fill="${mix(p.near, p.far, 0.4)}"/><rect x="${f(x + w * 0.6)}" y="${f(top)}" width="${f(w * 0.4)}" height="${f(H - top)}" fill="#000" opacity=".18"/><rect x="${f(x)}" y="${f(top)}" width="${f(w)}" height="1.6" fill="${light(p.near, 0.3)}"/>`
  }
  if (p.crystals) for (let i = 0; i < 4; i++) {
    const x = W * (0.08 + rand() * 0.84)
    svg += TREES.crystal(x, rn.at(x) + 3, H * (0.14 + rand() * 0.12), p.crystals, { rand })
  }
  if (p.motes) svg += flakes(rand, W, H, 24, p.motes, 0.8)
  return { defs, svg }
}

// ---------------------------------------------------------------- the End

function end(b, id, W, H, rand) {
  const path = b.id.split(':')[1]
  let defs = `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05030a"/><stop offset="1" stop-color="#1d1130"/></linearGradient>`
  const nx = W * (0.2 + rand() * 0.6)
  defs += `<radialGradient id="${id}-neb" cx="${f(nx / W)}" cy=".35" r=".6"><stop offset="0" stop-color="#6a3c9a" stop-opacity=".45"/><stop offset="1" stop-color="#6a3c9a" stop-opacity="0"/></radialGradient>`
  let svg = `<rect width="${W}" height="${H}" fill="url(#${id}-sky)"/><rect width="${W}" height="${H}" fill="url(#${id}-neb)"/>${flakes(rand, W, H, 46, '#ffffff', 0.55)}`
  const shadow = /shadow/.test(path)
  const top = shadow ? '#5a5560' : '#e1dea4'
  const under = shadow ? '#2b2830' : '#a6a26d'
  const island = (cx, cy, w, chorus, pillars) => {
    // A slab of end stone with a ragged underside, lit from above.
    const j = () => 0.8 + rand() * 0.4
    const pts = [[-0.5, 0], [-0.42, 0.1 * j()], [-0.3, 0.16 * j()], [-0.2, 0.3 * j()], [-0.06, 0.46 * j()], [0.06, 0.3 * j()], [0.16, 0.36 * j()], [0.3, 0.18 * j()], [0.42, 0.1 * j()], [0.5, 0]]
    let s = `<path d="M${pts.map(([x, y]) => `${f(cx + x * w)},${f(cy + y * w)}`).join(' L')} Z" fill="${under}"/>`
    s += `<path d="M${f(cx - w * 0.06)},${f(cy + w * 0.46)} L${f(cx + w * 0.06)},${f(cy + w * 0.3)} L${f(cx + w * 0.16)},${f(cy + w * 0.36)} L${f(cx + w * 0.3)},${f(cy + w * 0.18)} L${f(cx + w * 0.5)},${f(cy)} L${f(cx)},${f(cy)} Z" fill="#000" opacity=".18"/>`
    s += `<rect x="${f(cx - w / 2)}" y="${f(cy - w * 0.035)}" width="${f(w)}" height="${f(w * 0.05)}" rx="${f(w * 0.02)}" fill="${top}"/>`
    for (let i = 0; i < pillars; i++) {
      const x = cx - w * 0.35 + (i / Math.max(1, pillars - 1)) * w * 0.7
      const h = w * (0.25 + rand() * 0.2)
      s += `<rect x="${f(x - w * 0.025)}" y="${f(cy - h)}" width="${f(w * 0.05)}" height="${f(h)}" fill="#1a1124"/><rect x="${f(x - w * 0.012)}" y="${f(cy - h - w * 0.03)}" width="${f(w * 0.024)}" height="${f(w * 0.024)}" fill="#f3b8ff"/>`
    }
    for (let i = 0; i < chorus; i++) {
      const x = cx - w * 0.35 + rand() * w * 0.7
      s += TREES.chorus(x, cy, w * (0.18 + rand() * 0.1), '', { rand })
    }
    if (/crystal/.test(path)) for (let i = 0; i < 3; i++) s += TREES.crystal(cx - w * 0.3 + rand() * w * 0.6, cy + 1, w * (0.2 + rand() * 0.2), '#a98ff0', { rand })
    return s
  }
  // Sized by the picture's height, so a wide banner gets more islands rather than bigger ones.
  const U = Math.min(W, (H * 320) / 180)
  if (path === 'the_end') svg += island(W * 0.5, H * 0.66, U * 0.85, 0, 4)
  else {
    const n = times(path === 'small_end_islands' || /void|barren/.test(path) ? 4 : 2, spreadOf(W, H))
    const chorus = path === 'end_highlands' ? 3 : path === 'end_midlands' ? 1 : 0
    for (let i = 0; i < n; i++) {
      const w = n > times(2, spreadOf(W, H)) ? U * (0.12 + rand() * 0.12) : U * (0.32 + rand() * 0.25)
      svg += island(((i + 0.5) / n) * W + (rand() - 0.5) * W * 0.08, H * (0.45 + rand() * 0.3), w, chorus, 0)
    }
  }
  return { defs, svg }
}

// ---------------------------------------------------------------- caves

/** Each cave's rock, its light and the things that grow in it. */
function cavePalette(b) {
  const p = b.id.split(':')[1]
  const has = (x) => b.plants.includes(x)
  if (p === 'deep_dark') return { rock: '#11191c', far: '#0b1113', glow: '#2ad7d7', floor: '#0c3036', dots: '#36e0e0' }
  if (p === 'lush_caves') return { rock: '#2c3326', far: '#1d2219', glow: '#9ad35a', floor: '#5d8f33', vines: '#4f7d2a', berries: '#ffb04a', blossom: '#e88bc0' }
  if (has('Dripstone') && !has('Ice')) return { rock: '#4d3d31', far: '#2f261f', glow: '#e0b27a', drips: '#8b6b52', water: b.colours.water ?? '#3f76e4', floor: '#5a4738' }
  if (has('Redstone crystals')) return { rock: '#2e2222', far: '#1e1616', glow: '#ff4a3a', crystals: '#e2392c', floor: '#3b2a2a' }
  if (has('Prismarite crystals')) return { rock: '#1f3136', far: '#142226', glow: '#7fe7df', crystals: '#79e3d6', floor: '#2a4246' }
  if (has('Bioshrooms')) return { rock: '#22262c', far: '#15181d', glow: '#55d1f0', shrooms: ['#55d1f0', '#a7e86a', '#f08ad3'], floor: '#2c3a2f' }
  if (has('Ash vents') || has('Magma')) return { rock: '#2a2526', far: '#1b1718', glow: '#ff6a1a', lava: true, floor: '#3f3d44' }
  if (has('Ice')) return { rock: '#5d7d93', far: '#3c5566', glow: '#bfe3f5', crystals: '#d8eef9', floor: '#a9cde0', lava: has('Dripstone') }
  if (has('Sulfur spikes')) return { rock: '#3a3626', far: '#26231a', glow: '#e6d55a', crystals: '#d8c64a', floor: '#4b4630' }
  if (has('Mushrooms')) return { rock: '#2f2a26', far: '#1e1a17', glow: '#c9a66b', shrooms: ['#c75b3f', '#d6b68b'], floor: '#4b3d33' }
  if (has('Jungle plants')) return { rock: '#2a3123', far: '#1a2016', glow: '#8fd35a', vines: '#4f8f2f', floor: '#5b4636' }
  if (has('Calcite pools')) return { rock: '#4a4a46', far: '#2f2f2c', glow: '#f2f0d0', water: '#5aa0d8', floor: '#d9d8cf' }
  if (has('Cobwebs')) return { rock: '#3a3a3c', far: '#252527', glow: '#b8b8c8', webs: true, floor: '#454547' }
  const stone = /andesite/.test(p) ? '#6e7072' : /diorite/.test(p) ? '#a4a4a1' : /granite/.test(p) ? '#8a5e50' : /tuff/.test(p) ? '#5f6058' : /deep/.test(p) ? '#3b3b42' : '#57524c'
  return { rock: stone, far: dark(stone, 0.4), glow: '#d9c7a0', floor: dark(stone, 0.15) }
}

function cave(b, id, W, H, rand) {
  const p = cavePalette(b)
  let defs = `<radialGradient id="${id}-glow" cx=".5" cy=".7" r=".7"><stop offset="0" stop-color="${p.glow}" stop-opacity=".42"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>`
  let svg = `<rect width="${W}" height="${H}" fill="${dark(p.far, 0.35)}"/><rect width="${W}" height="${H}" fill="url(#${id}-glow)"/>`
  const backTop = ridge(W, H, rand, { base: H * 0.18, amp: H * 0.22, n: 16, sharp: true, top: true })
  const backFloor = ridge(W, H, rand, { base: H * 0.8, amp: H * 0.18, n: 12, sharp: true })
  svg += `<path d="${backTop.d}" fill="${p.far}"/><path d="${backFloor.d}" fill="${p.far}"/>`
  // Stalactites and stalagmites in front.
  const spikes = (fromTop) => {
    let d = ''
    const n = times(9, spreadOf(W, H))
    for (let i = 0; i < n; i++) {
      const x = ((i + rand()) / n) * W
      const w = W * (0.02 + rand() * 0.035)
      const h = H * (0.08 + rand() * (p.drips ? 0.28 : 0.16))
      d += fromTop ? `M${f(x - w)},0 L${f(x)},${f(h)} L${f(x + w)},0 Z ` : `M${f(x - w)},${H} L${f(x)},${f(H - h)} L${f(x + w)},${H} Z `
    }
    return d
  }
  const ceiling = ridge(W, H, rand, { base: H * 0.04, amp: H * 0.1, n: 10, top: true })
  const floor = ridge(W, H, rand, { base: H * 0.94, amp: H * 0.1, n: 6 })
  svg += `<path d="${ceiling.d}" fill="${p.rock}"/><path d="${spikes(true)}" fill="${p.drips ?? p.rock}"/>`
  if (p.water) svg += `<ellipse cx="${f(W * (0.3 + rand() * 0.4))}" cy="${f(H * 0.86)}" rx="${f(W * 0.22)}" ry="${f(H * 0.04)}" fill="${p.water}" opacity=".75"/>`
  if (p.lava) svg += `<rect y="${f(H * 0.86)}" width="${W}" height="${f(H * 0.14)}" fill="#ff6a1a" opacity=".85"/>`
  svg += `<path d="${floor.d}" fill="${p.floor}"/><path d="${spikes(false)}" fill="${p.drips ?? dark(p.floor, 0.1)}"/>`
  if (p.vines) for (let i = 0; i < times(9, spreadOf(W, H)); i++) {
    const x = rand() * W
    const len = H * (0.12 + rand() * 0.3)
    svg += `<path d="M${f(x)},${f(ceiling.at(x))} v${f(len)}" stroke="${p.vines}" stroke-width="1.4"/>`
    if (p.berries) svg += `<circle cx="${f(x)}" cy="${f(ceiling.at(x) + len * 0.6)}" r="1.6" fill="${p.berries}"/><circle cx="${f(x)}" cy="${f(ceiling.at(x) + len)}" r="1.8" fill="${p.berries}"/>`
  }
  if (p.blossom) for (let i = 0; i < 2; i++) {
    const x = W * (0.2 + rand() * 0.6)
    svg += `<circle cx="${f(x)}" cy="${f(ceiling.at(x) + 3)}" r="4.5" fill="${p.blossom}"/><circle cx="${f(x)}" cy="${f(ceiling.at(x) + 3)}" r="1.8" fill="#ffd6ea"/>`
  }
  if (p.dots) for (let i = 0; i < times(40, spreadOf(W, H)); i++) {
    const x = rand() * W
    svg += `<circle cx="${f(x)}" cy="${f(floor.at(x) + rand() * (H - floor.at(x)))}" r="${f(0.6 + rand())}" fill="${p.dots}" opacity="${f(0.4 + rand() * 0.6)}"/>`
  }
  if (p.crystals) for (let i = 0; i < times(6, spreadOf(W, H)); i++) {
    const x = W * (0.05 + rand() * 0.9)
    svg += TREES.crystal(x, floor.at(x) + 3, H * (0.1 + rand() * 0.16), p.crystals, { rand })
  }
  if (p.shrooms) for (let i = 0; i < times(5, spreadOf(W, H)); i++) {
    const x = W * (0.06 + rand() * 0.88)
    const h = H * (0.1 + rand() * 0.14)
    const c = p.shrooms[i % p.shrooms.length]
    svg += `<rect x="${f(x - h * 0.06)}" y="${f(floor.at(x) - h * 0.7)}" width="${f(h * 0.12)}" height="${f(h * 0.72)}" fill="#d8cdb8"/><ellipse cx="${f(x)}" cy="${f(floor.at(x) - h * 0.7)}" rx="${f(h * 0.38)}" ry="${f(h * 0.16)}" fill="${c}"/>`
  }
  if (p.webs) for (let i = 0; i < 3; i++) {
    const x = rand() * W
    const y = ceiling.at(x) + 2
    svg += `<path d="M${f(x)},${f(y)} l14,10 M${f(x)},${f(y)} l-12,12 M${f(x)},${f(y)} l2,16 M${f(x - 7)},${f(y + 7)} q8,-1 13,-2" stroke="#e8e8ef" stroke-width=".6" opacity=".6" fill="none"/>`
  }
  return { defs, svg }
}

// ---------------------------------------------------------------- out

/** A biome's picture as an inline SVG, w by h (it covers its box, cropping like a photo would). */
export function scene(b, { w = 320, h = 180, prefix = '' } = {}) {
  const id = `sc-${prefix}${b.id.replace(/[^a-z0-9]+/gi, '-')}`
  const rand = seeded(b.id)
  const painter = b.dimension === 'nether' ? nether : b.dimension === 'end' ? end : b.category === 'caves' ? cave : overworld
  const { defs, svg } = painter(b, id, w, h, rand)
  return `<svg class="scene" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${b.name.replace(/"/g, '&quot;')}, painted from its colours"><defs>${defs}</defs>${svg}</svg>`
}
