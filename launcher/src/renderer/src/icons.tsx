import type { ReactElement, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base(children: ReactElement | ReactElement[], { size = 20, ...props }: IconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps): ReactElement =>
  base(
    [<path key="a" d="M3 10.5 12 3l9 7.5" />, <path key="b" d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />],
    p
  )

export const BoxIcon = (p: IconProps): ReactElement =>
  base(
    [
      <path key="a" d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />,
      <path key="b" d="m3 8 9 5 9-5" />,
      <path key="c" d="M12 13v8" />
    ],
    p
  )

export const GearIcon = (p: IconProps): ReactElement =>
  base(
    [
      <circle key="a" cx="12" cy="12" r="3" />,
      <path
        key="b"
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
      />
    ],
    p
  )

export const PlayIcon = (p: IconProps): ReactElement => base(<path d="M7 4.5v15l12.5-7.5L7 4.5Z" fill="currentColor" />, p)

export const StopIcon = (p: IconProps): ReactElement => base(<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />, p)

export const XIcon = (p: IconProps): ReactElement => base([<path key="a" d="M18 6 6 18" />, <path key="b" d="m6 6 12 12" />], p)

export const FolderIcon = (p: IconProps): ReactElement =>
  base(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />, p)

export const ExternalIcon = (p: IconProps): ReactElement =>
  base([<path key="a" d="M14 4h6v6" />, <path key="b" d="M20 4 10 14" />, <path key="c" d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />], p)

export const WrenchIcon = (p: IconProps): ReactElement =>
  base(
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8Z" />,
    p
  )

export const UserIcon = (p: IconProps): ReactElement =>
  base([<circle key="a" cx="12" cy="8" r="4" />, <path key="b" d="M4 21a8 8 0 0 1 16 0" />], p)

export const AlertIcon = (p: IconProps): ReactElement =>
  base([<path key="a" d="M12 3 2 20h20L12 3Z" />, <path key="b" d="M12 10v4" />, <path key="c" d="M12 17h.01" />], p)

export const SearchIcon = (p: IconProps): ReactElement =>
  base([<circle key="a" cx="11" cy="11" r="7" />, <path key="b" d="m20 20-3.5-3.5" />], p)

export const UsersIcon = (p: IconProps): ReactElement =>
  base(
    [
      <circle key="a" cx="9" cy="8" r="3.5" />,
      <path key="b" d="M2.5 20a6.5 6.5 0 0 1 13 0" />,
      <path key="c" d="M16 4.5a3.5 3.5 0 0 1 0 7" />,
      <path key="d" d="M18.5 14a6.5 6.5 0 0 1 3 6" />
    ],
    p
  )

export const DownloadIcon = (p: IconProps): ReactElement =>
  base([<path key="a" d="M12 4v11" />, <path key="b" d="m7 10 5 5 5-5" />, <path key="c" d="M5 20h14" />], p)

/** Brand mark: a cogwheel, in keeping with Create. */
export const CogMark = ({ size = 28 }: { size?: number }): ReactElement => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6cf7a" />
        <stop offset="1" stopColor="#c7832b" />
      </linearGradient>
    </defs>
    <path
      fill="url(#brass)"
      d="M28 4h8l1.6 7.2a21 21 0 0 1 5.5 2.3l6.2-4 5.7 5.7-4 6.2a21 21 0 0 1 2.3 5.5L60 28v8l-7.2 1.6a21 21 0 0 1-2.3 5.5l4 6.2-5.7 5.7-6.2-4a21 21 0 0 1-5.5 2.3L36 60h-8l-1.6-7.2a21 21 0 0 1-5.5-2.3l-6.2 4-5.7-5.7 4-6.2a21 21 0 0 1-2.3-5.5L4 36v-8l7.2-1.6a21 21 0 0 1 2.3-5.5l-4-6.2 5.7-5.7 6.2 4a21 21 0 0 1 5.5-2.3L28 4Z"
    />
    <circle cx="32" cy="32" r="10" fill="#15181f" />
    <circle cx="32" cy="32" r="4.5" fill="url(#brass)" />
  </svg>
)
