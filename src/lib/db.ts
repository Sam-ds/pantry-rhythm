import Dexie, { type Table } from 'dexie'
import type { ProductCandidate, TrackedItem } from '../types'

export interface MetaRow {
  key: string
  value: unknown
}

export interface RecentProductRow {
  id: string
  product: ProductCandidate
  lastSeenAt: string
}

/**
 * The IndexedDB name intentionally keeps its original value. Renaming the app
 * should not hide an existing household's local data, so this identifier is
 * treated as a stable storage key rather than branding.
 */
const DATABASE_NAME = 'restock-radar'

export class PantryDatabase extends Dexie {
  items!: Table<TrackedItem, string>
  meta!: Table<MetaRow, string>
  recentProducts!: Table<RecentProductRow, string>

  constructor(name = DATABASE_NAME) {
    super(name)
    this.version(1).stores({
      items: 'id, status, updatedAt',
      meta: 'key',
      recentProducts: 'id, lastSeenAt',
    })
  }
}

export const db = new PantryDatabase()
