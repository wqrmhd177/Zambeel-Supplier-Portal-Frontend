'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock, Filter, Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  fetchRequestsByStatus,
  approvePriceChange,
  rejectPriceChange,
  PriceHistoryEntry
} from '@/lib/priceHistoryHelpers'
import {
  fetchStatusRequestsByStatus,
  approveStatusChangeRequest,
  rejectStatusChangeRequest,
  VariantStatusChangeRequest
} from '@/lib/variantStatusChangeHelpers'
import { getCurrenciesForUserIds } from '@/lib/currencyHelpers'

type PriceRequestWithProduct = PriceHistoryEntry & {
  product_title?: string
  size?: string
  color?: string
  company_sku?: string
  sku?: string
  option_values?: Record<string, string>
}

type StatusRequestWithProduct = VariantStatusChangeRequest & {
  product_title?: string
  size?: string
  color?: string
  company_sku?: string
  sku?: string
  option_values?: Record<string, string>
  request_scope?: 'variant' | 'product'
}

type RequestWithProduct = (
  | (PriceRequestWithProduct & { request_type: 'price' })
  | (StatusRequestWithProduct & { request_type: 'status' })
  | ({
      id: string
      product_id: number
      variant_id: number
      created_at: string
      created_by_supplier_id: string | null
      created_by_purchaser_id: number | null
      status: 'pending' | 'approved' | 'rejected'
      reviewed_at: string | null
      reviewed_by: string | null
      request_type: 'both'
      product_title?: string
      size?: string
      color?: string
      company_sku?: string
      sku?: string
      option_values?: Record<string, string>
      previous_price: number
      updated_price: number
      previous_active: boolean
      updated_active: boolean
      price_request_id: string
      status_request_id: string
    })
)

