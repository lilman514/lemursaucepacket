// Scan every server mod jar (and nested jarjar jars): mod ids, item ids (lang + item models), recipes, item/block tags.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire('C:/Create+Modpack/package.json')
const { unzipSync } = require('fflate')

const SP = 'C:/Users/Shawn/AppData/Local/Temp/claude/C--Create-Modpack/ab1859ba-46fb-401e-9816-544fdbbd5524/scratchpad'
const modsDir = path.join(SP, 'server-test', 'mods')
const out = { jars: {}, lang: {}, models: {}, recipes: {}, itemTags: {}, blockTags: {} }
const dec = new TextDecoder()
const parseJson = (buf) => { try { return JSON.parse(dec.decode(buf).replace(/^\uFEFF/, '')) } catch { try { return JSON.parse(dec.decode(buf).replace(/\/\/[^\n]*\n/g, '\n')) } catch { return null } } }

function scan(name, buf, parent) {
  let entries
  try {
    entries = unzipSync(buf, {
      filter: (f) =>
        f.name === 'META-INF/neoforge.mods.toml' || f.name === 'META-INF/mods.toml' ||
        /^META-INF\/jarjar\/.+\.jar$/.test(f.name) ||
        /^assets\/[^/]+\/lang\/en_us\.json$/.test(f.name) ||
        /^assets\/[^/]+\/models\/item\/.+\.json$/.test(f.name) ||
        /^data\/[^/]+\/recipes?\/.+\.json$/.test(f.name) ||
        /^data\/[^/]+\/tags\/(item|items|block|blocks)\/.+\.json$/.test(f.name)
    })
  } catch (e) { console.error('fail', name, e.message); return }
  const jar = { parent, modIds: [], namespaces: new Set() }
  out.jars[name] = jar
  for (const [p, data] of Object.entries(entries)) {
    let m
    if (p.endsWith('mods.toml')) {
      const t = dec.decode(data)
      for (const mm of t.matchAll(/modId\s*=\s*"([^"]+)"/g)) jar.modIds.push(mm[1])
      const dn = [...t.matchAll(/displayName\s*=\s*"([^"]+)"/g)].map((x) => x[1])
      jar.displayNames = dn
    } else if (p.startsWith('META-INF/jarjar/')) {
      scan(name + '!' + path.basename(p), data, name)
    } else if ((m = /^assets\/([^/]+)\/lang\/en_us\.json$/.exec(p))) {
      const j = parseJson(data)
      if (!j) continue
      jar.namespaces.add(m[1])
      for (const [k, v] of Object.entries(j)) {
        const it = /^(item|block)\.([a-z0-9_.-]+)\.([a-z0-9_/.-]+)$/.exec(k)
        if (it && it[2] === m[1]) (out.lang[`${it[2]}:${it[3]}`] ??= { kind: it[1], name: v, jar: name })
      }
    } else if ((m = /^assets\/([^/]+)\/models\/item\/(.+)\.json$/.exec(p))) {
      jar.namespaces.add(m[1])
      out.models[`${m[1]}:${m[2]}`] ??= name
    } else if ((m = /^data\/([^/]+)\/recipes?\/(.+)\.json$/.exec(p))) {
      const j = parseJson(data)
      if (j) out.recipes[`${m[1]}:${m[2]}`] = { jar: name, ...j }
    } else if ((m = /^data\/([^/]+)\/tags\/(item|items|block|blocks)\/(.+)\.json$/.exec(p))) {
      const j = parseJson(data)
      if (!j) continue
      const bucket = m[2].startsWith('item') ? out.itemTags : out.blockTags
      const tag = `${m[1]}:${m[3]}`
      const vals = (j.values || []).map((v) => (typeof v === 'string' ? v : v.id))
      ;(bucket[tag] ??= { values: [], jars: [] })
      bucket[tag].values.push(...vals)
      bucket[tag].jars.push(name)
    }
  }
  jar.namespaces = [...jar.namespaces]
}

for (const f of readdirSync(modsDir).filter((f) => f.endsWith('.jar'))) scan(f, readFileSync(path.join(modsDir, f)), null)
writeFileSync(path.join(SP, 'prog', 'jarscan.json'), JSON.stringify(out))
console.log('jars', Object.keys(out.jars).length, 'lang items', Object.keys(out.lang).length, 'models', Object.keys(out.models).length, 'recipes', Object.keys(out.recipes).length, 'itemTags', Object.keys(out.itemTags).length)
