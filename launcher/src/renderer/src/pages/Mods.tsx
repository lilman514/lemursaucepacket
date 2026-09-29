import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { ModEntry, Settings, ToastMessage } from '../../../shared/types'
import { errorMessage, formatBytes } from '../format'
import { BoxIcon, ExternalIcon, SearchIcon } from '../icons'

interface Props {
  settings: Settings
  onSettings: (s: Settings) => void
  onToast: (t: ToastMessage) => void
}

type Filter = 'all' | 'optional'

export function ModsPage({ settings, onSettings, onToast }: Props): ReactElement {
  const [mods, setMods] = useState<ModEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let alive = true
    window.launcher
      .getMods()
      .then((m) => alive && setMods(m))
      .catch((e) => {
        if (!alive) return
        setMods([])
        onToast({ kind: 'error', text: errorMessage(e) })
      })
    return () => {
      alive = false
    }
  }, [onToast])

  const isEnabled = (m: ModEntry): boolean => !m.optional || (settings.optionalChoices[m.key] ?? m.defaultEnabled)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (mods ?? []).filter((m) => {
      if (filter === 'optional' && !m.optional) return false
      if (!q) return true
      return [m.title, m.fileName, m.description].some((s) => s?.toLowerCase().includes(q))
    })
  }, [mods, query, filter])

  const toggle = async (mod: ModEntry, enabled: boolean): Promise<void> => {
    try {
      onSettings(await window.launcher.setOptionalMod(mod.key, enabled))
      onToast({ kind: 'info', text: `${mod.title ?? mod.fileName} will be ${enabled ? 'installed' : 'removed'} next time you press Play.` })
    } catch (e) {
      onToast({ kind: 'error', text: errorMessage(e) })
    }
  }

  const optionalCount = mods?.filter((m) => m.optional).length ?? 0
  const totalSize = mods?.reduce((sum, m) => sum + m.size, 0) ?? 0

  return (
    <div className="mods">
      <div className="mods-toolbar">
        <div className="search">
          <SearchIcon size={16} />
          <input className="input" placeholder="Search mods" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="segmented" role="tablist">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All {mods ? `(${mods.length})` : ''}
          </button>
          <button className={filter === 'optional' ? 'active' : ''} onClick={() => setFilter('optional')} disabled={optionalCount === 0}>
            Optional ({optionalCount})
          </button>
        </div>
        {mods && <span className="muted small">{formatBytes(totalSize)} total</span>}
      </div>

      <p className="muted small mods-hint">
        The server decides this list and the launcher keeps it in sync. Mods marked <em>optional</em> are client-side extras you can switch off.
      </p>

      {mods === null ? (
        <div className="mod-list">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="mod-row skeleton" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <BoxIcon size={32} />
          <p>{mods.length === 0 ? 'The mod list will show up once the pack can be downloaded.' : 'No mods match your search.'}</p>
        </div>
      ) : (
        <ul className="mod-list">
          {visible.map((m) => {
            const enabled = isEnabled(m)
            return (
              <li key={m.path} className={`mod-row${enabled ? '' : ' mod-off'}`}>
                {m.iconUrl ? (
                  <img className="mod-icon" src={m.iconUrl} alt="" loading="lazy" draggable={false} />
                ) : (
                  <span className="mod-icon mod-icon-empty">{(m.title ?? m.fileName).charAt(0).toUpperCase()}</span>
                )}
                <div className="mod-main">
                  <div className="mod-title-row">
                    {m.slug ? (
                      <button className="mod-title link-btn" onClick={() => void window.launcher.openExternal(`https://modrinth.com/mod/${m.slug}`)}>
                        {m.title} <ExternalIcon size={12} />
                      </button>
                    ) : (
                      <span className="mod-title">{m.title ?? m.fileName}</span>
                    )}
                    {m.side === 'client' && <span className="badge">Client</span>}
                    {m.optional && <span className="badge badge-accent">Optional</span>}
                  </div>
                  {m.description && <div className="mod-desc">{m.description}</div>}
                  <div className="mod-file muted small mono">
                    {m.versionNumber ? `${m.versionNumber} · ` : ''}
                    {m.fileName}
                  </div>
                </div>
                {m.optional && (
                  <label className="switch" title={enabled ? 'Enabled' : 'Disabled'}>
                    <input
                      type="checkbox"
                      aria-label={`Use ${m.title ?? m.fileName}`}
                      checked={enabled}
                      onChange={(e) => void toggle(m, e.target.checked)}
                    />
                    <span />
                  </label>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
