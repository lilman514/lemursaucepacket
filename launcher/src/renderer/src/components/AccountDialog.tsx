import { useEffect, useState, type ReactElement } from 'react'
import type { AccountInfo, InitialState, LoginCode, ToastMessage } from '../../../shared/types'
import { errorMessage } from '../format'
import { XIcon } from '../icons'
import { Avatar } from './Avatar'

interface Props {
  init: InitialState
  account: AccountInfo | null
  onClose: () => void
  onToast: (t: ToastMessage) => void
}

export function AccountDialog({ init, account, onClose, onToast }: Props): ReactElement {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offlineName, setOfflineName] = useState('DevPlayer')
  // Set while a Microsoft device-code sign-in is waiting for the player to approve it in their browser.
  const [code, setCode] = useState<LoginCode | null>(null)

  useEffect(() => window.launcher.onLoginCode(setCode), [])

  const cancelLogin = (): void => void window.launcher.cancelLogin()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (!busy) onClose()
      else if (code) cancelLogin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, code, onClose])

  const copyCode = async (value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value)
      onToast({ kind: 'info', text: 'Code copied.' })
    } catch {
      onToast({ kind: 'warn', text: "Couldn't copy; type the code instead." })
    }
  }

  const run = async (fn: () => Promise<unknown>, done?: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      if (done) onToast({ kind: 'info', text: done })
      onClose()
    } catch (e) {
      const message = errorMessage(e)
      if (!/cancelled|closed/i.test(message)) setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div className="modal-head">
          <h2 id="account-title">{account ? 'Account' : 'Sign in'}</h2>
          <button className="icon-btn" onClick={busy ? cancelLogin : onClose} disabled={busy && !code} aria-label={busy ? 'Cancel sign-in' : 'Close'}>
            <XIcon size={18} />
          </button>
        </div>

        {account ? (
          <div className="account-card">
            <Avatar account={account} size={56} />
            <div>
              <div className="account-name">{account.name}</div>
              <div className="muted">{account.type === 'msa' ? 'Microsoft account' : 'Offline dev account'}</div>
            </div>
          </div>
        ) : (
          <p className="muted">Sign in with the Microsoft account that owns Minecraft: Java Edition. Your password goes straight to Microsoft; the launcher never sees it.</p>
        )}

        {code && (
          <div className="login-code" role="status">
            <p>
              Finish signing in in your browser. If it didn't open, go to <strong>microsoft.com/link</strong> and enter this code:
            </p>
            <div className="login-code-value">{code.userCode}</div>
            <div className="row">
              <button className="btn btn-ghost" onClick={() => void copyCode(code.userCode)}>
                Copy code
              </button>
              <button className="btn btn-ghost" onClick={() => void window.launcher.openExternal(code.url)}>
                Open the page again
              </button>
              <button className="btn btn-ghost" onClick={cancelLogin}>
                Cancel
              </button>
            </div>
            <p className="muted small">Microsoft's page may call this a Minecraft sign-in. That's expected: the launcher uses Minecraft's own Microsoft sign-in.</p>
          </div>
        )}

        {error && <div className="callout callout-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-primary" disabled={busy} onClick={() => void run(() => window.launcher.login(), 'Signed in.')}>
            {busy ? 'Waiting for Microsoft…' : account ? 'Switch account' : 'Sign in with Microsoft'}
          </button>
          {account && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => void run(() => window.launcher.logout(), 'Signed out.')}>
              Sign out
            </button>
          )}
        </div>

        {init.brand.dev && (
          <div className="dev-box">
            <div className="dev-box-title">Development only</div>
            <p className="muted small">An offline profile runs singleplayer or an offline-mode test server. It can't join your real server.</p>
            <div className="row">
              <input className="input" value={offlineName} maxLength={16} onChange={(e) => setOfflineName(e.target.value)} aria-label="Offline player name" />
              <button className="btn" disabled={busy} onClick={() => void run(() => window.launcher.loginOffline(offlineName))}>
                Use offline account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
