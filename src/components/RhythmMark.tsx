interface RhythmMarkProps {
  className?: string
}

/**
 * The shared brand mark: three pantry levels resting on a shelf line.
 * Kept inline so it inherits colour and stays crisp at any size.
 */
export function RhythmMark({ className = 'brand-mark' }: RhythmMarkProps) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <rect width="64" height="64" rx="17" fill="currentColor" />
        <rect x="16.6" y="30.5" width="7" height="16.5" rx="3.5" fill="#f4ecdc" opacity="0.7" />
        <rect x="28.5" y="18" width="7" height="29" rx="3.5" fill="#e3a14a" />
        <rect x="40.4" y="24.5" width="7" height="22.5" rx="3.5" fill="#f4ecdc" opacity="0.9" />
        <rect x="16.6" y="50.5" width="30.8" height="1.5" rx="0.75" fill="#f4ecdc" opacity="0.28" />
      </svg>
    </span>
  )
}
