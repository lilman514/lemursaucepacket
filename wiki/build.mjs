#!/usr/bin/env node
// Writes each atlas region in docs/ as plain markdown, from wiki/atlas.json: a table of the biomes, creatures or
// structures it lists, for GitBook and the in-game guide book (publish/patchouli.mjs reads docs/). The wiki itself
// (publish/docs.mjs) replaces every region with its cards. publish.mjs runs this; so can CI, as atlas.json is
// committed (wiki/atlas.mjs, which reads the jars, runs locally).
//
//   <!-- atlas:biomes:forests -->
//   ...written here...
//   <!-- /atlas -->

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { markdownRegion } from './render.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const NL = String.fromCharCode(10)

let regions = 0
let changed = 0
for (const file of readdirSync(docsDir).filter((f) => f.endsWith('.md'))) {
  const full = path.join(docsDir, file)
  const before = readFileSync(full, 'utf8')
  const after = before.replace(/(<!-- atlas:(\w+):([\w-]+) -->)[\s\S]*?(<!-- \/atlas -->)/g, (_, open, kind, filter, close) => {
    regions++
    const body = markdownRegion(kind, filter)
    return body ? [open, '', body, '', close].join(NL) : [open, close].join(NL)
  })
  if (after !== before) {
    writeFileSync(full, after)
    changed++
  }
}
console.log(`atlas: ${regions} regions in docs/ written from wiki/atlas.json${changed ? ` (${changed} pages changed)` : ''}`)
