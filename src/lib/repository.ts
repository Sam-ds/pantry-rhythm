import { db } from './db'
import type {
  AddPurchaseInput,
  CreateItemInput,
  HouseholdSettings,
  ImportResult,
  ProductCandidate,
  PurchaseCycle,
  TrackedItem,
  UpdateActivePurchaseInput,
  UpdateCompletedPurchaseInput,
} from '../types'
import { addDays, isDateOnly, isFutureDate, todayISO } from './dates'
import { getActivePurchase } from './prediction'
import {
  DEFAULT_HOUSEHOLD_NAME,
  makeSharePayload,
  normalizeHouseholdSettings,
  normalizeSharePayload,
} from './share'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const MAX_PURCHASES = 120

function clean(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function cleanMultiline(value: string, maxLength = 2_000): string {
  return value.slice(0, maxLength)
}

function validateProduct(product: ProductCandidate): ProductCandidate {
  const name = clean(product.name, 160)
  if (!name) throw new ValidationError('Add a product name first.')
  const brand = clean(product.brand, 160)
  const barcode = clean(product.barcode, 80)
  return {
    name,
    brand,
    barcode,
    imageUrl: product.imageUrl,
    quantityLabel: clean(product.quantityLabel, 80),
    source: product.source === 'openfoodfacts' ? 'openfoodfacts' : 'manual',
    sourceUrl: product.sourceUrl,
  }
}

function validatePurchase(input: AddPurchaseInput): AddPurchaseInput {
  if (!isDateOnly(input.purchasedAt)) {
    throw new ValidationError('Choose a valid purchase date.')
  }
  if (isFutureDate(input.purchasedAt)) {
    throw new ValidationError('The purchase date cannot be in the future.')
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 10_000) {
    throw new ValidationError('Quantity must be greater than 0.')
  }
  if (
    !Number.isFinite(input.estimatedDurationDays) ||
    input.estimatedDurationDays < 1 ||
    input.estimatedDurationDays > 3_650
  ) {
    throw new ValidationError('Estimated duration must be between 1 and 3,650 days.')
  }
  return {
    purchasedAt: input.purchasedAt,
    quantity: Math.round(input.quantity * 100) / 100,
    estimatedDurationDays: Math.round(input.estimatedDurationDays),
    notes: cleanMultiline(input.notes),
  }
}

function validateCycleOrder(purchases: PurchaseCycle[]): void {
  const ordered = [...purchases].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))
  let previousEnd: string | null = null
  for (const purchase of ordered) {
    if (previousEnd && purchase.purchasedAt < previousEnd) {
      throw new ValidationError('Purchase dates cannot overlap. Check the dates in the history.')
    }
    if (purchase.endedAt) {
      if (purchase.endedAt < purchase.purchasedAt) {
        throw new ValidationError('A run-out date cannot be before its purchase date.')
      }
      if (isFutureDate(purchase.endedAt)) {
        throw new ValidationError('A run-out date cannot be in the future.')
      }
      previousEnd = purchase.endedAt
    } else {
      previousEnd = null
    }
  }
}

function clampShareOrder(purchases: PurchaseCycle[]): PurchaseCycle[] {
  // Keep imported data internally consistent without throwing away the item.
  const ordered = [...purchases].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index]
    const next = ordered[index + 1]
    if (!current.endedAt) {
      current.endedAt = next.purchasedAt
      current.endReason = 'restocked'
    } else if (current.endedAt > next.purchasedAt) {
      current.endedAt = next.purchasedAt
    }
  }
  return ordered
}

function newPurchase(input: AddPurchaseInput): PurchaseCycle {
  return {
    id: crypto.randomUUID(),
    purchasedAt: input.purchasedAt,
    quantity: input.quantity,
    estimatedDurationDays: input.estimatedDurationDays,
    notes: input.notes,
  }
}

