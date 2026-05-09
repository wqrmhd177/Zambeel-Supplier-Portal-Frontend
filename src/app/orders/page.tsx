'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart,
  Search,
  Filter,
  Download,
  Calendar,
  Phone,
  MapPin,
  Banknote,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  RefreshCw,
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import type { MetabaseOrder } from '@/app/api/orders/route'

export default function OrdersPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole } = useAuth()

  const [allOrders, setAllOrders] = useState<MetabaseOrder[]>([])
  const [orders, setOrders] = useState<MetabaseOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCountry, setFilterCountry] = useState('all')

  const [stats, setStats] = useState({
    total: 0,
    delivered: 0,
    pending: 0,
    returned: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    setFetchError('')
    try {
      const res = await fetch('/api/orders')
      if (!res.ok) throw new Error('Failed to fetch orders')
      const json = await res.json() as { orders: MetabaseOrder[] }
      const rows = json.orders ?? []
      setAllOrders(rows)
      applyFilters(rows, searchQuery, filterStatus, filterCountry)
      calculateStats(rows)
    } catch (err) {
      console.error(err)
      setFetchError('Unable to load orders right now. Please refresh and try again.')
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchOrders()
  }, [isAuthenticated, fetchOrders])

  const applyFilters = (
    source: MetabaseOrder[],
    search: string,
    status: string,
    country: string
  ) => {
    let filtered = [...source]

    if (status !== 'all') {
      filtered = filtered.filter(
        (o) => o.status?.toLowerCase().includes(status.toLowerCase())
      )
    }

    if (country !== 'all') {
      filtered = filtered.filter(
        (o) => o.country?.toLowerCase() === country.toLowerCase()
      )
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(q) ||
          o.sku?.toLowerCase().includes(q) ||
          o.title?.toLowerCase().includes(q) ||
          o.full_name?.toLowerCase().includes(q) ||
          o.phone?.toLowerCase().includes(q) ||
          o.city?.toLowerCase().includes(q) ||
          o.country?.toLowerCase().includes(q) ||
          o.System_gen_tracking_id_removed?.toLowerCase().includes(q) ||
          o.Courier_tracking_id?.toLowerCase().includes(q)
      )
    }

    setOrders(filtered)
  }

  useEffect(() => {
    applyFilters(allOrders, searchQuery, filterStatus, filterCountry)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterStatus, filterCountry, allOrders])

  const calculateStats = (rows: MetabaseOrder[]) => {
    let delivered = 0, pending = 0, returned = 0, totalRevenue = 0
    rows.forEach((o) => {
      const s = o.status?.toLowerCase() || ''
      if (s.includes('delivered')) { delivered++; totalRevenue += Number(o.total_payable || 0) }
      else if (s.includes('return')) returned++
      else pending++
    })
    setStats({ total: rows.length, delivered, pending, returned, totalRevenue })
  }

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || ''
    if (s.includes('delivered'))
      return { icon: CheckCircle, className: 'bg-green-100 text-green-800 border-green-200', label: status }
    if (s.includes('return'))
      return { icon: XCircle, className: 'bg-red-100 text-red-800 border-red-200', label: status }
    if (s.includes('shipped') || s.includes('dispatch') || s.includes('transit'))
      return { icon: Truck, className: 'bg-blue-100 text-blue-800 border-blue-200', label: status }
    return { icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: status }
  }

  const fmt = (d: string | null | undefined) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    } catch { return d }
  }

  const uniqueCountries = Array.from(new Set(allOrders.map((o) => o.country).filter(Boolean))).sort()

  const exportToCSV = () => {
    if (orders.length === 0) return
    const headers = [
      'Order #', 'Customer', 'Phone', 'City', 'Country',
      'Product', 'SKU', 'Qty', 'Total Payable',
      'Zambeel Tracking', 'Courier Tracking',
      'Status', 'Substatus', 'Tag',
      'Order Date', 'Shipment Date', 'Delivered Date',
      'Platform', 'Vendor ID',
    ]
    const esc = (v: any) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = orders.map((o) => [
      esc(o.order_number), esc(o.full_name), esc(o.phone), esc(o.city), esc(o.country),
      esc(o.title), esc(o.sku), esc(o.quantity), esc(o.total_payable),
      esc(o.System_gen_tracking_id_removed), esc(o.Courier_tracking_id),
      esc(o.status), esc(o.substatus), esc(o.tag),
      esc(o.Order_date), esc(o.shipment_date), esc(o.delivered_date),
      esc(o.PLATFORM), esc(o.vendor_id),
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-600">Loading orders…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Header />
        <main className="p-4 sm:p-6 lg:p-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Orders</h2>
              <p className="text-gray-600 text-sm">Live data from Metabase</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                disabled={orders.length === 0}
                className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg font-medium hover:border-blue-500 hover:text-blue-600 transition-all text-gray-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />Export CSV
              </button>
              <button
                onClick={fetchOrders}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />Refresh
              </button>
            </div>
          </div>

          {fetchError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-4">{fetchError}</div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total', value: stats.total, icon: ShoppingCart, gradient: 'from-cyan-500 to-blue-500' },
              { label: 'Delivered', value: stats.delivered, icon: CheckCircle, gradient: 'from-emerald-500 to-green-500' },
              { label: 'Pending', value: stats.pending, icon: Clock, gradient: 'from-yellow-500 to-orange-500' },
              { label: 'Returned', value: stats.returned, icon: XCircle, gradient: 'from-red-500 to-pink-500' },
              { label: 'Revenue (Delivered)', value: `${stats.totalRevenue.toLocaleString()}`, icon: Banknote, gradient: 'from-purple-500 to-pink-500' },
            ].map(({ label, value, icon: Icon, gradient }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">{label}</p>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search order #, SKU, name, phone, tracking…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-3 text-gray-400" size={18} />
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="all">All Countries</option>
                {uniqueCountries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-3 text-gray-400" size={18} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="all">All Status</option>
                <option value="delivered">Delivered</option>
                <option value="shipped">Shipped</option>
                <option value="return">Return</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {orders.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {allOrders.length === 0 ? 'No orders found' : 'No results'}
                </h3>
                <p className="text-gray-500 text-sm">
                  {allOrders.length === 0
                    ? 'Orders will appear here once data is available from Metabase.'
                    : 'Try adjusting your search or filters.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        'Order #', 'Customer', 'Product', 'SKU', 'Qty',
                        'Total Payable', 'Tracking', 'Status', 'Order Date',
                      ].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((order) => {
                      const badge = getStatusBadge(order.status)
                      const BadgeIcon = badge.icon
                      return (
                        <tr key={`${order.id}-${order.sku}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                            #{order.order_number}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{order.full_name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />{order.phone}
                            </div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{order.city}, {order.country}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <div className="text-gray-900 line-clamp-2">{order.title || '—'}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{order.sku}</td>
                          <td className="px-4 py-3 text-center text-gray-900">{order.quantity}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                            {Number(order.total_payable).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {order.System_gen_tracking_id_removed && (
                              <div className="text-xs text-gray-700 font-mono">Z: {order.System_gen_tracking_id_removed}</div>
                            )}
                            {order.Courier_tracking_id && (
                              <div className="text-xs text-gray-500 font-mono">C: {order.Courier_tracking_id}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${badge.className}`}>
                              <BadgeIcon className="w-3 h-3" />
                              {badge.label}
                            </span>
                            {order.substatus && order.substatus !== order.status && (
                              <div className="text-xs text-gray-400 mt-0.5">{order.substatus}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {fmt(order.Order_date)}
                            </div>
                            {order.delivered_date && (
                              <div className="text-xs text-green-600 mt-0.5">
                                Del: {fmt(order.delivered_date)}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                  Showing {orders.length} of {allOrders.length} orders
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
