'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart,
  Search,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  RefreshCw,
  Package,
  ArrowRightLeft,
  RotateCcw,
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { PaginationLight } from '@/components/Pagination'
import { useAuth } from '@/hooks/useAuth'
import type { MetabaseOrder, OrdersResponse } from '@/app/api/orders/route'
import {
  DATE_FILTER_PRESETS,
  type DateFilterPreset,
  getDateRange,
  parseSearchTerms,
  serializeSearchTerms,
} from '@/lib/filterUtils'

const PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 400

export default function OrdersPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userFriendlyId } = useAuth()

  const [orders, setOrders] = useState<MetabaseOrder[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalFiltered, setTotalFiltered] = useState(0)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterStatusBucket, setFilterStatusBucket] = useState('all')
  const [filterCountry, setFilterCountry] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>('all')

  const [stats, setStats] = useState({
    total: 0,
    inTransit: 0,
    toBeDispatch: 0,
    delivered: 0,
    returned: 0,
    returning: 0,
  })
  const [countries, setCountries] = useState<string[]>([])

  const prevDebouncedSearch = useRef(debouncedSearch)

  const isSupplier = userRole === 'supplier'
  const isAdmin = userRole === 'admin'

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchQuery])

  const loadOrders = useCallback(
    async (opts: {
      page: number
      search: string
      status: string
      statusBucket: string
      country: string
      vendorId: string
      dateFilter: DateFilterPreset
      refresh?: boolean
    }) => {
      setFetchError('')
      setIsFetching(true)
      try {
        const params = new URLSearchParams({
          page: String(opts.page),
          limit: String(PAGE_SIZE),
          search: opts.search,
          status: opts.status,
          statusBucket: opts.statusBucket,
          country: opts.country,
        })
        if (opts.vendorId) params.set('vendorId', opts.vendorId)
        if (opts.refresh) params.set('refresh', '1')
        const range = getDateRange(opts.dateFilter)
        if (range) {
          params.set('dateFrom', range.dateFrom)
          params.set('dateTo', range.dateTo)
        }

        const res = await fetch(`/api/orders?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch orders')
        const json = (await res.json()) as OrdersResponse

        setOrders(json.orders ?? [])
        setPage(json.page)
        setTotalPages(json.totalPages)
        setTotalFiltered(json.total)
        setLimit(json.limit)
        if (json.stats) setStats(json.stats)
        if (json.countries) setCountries(json.countries)
      } catch (err) {
        console.error(err)
        setFetchError('Unable to load orders right now. Please refresh and try again.')
      } finally {
        setIsFetching(false)
      }
    },
    []
  )

  // Supplier: always scope to their vendor_id. Admin: no vendor filter.
  const vendorId = isSupplier ? (userFriendlyId ?? '') : ''

  useEffect(() => {
    if (!isAuthenticated) return

    let effectivePage = page
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch
      effectivePage = 1
      if (page !== 1) {
        setPage(1)
        return
      }
    }

    void loadOrders({
      page: effectivePage,
      search: serializeSearchTerms(parseSearchTerms(debouncedSearch)),
      status: filterStatus,
      statusBucket: filterStatusBucket,
      country: filterCountry,
      vendorId,
      dateFilter,
    })
  }, [isAuthenticated, page, debouncedSearch, filterStatus, filterStatusBucket, filterCountry, vendorId, dateFilter, loadOrders])

  const handleRefresh = () => {
    void loadOrders({
      page,
      search: serializeSearchTerms(parseSearchTerms(debouncedSearch)),
      status: filterStatus,
      statusBucket: filterStatusBucket,
      country: filterCountry,
      vendorId,
      dateFilter,
      refresh: true,
    })
  }

  const setFilterCountryAndReset = (value: string) => {
    setFilterCountry(value)
    setPage(1)
  }

  const setFilterStatusAndReset = (value: string) => {
    setFilterStatus(value)
    setFilterStatusBucket('all')
    setPage(1)
  }

  const setStatCardFilter = (bucket: string) => {
    setFilterStatusBucket(bucket)
    setFilterStatus('all')
    setPage(1)
  }

  const setDateFilterAndReset = (value: DateFilterPreset) => {
    setDateFilter(value)
    setPage(1)
  }

  const searchTermCount = parseSearchTerms(debouncedSearch).length
  const showExport =
    filterStatus === 'all' && filterStatusBucket === 'all'

  const fmt = (d: string | null | undefined) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return d
    }
  }

  const exportToCSV = async () => {
    setFetchError('')
    try {
      const params = new URLSearchParams({
        export: '1',
        search: serializeSearchTerms(parseSearchTerms(debouncedSearch)),
        status: 'all',
        statusBucket: 'all',
        country: filterCountry,
      })
      if (vendorId) params.set('vendorId', vendorId)
      // Export is all-time: no dateFrom/dateTo

      const res = await fetch(`/api/orders?${params.toString()}`)
      if (!res.ok) throw new Error('Export failed')
      const json = (await res.json()) as { orders: MetabaseOrder[] }
      const rowsData = json.orders ?? []
      if (rowsData.length === 0) return

      const headers = [
        'Order ID',
        'Shipment Date',
        'Product Title',
        'SKU',
        'Quantity',
        'Courier Tracking ID',
        'Status',
        ...(isAdmin ? ['Vendor ID'] : []),
      ]
      const esc = (v: unknown) => {
        if (v === null || v === undefined) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s
      }
      const rows = rowsData.map((o) =>
        [
          esc(o.id),
          esc(fmt(o.shipment_date)),
          esc(o.title),
          esc(o.sku),
          esc(o.quantity),
          esc(o.Courier_tracking_id),
          esc(o.status),
          ...(isAdmin ? [esc(o.vendor_id)] : []),
        ].join(',')
      )
      const csv = [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
    } catch (e) {
      console.error(e)
      setFetchError('Could not export CSV. Try again.')
    }
  }

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || ''
    if (s.includes('delivered'))
      return { icon: CheckCircle, className: 'bg-green-100 text-green-800 border-green-200', label: status }
    if (s.includes('return'))
      return { icon: XCircle, className: 'bg-red-100 text-red-800 border-red-200', label: status }
    if (s.includes('dispatching') || s.includes('shipped') || s.includes('dispatch') || s.includes('transit'))
      return { icon: Truck, className: 'bg-blue-100 text-blue-800 border-blue-200', label: status }
    return { icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: status }
  }

  if (authLoading || (isFetching && orders.length === 0)) {
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

  const statCards = [
    { label: 'All Orders', value: stats.total, icon: ShoppingCart, gradient: 'from-cyan-500 to-blue-500', bucket: 'all' },
    { label: 'Pending Dispatch', value: stats.toBeDispatch, icon: Package, gradient: 'from-yellow-500 to-orange-500', bucket: 'toBeDispatch' },
    { label: 'In-Delivery', value: stats.inTransit, icon: ArrowRightLeft, gradient: 'from-blue-500 to-indigo-500', bucket: 'inTransit' },
    { label: 'Delivered', value: stats.delivered, icon: CheckCircle, gradient: 'from-emerald-500 to-green-500', bucket: 'delivered' },
    { label: 'Returned', value: stats.returned, icon: XCircle, gradient: 'from-red-500 to-pink-500', bucket: 'returned' },
    { label: 'Returning', value: stats.returning, icon: RotateCcw, gradient: 'from-orange-500 to-red-500', bucket: 'returning' },
  ]

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Header />
        <main className="p-4 sm:p-6 lg:p-8">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Orders</h2>
              <p className="text-gray-600 text-sm">{PAGE_SIZE} per page · data from Metabase</p>
            </div>
            <div className="flex gap-2">
              {showExport && (
                <button
                  type="button"
                  onClick={() => void exportToCSV()}
                  disabled={totalFiltered === 0 || isFetching}
                  className="px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg font-medium hover:border-blue-500 hover:text-blue-600 transition-all text-gray-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isFetching}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center gap-2 disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {fetchError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-4">{fetchError}</div>
          )}

          {/* Date filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            {DATE_FILTER_PRESETS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDateFilterAndReset(value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dateFilter === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {statCards.map(({ label, value, icon: Icon, gradient, bucket }) => (
              <button
                key={label}
                type="button"
                onClick={() => setStatCardFilter(bucket)}
                className={`bg-white border rounded-2xl p-5 text-left transition-all cursor-pointer hover:shadow-md ${
                  filterStatusBucket === bucket
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">{label}</p>
                    <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by Order ID or Tracking ID (paste multiple, comma or newline separated)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {searchTermCount > 1 && (
                <span className="absolute right-3 top-2.5 text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {searchTermCount} IDs
                </span>
              )}
            </div>

            {/* Country and Status filters — admin only */}
            {isAdmin && (
              <>
                <div className="relative">
                  <select
                    value={filterCountry}
                    onChange={(e) => setFilterCountryAndReset(e.target.value)}
                    className="pl-4 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="all">All Countries</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatusAndReset(e.target.value)}
                    className="pl-4 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="all">All Status</option>
                    <option value="delivered">Delivered</option>
                    <option value="dispatching in process">To be Dispatch</option>
                    <option value="return">Returned</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="confirmation pending">Confirmation Pending</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden relative">
            {isFetching && orders.length > 0 && (
              <div className="absolute inset-0 bg-white/50 z-10 flex items-start justify-center pt-4 pointer-events-none">
                <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full shadow border border-gray-200">
                  Loading…
                </span>
              </div>
            )}

            {orders.length === 0 && !isFetching ? (
              <div className="p-12 text-center">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No orders found</h3>
                <p className="text-gray-500 text-sm">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        'Order ID',
                        'Shipment Date',
                        'Product',
                        'Quantity',
                        'Courier Tracking ID',
                        'Status',
                        ...(isAdmin ? ['Vendor ID'] : []),
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                        >
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

                          {/* Order ID — Metabase row id (same as Returns tab) */}
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                            {order.id}
                          </td>

                          {/* Shipment Date */}
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {fmt(order.shipment_date)}
                          </td>

                          {/* Product: title + SKU */}
                          <td className="px-4 py-3 max-w-[220px]">
                            <div className="font-medium text-gray-900 line-clamp-2">{order.title || '—'}</div>
                            <div className="text-xs text-gray-400 font-mono mt-0.5">{order.sku}</div>
                          </td>

                          {/* Quantity */}
                          <td className="px-4 py-3 text-center text-gray-900">{order.quantity}</td>

                          {/* Courier Tracking ID */}
                          <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                            {order.Courier_tracking_id || '—'}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${badge.className}`}>
                              <BadgeIcon className="w-3 h-3" />
                              {badge.label}
                            </span>
                          </td>

                          {/* Vendor ID — admin only */}
                          {isAdmin && (
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">
                              {order.vendor_id ?? '—'}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <PaginationLight
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={totalFiltered}
                  onPageChange={(p) => setPage(p)}
                />
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  )
}
