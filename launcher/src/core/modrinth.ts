// Pulls names, icons and descriptions for the mod list from Modrinth, looked up by file hash.

import { getJson, postJson } from './http'

const API = 'https://api.modrinth.com/v2'

export interface ModMeta {
  projectId: string
  slug: string
  title: string
  description: string
  iconUrl?: string
  versionNumber?: string
}

interface VersionFile {
  project_id: string
  version_number: string
}

interface Project {
  id: string
  slug: string
  title: string
  description: string
  icon_url: string | null
}

/** Returns metadata keyed by sha1. Hashes Modrinth doesn't know are simply absent. */
export async function lookupBySha1(hashes: string[]): Promise<Record<string, ModMeta>> {
  const out: Record<string, ModMeta> = {}
  if (hashes.length === 0) return out
  const versions = await postJson<Record<string, VersionFile>>(`${API}/version_files`, { hashes, algorithm: 'sha1' })
  const projectIds = [...new Set(Object.values(versions).map((v) => v.project_id))]
  const projects = new Map<string, Project>()
  for (let i = 0; i < projectIds.length; i += 100) {
    const chunk = projectIds.slice(i, i + 100)
    const list = await getJson<Project[]>(`${API}/projects?ids=${encodeURIComponent(JSON.stringify(chunk))}`)
    for (const p of list) projects.set(p.id, p)
  }
  for (const [sha1, version] of Object.entries(versions)) {
    const project = projects.get(version.project_id)
    if (!project) continue
    out[sha1] = {
      projectId: project.id,
      slug: project.slug,
      title: project.title,
      description: project.description,
      iconUrl: project.icon_url ?? undefined,
      versionNumber: version.version_number
    }
  }
  return out
}
