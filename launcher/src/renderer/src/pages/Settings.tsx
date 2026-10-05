import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import type { AfterLaunch, FolderKind, InitialState, LauncherFeed, Settings, ShaderState, ToastMessage, UpdateStatus } from '../../../shared/types'
import accountIcon from '../assets/icons/account.png'
import filesIcon from '../assets/icons/files.png'
import homeIcon from '../assets/icons/home.png'
import mapIcon from '../assets/icons/map.png'
import repairIcon from '../assets/icons/repair.png'
import settingsIcon from '../assets/icons/settings.png'
import skillsIcon from '../assets/icons/skills.png'
import { defaultShaderPreset, shaderPreset, SHADERS_OFF } from '../../../shared/shaders'
import { errorMessage, formatMemory } from '../format'

/** A card heading with one of the pack's icons. */
function Title({ icon, children }: { icon: string; children: ReactNode }): ReactElement {
  return (
    <h3 className="card-title">
      <img src={icon} alt="" /> {children}
    </h3>
  )
}

interface Props {
  init: InitialState
  feed: LauncherFeed | null
  settings: Settings
  update: UpdateStatus
  busy: boolean
  onSave: (patch: Partial<Settings>) => Promise<void>
  onSettings: (s: Settings) => void
  onRepair: () => void
  onToast: (t: ToastMessage) => void
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }): ReactElement {
  return (
    <div className="setting">
      <div className="setting-text">
        <div className="setting-label">{label}</div>
        {hint && <div className="setting-hint">{hint}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): ReactElement {
  return (
    <label className="switch">
      <input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  )
}

/** Local draft that saves shortly after the player stops typing/dragging. */
function useDraft<T>(value: T, save: (v: T) => void, delay = 450): [T, (v: T) => void] {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => setDraft(value), [value])
  useEffect(() => () => clearTimeout(timer.current), [])
  return [
    draft,
    (v: T) => {
      setDraft(v)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => save(v), delay)
    }
  ]
}

