import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Home, ArrowRight } from 'lucide-react'
import TourTooltip from '../components/TourTooltip'

const SETUP_STEPS = [
  { target: 'setup-tabs',   title: 'Create or Join',      text: 'Create a new household for your family, or join one with an invite code.' },
  { target: 'setup-name',   title: 'Name your household', text: 'Give your household a memorable name, like "The Smith Family".' },
  { target: 'setup-invite', title: 'Have a code?',        text: 'Got an invite code from a family member? Switch to Join and enter it here.' },
]

export default function SetupHousehold() {
  const { user, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('create')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [myHouseholds, setMyHouseholds] = useState([])
  const [loadingHouseholds, setLoadingHouseholds] = useState(true)

  // Push a fake entry so back press is interceptable
  useEffect(() => {
    window.history.pushState({ setupHousehold: true }, '')
    function handlePopState() {
      navigate('/', { replace: true })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    fetchMyHouseholds()
  }, [user?.id])

  async function fetchMyHouseholds() {
    if (!user?.id) return
    const { data } = await supabase
      .from('households')
      .select('id, name, invite_code, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
    setMyHouseholds(data || [])
    setLoadingHouseholds(false)
  }

  async function rejoinHousehold(householdId) {
    setError('')
    setLoading(true)
    try {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ household_id: householdId })
        .eq('id', user.id)
      if (pErr) throw pErr
      await fetchProfile(user.id)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
      navigate('/', { replace: true })
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
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="w-full max-w-sm mx-auto space-y-4">

        {/* My households — rejoin */}
        {!loadingHouseholds && myHouseholds.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Your Households</h3>
            <p className="text-xs text-gray-400 mb-3">Households you created — tap to rejoin</p>
            <div className="space-y-2">
              {myHouseholds.map(h => (
                <button
                  key={h.id}
                  onClick={() => rejoinHousehold(h.id)}
                  disabled={loading}
                  className="w-full flex items-center justify-between bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl px-4 py-3 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Home size={14} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-800">{h.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{h.invite_code}</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create or join */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-1">
            {myHouseholds.length > 0 ? 'Or set up another' : 'Set up your household'}
          </h2>
          <p className="text-gray-500 text-sm mb-5">Create a new household or join one with an invite code</p>

          <div data-tour="setup-tabs" className="flex rounded-xl bg-gray-100 p-1 mb-5">
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
                  data-tour="setup-name"
                  type="text"
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
                  data-tour="setup-invite"
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
      <TourTooltip
        steps={SETUP_STEPS}
        storageKey="tour_setup_done"
        onStep={(i, step) => { if (step.target === 'setup-invite') setTab('join') }}
      />
    </div>
  )
}
