import { useState, type ReactElement } from 'react'
import type { AccountInfo } from '../../../shared/types'
import { UserIcon } from '../icons'

/** Player head from mc-heads.net, with a plain icon when signed out or offline. */
export function Avatar({ account, size }: { account: AccountInfo | null; size: number }): ReactElement {
  const [failed, setFailed] = useState(false)
  if (!account || failed) {
    return (
      <span className="avatar avatar-empty" style={{ width: size, height: size }}>
        <UserIcon size={Math.round(size * 0.55)} />
      </span>
    )
  }
  const id = account.type === 'offline' ? account.name : account.uuid
  return (
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
