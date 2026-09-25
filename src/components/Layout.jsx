import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, ArrowLeftRight, BarChart2, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import TourTooltip from './TourTooltip'

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

const MAIN_STEPS = [
  { target: 'stat-tiles',        title: 'Monthly Overview',      text: 'Your income, expenses and balance for this month, updated in real time.' },
  { target: 'fab',               title: 'Add a Transaction',     text: 'Tap the + button to quickly log any income or expense.' },
  { target: 'nav-transactions',  title: 'Transactions',          text: 'View, filter and manage all your household transactions here.' },
  { target: 'nav-reports',       title: 'Reports',               text: 'Visualise spending by category — monthly or yearly charts.' },
  { target: 'nav-settings',      title: 'Settings',              text: 'Manage your household, invite family members and install the app.' },
  { target: 'invite-code',       title: 'Invite Code',           text: 'Share this code with family so they can join your household.' },
]

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()

  // Ensure Dashboard is always behind non-dashboard tabs in history
  useEffect(() => {
    if (pathname !== '/') {
      window.history.pushState({ dashboard: true }, '', '/')
      window.history.pushState({ tab: pathname }, '', pathname)
    }
  }, [pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function handleTourStep(stepIndex, step) {
    if (step.target === 'invite-code') {
      navigate('/settings', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-bold text-blue-600">ManeLekka</h1>
        <button onClick={handleSignOut} className="text-gray-500 hover:text-red-500 transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>

      {/* Bottom nav — mobile first */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around z-10">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to
          return (
            <Link
              key={to}
              to={to}
              replace
              data-tour={`nav-${label.toLowerCase()}`}
              className={`flex flex-col items-center py-2 px-3 text-xs transition-colors ${
                active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="mt-0.5">{label}</span>
            </Link>
          )
        })}
      </nav>

      {profile?.household_id && (
        <TourTooltip
          steps={MAIN_STEPS}
          storageKey="tour_main_done"
          onStep={handleTourStep}
        />
      )}
    </div>
  )
}
