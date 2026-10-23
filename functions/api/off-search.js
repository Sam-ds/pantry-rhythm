const SEARCH_ENDPOINT = 'https://search.openfoodfacts.org/search'
const SEARCH_FIELDS = [
  'code',
  'product_name',
  'product_name_en',
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
      'Access-Control-Allow-Origin': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
}

/**
 * Stateless Open Food Facts search proxy for Cloudflare Pages.
 *
 * - Adds the descriptive User-Agent recommended by Open Food Facts.
 * - Searches only on an explicit request (the client does not search per
 *   keystroke).
 * - Caches identical public searches for ten minutes at the edge.
 * - Limits upstream requests to one query and a fixed field list.
 * - Does not accept, log, or forward any household data.
 *
 * If Open Food Facts is unavailable, the client offers manual product entry.
 */
export async function onRequestGet({ request }) {
  const url = new URL(request.url)
  const query = (url.searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 120)

  if (query.length < 2) {
    return json({ error: 'A search query of at least 2 characters is required.' }, 400)
  }

  const target = new URL(SEARCH_ENDPOINT)
  target.searchParams.set('q', query)
  target.searchParams.set('page_size', '15')
  target.searchParams.set('fields', SEARCH_FIELDS)

  const cache = typeof caches !== 'undefined' ? caches.default : null
  const cacheKey = new Request(`https://pantry-rhythm-cache.internal/search?q=${encodeURIComponent(query.toLowerCase())}`, {
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
        cacheTtl: 600,
        cacheEverything: true,
      },
    })

    if (!upstream.ok) {
      return json(
        {
          error:
            upstream.status === 429
              ? 'Open Food Facts rate limit reached. Please wait a moment or add the product manually.'
              : 'Open Food Facts search is unavailable right now.',
        },
        upstream.status === 429 ? 429 : 503,
        { 'Retry-After': '60' },
      )
    }

    const response = new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=600, s-maxage=600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
    if (cache) await cache.put(cacheKey, response.clone())
    return response
  } catch {
    return json(
      { error: 'Open Food Facts search could not be reached. Add the product manually if needed.' },
      503,
    )
  }
}
