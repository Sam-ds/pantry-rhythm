import type { ProductCandidate } from '../types'

const SEARCH_PROXY = import.meta.env.VITE_OFF_SEARCH_URL || '/api/off-search'
const PRODUCT_PROXY = import.meta.env.VITE_OFF_PRODUCT_URL || '/api/off-product'
const LEGACY_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl'
const PRODUCT_API = 'https://world.openfoodfacts.org/api/v2/product'

const SEARCH_CACHE_TTL_MS = 10 * 60_000
const PRODUCT_CACHE_TTL_MS = 60 * 60_000
const COOLDOWN_MS = 60_000
const MAX_CACHE_ENTRIES = 40

const SEARCH_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'quantity',
  'image_front_small_url',
  'image_front_url',
].join(',')

const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'image_front_small_url',
  'image_front_url',
].join(',')

export type LookupErrorCode = 'not-found' | 'unavailable' | 'offline' | 'invalid-barcode'

export class ProductLookupError extends Error {
  code: LookupErrorCode

  constructor(message: string, code: LookupErrorCode) {
    super(message)
    this.name = 'ProductLookupError'
    this.code = code
  }
}

/**
 * Raised when a proxy route is absent (for example, a static host that does not
 * run the Cloudflare Functions). This is the only case where we fall back to a
 * direct browser request, so we never double-query Open Food Facts because of a
 * genuine service error or rate limit.
 */
class ProxyMissingError extends Error {}

interface OffSearchHit {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string | string[]
  quantity?: string
  image_front_small_url?: string
  image_front_url?: string
}

interface OffSearchResponse {
  hits?: OffSearchHit[]
  products?: OffSearchHit[]
}

interface OffProductResponse {
  status?: number
  product?: OffSearchHit & { generic_name?: string }
}

interface CacheEntry<T> {
  expiresAt: number
  value: T
}

const searchCache = new Map<string, CacheEntry<ProductCandidate[]>>()
const productCache = new Map<string, CacheEntry<ProductCandidate>>()
const inFlight = new Map<string, Promise<unknown>>()

let cooldownUntil = 0

/**
 * Once a static host has answered the optional proxy route with HTML/404, stop
 * probing it for the rest of the session. This avoids a console error and an
 * extra round-trip on every later lookup. GitHub Pages cannot run the Functions
 * route at all, so skip the first probe there unless an absolute Worker URL was
 * configured at build time.
 */
const localProxy = SEARCH_PROXY.startsWith('/') || PRODUCT_PROXY.startsWith('/')
const staticGithubHost =
  typeof location !== 'undefined' && /(^|\.)github\.io$/i.test(location.hostname)
let proxyUnavailable = localProxy && staticGithubHost

function pruneCache<T>(cache: Map<string, CacheEntry<T>>): void {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

function assertNotCoolingDown(): void {
  const remaining = cooldownUntil - Date.now()
  if (remaining > 0) {
    throw new ProductLookupError(
      `Open Food Facts asked us to slow down. Try again in ${Math.ceil(
        remaining / 1_000,
      )} seconds, or add the product manually.`,
      'unavailable',
    )
  }
}

function startCooldown(): void {
  cooldownUntil = Date.now() + COOLDOWN_MS
}

function cleanText(value: unknown, maxLength = 240): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function normalizeBrand(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => cleanText(entry, 100)).filter(Boolean).join(', ')
  }
  return cleanText(value, 160)
}

