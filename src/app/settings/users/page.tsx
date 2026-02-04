'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

interface SupplierRow {
  id: string
  user_id: string
  owner_name: string | null
  store_name: string | null
  email: string | null
  phone_number: string | null
  city: string | null
  listing_approval: 'Refused' | 'Approved'
  user_picture_url: string | null
  store_picture_url: string | null
}

export default function UserSettingsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState('')
  const [modalImageTitle, setModalImageTitle] = useState('')

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
        .select('id, user_id, owner_name, store_name, email, phone_number, city, listing_approval, user_picture_url, store_picture_url')
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

  const handleApprovalChange = async (supplierId: string, nextValue: 'Refused' | 'Approved') => {
    setSavingId(supplierId)
    setError('')
    try {
      const { error } = await supabase
        .from('users')
        .update({ listing_approval: nextValue, updated_at: new Date().toISOString() })
        .eq('id', supplierId)

      if (error) {
        console.error('Error updating listing approval:', error)
        setError(error.message || 'Failed to update approval status')
        return
      }

      setSuppliers(prev =>
        prev.map(s =>
          s.id === supplierId ? { ...s, listing_approval: nextValue } : s
        )
      )
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Unexpected error updating approval status')
    } finally {
      setSavingId(null)
    }
  }

  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return suppliers
    return suppliers.filter(s =>
      (s.user_id || '').toLowerCase().includes(q) ||
      (s.owner_name || '').toLowerCase().includes(q) ||
      (s.store_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    )
  }, [search, suppliers])

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
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
    <div className="flex h-screen bg-gray-100 transition-colors">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Header />

        <main className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">User Settings</h2>
              <p className="text-gray-600">Manage supplier listing approval</p>
            </div>
            <div className="relative w-full max-w-md">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by supplier ID, owner, store, or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary-blue focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Store Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">City</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User Picture</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Store Picture</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Listing Approval</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSuppliers.map(supplier => (
                    <tr key={supplier.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{supplier.user_id || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{supplier.owner_name || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{supplier.store_name || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{supplier.email || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{supplier.phone_number || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{supplier.city || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {supplier.user_picture_url ? (
                          <img
                            src={supplier.user_picture_url}
                            alt="User"
                            onClick={() => {
                              setModalImageUrl(supplier.user_picture_url || '')
                              setModalImageTitle(`${supplier.owner_name || 'User'}'s Picture`)
                              setImageModalOpen(true)
                            }}
                            className="h-12 w-12 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {supplier.store_picture_url ? (
                          <img
                            src={supplier.store_picture_url}
                            alt="Store"
                            onClick={() => {
                              setModalImageUrl(supplier.store_picture_url || '')
                              setModalImageTitle(`${supplier.store_name || 'Store'} Picture`)
                              setImageModalOpen(true)
                            }}
                            className="h-12 w-12 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <select
                          value={supplier.listing_approval || 'Refused'}
                          onChange={(e) => handleApprovalChange(supplier.id, e.target.value as 'Refused' | 'Approved')}
                          disabled={savingId === supplier.id}
                          className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-primary-blue focus:outline-none"
                        >
                          <option value="Refused">Refused</option>
                          <option value="Approved">Approved</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-6 text-center text-sm text-gray-500">
                        No suppliers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Image Modal */}
      {imageModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setImageModalOpen(false)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{modalImageTitle}</h3>
              <button
                onClick={() => setImageModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Image */}
            <div className="p-4 flex items-center justify-center bg-gray-50">
              <img
                src={modalImageUrl}
                alt={modalImageTitle}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

