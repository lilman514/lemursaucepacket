export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`
}

export function formatMemory(mb: number): string {
  return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
}

export function formatDate(value?: string): string {
  if (!value) return ''
  // "2026-09-27" is a calendar date; parsing it as UTC would show the previous day west of Greenwich.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const d = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const LOADERS: Record<string, string> = { neoforge: 'NeoForge', forge: 'Forge', fabric: 'Fabric', quilt: 'Quilt', vanilla: 'Vanilla' }

export function loaderName(id?: string): string {
  return id ? (LOADERS[id] ?? id) : ''
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
