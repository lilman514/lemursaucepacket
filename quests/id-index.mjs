// Builds an index of every item, entity, biome and structure id in a set of mod jars plus the vanilla
// client jar, so quest and script ids can be validated without launching the game.
//   node quests/id-index.mjs <mods folder> <vanilla client jar> [out.json]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { unzipSync } from 'fflate'

const [modsDir, vanillaJar, out = 'quests/.id-index.json'] = process.argv.slice(2)
const index = { item: new Set(), entity: new Set(), biome: new Set(), structure: new Set(), biomeTag: new Set(), structureTag: new Set(), advancement: new Set() }
const add = (kind, id) => index[kind].add(id)

function scan(jarPath) {
  let entries
  try {
    entries = unzipSync(readFileSync(jarPath), {
      filter: (f) =>
        /^assets\/[^/]+\/(models\/item\/[^/]+\.json|lang\/en_us\.json)$/.test(f.name) ||
        /^data\/[^/]+\/(worldgen\/(biome|structure)\/.+\.json|tags\/worldgen\/(biome|structure)\/.+\.json|advancement\/.+\.json)$/.test(f.name) ||
        /^META-INF\/jarjar\/.+\.jar$/.test(f.name)
    })
  } catch {
    return
  }
  for (const [name, data] of Object.entries(entries)) {
    let m
    if ((m = /^assets\/([^/]+)\/models\/item\/([^/]+)\.json$/.exec(name))) add('item', `${m[1]}:${m[2]}`)
    else if ((m = /^assets\/([^/]+)\/lang\/en_us\.json$/.exec(name))) {
      try {
        for (const key of Object.keys(JSON.parse(new TextDecoder().decode(data)))) {
          const e = /^entity\.([a-z0-9_.-]+)\.([a-z0-9_/.-]+)$/.exec(key)
          if (e) add('entity', `${e[1]}:${e[2]}`)
          const it = /^(?:item|block)\.([a-z0-9_.-]+)\.([a-z0-9_/-]+)$/.exec(key)
          if (it) add('item', `${it[1]}:${it[2]}`)
        }
      } catch {
        // some lang files have comments; skip
      }
    } else if ((m = /^data\/([^/]+)\/worldgen\/biome\/(.+)\.json$/.exec(name))) add('biome', `${m[1]}:${m[2]}`)
    else if ((m = /^data\/([^/]+)\/worldgen\/structure\/(.+)\.json$/.exec(name))) add('structure', `${m[1]}:${m[2]}`)
    else if ((m = /^data\/([^/]+)\/tags\/worldgen\/biome\/(.+)\.json$/.exec(name))) add('biomeTag', `#${m[1]}:${m[2]}`)
    else if ((m = /^data\/([^/]+)\/tags\/worldgen\/structure\/(.+)\.json$/.exec(name))) add('structureTag', `#${m[1]}:${m[2]}`)
    else if ((m = /^data\/([^/]+)\/advancement\/(.+)\.json$/.exec(name))) add('advancement', `${m[1]}:${m[2]}`)
    else if (name.startsWith('META-INF/jarjar/')) {
      // Nested library jars can register content too.
      const tmp = path.join(path.dirname(out), '.nested.jar')
      writeFileSync(tmp, data)
      scan(tmp)
    }
  }
}

for (const f of readdirSync(modsDir).filter((f) => f.endsWith('.jar'))) scan(path.join(modsDir, f))
scan(vanillaJar)
const json = Object.fromEntries(Object.entries(index).map(([k, v]) => [k, [...v].sort()]))
writeFileSync(out, JSON.stringify(json))
console.log(Object.entries(json).map(([k, v]) => `${k}: ${v.length}`).join(', '))
