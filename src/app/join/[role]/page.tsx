'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setSessionCookie, updateLastActivity } from '@/lib/authCookie'

const VALID_ROLES = ['agent', 'purchaser', 'admin'] as const
type InternalRole = (typeof VALID_ROLES)[number]

const ROLE_LABELS: Record<InternalRole, string> = {
  agent: 'Agent',
  purchaser: 'Purchaser',
  admin: 'Admin',
}

const COUNTRIES = ['UAE', 'KSA', 'PAK'] as const
const TEAMS = ['Growth', 'Operations', 'CS', 'Finance', 'Listing', 'Strategy'] as const

function isValidRole(role: string): role is InternalRole {
  return (VALID_ROLES as readonly string[]).includes(role)
}

export default function JoinPage() {
  const router = useRouter()
  const params = useParams()
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role ?? ''

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

  if (!isValidRole(rawRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite Link</h1>
          <p className="text-gray-600">
            This invite link is not valid. Please ask your administrator for a valid link.
          </p>
        </div>
      </div>
    )
  }

  const role: InternalRole = rawRole
  const roleLabel = ROLE_LABELS[role]

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.fullName.trim()) { setError('Full name is required.'); return }
    if (!form.email.trim()) { setError('Email is required.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
    if (!form.country) { setError('Please select a country.'); return }
    if (!form.team) { setError('Please select a team.'); return }

    setIsLoading(true)
    try {
      const emailNormalized = form.email.trim().toLowerCase()

      // Check if email is already in use
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

      // Insert new internal user — pre-approved, onboarded, correct role
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            email: emailNormalized,
            password: form.password,
            full_name: form.fullName.trim(),
            phone_number: form.phone.trim() || null,
            country: form.country,
            team: form.team,
            role,
            account_approval: 'approved',
            onboarded: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (insertError || !newUser) {
        setError(insertError?.message || 'Failed to create account. Please try again.')
        setIsLoading(false)
        return
      }

      localStorage.setItem('userId', newUser.id)
      localStorage.setItem('userFriendlyId', newUser.user_id || '')
      localStorage.setItem('userEmail', emailNormalized)
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('userRole', role)
      setSessionCookie()
      updateLastActivity()

      if (role === 'agent') {
        router.push('/product-availability')
      } else {
        router.push('/dashboard')
      }
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
        className="flex items-center justify-center h-20 w-full text-white"
        style={{
          background: 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 18%, #7c3aed 45%, #6d28d9 72%, #5b21b6 100%)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.2)',
        }}
      >
        <img src="/Zambeel LOGO Yellow dots.png" alt="Zambeel" className="h-12 object-contain drop-shadow-sm" />
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Join as {roleLabel}</h1>
            <p className="text-sm text-gray-500 mt-1">Create your internal team account</p>
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
                onChange={set('phone')}
                placeholder="+971 XX XXX XXXX"
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

            {/* Role is set by URL — show read-only badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Role:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 capitalize">
                {roleLabel}
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm disabled:opacity-60"
            >
              {isLoading ? 'Creating account…' : 'Create Account & Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400">
            Already have an account?{' '}
            <a href="/login" className="text-violet-600 hover:underline">Sign in</a>
          </p>
        </div>
      </main>
    </div>
  )
}
