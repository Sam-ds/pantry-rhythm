import { useMemo, useState } from 'react'
import {
  Archive,
  Check,
  ChevronRight,
  PackageCheck,
  PackageOpen,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  X,
} from 'lucide-react'
import type { Estimate, TrackedItem } from '../types'
import { estimateRestock, isDueForRestockList } from '../lib/prediction'
import { formatDate, relativeDays, todayISO } from '../lib/dates'
import { ProductThumb } from '../components/ProductThumb'
import { EstimateBadge } from '../components/EstimateBadge'

type PantryFilter = 'active' | 'out' | 'archived' | 'all'

interface PantryProps {
  items: TrackedItem[]
  onAddItem: () => void
  onOpenItem: (itemId: string) => void
  onLogPurchase: (itemId: string) => void
  onToggleList: (itemId: string, onList: boolean) => void
}

const filters: Array<{ id: PantryFilter; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'out', label: 'Out' },
  { id: 'archived', label: 'Not tracked' },
  { id: 'all', label: 'All' },
]

function activePurchase(item: TrackedItem) {
  return item.purchases
    .filter((purchase) => !purchase.endedAt)
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))[0]
}

function lastCycle(item: TrackedItem) {
  return [...item.purchases].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))[0]
}

function quantityLabel(item: TrackedItem): string {
  const purchase = activePurchase(item)
  if (!purchase) return 'No active stock'
  const amount = Number.isInteger(purchase.quantity)
    ? purchase.quantity
    : purchase.quantity.toFixed(1)
  return `${amount} ${amount === '1' ? item.unitLabel : `${item.unitLabel}s`}`
}

function progress(item: TrackedItem, estimate: Estimate): number {
  const purchase = activePurchase(item)
  if (!purchase) return 0
  const elapsed = Math.max(0, 1 - estimate.daysLeft / estimate.expectedDurationDays)
  return Math.min(100, Math.max(0, elapsed * 100))
}

interface ItemCardProps {
  item: TrackedItem
  estimate: Estimate | null
  onOpenItem: (itemId: string) => void
  onLogPurchase: (itemId: string) => void
  onToggleList: (itemId: string, onList: boolean) => void
}

