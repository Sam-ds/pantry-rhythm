import { describe, expect, it } from 'vitest'
import type { PurchaseCycle, TrackedItem } from '../types'
import {
  estimateRestock,
  getActivePurchase,
  getDueCounts,
  getObservedDaysPerUnit,
} from './prediction'

function item(purchases: PurchaseCycle[], overrides: Partial<TrackedItem> = {}): TrackedItem {
  return {
    id: 'item-1',
    product: {
      name: 'Oat milk',
      brand: 'Example',
      barcode: '',
      imageUrl: '',
      quantityLabel: '1 l',
      source: 'manual',
      sourceUrl: '',
    },
    unitLabel: 'carton',
    notes: '',
    status: 'tracked',
    purchases,
    onShoppingList: false,
    listChecked: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const active = {
  id: 'p-active',
  purchasedAt: '2026-01-01',
  quantity: 2,
  estimatedDurationDays: 10,
  notes: '',
}

const done = (id: string, start: string, end: string, quantity: number): PurchaseCycle => ({
  id,
  purchasedAt: start,
  endedAt: end,
  endReason: 'consumed',
  quantity,
  estimatedDurationDays: 10,
  notes: '',
})

describe('restock estimates', () => {
  it('uses the initial duration with a wide range when there is no history', () => {
    const estimate = estimateRestock(item([{ ...active }]), '2026-01-05')
    expect(estimate).not.toBeNull()
    expect(estimate).toMatchObject({
      expectedDate: '2026-01-11',
      earliestDate: '2026-01-08',
      latestDate: '2026-01-14',
      daysLeft: 6,
      confidence: 'none',
      basis: 'initial',
      completedCycles: 0,
      overdue: false,
    })
  })

  it('uses one completed cycle but labels the history as limited', () => {
    const cycle = done('p1', '2025-12-01', '2026-01-01', 2)
    const estimate = estimateRestock(
      item([
        cycle,
        { id: 'p2', purchasedAt: '2026-01-01', quantity: 1, estimatedDurationDays: 10, notes: '' },
      ]),
      '2026-01-05',
    )
    expect(estimate?.basis).toBe('history')
    expect(estimate?.confidence).toBe('low')
    expect(estimate?.completedCycles).toBe(1)
    expect(estimate?.expectedDate).toBe('2026-01-17')
    expect(estimate?.expectedDurationDays).toBe(16)
  })

  it('uses the median of multiple completed cycles and shows a medium confidence pattern', () => {
    const cycles = [
      done('p1', '2026-01-01', '2026-01-11', 2),
      done('p2', '2026-01-11', '2026-01-25', 2),
      done('p3', '2026-01-25', '2026-02-06', 2),
    ]
    const estimate = estimateRestock(
      item([
        ...cycles,
        { id: 'p4', purchasedAt: '2026-03-01', quantity: 3, estimatedDurationDays: 10, notes: '' },
      ]),
      '2026-03-01',
    )
    expect(estimate?.confidence).toBe('medium')
    expect(estimate?.completedCycles).toBe(3)
    expect(estimate?.expectedDurationDays).toBe(18)
    expect(getObservedDaysPerUnit(item(cycles))).toEqual([5, 7, 6])
  })

  it('does not treat a restock without a run-out as consumption history', () => {
    const estimate = estimateRestock(
      item([
        {
          id: 'restocked',
          purchasedAt: '2025-12-01',
          endedAt: '2026-01-01',
          endReason: 'restocked',
          quantity: 2,
          estimatedDurationDays: 10,
          notes: '',
        },
        { id: 'p2', purchasedAt: '2026-01-01', quantity: 2, estimatedDurationDays: 10, notes: '' },
      ]),
      '2026-01-02',
    )
    expect(estimate?.basis).toBe('initial')
    expect(estimate?.completedCycles).toBe(0)
  })

  it('honours a manual correction for the active cycle', () => {
    const estimate = estimateRestock(
      item([
        done('p1', '2025-12-01', '2026-01-01', 2),
        {
          id: 'p2',
          purchasedAt: '2026-02-01',
          quantity: 2,
          estimatedDurationDays: 20,
          manualEstimateDays: 8,
          notes: '',
        },
      ]),
      '2026-02-03',
    )
    expect(estimate?.basis).toBe('manual')
    expect(estimate?.confidence).toBe('manual')
    expect(estimate?.expectedDate).toBe('2026-02-09')
    expect(estimate?.daysLeft).toBe(6)
  })

  it('reports overdue items without hiding them', () => {
    const estimate = estimateRestock(item([{ ...active }]), '2026-01-20')
    expect(estimate?.daysLeft).toBe(-9)
    expect(estimate?.overdue).toBe(true)
  })

  it('has no prediction when there is no active purchase or the item is archived', () => {
    const consumed = item([{ ...done('p1', '2026-01-01', '2026-01-10', 1) }], {
      status: 'consumed',
    })
    expect(estimateRestock(consumed, '2026-01-15')).toBeNull()
    expect(getActivePurchase(consumed)).toBeUndefined()
    expect(
      estimateRestock(item([{ ...active }], { status: 'archived' }), '2026-01-05'),
    ).toBeNull()
  })

  it('counts overdue and upcoming active items in cumulative windows', () => {
    const today = '2026-01-05'
    const overdue = item([{ ...active }], { id: 'a' })
    const soon = item(
      [
        {
          id: 'b',
          purchasedAt: '2026-01-02',
          quantity: 1,
          estimatedDurationDays: 4,
          notes: '',
        },
      ],
      { id: 'b' },
    )
    const later = item(
      [
        {
          id: 'c',
          purchasedAt: '2026-01-01',
          quantity: 1,
          estimatedDurationDays: 12,
          notes: '',
        },
      ],
      { id: 'c' },
    )
    expect(getDueCounts([overdue, soon, later], today)).toEqual({ 3: 1, 7: 2, 14: 3 })
  })
})
