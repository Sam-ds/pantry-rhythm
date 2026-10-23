import type { ReactNode } from 'react'
import {
  Info,
  LayoutDashboard,
  LockKeyhole,
  Package,
  Plus,
  QrCode,
  Settings,
} from 'lucide-react'

export type MainView = 'dashboard' | 'pantry' | 'add' | 'share' | 'about' | 'item'

interface AppShellProps {
  active: MainView
  householdName: string
  onNavigate: (view: Exclude<MainView, 'item'>) => void
  onOpenSettings: () => void
  children: ReactNode
}

const navItems: Array<{
  view: Exclude<MainView, 'item'>
  label: string
  icon: typeof LayoutDashboard
}> = [
  { view: 'dashboard', label: 'Today', icon: LayoutDashboard },
  { view: 'pantry', label: 'Pantry', icon: Package },
  { view: 'add', label: 'Add item', icon: Plus },
  { view: 'share', label: 'Share', icon: QrCode },
]

function RhythmMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

export function AppShell({
  active,
  householdName,
  onNavigate,
  onOpenSettings,
  children,
}: AppShellProps) {
  const activeForNav = active === 'item' ? 'pantry' : active

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand brand-sidebar" onClick={() => onNavigate('dashboard')}>
          <RhythmMark />
          <span>
            <strong>Pantry Rhythm</strong>
            <small>{householdName}</small>
          </span>
        </button>

        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.view}
                className={`nav-button${activeForNav === item.view ? ' active' : ''}`}
                onClick={() => onNavigate(item.view)}
                aria-current={activeForNav === item.view ? 'page' : undefined}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            )
          })}
          <button
            className={`nav-button${active === 'about' ? ' active' : ''}`}
            onClick={() => onNavigate('about')}
            aria-current={active === 'about' ? 'page' : undefined}
          >
            <Info size={19} aria-hidden="true" />
            <span>About & privacy</span>
          </button>
        </nav>

        <div className="sidebar-trust">
          <span className="trust-icon">
            <LockKeyhole size={17} aria-hidden="true" />
          </span>
          <div>
            <strong>Private by default</strong>
            <p>Your pantry history stays in this browser. No account, no server database.</p>
            <button className="text-link" onClick={() => onNavigate('about')}>
              How your data works
            </button>
          </div>
        </div>
        <p className="sidebar-version">Local-first preview · v0.1</p>
      </aside>

      <div className="app-column">
        <header className="mobile-header">
          <button className="brand" onClick={() => onNavigate('dashboard')} aria-label="Pantry Rhythm home">
            <RhythmMark />
            <span>
              <strong>Pantry Rhythm</strong>
              <small>{householdName}</small>
            </span>
          </button>
          <div className="mobile-header-actions">
            <span className="local-pill">
              <LockKeyhole size={12} aria-hidden="true" /> Local
            </span>
            <button className="icon-button" onClick={onOpenSettings} aria-label="Open settings">
              <Settings size={19} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="main-content" id="main">
          {children}
        </main>

        <nav className="bottom-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon
            const isAdd = item.view === 'add'
            return (
              <button
                key={item.view}
                className={`bottom-nav-button${isAdd ? ' bottom-nav-add' : ''}${
                  activeForNav === item.view ? ' active' : ''
                }`}
                onClick={() => onNavigate(item.view)}
                aria-current={activeForNav === item.view ? 'page' : undefined}
              >
                <span className="bottom-nav-icon">
                  <Icon size={isAdd ? 23 : 21} aria-hidden="true" />
                </span>
                <span>{item.label === 'Add item' ? 'Add' : item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