function ItemCard({
  item,
  estimate,
  onOpenItem,
  onLogPurchase,
  onToggleList,
}: ItemCardProps) {
  const latest = lastCycle(item)
  const out = item.status === 'consumed'
  const archived = item.status === 'archived'
  const dueForList = isDueForRestockList(item, todayISO())

  return (
    <article className={`pantry-card${estimate?.overdue ? ' is-overdue' : ''}`}>
      <button className="pantry-card-main" onClick={() => onOpenItem(item.id)}>
        <div className="pantry-card-top">
          <ProductThumb src={item.product.imageUrl} name={item.product.name} size="medium" />
          <div className="pantry-card-badges">
            <span className={`status-pill status-${item.status}`}>
              {archived ? <Archive size={12} /> : out ? <PackageOpen size={12} /> : <PackageCheck size={12} />}
              {archived ? 'Not tracked' : out ? 'Out' : 'Tracking'}
            </span>
            {item.product.source === 'openfoodfacts' ? (
              <span className="source-pill">Open Food Facts</span>
            ) : null}
          </div>
        </div>

        <div className="pantry-card-title">
          <h3>{item.product.name}</h3>
          <p>
            {item.product.brand || 'Manual product'}
            {item.product.quantityLabel ? ` · ${item.product.quantityLabel}` : ''}
          </p>
        </div>

        {estimate ? (
          <div className="pantry-estimate">
            <div className="pantry-estimate-line">
              <span>
                Est. <strong>{formatDate(estimate.expectedDate)}</strong>
              </span>
              <span className={estimate.overdue ? 'negative' : ''}>
                {relativeDays(estimate.daysLeft)}
              </span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span
                className={`progress-fill${estimate.overdue ? ' overdue' : ''}`}
                style={{ width: `${progress(item, estimate)}%` }}
              />
            </div>
            <div className="pantry-estimate-foot">
              <EstimateBadge estimate={estimate} compact />
              <span className="quantity-note">{quantityLabel(item)}</span>
            </div>
          </div>
        ) : (
          <div className="pantry-no-estimate">
            <strong>{out ? 'Out of stock' : 'No active purchase'}</strong>
            <span>
              {latest?.endedAt
                ? `Last run-out ${formatDate(latest.endedAt)}`
                : 'Log a purchase to start tracking.'}
            </span>
          </div>
        )}
      </button>

      <div className="pantry-card-actions">
        {archived ? (
          <button className="btn ghost small full" onClick={() => onOpenItem(item.id)}>
            Manage item
          </button>
        ) : out ? (
          <>
            <button className="btn primary small" onClick={() => onLogPurchase(item.id)}>
              <Plus size={15} aria-hidden="true" /> Log purchase
            </button>
            <button
              className={`icon-button${item.onShoppingList ? ' is-active' : ''}`}
              onClick={() => onToggleList(item.id, !item.onShoppingList)}
              aria-label={item.onShoppingList ? 'Remove from restock list' : 'Add to restock list'}
              title={item.onShoppingList ? 'On restock list' : 'Add to restock list'}
            >
              <ShoppingBasket
                size={17}
                aria-hidden="true"
                fill={item.onShoppingList ? 'currentColor' : 'none'}
              />
            </button>
          </>
        ) : (
          <>
            <button className="btn ghost small" onClick={() => onLogPurchase(item.id)}>
              <Check size={15} aria-hidden="true" /> Restocked
            </button>
            <button
              className={`icon-button${item.onShoppingList || dueForList ? ' is-active' : ''}`}
              onClick={() => onToggleList(item.id, !item.onShoppingList)}
              aria-label={item.onShoppingList ? 'Remove from restock list' : 'Add to restock list'}
              title={item.onShoppingList ? 'Pinned to restock list' : 'Pin to restock list'}
            >
              <ShoppingBasket
                size={17}
                aria-hidden="true"
                fill={item.onShoppingList ? 'currentColor' : 'none'}
              />
            </button>
            <button
              className="icon-button"
              onClick={() => onOpenItem(item.id)}
              aria-label={`Open ${item.product.name}`}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </article>
  )
}

export function Pantry({
  items,
  onAddItem,
  onOpenItem,
  onLogPurchase,
  onToggleList,
}: PantryProps) {
  const [filter, setFilter] = useState<PantryFilter>('active')
  const [query, setQuery] = useState('')
  const today = todayISO()

  const counts = useMemo(
    () => ({
      active: items.filter((item) => item.status === 'tracked').length,
      out: items.filter((item) => item.status === 'consumed').length,
      archived: items.filter((item) => item.status === 'archived').length,
      all: items.length,
    }),
    [items],
  )

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase()
    return items
      .filter((item) => {
        if (filter === 'active') return item.status === 'tracked'
        if (filter === 'out') return item.status === 'consumed'
        if (filter === 'archived') return item.status === 'archived'
        return true
      })
      .filter((item) => {
        if (!search) return true
        return `${item.product.name} ${item.product.brand} ${item.product.barcode}`
          .toLowerCase()
          .includes(search)
      })
      .sort((a, b) => {
        if (a.status === 'archived' && b.status !== 'archived') return 1
        if (b.status === 'archived' && a.status !== 'archived') return -1
        const left = estimateRestock(a, today)?.daysLeft ?? Number.POSITIVE_INFINITY
        const right = estimateRestock(b, today)?.daysLeft ?? Number.POSITIVE_INFINITY
        if (left !== right) return left - right
        return a.product.name.localeCompare(b.product.name)
      })
  }, [items, filter, query, today])

  const hasItems = items.length > 0

  return (
    <div className="page pantry-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Your household</p>
          <h1>Pantry &amp; supplies</h1>
          <p className="page-subtitle">
            {counts.active} active {counts.active === 1 ? 'item' : 'items'} · {counts.out} out
            of stock
          </p>
        </div>
        <button className="btn primary" onClick={onAddItem}>
          <Plus size={17} aria-hidden="true" /> Add item
        </button>
      </header>

      {!hasItems ? (
        <section className="empty-panel">
          <div className="empty-illustration">
            <PackageOpen size={38} aria-hidden="true" />
          </div>
          <h2>Your pantry is empty</h2>
          <p>
            Search for a food product, scan a barcode, or add anything manually. Even items
            without a barcode can be tracked.
          </p>
          <button className="btn primary" onClick={onAddItem}>
            <Plus size={17} aria-hidden="true" /> Add your first item
          </button>
          <p className="empty-hint">
            <Sparkles size={14} aria-hidden="true" /> Tip: start with two or three things you
            replace often.
          </p>
        </section>
      ) : (
        <>
          <div className="pantry-toolbar">
            <div className="filter-chips" role="group" aria-label="Filter pantry items">
              {filters.map((option) => (
                <button
                  key={option.id}
                  className={filter === option.id ? 'active' : ''}
                  onClick={() => setFilter(option.id)}
                  aria-pressed={filter === option.id}
                >
                  {option.label}
                  <span>{counts[option.id]}</span>
                </button>
              ))}
            </div>
            <label className="search-field pantry-search">
              <Search size={16} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find an item"
                aria-label="Search your pantry"
              />
              {query ? (
                <button
                  className="clear-search"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-panel compact">
              <PackageOpen size={30} aria-hidden="true" />
              <h2>Nothing here yet</h2>
              <p>
                {query
                  ? 'No item matches that search.'
                  : filter === 'archived'
                    ? 'Items you stop tracking will appear here.'
                    : 'Try another filter or add a new item.'}
              </p>
              {query ? (
                <button className="btn ghost small" onClick={() => setQuery('')}>
                  Clear search
                </button>
              ) : null}
            </div>
          ) : (
            <div className="pantry-grid">
              {filtered.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  estimate={estimateRestock(item, today)}
                  onOpenItem={onOpenItem}
                  onLogPurchase={onLogPurchase}
                  onToggleList={onToggleList}
                />
              ))}
            </div>
          )}

          {filter === 'archived' && filtered.length > 0 ? (
            <p className="pantry-footnote">
              Archived items keep their history. Open an item to restore it or delete it
              permanently.
            </p>
          ) : null}
          {filter === 'out' && filtered.length > 0 ? (
            <p className="pantry-footnote">
              Last run-out dates from these items are already part of their restock estimates.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
