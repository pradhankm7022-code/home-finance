import { useAuth } from '../context/AuthContext'
import { Copy, Check, LogOut as LeaveIcon, Download, Share2, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { profile, signOut, fetchProfile, user } = useAuth()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  const isCreator = profile?.households?.created_by === user?.id

  useEffect(() => {
    function handleBeforeInstall(e) {
      e.preventDefault()
      setInstallPrompt(e)
    }
    function handleAppInstalled() {
      setIsInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setInstallPrompt(null)
  }

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

  async function deleteHousehold() {
    setDeleting(true)
    setDeleteError('')
    const householdId = profile?.household_id
    try {
      const { error: txErr } = await supabase
        .from('transactions')
        .delete()
        .eq('household_id', householdId)
      if (txErr) throw txErr

      const { error: membersErr } = await supabase
        .from('profiles')
        .update({ household_id: null })
        .eq('household_id', householdId)
      if (membersErr) throw membersErr

      const { error: hErr } = await supabase
        .from('households')
        .delete()
        .eq('id', householdId)
      if (hErr) throw hErr

      await fetchProfile(user.id)
      navigate('/setup-household', { replace: true })
    } catch (err) {
      setDeleteError(err.message)
      setDeleting(false)
    }
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
        <div data-tour="invite-code" className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 mb-4">
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

        {/* Delete household — creator only */}
        {isCreator && (
          <div className="mt-3">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 text-red-500 bg-red-50 py-2.5 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
              >
                <Trash2 size={16} />
                Delete Household
              </button>
            ) : (
              <div className="bg-red-50 rounded-xl p-4 space-y-3">
                <p className="text-sm text-red-700 font-medium">Delete <strong>{profile?.households?.name}</strong>?</p>
                <p className="text-xs text-red-500">This will permanently delete all transactions and remove all members. This cannot be undone.</p>
                {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setConfirmDelete(false); setDeleteError('') }}
                    className="flex-1 py-2 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deleteHousehold}
                    disabled={deleting}
                    className="flex-1 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    {deleting ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Install app */}
      {!isInstalled && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">App</h3>
          {installPrompt ? (
            <button
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-2 text-blue-600 bg-blue-50 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <Download size={16} />
              Install ManeLekka
            </button>
          ) : (
            <p className="text-xs text-gray-400 text-center py-1">Tap the browser menu (⋮) and select <strong>Install app</strong> to install ManeLekka on your device.</p>
          )}
        </div>
      )}

      {/* Share app */}
      {navigator.share && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Share</h3>
          <button
            onClick={() => navigator.share({ title: 'ManeLekka', text: 'Your home. Your money. Your account.', url: window.location.origin })}
            className="w-full flex items-center justify-center gap-2 text-green-600 bg-green-50 py-2.5 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors"
          >
            <Share2 size={16} />
            Share App
          </button>
        </div>
      )}

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
