'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

const ACCOUNT_APPROVAL_OPTIONS = ['Wait', 'Approved', 'Refused'] as const
type AccountApproval = typeof ACCOUNT_APPROVAL_OPTIONS[number]

interface SupplierRow {
  id: string
  user_id: string
  full_name: string | null
  shop_name_on_zambeel: string | null
  email: string | null
  phone_number: string | null
  country: string | null
  user_picture_url: string | null
  account_approval: string | null
}

export default function UserSettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [search, setSearch] = useState('')
  const [updatingApprovalForId, setUpdatingApprovalForId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    // Admin-only access
    if (!authLoading && isAuthenticated && userRole !== 'admin') {
      router.push('/dashboard')
      return
    }

    if (!authLoading && isAuthenticated && userRole === 'admin') {
      fetchSuppliers()
    }
  }, [authLoading, isAuthenticated, userRole, router])

  const fetchSuppliers = async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, user_id, full_name, shop_name_on_zambeel, email, phone_number, country, user_picture_url, account_approval')
        .eq('role', 'supplier')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching suppliers:', error)
        setError(error.message || 'Failed to load suppliers')
        return
      }

      setSuppliers((data || []) as SupplierRow[])
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Unexpected error fetching suppliers')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return suppliers
    return suppliers.filter(s =>
      (s.user_id || '').toLowerCase().includes(q) ||
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.shop_name_on_zambeel || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    )
  }, [search, suppliers])

  const handleAccountApprovalChange = async (userId: string, newValue: string) => {
    setUpdatingApprovalForId(userId)
    try {
      const { error } = await supabase
        .from('users')
        .update({ account_approval: newValue })
        .eq('id', userId)

      if (error) {
        console.error('Error updating account approval:', error)
        setError(error.message || 'Failed to update account approval')
        return
      }
      setSuppliers(prev =>
        prev.map(s => (s.id === userId ? { ...s, account_approval: newValue } : s))
      )
      setError('')
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Failed to update account approval')
    } finally {
      setUpdatingApprovalForId(null)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-[#f5f3ff]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading user settings...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || userRole !== 'admin') {
    return null
  }

  return (
    <div className="flex h-screen bg-[#f5f3ff]">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Header />

        <main className="p-4 sm:p-6 lg:p-8 bg-[#f5f3ff]">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 theme-heading-gradient">User Settings</h2>
              <p className="text-sm sm:text-base text-gray-600">View and manage supplier accounts</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="theme-box rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-2.5 sm:top-3.5 text-white/50" size={18} />
              <input
                type="text"
                placeholder="Search by supplier ID, owner, store, or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-white/20 rounded-lg sm:rounded-xl bg-white/10 text-white focus:border-violet-400 focus:bg-white/15 focus:outline-none placeholder:text-white/50"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50/90 border border-red-200 rounded-xl text-red-700 backdrop-blur-sm">
              {error}
            </div>
          )}

          {/* Users Table */}
          <div className="theme-card rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Supplier ID</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Owner Name</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Shop Name</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Email</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Phone</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Country</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Account Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredSuppliers.map(supplier => (
                    <tr key={supplier.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium theme-heading">{supplier.user_id || '-'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm theme-muted">{supplier.full_name || '—'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm theme-muted">{supplier.shop_name_on_zambeel || '—'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm theme-muted">{supplier.email || '—'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm theme-muted">{supplier.phone_number || '—'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm theme-muted">{supplier.country || '—'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                        <select
                          value={supplier.account_approval || 'Wait'}
                          onChange={(e) => handleAccountApprovalChange(supplier.id, e.target.value)}
                          disabled={updatingApprovalForId === supplier.id}
                          className={`min-w-[120px] px-3 py-1.5 rounded-lg border-2 text-sm font-semibold focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all ${
                            supplier.account_approval === 'Approved'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 focus:border-emerald-400 [&>option]:bg-[#1e1b4b] [&>option]:text-white'
                              : supplier.account_approval === 'Refused'
                              ? 'bg-red-500/20 border-red-500/40 text-red-300 focus:border-red-400 [&>option]:bg-[#1e1b4b] [&>option]:text-white'
                              : 'bg-amber-500/20 border-amber-500/40 text-amber-300 focus:border-amber-400 [&>option]:bg-[#1e1b4b] [&>option]:text-white'
                          }`}
                        >
                          {ACCOUNT_APPROVAL_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {updatingApprovalForId === supplier.id && (
                          <span className="ml-2 text-xs theme-muted">Saving...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 sm:px-6 py-8 sm:py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                            <Search className="w-6 h-6 sm:w-8 sm:h-8 text-white/60" />
                          </div>
                          <p className="text-sm sm:text-base theme-muted">No suppliers found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

