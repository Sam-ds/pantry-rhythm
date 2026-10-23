import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRight,
  Barcode,
  Camera,
  CircleAlert,
  Clock3,
  ExternalLink,
  LoaderCircle,
  PackagePlus,
  Search,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import type { CreateItemInput, ProductCandidate } from '../types'
import { db } from '../lib/db'
import { todayISO } from '../lib/dates'
import {
  lookupBarcode,
  offAttribution,
  offSearchPageUrl,
  ProductLookupError,
  searchProducts,
} from '../lib/openfoodfacts'
import { ProductThumb } from '../components/ProductThumb'
import { ScannerModal, canUseCameraScanner } from '../components/ScannerModal'
import { primeScanSound } from '../lib/scanFeedback'

type AddTab = 'search' | 'barcode' | 'manual'

interface AddViewProps {
  onProductSelected: (product: ProductCandidate) => void
  onCreateManual: (input: CreateItemInput) => Promise<void>
}

interface ManualFields {
  name: string
  brand: string
  barcode: string
  quantityLabel: string
  unitLabel: string
  purchasedAt: string
  quantity: string
  estimatedDurationDays: string
  notes: string
}

function defaultManualFields(): ManualFields {
  return {
    name: '',
    brand: '',
    barcode: '',
    quantityLabel: '',
    unitLabel: 'item',
    purchasedAt: todayISO(),
    quantity: '1',
    estimatedDurationDays: '30',
    notes: '',
  }
}

const suggestions = ['oat milk', 'coffee', 'toothpaste', 'olive oil', 'paper towels']

