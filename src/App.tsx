import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle } from 'lucide-react'
import type {
  AddPurchaseInput,
  CreateItemInput,
  DueWindow,
  ProductCandidate,
  SharePayload,
  UpdateActivePurchaseInput,
  UpdateCompletedPurchaseInput,
} from './types'
import { db } from './lib/db'
import {
  addPurchase,
  archiveItem,
  clearCheckedItems,
  createTrackedItem,
  deleteItem,
  deletePurchase,
  getHouseholdSettings,
  importSharedData,
  markConsumed,
  resetAllData,
  restoreItem,
  saveHouseholdName,
  seedDemoData,
  setListChecked,
  setShoppingList,
  undoConsumption,
  updateActivePurchase,
  updateCompletedPurchase,
  updateItemDetails,
} from './lib/repository'
import { getActivePurchase, estimateRestock } from './lib/prediction'
import { todayISO } from './lib/dates'
import { decodeShareToken, readShareTokenFromHash } from './lib/share'
import { AppShell, type MainView } from './components/AppShell'
import { Toast, type ToastMessage } from './components/Toast'
import { AddTrackingModal } from './components/modals/AddTrackingModal'
import {
  ConsumedModal,
  CorrectEstimateModal,
  EditCycleModal,
  EditItemModal,
  LogPurchaseModal,
} from './components/modals/ItemModals'
import { SettingsModal } from './components/modals/SettingsModal'
import { ImportModal } from './components/modals/ImportModal'
import { ConfirmModal } from './components/modals/ConfirmModal'
import { Dashboard } from './views/Dashboard'
import { Pantry } from './views/Pantry'
import { AddView } from './views/AddView'
import { ItemDetail } from './views/ItemDetail'
import { ShareView } from './views/ShareView'
import { AboutView } from './views/AboutView'

type View = MainView

type ModalState =
  | { type: 'add-tracking'; product: ProductCandidate }
  | { type: 'log-purchase'; itemId: string }
  | { type: 'consume'; itemId: string }
  | { type: 'correct'; itemId: string }
  | { type: 'edit-item'; itemId: string }
  | { type: 'edit-cycle'; itemId: string; purchaseId: string }

