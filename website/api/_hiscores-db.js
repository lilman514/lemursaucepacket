// The hiscores' Neon database (Vercel's Neon integration sets DATABASE_URL). Two tables: each player's last record from
// the game server (what the page ranks), and a few values about them all (the totals collections are out of).
// Files starting with _ aren't routes: this is shared by api/hiscores.js and api/hiscores-ingest.js.
import { neon } from '@neondatabase/serverless'

export function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) throw new Error('No DATABASE_URL: connect the Neon database to this Vercel project')
  return neon(url)
}

export async function ensureTables(sql) {
  await sql`create table if not exists hiscores_players (
    uuid text primary key,
    name text not null,
    seen bigint not null,
    record jsonb not null,
    updated_at timestamptz not null default now()
  )`
  await sql`create table if not exists hiscores_meta (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now()
  )`
}