function safeImageUrl(value: unknown): string {
  const url = cleanText(value, 1_200)
  try {
    const parsed = new URL(url)
    const allowedHost = parsed.hostname === 'images.openfoodfacts.org'
    return parsed.protocol === 'https:' && allowedHost ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function mapHit(hit: OffSearchHit): ProductCandidate | null {
  const barcode = cleanText(hit.code, 40)
  const name = cleanText(hit.product_name) || cleanText(hit.product_name_en)
  if (!barcode || !name) return null
  return {
    name,
    brand: normalizeBrand(hit.brands),
    barcode,
    imageUrl: safeImageUrl(hit.image_front_small_url) || safeImageUrl(hit.image_front_url),
    quantityLabel: cleanText(hit.quantity, 80),
    source: 'openfoodfacts',
    sourceUrl: productPageUrl(barcode),
  }
}

export function productPageUrl(barcode: string): string {
  return `https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`
}

/**
 * Public Open Food Facts search page, for when the API cannot be reached (for
 * example, a static host without the proxy whose legacy endpoint fails CORS).
 */
export function offSearchPageUrl(query: string): string {
  return `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    query,
  )}&search_simple=1&action=process`
}

async function fetchJson(
  url: string,
  signal: AbortSignal | undefined,
  options: { proxy: boolean },
): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ProductLookupError(
      'You appear to be offline. You can still add the product manually.',
      'offline',
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 14_000)
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch {
    if (signal?.aborted) {
      throw new ProductLookupError('The product lookup was cancelled.', 'unavailable')
    }
    throw new ProductLookupError(
      'The product service took too long or could not be reached. You can still add this product manually.',
      'unavailable',
    )
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }

  const contentType = response.headers.get('content-type') || ''
  const looksLikeJson = contentType.includes('json')

  // A static host without the Functions route answers with HTML (or a 404 page),
  // not with an Open Food Facts error. Treat that as "proxy missing" so the
  // caller can decide whether a direct request is appropriate.
  if (options.proxy && !looksLikeJson && (response.ok || response.status === 404)) {
    throw new ProxyMissingError('The optional Open Food Facts proxy is not deployed.')
  }

  if (response.status === 429) {
    startCooldown()
    throw new ProductLookupError(
      'Open Food Facts rate limit reached. Wait a minute, then try again — or add the product manually.',
      'unavailable',
    )
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new ProductLookupError('No product found for that barcode.', 'not-found')
    }
    throw new ProductLookupError(
      'Open Food Facts is unavailable right now. Add the product manually or try again shortly.',
      'unavailable',
    )
  }

  try {
    return await response.json()
  } catch {
    throw new ProductLookupError(
      'The product service returned an unexpected response. Add the item manually.',
      'unavailable',
    )
  }
}

function buildSearchPath(query: string): string {
  const params = new URLSearchParams({
    q: query,
    page_size: '15',
    fields: SEARCH_FIELDS,
  })
  return `${SEARCH_PROXY}?${params.toString()}`
}

function buildLegacySearchPath(query: string): string {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '15',
    fields: SEARCH_FIELDS,
  })
  return `${LEGACY_SEARCH}?${params.toString()}`
}

function buildProductPath(barcode: string): string {
  return `${PRODUCT_PROXY}?barcode=${encodeURIComponent(barcode)}`
}

function buildDirectProductPath(barcode: string): string {
  const params = new URLSearchParams({ fields: PRODUCT_FIELDS })
  return `${PRODUCT_API}/${encodeURIComponent(barcode)}.json?${params.toString()}`
}

function mapSearchResponse(data: OffSearchResponse): ProductCandidate[] {
  const hits = Array.isArray(data.hits) ? data.hits : data.products
  if (!Array.isArray(hits)) return []
  return hits
    .map(mapHit)
    .filter((hit): hit is ProductCandidate => hit !== null)
    .filter((hit, index, all) => all.findIndex((entry) => entry.barcode === hit.barcode) === index)
}

async function runSearch(query: string, signal?: AbortSignal): Promise<ProductCandidate[]> {
  let proxyMissing = proxyUnavailable
  if (!proxyMissing) {
    try {
      const data = (await fetchJson(buildSearchPath(query), signal, { proxy: true })) as
        | OffSearchResponse
        | undefined
      if (data) return mapSearchResponse(data)
    } catch (error) {
      if (error instanceof ProxyMissingError) {
        proxyMissing = true
        proxyUnavailable = true
      } else throw error
    }
  }

  // Only static hosts without the proxy take this path. The direct legacy
  // endpoint is best-effort and may be blocked by CORS in some browsers.
  if (proxyMissing) {
    try {
      const data = (await fetchJson(buildLegacySearchPath(query), signal, {
        proxy: false,
      })) as OffSearchResponse
      return mapSearchResponse(data)
    } catch (error) {
      if (error instanceof ProductLookupError) {
        if (error.code === 'offline') throw error
        if (error.message.includes('slow down')) throw error
      }
      throw new ProductLookupError(
        'Search is unavailable from this static copy of the app. Barcode lookup and manual entry still work — or open the Open Food Facts search below.',
        'unavailable',
      )
    }
  }

  return []
}