export function AddView({ onProductSelected, onCreateManual }: AddViewProps) {
  const [tab, setTab] = useState<AddTab>('search')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searchedFor, setSearchedFor] = useState('')
  const [searchError, setSearchError] = useState<ProductLookupError | null>(null)
  const searchAbort = useRef<AbortController | null>(null)

  const [barcode, setBarcode] = useState('')
  const [barcodeBusy, setBarcodeBusy] = useState(false)
  const [barcodeError, setBarcodeError] = useState<ProductLookupError | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameraSupported] = useState(() => canUseCameraScanner())
  const barcodeAbort = useRef<AbortController | null>(null)

  const [manual, setManual] = useState<ManualFields>(() => defaultManualFields())
  const [manualError, setManualError] = useState('')
  const [manualSaving, setManualSaving] = useState(false)

  const recent = useLiveQuery(
    () => db.recentProducts.orderBy('lastSeenAt').reverse().limit(6).toArray(),
    [],
  )

  useEffect(() => {
    return () => {
      searchAbort.current?.abort()
      barcodeAbort.current?.abort()
    }
  }, [])

  const runSearch = async (searchTerm: string) => {
    const term = searchTerm.trim()
    if (term.length < 2) return
    searchAbort.current?.abort()
    const controller = new AbortController()
    searchAbort.current = controller
    setSearching(true)
    setSearchError(null)
    setSearchedFor(term)
    try {
      const found = await searchProducts(term, controller.signal)
      setResults(found)
    } catch (error) {
      if (controller.signal.aborted) return
      setResults([])
      setSearchError(
        error instanceof ProductLookupError
          ? error
          : new ProductLookupError('Search is unavailable right now.', 'unavailable'),
      )
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void runSearch(query)
  }

  const runBarcodeLookup = async (value: string) => {
    barcodeAbort.current?.abort()
    const controller = new AbortController()
    barcodeAbort.current = controller
    setBarcodeBusy(true)
    setBarcodeError(null)
    try {
      const product = await lookupBarcode(value, controller.signal)
      setBarcodeBusy(false)
      onProductSelected(product)
    } catch (error) {
      if (controller.signal.aborted) return
      setBarcodeBusy(false)
      setBarcodeError(
        error instanceof ProductLookupError
          ? error
          : new ProductLookupError('Barcode lookup is unavailable right now.', 'unavailable'),
      )
    }
  }

  const handleBarcodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!barcodeBusy) void runBarcodeLookup(barcode)
  }

  const openManualFallback = (prefill: { name?: string; barcode?: string }) => {
    setManual((current) => ({
      ...current,
      name: prefill.name || current.name,
      barcode: prefill.barcode || current.barcode,
    }))
    setManualError('')
    setTab('manual')
  }

  const setManualField = (field: keyof ManualFields, value: string) => {
    setManual((current) => ({ ...current, [field]: value }))
  }

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setManualError('')
    if (!manual.name.trim()) {
      setManualError('Add a product name.')
      return
    }
    setManualSaving(true)
    try {
      await onCreateManual({
        product: {
          name: manual.name,
          brand: manual.brand,
          barcode: manual.barcode,
          imageUrl: '',
          quantityLabel: manual.quantityLabel,
          source: 'manual',
          sourceUrl: '',
        },
        unitLabel: manual.unitLabel,
        notes: manual.notes,
        firstPurchase: {
          purchasedAt: manual.purchasedAt,
          quantity: Number(manual.quantity),
          estimatedDurationDays: Number(manual.estimatedDurationDays),
          notes: '',
        },
      })
      setManual(defaultManualFields())
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Could not save this item.')
    } finally {
      setManualSaving(false)
    }
  }

  return (
    <div className="page add-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Product discovery</p>
          <h1>Add something to your pantry</h1>
          <p className="page-subtitle">
            Search a food product, scan a barcode, or enter anything yourself.
          </p>
        </div>
      </header>

      <div className="add-tabs" role="tablist" aria-label="Product lookup method">
        <button
          id="tab-search"
          role="tab"
          aria-selected={tab === 'search'}
          className={tab === 'search' ? 'active' : ''}
          onClick={() => setTab('search')}
        >
          <Search size={17} aria-hidden="true" /> Search
        </button>
        <button
          id="tab-barcode"
          role="tab"
          aria-selected={tab === 'barcode'}
          className={tab === 'barcode' ? 'active' : ''}
          onClick={() => setTab('barcode')}
        >
          <Barcode size={18} aria-hidden="true" /> Barcode
        </button>
        <button
          id="tab-manual"
          role="tab"
          aria-selected={tab === 'manual'}
          className={tab === 'manual' ? 'active' : ''}
          onClick={() => setTab('manual')}
        >
          <PackagePlus size={17} aria-hidden="true" /> Manual
        </button>
      </div>

      {tab === 'search' ? (
        <section className="panel add-panel" role="tabpanel" aria-labelledby="tab-search">
          <div className="add-panel-heading">
            <div>
              <h2>Search Open Food Facts</h2>
              <p>
                A community food database. Search results can be incomplete, so manual entry is
                always available.
              </p>
            </div>
            <span className="database-badge">
              <Sparkles size={14} aria-hidden="true" /> ODbL data
            </span>
          </div>

          <form className="search-form" onSubmit={handleSearchSubmit}>
            <label className="search-field search-field-large">
              <Search size={20} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try “oat milk” or “coffee”"
                autoComplete="off"
                aria-label="Search food products"
              />
              {query ? (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : null}
            </label>
            <button className="btn primary" type="submit" disabled={searching || query.trim().length < 2}>
              {searching ? (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              ) : (
                <Search size={17} aria-hidden="true" />
              )}
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          <div className="suggestion-row" aria-label="Search suggestions">
            <span>Try</span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="suggestion-chip"
                onClick={() => {
                  setQuery(suggestion)
                  void runSearch(suggestion)
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>

          {searching ? (
            <div className="result-grid" aria-busy="true" aria-label="Loading search results">
              {[1, 2, 3, 4].map((item) => (
                <div className="product-result skeleton" key={item}>
                  <span className="skeleton-thumb" />
                  <span className="skeleton-lines">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              ))}
            </div>
          ) : searchError ? (
            <div className="lookup-fallback">
              <span className="lookup-fallback-icon">
                <CircleAlert size={25} aria-hidden="true" />
              </span>
              <div>
                <h3>Product lookup is unavailable</h3>
                <p>{searchError.message}</p>
                <div className="inline-actions">
                  <button
                    className="btn primary small"
                    onClick={() => openManualFallback({ name: searchedFor })}
                  >
                    <PackagePlus size={15} aria-hidden="true" /> Add “{searchedFor}” manually
                  </button>
                  <button className="btn ghost small" onClick={() => void runSearch(searchedFor)}>
                    Try again
                  </button>
                  <a
                    className="btn ghost small"
                    href={offSearchPageUrl(searchedFor)}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Search Open Food Facts <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          ) : searchedFor ? (
            results.length > 0 ? (
              <>
                <div className="results-heading">
                  <p>
                    {results.length} {results.length === 1 ? 'result' : 'results'} for{' '}
                    <strong>“{searchedFor}”</strong>
                  </p>
                  <span>Tap a product to add your own purchase details.</span>
                </div>
                <div className="result-grid">
                  {results.map((product) => (
                    <button
                      key={product.barcode}
                      className="product-result"
                      onClick={() => onProductSelected(product)}
                    >
                      <ProductThumb src={product.imageUrl} name={product.name} size="medium" />
                      <span className="product-result-copy">
                        <strong>{product.name}</strong>
                        <span>{product.brand || 'Unknown brand'}</span>
                        <span className="product-result-code">
                          {product.barcode}
                          {product.quantityLabel ? ` · ${product.quantityLabel}` : ''}
                        </span>
                      </span>
                      <span className="product-result-add" aria-hidden="true">
                        <PackagePlus size={18} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="add-search-fallback">
                  Can't find it?{' '}
                  <button
                    className="text-link"
                    onClick={() => openManualFallback({ name: searchedFor })}
                  >
                    Create a manual item <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              <div className="lookup-empty">
                <span className="lookup-empty-icon">
                  <Search size={25} aria-hidden="true" />
                </span>
                <h3>No food product matched “{searchedFor}”</h3>
                <p>
                  It may not be in Open Food Facts yet. You can create it manually and track it
                  just the same.
                </p>
                <button
                  className="btn primary small"
                  onClick={() => openManualFallback({ name: searchedFor })}
                >
                  <PackagePlus size={15} aria-hidden="true" /> Add it manually
                </button>
              </div>
            )
          ) : (
            <div className="search-idle">
              <div className="search-idle-copy">
                <WandSparkles size={22} aria-hidden="true" />
                <div>
                  <h3>Search the food database, or skip it</h3>
                  <p>
                    Every lookup is optional. Manual entry works offline and never depends on an
                    external service.
                  </p>
                </div>
              </div>
              {recent && recent.length > 0 ? (
                <div className="recent-products">
                  <p className="eyebrow">Recently added</p>
                  <div className="recent-list">
                    {recent.map((row) => (
                      <button
                        key={row.id}
                        className="recent-product"
                        onClick={() => onProductSelected(row.product)}
                      >
                        <ProductThumb
                          src={row.product.imageUrl}
                          name={row.product.name}
                          size="small"
                        />
                        <span>{row.product.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="data-attribution">
            <span>
              Product data from{' '}
              <a href={offAttribution.dataUrl} target="_blank" rel="noreferrer">
                Open Food Facts <ExternalLink size={11} aria-hidden="true" />
              </a>
              , available under the {offAttribution.dataLicense}. Images are contributed under{' '}
              {offAttribution.imageLicense}.
            </span>
            <a href={offAttribution.termsUrl} target="_blank" rel="noreferrer">
              Terms
            </a>
          </div>
        </section>
      ) : null}

      {tab === 'barcode' ? (
        <section className="panel add-panel" role="tabpanel" aria-labelledby="tab-barcode">
          <div className="add-panel-heading">
            <div>
              <h2>Look up a barcode</h2>
              <p>Enter the digits below the barcode, or use your camera where supported.</p>
            </div>
            <span className="database-badge">
              <Barcode size={14} aria-hidden="true" /> EAN / UPC
            </span>
          </div>

          <form className="barcode-form" onSubmit={handleBarcodeSubmit}>
            <label className="field barcode-input">
              <span>Barcode number</span>
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 737628064502"
                pattern="[0-9\s\-]*"
              />
            </label>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                primeScanSound()
                setScannerOpen(true)
              }}
              disabled={!cameraSupported}
              title={
                cameraSupported
                  ? 'Scan with camera'
                  : 'Camera scanning is not supported in this browser'
              }
            >
              <Camera size={17} aria-hidden="true" /> Scan
            </button>
            <button
              className="btn primary"
              type="submit"
              disabled={barcodeBusy || barcode.trim().length < 6}
            >
              {barcodeBusy ? (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              ) : (
                <Search size={17} aria-hidden="true" />
              )}
              {barcodeBusy ? 'Looking up…' : 'Look up'}
            </button>
          </form>

          {!cameraSupported ? (
            <p className="inline-note">
              <Camera size={14} aria-hidden="true" /> Camera scanning is not available in this
              browser. Manual barcode entry still works everywhere.
            </p>
          ) : (
            <p className="inline-note">
              <Camera size={14} aria-hidden="true" /> Camera scanning decodes the barcode on this
              device, using the browser's built-in detector or a bundled decoder. No image leaves
              your device.
            </p>
          )}

          {barcodeError ? (
            <div className="lookup-fallback">
              <span className="lookup-fallback-icon">
                <CircleAlert size={25} aria-hidden="true" />
              </span>
              <div>
                <h3>
                  {barcodeError.code === 'not-found'
                    ? 'No match for that barcode'
                    : 'Barcode lookup is unavailable'}
                </h3>
                <p>{barcodeError.message}</p>
                <div className="inline-actions">
                  <button
                    className="btn primary small"
                    onClick={() =>
                      openManualFallback({
                        barcode: barcode.replace(/[\s-]/g, ''),
                      })
                    }
                  >
                    <PackagePlus size={15} aria-hidden="true" /> Create it manually
                  </button>
                  <button
                    className="btn ghost small"
                    onClick={() => void runBarcodeLookup(barcode)}
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="barcode-idle">
              <div className="barcode-graphic" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <p>
                Barcode lookup uses Open Food Facts. If a product is missing or the service is
                down, create a manual item with the same barcode.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'manual' ? (
        <section className="panel add-panel" role="tabpanel" aria-labelledby="tab-manual">
          <div className="add-panel-heading">
            <div>
              <h2>Create a manual item</h2>
              <p>
                Works for any product, no barcode needed. Your notes and duration are never sent
                anywhere.
              </p>
            </div>
            <span className="database-badge manual-badge">
              <PackagePlus size={14} aria-hidden="true" /> Private
            </span>
          </div>

          <form className="manual-form" onSubmit={handleManualSubmit}>
            <fieldset>
              <legend>Product</legend>
              <div className="form-grid two">
                <label className="field">
                  <span>Product name *</span>
                  <input
                    value={manual.name}
                    onChange={(event) => setManualField('name', event.target.value)}
                    placeholder="e.g. Oat milk"
                    maxLength={160}
                    required
                  />
                </label>
                <label className="field">
                  <span>Brand</span>
                  <input
                    value={manual.brand}
                    onChange={(event) => setManualField('brand', event.target.value)}
                    placeholder="Optional"
                    maxLength={160}
                  />
                </label>
                <label className="field">
                  <span>Barcode</span>
                  <input
                    value={manual.barcode}
                    onChange={(event) => setManualField('barcode', event.target.value)}
                    placeholder="Optional"
                    inputMode="numeric"
                    maxLength={80}
                  />
                </label>
                <label className="field">
                  <span>Pack size</span>
                  <input
                    value={manual.quantityLabel}
                    onChange={(event) => setManualField('quantityLabel', event.target.value)}
                    placeholder="e.g. 1 l or 500 g"
                    maxLength={80}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>First purchase</legend>
              <div className="form-grid two">
                <label className="field">
                  <span>Purchase date</span>
                  <input
                    type="date"
                    value={manual.purchasedAt}
                    max={todayISO()}
                    onChange={(event) => setManualField('purchasedAt', event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>What do you call one unit?</span>
                  <input
                    value={manual.unitLabel}
                    onChange={(event) => setManualField('unitLabel', event.target.value)}
                    placeholder="bottle, bag, roll…"
                    maxLength={30}
                  />
                </label>
                <label className="field">
                  <span>Quantity bought</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={manual.quantity}
                    onChange={(event) => setManualField('quantity', event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>How many days should this last?</span>
                  <div className="field-with-suffix">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="3650"
                      step="1"
                      value={manual.estimatedDurationDays}
                      onChange={(event) =>
                        setManualField('estimatedDurationDays', event.target.value)
                      }
                      required
                    />
                    <span>days</span>
                  </div>
                </label>
              </div>
              <div className="duration-presets">
                <span>Quick estimate</span>
                {[7, 14, 30, 60, 90].map((days) => (
                  <button
                    type="button"
                    key={days}
                    className={
                      manual.estimatedDurationDays === String(days) ? 'active' : ''
                    }
                    onClick={() => setManualField('estimatedDurationDays', String(days))}
                  >
                    {days} days
                  </button>
                ))}
              </div>
              <label className="field">
                <span>Notes</span>
                <textarea
                  value={manual.notes}
                  onChange={(event) => setManualField('notes', event.target.value)}
                  placeholder="Where it's kept, who uses it, anything useful…"
                  rows={3}
                  maxLength={2000}
                />
              </label>
              <p className="form-hint">
                <Clock3 size={14} aria-hidden="true" /> This first duration is a starting estimate.
                When the item runs out, log it and future estimates use your real history.
              </p>
            </fieldset>

            {manualError ? (
              <p className="form-error" role="alert">
                <CircleAlert size={15} aria-hidden="true" /> {manualError}
              </p>
            ) : null}

            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={manualSaving}>
                {manualSaving ? (
                  <LoaderCircle className="spin" size={17} aria-hidden="true" />
                ) : (
                  <PackagePlus size={17} aria-hidden="true" />
                )}
                {manualSaving ? 'Saving…' : 'Add to pantry'}
              </button>
              <span>All data stays in this browser.</span>
            </div>
          </form>
        </section>
      ) : null}

      <ScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(detected) => {
          setScannerOpen(false)
          setBarcode(detected)
          setTab('barcode')
          void runBarcodeLookup(detected)
        }}
      />
    </div>
  )
}
