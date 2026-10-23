interface RhythmMarkProps {
  className?: string
}

/**
 * The shared brand mark: three pantry levels resting on a shelf line.
 * Kept inline so it stays crisp at any size.
 */
export function RhythmMark({ className = 'brand-mark' }: RhythmMarkProps) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <rect width="64" height="64" rx="17" fill="#e7d8bd" />
        <rect x="16.6" y="30.5" width="7" height="16.5" rx="3.5" fill="#15382e" opacity="0.55" />
        <rect x="28.5" y="18" width="7" height="29" rx="3.5" fill="#c25f3d" />
        <rect x="40.4" y="24.5" width="7" height="22.5" rx="3.5" fill="#15382e" opacity="0.85" />
        <rect
          x="16.6"
          y="50.5"
          width="30.8"
          height="1.5"
          rx="0.75"
          fill="#15382e"
          opacity="0.22"
        />
      </svg>
    </span>
  )
}
