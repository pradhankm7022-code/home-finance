import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const INCOME_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857', '#a7f3d0', '#d1fae5']
const EXPENSE_COLORS = ['#ef4444', '#f87171', '#fca5a5', '#dc2626', '#b91c1c', '#fecaca', '#fee2e2']

function CategoryFilter({ categories, selected, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {['All', ...categories].map(cat => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
            selected === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

function MonthBarChart({ title, transactions, type, categoryFilter, fmt }) {
  const filtered = categoryFilter === 'All'
    ? transactions.filter(t => t.type === type)
    : transactions.filter(t => t.type === type && t.category === categoryFilter)

  const data = MONTHS.map((name, i) => ({
    name,
    amount: filtered
      .filter(t => new Date(t.date).getMonth() === i)
      .reduce((s, t) => s + Number(t.amount), 0)
  }))

  const fill = type === 'income' ? '#10b981' : '#ef4444'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">No data</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Line type="monotone" dataKey="amount" stroke={fill} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name={type === 'income' ? 'Income' : 'Expense'} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

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
  const { profile, user } = useAuth()
  const [mode, setMode] = useState('monthly')
  const [scope, setScope] = useState('household')
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [transactions, setTransactions] = useState([])
  const [expenseCatFilter, setExpenseCatFilter] = useState('All')
  const [incomeCatFilter, setIncomeCatFilter] = useState('All')

  useEffect(() => {
    if (!profile?.household_id) return
    fetchTransactions()
  }, [profile?.household_id, mode, month, year])

  // Reset filters when mode or year changes
  useEffect(() => {
    setExpenseCatFilter('All')
    setIncomeCatFilter('All')
  }, [mode, year])

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

  const visibleTransactions = scope === 'mine'
    ? transactions.filter(t => t.user_id === user.id)
    : transactions

  const income = visibleTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = visibleTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  const incomeCategories = [...new Set(visibleTransactions.filter(t => t.type === 'income').map(t => t.category))].sort()
  const expenseCategories = [...new Set(visibleTransactions.filter(t => t.type === 'expense').map(t => t.category))].sort()

  const byIncomeCategory = Object.entries(
    visibleTransactions.filter(t => t.type === 'income').reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const byExpenseCategory = Object.entries(
    visibleTransactions.filter(t => t.type === 'expense').reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-800">Reports</h2>
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

      {/* Scope toggle */}
      <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
        {[['household', 'Household'], ['mine', 'Mine']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setScope(val)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              scope === val ? 'bg-white shadow text-blue-600' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
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

      {/* Yearly-only: month-by-month bar charts with category filter */}
      {mode === 'yearly' && (
        <>
          {/* Yearly Expenses by Month */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Yearly Expenses</h3>
            </div>
            <CategoryFilter
              categories={expenseCategories}
              selected={expenseCatFilter}
              onChange={setExpenseCatFilter}
            />
            <div className="mt-3">
              <MonthBarChart
                title=""
                transactions={visibleTransactions}
                type="expense"
                categoryFilter={expenseCatFilter}
                fmt={fmt}
              />
            </div>
          </div>

          {/* Yearly Income by Month */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Yearly Income</h3>
            </div>
            <CategoryFilter
              categories={incomeCategories}
              selected={incomeCatFilter}
              onChange={setIncomeCatFilter}
            />
            <div className="mt-3">
              <MonthBarChart
                title=""
                transactions={visibleTransactions}
                type="income"
                categoryFilter={incomeCatFilter}
                fmt={fmt}
              />
            </div>
          </div>
        </>
      )}

      {/* Pie charts — both modes */}
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

      {visibleTransactions.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          No transactions for this {mode === 'monthly' ? 'month' : 'year'}
        </div>
      )}
    </div>
  )
}
