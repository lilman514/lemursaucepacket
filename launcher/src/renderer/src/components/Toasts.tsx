import type { ReactElement } from 'react'
import type { ToastMessage } from '../../../shared/types'
import { AlertIcon, XIcon } from '../icons'

export type Toast = ToastMessage & { id: number }

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }): ReactElement {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.kind !== 'info' && <AlertIcon size={18} />}
          <span>{t.text}</span>
          <button className="icon-btn" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <XIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
