// Draws each built chapter as an SVG (quests, dependency lines, crest and info card) so layout changes
// can be checked without starting Minecraft. Used by `node quests/build.mjs --preview`, which writes
// quests/preview/<chapter>.svg. Text is approximated with a monospace font, so line widths are close to,
// not exactly, what FTB draws.

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const SCALE = 48 // pixels per quest-map unit
const IMAGE_SCALE = 6 / 7 // FTB draws images at 6/7 of their nominal size (see quests/build.mjs)
const COLOURS = { 0: '#000000', 1: '#0000aa', 2: '#00aa00', 3: '#00aaaa', 4: '#aa0000', 5: '#aa00aa', 6: '#ffaa00', 7: '#aaaaaa', 8: '#555555', 9: '#5555ff', a: '#55ff55', b: '#55ffff', c: '#ff5555', d: '#ff55ff', e: '#ffff55', f: '#ffffff' }

const num = (v) => (typeof v === 'object' && v?.__snbt ? parseFloat(v.__snbt) : Number(v ?? 0))
const escape = (s) => String(s).replace(/&(?![0-9a-fk-or])/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const plain = (s) => String(s ?? '').replace(/&[0-9a-fk-or]/gi, '')

/** One line of FTB text with & codes as SVG tspans. */
function styledLine(line) {
  const parts = []
  let colour = '#ffffff'
  let bold = false
  for (const chunk of line.split(/(&[0-9a-fk-or])/i)) {
    const code = /^&([0-9a-fk-or])$/i.exec(chunk)?.[1]?.toLowerCase()
    if (code) {
      if (code in COLOURS) {
        colour = COLOURS[code]
        bold = false
      } else if (code === 'l') bold = true
      else if (code === 'r') {
        colour = '#ffffff'
        bold = false
      }
      continue
    }
    if (chunk) parts.push(`<tspan fill="${colour}"${bold ? ' font-weight="bold"' : ''}>${escape(chunk).replace(/&amp;/g, '&amp;')}</tspan>`)
  }
  return parts.join('')
}

export function chapterSvg(chapter, lang, textureDir) {
  const quests = chapter.quests
  const images = chapter.images ?? []
  const boxes = [
    ...quests.map((q) => [num(q.x), num(q.y), num(q.size ?? 1), num(q.size ?? 1)]),
    ...images.map((i) => [num(i.x), num(i.y), num(i.width), num(i.height)])
  ]
  const minX = Math.min(...boxes.map(([x, , w]) => x - w / 2)) - 1
  const minY = Math.min(...boxes.map(([, y, , h]) => y - h / 2)) - 1
  const maxX = Math.max(...boxes.map(([x, , w]) => x + w / 2)) + 1
  const maxY = Math.max(...boxes.map(([, y, , h]) => y + h / 2)) + 1.4
  const px = (v, min) => ((v - min) * SCALE).toFixed(1)
  const X = (v) => px(v, minX)
  const Y = (v) => px(v, minY)
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="${((maxX - minX) * SCALE).toFixed(0)}" height="${((maxY - minY) * SCALE).toFixed(0)}">`,
    `<rect width="100%" height="100%" fill="#23262d"/>`
  ]

  for (const image of images) {
    const w = num(image.width) * SCALE * IMAGE_SCALE
    const h = num(image.height) * SCALE * IMAGE_SCALE
    const x = Number(X(num(image.x))) - w / 2
    const y = Number(Y(num(image.y))) - h / 2
    const file = path.join(textureDir, `${String(image.image).split('/').pop()}`)
    if (image.text_on_image) {
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0c0e14" fill-opacity="0.74"/>`)
      const lines = String(lang[`image.${image.id}.title`] ?? '').split('\\n')
      const inset = (num(image.text_inset) / 100) * w
      const lineHeight = (h * (1 - (2 * num(image.text_inset)) / 100)) / lines.length
      lines.forEach((line, i) => {
        out.push(`<text x="${x + inset}" y="${y + (num(image.text_inset) / 100) * h + lineHeight * (i + 0.8)}" font-family="Consolas, monospace" font-size="${(lineHeight * 0.8).toFixed(1)}">${styledLine(line)}</text>`)
      })
    } else if (existsSync(file)) {
      out.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${readFileSync(file).toString('base64')}"/>`)
    }
  }

  const byId = new Map(quests.map((q) => [q.id, q]))
  for (const q of quests) {
    for (const dep of q.dependencies ?? []) {
      const d = byId.get(dep)
      if (d) out.push(`<line x1="${X(num(d.x))}" y1="${Y(num(d.y))}" x2="${X(num(q.x))}" y2="${Y(num(q.y))}" stroke="#b08a5a" stroke-width="3" stroke-opacity="0.85"/>`)
    }
  }
  for (const q of quests) {
    const r = num(q.size ?? 1) * SCALE * 0.42
    const cx = X(num(q.x))
    const cy = Y(num(q.y))
    const gear = q.shape === 'gear'
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#3b4049" stroke="${gear ? '#d8b56a' : '#8a8f99'}" stroke-width="${gear ? 4 : 2}"${gear ? ' stroke-dasharray="6 3"' : ''}/>`)
    const title = plain(lang[`quest.${q.id}.title`] ?? q.id)
    out.push(`<text x="${cx}" y="${(Number(cy) + r + 13).toFixed(1)}" font-family="Segoe UI, sans-serif" font-size="11" fill="#e6e6e6" text-anchor="middle">${escape(title)}</text>`)
  }
  out.push('</svg>')
  return out.join('\n')
}
