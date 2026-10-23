export type ProductSource = 'openfoodfacts' | 'manual'

export type ItemStatus = 'tracked' | 'consumed' | 'archived'

export type EndReason = 'consumed' | 'restocked'

export type Confidence = 'none' | 'low' | 'medium' | 'manual'

export interface ProductSnapshot {
  name: string
  brand: string
  barcode: string
  imageUrl: string
  quantityLabel: string
  source: ProductSource
  sourceUrl: string
}

export interface PurchaseCycle {
  id: string
  /** YYYY-MM-DD, local calendar date */
  purchasedAt: string
  quantity: number
  /** The household's own estimate for this purchase, used until run-out history exists. */
  estimatedDurationDays: number
  /** Optional household correction that overrides the calculated estimate for this cycle. */
  manualEstimateDays?: number
  /** YYYY-MM-DD, present once the cycle has ended. */
  endedAt?: string
  endReason?: EndReason
  notes: string
}

export interface TrackedItem {
  id: string
  product: ProductSnapshot
  unitLabel: string
  notes: string
  status: ItemStatus
  purchases: PurchaseCycle[]
  onShoppingList: boolean
  listChecked: boolean
  createdAt: string
  updatedAt: string
}

export interface HouseholdSettings {
  householdName: string
}

export interface SharePayload {
  app: 'pantry-rhythm'
  version: 1
  exportedAt: string
  householdName: string
  items: TrackedItem[]
}

export interface ProductCandidate {
  name: string
  brand: string
  barcode: string
  imageUrl: string
  quantityLabel: string
  source: ProductSource
  sourceUrl: string
}

export interface PurchaseInput {
  purchasedAt: string
  quantity: number
  estimatedDurationDays: number
  notes: string
}

export interface CreateItemInput {
  product: ProductCandidate
  unitLabel: string
  notes: string
  firstPurchase: PurchaseInput
}

export interface AddPurchaseInput extends PurchaseInput {}

export interface UpdateActivePurchaseInput {
  purchasedAt: string
  quantity: number
  estimatedDurationDays: number
  manualEstimateDays?: number
  notes: string
}

export interface UpdateCompletedPurchaseInput {
  purchasedAt: string
  endedAt: string
  quantity: number
  notes: string
}

export interface ActivePurchaseUpdate extends UpdateActivePurchaseInput {
  id: string
}

export interface Estimate {
  expectedDate: string
  earliestDate: string
  latestDate: string
  expectedDurationDays: number
  daysLeft: number
  confidence: Confidence
  basis: 'initial' | 'history' | 'manual'
  completedCycles: number
  method: string
  overdue: boolean
}

export type DueWindow = 3 | 7 | 14

export interface ImportResult {
  added: number
  skipped: number
  replaced: boolean
}
