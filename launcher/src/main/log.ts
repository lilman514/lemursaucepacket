import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import path from 'node:path'

let logFile: string | null = null

/** Log to <userData>/logs/launcher.log (rotated at 2 MB) and stdout. Never pass tokens in here. */
export function initLog(dir: string): string {
  mkdirSync(dir, { recursive: true })
  logFile = path.join(dir, 'launcher.log')
  try {
    if (statSync(logFile).size > 2 * 1024 * 1024) renameSync(logFile, path.join(dir, 'launcher.old.log'))
  } catch {
    // first run
  }
  return logFile
}

export function log(...parts: unknown[]): void {
  const text = parts
    .map((p) => (p instanceof Error ? (p.stack ?? p.message) : typeof p === 'string' ? p : JSON.stringify(p)))
    .join(' ')
  const line = `[${new Date().toISOString()}] ${text}`
  console.log(line)
  if (logFile) {
    try {
      appendFileSync(logFile, line + '\n')
    } catch {
      // disk full or locked; nothing useful to do
    }
  }
}
