interface RhythmMarkProps {
  className?: string
}

/**
 * The shared brand mark: a pantry jar with a heartbeat, so the pantry and the
 * household rhythm read as one shape. Kept inline so it inherits colour and
 * stays crisp at any size.
 */
export function RhythmMark({ className = 'brand-mark' }: RhythmMarkProps) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <rect width="64" height="64" rx="17" fill="currentColor" />
        <rect x="20" y="15.5" width="24" height="6.5" rx="3.25" fill="#e3a14a" />
        <rect
          x="15"
          y="22"
          width="34"
          height="27.5"
          rx="9.5"
          fill="none"
          stroke="#f4ecdc"
          strokeWidth="3.6"
        />
        <path
          d="M21 36h5.5l3-6.5 4.5 13 3-6.5H43"
          fill="none"
          stroke="#e3a14a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
