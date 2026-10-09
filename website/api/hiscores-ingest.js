// POST /api/hiscores-ingest: the game server's records (lsp_fixes hiscores package, every half hour while anyone plays,
// and on shutdown; hiscores/hiscores.mjs UPLOAD_EVERY keeps it there for Neon's free plan).
// Each upload is signed with the server's own Ed25519 key (made in game by /lsp hiscores keygen, kept on the server); only
// the public half is here, so nothing secret lives in this project. A signature older than fifteen minutes is refused,
// and a record never replaces a newer one.
import { createPublicKey, verify } from 'node:crypto'
import { db, ensureTables } from './_hiscores-db.js'

// The game servers allowed to upload: the public key /lsp hiscores keygen printed (also in the server's
// config/lemursaucepacket/hiscores-public.key). More can be added in HISCORES_KEYS, comma-separated.
const SERVER_KEYS = [
  // mc.limas.ca (C:\LemurSaucePacket-Server), made 2026-10-07
  'MCowBQYDK2VwAyEALS2KLJ6ZJiBtMyJLOGLCmZZRyy0kmbu7HmcV0KfJqrc='
]
const MAX_SKEW = 15 * 60 * 1000
const MAX_BODY = 4 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const NAME = /^[A-Za-z0-9_]{1,16}$/

const keys = () =>
  [...SERVER_KEYS, ...(process.env.HISCORES_KEYS || '').split(',')]
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => createPublicKey({ key: Buffer.from(k, 'base64'), format: 'der', type: 'spki' }))

function signedBy(text, time, signature) {
  const message = Buffer.from(`${time}\n${text}`, 'utf8')
  const sig = Buffer.from(signature, 'base64')
  return keys().some((key) => {
    try {
      return verify(null, message, key, sig)
    } catch {
      return false
    }
  })
}

export async function POST(request) {
  const time = Number(request.headers.get('x-hiscores-time'))
  const signature = request.headers.get('x-hiscores-signature') || ''
  const text = await request.text()
  if (text.length > MAX_BODY) return Response.json({ error: 'too big' }, { status: 413 })
  if (!Number.isFinite(time) || Math.abs(Date.now() - time) > MAX_SKEW) return Response.json({ error: 'stale or missing time' }, { status: 401 })
  if (!signature || !signedBy(text, time, signature)) return Response.json({ error: 'bad signature' }, { status: 401 })

  let body
  try {
    body = JSON.parse(text)
  } catch {
    return Response.json({ error: 'not JSON' }, { status: 400 })
  }
  const players = Array.isArray(body.players) ? body.players : []
  const valid = players.filter((p) => p && UUID.test(String(p.uuid)) && NAME.test(String(p.name)) && Number.isFinite(Number(p.seen)) && p.skills && typeof p.skills === 'object')
  if (valid.length > 1000) return Response.json({ error: 'too many players' }, { status: 413 })

  try {
    const sql = db()
    await ensureTables(sql)
    const writes = valid.map(
      (p) => sql`insert into hiscores_players (uuid, name, seen, record)
        values (${p.uuid}, ${p.name}, ${Number(p.seen)}, ${JSON.stringify(p)}::jsonb)
        on conflict (uuid) do update set name = excluded.name, seen = excluded.seen, record = excluded.record, updated_at = now()
        where hiscores_players.seen <= excluded.seen`
    )
    if (body.totals && typeof body.totals === 'object') {
      writes.push(sql`insert into hiscores_meta (key, value) values ('totals', ${JSON.stringify(body.totals)}::jsonb)
        on conflict (key) do update set value = excluded.value, updated_at = now()`)
    }
    writes.push(sql`insert into hiscores_meta (key, value) values ('uploaded', ${JSON.stringify(time)}::jsonb)
      on conflict (key) do update set value = excluded.value, updated_at = now()`)
    await sql.transaction(writes)
    return Response.json({ ok: true, players: valid.length, skipped: players.length - valid.length })
  } catch (err) {
    console.error('hiscores ingest failed', err)
    return Response.json({ error: 'database' }, { status: 500 })
  }
}
