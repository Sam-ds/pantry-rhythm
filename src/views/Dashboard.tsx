import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LockKeyhole,
  PackagePlus,
  Plus,
  ShoppingBasket,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import type { DueWindow, TrackedItem } from '../types'
import { estimateRestock } from '../lib/prediction'
import { formatDate, relativeDays, shortRelativeDays, todayISO } from '../lib/dates'
import { ProductThumb } from '../components/ProductThumb'
import { EstimateBadge } from '../components/EstimateBadge'

interface DashboardProps {
  items: TrackedItem[]
  householdName: string
  windowDays: DueWindow
  onWindowChange: (window: DueWindow) => void
  onAddItem: () => void
  onOpenItem: (itemId: string) => void
  onLogPurchase: (itemId: string) => void
  onToggleList: (itemId: string, onList: boolean) => void
  onToggleChecked: (itemId: string, checked: boolean) => void
  onClearChecked: () => void
  onSeedDemo: () => void
  onShowShare: () => void
  onShowAbout: () => void
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function suggestedQuantity(item: TrackedItem): string {
  const active = item.purchases
    .filter((purchase) => !purchase.endedAt)
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))[0]
  if (!active) return 'Out of stock'
  const amount = Number.isInteger(active.quantity) ? active.quantity : active.quantity.toFixed(1)
  const unit = item.unitLabel || 'item'
  return `${amount} ${amount === '1' ? unit : `${unit}s`}`
}

