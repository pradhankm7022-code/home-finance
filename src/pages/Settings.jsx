import { useAuth } from '../context/AuthContext'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

export default function Settings() {
  const { profile, signOut } = useAuth()
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(profile?.households?.invite_code || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3">
          <span className="flex-1 font-mono font-bold tracking-widest text-blue-600 text-lg">
            {profile?.households?.invite_code || '------'}
          </span>
          <button onClick={copyCode} className="text-gray-400 hover:text-blue-600 transition-colors">
            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>
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
