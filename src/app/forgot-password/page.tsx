'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Eye, EyeOff, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'

type Step = 'email' | 'reset' | 'done'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your email address.'); return }
    // Move to reset step — we don't reveal whether the email exists
    setStep('reset')
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), newPassword }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Failed to reset password. Please try again.')
        setIsLoading(false)
        return
      }

      setStep('done')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border-4 border-indigo-500 p-8 space-y-6">

        {/* Back to login */}
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Sign In
        </button>

        {/* ── Step 1: Enter email ── */}
        {step === 'email' && (
          <>
            <div className="text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-7 h-7 text-violet-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Forgot Password?</h1>
              <p className="text-sm text-gray-500 mt-2">
                Enter your registered email address and we&apos;ll let you set a new password.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 text-gray-400 pointer-events-none" size={17} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full py-3 pl-10 pr-4 text-sm border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none focus:shadow-[0_0_0_4px_rgba(139,92,246,0.1)] transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 transition-all shadow-[0_4px_14px_rgba(139,92,246,0.4)]"
              >
                Continue
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: Set new password ── */}
        {step === 'reset' && (
          <>
            <div className="text-center">
              <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-violet-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
              <p className="text-sm text-gray-500 mt-2">
                Choose a new password for <span className="font-semibold text-gray-700">{email}</span>.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  New Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 text-gray-400 pointer-events-none" size={17} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    className="w-full py-3 pl-10 pr-12 text-sm border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none focus:shadow-[0_0_0_4px_rgba(139,92,246,0.1)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-gray-400 hover:text-violet-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 text-gray-400 pointer-events-none" size={17} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    minLength={8}
                    className="w-full py-3 pl-10 pr-12 text-sm border-2 border-gray-200 rounded-xl focus:border-violet-500 focus:outline-none focus:shadow-[0_0_0_4px_rgba(139,92,246,0.1)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 text-gray-400 hover:text-violet-600 transition-colors"
                  >
                    {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-60 transition-all shadow-[0_4px_14px_rgba(139,92,246,0.4)]"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating…
                  </span>
                ) : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {/* ── Step 3: Success ── */}
        {step === 'done' && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Password Updated!</h2>
            <p className="text-sm text-gray-600">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-3.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 transition-all shadow-[0_4px_14px_rgba(139,92,246,0.4)]"
            >
              Go to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