type ConfirmState =
  | { type: 'delete-item'; itemId: string }
  | { type: 'clear-data' }

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState<DueWindow>(7)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [pendingImport, setPendingImport] = useState<SharePayload | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [bootError, setBootError] = useState('')

  const items = useLiveQuery(() => db.items.toArray(), [])
  const settings = useLiveQuery(() => getHouseholdSettings(), [])
  const householdName = settings?.householdName || 'Our household'

  const notify = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    setToast({ id: Date.now(), text, tone })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  useEffect(() => {
    const token = readShareTokenFromHash(window.location.hash)
    if (!token) return
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
    decodeShareToken(token)
      .then((payload) => {
        setPendingImport(payload)
        setView('dashboard')
      })
      .catch((error) => {
        setBootError(error instanceof Error ? error.message : 'Could not read this share link.')
        setView('share')
      })
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [view, selectedItemId])

  const selectedItem = useMemo(
    () => (selectedItemId ? items?.find((item) => item.id === selectedItemId) : undefined),
    [items, selectedItemId],
  )

  useEffect(() => {
    if (view === 'item' && items && selectedItemId && !selectedItem) {
      setView('pantry')
      setSelectedItemId(null)
      notify('That item no longer exists.', 'error')
    }
  }, [view, items, selectedItemId, selectedItem, notify])

  const navigate = (next: Exclude<MainView, 'item'>) => {
    setView(next)
    setSelectedItemId(null)
  }

  const openItem = (itemId: string) => {
    setSelectedItemId(itemId)
    setView('item')
  }

  const modalItem =
    modal && 'itemId' in modal ? items?.find((item) => item.id === modal.itemId) : undefined

  const modalPurchase =
    modal?.type === 'edit-cycle'
      ? modalItem?.purchases.find((purchase) => purchase.id === modal.purchaseId)
      : undefined

  const activePurchase = modalItem ? getActivePurchase(modalItem) : undefined
  const activeEstimate =
    modalItem && modal?.type === 'correct'
      ? estimateRestock(modalItem, todayISO())
      : null

  const handleCreateItem = async (input: CreateItemInput) => {
    const item = await createTrackedItem(input)
    setModal(null)
    setSelectedItemId(item.id)
    setView('item')
    notify(`${item.product.name} is now in your pantry.`)
  }

  const handleManualCreate = async (input: CreateItemInput) => {
    const item = await createTrackedItem(input)
    setSelectedItemId(item.id)
    setView('item')
    notify(`${item.product.name} is now in your pantry.`)
  }

  const handleImport = async (mode: 'merge' | 'replace') => {
    if (!pendingImport) {
      throw new Error('There is no shared household to import.')
    }
    const result = await importSharedData(pendingImport, mode)
    setPendingImport(null)
    setView('pantry')
    setSelectedItemId(null)
    if (result.replaced) {
      notify(`Replaced this device's data with ${result.added} imported items.`)
    } else if (result.added === 0) {
      notify('No new items were added — they are already on this device.')
    } else {
      notify(
        `Added ${result.added} ${result.added === 1 ? 'item' : 'items'}${
          result.skipped > 0 ? `, skipped ${result.skipped} duplicate` : ''
        }.`,
      )
    }
    return result
  }

  const handleEditPurchase = (itemId: string, purchaseId: string) => {
    const item = items?.find((entry) => entry.id === itemId)
    const purchase = item?.purchases.find((entry) => entry.id === purchaseId)
    if (!purchase) return
    if (!purchase.endedAt) {
      setModal({ type: 'correct', itemId })
    } else {
      setModal({ type: 'edit-cycle', itemId, purchaseId })
    }
  }

  const handleEditItemSave = async (details: {
    name: string
    brand: string
    barcode: string
    quantityLabel: string
    unitLabel: string
    notes: string
  }) => {
    if (!modalItem) return
    await updateItemDetails(modalItem.id, details)
    setModal(null)
    notify('Item details saved.')
  }

  const handleLogPurchase = async (input: AddPurchaseInput) => {
    if (!modalItem) return
    await addPurchase(modalItem.id, input)
    setModal(null)
    notify(`Purchase logged for ${modalItem.product.name}.`)
  }

  const handleConsumed = async (endedAt: string, notes: string) => {
    if (!modalItem) return
    await markConsumed(modalItem.id, endedAt, notes)
    setModal(null)
    notify(`Run-out recorded for ${modalItem.product.name}. The estimate was updated.`)
  }

  const handleCorrectEstimate = async (input: UpdateActivePurchaseInput) => {
    if (!modalItem || !activePurchase) return
    await updateActivePurchase(modalItem.id, activePurchase.id, input)
    setModal(null)
    notify('Estimate correction saved.')
  }

  const handleUpdateCycle = async (input: UpdateCompletedPurchaseInput) => {
    if (!modalItem || !modalPurchase) return
    await updateCompletedPurchase(modalItem.id, modalPurchase.id, input)
    setModal(null)
    notify('Purchase cycle corrected.')
  }

  const handleDeleteCycle = async () => {
    if (!modalItem || !modalPurchase) return
    await deletePurchase(modalItem.id, modalPurchase.id)
    setModal(null)
    notify('Purchase cycle deleted.')
  }

  const handleArchive = async (itemId: string) => {
    const item = items?.find((entry) => entry.id === itemId)
    await archiveItem(itemId)
    notify(`${item?.product.name ?? 'Item'} is no longer tracked.`)
  }

  const handleRestore = async (itemId: string) => {
    await restoreItem(itemId)
    notify('Tracking restored.')
  }

  const handleUndoConsumed = async (itemId: string) => {
    await undoConsumption(itemId)
    notify('Run-out undone. The purchase is active again.')
  }

  const handleToggleList = async (itemId: string, onList: boolean) => {
    await setShoppingList(itemId, onList)
    notify(onList ? 'Added to the restock list.' : 'Removed from the restock list.')
  }

  const handleToggleChecked = async (itemId: string, checked: boolean) => {
    await setListChecked(itemId, checked)
  }

  const handleClearChecked = async () => {
    await clearCheckedItems()
    notify('Checked items cleared from the list.')
  }

  const handleSeedDemo = async () => {
    await seedDemoData()
    setView('dashboard')
    notify('A sample household was added. Edit or delete anything you like.')
  }

  const handleSaveHousehold = async (name: string) => {
    await saveHouseholdName(name)
    notify('Household name saved.')
  }

  const handleClearData = async () => {
    await resetAllData()
    setConfirm(null)
    setSettingsOpen(false)
    setSelectedItemId(null)
    setView('dashboard')
    notify('All local pantry data was cleared.')
  }

  const handleDeleteItem = async (itemId: string) => {
    await deleteItem(itemId)
    setConfirm(null)
    setSelectedItemId(null)
    setView('pantry')
    notify('Item and its local history were deleted.')
  }

  if (!items || !settings) {
    return (
      <div className="boot-screen">
        <span className="boot-mark">
          <span />
          <span />
          <span />
        </span>
        <p>Opening your local pantry…</p>
      </div>
    )
  }

  return (
    <>
      <AppShell
        active={view}
        householdName={householdName}
        onNavigate={navigate}
        onOpenSettings={() => setSettingsOpen(true)}
      >
        {bootError ? (
          <div className="page">
            <div className="banner error-banner" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>Share link could not be opened</strong>
                <p>{bootError}</p>
                <button className="text-link" onClick={() => setBootError('')}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {view === 'dashboard' ? (
          <Dashboard
            items={items}
            householdName={householdName}
            windowDays={windowDays}
            onWindowChange={setWindowDays}
            onAddItem={() => navigate('add')}
            onOpenItem={openItem}
            onLogPurchase={(itemId) => setModal({ type: 'log-purchase', itemId })}
            onToggleList={(itemId, onList) => void handleToggleList(itemId, onList)}
            onToggleChecked={(itemId, checked) => void handleToggleChecked(itemId, checked)}
            onClearChecked={() => void handleClearChecked()}
            onSeedDemo={() => void handleSeedDemo()}
            onShowShare={() => navigate('share')}
            onShowAbout={() => navigate('about')}
          />
        ) : null}

        {view === 'pantry' ? (
          <Pantry
            items={items}
            onAddItem={() => navigate('add')}
            onOpenItem={openItem}
            onLogPurchase={(itemId) => setModal({ type: 'log-purchase', itemId })}
            onToggleList={(itemId, onList) => void handleToggleList(itemId, onList)}
          />
        ) : null}

        {view === 'add' ? (
          <AddView
            onProductSelected={(product) => setModal({ type: 'add-tracking', product })}
            onCreateManual={handleManualCreate}
          />
        ) : null}

        {view === 'item' && selectedItem ? (
          <ItemDetail
            item={selectedItem}
            estimate={estimateRestock(selectedItem, todayISO())}
            onBack={() => {
              setView('pantry')
              setSelectedItemId(null)
            }}
            onLogPurchase={(itemId) => setModal({ type: 'log-purchase', itemId })}
            onMarkConsumed={(itemId) => setModal({ type: 'consume', itemId })}
            onCorrectEstimate={(itemId) => setModal({ type: 'correct', itemId })}
            onEditItem={(itemId) => setModal({ type: 'edit-item', itemId })}
            onEditPurchase={handleEditPurchase}
            onToggleList={(itemId, onList) => void handleToggleList(itemId, onList)}
            onArchive={(itemId) => void handleArchive(itemId)}
            onRestore={(itemId) => void handleRestore(itemId)}
            onUndoConsumed={(itemId) => void handleUndoConsumed(itemId)}
            onDelete={(itemId) => setConfirm({ type: 'delete-item', itemId })}
          />
        ) : null}

        {view === 'share' ? (
          <ShareView
            items={items}
            householdName={householdName}
            onImportPayload={setPendingImport}
            onToast={notify}
          />
        ) : null}

        {view === 'about' ? <AboutView /> : null}
      </AppShell>

      {modal?.type === 'add-tracking' ? (
        <AddTrackingModal
          product={modal.product}
          onClose={() => setModal(null)}
          onCreate={handleCreateItem}
        />
      ) : null}

      {modal?.type === 'log-purchase' && modalItem ? (
        <LogPurchaseModal
          item={modalItem}
          active={getActivePurchase(modalItem)}
          onClose={() => setModal(null)}
          onSave={handleLogPurchase}
        />
      ) : null}

      {modal?.type === 'consume' && modalItem && activePurchase ? (
        <ConsumedModal
          item={modalItem}
          active={activePurchase}
          onClose={() => setModal(null)}
          onSave={handleConsumed}
        />
      ) : null}

      {modal?.type === 'correct' && modalItem && activePurchase ? (
        <CorrectEstimateModal
          item={modalItem}
          active={activePurchase}
          estimate={activeEstimate}
          onClose={() => setModal(null)}
          onSave={handleCorrectEstimate}
        />
      ) : null}

      {modal?.type === 'edit-item' && modalItem ? (
        <EditItemModal
          item={modalItem}
          onClose={() => setModal(null)}
          onSave={handleEditItemSave}
        />
      ) : null}

      {modal?.type === 'edit-cycle' && modalItem && modalPurchase?.endedAt ? (
        <EditCycleModal
          item={modalItem}
          purchase={modalPurchase}
          onClose={() => setModal(null)}
          onSave={handleUpdateCycle}
          onDelete={handleDeleteCycle}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsModal
          householdName={householdName}
          itemCount={items.length}
          purchaseCount={items.reduce((total, item) => total + item.purchases.length, 0)}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveHousehold}
          onShowAbout={() => {
            setSettingsOpen(false)
            navigate('about')
          }}
          onShowShare={() => {
            setSettingsOpen(false)
            navigate('share')
          }}
          onClearData={() => {
            setSettingsOpen(false)
            setConfirm({ type: 'clear-data' })
          }}
        />
      ) : null}

      {pendingImport ? (
        <ImportModal
          payload={pendingImport}
          currentItemCount={items.length}
          onClose={() => setPendingImport(null)}
          onImport={handleImport}
        />
      ) : null}

      {confirm?.type === 'delete-item' ? (
        <ConfirmModal
          title="Delete this item?"
          message="Its purchase history and all local notes will be removed permanently. Archive it instead if you only want to stop tracking."
          confirmLabel="Delete permanently"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={() => handleDeleteItem(confirm.itemId)}
        />
      ) : null}

      {confirm?.type === 'clear-data' ? (
        <ConfirmModal
          title="Clear all local data?"
          message="Every item, purchase cycle, note, and setting will be deleted from this browser. This cannot be undone."
          confirmLabel="Clear everything"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={handleClearData}
        />
      ) : null}

      <Toast toast={toast} onDismiss={dismissToast} />
    </>
  )
}
