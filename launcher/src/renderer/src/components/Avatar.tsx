import { useState, type ReactElement } from 'react'
import type { AccountInfo } from '../../../shared/types'
import { UserIcon } from '../icons'

/** assets/ui/ring.png's cut-out glass spans 60% of the image: at this scale it sits just inside the head's edge. */
const RING_SCALE = 1.56

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
  if (!ring) return inner
  const box = Math.round(size * RING_SCALE)
  return (
    <span className="avatar-ring" style={{ width: box, height: box }}>
      {inner}
    </span>
  )
}
