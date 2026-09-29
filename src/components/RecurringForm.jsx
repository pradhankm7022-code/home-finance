import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X } from 'lucide-react'

function CategoryInput({ value, onChange, type, householdId }) {
  const [input, setInput] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const ref = useRef(null)

  useEffect(() => { loadCategories() }, [type, householdId])
  useEffect(() => { setInput(value || '') }, [value])

  async function loadCategories() {
    const { data } = await supabase
      .from('categories')
      .select('id, name')
      .eq('household_id', householdId)
      .or(`type.eq.${type},type.eq.both`)
      .order('name')
    setAllCategories(data || [])
  }

  function handleInput(val) {
    setInput(val)
    onChange({ id: null, name: val })
    setSuggestions(val.trim() ? allCategories.filter(c => c.name.toLowerCase().includes(val.toLowerCase())) : allCategories)
    setShowSuggestions(true)
  }

  function handleFocus() {
    setSuggestions(input.trim() ? allCategories.filter(c => c.name.toLowerCase().includes(input.toLowerCase())) : allCategories)
    setShowSuggestions(true)
  }

  function selectSuggestion(cat) {
    setInput(cat.name)
    onChange(cat)
    setShowSuggestions(false)
  }

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const showCreate = input.trim() && !allCategories.some(c => c.name.toLowerCase() === input.trim().toLowerCase())

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        placeholder={type === 'income' ? 'Category (e.g. Salary)' : 'Category (e.g. Rent)'}
        value={input}
        onChange={e => handleInput(e.target.value)}
        onFocus={handleFocus}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {showSuggestions && (suggestions.length > 0 || showCreate) && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map(cat => (
            <button key={cat.id} type="button" onMouseDown={() => selectSuggestion(cat)}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 first:rounded-t-xl">
              {cat.name}
            </button>
          ))}
          {showCreate && (
            <button type="button" onMouseDown={() => selectSuggestion({ id: null, name: input.trim() })}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-blue-50 border-t border-gray-100 last:rounded-b-xl flex items-center gap-2">
              <Plus size={14} />
              Create "{input.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const FREQ = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Every N days' },
]

export default function RecurringForm({ initial, onSave, onCancel, error, householdId }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState(initial || {
    type: 'expense',
    category_id: '',
    category_name: '',
    amount: '',
    description: '',
    frequency: 'monthly',
    interval_days: '30',
    start_date: today,
    end_date: '9999-01-01',
  })
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{initial ? 'Edit' : 'Add'} Recurring</h3>
          <button onClick={onCancel}><X size={18} className="text-gray-400" /></button>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

        {/* Type toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1">
          {['expense', 'income'].map(t => (
            <button key={t} type="button"
              onClick={() => { set('type', t); set('category_id', ''); set('category_name', '') }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${
                form.type === t
                  ? t === 'expense' ? 'bg-white shadow text-red-500' : 'bg-white shadow text-green-600'
                  : 'text-gray-500'
              }`}>
              {t}
            </button>
          ))}
        </div>

        <CategoryInput
          value={form.category_name}
          onChange={cat => { set('category_id', cat.id); set('category_name', cat.name) }}
          type={form.type}
          householdId={householdId}
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

        <input type="text" placeholder="Description (e.g. House Rent)"
          value={form.description} onChange={e => set('description', e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

        {/* Frequency */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Repeats</p>
          <div className="flex gap-2">
            {FREQ.map(f => (
              <button key={f.value} type="button" onClick={() => set('frequency', f.value)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                  form.frequency === f.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          {form.frequency === 'custom' && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-500">Every</span>
              <input type="number" min="1" value={form.interval_days}
                onChange={e => set('interval_days', e.target.value)}
                className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-sm text-gray-500">days</span>
            </div>
          )}
        </div>

        {/* Start & End date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-2">Start date</p>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">End date</p>
            <input type="date" value={form.end_date === '9999-01-01' ? '' : form.end_date}
              onChange={e => set('end_date', e.target.value || '9999-01-01')}
              placeholder="No end"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <button type="button" onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-60">
          {saving ? 'Saving…' : initial ? 'Update' : 'Add Recurring'}
        </button>
      </div>
    </div>
  )
}
