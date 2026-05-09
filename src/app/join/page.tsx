'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const COUNTRIES = ['UAE', 'KSA', 'PAK'] as const
const TEAMS = ['Growth', 'Operations', 'CS', 'Finance', 'Listing', 'Strategy'] as const

export default function JoinPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    country: '',
    team: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only digits, +, spaces, dashes; enforce 13-char max
    const raw = e.target.value.replace(/[^\d+\s-]/g, '').slice(0, 13)
    setForm((prev) => ({ ...prev, phone: raw }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.fullName.trim()) { setError('Full name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
    if (!form.country) { setError('Please select your country.'); return }
    if (!form.team) { setError('Please select your team.'); return }

    setIsLoading(true)
    try {
      const emailNormalized = form.email.trim().toLowerCase()

      const { data: existing } = await supabase
        .from('users')
        .select('id, archived')
        .ilike('email', emailNormalized)
        .maybeSingle()

      if (existing && existing.archived !== true) {
        setError('An account with this email already exists. Please sign in instead.')
        setIsLoading(false)
        return
      }

      // Role is left as default ('supplier') so the admin can set the correct
      // role from the database or admin panel before the user logs in.
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            email: emailNormalized,
            password: form.password,
            full_name: form.fullName.trim(),
            phone_number: form.phone.trim() || null,
            country: form.country,
            team: form.team,
            account_approval: 'Wait',
            onboarded: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])

      if (insertError) {
        setError(insertError.message || 'Failed to create account. Please try again.')
        setIsLoading(false)
        return
      }

      setSuccess(true)
    } catch (err) {
      console.error(err)
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-center h-20 w-full"
        style={{
          background: 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 18%, #7c3aed 45%, #6d28d9 72%, #5b21b6 100%)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.2)',
        }}
      >
        <img src="/Zambeel LOGO Yellow dots.png" alt="Zambeel" className="h-12 object-contain drop-shadow-sm" />
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8 space-y-6">

          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Account Registered</h2>
              <p className="text-sm text-gray-600">
                Your account has been created. An admin will assign your role and activate access.
                You will be able to sign in once your account is ready.
              </p>
              <a
                href="/login"
                className="inline-block mt-2 px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
              >
                Go to Sign In
              </a>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">Team Registration</h1>
                <p className="text-sm text-gray-500 mt-1">Create your internal Zambeel account</p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={set('fullName')}
                    placeholder="Your full name"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="you@company.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={set('password')}
                      placeholder="Min. 6 characters"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={set('confirmPassword')}
                      placeholder="Repeat password"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact / Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={handlePhoneChange}
                    maxLength={13}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                    <select
                      value={form.country}
                      onChange={set('country')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      <option value="">Select</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Team *</label>
                    <select
                      value={form.team}
                      onChange={set('team')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                    >
                      <option value="">Select</option>
                      {TEAMS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
                >
                  {isLoading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-400">
                Already have an account?{' '}
                <a href="/login" className="text-violet-600 hover:underline">Sign in here</a>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
