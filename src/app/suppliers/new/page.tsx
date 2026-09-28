'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Loader2,
  Mail,
  Lock,
  User,
  Phone,
  Store,
  Globe,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { getPurchaserIntegerId, getPurchaserCountry } from '@/lib/supplierHelpers'
import { ALL_COUNTRIES, getCurrencyForCountry } from '@/lib/countryData'

// ─── Constants ────────────────────────────────────────────────────────────────
const SUPPLIER_TYPES = ['Trader', 'Wholesaler', 'Retailer', 'Selling from Home'] as const
const CATEGORIES = [
  'Electronics', 'Mobile Phones & Accessories', 'Computers & IT Accessories',
  'Home Appliances', 'Garments / Apparel', 'Footwear', 'Fashion Accessories',
  'Cosmetics & Beauty Products', 'Personal Care & Hygiene', 'Health & Wellness',
  'Baby Care Products', 'Toys & Games', 'Sports & Fitness Equipment',
  'Home & Kitchen', 'Furniture', 'Home Décor', 'Grocery & Food Items',
  'Stationery & Office Supplies', 'Books & Educational Material',
  'Automotive Parts & Accessories', 'Tools & Hardware', 'Jewellery & Watches',
  'Bags & Luggage', 'Pet Supplies',
] as const

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  email: string
  password: string
  ownerName: string
  shopNameOnZambeel: string
  phone: string
  whatsapp: string
  country: string
  city: string
  currency: string
  supplierType: string
  categories: string[]
}

