import { describe, expect, it } from 'vitest'
import type { SharePayload } from '../types'
import {
  decodeShareToken,
  encodeSharePayload,
  isQrFriendly,
  makeSharePayload,
  makeShareUrl,
  normalizeSharePayload,
  readShareTokenFromHash,
  ShareDataError,
} from './share'

const payload: SharePayload = {
  app: 'pantry-rhythm',
  version: 1,
  exportedAt: '2026-01-15T12:00:00.000Z',
  householdName: 'The test house',
  items: [
    {
      id: 'item-1',
      product: {
        name: 'Coffee',
        brand: 'Roaster',
        barcode: '1234567890123',
        imageUrl: 'https://images.openfoodfacts.org/coffee.jpg',
        quantityLabel: '1 kg',
        source: 'openfoodfacts',
        sourceUrl: 'https://world.openfoodfacts.org/product/1234567890123',
      },
      unitLabel: 'bag',
      notes: 'Morning coffee',
      status: 'tracked',
      purchases: [
        {
          id: 'p1',
          purchasedAt: '2026-01-01',
          quantity: 1,
          estimatedDurationDays: 14,
          notes: '',
        },
      ],
      onShoppingList: false,
      listChecked: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
}

describe('share link codec', () => {
  it('round-trips a household payload through compression', async () => {
    const token = await encodeSharePayload(payload)
    expect(token.startsWith('1.')).toBe(true)
    const decoded = await decodeShareToken(token)
    expect(decoded.householdName).toBe('The test house')
    expect(decoded.items[0].product.name).toBe('Coffee')
    expect(decoded.items[0].purchases[0].purchasedAt).toBe('2026-01-01')
  })

  it('builds a hash-based URL so data is not sent to the static host', async () => {
    const token = await encodeSharePayload(payload)
    const url = makeShareUrl(token, 'https://example.test/restock/')
    expect(url).toContain('https://example.test/restock/#share=')
    expect(new URL(url).search).toBe('')
    expect(readShareTokenFromHash(new URL(url).hash)).toBe(token)
  })

  it('rejects malformed and unsupported share data', async () => {
    await expect(decodeShareToken('nope')).rejects.toBeInstanceOf(ShareDataError)
    expect(() => normalizeSharePayload({ app: 'other', version: 1, items: [] })).toThrow(
      ShareDataError,
    )
  })

  it('normalizes imported data and strips insecure images', () => {
    const normalized = normalizeSharePayload({
      ...payload,
      householdName: '  New   house  ',
      items: [
        {
          ...payload.items[0],
          product: {
            ...payload.items[0].product,
            imageUrl: 'http://example.test/insecure.jpg',
            name: '  Coffee  ',
          },
          notes: 'A '.repeat(3_000),
        },
      ],
    })
    expect(normalized.householdName).toBe('New house')
    expect(normalized.items[0].product.imageUrl).toBe('')
    expect(normalized.items[0].product.name).toBe('Coffee')
    expect(normalized.items[0].notes.length).toBe(2_000)
  })

  it('creates a normalized share payload from current items', () => {
    const made = makeSharePayload(payload.items, 'Test house')
    expect(made.app).toBe('pantry-rhythm')
    expect(made.version).toBe(1)
    expect(made.items).toHaveLength(1)
  })

  it('accepts share payloads created before the rename', () => {
    const normalized = normalizeSharePayload({ ...payload, app: 'restock-radar' })
    expect(normalized.app).toBe('pantry-rhythm')
    expect(normalized.householdName).toBe('The test house')
    expect(normalized.items).toHaveLength(1)
  })

  it('identifies links too large for a QR code', () => {
    expect(isQrFriendly('https://example.test/#share=short')).toBe(true)
    expect(isQrFriendly(`https://example.test/#share=${'a'.repeat(3_000)}`)).toBe(false)
  })
})
