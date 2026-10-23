import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  lookupBarcode,
  ProductLookupError,
  resetLookupState,
  searchProducts,
} from './openfoodfacts'

afterEach(() => {
  vi.unstubAllGlobals()
  resetLookupState()
})

describe('Open Food Facts product mapping', () => {
  it('maps search results and drops unsafe image hosts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hits: [
            {
              code: '1234567890123',
              product_name: '  Test   oat milk ',
              brands: ['Example', 'Second Brand'],
              quantity: '1 l',
              image_front_small_url: 'https://images.openfoodfacts.org/test.jpg',
            },
            {
              code: '9999999999999',
              product_name: 'No safe image',
              brands: 'Brand',
              image_front_small_url: 'https://evil.example/tracker.jpg',
            },
            { code: '123', product_name: '' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchProducts('oat milk')
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      name: 'Test oat milk',
      brand: 'Example, Second Brand',
      barcode: '1234567890123',
      source: 'openfoodfacts',
      imageUrl: 'https://images.openfoodfacts.org/test.jpg',
    })
    expect(results[1].imageUrl).toBe('')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('maps a barcode lookup and generates a source page URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 1,
            product: {
              code: '737628064502',
              product_name: 'Thai peanut noodle kit',
              brands: 'Thai Kitchen',
              image_front_url: 'https://images.openfoodfacts.org/product.jpg',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    const product = await lookupBarcode('737 628 064 502')
    expect(product.name).toBe('Thai peanut noodle kit')
    expect(product.sourceUrl).toBe('https://world.openfoodfacts.org/product/737628064502')
  })

  it('rejects malformed barcodes before making a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(lookupBarcode('not-a-barcode')).rejects.toMatchObject({
      code: 'invalid-barcode',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a clean not-found error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Response(JSON.stringify({ status: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    )
    await expect(lookupBarcode('12345678')).rejects.toBeInstanceOf(ProductLookupError)
    await expect(lookupBarcode('12345678')).rejects.toMatchObject({ code: 'not-found' })
  })

  it('surfaces unavailable services for the manual fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')))
    await expect(searchProducts('coffee')).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('falls back to the direct endpoint when the proxy is missing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<!doctype html><title>404</title>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }),
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(searchProducts('static host search')).rejects.toMatchObject({
      code: 'unavailable',
      message: expect.stringContaining('static copy'),
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      'world.openfoodfacts.org/cgi/search.pl',
    )
  })
})
