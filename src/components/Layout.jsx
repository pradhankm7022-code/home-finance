import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, ArrowLeftRight, BarChart2, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-bold text-blue-600">HomeFinance</h1>
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
    </div>
  )
}
