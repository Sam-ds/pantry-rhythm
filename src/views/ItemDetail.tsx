import {
  Archive,
  ArrowLeft,
  Barcode,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  History,
  LockKeyhole,
  PackageOpen,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingBasket,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import type { Estimate, PurchaseCycle, TrackedItem } from '../types'
import { daysBetween, formatDate, formatLongDate, relativeDays, todayISO } from '../lib/dates'
import { getActivePurchase } from '../lib/prediction'
import { ProductThumb } from '../components/ProductThumb'
import { EstimateBadge } from '../components/EstimateBadge'

interface ItemDetailProps {
  item: TrackedItem
  estimate: Estimate | null
  onBack: () => void
  onLogPurchase: (itemId: string) => void
  onMarkConsumed: (itemId: string) => void
  onCorrectEstimate: (itemId: string) => void
  onEditItem: (itemId: string) => void
  onEditPurchase: (itemId: string, purchaseId: string) => void
  onToggleList: (itemId: string, onList: boolean) => void
  onArchive: (itemId: string) => void
  onRestore: (itemId: string) => void
  onUndoConsumed: (itemId: string) => void
  onDelete: (itemId: string) => void
}

function unitAmount(amount: number, unit: string): string {
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `${formatted} ${amount === 1 ? unit : `${unit}s`}`
}

function cycleLabel(purchase: PurchaseCycle): string {
  if (!purchase.endedAt) return 'Current'
  if (purchase.endReason === 'restocked') return 'Restocked'
  return 'Ran out'
}

function cycleTone(purchase: PurchaseCycle): string {
  if (!purchase.endedAt) return 'current'
  if (purchase.endReason === 'restocked') return 'muted'
  return 'done'
}

export function ItemDetail({
  item,
  estimate,
  onBack,
  onLogPurchase,
  onMarkConsumed,
  onCorrectEstimate,
  onEditItem,
  onEditPurchase,
  onToggleList,
  onArchive,
  onRestore,
  onUndoConsumed,
  onDelete,
}: ItemDetailProps) {
  const today = todayISO()
  const active = getActivePurchase(item)
  const history = [...item.purchases].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))
  const latest = history[0]
  const elapsed = active ? Math.max(0, daysBetween(active.purchasedAt, today)) : 0
  const elapsedPercent = estimate
    ? Math.max(0, Math.min(100, (elapsed / estimate.expectedDurationDays) * 100))
    : 0
  const canUndo =
    !active && latest?.endedAt && latest.endReason === 'consumed' && item.status === 'consumed'

  return (
    <div className="page item-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to pantry
      </button>

      <section className="item-hero">
        <ProductThumb src={item.product.imageUrl} name={item.product.name} size="large" />
        <div className="item-hero-copy">
          <div className="item-hero-badges">
            <span className={`status-pill status-${item.status}`}>
              {item.status === 'archived'
                ? 'Not tracked'
                : item.status === 'consumed'
                  ? 'Out of stock'
                  : 'Actively tracking'}
            </span>
            {item.product.source === 'openfoodfacts' ? (
              <span className="source-pill">Open Food Facts</span>
            ) : (
              <span className="source-pill">Manual item</span>
            )}
            {item.onShoppingList ? (
              <span className="list-pill">
                <ShoppingBasket size={12} aria-hidden="true" /> On restock list
              </span>
            ) : null}
          </div>
          <h1>{item.product.name}</h1>
          <p className="item-hero-meta">
            {item.product.brand || 'No brand'}
            {item.product.quantityLabel ? ` · ${item.product.quantityLabel}` : ''}
          </p>
          <div className="item-facts">
            {item.product.barcode ? (
              <span>
                <Barcode size={14} aria-hidden="true" /> {item.product.barcode}
              </span>
            ) : (
              <span>
                <LockKeyhole size={14} aria-hidden="true" /> No barcode
              </span>
            )}
            <span>
              <History size={14} aria-hidden="true" /> {item.purchases.length}{' '}
              {item.purchases.length === 1 ? 'purchase' : 'purchases'} logged
            </span>
            {item.product.sourceUrl ? (
              <a href={item.product.sourceUrl} target="_blank" rel="noreferrer">
                Product record <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
        <div className="item-hero-actions">
          <button className="btn primary" onClick={() => onLogPurchase(item.id)}>
            <Plus size={17} aria-hidden="true" /> Log purchase
          </button>
          <button className="btn secondary" onClick={() => onEditItem(item.id)}>
            <Pencil size={16} aria-hidden="true" /> Edit details
          </button>
        </div>
      </section>

      <div className="item-grid">
        <section className={`prediction-card${estimate?.overdue ? ' is-overdue' : ''}`}>
          <div className="prediction-heading">
            <span className="eyebrow">Restock estimate</span>
            {estimate ? <EstimateBadge estimate={estimate} /> : null}
          </div>

          {estimate ? (
            <>
              <h2>{formatLongDate(estimate.expectedDate)}</h2>
              <p className={`prediction-relative${estimate.overdue ? ' negative' : ''}`}>
                {relativeDays(estimate.daysLeft)}
              </p>

              <div className="certainty-block">
                <div className="certainty-labels">
                  <span>Possible range</span>
                  <strong>
                    {formatDate(estimate.earliestDate)} – {formatDate(estimate.latestDate)}
                  </strong>
                </div>
                <div className="range-track" aria-hidden="true">
                  <span className="range-fill" />
                  <span className="range-expected" />
                </div>
                <p>
                  Your household has {estimate.completedCycles} completed{' '}
                  {estimate.completedCycles === 1 ? 'cycle' : 'cycles'} for this item.
                </p>
              </div>

              <div className="prediction-method">
                <Clock3 size={15} aria-hidden="true" />
                <p>{estimate.method}</p>
              </div>

              {active ? (
                <div className="usage-block">
                  <div className="usage-labels">
                    <span>Bought {formatDate(active.purchasedAt)}</span>
                    <span>{elapsed} days in use</span>
                  </div>
                  <div className="progress-track" aria-hidden="true">
                    <span
                      className={`progress-fill${estimate.overdue ? ' overdue' : ''}`}
                      style={{ width: `${elapsedPercent}%` }}
                    />
                  </div>
                  <span className="usage-foot">
                    {relativeDays(estimate.daysLeft)} · Estimate only
                  </span>
                </div>
              ) : null}

              <div className="prediction-actions">
                <button className="btn primary" onClick={() => onLogPurchase(item.id)}>
                  <Plus size={16} aria-hidden="true" /> I bought more
                </button>
                <button className="btn secondary" onClick={() => onMarkConsumed(item.id)}>
                  <PackageOpen size={16} aria-hidden="true" /> It ran out
                </button>
                <button className="btn ghost" onClick={() => onCorrectEstimate(item.id)}>
                  <SlidersHorizontal size={16} aria-hidden="true" /> Correct estimate
                </button>
              </div>

              <p className="estimate-note">
                <CircleAlert size={13} aria-hidden="true" /> This date is an estimate, not a
                guarantee. It can move earlier or later as you record real run-outs.
              </p>
            </>
          ) : (
            <div className="no-prediction">
              <span className="no-prediction-icon">
                <PackageOpen size={28} aria-hidden="true" />
              </span>
              <h2>{item.status === 'archived' ? 'Not currently tracked' : 'No active stock'}</h2>
              <p>
                {item.status === 'archived'
                  ? 'Restore this item to start tracking it again.'
                  : latest?.endedAt
                    ? `The last cycle ran out on ${formatLongDate(latest.endedAt)}. Log a new purchase to start the next estimate.`
                    : 'Log a purchase to start tracking this item.'}
              </p>
              {item.status !== 'archived' ? (
                <button className="btn primary" onClick={() => onLogPurchase(item.id)}>
                  <Plus size={16} aria-hidden="true" /> Log a purchase
                </button>
              ) : (
                <button className="btn primary" onClick={() => onRestore(item.id)}>
                  <RotateCcw size={16} aria-hidden="true" /> Restore tracking
                </button>
              )}
              {canUndo ? (
                <button className="text-link" onClick={() => onUndoConsumed(item.id)}>
                  Undo the last run-out
                </button>
              ) : null}
            </div>
          )}
        </section>

        <aside className="stock-card">
          <div className="stock-card-heading">
            <span className="eyebrow">Current stock</span>
            <button className="icon-button" onClick={() => onEditItem(item.id)} aria-label="Edit item">
              <Pencil size={15} aria-hidden="true" />
            </button>
          </div>
          {active ? (
            <>
              <p className="stock-quantity">{unitAmount(active.quantity, item.unitLabel)}</p>
              <dl className="stock-list">
                <div>
                  <dt>Purchased</dt>
                  <dd>{formatLongDate(active.purchasedAt)}</dd>
                </div>
                <div>
                  <dt>Household estimate</dt>
                  <dd>{active.estimatedDurationDays} days</dd>
                </div>
                {active.manualEstimateDays ? (
                  <div>
                    <dt>Manual correction</dt>
                    <dd>{active.manualEstimateDays} days</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Days in use</dt>
                  <dd>{elapsed}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="stock-empty">
              <p>No active purchase.</p>
              <span>History is kept for the next estimate.</span>
            </div>
          )}

          <div className="stock-list-actions">
            <button
              className={`btn ${item.onShoppingList ? 'secondary' : 'ghost'} small`}
              onClick={() => onToggleList(item.id, !item.onShoppingList)}
            >
              <ShoppingBasket
                size={15}
                aria-hidden="true"
                fill={item.onShoppingList ? 'currentColor' : 'none'}
              />
              {item.onShoppingList ? 'On restock list' : 'Add to restock list'}
            </button>
          </div>

          {item.notes ? (
            <div className="stock-notes">
              <span>Notes</span>
              <p>{item.notes}</p>
            </div>
          ) : null}
        </aside>
      </div>

      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Purchase history</p>
            <h2>Every cycle counts</h2>
          </div>
          <button className="btn ghost small" onClick={() => onLogPurchase(item.id)}>
            <Plus size={15} aria-hidden="true" /> New purchase
          </button>
        </div>
        <p className="history-intro">
          Only cycles marked as <strong>ran out</strong> teach the estimate. Restocking early is
          kept in your history but does not count as consumption.
        </p>

        {history.length === 0 ? (
          <div className="inline-empty">
            <span className="inline-empty-icon">
              <CalendarDays size={23} aria-hidden="true" />
            </span>
            <div>
              <strong>No purchases recorded yet.</strong>
              <p>Add the first purchase to start a tracking cycle.</p>
            </div>
          </div>
        ) : (
          <ol className="history-timeline">
            {history.map((purchase) => {
              const duration = purchase.endedAt
                ? daysBetween(purchase.purchasedAt, purchase.endedAt)
                : daysBetween(purchase.purchasedAt, today)
              return (
                <li key={purchase.id} className={`history-item tone-${cycleTone(purchase)}`}>
                  <span className="history-dot" aria-hidden="true" />
                  <div className="history-content">
                    <div className="history-heading">
                      <div>
                        <strong>
                          {purchase.endedAt
                            ? `${formatDate(purchase.purchasedAt)} → ${formatDate(purchase.endedAt)}`
                            : `Bought ${formatDate(purchase.purchasedAt)}`}
                        </strong>
                        <span>
                          {purchase.endedAt
                            ? `${duration} days`
                            : `${duration} days in use`}
                          {' · '}
                          {unitAmount(purchase.quantity, item.unitLabel)}
                        </span>
                      </div>
                      <span className={`cycle-pill cycle-${cycleTone(purchase)}`}>
                        {cycleLabel(purchase)}
                      </span>
                    </div>
                    {purchase.notes ? <p className="history-notes">{purchase.notes}</p> : null}
                    {purchase.endedAt && purchase.endReason === 'restocked' ? (
                      <p className="history-note-muted">
                        Restocked before running out — not used in the prediction.
                      </p>
                    ) : null}
                  </div>
                  <button
                    className="icon-button history-edit"
                    onClick={() => onEditPurchase(item.id, purchase.id)}
                    aria-label="Edit this purchase cycle"
                    title="Edit cycle"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section className="item-footer-grid">
        <div className="item-privacy-note">
          <LockKeyhole size={18} aria-hidden="true" />
          <div>
            <strong>This history is yours</strong>
            <p>
              It is stored in this browser only. Nothing is tied to an account, and no one else
              can see it unless you share a link or backup yourself.
            </p>
          </div>
        </div>
        <div className="item-admin-actions">
          {item.status === 'archived' ? (
            <button className="btn secondary small" onClick={() => onRestore(item.id)}>
              <RotateCcw size={15} aria-hidden="true" /> Restore tracking
            </button>
          ) : (
            <button className="btn secondary small" onClick={() => onArchive(item.id)}>
              <Archive size={15} aria-hidden="true" /> Stop tracking
            </button>
          )}
          <button className="btn danger-ghost small" onClick={() => onDelete(item.id)}>
            <Trash2 size={15} aria-hidden="true" /> Delete item
          </button>
        </div>
      </section>

      {item.status === 'consumed' && latest?.endedAt && !canUndo ? (
        <p className="pantry-footnote">
          <CheckCircle2 size={13} aria-hidden="true" /> The latest cycle was recorded as consumed.
        </p>
      ) : null}
    </div>
  )
}