export default function ApprovalsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userFriendlyId } = useAuth()
  const [requests, setRequests] = useState<RequestWithProduct[]>([])
  const [currencyBySupplierId, setCurrencyBySupplierId] = useState<Map<string, string>>(new Map())
  const [requesterNameById, setRequesterNameById] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const toMinuteBucket = (iso: string) => {
    const d = new Date(iso)
    d.setSeconds(0, 0)
    return d.toISOString()
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    // Only agents can access this page
    if (!authLoading && isAuthenticated && userRole !== 'agent') {
      router.push('/products')
      return
    }

    if (isAuthenticated && userRole === 'agent') {
      fetchRequests()
    }
  }, [isAuthenticated, authLoading, userRole, router, filter])

  const fetchRequests = async () => {
    setIsLoading(true)
    setError('')
    try {
      const [priceData, statusData] = await Promise.all([
        fetchRequestsByStatus(filter),
        fetchStatusRequestsByStatus(filter),
      ])

      // Enrich requests with variant details for proper label + SKU display.
      const allVariantIds = Array.from(new Set([
        ...priceData.map((r) => r.variant_id),
        ...statusData.map((r) => r.variant_id),
      ]))
      let variantMetaMap = new Map<number, { sku?: string; option_values?: Record<string, string> }>()
      if (allVariantIds.length > 0) {
        const { data: variantMetaData } = await supabase
          .from('product_variants')
          .select('variant_id, sku, option_values')
          .in('variant_id', allVariantIds)
        variantMetaMap = new Map((variantMetaData || []).map((v: any) => [v.variant_id, v]))
      }

      // Enrich status requests with product details for display consistency.
      const statusVariantIds = Array.from(new Set(statusData.map((r) => r.variant_id)))
      let statusProductsMap = new Map<number, { product_title?: string; size?: string; color?: string; company_sku?: string }>()
      if (statusVariantIds.length > 0) {
        const productIds = Array.from(new Set(statusData.map((r) => r.product_id)))
        const { data: productsData } = await supabase
          .from('products')
          .select('product_id, product_title, size, color, company_sku')
          .in('product_id', productIds)
        statusProductsMap = new Map((productsData || []).map((p: any) => [p.product_id, p]))
      }

      // Combine price+status requests created in same minute for same product/variant/requester/status.
      type CombinedGroup = {
        price?: PriceRequestWithProduct
        status?: StatusRequestWithProduct
      }
      const groups = new Map<string, CombinedGroup>()

      priceData.forEach((r) => {
        const key = `${r.status}|${r.product_id}|${r.variant_id}|${r.created_by_supplier_id ?? ''}|${toMinuteBucket(r.created_at)}`
        const existing = groups.get(key) || {}
        groups.set(key, { ...existing, price: r })
      })
      statusData.forEach((r) => {
        const scope = r.request_scope || 'variant'
        // Align variant-scope status requests with price_history keys so we can render "Price + Status".
        const key = scope === 'product'
          ? `${r.status}|product|${r.product_id}|${r.created_by_supplier_id ?? ''}|${toMinuteBucket(r.created_at)}`
          : `${r.status}|${r.product_id}|${r.variant_id}|${r.created_by_supplier_id ?? ''}|${toMinuteBucket(r.created_at)}`
        const existing = groups.get(key) || {}
        groups.set(key, { ...existing, status: r })
      })

      const merged: RequestWithProduct[] = Array.from(groups.values()).map((g) => {
        if (g.price && g.status) {
          return {
            id: `${g.price.id}|${g.status.id}`,
            product_id: g.price.product_id,
            variant_id: g.price.variant_id,
            created_at: g.price.created_at > g.status.created_at ? g.price.created_at : g.status.created_at,
            created_by_supplier_id: g.price.created_by_supplier_id ?? g.status.created_by_supplier_id,
            created_by_purchaser_id: g.price.created_by_purchaser_id ?? g.status.created_by_purchaser_id,
            status: g.price.status,
            reviewed_at: g.price.reviewed_at ?? g.status.reviewed_at,
            reviewed_by: g.price.reviewed_by ?? g.status.reviewed_by,
            request_type: 'both' as const,
            request_scope: g.status.request_scope,
            product_title: statusProductsMap.get(g.price.product_id)?.product_title || g.price.product_title,
            size: statusProductsMap.get(g.price.product_id)?.size || g.price.size,
            color: statusProductsMap.get(g.price.product_id)?.color || g.price.color,
            company_sku: statusProductsMap.get(g.price.product_id)?.company_sku || g.price.company_sku,
            sku: variantMetaMap.get(g.price.variant_id)?.sku,
            option_values: variantMetaMap.get(g.price.variant_id)?.option_values,
            previous_price: g.price.previous_price,
            updated_price: g.price.updated_price,
            previous_active: g.status.previous_active,
            updated_active: g.status.updated_active,
            price_request_id: g.price.id,
            status_request_id: g.status.id,
          }
        }
        if (g.price) {
          return {
            ...g.price,
            product_title: statusProductsMap.get(g.price.product_id)?.product_title || g.price.product_title,
            size: statusProductsMap.get(g.price.product_id)?.size || g.price.size,
            color: statusProductsMap.get(g.price.product_id)?.color || g.price.color,
            company_sku: statusProductsMap.get(g.price.product_id)?.company_sku || g.price.company_sku,
            sku: variantMetaMap.get(g.price.variant_id)?.sku,
            option_values: variantMetaMap.get(g.price.variant_id)?.option_values,
            request_type: 'price' as const,
          }
        }
        const s = g.status!
        return {
          ...s,
          ...statusProductsMap.get(s.product_id),
          sku: variantMetaMap.get(s.variant_id)?.sku,
          option_values: variantMetaMap.get(s.variant_id)?.option_values,
          request_type: 'status' as const,
        }
      }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))

      setRequests(merged)
      const supplierIds = Array.from(new Set(merged.map((r) => r.created_by_supplier_id).filter(Boolean))) as string[]
      const map = await getCurrenciesForUserIds(supplierIds)
      setCurrencyBySupplierId(map)

      // Resolve "Requested By" to shop name (fallback user ID).
      let requesterMap = new Map<string, string>()
      if (supplierIds.length > 0) {
        const numericIds = supplierIds.filter((id) => /^\d+$/.test(id)).map((id) => Number(id))
        const userIds = supplierIds.filter((id) => !/^\d+$/.test(id))
        const [byUserId, byNumericId] = await Promise.all([
          userIds.length > 0
            ? supabase.from('users').select('id, user_id, shop_name_on_zambeel, email').in('user_id', userIds)
            : Promise.resolve({ data: [], error: null as any }),
          numericIds.length > 0
            ? supabase.from('users').select('id, user_id, shop_name_on_zambeel, email').in('id', numericIds)
            : Promise.resolve({ data: [], error: null as any }),
        ])
        const usersData = [...(byUserId.data || []), ...(byNumericId.data || [])]
        usersData.forEach((u: any) => {
          const label = u.shop_name_on_zambeel || u.email || String(u.user_id || u.id)
          if (u.user_id) requesterMap.set(String(u.user_id), label)
          if (u.id != null) requesterMap.set(String(u.id), label)
        })
      }
      setRequesterNameById(requesterMap)
    } catch (err) {
      console.error('Error fetching requests:', err)
      setError('Failed to load approval requests')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (request: RequestWithProduct) => {
    if (!userFriendlyId) {
      setError('User ID not found')
      return
    }

    setProcessingId(request.id)
    setError('')
    setSuccess('')

    try {
      const result = request.request_type === 'price'
        ? await approvePriceChange(request.id, userFriendlyId)
        : request.request_type === 'status'
          ? await approveStatusChangeRequest(request.id, userFriendlyId)
          : (await approvePriceChange(request.price_request_id, userFriendlyId)) &&
            (await approveStatusChangeRequest(request.status_request_id, userFriendlyId))
      
      if (result) {
        setSuccess(`${request.request_type === 'price' ? 'Price' : 'Status'} change approved for ${request.product_title}`)
        // Refresh the list
        await fetchRequests()
      } else {
        setError('Failed to approve price change')
      }
    } catch (err) {
      console.error('Error approving request:', err)
      setError('An error occurred while approving')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (request: RequestWithProduct) => {
    if (!userFriendlyId) {
      setError('User ID not found')
      return
    }

    setProcessingId(request.id)
    setError('')
    setSuccess('')

    try {
      const result = request.request_type === 'price'
        ? await rejectPriceChange(request.id, userFriendlyId)
        : request.request_type === 'status'
          ? await rejectStatusChangeRequest(request.id, userFriendlyId)
          : (await rejectPriceChange(request.price_request_id, userFriendlyId)) &&
            (await rejectStatusChangeRequest(request.status_request_id, userFriendlyId))
      
      if (result) {
        setSuccess(`${request.request_type === 'price' ? 'Price' : 'Status'} change rejected for ${request.product_title}`)
        // Refresh the list
        await fetchRequests()
      } else {
        setError('Failed to reject price change')
      }
    } catch (err) {
      console.error('Error rejecting request:', err)
      setError('An error occurred while rejecting')
    } finally {
      setProcessingId(null)
    }
  }

  const formatVariant = (request: RequestWithProduct) => {
    if ('request_scope' in request && request.request_scope === 'product') {
      return 'All Variants'
    }
    if (request.option_values) {
      const optionParts = Object.values(request.option_values).filter(Boolean)
      if (optionParts.length > 0) return optionParts.join(' / ')
    }
    const parts = []
    if (request.size) parts.push(`Size: ${request.size}`)
    if (request.color) parts.push(`Color: ${request.color}`)
    return parts.length > 0 ? parts.join(', ') : 'No variants'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </span>
        )
      default:
        return null
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Product Update Approvals
              </h1>
              <p className="text-gray-600">
                Review and approve pending price/status requests
              </p>
            </div>

            {/* Filters */}
            <div className="mb-6 flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-500" />
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'pending'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setFilter('approved')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'approved'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Approved
                </button>
                <button
                  onClick={() => setFilter('rejected')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'rejected'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Rejected
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {/* Messages */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600">{success}</p>
              </div>
            )}

            {/* Requests Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {requests.length === 0 ? (
                <div className="p-8 text-center">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">
                    No {filter !== 'all' ? filter : ''} requests found
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Variant
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Request Type
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Change
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Requested By
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        {filter === 'pending' && (
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {requests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm font-medium text-gray-900">
                              {request.product_title || 'Unknown Product'}
                            </div>
                            {(request.sku || request.company_sku) && (
                              <div className="text-xs text-gray-500">
                                SKU: {request.sku || request.company_sku}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm text-gray-700">
                              {formatVariant(request)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                              request.request_type === 'price'
                                ? 'bg-blue-100 text-blue-800'
                                : request.request_type === 'status'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-indigo-100 text-indigo-800'
                            }`}>
                              {request.request_type === 'price' ? 'Price' : request.request_type === 'status' ? 'Status' : 'Price + Status'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {request.request_type === 'price' ? (
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-sm line-through text-gray-400">
                                  {currencyBySupplierId.get(request.created_by_supplier_id ?? '') ?? 'USD'} {request.previous_price.toFixed(2)}
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className="text-sm font-semibold text-gray-900">
                                  {currencyBySupplierId.get(request.created_by_supplier_id ?? '') ?? 'USD'} {request.updated_price.toFixed(2)}
                                </span>
                                {request.updated_price > request.previous_price ? (
                                  <span className="text-xs text-green-600">
                                    (+{((request.updated_price - request.previous_price) / request.previous_price * 100).toFixed(1)}%)
                                  </span>
                                ) : (
                                  <span className="text-xs text-red-600">
                                    ({((request.updated_price - request.previous_price) / request.previous_price * 100).toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            ) : request.request_type === 'both' ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-xs line-through text-gray-400">
                                    {currencyBySupplierId.get(request.created_by_supplier_id ?? '') ?? 'USD'} {request.previous_price.toFixed(2)}
                                  </span>
                                  <span className="text-gray-400">→</span>
                                  <span className="text-xs font-semibold text-gray-900">
                                    {currencyBySupplierId.get(request.created_by_supplier_id ?? '') ?? 'USD'} {request.updated_price.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                  <span className={`text-xs font-medium ${request.previous_active ? 'text-green-700' : 'text-gray-500'}`}>
                                    {request.previous_active ? 'Active' : 'Inactive'}
                                  </span>
                                  <span className="text-gray-400">→</span>
                                  <span className={`text-xs font-semibold ${request.updated_active ? 'text-green-700' : 'text-gray-700'}`}>
                                    {request.updated_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${request.previous_active ? 'text-green-700' : 'text-gray-500'}`}>
                                  {request.previous_active ? 'Active' : 'Inactive'}
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className={`text-sm font-semibold ${request.updated_active ? 'text-green-700' : 'text-gray-700'}`}>
                                  {request.updated_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm text-gray-700">
                              {requesterNameById.get(String(request.created_by_supplier_id ?? '')) || request.created_by_supplier_id || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="text-sm text-gray-700">
                              {formatDate(request.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex justify-center">
                              {getStatusBadge(request.status)}
                            </div>
                          </td>
                          {filter === 'pending' && (
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleApprove(request)}
                                  disabled={processingId === request.id}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingId === request.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Approve
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={() => handleReject(request)}
                                  disabled={processingId === request.id}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {processingId === request.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4 mr-1" />
                                      Reject
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

