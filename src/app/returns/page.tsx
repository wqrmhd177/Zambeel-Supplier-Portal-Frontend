'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  RotateCcw,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import type { ReturnOrder } from '@/app/api/returns/route'

const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 400

interface ReturnRowState {
  receiving_status: string
  return_condition: string
  saving: boolean
  saved: boolean
}

export default function ReturnsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userFriendlyId } = useAuth()

  const [orders, setOrders] = useState<ReturnOrder[]>([])
  const [rowState, setRowState] = useState<Record<string, ReturnRowState>>({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalFiltered, setTotalFiltered] = useState(0)

  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const prevDebouncedSearch = useRef(debouncedSearch)

  const isSupplier = userRole === 'supplier'
  const isAdmin = userRole === 'admin'

  // Only admin and supplier can access this page
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login')
        return
      }
      if (userRole && userRole !== 'admin' && userRole !== 'supplier') {
        router.push('/dashboard')
      }
    }
  }, [authLoading, isAuthenticated, userRole, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchQuery])

  const vendorId = isSupplier ? (userFriendlyId ?? '') : ''

  const loadReturns = useCallback(
    async (opts: {
      page: number
      search: string
      vendorId: string
      refresh?: boolean
    }) => {
      setFetchError('')
      setIsFetching(true)
      try {
        const params = new URLSearchParams({
          page: String(opts.page),
          limit: String(PAGE_SIZE),
          search: opts.search,
        })
        if (opts.vendorId) params.set('vendorId', opts.vendorId)
        if (opts.refresh) params.set('refresh', '1')

        const res = await fetch(`/api/returns?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to fetch returns')
        const json = await res.json() as {
          orders: ReturnOrder[]
          total: number
          page: number
          totalPages: number
        }

        const rows: ReturnOrder[] = json.orders ?? []
        setOrders(rows)
        setPage(json.page)
        setTotalPages(json.totalPages)
        setTotalFiltered(json.total)

        // Initialise local row state from fetched Supabase values
        const newState: Record<string, ReturnRowState> = {}
        for (const o of rows) {
          const key = `${o.order_number}__${o.sku}`
          newState[key] = {
            receiving_status: o.receiving_status ?? '',
            return_condition: o.return_condition ?? '',
            saving: false,
            saved: false,
          }
        }
        setRowState(newState)
      } catch (err) {
        console.error(err)
        setFetchError('Unable to load returns right now. Please refresh and try again.')
      } finally {
        setIsFetching(false)
      }
    },
    []
  )

  useEffect(() => {
    if (!isAuthenticated) return
    if (userRole && userRole !== 'admin' && userRole !== 'supplier') return

    let effectivePage = page
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch
      effectivePage = 1
      if (page !== 1) {
        setPage(1)
        return
      }
    }

    void loadReturns({ page: effectivePage, search: debouncedSearch, vendorId })
  }, [isAuthenticated, page, debouncedSearch, vendorId, userRole, loadReturns])

  const handleRefresh = () => {
    void loadReturns({ page, search: debouncedSearch, vendorId, refresh: true })
  }

  const rowKey = (o: ReturnOrder) => `${o.order_number}__${o.sku}`

  const handleDropdownChange = async (
    order: ReturnOrder,
    field: 'receiving_status' | 'return_condition',
    value: string
  ) => {
    const key = rowKey(order)

    setRowState((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value, saving: true, saved: false },
    }))

    try {
      const current = rowState[key] ?? { receiving_status: '', return_condition: '' }
      const payload = {
        order_id: String(order.order_number),
        sku: order.sku,
        vendor_id: order.vendor_id ?? null,
        receiving_status: field === 'receiving_status' ? value || null : current.receiving_status || null,
        return_condition: field === 'return_condition' ? value || null : current.return_condition || null,
      }

      const res = await fetch('/api/returns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Save failed')

      setRowState((prev) => ({
        ...prev,
        [key]: { ...prev[key], [field]: value, saving: false, saved: true },
      }))

      // Clear "saved" indicator after 2 s
      setTimeout(() => {
        setRowState((prev) => ({
          ...prev,
          [key]: { ...prev[key], saved: false },
        }))
      }, 2000)
    } catch (err) {
      console.error(err)
      setRowState((prev) => ({
        ...prev,
        [key]: { ...prev[key], saving: false },
      }))
    }
  }

  const fmt = (d: string | null | undefined) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    } catch {
      return d
    }
  }

  if (authLoading || (isFetching && orders.length === 0)) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-600">Loading returns…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null
  if (userRole && userRole !== 'admin' && userRole !== 'supplier') return null

  void isAdmin

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Header />
        <main className="p-4 sm:p-6 lg:p-8">

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Return Management</h2>
              <p className="text-gray-600 text-sm">
                {totalFiltered} returned order{totalFiltered !== 1 ? 's' : ''} · 50 per page
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isFetching}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center gap-2 disabled:opacity-60 self-start sm:self-auto"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {fetchError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-4">{fetchError}</div>
          )}

          {/* Search */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by Order ID or Tracking ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
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
                <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No returned orders</h3>
                <p className="text-gray-500 text-sm">
                  Orders with a Return status will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {[
                        'Order ID',
                        'Product',
                        'Quantity',
                        'Courier Tracking ID',
                        'Return Date',
                        'Receiving Status',
                        'Return Condition',
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
                      const key = rowKey(order)
                      const rs = rowState[key] ?? { receiving_status: '', return_condition: '', saving: false, saved: false }

                      return (
                        <tr key={key} className="hover:bg-gray-50 transition-colors">

                          {/* Order ID */}
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                            #{order.order_number}
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

                          {/* Return Date */}
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {fmt(order.Returned_date)}
                          </td>

                          {/* Receiving Status */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <select
                                value={rs.receiving_status}
                                onChange={(e) => void handleDropdownChange(order, 'receiving_status', e.target.value)}
                                disabled={rs.saving}
                                className="pl-2 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
                              >
                                <option value="">— Select —</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                              {rs.saving && (
                                <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
                              )}
                              {rs.saved && (
                                <Save className="w-3 h-3 text-green-500" />
                              )}
                            </div>
                          </td>

                          {/* Return Condition */}
                          <td className="px-4 py-3">
                            <select
                              value={rs.return_condition}
                              onChange={(e) => void handleDropdownChange(order, 'return_condition', e.target.value)}
                              disabled={rs.saving}
                              className="pl-2 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60"
                            >
                              <option value="">— Select —</option>
                              <option value="Good">Good</option>
                              <option value="Broken">Broken</option>
                              <option value="Product Changed">Product Changed</option>
                              <option value="No product">No product</option>
                            </select>
                          </td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>Page {page} of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || isFetching}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || isFetching}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  )
}
