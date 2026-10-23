interface RhythmMarkProps {
  className?: string
}

/**
 * The shared brand mark: a household heartbeat on a warm pantry tile.
 * Kept inline so it stays crisp at any size.
 */
export function RhythmMark({ className = 'brand-mark' }: RhythmMarkProps) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <rect width="64" height="64" rx="17" fill="#e7d8bd" />
        <path
          d="M11 33h12l4-10 6 20 5-14 4 4h11"
          fill="none"
          stroke="#15382e"
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
