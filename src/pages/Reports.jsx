import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const INCOME_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857', '#a7f3d0', '#d1fae5']
const EXPENSE_COLORS = ['#ef4444', '#f87171', '#fca5a5', '#dc2626', '#b91c1c', '#fecaca', '#fee2e2']

function PieChartCard({ title, data, colors, total, fmt }) {
  if (data.length === 0) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-xs text-gray-400 text-center py-6">No data</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs font-medium text-gray-500">{fmt(total)}</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            dataKey="value"
            paddingAngle={2}
          >
            {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => fmt(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 mt-1">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-gray-600">{item.name}</span>
            </div>
            <span className="text-gray-500 font-medium">{fmt(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Reports() {
  const { profile } = useAuth()
  const [mode, setMode] = useState('monthly')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    if (!profile?.household_id) return
    fetchTransactions()
  }, [profile?.household_id, mode, month, year])

  async function fetchTransactions() {
    let start, end
    if (mode === 'monthly') {
      start = `${month}-01`
      end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 1).toISOString().slice(0, 10)
    } else {
      start = `${year}-01-01`
      end = `${Number(year) + 1}-01-01`
    }
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('household_id', profile.household_id)
      .gte('date', start)
      .lt('date', end)
    setTransactions(data || [])
  }

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const byIncomeCategory = Object.entries(
    transactions.filter(t => t.type === 'income').reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const byExpenseCategory = Object.entries(
    transactions.filter(t => t.type === 'expense').reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const barData = (() => {
    const cats = {}
    transactions.forEach(t => {
      if (!cats[t.category]) cats[t.category] = { name: t.category, income: 0, expense: 0 }
      cats[t.category][t.type] = (cats[t.category][t.type] || 0) + Number(t.amount)
    })
    return Object.values(cats).sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
  })()

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Reports</h2>

        {/* Mode toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1">
          {['monthly', 'yearly'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition-colors ${
                mode === m ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Date picker */}
      <div className="mb-4">
        {mode === 'monthly' ? (
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
          />
        ) : (
          <div className="flex gap-2 flex-wrap">
            {yearOptions.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  year === y ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Income</p>
          <p className="font-bold text-green-600 text-sm">{fmt(income)}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Expenses</p>
          <p className="font-bold text-red-500 text-sm">{fmt(expenses)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Saved</p>
          <p className={`font-bold text-sm ${income - expenses >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmt(income - expenses)}</p>
        </div>
      </div>

      {/* Bar chart — income + expense per category */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {mode === 'monthly' ? 'Monthly' : 'Yearly'} by Category
        </h3>
        {barData.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie charts */}
      <div className="space-y-4">
        <PieChartCard
          title="Income by Category"
          data={byIncomeCategory}
          colors={INCOME_COLORS}
          total={income}
          fmt={fmt}
        />
        <PieChartCard
          title="Expenses by Category"
          data={byExpenseCategory}
          colors={EXPENSE_COLORS}
          total={expenses}
          fmt={fmt}
        />
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          No transactions for this {mode === 'monthly' ? 'month' : 'year'}
        </div>
      )}
    </div>
  )
}