export function Dashboard({
  items,
  householdName,
  windowDays,
  onWindowChange,
  onAddItem,
  onOpenItem,
  onLogPurchase,
  onToggleList,
  onToggleChecked,
  onClearChecked,
  onSeedDemo,
  onShowShare,
  onShowAbout,
}: DashboardProps) {
  const today = todayISO()
  const tracked = items.filter((item) => item.status !== 'archived')
  const estimates = new Map(
    tracked.map((item) => [item.id, estimateRestock(item, today)] as const),
  )

  const counts = { 3: 0, 7: 0, 14: 0 }
  for (const item of tracked) {
    const estimate = estimates.get(item.id)
    if (!estimate) continue
    for (const window of [3, 7, 14] as const) {
      if (estimate.daysLeft <= window) counts[window] += 1
    }
  }

  // How many items are due by the end of each of the next fourteen days.
  const dayCounts = Array.from({ length: 14 }, (_, index) => {
    const day = index + 1
    return tracked.filter((item) => {
      const estimate = estimates.get(item.id)
      return estimate ? estimate.daysLeft <= day : false
    }).length
  })
  const stripMax = Math.max(1, ...dayCounts)

  const dueItems = tracked
    .filter((item) => {
      const estimate = estimates.get(item.id)
      return Boolean(estimate && estimate.daysLeft <= windowDays)
    })
    .sort((a, b) => {
      const left = estimates.get(a.id)?.daysLeft ?? Number.POSITIVE_INFINITY
      const right = estimates.get(b.id)?.daysLeft ?? Number.POSITIVE_INFINITY
      if (left !== right) return left - right
      return a.product.name.localeCompare(b.product.name)
    })

  const listItems = tracked
    .filter((item) => {
      const estimate = estimates.get(item.id)
      return item.onShoppingList || Boolean(estimate && estimate.daysLeft <= 14)
    })
    .sort((a, b) => {
      if (a.listChecked !== b.listChecked) return a.listChecked ? 1 : -1
      const left = estimates.get(a.id)?.daysLeft ?? Number.POSITIVE_INFINITY
      const right = estimates.get(b.id)?.daysLeft ?? Number.POSITIVE_INFINITY
      return left - right
    })

  const checkedCount = listItems.filter((item) => item.listChecked).length
  const completedCycleCount = tracked.reduce(
    (total, item) =>
      total +
      item.purchases.filter((purchase) => purchase.endedAt && purchase.endReason === 'consumed')
        .length,
    0,
  )

  if (items.length === 0) {
    return (
      <div className="page welcome-page">
        <section className="welcome-hero">
          <div className="welcome-copy">
            <span className="eyebrow">
              <Sparkles size={14} aria-hidden="true" /> A calmer pantry
            </span>
            <h1>Know what's running low, before it runs out.</h1>
            <p>
              Track what you buy, record when it actually runs out, and get an estimate for
              when to restock. Everything stays on this device.
            </p>
            <div className="welcome-actions">
              <button className="btn primary" onClick={onAddItem}>
                <Plus size={18} aria-hidden="true" /> Add your first item
              </button>
              <button className="btn ghost-light" onClick={onSeedDemo}>
                Explore a sample household
              </button>
            </div>
            <div className="welcome-trust">
              <span>
                <LockKeyhole size={15} aria-hidden="true" /> Local-only by default
              </span>
              <span>
                <Clock3 size={15} aria-hidden="true" /> Builds estimates from history
              </span>
            </div>
          </div>
          <div className="welcome-preview" aria-hidden="true">
            <div className="preview-sheet">
              <div className="preview-sheet-top">
                <span>This week</span>
                <span className="preview-live">
                  <i /> 3 due
                </span>
              </div>
              <div className="preview-row">
                <div className="preview-row-head">
                  <span className="preview-name">Oat milk</span>
                  <span className="preview-days">6 days</span>
                </div>
                <span className="preview-track">
                  <span style={{ width: '72%' }} />
                </span>
              </div>
              <div className="preview-row is-low">
                <div className="preview-row-head">
                  <span className="preview-name">Coffee</span>
                  <span className="preview-days">2 days</span>
                </div>
                <span className="preview-track">
                  <span style={{ width: '26%' }} />
                </span>
              </div>
              <div className="preview-row">
                <div className="preview-row-head">
                  <span className="preview-name">Olive oil</span>
                  <span className="preview-days">18 days</span>
                </div>
                <span className="preview-track">
                  <span style={{ width: '88%' }} />
                </span>
              </div>
              <p className="preview-foot">Estimated from your own purchase history.</p>
            </div>
          </div>
        </section>

        <section className="welcome-steps">
          <article>
            <span className="step-number">01</span>
            <h2>Find or add an item</h2>
            <p>Search Open Food Facts, scan a barcode, or enter anything manually.</p>
          </article>
          <article>
            <span className="step-number">02</span>
            <h2>Log what you bought</h2>
            <p>Add the quantity and your own estimate for how long it usually lasts.</p>
          </article>
          <article>
            <span className="step-number">03</span>
            <h2>Correct as you go</h2>
            <p>When it runs out, tap once. Your own pattern makes the next estimate better.</p>
          </article>
        </section>

        <p className="welcome-disclaimer">
          Estimates are rough until you record a few real run-outs. Pantry Rhythm does not
          promise accuracy.
        </p>
      </div>
    )
  }

  return (
    <div className="page dashboard-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            {greeting()}, {householdName}
          </p>
          <h1>What's running low?</h1>
          <p className="page-subtitle">
            A gentle heads-up based on your own purchase and run-out history.
          </p>
        </div>
        <button className="btn secondary desktop-only" onClick={onAddItem}>
          <Plus size={17} aria-hidden="true" /> Add item
        </button>
      </header>

      <section className={`rhythm-hero${dueItems.length === 0 ? ' is-calm' : ''}`}>
        <div className="rhythm-hero-top">
          <span className="hero-kicker">
            {dueItems.length === 0 ? (
              <>
                <CheckCircle2 size={14} aria-hidden="true" /> {windowDays}-day window is clear
              </>
            ) : (
              <>
                <TriangleAlert size={14} aria-hidden="true" /> {windowDays}-day window
              </>
            )}
          </span>
          <div className="hero-window-switch" aria-label="Choose restock window">
            {([3, 7, 14] as const).map((window) => (
              <button
                key={window}
                className={windowDays === window ? 'active' : ''}
                onClick={() => onWindowChange(window)}
                aria-pressed={windowDays === window}
              >
                <strong>{counts[window]}</strong>
                <span>{window} days</span>
              </button>
            ))}
          </div>
        </div>
        <h2>
          {counts[windowDays] === 0
            ? 'Nothing needs your attention yet.'
            : `${counts[windowDays]} ${counts[windowDays] === 1 ? 'item may need' : 'items may need'} a restock`}
        </h2>
        <p>
          {counts[windowDays] === 0
            ? 'Keep logging run-outs and the estimates will keep learning your household rhythm.'
            : 'These are estimates, not guarantees. Correct any date that does not feel right.'}
        </p>
        <div className="hero-strip" aria-hidden="true">
          {dayCounts.map((count, index) => (
            <span
              key={index}
              className={`hero-strip-bar${index < windowDays ? ' in-window' : ''}`}
              style={{ height: `${Math.max(7, Math.round((count / stripMax) * 100))}%` }}
            />
          ))}
        </div>
        <div className="hero-strip-axis" aria-hidden="true">
          <span>Today</span>
          <span>7 days</span>
          <span>14 days</span>
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="panel due-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Coming up</p>
                <h2>Next {windowDays} days</h2>
              </div>
              <button className="text-link" onClick={() => onWindowChange(14)}>
                View 14 days <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>

            {dueItems.length === 0 ? (
              <div className="inline-empty">
                <span className="inline-empty-icon">
                  <BadgeCheck size={24} aria-hidden="true" />
                </span>
                <div>
                  <strong>No estimates in this window.</strong>
                  <p>Your next restock may simply be further out.</p>
                </div>
              </div>
            ) : (
              <div className="due-list">
                {dueItems.map((item) => {
                  const estimate = estimates.get(item.id)
                  if (!estimate) return null
                  const onList = item.onShoppingList
                  return (
                    <article
                      key={item.id}
                      className={`due-row${estimate.overdue ? ' overdue' : ''}`}
                    >
                      <button className="due-row-main" onClick={() => onOpenItem(item.id)}>
                        <ProductThumb
                          src={item.product.imageUrl}
                          name={item.product.name}
                          size="small"
                        />
                        <span className="due-row-copy">
                          <span className="due-row-name">{item.product.name}</span>
                          <span className="due-row-meta">
                            {item.product.brand ? `${item.product.brand} · ` : ''}
                            {suggestedQuantity(item)}
                          </span>
                        </span>
                      </button>
                      <div className="due-row-timing">
                        <strong>{shortRelativeDays(estimate.daysLeft)}</strong>
                        <span>Est. {formatDate(estimate.expectedDate)}</span>
                      </div>
                      <EstimateBadge estimate={estimate} compact />
                      <div className="due-row-actions">
                        <button
                          className="icon-button"
                          title={onList ? 'Pinned to restock list' : 'Pin to restock list'}
                          aria-label={
                            onList ? 'Unpin from restock list' : 'Pin to restock list'
                          }
                          onClick={() => onToggleList(item.id, !onList)}
                        >
                          <ShoppingBasket
                            size={17}
                            aria-hidden="true"
                            fill={onList ? 'currentColor' : 'none'}
                          />
                        </button>
                        <button
                          className="icon-button quick-buy"
                          title="Log a purchase"
                          aria-label={`Log a purchase for ${item.product.name}`}
                          onClick={() => onLogPurchase(item.id)}
                        >
                          <Check size={17} aria-hidden="true" />
                        </button>
                        <button
                          className="icon-button"
                          title="Open item"
                          aria-label={`Open ${item.product.name}`}
                          onClick={() => onOpenItem(item.id)}
                        >
                          <ArrowRight size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
            <p className="estimate-disclaimer">
              <Clock3 size={13} aria-hidden="true" /> Dates are estimates built from your
              history. They can be early or late until your household has more recorded run-outs.
            </p>
          </section>

          <section className="panel restock-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Restock checklist</p>
                <h2>Before the next shop</h2>
              </div>
              <span className="checklist-count">
                {checkedCount}/{listItems.length} done
              </span>
            </div>

            {listItems.length === 0 ? (
              <div className="inline-empty">
                <span className="inline-empty-icon">
                  <ShoppingBasket size={23} aria-hidden="true" />
                </span>
                <div>
                  <strong>Your checklist is clear.</strong>
                  <p>Items due in the next 14 days appear here automatically.</p>
                </div>
              </div>
            ) : (
              <>
                <ul className="checklist">
                  {listItems.map((item) => {
                    const estimate = estimates.get(item.id)
                    return (
                      <li key={item.id} className={item.listChecked ? 'is-checked' : ''}>
                        <label className="check-control">
                          <input
                            type="checkbox"
                            checked={item.listChecked}
                            onChange={(event) => onToggleChecked(item.id, event.target.checked)}
                          />
                          <span className="custom-check" aria-hidden="true">
                            <Check size={13} />
                          </span>
                          <span className="checklist-copy">
                            <strong>{item.product.name}</strong>
                            <span>
                              {suggestedQuantity(item)}
                              {estimate
                                ? ` · ${relativeDays(estimate.daysLeft)}`
                                : ' · no active stock'}
                            </span>
                          </span>
                        </label>
                        <button
                          className="text-link checklist-open"
                          onClick={() => onOpenItem(item.id)}
                          aria-label={`Open ${item.product.name}`}
                        >
                          Details
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="checklist-footer">
                  {checkedCount > 0 ? (
                    <button className="btn ghost small" onClick={onClearChecked}>
                      Clear checked
                    </button>
                  ) : (
                    <span />
                  )}
                  <button className="text-link" onClick={onShowShare}>
                    Share this list <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="dashboard-side">
          <section className="insight-card">
            <span className="insight-icon">
              <PackagePlus size={19} aria-hidden="true" />
            </span>
            <h2>Estimate, then correct</h2>
            <p>
              Tap <strong>Log a purchase</strong> when you restock, or open an item to record a
              real run-out date. Every correction improves that item's range.
            </p>
            <button className="text-link" onClick={onShowAbout}>
              How the calculation works <ArrowRight size={14} aria-hidden="true" />
            </button>
          </section>

          <section className="insight-card insight-muted">
            <span className="insight-icon">
              <LockKeyhole size={19} aria-hidden="true" />
            </span>
            <h2>Only on this device</h2>
            <p>
              {items.length} {items.length === 1 ? 'item' : 'items'} and {completedCycleCount}{' '}
              completed {completedCycleCount === 1 ? 'cycle' : 'cycles'} stored locally. Nothing
              is uploaded anywhere. It stays in this browser.
            </p>
            <button className="text-link" onClick={onShowAbout}>
              Privacy details <ArrowRight size={14} aria-hidden="true" />
            </button>
          </section>

          <button className="add-nudge" onClick={onAddItem}>
            <span className="add-nudge-icon">
              <Plus size={20} aria-hidden="true" />
            </span>
            <span>
              <strong>Bought something new?</strong>
              <small>Add it to your pantry</small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </aside>
      </div>
    </div>
  )
}
