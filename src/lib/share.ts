import type {
  HouseholdSettings,
  ProductSource,
  PurchaseCycle,
  SharePayload,
  TrackedItem,
} from '../types'
import { isDateOnly } from './dates'

const MAX_ITEMS = 300
const MAX_PURCHASES_PER_ITEM = 120
const MAX_NAME = 160
const MAX_NOTES = 2_000
const MAX_TEXT = 1_200

export const SHARE_APP_ID = 'pantry-rhythm'
/** Links and backups created before the rename stay importable. */
const LEGACY_SHARE_APP_IDS = ['restock-radar']

export const DEFAULT_HOUSEHOLD_NAME = 'Our household'

export class ShareDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareDataError'
  }
}

function text(value: unknown, maxLength = MAX_TEXT): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}

function multilineText(value: unknown, maxLength = MAX_NOTES): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function bool(value: unknown): boolean {
  return value === true
}

function httpsUrl(value: unknown): string {
  const candidate = text(value, MAX_TEXT)
  if (!candidate) return ''
  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function source(value: unknown): ProductSource {
  return value === 'openfoodfacts' ? 'openfoodfacts' : 'manual'
}

function finite(value: unknown, min: number, max: number, fallback?: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(number) && number >= min && number <= max) return number
  if (fallback !== undefined) return fallback
  throw new ShareDataError('A shared item contains an invalid quantity or duration.')
}

function optionalFinite(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return finite(value, min, max)
}

function isoDateTime(value: unknown): string {
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  return new Date().toISOString()
}

function normalizePurchase(raw: unknown): PurchaseCycle | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  if (!isDateOnly(value.purchasedAt)) return null
  let endedAt: string | undefined
  let endReason: PurchaseCycle['endReason']
  if (isDateOnly(value.endedAt)) {
    endedAt = value.endedAt
    endReason = value.endReason === 'restocked' ? 'restocked' : 'consumed'
    if (endedAt < value.purchasedAt) return null
  }
  return {
    id: text(value.id, 100) || crypto.randomUUID(),
    purchasedAt: value.purchasedAt,
    quantity: finite(value.quantity, 0.01, 10_000),
    estimatedDurationDays: finite(value.estimatedDurationDays, 1, 3_650),
    manualEstimateDays: optionalFinite(value.manualEstimateDays, 1, 3_650),
    endedAt,
    endReason,
    notes: multilineText(value.notes),
  }
}

function normalizeItem(raw: unknown): TrackedItem | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const productValue =
    value.product && typeof value.product === 'object'
      ? (value.product as Record<string, unknown>)
      : null
  if (!productValue) return null

  const name = text(productValue.name, MAX_NAME)
  if (!name) return null

  const purchasesRaw = Array.isArray(value.purchases) ? value.purchases.slice(0, MAX_PURCHASES_PER_ITEM) : []
  const purchases = purchasesRaw
    .map(normalizePurchase)
    .filter((purchase): purchase is PurchaseCycle => purchase !== null)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))

  // Make malformed data safe: only the newest un-ended purchase can be active.
  let activeSeen = false
  for (let index = purchases.length - 1; index >= 0; index -= 1) {
    const purchase = purchases[index]
    if (!purchase.endedAt) {
      if (activeSeen) {
        purchase.endedAt = purchases[index + 1]?.purchasedAt ?? purchase.purchasedAt
        purchase.endReason = 'restocked'
      }
      activeSeen = true
    }
  }

  const status =
    value.status === 'archived'
      ? 'archived'
      : value.status === 'consumed'
        ? 'consumed'
        : 'tracked'

  return {
    id: text(value.id, 100) || crypto.randomUUID(),
    product: {
      name,
      brand: text(productValue.brand, MAX_NAME),
      barcode: text(productValue.barcode, 80),
      imageUrl: httpsUrl(productValue.imageUrl),
      quantityLabel: text(productValue.quantityLabel, 80),
      source: source(productValue.source),
      sourceUrl: httpsUrl(productValue.sourceUrl),
    },
    unitLabel: text(value.unitLabel, 30) || 'item',
    notes: multilineText(value.notes),
    status,
    purchases,
    onShoppingList: bool(value.onShoppingList),
    listChecked: bool(value.listChecked),
    createdAt: isoDateTime(value.createdAt),
    updatedAt: isoDateTime(value.updatedAt),
  }
}

