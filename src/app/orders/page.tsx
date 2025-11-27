'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ShoppingCart, 
  Search, 
  Filter,
  Download,
  Calendar,
  Phone,
  MapPin,
  Package,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { fetchSuppliersForPurchaser, SupplierInfo, getPurchaserIntegerId } from '@/lib/supplierHelpers'

interface Order {
  id: number
  order_id: number
  vendor_id: string
  order_date: string
  phone: string
  country: string
  title: string | null
  sku: string
  total_payable: number
  status: string
}

export default function OrdersPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userId, userFriendlyId } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSupplier, setFilterSupplier] = useState<string>('all')
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([])
  const [supplierMap, setSupplierMap] = useState<Map<string, SupplierInfo>>(new Map())

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    delivered: 0,
    pending: 0,
    returned: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (isAuthenticated) {
      fetchOrders()
    }
  }, [isAuthenticated, authLoading, router])

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      let ordersData: Order[] = []

      if (userRole === 'purchaser' && userId) {
        // For purchasers: fetch orders from their suppliers
        const purchaserIntId = await getPurchaserIntegerId(userId)
        if (purchaserIntId) {
          // Get supplier user_ids for this purchaser
          const supplierList = await fetchSuppliersForPurchaser(purchaserIntId)
          setSuppliers(supplierList)
          
          const supplierIds = supplierList.map(s => s.user_id).filter(Boolean)
          
          if (supplierIds.length > 0) {
            const { data, error } = await supabase
              .from('orders')
              .select('*')
              .in('vendor_id', supplierIds)
              .order('order_date', { ascending: false })

            if (error) {
              console.error('Error fetching orders:', error)
              setOrders([])
              setAllOrders([])
              setIsLoading(false)
              return
            }

            ordersData = data || []
          }

          // Create supplier map
          const map = new Map<string, SupplierInfo>()
          supplierList.forEach(s => {
            if (s.user_id) {
              map.set(s.user_id, s)
            }
          })
          setSupplierMap(map)
        }
      } else if (userRole === 'admin') {
        // For admin: fetch all orders
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('order_date', { ascending: false })

        if (error) {
          console.error('Error fetching orders:', error)
          setOrders([])
          setAllOrders([])
          setIsLoading(false)
          return
        }

        ordersData = data || []

        // Fetch all suppliers for filter
        const { data: supplierData, error: supplierError } = await supabase
          .from('users')
          .select('id, user_id, email, owner_name, store_name, phone_number, city, onboarded, created_at')
          .eq('role', 'supplier')
          .order('created_at', { ascending: false })

        if (!supplierError && supplierData) {
          setSuppliers(supplierData)
          const map = new Map<string, SupplierInfo>()
          supplierData.forEach(s => {
            if (s.user_id) {
              map.set(s.user_id, s)
            }
          })
          setSupplierMap(map)
        }
      } else {
        // For suppliers: fetch their own orders
        if (!userFriendlyId) {
          setIsLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('vendor_id', userFriendlyId)
          .order('order_date', { ascending: false })

        if (error) {
          console.error('Error fetching orders:', error)
          setOrders([])
          setAllOrders([])
          setIsLoading(false)
          return
        }

        ordersData = data || []
      }

      setAllOrders(ordersData)
      applyFilters(ordersData)
      calculateStats(ordersData)
    } catch (err) {
      console.error('Unexpected error:', err)
      setOrders([])
      setAllOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = (ordersToFilter: Order[] = allOrders) => {
    let filtered = [...ordersToFilter]

    // Apply supplier filter (for purchasers and admin)
    if ((userRole === 'purchaser' || userRole === 'admin') && filterSupplier !== 'all') {
      filtered = filtered.filter(o => o.vendor_id === filterSupplier)
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(o => o.status?.toLowerCase() === filterStatus.toLowerCase())
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(order => {
        return (
          order.order_id?.toString().includes(query) ||
          order.sku?.toLowerCase().includes(query) ||
          order.title?.toLowerCase().includes(query) ||
          order.phone?.toLowerCase().includes(query) ||
          order.country?.toLowerCase().includes(query)
        )
      })
    }

    setOrders(filtered)
  }

  useEffect(() => {
    if (allOrders.length > 0 || orders.length > 0) {
      applyFilters()
    }
  }, [filterStatus, filterSupplier, searchQuery])

  const calculateStats = (ordersData: Order[]) => {
    const total = ordersData.length
    let delivered = 0
    let pending = 0
    let returned = 0
    let totalRevenue = 0

    ordersData.forEach(order => {
      const status = order.status?.toLowerCase() || ''
      if (status.includes('delivered')) {
        delivered++
        totalRevenue += order.total_payable || 0
      } else if (status.includes('return')) {
        returned++
      } else {
        pending++
      }
    })

    setStats({
      total,
      delivered,
      pending,
      returned,
      totalRevenue,
    })
  }

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || ''
    
    if (statusLower.includes('delivered')) {
      return {
        icon: CheckCircle,
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
        label: status
      }
    } else if (statusLower.includes('return')) {
      return {
        icon: XCircle,
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
        label: status
      }
    } else if (statusLower.includes('shipped') || statusLower.includes('dispatch')) {
      return {
        icon: Truck,
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        label: status
      }
    } else {
      return {
        icon: Clock,
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        label: status
      }
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const formatDateForCSV = (dateString: string) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toISOString()
    } catch {
      return dateString
    }
  }

  const exportToCSV = () => {
    if (orders.length === 0) {
      alert('No orders to export')
      return
    }

    // Define CSV headers
    const headers = [
      'Order ID',
      ...(userRole === 'purchaser' || userRole === 'admin' ? ['Supplier'] : []),
      'Date',
      'Product Title',
      'SKU',
      'Phone',
      'Country',
      'Total Payable',
      'Status'
    ]

    // Convert orders to CSV rows
    const csvRows = [
      headers.join(','),
      ...orders.map(order => {
        const supplierInfo = (userRole === 'purchaser' || userRole === 'admin') 
          ? supplierMap.get(order.vendor_id) 
          : null
        const supplierName = supplierInfo 
          ? (supplierInfo.store_name || supplierInfo.owner_name || supplierInfo.email || 'Unknown')
          : ''

        // Escape values that contain commas, quotes, or newlines
        const escapeCSV = (value: any) => {
          if (value === null || value === undefined) return ''
          const stringValue = String(value)
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        }

        return [
          escapeCSV(order.order_id),
          ...(userRole === 'purchaser' || userRole === 'admin' ? [escapeCSV(supplierName)] : []),
          escapeCSV(formatDateForCSV(order.order_date)),
          escapeCSV(order.title || ''),
          escapeCSV(order.sku),
          escapeCSV(order.phone),
          escapeCSV(order.country),
          escapeCSV(order.total_payable || 0),
          escapeCSV(order.status || '')
        ].join(',')
      })
    ]

    // Create CSV content
    const csvContent = csvRows.join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-dark-bg">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading orders...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-dark-bg transition-colors">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <Header />
        
        <main className="p-8">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Orders</h2>
              <p className="text-gray-600 dark:text-gray-400">View and manage your orders</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                disabled={orders.length === 0}
                className="px-6 py-3 bg-white dark:bg-dark-card border-2 border-gray-300 dark:border-gray-700 rounded-lg font-medium hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all text-gray-700 dark:text-gray-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                Export CSV
              </button>
              <button
                onClick={fetchOrders}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Orders</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Delivered</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.delivered}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Pending</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pending}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Returned</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.returned}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Revenue</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">PKR {stats.totalRevenue.toLocaleString()}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by order ID, SKU, title, phone, or country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
                />
              </div>
              {(userRole === 'purchaser' || userRole === 'admin') && suppliers.length > 0 && (
                <div className="relative">
                  <Filter className="absolute left-4 top-3.5 text-gray-400" size={20} />
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilterSupplier(e.target.value)}
                    className="pl-12 pr-10 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="all">All Suppliers</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.user_id} value={supplier.user_id}>
                        {supplier.store_name || supplier.owner_name || supplier.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="relative">
                <Filter className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-12 pr-10 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="delivered">Delivered</option>
                  <option value="shipped">Shipped</option>
                  <option value="pending">Pending</option>
                  <option value="return">Return</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl overflow-hidden">
            {orders.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-dark-hover rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {allOrders.length === 0 ? 'No orders yet' : 'No orders found'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {allOrders.length === 0 
                    ? 'Orders will appear here once they are synced from Metabase' 
                    : 'Try adjusting your search or filter criteria'}
                </p>
                {allOrders.length === 0 && (
                  <button
                    onClick={fetchOrders}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white inline-flex items-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Refresh Orders
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-hover border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Order ID</th>
                      {(userRole === 'purchaser' || userRole === 'admin') && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                      )}
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Product</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {orders.map((order) => {
                      const statusBadge = getStatusBadge(order.status)
                      const StatusIcon = statusBadge.icon
                      const supplierInfo = (userRole === 'purchaser' || userRole === 'admin') ? supplierMap.get(order.vendor_id) : null

                      return (
                        <tr key={`${order.order_id}-${order.sku}`} className="hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              #{order.order_id}
                            </div>
                          </td>
                          {(userRole === 'purchaser' || userRole === 'admin') && (
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 dark:text-white">
                                {supplierInfo ? (
                                  <div>
                                    <div className="font-medium">{supplierInfo.store_name || supplierInfo.owner_name || 'Unnamed'}</div>
                                    {supplierInfo.store_name && supplierInfo.owner_name && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">{supplierInfo.owner_name}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">Unknown</span>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              {formatDate(order.order_date)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {order.title || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-mono text-gray-900 dark:text-white">
                              {order.sku}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 dark:text-white">
                              <div className="flex items-center gap-2 mb-1">
                                <Phone className="w-4 h-4 text-gray-400" />
                                {order.phone}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <MapPin className="w-3 h-3" />
                                {order.country}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              PKR {order.total_payable?.toLocaleString() || '0'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border-2 ${statusBadge.className}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusBadge.label}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

