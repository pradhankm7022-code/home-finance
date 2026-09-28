import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import TransactionForm from '../components/TransactionForm'

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
    if (location.state?.filter) setFilter(location.state.filter)
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
      .select('*, categories(id, name)')
      .eq('household_id', profile.household_id)
      .order('date', { ascending: false })
    if (error) { setLoading(false); return }

    const userIds = [...new Set((data || []).map(t => t.user_id).filter(Boolean))]
    let nameMap = {}
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)
      profileData?.forEach(p => { nameMap[p.id] = p.name })
    }

    setTransactions((data || []).map(t => ({ ...t, profiles: { name: nameMap[t.user_id] || '' } })))
    setLoading(false)
  }

  async function ensureCategory(name, type, householdId) {
    const { data } = await supabase
      .from('categories')
      .select('id')
      .eq('household_id', householdId)
      .eq('name', name)
      .single()
    if (data) return data.id
    const { data: inserted } = await supabase
      .from('categories')
      .insert({ name, type, household_id: householdId })
      .select('id')
      .single()
    return inserted.id
  }

  async function saveTransaction(form, splitData) {
    setSaveError('')
    if (!form.category_name?.trim()) { setSaveError('Please enter a category'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setSaveError('Please enter a valid amount'); return }

    const categoryId = form.category_id || await ensureCategory(form.category_name.trim(), form.type, profile.household_id)
    const totalAmount = parseFloat(form.amount)

    if (splitData) {
      // --- Split flow ---
      if (editing?.split_id) {
        // Update existing split record
        const { error: splitErr } = await supabase
          .from('splits')
          .update({
            category_id: categoryId,
            amount: totalAmount,
            description: form.description,
            date: form.date,
            type: form.type,
          })
          .eq('id', editing.split_id)
        if (splitErr) { setSaveError(splitErr.message); return }

        // Get existing member transactions for this split
        const { data: existing } = await supabase
          .from('transactions')
          .select('id, user_id')
          .eq('split_id', editing.split_id)

        const existingMap = {}
        existing?.forEach(e => { existingMap[e.user_id] = e.id })

        const newMemberIds = splitData.splits.map(s => s.user_id)
        const existingMemberIds = Object.keys(existingMap)

        // Delete removed members
        const toDelete = existingMemberIds.filter(id => !newMemberIds.includes(id))
        if (toDelete.length > 0) {
          await supabase.from('transactions').delete().in('id', toDelete.map(id => existingMap[id]))
        }

        // Update existing or insert new
        for (const s of splitData.splits) {
          const txPayload = {
            description: form.description,
            amount: s.amount,
            category_id: categoryId,
            type: form.type,
            date: form.date,
            household_id: profile.household_id,
            user_id: s.user_id,
            created_by: user.id,
            split_id: editing.split_id,
          }
          if (existingMap[s.user_id]) {
            await supabase.from('transactions').update(txPayload).eq('id', existingMap[s.user_id])
          } else {
            await supabase.from('transactions').insert(txPayload)
          }
        }
      } else {
        // Create new split record
        const { data: split, error: splitErr } = await supabase
          .from('splits')
          .insert({
            household_id: profile.household_id,
            created_by: user.id,
            category_id: categoryId,
            amount: totalAmount,
            description: form.description,
            date: form.date,
            type: form.type,
          })
          .select('id')
          .single()
        if (splitErr) { setSaveError(splitErr.message); return }

        // Insert one transaction per member
        const rows = splitData.splits.map(s => ({
          description: form.description,
          amount: s.amount,
          category_id: categoryId,
          type: form.type,
          date: form.date,
          household_id: profile.household_id,
          user_id: s.user_id,
          created_by: user.id,
          split_id: split.id,
        }))
        const { error: txErr } = await supabase.from('transactions').insert(rows)
        if (txErr) { setSaveError(txErr.message); return }
      }
    } else {
      // --- Normal (non-split) flow ---
      const payload = {
        description: form.description,
        amount: totalAmount,
        category_id: categoryId,
        type: form.type,
        date: form.date,
        household_id: profile.household_id,
        user_id: user.id,
        created_by: user.id,
      }
      if (editing) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id)
        if (error) { setSaveError(error.message); return }
      } else {
        const { error } = await supabase.from('transactions').insert(payload)
        if (error) { setSaveError(error.message); return }
      }
    }

    await fetchTransactions()
    setShowForm(false)
    setEditing(null)
  }

  async function startEdit(t) {
    if (t.split_id) {
      const { data: split } = await supabase
        .from('splits')
        .select('amount')
        .eq('id', t.split_id)
        .single()
      setEditing({ ...t, amount: split?.amount ?? t.amount })
    } else {
      setEditing(t)
    }
    setShowForm(true)
  }

  async function deleteTransaction(t) {
    if (t.split_id) {
      if (!confirm('This is part of a split. Delete all split transactions?')) return
      const { error } = await supabase.from('transactions').delete().eq('split_id', t.split_id)
      if (!error) {
        await supabase.from('splits').delete().eq('id', t.split_id)
        setTransactions(prev => prev.filter(tx => tx.split_id !== t.split_id))
      }
    } else {
      if (!confirm('Delete this transaction?')) return
      const { error } = await supabase.from('transactions').delete().eq('id', t.id)
      if (!error) setTransactions(prev => prev.filter(tx => tx.id !== t.id))
    }
  }

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

  const filtered = transactions.filter(t => {
    if (filter !== 'all' && filter !== 'mine' && t.type !== filter) return false
    if (filter === 'mine' && t.user_id !== user.id) return false
    const catName = t.categories?.name || ''
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !catName.toLowerCase().includes(search.toLowerCase())) return false
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

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[['all', 'All'], ['mine', 'Mine'], ['income', 'Income'], ['expense', 'Expense']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              filter === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {label}
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
                <p className="text-sm font-medium text-gray-800 truncate">{t.description || t.categories?.name}</p>
                <p className="text-xs text-gray-400">{t.categories?.name} · {new Date(t.date).toLocaleDateString()} · {t.profiles?.name}</p>
              </div>
              {t.split_id && (
                <span className="text-xs text-blue-500 font-medium px-1.5 py-0.5 bg-blue-50 rounded-full">split</span>
              )}
              <div className="flex items-center gap-2 ml-2">
                <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </span>
                {t.created_by === user.id && !t.split_id && (
                  <>
                    <button onClick={() => startEdit(t)} className="text-gray-400 hover:text-blue-500">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteTransaction(t)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TransactionForm
          initial={editing ? {
            ...editing,
            category_name: editing.categories?.name || '',
            date: editing.date?.slice(0, 10),
            splitData: editing.split_id ? { splits: [], tab: 0, shares: {}, amounts: {}, percents: {} } : null
          } : null}
          onSave={saveTransaction}
          onCancel={() => { setShowForm(false); setEditing(null); setSaveError('') }}
          error={saveError}
          householdId={profile.household_id}
          user={user}
        />
      )}
    </div>
  )
}
