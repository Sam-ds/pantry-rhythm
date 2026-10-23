const PRODUCT_API = 'https://world.openfoodfacts.org/api/v2/product'
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

const OFF_USER_AGENT =
  'PantryRhythm/0.1 (local-first household pantry; contact: pantry-rhythm@example.com)'

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
}

/**
 * Stateless barcode lookup proxy for Cloudflare Pages. The barcode is the only
 * input. A descriptive User-Agent is added and public product responses are
 * briefly cached at the edge.
 */
export async function onRequestGet({ request }) {
  const url = new URL(request.url)
  const barcode = (url.searchParams.get('barcode') || '').replace(/[\s-]/g, '').slice(0, 14)

  if (!/^\d{6,14}$/.test(barcode)) {
    return json({ error: 'Enter a valid 6–14 digit barcode.' }, 400)
  }

  const target = new URL(`${PRODUCT_API}/${encodeURIComponent(barcode)}.json`)
  target.searchParams.set('fields', PRODUCT_FIELDS)

  const cache = typeof caches !== 'undefined' ? caches.default : null
  const cacheKey = new Request(`https://pantry-rhythm-cache.internal/product/${barcode}`, {
    method: 'GET',
  })
  if (cache) {
    const cached = await cache.match(cacheKey)
    if (cached) return cached
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': OFF_USER_AGENT,
      },
      cf: {
        cacheTtl: 3600,
        cacheEverything: true,
      },
    })

    if (!upstream.ok) {
      return json(
        {
          error:
            upstream.status === 429
              ? 'Open Food Facts rate limit reached. Please wait a moment or add the product manually.'
              : 'Barcode lookup is unavailable right now.',
        },
        upstream.status === 429 ? 429 : 503,
        { 'Retry-After': '60' },
      )
    }

    const response = new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
    if (cache) await cache.put(cacheKey, response.clone())
    return response
  } catch {
    return json(
      { error: 'Barcode lookup could not be reached. Create the product manually if needed.' },
      503,
    )
  }
}
