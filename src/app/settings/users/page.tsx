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

const ROLE_OPTIONS = ['supplier', 'agent', 'purchaser', 'admin', 'manager', 'listing_agent'] as const
type UserRole = typeof ROLE_OPTIONS[number]

interface UserRow {
  id: string
  user_id: string
  full_name: string | null
  shop_name_on_zambeel: string | null
  email: string | null
  phone_number: string | null
  country: string | null
  user_picture_url: string | null
  account_approval: string | null
  role: string | null
}

export default function UserSettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [updatingApprovalForId, setUpdatingApprovalForId] = useState<string | null>(null)
  const [updatingRoleForId, setUpdatingRoleForId] = useState<string | null>(null)

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
      fetchUsers()
    }
  }, [authLoading, isAuthenticated, userRole, router])

  const fetchUsers = async () => {
    setIsLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, user_id, full_name, shop_name_on_zambeel, email, phone_number, country, user_picture_url, account_approval, role')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching users:', error)
        setError(error.message || 'Failed to load users')
        return
      }

      setUsers((data || []) as UserRow[])
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Unexpected error fetching users')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return users
    return users.filter(u =>
      (u.user_id || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.shop_name_on_zambeel || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    )
  }, [search, users])

  const handleAccountApprovalChange = async (id: string, newValue: string) => {
    setUpdatingApprovalForId(id)
    try {
      const { error } = await supabase
        .from('users')
        .update({ account_approval: newValue })
        .eq('id', id)

      if (error) {
        console.error('Error updating account approval:', error)
        setError(error.message || 'Failed to update account approval')
        return
      }
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, account_approval: newValue } : u)))
      setError('')
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Failed to update account approval')
    } finally {
      setUpdatingApprovalForId(null)
    }
  }

  const handleRoleChange = async (id: string, newRole: string) => {
    setUpdatingRoleForId(id)
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', id)

      if (error) {
        console.error('Error updating role:', error)
        setError(error.message || 'Failed to update role')
        return
      }
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, role: newRole } : u)))
      setError('')
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Failed to update role')
    } finally {
      setUpdatingRoleForId(null)
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

  const roleBadgeClass = (role: string | null) => {
    switch (role) {
      case 'admin':          return 'bg-violet-600 text-white'
      case 'agent':          return 'bg-blue-600 text-white'
      case 'purchaser':      return 'bg-emerald-600 text-white'
      case 'manager':        return 'bg-indigo-600 text-white'
      case 'listing_agent':  return 'bg-cyan-600 text-white'
      default:               return 'bg-amber-500 text-white'
    }
  }

  const approvalBadgeClass = (approval: string | null) => {
    if (approval === 'Approved') return 'bg-emerald-600 text-white'
    if (approval === 'Refused')  return 'bg-red-600 text-white'
    return 'bg-amber-500 text-white'
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
              <p className="text-sm sm:text-base text-gray-600">Manage account approvals and roles for all users</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="theme-box rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-2.5 sm:top-3.5 text-white/50" size={18} />
              <input
                type="text"
                placeholder="Search by ID, name, store, email, or role"
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
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">User ID</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Name</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Shop Name</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Email</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Country</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Role</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Account Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium theme-heading">{user.user_id || '-'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm theme-muted">{user.full_name || '—'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm theme-muted">{user.shop_name_on_zambeel || '—'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm theme-muted">{user.email || '—'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm theme-muted">{user.country || '—'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${roleBadgeClass(user.role)}`} />
                          <select
                            value={user.role || 'supplier'}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            disabled={updatingRoleForId === user.id}
                            className="min-w-[130px] px-2 py-1.5 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium focus:outline-none focus:border-violet-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                          >
                            {ROLE_OPTIONS.map(opt => (
                              <option key={opt} value={opt} style={{ background: '#1e1b4b', color: 'white' }}>
                                {opt === 'listing_agent' ? 'Listing Agent' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                              </option>
                            ))}
                          </select>
                          {updatingRoleForId === user.id && (
                            <span className="text-xs theme-muted">Saving…</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${approvalBadgeClass(user.account_approval)}`} />
                          <select
                            value={user.account_approval || 'Wait'}
                            onChange={(e) => handleAccountApprovalChange(user.id, e.target.value)}
                            disabled={updatingApprovalForId === user.id}
                            className="min-w-[110px] px-2 py-1.5 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium focus:outline-none focus:border-violet-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                          >
                            {ACCOUNT_APPROVAL_OPTIONS.map(opt => (
                              <option key={opt} value={opt} style={{ background: '#1e1b4b', color: 'white' }}>{opt}</option>
                            ))}
                          </select>
                          {updatingApprovalForId === user.id && (
                            <span className="text-xs theme-muted">Saving…</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 sm:px-6 py-8 sm:py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                            <Search className="w-6 h-6 sm:w-8 sm:h-8 text-white/60" />
                          </div>
                          <p className="text-sm sm:text-base theme-muted">No users found.</p>
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
