import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, TrendingDown, Wallet, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.household_id) return
    fetchTransactions()

    const channel = supabase
      .channel('transactions')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'transactions',
        filter: `household_id=eq.${profile.household_id}`
      }, () => fetchTransactions())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.household_id])

  async function fetchTransactions() {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('household_id', profile.household_id)
      .gte('date', startOfMonth.toISOString().slice(0, 10))
      .order('date', { ascending: false })
    if (!error) setTransactions(data || [])
    setLoading(false)
  }

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

  if (!profile?.household_id) return (
    <div className="p-6 text-center text-gray-500">
      <p>You are not in a household yet.</p>
      <Link to="/setup-household" className="text-blue-600 font-medium mt-2 block">Set up household →</Link>
    </div>
  )

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="mb-4">
        <p className="text-sm text-gray-500">Welcome back,</p>
        <h2 className="text-xl font-bold text-gray-800">{profile?.name}</h2>
        <p className="text-xs text-gray-400">{profile?.households?.name}</p>
      </div>

      {/* Summary cards */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">This month</p>
      </div>
      <div data-tour="stat-tiles" className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-600 text-white rounded-2xl p-3">
          <Wallet size={16} className="mb-1 opacity-80" />
          <p className="text-xs opacity-80">Balance</p>
          <p className="font-bold text-base">{fmt(balance)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
          <TrendingUp size={16} className="mb-1 text-green-500" />
          <p className="text-xs text-gray-500">Income</p>
          <p className="font-bold text-green-600 text-base">{fmt(income)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
          <TrendingDown size={16} className="mb-1 text-red-500" />
          <p className="text-xs text-gray-500">Expenses</p>
          <p className="font-bold text-red-500 text-base">{fmt(expenses)}</p>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">Recent Transactions</h3>
        <Link to="/transactions" className="text-xs text-blue-600">See all</Link>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No transactions this month</div>
      ) : (
        <div className="space-y-2">
          {transactions.slice(0, 8).map(t => (
            <div key={t.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between border border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-800">{t.description}</p>
                <p className="text-xs text-gray-400">{t.category} · {new Date(t.date).toLocaleDateString()}</p>
              </div>
              <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        data-tour="fab"
        onClick={() => navigate('/transactions', { state: { openForm: true }, replace: true })}
        className="fixed bottom-20 right-4 bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors"
      >
        <Plus size={22} />
      </button>
    </div>
  )
}