async function touch(itemId: string, updater: (item: TrackedItem) => TrackedItem): Promise<TrackedItem> {
  const existing = await db.items.get(itemId)
  if (!existing) throw new ValidationError('This item no longer exists.')
  const updated = updater(existing)
  updated.updatedAt = new Date().toISOString()
  await db.items.put(updated)
  return updated
}

async function rememberProduct(product: ProductCandidate): Promise<void> {
  const key = product.barcode ? `barcode:${product.barcode}` : `name:${product.name.toLowerCase()}`
  await db.recentProducts.put({
    id: key,
    product,
    lastSeenAt: new Date().toISOString(),
  })
  const all = await db.recentProducts.orderBy('lastSeenAt').reverse().toArray()
  if (all.length > 24) {
    await db.recentProducts.bulkDelete(all.slice(24).map((row) => row.id))
  }
}

export async function createTrackedItem(input: CreateItemInput): Promise<TrackedItem> {
  const product = validateProduct(input.product)
  const purchase = validatePurchase(input.firstPurchase)
  const now = new Date().toISOString()
  const item: TrackedItem = {
    id: crypto.randomUUID(),
    product,
    unitLabel: clean(input.unitLabel, 30) || 'item',
    notes: cleanMultiline(input.notes),
    status: 'tracked',
    purchases: [newPurchase(purchase)],
    onShoppingList: false,
    listChecked: false,
    createdAt: now,
    updatedAt: now,
  }
  await db.items.put(item)
  await rememberProduct(product)
  return item
}

export async function addPurchase(
  itemId: string,
  input: AddPurchaseInput,
): Promise<TrackedItem> {
  const purchase = validatePurchase(input)
  const updated = await touch(itemId, (item) => {
    if (item.purchases.length >= MAX_PURCHASES) {
      throw new ValidationError('This item has reached the history limit for one product.')
    }
    const active = getActivePurchase(item)
    const purchases = item.purchases.map((cycle) => ({ ...cycle }))
    if (active) {
      if (purchase.purchasedAt < active.purchasedAt) {
        throw new ValidationError('The new purchase must be on or after the current purchase date.')
      }
      const target = purchases.find((cycle) => cycle.id === active.id)
      if (target) {
        target.endedAt = purchase.purchasedAt
        target.endReason = 'restocked'
      }
    }
    purchases.push(newPurchase(purchase))
    return {
      ...item,
      purchases,
      status: 'tracked',
      onShoppingList: false,
      listChecked: false,
    }
  })
  return updated
}

export async function markConsumed(
  itemId: string,
  endedAt: string,
  notes = '',
): Promise<TrackedItem> {
  if (!isDateOnly(endedAt)) throw new ValidationError('Choose a valid run-out date.')
  if (isFutureDate(endedAt)) throw new ValidationError('The run-out date cannot be in the future.')
  return touch(itemId, (item) => {
    const active = getActivePurchase(item)
    if (!active) throw new ValidationError('There is no active purchase to mark as consumed.')
    if (endedAt < active.purchasedAt) {
      throw new ValidationError('The run-out date cannot be before the purchase date.')
    }
    return {
      ...item,
      status: 'consumed',
      onShoppingList: false,
      listChecked: false,
      purchases: item.purchases.map((cycle) =>
        cycle.id === active.id
          ? {
              ...cycle,
              endedAt,
              endReason: 'consumed',
              notes: notes
                ? cleanMultiline([cycle.notes, notes].filter(Boolean).join(' — '))
                : cycle.notes,
            }
          : cycle,
      ),
    }
  })
}

export async function undoConsumption(itemId: string): Promise<TrackedItem> {
  return touch(itemId, (item) => {
    if (getActivePurchase(item)) {
      throw new ValidationError('This item already has an active purchase.')
    }
    const latest = [...item.purchases].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))[0]
    if (!latest || latest.endReason !== 'consumed') {
      throw new ValidationError('The latest cycle was not marked as consumed.')
    }
    return {
      ...item,
      status: 'tracked',
      purchases: item.purchases.map((cycle) =>
        cycle.id === latest.id
          ? { ...cycle, endedAt: undefined, endReason: undefined }
          : cycle,
      ),
    }
  })
}

