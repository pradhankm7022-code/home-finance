import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function SetupHousehold() {
  const { user, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('create')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function createHousehold(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: household, error: hErr } = await supabase
        .from('households')
        .insert({ name: householdName, invite_code: code, created_by: user.id })
        .select()
        .single()
      if (hErr) throw hErr

      const { data: updateData, error: pErr } = await supabase
        .from('profiles')
        .update({ household_id: household.id })
        .eq('id', user.id)
        .select()
      if (pErr) throw new Error(`Profile update failed: ${pErr.message}`)
      if (!updateData || updateData.length === 0) throw new Error('Profile update returned no rows — profile may not exist for this user')

      await fetchProfile(user.id)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function joinHousehold(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: household, error: hErr } = await supabase
        .from('households')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()
      if (hErr || !household) throw new Error('Invalid invite code')

      const { error: pErr } = await supabase
        .from('profiles')
        .update({ household_id: household.id })
        .eq('id', user.id)
      if (pErr) throw pErr

      await fetchProfile(user.id)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Set up your household</h2>
        <p className="text-gray-500 text-sm mb-5">Create a new household or join an existing one</p>

        <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
          {['create', 'join'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === t ? 'bg-white shadow text-blue-600' : 'text-gray-500'
              }`}
            >
              {t === 'create' ? 'Create New' : 'Join Existing'}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>
        )}

        {tab === 'create' ? (
          <form onSubmit={createHousehold} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Household Name</label>
              <input
                type="text"
                value={householdName}
                onChange={e => setHouseholdName(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. The Smith Family"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create Household'}
            </button>
          </form>
        ) : (
          <form onSubmit={joinHousehold} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. AB12CD"
                maxLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Joining…' : 'Join Household'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