/**
 * Searches Open Food Facts on an explicit submit only (never per keystroke).
 *
 * The preferred route is the tiny, stateless proxy (Vite in local development,
 * Cloudflare Pages Functions in production) which adds a descriptive
 * User-Agent and handles upstream CORS. Identical successful searches are
 * cached for ten minutes, concurrent duplicates share one request, and a 429
 * puts lookups on a short local cooldown.
 */
export async function searchProducts(
  query: string,
  signal?: AbortSignal,
): Promise<ProductCandidate[]> {
  const trimmed = cleanText(query, 120)
  if (trimmed.length < 2) return []

  const key = trimmed.toLowerCase()
  const cached = searchCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  assertNotCoolingDown()

  const flightKey = `search:${key}`
  const existing = inFlight.get(flightKey) as Promise<ProductCandidate[]> | undefined
  if (existing) return existing

  const promise = (async () => {
    try {
      const results = await runSearch(trimmed, signal)
      if (results.length > 0) {
        searchCache.set(key, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, value: results })
        pruneCache(searchCache)
      }
      return results
    } finally {
      inFlight.delete(flightKey)
    }
  })()

  inFlight.set(flightKey, promise)
  return promise
}

async function runBarcodeLookup(
  barcode: string,
  signal?: AbortSignal,
): Promise<ProductCandidate> {
  let proxyMissing = proxyUnavailable
  if (!proxyMissing) {
    try {
      const data = (await fetchJson(buildProductPath(barcode), signal, {
        proxy: true,
      })) as OffProductResponse
      if (data.status === 0 || !data.product) {
        throw new ProductLookupError(
          'No product matched that barcode. You can create it manually instead.',
          'not-found',
        )
      }
      const mapped = mapHit(data.product)
      if (!mapped) {
        throw new ProductLookupError(
          'The product record is missing a name. You can create it manually instead.',
          'not-found',
        )
      }
      return mapped
    } catch (error) {
      if (error instanceof ProxyMissingError) {
        proxyMissing = true
        proxyUnavailable = true
      } else throw error
    }
  }

  if (proxyMissing) {
    const data = (await fetchJson(buildDirectProductPath(barcode), signal, {
      proxy: false,
    })) as OffProductResponse
    if (data.status === 0 || !data.product) {
      throw new ProductLookupError(
        'No product matched that barcode. You can create it manually instead.',
        'not-found',
      )
    }
    const mapped = mapHit(data.product)
    if (!mapped) {
      throw new ProductLookupError(
        'The product record is missing a name. You can create it manually instead.',
        'not-found',
      )
    }
    return mapped
  }

  throw new ProductLookupError(
    'Barcode lookup is unavailable right now. You can create the product manually.',
    'unavailable',
  )
}

export async function lookupBarcode(
  rawBarcode: string,
  signal?: AbortSignal,
): Promise<ProductCandidate> {
  const barcode = rawBarcode.replace(/[\s-]/g, '')
  if (!/^\d{6,14}$/.test(barcode)) {
    throw new ProductLookupError(
      'Enter a 6–14 digit barcode, or create the product manually.',
      'invalid-barcode',
    )
  }

  const cached = productCache.get(barcode)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  assertNotCoolingDown()

  const flightKey = `product:${barcode}`
  const existing = inFlight.get(flightKey) as Promise<ProductCandidate> | undefined
  if (existing) return existing

  const promise = (async () => {
    try {
      const product = await runBarcodeLookup(barcode, signal)
      productCache.set(barcode, {
        expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS,
        value: product,
      })
      pruneCache(productCache)
      return product
    } finally {
      inFlight.delete(flightKey)
    }
  })()

  inFlight.set(flightKey, promise)
  return promise
}

/** Clears in-memory lookup state. Used by tests and when household data resets. */
export function resetLookupState(): void {
  searchCache.clear()
  productCache.clear()
  inFlight.clear()
  cooldownUntil = 0
  proxyUnavailable = false
}

export const offAttribution = {
  name: 'Open Food Facts',
  dataLicense: 'Open Database License (ODbL)',
  imageLicense: 'CC BY-SA',
  dataUrl: 'https://world.openfoodfacts.org/data',
  termsUrl: 'https://world.openfoodfacts.org/terms-of-use',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  searchLicenseUrl: 'https://github.com/openfoodfacts/search-a-licious',
}
