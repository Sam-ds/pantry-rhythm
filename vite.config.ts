import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Search and barcode lookup are proxied in development so the browser never
// deals with Open Food Facts' server-side CORS policy. Tiny, stateless
// Cloudflare Pages Functions in ./functions/api provide the same routes in
// production. No household data passes through either proxy.
const OFF_USER_AGENT =
  'PantryRhythm/0.1 (local-first household pantry; contact: pantry-rhythm@example.com)'

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

/**
 * Vite's declarative proxy cannot turn the `?barcode=` query into the
 * `/api/v2/product/<barcode>.json` path Open Food Facts expects, so this tiny
 * middleware mirrors the Cloudflare Function instead.
 */
function offProductDevProxy(): Plugin {
  return {
    name: 'pantry-rhythm-off-product-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/off-product', (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const barcode = (url.searchParams.get('barcode') ?? '')
          .replace(/[^\d]/g, '')
          .slice(0, 14)

        const sendJson = (status: number, body: unknown) => {
          response.statusCode = status
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify(body))
        }

        if (!/^\d{6,14}$/.test(barcode)) {
          sendJson(400, { error: 'Enter a valid 6–14 digit barcode.' })
          return
        }

        void (async () => {
          try {
            const upstream = await fetch(
              `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${encodeURIComponent(
                PRODUCT_FIELDS,
              )}`,
              {
                headers: {
                  Accept: 'application/json',
                  'User-Agent': OFF_USER_AGENT,
                },
              },
            )
            const text = await upstream.text()
            response.statusCode = upstream.status
            response.setHeader(
              'Content-Type',
              upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
            )
            response.setHeader('Cache-Control', 'no-store')
            response.end(text)
          } catch {
            sendJson(503, {
              error: 'Barcode lookup could not be reached. Create the product manually if needed.',
            })
          }
        })()
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  // Relative asset paths let the same build work at a domain root, a GitHub
  // Pages project path (/pantry-rhythm/), or a custom domain.
  base: command === 'build' ? './' : '/',
  plugins: [react(), offProductDevProxy()],
  server: {
    proxy: {
      '/api/off-search': {
        target: 'https://search.openfoodfacts.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/off-search/, '/search'),
        headers: {
          'User-Agent': OFF_USER_AGENT,
        },
      },
    },
  },
}))