export function SettingsPage({ init, feed, settings, update, busy, onSave, onSettings, onRepair, onToast }: Props): ReactElement {
  const maxMemory = Math.min(32768, Math.max(4096, Math.floor((init.systemMemoryMB - 1536) / 512) * 512))
  const [memory, setMemory] = useDraft(settings.memoryMB, (v) => void onSave({ memoryMB: v }))
  const [width, setWidth] = useDraft(settings.width, (v) => void onSave({ width: v }))
  const [height, setHeight] = useDraft(settings.height, (v) => void onSave({ height: v }))
  const [javaPath, setJavaPath] = useDraft(settings.javaPath, (v) => void onSave({ javaPath: v }), 800)
  const [jvmArgs, setJvmArgs] = useDraft(settings.jvmArgs, (v) => void onSave({ jvmArgs: v }), 800)

  const open = (kind: FolderKind): void => {
    window.launcher.openFolder(kind).catch((e) => onToast({ kind: 'error', text: errorMessage(e) }))
  }
  const recommended = feed?.recommendedMemoryMB
  const shaders = feed?.shaderPresets
  const [shaderNow, setShaderNow] = useState<ShaderState | null>(null)
  useEffect(() => {
    if (!shaders) return
    let alive = true
    window.launcher
      .getShaderState()
      .then((s) => alive && setShaderNow(s))
      .catch(() => alive && setShaderNow(null))
    return () => {
      alive = false
    }
  }, [shaders, settings.shaderPreset, settings.appliedShaderPreset])
  const pickShaders = async (id: string): Promise<void> => {
    try {
      onSettings(await window.launcher.setShaderPreset(id))
    } catch (e) {
      onToast({ kind: 'error', text: errorMessage(e) })
    }
  }
  const activeShader = shaderNow?.active ?? SHADERS_OFF
  const activePreset = shaderPreset(feed, activeShader)
  // With shaders off, K turns on the pack Iris has selected (the default one until the player picks another).
  const kPack = shaders?.presets.find((p) => p.file === shaderNow?.pack)?.name ?? (shaderNow?.pack || defaultShaderPreset(feed)?.name || 'the last pack')
  const lowMemory = recommended !== undefined && memory < recommended

  return (
    <div className="settings">
      <section className="card">
        <Title icon={skillsIcon}>Performance</Title>
        <Row
          label="Memory"
          hint={
            <>
              {recommended ? `The server recommends ${formatMemory(recommended)}. ` : ''}
              Your PC has {Math.round(init.systemMemoryMB / 1024)} GB.
              {lowMemory && <span className="warn-text"> Less than recommended may cause lag or crashes.</span>}
            </>
          }
        >
          <div className="slider">
            <input type="range" min={2048} max={maxMemory} step={512} value={Math.min(memory, maxMemory)} onChange={(e) => setMemory(Number(e.target.value))} />
            <span className="slider-value">{formatMemory(memory)}</span>
          </div>
        </Row>
      </section>

      <section className="card">
        <Title icon={settingsIcon}>Game window</Title>
        <Row label="Fullscreen">
          <Switch label="Fullscreen" checked={settings.fullscreen} onChange={(v) => void onSave({ fullscreen: v })} />
        </Row>
        <Row label="Window size" hint="Used when not in fullscreen.">
          <div className="row">
            <input className="input input-num" type="number" min={640} value={width} disabled={settings.fullscreen} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Width" />
            <span className="muted">×</span>
            <input className="input input-num" type="number" min={480} value={height} disabled={settings.fullscreen} onChange={(e) => setHeight(Number(e.target.value))} aria-label="Height" />
          </div>
        </Row>
      </section>

      {shaders && shaders.presets.length > 0 && (
        <section className="card">
          <Title icon={mapIcon}>Graphics</Title>
          <Row
            label="Shaders"
            hint={
              <>
                {shaderNow?.pending && <span className="warn-text">Applies next time you press Play. </span>}
                {activePreset
                  ? `${activePreset.description} `
                  : shaderNow?.active === null
                    ? `Using ${shaderNow.pack}, picked in game. `
                    : 'Off: plain Minecraft lighting, the fastest; shaders are much heavier on the graphics card. '}
                In game, <kbd>K</kbd> turns shaders {activeShader === SHADERS_OFF ? `on (${kPack})` : 'off'} and <kbd>O</kbd> opens Iris to pick a pack or tweak it.
              </>
            }
          >
            <div className="segmented" role="radiogroup" aria-label="Shaders">
              {[{ id: SHADERS_OFF, name: 'Off' }, ...shaders.presets].map((p) => {
                const active = activeShader === p.id
                return (
                  <button key={p.id} role="radio" aria-checked={active} className={active ? 'active' : ''} onClick={() => void pickShaders(p.id)}>
                    {p.name}
                  </button>
                )
              })}
            </div>
          </Row>
        </section>
      )}

      <section className="card">
        <Title icon={homeIcon}>Launcher</Title>
        <Row label="Join the server automatically" hint="Skips the title screen and connects straight to the SMP.">
          <Switch label="Auto-join" checked={settings.autoJoin} onChange={(v) => void onSave({ autoJoin: v })} />
        </Row>
        <Row label="When the game starts">
          <select className="input" value={settings.afterLaunch} onChange={(e) => void onSave({ afterLaunch: e.target.value as AfterLaunch })}>
            <option value="minimize">Minimize the launcher</option>
            <option value="keep">Keep the launcher open</option>
            <option value="close">Close the launcher</option>
          </select>
        </Row>
      </section>

      <section className="card">
        <Title icon={repairIcon}>Advanced</Title>
        <Row label="Java executable" hint="Leave empty to use the Java runtime the launcher installs (recommended).">
          <input className="input input-wide mono" placeholder="Managed automatically" value={javaPath} onChange={(e) => setJavaPath(e.target.value)} spellCheck={false} />
        </Row>
        <Row label="Extra JVM arguments" hint="Only change these if you know what they do.">
          <input className="input input-wide mono" placeholder="-XX:+UseZGC" value={jvmArgs} onChange={(e) => setJvmArgs(e.target.value)} spellCheck={false} />
        </Row>
      </section>

      <section className="card">
        <Title icon={filesIcon}>Files & repair</Title>
        <div className="row wrap">
          <button className="btn" onClick={() => open('game')}>
            <img src={filesIcon} alt="" /> Game folder
          </button>
          <button className="btn" onClick={() => open('screenshots')}>
            <img src={filesIcon} alt="" /> Screenshots
          </button>
          <button className="btn" onClick={() => open('logs')}>
            <img src={filesIcon} alt="" /> Logs
          </button>
          <button className="btn" onClick={() => open('data')}>
            <img src={filesIcon} alt="" /> Launcher data
          </button>
        </div>
        <Row label="Repair installation" hint="Re-checks every file (Minecraft, Java, NeoForge and mods) and re-downloads anything damaged, then launches.">
          <button className="btn" disabled={busy} onClick={onRepair}>
            <img src={repairIcon} alt="" /> Repair & play
          </button>
        </Row>
      </section>

      <section className="card about">
        <Title icon={accountIcon}>About</Title>
        <dl className="facts">
          <dt>Launcher</dt>
          <dd>
            {init.brand.name} {init.brand.version}
            {init.brand.dev ? ' (development)' : ''}
          </dd>
          <dt>Updates</dt>
          <dd>{updateText(update)}</dd>
          <dt>Data folder</dt>
          <dd className="mono small">{init.dataDir}</dd>
        </dl>
      </section>
    </div>
  )
}

function updateText(u: UpdateStatus): string {
  switch (u.state) {
    case 'disabled':
      return 'Automatic updates are off for this build'
    case 'checking':
      return 'Checking…'
    case 'available':
    case 'downloading':
      return `Downloading ${u.version ?? 'update'}${u.percent !== undefined ? ` (${u.percent}%)` : ''}`
    case 'ready':
      return `Version ${u.version} is ready. Restart to install.`
    case 'error':
      return `Update check failed: ${u.error}`
    default:
      return 'Up to date'
  }
}
