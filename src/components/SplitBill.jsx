import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TABS = ['Equal', 'By Share', 'By Amount', 'By %']

export default function SplitBill({ amount, householdId, currentUser, onConfirm, onCancel, initial }) {
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState([])
  const [tab, setTab] = useState(0)
  const [shares, setShares] = useState({})
  const [amounts, setAmounts] = useState({})
  const [percents, setPercents] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMembers()
  }, [householdId])

  async function fetchMembers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('household_id', householdId)
    const list = data || []
    setMembers(list)

    if (initial?.splits) {
      setSelected(initial.splits.map(s => s.user_id))
      if (initial.tab !== undefined) setTab(initial.tab)
      if (initial.shares) setShares(initial.shares)
      if (initial.amounts) setAmounts(initial.amounts)
      if (initial.percents) setPercents(initial.percents)
    } else {
      setSelected(list.map(m => m.id))
      const eq = {}
      list.forEach(m => { eq[m.id] = '1' })
      setShares(eq)
    }
  }

  function toggleMember(id) {
    setSelected(s => {
      const next = s.includes(id) ? s.filter(x => x !== id) : [...s, id]
      fillDefaults(tab, next)
      return next
    })
  }

  const selectedMembers = members.filter(m => selected.includes(m.id))
  const count = selectedMembers.length

  function fillDefaults(newTab, newSelected) {
    const sel = newSelected ?? selected
    const n = sel.length
    if (n === 0) return
    if (newTab === 2) {
      const each = Math.round((amount / n) * 100) / 100
      const filled = {}
      sel.forEach(id => { filled[id] = String(each) })
      setAmounts(filled)
    }
    if (newTab === 3) {
      const each = Math.round((100 / n) * 100) / 100
      const filled = {}
      sel.forEach(id => { filled[id] = String(each) })
      setPercents(filled)
    }
  }

  function switchTab(i) {
    setTab(i)
    setError('')
    fillDefaults(i)
  }

  function calcAmounts() {
    if (count === 0) return {}
    if (tab === 0) {
      const each = amount / count
      const result = {}
      selectedMembers.forEach(m => { result[m.id] = each })
      return result
    }
    if (tab === 1) {
      const vals = selectedMembers.map(m => parseFloat(shares[m.id] || 1) || 1)
      const total = vals.reduce((a, b) => a + b, 0)
      const result = {}
      selectedMembers.forEach((m, i) => { result[m.id] = (vals[i] / total) * amount })
      return result
    }
    if (tab === 2) {
      const result = {}
      selectedMembers.forEach(m => { result[m.id] = parseFloat(amounts[m.id] || 0) })
      return result
    }
    if (tab === 3) {
      const result = {}
      selectedMembers.forEach(m => { result[m.id] = (parseFloat(percents[m.id] || 0) / 100) * amount })
      return result
    }
    return {}
  }

  function validate() {
    if (count === 0) { setError('Select at least one member.'); return false }
    if (tab === 2) {
      const total = selectedMembers.reduce((s, m) => s + parseFloat(amounts[m.id] || 0), 0)
      if (Math.abs(total - amount) > 0.01) { setError(`Amounts must add up to ${amount}. Currently ${total.toFixed(2)}.`); return false }
    }
    if (tab === 3) {
      const total = selectedMembers.reduce((s, m) => s + parseFloat(percents[m.id] || 0), 0)
      if (Math.abs(total - 100) > 0.01) { setError(`Percentages must add up to 100%. Currently ${total.toFixed(1)}%.`); return false }
    }
    setError('')
    return true
  }

  function handleConfirm() {
    if (!validate()) return
    const calc = calcAmounts()
    const splits = selectedMembers.map(m => ({
      user_id: m.id,
      name: m.name,
      amount: Math.round(calc[m.id] * 100) / 100,
    }))
    onConfirm({ splits, tab, shares, amounts, percents })
  }

  function handleAmountChange(id, val) {
    const entered = Math.min(parseFloat(val) || 0, amount)
    const others = selectedMembers.filter(m => m.id !== id)
    const remaining = Math.max(0, amount - entered)
    const each = others.length > 0 ? Math.round((remaining / others.length) * 100) / 100 : 0
    const next = { ...amounts, [id]: String(entered) }
    others.forEach(m => { next[m.id] = String(each) })
    setAmounts(next)
  }

  function handlePercentChange(id, val) {
    const entered = Math.min(parseFloat(val) || 0, 100)
    const others = selectedMembers.filter(m => m.id !== id)
    const remaining = Math.max(0, 100 - entered)
    const each = others.length > 0 ? Math.round((remaining / others.length) * 100) / 100 : 0
    const next = { ...percents, [id]: String(entered) }
    others.forEach(m => { next[m.id] = String(each) })
    setPercents(next)
  }

  const calc = calcAmounts()
  const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-semibold text-gray-800">Split {fmt(amount)}</h3>
          <button onClick={onCancel}><X size={18} className="text-gray-400" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => switchTab(i)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === i ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Members with checkbox inline per tab */}
        <div className="px-5 py-3 max-h-64 overflow-y-auto">
          <div className="space-y-3">
            {members.map(m => {
              const isSelected = selected.includes(m.id)
              return (
                <label key={m.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMember(m.id)}
                    className="w-4 h-4 accent-blue-600 flex-shrink-0"
                  />
                  <span className={`flex-1 text-sm ${isSelected ? 'text-gray-800' : 'text-gray-400'}`}>
                    {m.name}{m.id === currentUser.id ? ' (you)' : ''}
                  </span>

                  {isSelected && (
                    <>
                      {tab === 0 && (
                        <span className="text-sm font-medium text-gray-800">{fmt(calc[m.id] || 0)}</span>
                      )}
                      {tab === 1 && (
                        <>
                          <input
                            type="number"
                            value={shares[m.id] || ''}
                            onChange={e => setShares(s => ({ ...s, [m.id]: e.target.value }))}
                            onClick={e => e.preventDefault()}
                            className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="1"
                            min="0"
                          />
                          <span className="text-sm font-medium text-gray-800 w-20 text-right">{fmt(calc[m.id] || 0)}</span>
                        </>
                      )}
                      {tab === 2 && (
                        <input
                          type="number"
                          value={amounts[m.id] || ''}
                          onChange={e => handleAmountChange(m.id, e.target.value)}
                          onClick={e => e.preventDefault()}
                          className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                          min="0"
                        />
                      )}
                      {tab === 3 && (
                        <>
                          <input
                            type="number"
                            value={percents[m.id] || ''}
                            onChange={e => handlePercentChange(m.id, e.target.value)}
                            onClick={e => e.preventDefault()}
                            className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                            min="0"
                            max="100"
                          />
                          <span className="text-xs text-gray-400">%</span>
                          <span className="text-sm font-medium text-gray-800 w-16 text-right">{fmt(calc[m.id] || 0)}</span>
                        </>
                      )}
                    </>
                  )}
                </label>
              )
            })}
          </div>
        </div>

        {/* Error + Confirm */}
        <div className="px-5 pb-5 pt-2">
          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
          <button
            onClick={handleConfirm}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Confirm Split
          </button>
        </div>
      </div>
    </div>
  )
}
