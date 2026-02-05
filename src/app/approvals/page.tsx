'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock, Filter, Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import {
  fetchRequestsByStatus,
  approvePriceChange,
  rejectPriceChange,
  PriceHistoryEntry
} from '@/lib/priceHistoryHelpers'
import { getCurrenciesForUserIds } from '@/lib/currencyHelpers'

type RequestWithProduct = PriceHistoryEntry & {
  product_title?: string
  size?: string
  color?: string
  company_sku?: string
}

export default function ApprovalsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userFriendlyId } = useAuth()
  const [requests, setRequests] = useState<RequestWithProduct[]>([])
  const [currencyBySupplierId, setCurrencyBySupplierId] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
      const data = await fetchRequestsByStatus(filter)
      setRequests(data)
      const supplierIds = Array.from(new Set(data.map((r) => r.created_by_supplier_id).filter(Boolean))) as string[]
      const map = await getCurrenciesForUserIds(supplierIds)
      setCurrencyBySupplierId(map)
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
      const result = await approvePriceChange(request.id, userFriendlyId)
      
      if (result) {
        setSuccess(`Price change approved for ${request.product_title}`)
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
      const result = await rejectPriceChange(request.id, userFriendlyId)
      
      if (result) {
        setSuccess(`Price change rejected for ${request.product_title}`)
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
                Price Change Approvals
              </h1>
              <p className="text-gray-600">
                Review and approve price change requests from suppliers
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Variant
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price Change
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Requested By
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        {filter === 'pending' && (
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {requests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {request.product_title || 'Unknown Product'}
                            </div>
                            {request.company_sku && (
                              <div className="text-xs text-gray-500">
                                SKU: {request.company_sku}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700">
                              {formatVariant(request)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
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
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700">
                              {request.created_by_supplier_id || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700">
                              {formatDate(request.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(request.status)}
                          </td>
                          {filter === 'pending' && (
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
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

