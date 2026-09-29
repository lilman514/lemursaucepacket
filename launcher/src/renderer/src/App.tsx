import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { AccountInfo, GameStatus, InitialState, LauncherFeed, ProgressInfo, Settings, ToastMessage, UpdateStatus } from '../../shared/types'
import { AccountDialog } from './components/AccountDialog'
import { Avatar } from './components/Avatar'
import { Toasts, type Toast } from './components/Toasts'
import { errorMessage } from './format'
import mascotUrl from './assets/mascot.png'
import homeIcon from './assets/icons/home.png'
import modsIcon from './assets/icons/mods.png'
import settingsIcon from './assets/icons/settings.png'
import { CogMark, DownloadIcon } from './icons'
import { HomePage } from './pages/Home'
import { ModsPage } from './pages/Mods'
import { SettingsPage } from './pages/Settings'

type Page = 'home' | 'mods' | 'settings'

const api = window.launcher

export function App(): ReactElement {
  const [init, setInit] = useState<InitialState | null>(null)
  const [page, setPage] = useState<Page>('home')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [feed, setFeed] = useState<LauncherFeed | null | undefined>(undefined)
  const [status, setStatus] = useState<GameStatus>({ state: 'idle' })
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [update, setUpdate] = useState<UpdateStatus>({ state: 'disabled' })
  const [toasts, setToasts] = useState<Toast[]>([])
  const [accountOpen, setAccountOpen] = useState(false)
  const toastId = useRef(0)

  const pushToast = useCallback((t: ToastMessage) => {
    const id = ++toastId.current
    setToasts((list) => [...list.slice(-3), { ...t, id }])
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.kind === 'error' ? 12_000 : 6_000)
  }, [])

  useEffect(() => {
    api
      .getInitialState()
      .then((s) => {
        setInit(s)
        setSettings(s.settings)
        setAccount(s.account)
      })
      .catch((e) => pushToast({ kind: 'error', text: errorMessage(e) }))
    api
      .getFeed()
      .then(setFeed)
      .catch(() => setFeed(null))
    const offs = [
      api.onProgress(setProgress),
      api.onGameStatus((s) => {
        setStatus(s)
        // A launch means the pack on disk just changed; refresh the "installed" summary.
        if (s.state === 'running') api.getInitialState().then(setInit, () => {})
      }),
      api.onUpdateStatus(setUpdate),
      api.onToast(pushToast),
      api.onAccount(setAccount)
    ]
    return () => offs.forEach((off) => off())
  }, [pushToast])

  const play = useCallback(
    // Only a literal true means repair: an onClick handler would otherwise pass its event object here.
    async (repair?: boolean) => {
      if (!account) {
        setAccountOpen(true)
        return
      }
      try {
        await api.play({ repair: repair === true })
      } catch (e) {
        pushToast({ kind: 'error', text: errorMessage(e) })
      }
    },
    [account, pushToast]
  )

  const saveSettings = useCallback(
    async (patch: Partial<Settings>) => {
      try {
        setSettings(await api.updateSettings(patch))
      } catch (e) {
        pushToast({ kind: 'error', text: errorMessage(e) })
      }
    },
    [pushToast]
  )

  if (!init || !settings) {
    return (
      <div className="boot">
        <CogMark size={56} />
      </div>
    )
  }

  const nav: { id: Page; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: homeIcon },
    { id: 'mods', label: 'Mods', icon: modsIcon },
    { id: 'settings', label: 'Settings', icon: settingsIcon }
  ]
  const titles: Record<Page, string> = { home: feed?.name ?? init.brand.shortName, mods: 'Mods', settings: 'Settings' }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-mark" title={init.brand.name}>
          <img className="sidebar-mascot" src={mascotUrl} alt="" draggable={false} />
        </div>
        <nav className="sidebar-nav">
          {nav.map((n) => (
            <button key={n.id} className={`nav-btn${page === n.id ? ' active' : ''}`} onClick={() => setPage(n.id)} title={n.label}>
              <img src={n.icon} alt="" draggable={false} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <button className="nav-account" onClick={() => setAccountOpen(true)} title={account ? account.name : 'Sign in'}>
          <Avatar account={account} size={34} ring />
        </button>
      </aside>

      <main className="main">
        <header className="titlebar">
          <h1>{titles[page]}</h1>
          {init.brand.dev && <span className="chip chip-dev">dev build</span>}
          <div className="titlebar-spacer" />
          {update.state === 'ready' && (
            <button className="chip chip-accent no-drag" onClick={() => void api.installUpdate()}>
              <DownloadIcon size={14} /> Restart to update to {update.version}
            </button>
          )}
          {update.state === 'downloading' && <span className="chip">Downloading update… {update.percent ?? 0}%</span>}
        </header>

        <div className="page" key={page}>
          {page === 'home' && (
            <HomePage
              init={init}
              feed={feed}
              account={account}
              status={status}
              progress={progress}
              onPlay={play}
              onSignIn={() => setAccountOpen(true)}
              onToast={pushToast}
            />
          )}
          {page === 'mods' && <ModsPage settings={settings} onSettings={setSettings} onToast={pushToast} />}
          {page === 'settings' && (
            <SettingsPage init={init} feed={feed ?? null} settings={settings} update={update} onSave={saveSettings} onRepair={() => void play(true)} busy={status.state !== 'idle' && status.state !== 'crashed'} onToast={pushToast} />
          )}
        </div>
      </main>

      {accountOpen && <AccountDialog init={init} account={account} onClose={() => setAccountOpen(false)} onToast={pushToast} />}
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((l) => l.filter((t) => t.id !== id))} />
    </div>
  )
}
