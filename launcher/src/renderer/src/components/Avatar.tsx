import { useState, type ReactElement } from 'react'
import type { AccountInfo } from '../../../shared/types'
import { UserIcon } from '../icons'

/** Player head from mc-heads.net, with a plain icon when signed out or offline. `ring` adds the brass bezel. */
export function Avatar({ account, size, ring = false }: { account: AccountInfo | null; size: number; ring?: boolean }): ReactElement {
  const [failed, setFailed] = useState(false)
  let inner: ReactElement
  if (!account || failed) {
    inner = (
      <span className="avatar avatar-empty" style={{ width: size, height: size }}>
        <UserIcon size={Math.round(size * 0.55)} />
      </span>
    )
  } else {
    const id = account.type === 'offline' ? account.name : account.uuid
    inner = (
      <img
        className="avatar"
        src={`https://mc-heads.net/avatar/${encodeURIComponent(id)}/${size * 2}`}
        width={size}
        height={size}
        alt=""
        onError={() => setFailed(true)}
        draggable={false}
      />
    )
  }
  return ring ? <span className="avatar-ring">{inner}</span> : inner
}
