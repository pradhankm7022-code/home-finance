import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'

function CategoryInput({ value, onChange, type, householdId }) {
  const [input, setInput] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    loadCategories()
  }, [type, householdId])

  useEffect(() => {
    setInput(value || '')
  }, [value])

  async function loadCategories() {
    const { data } = await supabase
      .from('categories')
      .select('name')
      .eq('household_id', householdId)
      .or(`type.eq.${type},type.eq.both`)
      .order('name')
    setAllCategories(data?.map(c => c.name) || [])
  }

  function handleInput(val) {
    setInput(val)
    onChange(val)
    if (val.trim()) {
      setSuggestions(allCategories.filter(c => c.toLowerCase().includes(val.toLowerCase())))
    } else {
      setSuggestions(allCategories)
    }
    setShowSuggestions(true)
  }

  function handleFocus() {
    setSuggestions(input.trim() ? allCategories.filter(c => c.toLowerCase().includes(input.toLowerCase())) : allCategories)
    setShowSuggestions(true)
  }

  function selectSuggestion(name) {
    setInput(name)
    onChange(name)
    setShowSuggestions(false)
  }

  // Hide dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const showCreate = input.trim() && !allCategories.some(c => c.toLowerCase() === input.trim().toLowerCase())

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        placeholder="Category (e.g. Groceries)"
        value={input}
        onChange={e => handleInput(e.target.value)}
        onFocus={handleFocus}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {showSuggestions && (suggestions.length > 0 || showCreate) && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(name => (
            <button
              key={name}
              type="button"
              onMouseDown={() => selectSuggestion(name)}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 first:rounded-t-xl"
            >
              {name}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onMouseDown={() => selectSuggestion(input.trim())}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 border-t border-gray-100 last:rounded-b-xl flex items-center gap-2"
            >
              <Plus size={14} />
              Create "{input.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TransactionForm({ initial, onSave, onCancel, error, householdId }) {
  const [form, setForm] = useState(initial || {
    description: '', amount: '', category: '', type: 'expense', date: new Date().toISOString().slice(0, 10)
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{initial ? 'Edit' : 'Add'} Transaction</h3>
          <button onClick={onCancel}><X size={18} className="text-gray-400" /></button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
        )}

        {/* Type toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1">
          {['expense', 'income'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { set('type', t); set('category', '') }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${
                form.type === t
                  ? t === 'expense' ? 'bg-white shadow text-red-500' : 'bg-white shadow text-green-600'
                  : 'text-gray-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="number"
          placeholder="Amount"
          value={form.amount}
          onChange={e => set('amount', e.target.value)}
          min="0"
          step="0.01"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <CategoryInput
          value={form.category}
          onChange={v => set('category', v)}
          type={form.type}
          householdId={householdId}
        />

        <input
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="button"
          onClick={() => onSave(form)}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
        >
          {initial ? 'Update' : 'Add Transaction'}
        </button>
      </div>
    </div>
  )
}

export default function Transactions() {
  const { profile, user } = useAuth()
  const location = useLocation()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (location.state?.openForm) setShowForm(true)
  }, [location.state])

  // Push a fake history entry when form opens so back button closes it
  useEffect(() => {
    if (showForm) {
      window.history.pushState({ modal: true }, '')
    }
  }, [showForm])

  // Intercept back button while form is open
  useEffect(() => {
    function handlePopState() {
      if (showForm) {
        setShowForm(false)
        setEditing(null)
        setSaveError('')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [showForm])

  useEffect(() => {
    if (!profile?.household_id) return
    fetchTransactions()

    const channel = supabase
      .channel('transactions-list')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'transactions',
        filter: `household_id=eq.${profile.household_id}`
      }, () => fetchTransactions())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.household_id])

  async function fetchTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('household_id', profile.household_id)
      .order('date', { ascending: false })
    if (!error) setTransactions(data || [])
    setLoading(false)
  }

  async function ensureCategory(name, type, householdId) {
    const { data } = await supabase
      .from('categories')
      .select('id')
      .eq('household_id', householdId)
      .eq('name', name)
      .single()
    if (!data) {
      await supabase.from('categories').insert({ name, type, household_id: householdId })
    }
  }

  async function saveTransaction(form) {
    setSaveError('')
    if (!form.category.trim()) { setSaveError('Please enter a category'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setSaveError('Please enter a valid amount'); return }

    await ensureCategory(form.category.trim(), form.type, profile.household_id)

    const payload = {
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category.trim(),
      type: form.type,
      date: form.date,
      household_id: profile.household_id,
      user_id: user.id
    }
    if (editing) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id)
      if (error) { setSaveError(error.message); return }
      setTransactions(prev => prev.map(t => t.id === editing.id ? { ...t, ...payload } : t))
    } else {
      const { data, error } = await supabase.from('transactions').insert(payload).select().single()
      if (error) { setSaveError(error.message); return }
      setTransactions(prev => [data, ...prev])
    }
    setShowForm(false)
    setEditing(null)
  }

  async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

  const filtered = transactions.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !t.category.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Transactions</h2>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center"
        >
          <Plus size={18} />
        </button>
      </div>

      <input
        type="text"
        placeholder="Search…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex gap-2 mb-4">
        {['all', 'income', 'expense'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No transactions found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between border border-gray-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{t.description || t.category}</p>
                <p className="text-xs text-gray-400">{t.category} · {new Date(t.date).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </span>
                {t.user_id === user.id ? (
                  <>
                    <button onClick={() => { setEditing(t); setShowForm(true) }} className="text-gray-400 hover:text-blue-500">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteTransaction(t.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-gray-300 italic">read only</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TransactionForm
          initial={editing ? { ...editing, date: editing.date?.slice(0, 10) } : null}
          onSave={saveTransaction}
          onCancel={() => { setShowForm(false); setEditing(null); setSaveError('') }}
          error={saveError}
          householdId={profile.household_id}
        />
      )}
    </div>
  )
}
