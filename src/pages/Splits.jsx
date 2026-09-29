import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import TransactionForm from '../components/TransactionForm'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Splits() {
  const { profile, user } = useAuth()
  const [splits, setSplits] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [editing, setEditing] = useState(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!profile?.household_id) return
    fetchSplits()
  }, [profile?.household_id])

  async function fetchSplits() {
    const { data: splitRows } = await supabase
      .from('splits')
      .select('*, categories(id, name)')
      .eq('household_id', profile.household_id)
      .order('date', { ascending: false })

    if (!splitRows) { setLoading(false); return }

    const splitIds = splitRows.map(s => s.id)
    const { data: txRows } = await supabase
      .from('transactions')
      .select('id, user_id, amount, split_id')
      .in('split_id', splitIds)

    const userIds = [...new Set((txRows || []).map(t => t.user_id).filter(Boolean))]
    let nameMap = {}
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)
      profiles?.forEach(p => { nameMap[p.id] = p.name })
    }

    const txBySplit = {}
    ;(txRows || []).forEach(tx => {
      if (!txBySplit[tx.split_id]) txBySplit[tx.split_id] = []
      txBySplit[tx.split_id].push({ ...tx, name: nameMap[tx.user_id] || 'Unknown' })
    })

    setSplits(splitRows.map(s => ({ ...s, members: txBySplit[s.id] || [] })))
    setLoading(false)
  }

  async function ensureCategory(name, type) {
    const { data } = await supabase
      .from('categories')
      .select('id')
      .eq('household_id', profile.household_id)
      .eq('name', name)
      .single()
    if (data) return data.id
    const { data: inserted } = await supabase
      .from('categories')
      .insert({ name, type, household_id: profile.household_id })
      .select('id')
      .single()
    return inserted.id
  }

  async function handleSave(form, splitData) {
    setSaveError('')
    if (!form.category_name?.trim()) { setSaveError('Please enter a category'); return }
    if (!form.amount || isNaN(parseFloat(form.amount))) { setSaveError('Please enter a valid amount'); return }
    if (!splitData) { setSaveError('Please configure the split members'); return }

    const categoryId = form.category_id || await ensureCategory(form.category_name.trim(), form.type)
    const totalAmount = parseFloat(form.amount)

    await supabase.from('splits').update({
      amount: totalAmount,
      description: form.description,
      date: form.date,
      type: form.type,
      category_id: categoryId,
    }).eq('id', editing.id)

    const { data: existing } = await supabase
      .from('transactions')
      .select('id, user_id')
      .eq('split_id', editing.id)

    const existingMap = {}
    existing?.forEach(e => { existingMap[e.user_id] = e.id })

    const newMemberIds = splitData.splits.map(m => m.user_id)
    const toDelete = Object.keys(existingMap).filter(id => !newMemberIds.includes(id))
    if (toDelete.length > 0) {
      await supabase.from('transactions').delete().in('id', toDelete.map(id => existingMap[id]))
    }

    for (const m of splitData.splits) {
      const payload = {
        description: form.description,
        amount: m.amount,
        category_id: categoryId,
        type: form.type,
        date: form.date,
        household_id: profile.household_id,
        user_id: m.user_id,
        created_by: user.id,
        split_id: editing.id,
      }
      if (existingMap[m.user_id]) {
        await supabase.from('transactions').update(payload).eq('id', existingMap[m.user_id])
      } else {
        await supabase.from('transactions').insert(payload)
      }
    }

    setEditing(null)
    setSaveError('')
    fetchSplits()
  }

  async function doDeleteSplit(splitId) {
    await supabase.from('transactions').delete().eq('split_id', splitId)
    await supabase.from('splits').delete().eq('id', splitId)
    setSplits(prev => prev.filter(s => s.id !== splitId))
    setConfirmDelete(null)
  }

  function toggleExpand(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  const fmt = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Splits</h2>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
      ) : splits.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No splits yet. Use the Split button when adding a transaction.</div>
      ) : (
        <div className="space-y-3">
          {splits.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.description || s.categories?.name}</p>
                  <p className="text-xs text-gray-400">{s.categories?.name} · {new Date(s.date).toLocaleDateString('en-GB')} · {s.members.length} members</p>
                </div>
                <span className={`font-semibold text-sm ${s.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {s.type === 'income' ? '+' : '-'}{fmt(s.amount)}
                </span>
                {s.created_by === user.id && (
                  <>
                    <button onClick={() => setEditing(s)} className="text-gray-400 hover:text-blue-500">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setConfirmDelete(s.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button onClick={() => toggleExpand(s.id)} className="text-gray-400">
                  {expanded[s.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {expanded[s.id] && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                  {s.members.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{m.name}{m.user_id === user.id ? ' (you)' : ''}</span>
                      <span className="font-medium text-gray-800">{fmt(m.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TransactionForm
          initial={{
            description: editing.description || '',
            amount: String(editing.amount),
            category_id: editing.category_id,
            category_name: editing.categories?.name || '',
            type: editing.type,
            date: editing.date?.slice(0, 10),
            splitData: {
              splits: editing.members.map(m => ({ user_id: m.user_id, amount: m.amount, name: m.name })),
              tab: 0, shares: {}, amounts: {}, percents: {}
            }
          }}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setSaveError('') }}
          error={saveError}
          householdId={profile.household_id}
          user={user}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message="Delete this split and all its transactions?"
          onConfirm={() => doDeleteSplit(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
