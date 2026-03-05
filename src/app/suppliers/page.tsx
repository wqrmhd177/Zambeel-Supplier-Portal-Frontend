'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Users, 
  Plus, 
  Search, 
  Package,
  Mail,
  Phone,
  MapPin,
  Building2,
  Loader2,
  Eye
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { fetchSuppliersForPurchaser, getProductCountForSupplier, SupplierInfo, getPurchaserIntegerId } from '@/lib/supplierHelpers'

interface SupplierWithCount extends SupplierInfo {
  productCount: number
}

export default function SuppliersPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userId } = useAuth()
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!authLoading && isAuthenticated) {
      if (userRole !== 'purchaser' && userRole !== 'admin') {
        router.push('/dashboard')
        return
      }
      fetchSuppliers()
    }
  }, [isAuthenticated, authLoading, userRole, router])

  const fetchSuppliers = async () => {
    setIsLoading(true)
    setError('')

    try {
      let supplierList: SupplierInfo[] = []
      
      if (userRole === 'admin') {
        // Admin can see all suppliers
        const { data, error } = await supabase
          .from('users')
          .select('id, user_id, email, shop_name, shop_name_on_zambeel, country, phone_number, city, onboarded, created_at')
          .eq('role', 'supplier')
          .order('created_at', { ascending: false })
        
        if (error) {
          console.error('Error fetching suppliers:', error)
          setError('Failed to load suppliers')
          setIsLoading(false)
          return
        }
        supplierList = data || []
      } else if (userId) {
        // Purchaser sees only their suppliers
        // Get purchaser's integer ID
        const purchaserIntId = await getPurchaserIntegerId(userId)
        if (purchaserIntId) {
          supplierList = await fetchSuppliersForPurchaser(purchaserIntId)
        }
      }
      
      // Get product count for each supplier
      const suppliersWithCounts = await Promise.all(
        supplierList.map(async (supplier) => {
          const productCount = await getProductCountForSupplier(supplier.user_id)
          return {
            ...supplier,
            productCount
          }
        })
      )

      setSuppliers(suppliersWithCounts)
    } catch (err) {
      console.error('Error fetching suppliers:', err)
      setError('Failed to load suppliers')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSuppliers = suppliers.filter(supplier => {
    const query = searchQuery.toLowerCase()
    return (
      (supplier.shop_name?.toLowerCase().includes(query) || '') ||
      (supplier.shop_name?.toLowerCase().includes(query) || '') ||
      (supplier.email?.toLowerCase().includes(query) || '') ||
      (supplier.phone_number?.toLowerCase().includes(query) || '')
    )
  })

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-blue" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Suppliers</h1>
                <p className="text-gray-600">
                  Manage your suppliers and their products
                </p>
              </div>
              <button
                onClick={() => router.push('/suppliers/new')}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add New Supplier
              </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white border border-gray-300 rounded-2xl p-6 mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search suppliers by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
                />
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            {/* Suppliers List */}
            {filteredSuppliers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {suppliers.length === 0 ? 'No suppliers yet' : 'No suppliers found'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {suppliers.length === 0 
                    ? 'Get started by adding your first supplier' 
                    : 'Try adjusting your search criteria'}
                </p>
                {suppliers.length === 0 && (
                  <button
                    onClick={() => router.push('/suppliers/new')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Supplier
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSuppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="bg-white border border-gray-300 rounded-xl p-6 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {supplier.shop_name_on_zambeel || supplier.shop_name || 'Unnamed Store'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          supplier.onboarded
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {supplier.onboarded ? 'Onboarded' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {supplier.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.phone_number && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{supplier.phone_number}</span>
                        </div>
                      )}
                      {supplier.city && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span>{supplier.city}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Package className="w-4 h-4" />
                        <span className="font-medium">{supplier.productCount} products</span>
                      </div>
                      <button
                        onClick={() => router.push(`/suppliers/${supplier.user_id}/products`)}
                        className="px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-primary-blue-dark transition-colors text-sm font-medium inline-flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View Products
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

