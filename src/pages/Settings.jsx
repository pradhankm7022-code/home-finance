import { useAuth } from '../context/AuthContext'
import { Copy, Check, LogOut as LeaveIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { profile, signOut, fetchProfile, user } = useAuth()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(profile?.households?.invite_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function leaveHousehold() {
    setLeaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ household_id: null })
      .eq('id', user.id)
    if (!error) {
      await fetchProfile(user.id)
      navigate('/setup-household', { replace: true })
    }
    setLeaving(false)
    setConfirmLeave(false)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Settings</h2>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Profile</h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            {profile?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-800">{profile?.name}</p>
            <p className="text-xs text-gray-400">{profile?.households?.name}</p>
          </div>
        </div>
      </div>

      {/* Household */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Household</h3>
        <p className="text-sm text-gray-700 mb-1">{profile?.households?.name}</p>
        <p className="text-xs text-gray-500 mb-3">Share this invite code with family members so they can join</p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 mb-4">
          <span className="flex-1 font-mono font-bold tracking-widest text-blue-600 text-lg">
            {profile?.households?.invite_code || '------'}
          </span>
          <button onClick={copyCode} className="text-gray-400 hover:text-blue-600 transition-colors">
            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>

        {/* Leave household */}
        {!confirmLeave ? (
          <button
            onClick={() => setConfirmLeave(true)}
            className="w-full flex items-center justify-center gap-2 text-orange-500 bg-orange-50 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors"
          >
            <LeaveIcon size={16} />
            Leave Household
          </button>
        ) : (
          <div className="bg-orange-50 rounded-xl p-4 space-y-3">
            <p className="text-sm text-orange-700 font-medium">Are you sure you want to leave <strong>{profile?.households?.name}</strong>?</p>
            <p className="text-xs text-orange-500">You can join another household after leaving.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmLeave(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={leaveHousehold}
                disabled={leaving}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {leaving ? 'Leaving…' : 'Yes, Leave'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={signOut}
        className="w-full bg-red-50 text-red-500 py-3 rounded-2xl font-medium text-sm hover:bg-red-100 transition-colors"
      >
        Sign Out
      </button>
    </div>
  )
}