const INIT: FormData = {
  email: '',
  password: '',
  ownerName: '',
  shopNameOnZambeel: '',
  phone: '',
  whatsapp: '',
  country: '',
  city: '',
  currency: 'USD',
  supplierType: '',
  categories: [],
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CreateSupplierPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userId } = useAuth()

  const [form, setForm] = useState<FormData>(INIT)
  const [sameAsPhone, setSameAsPhone] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')

  const isCountryLocked = userRole === 'purchaser'

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
    if (!authLoading && isAuthenticated && userRole !== 'purchaser' && userRole !== 'admin') {
      router.push('/dashboard')
    }
  }, [isAuthenticated, authLoading, userRole, router])

  // Auto-fill country for purchaser role
  useEffect(() => {
    if (authLoading || !isAuthenticated || userRole !== 'purchaser' || !userId) return
    getPurchaserCountry(userId).then((result) => {
      if (result) {
        setForm((f) => ({
          ...f,
          country: result.country,
          currency: getCurrencyForCountry(result.country) || 'USD',
        }))
      }
    })
  }, [authLoading, isAuthenticated, userRole, userId])

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function set<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
  }

  function handleCountryChange(country: string) {
    const currency = getCurrencyForCountry(country) || 'USD'
    setForm((f) => ({ ...f, country, currency }))
    setErrors((e) => ({ ...e, country: '' }))
  }

  function handlePhoneChange(value: string) {
    set('phone', value)
    if (sameAsPhone) set('whatsapp', value)
  }

  function handleSameAsPhone(checked: boolean) {
    setSameAsPhone(checked)
    if (checked) set('whatsapp', form.phone)
  }

  function toggleCategory(cat: string) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }))
  }

  // ─── Validation ───────────────────────────────────────────────────────────
  function validate() {
    const e: Record<string, string> = {}
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password.trim()) e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Minimum 6 characters'
    if (!form.shopNameOnZambeel.trim()) e.shopNameOnZambeel = 'Shop name is required'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    if (!form.whatsapp.trim()) e.whatsapp = 'WhatsApp number is required'
    if (!form.country) e.country = 'Country is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    setSubmitError('')
    setSubmitSuccess('')

    try {
      // Check for duplicate email
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', form.email.trim())
        .single()

      if (existing) {
        setSubmitError('An account with this email already exists.')
        setSaving(false)
        return
      }

      // Resolve purchaser integer ID (needed for linkage)
      let purchaserIntId: number | null = null
      if (userRole !== 'admin' && userId) {
        purchaserIntId = await getPurchaserIntegerId(userId)
        if (!purchaserIntId) {
          setSubmitError('Unable to get your purchaser ID. Please try again.')
          setSaving(false)
          return
        }
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          email: form.email.trim(),
          password: form.password,
          role: 'supplier',
          purchaser_id: purchaserIntId,
          full_name: form.ownerName.trim() || null,
          owner_name: form.ownerName.trim() || null,
          shop_name_on_zambeel: form.shopNameOnZambeel.trim(),
          phone_number: form.phone.trim(),
          whatsapp_phone_number: form.whatsapp.trim(),
          country: form.country || null,
          city: form.city.trim() || null,
          currency: form.currency || 'USD',
          supplier_type: form.supplierType || null,
          category: form.categories.length > 0 ? JSON.stringify(form.categories) : null,
          onboarded: true,
          account_approval: 'Approved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          setSubmitError('An account with this email already exists.')
        } else {
          setSubmitError(insertError.message || 'Failed to create supplier. Please try again.')
        }
        setSaving(false)
        return
      }

      if (newUser) {
        setSubmitSuccess('Supplier account created successfully!')
        setTimeout(() => router.push('/suppliers'), 1500)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setSubmitError('An unexpected error occurred. Please try again.')
      setSaving(false)
    }
  }

  // ─── Loading state ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-blue" />
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Back */}
            <button
              type="button"
              onClick={() => router.push('/suppliers')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Suppliers
            </button>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Add New Supplier</h1>
              <p className="mt-1 text-sm text-gray-500">
                Fill in the basic details to create a supplier account.
                {isCountryLocked && ' Country is set from your account.'}
              </p>
            </div>

            {/* Form card */}
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-gray-300 rounded-2xl p-6 space-y-5"
            >
              {submitError && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                  <p className="text-sm text-red-600 font-medium">{submitError}</p>
                </div>
              )}
              {submitSuccess && (
                <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                  <p className="text-sm text-green-600 font-medium">{submitSuccess}</p>
                </div>
              )}

              {/* ── Account Credentials ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Email *" error={errors.email}>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="supplier@example.com"
                      className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.email ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                    />
                  </div>
                </Field>

                <Field label="Password *" error={errors.password}>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      placeholder="Minimum 6 characters"
                      className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.password ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                    />
                  </div>
                </Field>
              </div>

              {/* ── Shop & Owner ── */}
              <Field label="Shop / Store Name on Zambeel *" error={errors.shopNameOnZambeel}>
                <div className="relative">
                  <Store className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={form.shopNameOnZambeel}
                    onChange={(e) => set('shopNameOnZambeel', e.target.value)}
                    placeholder="e.g. Khan Electronics"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.shopNameOnZambeel ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                  />
                </div>
              </Field>

              <Field label="Owner Name">
                <div className="relative">
                  <User className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={form.ownerName}
                    onChange={(e) => set('ownerName', e.target.value)}
                    placeholder="Full name (optional)"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-primary-blue"
                  />
                </div>
              </Field>

              {/* ── Phone ── */}
              <Field label="Phone Number *" error={errors.phone}>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+92 300 0000000"
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.phone ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                  />
                </div>
              </Field>

              {/* ── WhatsApp ── */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    WhatsApp Number *
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sameAsPhone}
                      onChange={(e) => handleSameAsPhone(e.target.checked)}
                      className="rounded"
                    />
                    Same as phone number
                  </label>
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
                  <input
                    type="tel"
                    value={form.whatsapp}
                    onChange={(e) => {
                      setSameAsPhone(false)
                      set('whatsapp', e.target.value)
                    }}
                    placeholder="+92 300 0000000"
                    disabled={sameAsPhone}
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${sameAsPhone ? 'bg-gray-50' : ''} ${errors.whatsapp ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                  />
                </div>
                {errors.whatsapp && <p className="text-xs text-red-500">{errors.whatsapp}</p>}
              </div>

              {/* ── Country & City ── */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Country *" error={errors.country}>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3.5 text-gray-400 w-4 h-4" />
                    <select
                      value={form.country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      disabled={isCountryLocked}
                      className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${isCountryLocked ? 'bg-gray-50' : ''} ${errors.country ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                    >
                      <option value="">Select country</option>
                      {ALL_COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </Field>

                <Field label="City">
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="City (optional)"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-primary-blue"
                  />
                </Field>
              </div>

              {/* ── Currency (auto) ── */}
              <Field label="Currency">
                <input
                  type="text"
                  value={form.currency}
                  readOnly
                  placeholder="Auto-set from country"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500 focus:outline-none"
                />
              </Field>

              {/* ── Supplier Type ── */}
              <Field label="Supplier Type">
                <select
                  value={form.supplierType}
                  onChange={(e) => set('supplierType', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-primary-blue"
                >
                  <option value="">Select type (optional)</option>
                  {SUPPLIER_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>

              {/* ── Categories ── */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Business Categories
                </label>
                <p className="text-xs text-gray-400">Optional — select all that apply</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        form.categories.includes(cat)
                          ? 'bg-primary-blue text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push('/suppliers')}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-medium text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                  ) : (
                    <><Save className="w-4 h-4" /> Create Supplier</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
