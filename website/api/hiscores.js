// GET /api/hiscores: every player's last record and the totals, for play.limas.ca/hiscores to rank (the page works the
// tables out itself: a few dozen players is nothing). Cached at Vercel's edge for a couple of minutes, so a busy page
// costs one database read every two minutes; the game server uploads every ten anyway.
import { db, ensureTables } from './_hiscores-db.js'

export async function GET() {
  try {
    const sql = db()
    await ensureTables(sql)
    const players = await sql`select record from hiscores_players order by seen desc`
    const meta = await sql`select key, value, updated_at from hiscores_meta`
    const totals = meta.find((m) => m.key === 'totals')?.value ?? {}
    const uploaded = meta.find((m) => m.key === 'uploaded')?.value ?? null
    return Response.json(
      { uploaded, totals, players: players.map((p) => p.record) },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=600' } }
    )
  } catch (err) {
    console.error('hiscores read failed', err)
    return Response.json({ error: 'The hiscores are not available right now.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
