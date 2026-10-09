// GET /api/hiscores: every player's last record and the totals, for play.limas.ca/hiscores to rank (the page works the
// tables out itself: a few dozen players is nothing). Kept light on Neon's free plan (100 CU-hours a month, asleep after
// 5 idle minutes): Vercel's edge keeps the answer for half an hour, as long as the game server waits between uploads
// (hiscores/hiscores.mjs UPLOAD_EVERY), and serves the old one while it fetches a new, so a busy page wakes the database
// at most twice an hour. Reading creates nothing: the tables appear with the first upload, and until then the board is
// empty.
import { db } from './_hiscores-db.js'

const CACHE = 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400'

export async function GET() {
  try {
    const sql = db()
    const players = await sql`select record from hiscores_players order by seen desc`
    const meta = await sql`select key, value, updated_at from hiscores_meta`
    const totals = meta.find((m) => m.key === 'totals')?.value ?? {}
    const uploaded = meta.find((m) => m.key === 'uploaded')?.value ?? null
    return Response.json({ uploaded, totals, players: players.map((p) => p.record) }, { headers: { 'Cache-Control': CACHE } })
  } catch (err) {
    // No upload yet: no tables (Postgres' "undefined table").
    if (err?.code === '42P01') return Response.json({ uploaded: null, totals: {}, players: [] }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } })
    console.error('hiscores read failed', err)
    return Response.json({ error: 'The hiscores are not available right now.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
