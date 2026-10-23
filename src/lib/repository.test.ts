import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addPurchase,
  archiveItem,
  createTrackedItem,
  deleteItem,
  exportAllData,
  importSharedData,
  markConsumed,
  saveHouseholdName,
  seedDemoData,
  setListChecked,
  setShoppingList,
  undoConsumption,
  updateActivePurchase,
  ValidationError,
} from './repository'
import { getActivePurchase, getCompletedCycles } from './prediction'
import { addDays, todayISO } from './dates'

const baseInput = {
  product: {
    name: 'Test oats',
    brand: 'Test brand',
    barcode: '1234567890123',
    imageUrl: '',
    quantityLabel: '500 g',
    source: 'manual' as const,
    sourceUrl: '',
  },
  unitLabel: 'bag',
  notes: 'Test notes',
  firstPurchase: {
    purchasedAt: '2026-01-01',
    quantity: 2,
    estimatedDurationDays: 20,
    notes: 'First bag',
  },
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('local repository', () => {
  it('creates a manual tracked item with an active purchase', async () => {
    const item = await createTrackedItem(baseInput)
    expect(item.product.name).toBe('Test oats')
    expect(item.status).toBe('tracked')
    expect(item.product.source).toBe('manual')
    expect(getActivePurchase(item)?.quantity).toBe(2)
    expect(await db.items.count()).toBe(1)
  })

  it('records subsequent purchases and closes the previous cycle as a restock', async () => {
    const item = await createTrackedItem(baseInput)
    const updated = await addPurchase(item.id, {
      purchasedAt: '2026-01-15',
      quantity: 1,
      estimatedDurationDays: 14,
      notes: '',
    })
    expect(updated.purchases).toHaveLength(2)
    const previous = updated.purchases.find((purchase) => purchase.id === item.purchases[0].id)
    expect(previous?.endedAt).toBe('2026-01-15')
    expect(previous?.endReason).toBe('restocked')
    expect(getActivePurchase(updated)?.quantity).toBe(1)
    expect(getCompletedCycles(updated)).toHaveLength(0)
  })

  it('marks an item consumed and turns the cycle into prediction history', async () => {
    const item = await createTrackedItem(baseInput)
    const consumed = await markConsumed(item.id, '2026-01-21', 'Used faster than expected')
    expect(consumed.status).toBe('consumed')
    expect(getActivePurchase(consumed)).toBeUndefined()
    expect(getCompletedCycles(consumed)).toHaveLength(1)
    expect(consumed.purchases[0].notes).toContain('Used faster than expected')
  })

  it('undoes a consumption correction', async () => {
    const item = await createTrackedItem(baseInput)
    await markConsumed(item.id, '2026-01-21')
    const restored = await undoConsumption(item.id)
    expect(restored.status).toBe('tracked')
    expect(getActivePurchase(restored)?.id).toBe(item.purchases[0].id)
  })

  it('validates dates and durations', async () => {
    await expect(
      createTrackedItem({
        ...baseInput,
        firstPurchase: { ...baseInput.firstPurchase, purchasedAt: addDays(todayISO(), 1) },
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    const item = await createTrackedItem(baseInput)
    await expect(markConsumed(item.id, '2025-12-31')).rejects.toBeInstanceOf(ValidationError)
  })

  it('applies a manual prediction correction to the active purchase', async () => {
    const item = await createTrackedItem(baseInput)
    const updated = await updateActivePurchase(item.id, item.purchases[0].id, {
      purchasedAt: '2026-01-01',
      quantity: 2,
      estimatedDurationDays: 20,
      manualEstimateDays: 12,
      notes: 'Corrected after a big breakfast week',
    })
    expect(updated.purchases[0].manualEstimateDays).toBe(12)
  })

  it('persists shopping list state and allows archiving and deletion', async () => {
    const item = await createTrackedItem(baseInput)
    await setShoppingList(item.id, true)
    await setListChecked(item.id, true)
    let stored = await db.items.get(item.id)
    expect(stored?.onShoppingList).toBe(true)
    expect(stored?.listChecked).toBe(true)

    await archiveItem(item.id)
    stored = await db.items.get(item.id)
    expect(stored?.status).toBe('archived')
    expect(stored?.onShoppingList).toBe(false)

    await deleteItem(item.id)
    expect(await db.items.count()).toBe(0)
  })

  it('exports and imports all data, skipping duplicates when merging', async () => {
    await saveHouseholdName('Test house')
    const item = await createTrackedItem(baseInput)
    const payload = await exportAllData()
    expect(payload.householdName).toBe('Test house')
    expect(payload.items).toHaveLength(1)

    const merged = await importSharedData(payload, 'merge')
    expect(merged.added).toBe(0)
    expect(merged.skipped).toBe(1)

    const replaced = await importSharedData(payload, 'replace')
    expect(replaced.added).toBe(1)
    expect(await db.items.count()).toBe(1)
    expect((await db.items.get(item.id))?.product.name).toBe('Test oats')
  })

  it('seeds a demo household with useful due items', async () => {
    await seedDemoData()
    expect(await db.items.count()).toBe(6)
    const items = await db.items.toArray()
    expect(items.some((item) => item.status === 'consumed')).toBe(true)
    expect(items.some((item) => item.onShoppingList)).toBe(true)
  })
})
