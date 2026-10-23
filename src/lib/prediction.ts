import type { Estimate, PurchaseCycle, TrackedItem } from '../types'
import { addDays, daysBetween } from './dates'

const MAX_REASONABLE_DAYS = 3_650

export function getActivePurchase(item: TrackedItem): PurchaseCycle | undefined {
  return item.purchases
    .filter((purchase) => !purchase.endedAt)
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))[0]
}

export function getCompletedCycles(item: TrackedItem): PurchaseCycle[] {
  return item.purchases.filter((purchase) => purchase.endedAt && purchase.endReason === 'consumed')
}

export function getObservedDaysPerUnit(item: TrackedItem): number[] {
  return getCompletedCycles(item)
    .map((cycle) => {
      if (!cycle.endedAt) return null
      const duration = daysBetween(cycle.purchasedAt, cycle.endedAt)
      if (duration <= 0 || duration > MAX_REASONABLE_DAYS) return null
      if (!Number.isFinite(cycle.quantity) || cycle.quantity <= 0) return null
      return duration / cycle.quantity
    })
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

function roundDays(value: number): number {
  return Math.max(1, Math.round(value))
}

/**
 * This is deliberately a *restock estimate*, not a guarantee. It uses the
 * household's own completed purchase cycles when available and falls back to
 * the estimate entered at purchase time. With no completed cycles the app says
 * so and shows a wide range.
 */
export function estimateRestock(item: TrackedItem, today: string): Estimate | null {
  if (item.status === 'archived') return null
  const active = getActivePurchase(item)
  if (!active) return null

  const quantity = Math.max(0.01, active.quantity)
  const start = active.purchasedAt
  const observations = getObservedDaysPerUnit(item)
  let duration: number
  let spread: number
  let confidence: Estimate['confidence']
  let basis: Estimate['basis']
  let method: string

  if (
    typeof active.manualEstimateDays === 'number' &&
    Number.isFinite(active.manualEstimateDays) &&
    active.manualEstimateDays > 0
  ) {
    duration = active.manualEstimateDays
    spread = Math.max(2, duration * 0.1)
    confidence = 'manual'
    basis = 'manual'
    method = 'You corrected this cycle. The date is shown as a range.'
  } else if (observations.length > 0) {
    const expectedPerUnit = median(observations)
    duration = expectedPerUnit * quantity
    spread = Math.max(3, duration * 0.3)
    confidence = observations.length >= 3 ? 'medium' : 'low'
    basis = 'history'
    method =
      observations.length === 1
        ? 'Based on 1 completed cycle. Add more run-outs to narrow the range.'
        : `Based on ${observations.length} completed cycles from your household.`

    if (observations.length >= 2) {
      const shortest = Math.min(...observations) * quantity
      const longest = Math.max(...observations) * quantity
      const padding = Math.max(2, duration * 0.08)
      const lower = Math.max(1, Math.min(shortest, duration) - padding)
      const upper = Math.max(duration, longest) + padding
      const lowerBound = Math.max(1, Math.round(lower))
      const upperBound = Math.max(lowerBound + 1, Math.round(upper))
      return {
        expectedDate: addDays(start, roundDays(duration)),
        earliestDate: addDays(start, lowerBound),
        latestDate: addDays(start, upperBound),
        expectedDurationDays: roundDays(duration),
        daysLeft: daysBetween(today, addDays(start, roundDays(duration))),
        confidence,
        basis,
        completedCycles: observations.length,
        method,
        overdue: daysBetween(today, addDays(start, roundDays(duration))) < 0,
      }
    }
  } else {
    duration = Math.max(1, active.estimatedDurationDays)
    spread = Math.max(3, duration * 0.3)
    confidence = 'none'
    basis = 'initial'
    method = 'Starting estimate from your duration. No completed run-out cycles yet.'
  }

  const expectedDurationDays = roundDays(duration)
  const spreadDays = Math.max(1, Math.round(spread))
  const lower = Math.max(1, expectedDurationDays - spreadDays)
  const upper = expectedDurationDays + spreadDays
  const expectedDate = addDays(start, expectedDurationDays)
  const daysLeft = daysBetween(today, expectedDate)

  return {
    expectedDate,
    earliestDate: addDays(start, lower),
    latestDate: addDays(start, upper),
    expectedDurationDays,
    daysLeft,
    confidence,
    basis,
    completedCycles: observations.length,
    method,
    overdue: daysLeft < 0,
  }
}

export function isWithinWindow(estimate: Estimate, days: number): boolean {
  return estimate.daysLeft <= days
}

export function estimateSortValue(estimate: Estimate | null): number {
  return estimate ? estimate.daysLeft : Number.POSITIVE_INFINITY
}

export function isDueForRestockList(item: TrackedItem, today: string, windowDays = 14): boolean {
  const estimate = estimateRestock(item, today)
  return Boolean(estimate && (estimate.daysLeft <= windowDays || item.onShoppingList))
}

export function getDueCounts(items: TrackedItem[], today: string): Record<3 | 7 | 14, number> {
  const counts: Record<3 | 7 | 14, number> = { 3: 0, 7: 0, 14: 0 }
  for (const item of items) {
    if (item.status === 'archived') continue
    const estimate = estimateRestock(item, today)
    if (!estimate) continue
    for (const window of [3, 7, 14] as const) {
      if (estimate.daysLeft <= window) counts[window] += 1
    }
  }
  return counts
}

export function confidenceLabel(confidence: Estimate['confidence']): string {
  switch (confidence) {
    case 'manual':
      return 'You corrected'
    case 'medium':
      return 'Your pattern'
    case 'low':
      return 'Limited history'
    default:
      return 'Rough estimate'
  }
}
