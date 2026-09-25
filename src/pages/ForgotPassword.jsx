import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { MailCheck } from 'lucide-react'

export default function ForgotPassword() {
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MailCheck size={32} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Check your email</h2>
          <p className="text-gray-500 text-sm mb-1">We sent a password reset link to</p>
          <p className="text-blue-600 font-medium text-sm mb-4">{email}</p>
          <p className="text-gray-400 text-xs mb-6">Click the link in the email to reset your password. Check your spam folder if you don't see it.</p>
          <Link
            to="/login"
            className="block w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-2xl font-bold text-blue-600 mb-1">ManeLekka</h1>
        <p className="text-gray-500 text-sm mb-1">Forgot your password?</p>
        <p className="text-gray-400 text-xs mb-6">Enter your email and we'll send you a reset link.</p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          <Link to="/login" replace className="text-blue-600 font-medium">Back to Sign In</Link>
        </p>
      </div>
    </div>
  )
}