export async function archiveItem(itemId: string): Promise<TrackedItem> {
  return touch(itemId, (item) => ({
    ...item,
    status: 'archived',
    onShoppingList: false,
    listChecked: false,
  }))
}

export async function restoreItem(itemId: string): Promise<TrackedItem> {
  return touch(itemId, (item) => ({
    ...item,
    status: getActivePurchase(item) ? 'tracked' : 'consumed',
  }))
}

export async function deleteItem(itemId: string): Promise<void> {
  await db.items.delete(itemId)
}

export async function updateItemDetails(
  itemId: string,
  details: {
    name: string
    brand: string
    barcode: string
    quantityLabel: string
    unitLabel: string
    notes: string
  },
): Promise<TrackedItem> {
  const name = clean(details.name, 160)
  if (!name) throw new ValidationError('Product name cannot be empty.')
  return touch(itemId, (item) => ({
    ...item,
    product: {
      ...item.product,
      name,
      brand: clean(details.brand, 160),
      barcode: clean(details.barcode, 80),
      quantityLabel: clean(details.quantityLabel, 80),
    },
    unitLabel: clean(details.unitLabel, 30) || 'item',
    notes: cleanMultiline(details.notes),
  }))
}

export async function updateActivePurchase(
  itemId: string,
  purchaseId: string,
  input: UpdateActivePurchaseInput,
): Promise<TrackedItem> {
  if (!isDateOnly(input.purchasedAt) || isFutureDate(input.purchasedAt)) {
    throw new ValidationError('Choose a purchase date that is not in the future.')
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new ValidationError('Quantity must be greater than 0.')
  }
  if (
    !Number.isFinite(input.estimatedDurationDays) ||
    input.estimatedDurationDays < 1 ||
    input.estimatedDurationDays > 3_650
  ) {
    throw new ValidationError('Estimated duration must be between 1 and 3,650 days.')
  }
  if (
    input.manualEstimateDays !== undefined &&
    (!Number.isFinite(input.manualEstimateDays) ||
      input.manualEstimateDays < 1 ||
      input.manualEstimateDays > 3_650)
  ) {
    throw new ValidationError('A corrected estimate must be between 1 and 3,650 days.')
  }

  return touch(itemId, (item) => {
    const purchases = item.purchases.map((cycle) =>
      cycle.id === purchaseId
        ? {
            ...cycle,
            purchasedAt: input.purchasedAt,
            quantity: Math.round(input.quantity * 100) / 100,
            estimatedDurationDays: Math.round(input.estimatedDurationDays),
            manualEstimateDays:
              input.manualEstimateDays === undefined
                ? undefined
                : Math.round(input.manualEstimateDays),
            notes: cleanMultiline(input.notes),
          }
        : cycle,
    )
    validateCycleOrder(purchases)
    return { ...item, purchases }
  })
}

export async function updateCompletedPurchase(
  itemId: string,
  purchaseId: string,
  input: UpdateCompletedPurchaseInput,
): Promise<TrackedItem> {
  if (!isDateOnly(input.purchasedAt) || !isDateOnly(input.endedAt)) {
    throw new ValidationError('Choose valid dates.')
  }
  if (isFutureDate(input.purchasedAt) || isFutureDate(input.endedAt)) {
    throw new ValidationError('Dates cannot be in the future.')
  }
  if (input.endedAt < input.purchasedAt) {
    throw new ValidationError('The run-out date must be on or after the purchase date.')
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new ValidationError('Quantity must be greater than 0.')
  }
  return touch(itemId, (item) => {
    const purchases = item.purchases.map((cycle) =>
      cycle.id === purchaseId
        ? {
            ...cycle,
            purchasedAt: input.purchasedAt,
            endedAt: input.endedAt,
            quantity: Math.round(input.quantity * 100) / 100,
            endReason: 'consumed' as const,
            notes: cleanMultiline(input.notes),
          }
        : cycle,
    )
    validateCycleOrder(purchases)
    return { ...item, purchases }
  })
}

