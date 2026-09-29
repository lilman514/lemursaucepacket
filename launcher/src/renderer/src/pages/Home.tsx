import { useEffect, useState, type ReactElement } from 'react'
import type { AccountInfo, GameStatus, InitialState, LauncherFeed, ProgressInfo, ServerStatus, ToastMessage } from '../../../shared/types'
import logoUrl from '../assets/logo.png'
import { errorMessage, formatBytes, formatDate, loaderName } from '../format'
import { AlertIcon, ExternalIcon, FolderIcon, PlayIcon, StopIcon, UsersIcon, XIcon } from '../icons'

interface Props {
  init: InitialState
  feed: LauncherFeed | null | undefined
  account: AccountInfo | null
  status: GameStatus
  progress: ProgressInfo | null
  onPlay: () => void
  onSignIn: () => void
  onToast: (t: ToastMessage) => void
}

function useServerStatus(enabled: boolean): ServerStatus | null {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const tick = (): void => {
      window.launcher
        .getServerStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => alive && setStatus({ online: false, error: 'Unavailable' }))
    }
    tick()
    const timer = setInterval(tick, 30_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [enabled])
  return status
}

export function HomePage({ init, feed, account, status, progress, onPlay, onSignIn, onToast }: Props): ReactElement {
  const server = useServerStatus(Boolean(feed))
  const pack = feed?.pack
  const installed = init.installed
  const updatePending = Boolean(pack && installed && pack.version !== installed.version)

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-body">
          <div className="hero-kicker">
            <ServerPill status={server} address={feed?.server.address} />
          </div>
          <h2 className="hero-title">
            <img className="hero-logo" src={logoUrl} alt={feed?.name ?? init.brand.shortName} draggable={false} />
          </h2>
          {feed?.description && <p className="hero-desc">{feed.description}</p>}
          {feed === null && !installed && (
            <p className="hero-desc warn-text">Can't reach the update server. Check your internet connection.</p>
          )}
        </div>

        <PlayPanel
          account={account}
          status={status}
          progress={progress}
          onPlay={onPlay}
          onSignIn={onSignIn}
          meta={
            pack
              ? `Pack ${pack.version} · ${loaderName(pack.loader)} ${pack.loaderVersion ?? ''} · Minecraft ${pack.minecraft ?? ''}`
              : installed
                ? `Pack ${installed.version} · ${loaderName(installed.loader)} · Minecraft ${installed.minecraft}`
                : ''
          }
          note={
            updatePending
              ? `Update available: ${installed?.version} → ${pack?.version}`
              : !installed && pack
                ? 'First launch downloads Minecraft and all mods.'
                : feed === null && installed
                  ? "Offline: you'll play the version you already have."
                  : undefined
          }
        />
      </section>

      {status.state === 'crashed' && <CrashCard status={status} onToast={onToast} />}

      <div className="home-grid">
        <section className="card">
          <h3 className="card-title">News</h3>
          {feed?.news?.length ? (
            <ul className="news">
              {feed.news.map((n, i) => (
                <li key={i} className="news-item">
                  <div className="news-head">
                    <span className="news-title">{n.title}</span>
                    {n.date && <span className="muted small">{formatDate(n.date)}</span>}
                  </div>
                  <p>{n.body}</p>
                  {n.url && (
                    <button className="link-btn" onClick={() => void window.launcher.openExternal(n.url!)}>
                      Read more <ExternalIcon size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing new yet.</p>
          )}
        </section>

        <section className="card">
          <h3 className="card-title">Server</h3>
          <dl className="facts">
            <dt>Address</dt>
            <dd className="mono">{feed ? (feed.server.port ? `${feed.server.address}:${feed.server.port}` : feed.server.address) : '—'}</dd>
            <dt>Status</dt>
            <dd>{server ? (server.online ? `Online · ${server.latencyMs} ms` : (server.error ?? 'Offline')) : 'Checking…'}</dd>
            {server?.online && server.players && (
              <>
                <dt>Players</dt>
                <dd>
                  {server.players.online} / {server.players.max}
                </dd>
              </>
            )}
            {server?.motd && (
              <>
                <dt>MOTD</dt>
                <dd>{server.motd}</dd>
              </>
            )}
          </dl>
          {server?.players?.sample.length ? (
            <div className="player-list">
              {server.players.sample.slice(0, 12).map((name) => (
                <span key={name} className="chip">
                  {name}
                </span>
              ))}
            </div>
          ) : null}
          {feed?.links?.length ? (
            <div className="links">
              {feed.links.map((l) => (
                <button key={l.url} className="btn btn-ghost btn-sm" onClick={() => void window.launcher.openExternal(l.url)}>
                  {l.label} <ExternalIcon size={13} />
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function ServerPill({ status, address }: { status: ServerStatus | null; address?: string }): ReactElement {
  if (!address) return <span className="pill">No server</span>
  if (!status) return <span className="pill">Checking server…</span>
  return (
    <span className={`pill ${status.online ? 'pill-online' : 'pill-offline'}`}>
      <span className="dot" />
      {status.online ? (
        <>
          Online <UsersIcon size={14} /> {status.players?.online ?? 0}/{status.players?.max ?? 0}
        </>
      ) : (
        (status.error ?? 'Offline')
      )}
    </span>
  )
}

interface PlayPanelProps {
  account: AccountInfo | null
  status: GameStatus
  progress: ProgressInfo | null
  onPlay: () => void
  onSignIn: () => void
  meta: string
  note?: string
}

function PlayPanel({ account, status, progress, onPlay, onSignIn, meta, note }: PlayPanelProps): ReactElement {
  const preparing = status.state === 'preparing'
  const running = status.state === 'running'
  const pct = progress?.total ? Math.min(100, Math.round(((progress.current ?? 0) / progress.total) * 100)) : null

  let button: ReactElement
  if (!account) {
    button = (
      <button className="play-btn" onClick={onSignIn}>
        Sign in to play
      </button>
    )
  } else if (preparing) {
    button = (
      <button className="play-btn play-btn-cancel" onClick={() => void window.launcher.cancel()}>
        <XIcon size={20} /> Cancel
      </button>
    )
  } else if (running) {
    button = (
      <div className="play-running">
        <button className="play-btn" disabled>
          Playing
        </button>
        <button className="icon-btn icon-btn-lg" title="Force-stop the game" onClick={() => void window.launcher.stopGame()}>
          <StopIcon size={18} />
        </button>
      </div>
    )
  } else {
    button = (
      <button className="play-btn" onClick={() => onPlay()}>
        <PlayIcon size={20} /> Play
      </button>
    )
  }

  return (
    <div className="play-panel">
      {button}
      <div className="play-info">
        {preparing && progress ? (
          <div className="progress-block">
            <div className="progress-label">
              <span>{progress.label}</span>
              <span className="muted">
                {progress.unit === 'bytes' && progress.total
                  ? `${formatBytes(progress.current ?? 0)} / ${formatBytes(progress.total)}`
                  : progress.unit === 'files' && progress.total
                    ? `${progress.current ?? 0} / ${progress.total}`
                    : ''}
              </span>
            </div>
            <div className={`progress${pct === null ? ' progress-indeterminate' : ''}`}>
              <div className="progress-fill" style={{ width: pct === null ? undefined : `${pct}%` }} />
            </div>
            <div className="progress-detail muted small">{progress.detail ?? ' '}</div>
          </div>
        ) : (
          <>
            <div className="play-meta">{running ? 'Minecraft is running. Have fun!' : meta}</div>
            {note && !running && <div className="play-note">{note}</div>}
          </>
        )}
      </div>
    </div>
  )
}

function CrashCard({ status, onToast }: { status: Extract<GameStatus, { state: 'crashed' }>; onToast: (t: ToastMessage) => void }): ReactElement {
  const [open, setOpen] = useState(false)
  const open_ = (kind: 'crash-reports' | 'logs'): void => {
    window.launcher.openFolder(kind).catch((e) => onToast({ kind: 'error', text: errorMessage(e) }))
  }
  return (
    <section className="card crash-card">
      <div className="crash-head">
        <AlertIcon size={20} />
        <div>
          <strong>Minecraft closed unexpectedly</strong>
          <div className="muted small">Exit code {status.code ?? 'unknown'}. If this keeps happening, send the crash report to an admin.</div>
        </div>
      </div>
      <div className="row">
        <button className="btn btn-sm" onClick={() => open_('crash-reports')}>
          <FolderIcon size={15} /> Crash reports
        </button>
        <button className="btn btn-sm" onClick={() => open_('logs')}>
          <FolderIcon size={15} /> Logs
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>
          {open ? 'Hide output' : 'Show last output'}
        </button>
      </div>
      {open && <pre className="log-tail">{(status.crashReport ?? status.tail.join('\n')) || 'No output captured.'}</pre>}
    </section>
  )
}
