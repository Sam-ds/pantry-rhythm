import type { Estimate } from '../types'
import { confidenceLabel } from '../lib/prediction'

interface EstimateBadgeProps {
  estimate: Estimate
  compact?: boolean
}

export function EstimateBadge({ estimate, compact = false }: EstimateBadgeProps) {
  const filled = estimate.confidence === 'medium' ? 3 : estimate.confidence === 'low' ? 2 : 1
  return (
    <span
      className={`estimate-badge estimate-${estimate.confidence}${compact ? ' estimate-compact' : ''}`}
      title={estimate.method}
    >
      <span className="estimate-dots" aria-hidden="true">
        {[1, 2, 3].map((dot) => (
          <span key={dot} className={dot <= filled ? 'filled' : ''} />
        ))}
      </span>
      <span>{confidenceLabel(estimate.confidence)}</span>
    </span>
  )
}