export function normalizeSharePayload(raw: unknown): SharePayload {
  if (!raw || typeof raw !== 'object') {
    throw new ShareDataError('This share link does not contain Pantry Rhythm data.')
  }
  const value = raw as Record<string, unknown>
  const knownApp =
    value.app === SHARE_APP_ID ||
    (typeof value.app === 'string' && LEGACY_SHARE_APP_IDS.includes(value.app))
  if (!knownApp || value.version !== 1) {
    throw new ShareDataError('Unsupported share format. Ask the sender to update Pantry Rhythm.')
  }
  if (!Array.isArray(value.items)) {
    throw new ShareDataError('This share link is missing its item list.')
  }

  const seenIds = new Set<string>()
  const items = value.items
    .slice(0, MAX_ITEMS)
    .map(normalizeItem)
    .filter((item): item is TrackedItem => item !== null)
    .filter((item) => {
      if (seenIds.has(item.id)) return false
      seenIds.add(item.id)
      return true
    })

  if (value.items.length > 0 && items.length === 0) {
    throw new ShareDataError('No valid items were found in this share link.')
  }

  return {
    app: SHARE_APP_ID,
    version: 1,
    exportedAt: isoDateTime(value.exportedAt),
    householdName: text(value.householdName, MAX_NAME) || DEFAULT_HOUSEHOLD_NAME,
    items,
  }
}

export function makeSharePayload(
  items: TrackedItem[],
  householdName: string,
): SharePayload {
  return normalizeSharePayload({
    app: SHARE_APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    householdName,
    items,
  })
}

export function normalizeHouseholdSettings(raw: unknown): HouseholdSettings {
  if (!raw || typeof raw !== 'object') {
    return { householdName: DEFAULT_HOUSEHOLD_NAME }
  }
  const value = raw as Record<string, unknown>
  return { householdName: text(value.householdName, MAX_NAME) || DEFAULT_HOUSEHOLD_NAME }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function toBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return base64ToBytes(padded)
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new ShareDataError('This browser cannot open compressed share links.')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

export async function encodeSharePayload(payload: SharePayload): Promise<string> {
  const normalized = normalizeSharePayload(payload)
  const bytes = encoder.encode(JSON.stringify(normalized))
  const compressed = await gzip(bytes)
  if (compressed) return `1.${toBase64Url(compressed)}`
  return `0.${toBase64Url(bytes)}`
}

export async function decodeShareToken(token: string): Promise<SharePayload> {
  if (!token || !/^[01]\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new ShareDataError('This share link is incomplete or malformed.')
  }
  const [mode, body] = token.split('.', 2)
  let bytes: Uint8Array
  try {
    bytes = fromBase64Url(body)
    if (mode === '1') bytes = await gunzip(bytes)
  } catch (error) {
    if (error instanceof ShareDataError) throw error
    throw new ShareDataError('This share link appears to be damaged.')
  }

  try {
    const json = JSON.parse(decoder.decode(bytes))
    return normalizeSharePayload(json)
  } catch (error) {
    if (error instanceof ShareDataError) throw error
    throw new ShareDataError('This share link contains data Pantry Rhythm cannot read.')
  }
}

export function makeShareUrl(token: string, baseUrl?: string): string {
  const url = new URL(baseUrl || window.location.href)
  url.hash = `share=${token}`
  return url.toString()
}

export function readShareTokenFromHash(hash: string): string | null {
  if (!hash) return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  return params.get('share')
}

export function shareSizeLabel(url: string): string {
  if (url.length < 1_500) return 'Small enough for a QR code'
  if (url.length < 2_750) return 'Large QR code'
  return 'Too large for a QR code'
}

export function isQrFriendly(url: string): boolean {
  return url.length <= 2_750
}