export async function deletePurchase(itemId: string, purchaseId: string): Promise<TrackedItem> {
  return touch(itemId, (item) => {
    const remaining = item.purchases.filter((cycle) => cycle.id !== purchaseId)
    const status =
      item.status !== 'archived' && !getActivePurchase({ ...item, purchases: remaining })
        ? 'consumed'
        : item.status
    return {
      ...item,
      purchases: remaining,
      status,
    }
  })
}

export async function setShoppingList(
  itemId: string,
  onList: boolean,
): Promise<TrackedItem> {
  return touch(itemId, (item) => ({
    ...item,
    onShoppingList: onList,
    listChecked: onList ? item.listChecked : false,
  }))
}

export async function setListChecked(itemId: string, checked: boolean): Promise<TrackedItem> {
  return touch(itemId, (item) => ({ ...item, listChecked: checked }))
}

export async function clearCheckedItems(): Promise<void> {
  const checked = await db.items.filter((item) => item.listChecked).toArray()
  await db.items.bulkPut(
    checked.map((item) => ({
      ...item,
      listChecked: false,
      updatedAt: new Date().toISOString(),
    })),
  )
}

export async function getHouseholdName(): Promise<string> {
  const row = await db.meta.get('household')
  const settings = normalizeHouseholdSettings(row?.value)
  return settings.householdName
}

export async function saveHouseholdName(householdName: string): Promise<void> {
  const cleanName = clean(householdName, 160) || DEFAULT_HOUSEHOLD_NAME
  await db.meta.put({ key: 'household', value: { householdName: cleanName } })
}

export async function getHouseholdSettings(): Promise<HouseholdSettings> {
  const row = await db.meta.get('household')
  return normalizeHouseholdSettings(row?.value)
}

export async function exportAllData() {
  const [items, name] = await Promise.all([db.items.toArray(), getHouseholdName()])
  const ordered = [...items].sort((a, b) => a.product.name.localeCompare(b.product.name))
  return makeSharePayload(ordered, name)
}

export async function importSharedData(
  rawPayload: unknown,
  mode: 'merge' | 'replace',
): Promise<ImportResult> {
  const payload = normalizeSharePayload(rawPayload)
  let added = 0
  let skipped = 0
  const now = new Date().toISOString()

  await db.transaction('rw', db.items, db.meta, async () => {
    if (mode === 'replace') {
      await db.items.clear()
    }
    const existingIds = new Set((await db.items.toCollection().primaryKeys()) as string[])
    for (const item of payload.items) {
      if (mode === 'merge' && existingIds.has(item.id)) {
        skipped += 1
        continue
      }
      const normalized = {
        ...item,
        purchases: clampShareOrder(item.purchases),
        updatedAt: now,
      }
      await db.items.put(normalized)
      added += 1
    }
    if (mode === 'replace') {
      await db.meta.put({
        key: 'household',
        value: { householdName: payload.householdName },
      })
    }
  })

  return { added, skipped, replaced: mode === 'replace' }
}

export async function resetAllData(): Promise<void> {
  await db.transaction('rw', db.items, db.meta, db.recentProducts, async () => {
    await db.items.clear()
    await db.meta.clear()
    await db.recentProducts.clear()
  })
}

function completedCycle(
  today: string,
  endDaysAgo: number,
  durationDays: number,
  quantity: number,
  notes = '',
): PurchaseCycle {
  return {
    id: crypto.randomUUID(),
    purchasedAt: addDays(today, -(endDaysAgo + durationDays)),
    endedAt: addDays(today, -endDaysAgo),
    endReason: 'consumed',
    quantity,
    estimatedDurationDays: durationDays,
    notes,
  }
}

