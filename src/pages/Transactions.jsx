import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import TransactionForm from '../components/TransactionForm'
import RecurringForm from '../components/RecurringForm'
import ConfirmDialog from '../components/ConfirmDialog'
import { processDueRecurring } from '../lib/processRecurring'

export default function Transactions() {
  const { profile, user } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [saveError, setSaveError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  // splits map: split_id -> total amount
  const [splitTotals, setSplitTotals] = useState({})

  // Splits view state (for expanded/edit/delete when filter === 'splits')
  const [splits, setSplits] = useState([])
  const [expanded, setExpanded] = useState({})
  const [editingSplit, setEditingSplit] = useState(null)
  const [splitSaveError, setSplitSaveError] = useState('')
  const [confirmDeleteSplit, setConfirmDeleteSplit] = useState(null)

  // Recurring state
  const [recurring, setRecurring] = useState([])
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState(null)
  const [recurringError, setRecurringError] = useState('')
  const [confirmDeleteRecurring, setConfirmDeleteRecurring] = useState(null)

  useEffect(() => {
    if (location.state?.openForm) setShowForm(true)
    if (location.state?.filter) setFilter(location.state.filter)
  }, [location.state])

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      const type = searchParams.get('type')
      setEditing(type ? { type } : null)
      setShowForm(true)
    }
  }, [])

  useEffect(() => {
    if (showForm) window.history.pushState({ modal: true }, '')
  }, [showForm])

  useEffect(() => {
    function handlePopState() {
      if (showForm) { setShowForm(false); setEditing(null); setSaveError('') }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [showForm])

  useEffect(() => {
    if (!profile?.household_id) return
    processDueRecurring(supabase, profile.household_id).then(() => fetchTransactions())
    fetchTransactions()
    fetchSplits()
    fetchRecurring()

    const channel = supabase
      .channel('transactions-list')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'transactions',
        filter: `household_id=eq.${profile.household_id}`
      }, () => { fetchTransactions(); fetchSplits() })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.household_id])

  async function fetchTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(id, name)')
      .eq('household_id', profile.household_id)
      .order('date', { ascending: false })
    if (error) { setLoading(false); return }

    const userIds = [...new Set((data || []).map(t => t.user_id).filter(Boolean))]
    let nameMap = {}
    if (userIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('id, name').in('id', userIds)
      profileData?.forEach(p => { nameMap[p.id] = p.name })
    }

    setTransactions((data || []).map(t => ({ ...t, profiles: { name: nameMap[t.user_id] || '' } })))
    setLoading(false)
  }

  async function fetchSplits() {
    const { data: splitRows } = await supabase
      .from('splits')
      .select('*, categories(id, name)')
      .eq('household_id', profile.household_id)
      .order('date', { ascending: false })
    if (!splitRows) return

    // build totals map
    const totals = {}
    splitRows.forEach(s => { totals[s.id] = s.amount })
    setSplitTotals(totals)

    const splitIds = splitRows.map(s => s.id)
    const { data: txRows } = await supabase
      .from('transactions')
      .select('id, user_id, amount, split_id')
      .in('split_id', splitIds)

    const memberUserIds = [...new Set((txRows || []).map(t => t.user_id).filter(Boolean))]
    const creatorIds = [...new Set(splitRows.map(s => s.created_by).filter(Boolean))]
    const allIds = [...new Set([...memberUserIds, ...creatorIds])]
    let nameMap = {}
    if (allIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', allIds)
      profiles?.forEach(p => { nameMap[p.id] = p.name })
    }
    const txBySplit = {}
    ;(txRows || []).forEach(tx => {
      if (!txBySplit[tx.split_id]) txBySplit[tx.split_id] = []
      txBySplit[tx.split_id].push({ ...tx, name: nameMap[tx.user_id] || 'Unknown' })
    })
    setSplits(splitRows.map(s => ({ ...s, members: txBySplit[s.id] || [], creatorName: nameMap[s.created_by] || 'Unknown' })))
  }

  async function ensureCategory(name, type, householdId) {
    const { data } = await supabase.from('categories').select('id').eq('household_id', householdId).eq('name', name).single()
    if (data) return data.id
    const { data: inserted } = await supabase.from('categories').insert({ name, type, household_id: householdId }).select('id').single()
    return inserted.id
  }

  async function saveTransaction(form, splitData) {
    setSaveError('')
    if (!form.category_name?.trim()) { setSaveError('Please enter a category'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setSaveError('Please enter a valid amount'); return }

    const categoryId = form.category_id || await ensureCategory(form.category_name.trim(), form.type, profile.household_id)
    const totalAmount = parseFloat(form.amount)

    if (splitData) {
      if (editing?.split_id) {
        const { error: splitErr } = await supabase.from('splits').update({
          category_id: categoryId, amount: totalAmount, description: form.description, date: form.date, type: form.type,
        }).eq('id', editing.split_id)
        if (splitErr) { setSaveError(splitErr.message); return }

        const { data: existing } = await supabase.from('transactions').select('id, user_id').eq('split_id', editing.split_id)
        const existingMap = {}
        existing?.forEach(e => { existingMap[e.user_id] = e.id })
        const newMemberIds = splitData.splits.map(s => s.user_id)
        const toDelete = Object.keys(existingMap).filter(id => !newMemberIds.includes(id))
        if (toDelete.length > 0) await supabase.from('transactions').delete().in('id', toDelete.map(id => existingMap[id]))
        for (const s of splitData.splits) {
          const payload = { description: form.description, amount: s.amount, category_id: categoryId, type: form.type, date: form.date, household_id: profile.household_id, user_id: s.user_id, created_by: user.id, split_id: editing.split_id }
          if (existingMap[s.user_id]) await supabase.from('transactions').update(payload).eq('id', existingMap[s.user_id])
          else await supabase.from('transactions').insert(payload)
        }
      } else {
        const { data: split, error: splitErr } = await supabase.from('splits').insert({
          household_id: profile.household_id, created_by: user.id, category_id: categoryId,
          amount: totalAmount, description: form.description, date: form.date, type: form.type,
        }).select('id').single()
        if (splitErr) { setSaveError(splitErr.message); return }
        const rows = splitData.splits.map(s => ({
          description: form.description, amount: s.amount, category_id: categoryId, type: form.type,
          date: form.date, household_id: profile.household_id, user_id: s.user_id, created_by: user.id, split_id: split.id,
        }))
        const { error: txErr } = await supabase.from('transactions').insert(rows)
        if (txErr) { setSaveError(txErr.message); return }
      }
    } else {
      const payload = { description: form.description, amount: totalAmount, category_id: categoryId, type: form.type, date: form.date, household_id: profile.household_id, user_id: user.id, created_by: user.id }
      if (editing) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id)
        if (error) { setSaveError(error.message); return }
      } else {
        const { error } = await supabase.from('transactions').insert(payload)
        if (error) { setSaveError(error.message); return }
      }
    }
    await fetchTransactions()
    await fetchSplits()
    setShowForm(false)
    setEditing(null)
  }

  async function startEdit(t) {
    if (t.split_id) {
      const { data: split } = await supabase.from('splits').select('amount').eq('id', t.split_id).single()
      setEditing({ ...t, amount: split?.amount ?? t.amount })
    } else {
      setEditing(t)
    }
    setShowForm(true)
  }

  async function doDelete(t) {
    if (t.split_id) {
      const { error } = await supabase.from('transactions').delete().eq('split_id', t.split_id)
      if (!error) { await supabase.from('splits').delete().eq('id', t.split_id); setTransactions(prev => prev.filter(tx => tx.split_id !== t.split_id)) }
    } else {
      const { error } = await supabase.from('transactions').delete().eq('id', t.id)
      if (!error) setTransactions(prev => prev.filter(tx => tx.id !== t.id))
    }
    setConfirmDelete(null)
  }

  async function handleSplitSave(form, splitData) {
    setSplitSaveError('')
    if (!form.category_name?.trim()) { setSplitSaveError('Please enter a category'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setSplitSaveError('Please enter a valid amount'); return }
    if (!splitData) { setSplitSaveError('Please configure the split members'); return }

    const categoryId = form.category_id || await ensureCategory(form.category_name.trim(), form.type, profile.household_id)
    const totalAmount = parseFloat(form.amount)

    await supabase.from('splits').update({ amount: totalAmount, description: form.description, date: form.date, type: form.type, category_id: categoryId }).eq('id', editingSplit.id)

    const { data: existing } = await supabase.from('transactions').select('id, user_id').eq('split_id', editingSplit.id)
    const existingMap = {}
    existing?.forEach(e => { existingMap[e.user_id] = e.id })
    const newMemberIds = splitData.splits.map(m => m.user_id)
    const toDelete = Object.keys(existingMap).filter(id => !newMemberIds.includes(id))
    if (toDelete.length > 0) await supabase.from('transactions').delete().in('id', toDelete.map(id => existingMap[id]))
    for (const m of splitData.splits) {
      const payload = { description: form.description, amount: m.amount, category_id: categoryId, type: form.type, date: form.date, household_id: profile.household_id, user_id: m.user_id, created_by: user.id, split_id: editingSplit.id }
      if (existingMap[m.user_id]) await supabase.from('transactions').update(payload).eq('id', existingMap[m.user_id])
      else await supabase.from('transactions').insert(payload)
    }
    setEditingSplit(null)
    setSplitSaveError('')
    fetchSplits()
    fetchTransactions()
  }

  async function doDeleteSplit(splitId) {
    await supabase.from('transactions').delete().eq('split_id', splitId)
    await supabase.from('splits').delete().eq('id', splitId)
    setSplits(prev => prev.filter(s => s.id !== splitId))
    setTransactions(prev => prev.filter(t => t.split_id !== splitId))
    setSplitTotals(prev => { const n = { ...prev }; delete n[splitId]; return n })
    setConfirmDeleteSplit(null)
  }

  function toggleExpand(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  async function fetchRecurring() {
    const { data } = await supabase
      .from('recurring_transactions')
      .select('*, categories(id, name)')
      .eq('household_id', profile.household_id)
      .order('next_date', { ascending: true })
    setRecurring(data || [])
  }

  async function saveRecurring(form) {
    setRecurringError('')
    if (!form.category_name?.trim()) { setRecurringError('Please enter a category'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setRecurringError('Please enter a valid amount'); return }
    if (form.frequency === 'custom' && (!form.interval_days || parseInt(form.interval_days) < 1)) {
      setRecurringError('Please enter a valid interval'); return
    }

    const categoryId = form.category_id || await ensureCategory(form.category_name.trim(), form.type, profile.household_id)
    const payload = {
      household_id: profile.household_id,
      created_by: user.id,
      description: form.description,
      amount: parseFloat(form.amount),
      category_id: categoryId,
      type: form.type,
      frequency: form.frequency,
      interval_days: form.frequency === 'custom' ? parseInt(form.interval_days) : null,
      start_date: form.start_date,
      next_date: form.start_date,
      end_date: form.end_date || '9999-01-01',
      active: true,
    }

    if (editingRecurring) {
      const { error } = await supabase.from('recurring_transactions').update(payload).eq('id', editingRecurring.id)
      if (error) { setRecurringError(error.message); return }
    } else {
      const { error } = await supabase.from('recurring_transactions').insert(payload)
      if (error) { setRecurringError(error.message); return }
    }
    setShowRecurringForm(false)
    setEditingRecurring(null)
    setRecurringError('')
    fetchRecurring()
  }

  async function doDeleteRecurring(id) {
    await supabase.from('recurring_transactions').delete().eq('id', id)
    setRecurring(prev => prev.filter(r => r.id !== id))
    setConfirmDeleteRecurring(null)
  }

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

  // For non-splits filters: deduplicate split transactions (show only one row per split_id)
  const seenSplits = new Set()
  const filtered = transactions.filter(t => {
    if (filter === 'splits') {
      if (!t.split_id) return false
      if (seenSplits.has(t.split_id)) return false
      seenSplits.add(t.split_id)
    } else {
      if (filter === 'mine' && t.user_id !== user.id) return false
      if (filter === 'income' && t.type !== 'income') return false
      if (filter === 'expense' && t.type !== 'expense') return false
    }
    const catName = t.categories?.name || ''
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !catName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Transactions</h2>
        <button onClick={() => { setEditing(null); setShowForm(true) }} className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center">
          <Plus size={18} />
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {[['all', 'All'], ['mine', 'Mine'], ['income', 'Income'], ['expense', 'Expense'], ['splits', 'Splits'], ['recurring', 'Recurring']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              filter === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Search — hide on recurring view */}
      {filter !== 'recurring' && (
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No transactions found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const isSplitRow = filter === 'splits' && t.split_id
            const splitObj = isSplitRow ? splits.find(s => s.id === t.split_id) : null
            const displayAmount = isSplitRow && splitTotals[t.split_id] != null ? splitTotals[t.split_id] : t.amount
            const memberCount = splitObj?.members?.length ?? 0

            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center px-4 py-3 gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.description || t.categories?.name}</p>
                    <p className="text-xs text-gray-400">
                      {t.categories?.name} · {new Date(t.date).toLocaleDateString()}
                      {isSplitRow
                        ? ` · ${memberCount} members · by ${splitObj?.created_by === user.id ? 'you' : (splitObj?.creatorName || 'Unknown')}`
                        : ` · ${t.profiles?.name}`}
                    </p>
                  </div>
                  {t.split_id && !isSplitRow && (
                    <span className="text-xs text-blue-500 font-medium px-1.5 py-0.5 bg-blue-50 rounded-full">split</span>
                  )}
                  <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(displayAmount)}
                  </span>
                  {isSplitRow && t.created_by === user.id && (
                    <>
                      <button onClick={() => splitObj && setEditingSplit(splitObj)} className="text-gray-400 hover:text-blue-500"><Pencil size={14} /></button>
                      <button onClick={() => setConfirmDeleteSplit(t.split_id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </>
                  )}
                  {!isSplitRow && t.created_by === user.id && !t.split_id && (
                    <>
                      <button onClick={() => startEdit(t)} className="text-gray-400 hover:text-blue-500"><Pencil size={14} /></button>
                      <button onClick={() => setConfirmDelete(t)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </>
                  )}
                  {isSplitRow && (
                    <button onClick={() => toggleExpand(t.split_id)} className="text-gray-400">
                      {expanded[t.split_id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>
                {isSplitRow && expanded[t.split_id] && splitObj && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                    {splitObj.members.map(m => (
                      <div key={m.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{m.name}{m.user_id === user.id ? ' (you)' : ''}</span>
                        <span className="font-medium text-gray-800">{fmt(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Recurring view */}
      {filter === 'recurring' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">{recurring.length} recurring {recurring.length === 1 ? 'entry' : 'entries'}</p>
            <button onClick={() => { setEditingRecurring(null); setRecurringError(''); setShowRecurringForm(true) }}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
              <Plus size={12} /> Add Recurring
            </button>
          </div>
          {recurring.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No recurring transactions yet.</div>
          ) : (
            <div className="space-y-3">
              {recurring.map(r => {
                const freqLabel = r.frequency === 'weekly' ? 'Weekly' : r.frequency === 'monthly' ? 'Monthly' : `Every ${r.interval_days} days`
                const hasEnd = r.end_date && r.end_date !== '9999-01-01'
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center px-4 py-3 gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.description || r.categories?.name}</p>
                        <p className="text-xs text-gray-400">{r.categories?.name} · {freqLabel}</p>
                      </div>
                      <span className={`font-semibold text-sm ${r.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                        {r.type === 'income' ? '+' : '-'}{fmt(r.amount)}
                      </span>
                      {r.created_by === user.id && (
                        <>
                          <button onClick={() => { setEditingRecurring(r); setRecurringError(''); setShowRecurringForm(true) }} className="text-gray-400 hover:text-blue-500"><Pencil size={14} /></button>
                          <button onClick={() => setConfirmDeleteRecurring(r.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                    <div className="border-t border-gray-100 px-4 py-2.5 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-gray-400">Start</p>
                        <p className="text-xs font-medium text-gray-700">{new Date(r.start_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">End</p>
                        <p className="text-xs font-medium text-gray-700">{hasEnd ? new Date(r.end_date).toLocaleDateString() : 'No end'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Next due</p>
                        <p className="text-xs font-medium text-gray-700">{new Date(r.next_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Transaction form */}
      {showForm && (
        <TransactionForm
          initial={editing ? { ...editing, category_name: editing.categories?.name || '', date: editing.date?.slice(0, 10), splitData: editing.split_id ? { splits: [], tab: 0, shares: {}, amounts: {}, percents: {} } : null } : null}
          onSave={saveTransaction}
          onCancel={() => { setShowForm(false); setEditing(null); setSaveError('') }}
          error={saveError}
          householdId={profile.household_id}
          user={user}
        />
      )}

      {/* Split edit form */}
      {editingSplit && (
        <TransactionForm
          initial={{ description: editingSplit.description || '', amount: String(editingSplit.amount), category_id: editingSplit.category_id, category_name: editingSplit.categories?.name || '', type: editingSplit.type, date: editingSplit.date?.slice(0, 10), splitData: { splits: editingSplit.members.map(m => ({ user_id: m.user_id, amount: m.amount, name: m.name })), tab: 0, shares: {}, amounts: {}, percents: {} } }}
          onSave={handleSplitSave}
          onCancel={() => { setEditingSplit(null); setSplitSaveError('') }}
          error={splitSaveError}
          householdId={profile.household_id}
          user={user}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog message="Delete this transaction?" onConfirm={() => doDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}

      {confirmDeleteSplit && (
        <ConfirmDialog message="Delete this split and all its transactions?" onConfirm={() => doDeleteSplit(confirmDeleteSplit)} onCancel={() => setConfirmDeleteSplit(null)} />
      )}

      {showRecurringForm && (
        <RecurringForm
          initial={editingRecurring ? {
            ...editingRecurring,
            category_name: editingRecurring.categories?.name || '',
            interval_days: String(editingRecurring.interval_days || 30),
            end_date: editingRecurring.end_date || '9999-01-01',
          } : null}
          onSave={saveRecurring}
          onCancel={() => { setShowRecurringForm(false); setEditingRecurring(null); setRecurringError('') }}
          error={recurringError}
          householdId={profile.household_id}
        />
      )}

      {confirmDeleteRecurring && (
        <ConfirmDialog message="Delete this recurring transaction?" onConfirm={() => doDeleteRecurring(confirmDeleteRecurring)} onCancel={() => setConfirmDeleteRecurring(null)} />
      )}
    </div>
  )
}