function activeCycle(
  today: string,
  ageDays: number,
  quantity: number,
  estimatedDurationDays: number,
): PurchaseCycle {
  return {
    id: crypto.randomUUID(),
    purchasedAt: addDays(today, -ageDays),
    quantity,
    estimatedDurationDays,
    notes: '',
  }
}

/**
 * Adds a small, clearly editable demo household. It only runs when the user
 * taps the demo button and is intended to show how history and uncertainty
 * work. Real data is never mixed in automatically.
 */
export async function seedDemoData(): Promise<void> {
  const today = todayISO()
  const createdAt = new Date().toISOString()
  const manual = (name: string, brand: string) => ({
    name,
    brand,
    barcode: '',
    imageUrl: '',
    quantityLabel: '',
    source: 'manual' as const,
    sourceUrl: '',
  })

  const items: TrackedItem[] = [
    {
      id: crypto.randomUUID(),
      product: {
        name: 'Barista oat milk',
        brand: 'Oatly',
        barcode: '7394376616228',
        imageUrl:
          'https://images.openfoodfacts.org/images/products/739/437/661/6228/front_en.197.200.jpg',
        quantityLabel: '1 l',
        source: 'openfoodfacts',
        sourceUrl: 'https://world.openfoodfacts.org/product/7394376616228',
      },
      unitLabel: 'carton',
      notes: 'Mainly for coffee. Everyone uses it.',
      status: 'tracked',
      purchases: [
        completedCycle(today, 20, 12, 6),
        completedCycle(today, 8, 10, 6),
        activeCycle(today, 8, 6, 7),
      ],
      onShoppingList: false,
      listChecked: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: crypto.randomUUID(),
      product: manual('Butter', 'Local dairy'),
      unitLabel: 'block',
      notes: 'Baking and toast.',
      status: 'tracked',
      purchases: [activeCycle(today, 4, 2, 9)],
      onShoppingList: false,
      listChecked: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: crypto.randomUUID(),
      product: manual('Sparkling water', 'Good Day'),
      unitLabel: 'can',
      notes: 'Fridge supply — empties fast when guests visit.',
      status: 'tracked',
      purchases: [
        completedCycle(today, 23, 14, 12),
        completedCycle(today, 9, 16, 12),
        activeCycle(today, 9, 12, 15),
      ],
      onShoppingList: false,
      listChecked: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: crypto.randomUUID(),
      product: manual('Coffee beans', 'Sunday Roast'),
      unitLabel: 'bag',
      notes: 'Two espressos most mornings.',
      status: 'tracked',
      purchases: [
        completedCycle(today, 50, 30, 2, 'A little longer than usual.'),
        completedCycle(today, 20, 28, 2),
        activeCycle(today, 20, 2, 30),
      ],
      onShoppingList: false,
      listChecked: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: crypto.randomUUID(),
      product: manual('Paper towels', 'Everyday'),
      unitLabel: 'roll',
      notes: 'Kept under the sink.',
      status: 'tracked',
      purchases: [
        completedCycle(today, 71, 45, 4),
        completedCycle(today, 26, 46, 4),
        activeCycle(today, 25, 4, 42),
      ],
      onShoppingList: true,
      listChecked: false,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: crypto.randomUUID(),
      product: manual('Dish soap', 'Clear Wash'),
      unitLabel: 'bottle',
      notes: 'Out. Usually lasts about two months.',
      status: 'consumed',
      purchases: [
        {
          id: crypto.randomUUID(),
          purchasedAt: addDays(today, -72),
          quantity: 1,
          estimatedDurationDays: 60,
          endedAt: addDays(today, -3),
          endReason: 'consumed',
          notes: '',
        },
      ],
      onShoppingList: true,
      listChecked: false,
      createdAt,
      updatedAt: createdAt,
    },
  ]

  await db.transaction('rw', db.items, async () => {
    await db.items.bulkPut(items)
  })
}
