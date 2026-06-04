'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import Pagination from '@/components/Pagination'
import { useAuth } from '@/hooks/useAuth'
import {
  BulkUploadRowValidated,
  cancelProductAvailabilityRequest,
  createBulkDraftRequests,
  createProductAvailabilityRequest,
  fetchProductAvailabilityRequests,
  formatAvailabilityLabel,
  formatDerivedStatusLabel,
  formatStockStatusLabel,
  getProductAvailabilityCounts,
  parseBulkUploadCsv,
  parseBulkUploadFromRows,
  ProductAvailabilityListFilter,
  ProductAvailabilityRequestWithDetails,
  requestAlternativeSearch,
  submitDraftRequest,
  submitProductAvailabilityResponse,
  titleCaseWords,
} from '@/lib/productAvailabilityHelpers'
import { lookupInventoryBySkuPrefix, InventoryLookupResult } from '@/lib/productAvailabilityInventoryLookup'
import { supabase } from '@/lib/supabase'

const MARKET_OPTIONS = ['UAE', 'KSA', 'PAK', 'QTR', 'KWT', 'OMN', 'BHR', 'IRQ', 'USA']

type FilterTab = 'new' | 'drafts' | 'urgent' | 'normal_requests' | 'delayed' | 'completed' | 'cancelled' | 'all'

/** Sub-mode within the New tab */
type NewTabMode = 'single' | 'bulk'

type CreateFormState = {
  productStatus: 'already_listed' | 'not_listed' | 'not_sure'
  market: string
  resellerName: string
  productName: string
  sku: string
  referenceLink: string
  remarks: string
  priorityLevel: 'urgent' | 'normal'
  images: File[]
}

type PurchaserResponseState = {
  availability: 'available' | 'not_available' | 'on_demand' | 'alternative'
  stockStatus: 'limited' | 'on_demand' | 'bulk_limited_both'
  singleUnitPrice: string
  bulkUnitPrice: string
  remarks: string
  images: File[]
}

const initialCreateForm: CreateFormState = {
  productStatus: 'not_sure',
  market: '',
  resellerName: '',
  productName: '',
  sku: '',
  referenceLink: '',
  remarks: '',
  priorityLevel: 'normal',
  images: [],
}

const initialResponseForm: PurchaserResponseState = {
  availability: 'available',
  stockStatus: 'limited',
  singleUnitPrice: '',
  bulkUnitPrice: '',
  remarks: '',
  images: [],
}

async function uploadFilesToStorage(ownerId: string, files: File[]): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabase.storage
      .from('product_images')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) throw new Error(error.message)
    const { data: urlData } = supabase.storage.from('product_images').getPublicUrl(data.path)
    if (urlData.publicUrl) urls.push(urlData.publicUrl)
  }
  return urls
}

export default function ProductAvailabilityPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userFriendlyId } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('normal_requests')
  const [newTabMode, setNewTabMode] = useState<NewTabMode>('single')
  const [counts, setCounts] = useState({
    urgent: 0,
    normalRequests: 0,
    delayed: 0,
    completed: 0,
    cancelled: 0,
    drafts: 0,
    all: 0,
  })
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showAltSearch, setShowAltSearch] = useState(false)
  const [altSearchRemarks, setAltSearchRemarks] = useState('')
  const [altSearchSaving, setAltSearchSaving] = useState(false)
  const [altSearchError, setAltSearchError] = useState('')
  // Bulk upload state
  const [bulkCsvRows, setBulkCsvRows] = useState<BulkUploadRowValidated[]>([])
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkImportResult, setBulkImportResult] = useState<{ successCount: number; failedRows: number[] } | null>(null)
  // Draft photo upload state: maps requestId → File[]
  const [draftPhotoFiles, setDraftPhotoFiles] = useState<Record<string, File[]>>({})
  const [draftPhotoOpen, setDraftPhotoOpen] = useState<string | null>(null)
  const [draftSubmitting, setDraftSubmitting] = useState<string | null>(null)
  const [draftRequests, setDraftRequests] = useState<ProductAvailabilityRequestWithDetails[]>([])
  const [requests, setRequests] = useState<ProductAvailabilityRequestWithDetails[]>([])
  const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm)
  const [responseForm, setResponseForm] = useState<PurchaserResponseState>(initialResponseForm)
  const [selectedAssignment, setSelectedAssignment] = useState<{ requestId: string } | null>(null)
  const [showResponseForm, setShowResponseForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [inventoryLookup, setInventoryLookup] = useState<InventoryLookupResult | null>(null)
  const [inventoryError, setInventoryError] = useState('')
  const [isCheckingInventory, setIsCheckingInventory] = useState(false)
  const [savingRequest, setSavingRequest] = useState(false)
  const [savingResponse, setSavingResponse] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalError, setModalError] = useState('')
  const [modalSuccess, setModalSuccess] = useState('')
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null)
  const [expandedWarehouses, setExpandedWarehouses] = useState<Record<string, boolean>>({})
  const [selectedFeedbackRequest, setSelectedFeedbackRequest] = useState<ProductAvailabilityRequestWithDetails | null>(null)

  const isAgent = userRole === 'agent'
  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'manager'
  const canCreate = isAgent || isAdmin
  const isPurchaser = userRole === 'purchaser'
  // Only specific roles can access product availability; suppliers are excluded
  const canAccess = isAgent || isAdmin || isPurchaser || isManager

  const displayedRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests
    const q = searchQuery.toLowerCase()
    return requests.filter((r) =>
      String(r.request_number ?? '').includes(q) ||
      (r.reseller_name?.toLowerCase().includes(q) ?? false) ||
      (r.product_name?.toLowerCase().includes(q) ?? false) ||
      (r.sku?.toLowerCase().includes(q) ?? false) ||
      (r.market?.toLowerCase().includes(q) ?? false) ||
      (r.markets?.join(' ').toLowerCase().includes(q) ?? false)
    )
  }, [requests, searchQuery])

  const [paCurrentPage, setPaCurrentPage] = useState(1)
  const PA_ITEMS = 50

  // Reset pagination when filter or search changes
  useEffect(() => { setPaCurrentPage(1) }, [filter, searchQuery])

  const paTotalPages = Math.max(1, Math.ceil(displayedRequests.length / PA_ITEMS))
  const paginatedDisplayed = displayedRequests.slice((paCurrentPage - 1) * PA_ITEMS, paCurrentPage * PA_ITEMS)

  const getRequestThumbnail = (request: ProductAvailabilityRequestWithDetails): string | null => {
    const images = Array.isArray(request.request_images) ? request.request_images : []
    if (images.length === 0) return null
    return String(images[0])
  }

  const dataFilter: ProductAvailabilityListFilter = useMemo(() => {
    if (filter === 'new') return 'all'
    if (filter === 'drafts') return 'draft'
    if (filter === 'urgent') return 'urgent_open'
    if (filter === 'normal_requests') return 'normal_pending'
    if (filter === 'delayed') return 'delayed'
    if (filter === 'completed') return 'completed'
    if (filter === 'cancelled') return 'cancelled'
    return 'all'
  }, [filter])

  const refreshData = useCallback(async () => {
    if (!userFriendlyId || !userRole) return
    setIsLoading(true)
    try {
      const fetches: Promise<any>[] = [
        fetchProductAvailabilityRequests({ userRole, userFriendlyId, statusFilter: dataFilter }),
        getProductAvailabilityCounts(userRole, userFriendlyId),
      ]
      if (canCreate) {
        fetches.push(fetchProductAvailabilityRequests({ userRole, userFriendlyId, statusFilter: 'draft' }))
      }
      const [requestsData, countData, draftsData] = await Promise.all(fetches)
      setRequests(requestsData)
      setCounts(countData)
      if (draftsData) setDraftRequests(draftsData)
    } catch (err) {
      console.error(err)
      setError('Failed to load product availability requests')
    } finally {
      setIsLoading(false)
    }
  }, [dataFilter, userFriendlyId, userRole])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    if (!authLoading && isAuthenticated && !canAccess) {
      router.push('/products')
      return
    }
    if (isAuthenticated && canAccess && userFriendlyId) {
      void refreshData()
    }
  }, [authLoading, isAuthenticated, canAccess, userFriendlyId, router, refreshData])

  const handleCreateImageChange = (files: FileList | null) => {
    const selected = Array.from(files || [])
    const next = [...createForm.images, ...selected].slice(0, 5)
    setCreateForm((prev) => ({ ...prev, images: next }))
  }

  const handleResponseImageChange = (files: FileList | null) => {
    const selected = Array.from(files || [])
    const next = [...responseForm.images, ...selected].slice(0, 5)
    setResponseForm((prev) => ({ ...prev, images: next }))
  }

  const handleCheckInventory = async () => {
    setInventoryError('')
    setIsCheckingInventory(true)
    try {
      const result = await lookupInventoryBySkuPrefix(createForm.sku)
      setInventoryLookup(result)
      const defaults: Record<string, boolean> = {}
      result.warehouseGroups.forEach((group) => {
        defaults[group.warehouseName] = false
      })
      setExpandedWarehouses(defaults)
    } catch (err) {
      console.error(err)
      setInventoryError('Unable to fetch inventory right now. You can still submit this request.')
      setInventoryLookup(null)
    } finally {
      setIsCheckingInventory(false)
    }
  }

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userFriendlyId || !userRole) return
    setError('')
    setSuccess('')

    if (!createForm.market) {
      setError('Please select a market.')
      return
    }
    if (!createForm.resellerName.trim() || !createForm.productName.trim()) {
      setError('Reseller name and product name are required.')
      return
    }
    if (createForm.images.length === 0) {
      setError('Please upload at least one picture.')
      return
    }
    if (createForm.productStatus === 'already_listed' && !createForm.sku.trim()) {
      setError('SKU is required when product status is Already Listed.')
      return
    }

    setSavingRequest(true)
    try {
      const imageUrls = await uploadFilesToStorage(userFriendlyId, createForm.images)
      await createProductAvailabilityRequest({
        requestedByUserId: userFriendlyId,
        requestedByRole: userRole,
        productStatus: createForm.productStatus,
        market: createForm.market,
        resellerName: createForm.resellerName,
        productName: createForm.productName,
        sku: createForm.sku || null,
        referenceLink: createForm.referenceLink || null,
        remarks: createForm.remarks || null,
        priorityLevel: createForm.priorityLevel,
        requestImages: imageUrls,
        inventoryMatches: inventoryLookup
          ? inventoryLookup.warehouseGroups.flatMap((g) =>
              g.rows.map((r) => ({
                warehouse_name: g.warehouseName,
                sku: r.sku,
                quantity: r.quantity,
              }))
            )
          : [],
      })

      setSuccess('Product availability request created successfully.')
      setCreateForm(initialCreateForm)
      setInventoryLookup(null)
      await refreshData()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to create request')
    } finally {
      setSavingRequest(false)
    }
  }

  // ── Bulk upload handlers ─────────────────────────────────────────────────

  const handleBulkCsvChange = (files: FileList | null) => {
    setBulkCsvRows([])
    setBulkImportResult(null)
    const file = files?.[0]
    if (!file) return

    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

    if (isXlsx) {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const buffer = ev.target?.result as ArrayBuffer
        const ExcelJS = (await import('exceljs')).default
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer)
        const sheet = workbook.worksheets.find((ws) => ws.name !== '_Options' && ws.name !== 'Valid Options')
        if (!sheet) return
        const rows: string[][] = []
        sheet.eachRow((row) => {
          const vals = (row.values as unknown[]).slice(1).map((v) => {
            if (v === null || v === undefined) return ''
            if (typeof v === 'object' && 'text' in (v as object)) return String((v as { text: string }).text)
            return String(v)
          })
          rows.push(vals)
        })
        setBulkCsvRows(parseBulkUploadFromRows(rows))
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        setBulkCsvRows(parseBulkUploadCsv(text))
      }
      reader.readAsText(file)
    }
  }

  const handleDownloadTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()

    const sheet = workbook.addWorksheet('Bulk Upload')
    sheet.columns = [
      { header: 'product_name', key: 'product_name', width: 28 },
      { header: 'reseller_name', key: 'reseller_name', width: 22 },
      { header: 'market', key: 'market', width: 12 },
      { header: 'sku', key: 'sku', width: 16 },
      { header: 'reference_link', key: 'reference_link', width: 32 },
      { header: 'product_status', key: 'product_status', width: 20 },
      { header: 'priority_level', key: 'priority_level', width: 16 },
      { header: 'remarks', key: 'remarks', width: 30 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    headerRow.alignment = { horizontal: 'center' }
    headerRow.commit()

    sheet.addRow(['Example Product', 'Reseller Co', 'UAE', '', 'https://example.com', 'not_sure', 'normal', 'Optional notes here'])

    for (let row = 2; row <= 100; row++) {
      sheet.getCell(`C${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: ['"UAE,KSA,PAK,QTR,KWT,OMN,BHR,IRQ,USA"'],
        error: 'Choose one market: UAE, KSA, PAK, QTR, KWT, OMN, BHR, IRQ, USA',
        errorTitle: 'Invalid market',
        showErrorMessage: true,
      }
      sheet.getCell(`F${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"already_listed,not_listed,not_sure"'],
        error: 'Choose: already_listed, not_listed, or not_sure',
        errorTitle: 'Invalid value',
        showErrorMessage: true,
      }
      sheet.getCell(`G${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"urgent,normal"'],
        error: 'Choose: urgent or normal',
        errorTitle: 'Invalid value',
        showErrorMessage: true,
      }
    }

    const optSheet = workbook.addWorksheet('Valid Options')
    optSheet.columns = [
      { header: 'Column', key: 'col', width: 20 },
      { header: 'Valid Values', key: 'vals', width: 55 },
    ]
    optSheet.getRow(1).font = { bold: true }
    optSheet.addRow(['market', 'UAE  |  KSA  |  PAK  |  QTR  |  KWT  |  OMN  |  BHR  |  IRQ  |  USA  (one market per request)'])
    optSheet.addRow(['product_status', 'already_listed  |  not_listed  |  not_sure'])
    optSheet.addRow(['priority_level', 'urgent  |  normal'])
    optSheet.addRow(['remarks', 'Free-text notes (optional)'])

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bulk_upload_template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBulkImport = async () => {
    if (!userFriendlyId || !userRole) return
    const validRows = bulkCsvRows.filter((r) => r.errors.length === 0)
    if (validRows.length === 0) return
    setBulkImporting(true)
    setError('')
    try {
      const result = await createBulkDraftRequests(validRows, userFriendlyId, userRole)
      setBulkImportResult(result)
      setBulkCsvRows([])
      await refreshData()
      setFilter('drafts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk import failed')
    } finally {
      setBulkImporting(false)
    }
  }

  // ── Draft photo submission handlers ──────────────────────────────────────

  const handleDraftPhotoChange = (requestId: string, files: FileList | null) => {
    const selected = Array.from(files || []).slice(0, 5)
    setDraftPhotoFiles((prev) => ({ ...prev, [requestId]: selected }))
  }

  const handleSubmitDraft = async (requestId: string) => {
    if (!userFriendlyId) return
    const files = draftPhotoFiles[requestId] || []
    if (files.length === 0) {
      setError('Please select at least one photo before submitting.')
      return
    }
    setError('')
    setDraftSubmitting(requestId)
    try {
      const imageUrls = await uploadFilesToStorage(userFriendlyId, files)
      await submitDraftRequest(requestId, imageUrls)
      setDraftPhotoOpen(null)
      setDraftPhotoFiles((prev) => { const n = { ...prev }; delete n[requestId]; return n })
      setSuccess('Request submitted successfully.')
      await refreshData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setDraftSubmitting(null)
    }
  }

  const openRespondForm = (requestId: string) => {
    setSelectedAssignment({ requestId })
    setResponseForm(initialResponseForm)
    setShowResponseForm(true)
    setModalError('')
    setModalSuccess('')
  }

  const closeResponseModal = () => {
    setShowResponseForm(false)
    setSelectedAssignment(null)
    setModalError('')
    setModalSuccess('')
  }

  const handleCancelRequest = async (requestId: string) => {
    setCancelling(true)
    try {
      await cancelProductAvailabilityRequest(requestId)
      setCancelConfirmId(null)
      await refreshData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel request')
    } finally {
      setCancelling(false)
    }
  }

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAssignment || !userFriendlyId) return
    setModalError('')
    setModalSuccess('')

    const needsDetails = responseForm.availability !== 'not_available'
    if (
      needsDetails &&
      responseForm.stockStatus !== 'bulk_limited_both' &&
      (!responseForm.singleUnitPrice || Number(responseForm.singleUnitPrice) < 0)
    ) {
      setModalError('Single unit price is required for this stock status.')
      return
    }
    if (needsDetails && responseForm.images.length === 0) {
      setModalError('Please upload at least one picture for response.')
      return
    }

    setSavingResponse(true)
    try {
      const imageUrls = await uploadFilesToStorage(userFriendlyId, responseForm.images)
      const isNotAvailable = responseForm.availability === 'not_available'
      await submitProductAvailabilityResponse({
        requestId: selectedAssignment.requestId,
        respondedByUserId: userFriendlyId,
        availability: responseForm.availability,
        stockStatus: isNotAvailable ? 'on_demand' : responseForm.stockStatus,
        singleUnitPrice: isNotAvailable ? null : responseForm.singleUnitPrice ? Number(responseForm.singleUnitPrice) : null,
        bulkUnitPrice:
          !isNotAvailable && responseForm.stockStatus === 'bulk_limited_both' && responseForm.bulkUnitPrice
            ? Number(responseForm.bulkUnitPrice)
            : null,
        responseImages: isNotAvailable ? [] : imageUrls,
        remarks: isNotAvailable ? null : responseForm.remarks,
      })
      closeResponseModal()
      await refreshData()
    } catch (err) {
      console.error(err)
      setModalError(err instanceof Error ? err.message : 'Failed to submit response')
    } finally {
      setSavingResponse(false)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Availability Requests</h1>
              <p className="text-sm text-gray-600 mt-1">Create and track market availability requests.</p>
            </div>

            {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
            {success && <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">{success}</div>}

            <div className={`grid grid-cols-3 ${canCreate ? 'sm:grid-cols-4 md:grid-cols-8' : 'sm:grid-cols-3 md:grid-cols-6'} gap-2`}>
              {canCreate && (
                <button onClick={() => setFilter('new')} className={`rounded-xl p-2.5 text-left border ${filter === 'new' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 bg-white'}`}>
                  <div className="text-[11px] text-gray-500 leading-tight">New</div>
                  <div className="text-lg font-bold">+</div>
                </button>
              )}
              {canCreate && (
                <button onClick={() => setFilter('drafts')} className={`rounded-xl p-2.5 text-left border ${filter === 'drafts' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                  <div className="text-[11px] text-gray-500 leading-tight">Drafts</div>
                  <div className="text-lg font-bold">{counts.drafts}</div>
                </button>
              )}
              <button onClick={() => setFilter('urgent')} className={`rounded-xl p-2.5 text-left border ${filter === 'urgent' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-[11px] text-gray-500 leading-tight">Urgent</div>
                <div className="text-lg font-bold">{counts.urgent}</div>
              </button>
              <button onClick={() => setFilter('normal_requests')} className={`rounded-xl p-2.5 text-left border ${filter === 'normal_requests' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-[11px] text-gray-500 leading-tight">Normal</div>
                <div className="text-lg font-bold">{counts.normalRequests}</div>
              </button>
              <button onClick={() => setFilter('delayed')} className={`rounded-xl p-2.5 text-left border ${filter === 'delayed' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-[11px] text-red-600 leading-tight">Delayed</div>
                <div className="text-lg font-bold text-red-700">{counts.delayed}</div>
              </button>
              <button onClick={() => setFilter('completed')} className={`rounded-xl p-2.5 text-left border ${filter === 'completed' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-[11px] text-gray-500 leading-tight">Completed</div>
                <div className="text-lg font-bold">{counts.completed}</div>
              </button>
              <button onClick={() => setFilter('cancelled')} className={`rounded-xl p-2.5 text-left border ${filter === 'cancelled' ? 'border-gray-500 bg-gray-100' : 'border-gray-200 bg-white'}`}>
                <div className="text-[11px] text-gray-500 leading-tight">Cancelled</div>
                <div className="text-lg font-bold text-gray-500">{counts.cancelled}</div>
              </button>
              <button onClick={() => setFilter('all')} className={`rounded-xl p-2.5 text-left border ${filter === 'all' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-[11px] text-gray-500 leading-tight">All</div>
                <div className="text-lg font-bold">{counts.all}</div>
              </button>
            </div>

            {canCreate && filter === 'new' && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">Create New Request</h2>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                    <button
                      type="button"
                      onClick={() => setNewTabMode('single')}
                      className={`px-4 py-1.5 ${newTabMode === 'single' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      Single
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTabMode('bulk')}
                      className={`px-4 py-1.5 border-l border-gray-200 ${newTabMode === 'bulk' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      Bulk Upload
                    </button>
                  </div>
                </div>

                {newTabMode === 'bulk' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Download Excel Template
                      </button>
                      <span className="text-xs text-gray-500">Fill in the template — dropdowns available for product_status and priority_level. Upload the filled file (.xlsx or .csv) below.</span>
                    </div>

                    {/* Valid options reference panel */}
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs space-y-1.5">
                      <div className="font-semibold text-blue-800">Valid Column Values</div>
                      <div className="text-blue-900">
                        <span className="font-medium">market:</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">UAE</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">KSA</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">PAK</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">QTR</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">KWT</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">OMN</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">BHR</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">IRQ</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">USA</span>
                        <span className="text-blue-600 ml-1">(one market per request)</span>
                      </div>
                      <div className="text-blue-900">
                        <span className="font-medium">product_status:</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">already_listed</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">not_listed</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">not_sure</span>
                      </div>
                      <div className="text-blue-900">
                        <span className="font-medium">priority_level:</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">urgent</span>{' '}
                        <span className="font-mono bg-white/70 px-1 rounded">normal</span>
                      </div>
                      <div className="text-blue-700 pt-0.5">
                        <span className="font-medium">remarks:</span> Optional free-text notes for this request.
                      </div>
                    </div>

                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => handleBulkCsvChange(e.target.files)}
                      className="block text-sm"
                    />

                    {bulkCsvRows.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-2 py-2 text-left text-gray-600">#</th>
                              <th className="px-2 py-2 text-left text-gray-600">Product</th>
                              <th className="px-2 py-2 text-left text-gray-600">Reseller</th>
                              <th className="px-2 py-2 text-left text-gray-600">Market</th>
                              <th className="px-2 py-2 text-left text-gray-600">SKU</th>
                              <th className="px-2 py-2 text-left text-gray-600">Status</th>
                              <th className="px-2 py-2 text-left text-gray-600">Priority</th>
                              <th className="px-2 py-2 text-left text-gray-600">Issues</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkCsvRows.map((row) => (
                              <tr
                                key={row.rowIndex}
                                className={`border-t ${row.errors.length > 0 ? 'bg-red-50' : 'bg-white'}`}
                              >
                                <td className="px-2 py-1.5 text-gray-500">{row.rowIndex}</td>
                                <td className="px-2 py-1.5">{row.product_name || '—'}</td>
                                <td className="px-2 py-1.5">{row.reseller_name || '—'}</td>
                                <td className="px-2 py-1.5">{row.market || '—'}</td>
                                <td className="px-2 py-1.5">{row.sku || '—'}</td>
                                <td className="px-2 py-1.5">{row.product_status || '—'}</td>
                                <td className="px-2 py-1.5">{row.priority_level || '—'}</td>
                                <td className="px-2 py-1.5 text-red-600">
                                  {row.errors.length > 0 ? row.errors.join('; ') : <span className="text-green-600">OK</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 border-t">
                          {bulkCsvRows.filter((r) => r.errors.length === 0).length} valid /{' '}
                          {bulkCsvRows.filter((r) => r.errors.length > 0).length} with errors
                        </div>
                      </div>
                    )}

                    {bulkImportResult && (
                      <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
                        {bulkImportResult.successCount} draft{bulkImportResult.successCount !== 1 ? 's' : ''} created.
                        {bulkImportResult.failedRows.length > 0 && ` Rows failed: ${bulkImportResult.failedRows.join(', ')}.`}
                        {' '}Open the Drafts tab to add photos and submit.
                      </div>
                    )}

                    {bulkCsvRows.length > 0 && bulkCsvRows.some((r) => r.errors.length === 0) && (
                      <button
                        type="button"
                        onClick={handleBulkImport}
                        disabled={bulkImporting}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {bulkImporting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {bulkImporting ? 'Importing…' : `Import ${bulkCsvRows.filter((r) => r.errors.length === 0).length} Valid Row(s) as Drafts`}
                      </button>
                    )}
                  </div>
                )}

                {newTabMode === 'single' && (
              <form onSubmit={handleCreateRequest} className="space-y-4">
                <p className="sr-only">Create New Request</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Product Status</label>
                    <select
                      value={createForm.productStatus}
                      onChange={(e) => setCreateForm((p) => ({ ...p, productStatus: e.target.value as CreateFormState['productStatus'] }))}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="already_listed">Already Listed</option>
                      <option value="not_listed">Not Listed</option>
                      <option value="not_sure">Not Sure</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Query Type</label>
                    <select
                      value={createForm.priorityLevel}
                      onChange={(e) => setCreateForm((p) => ({ ...p, priorityLevel: e.target.value as CreateFormState['priorityLevel'] }))}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="urgent">Urgent Requests</option>
                      <option value="normal">Normal Requests</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Market *</label>
                  <select
                    value={createForm.market}
                    onChange={(e) => setCreateForm((p) => ({ ...p, market: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    <option value="">Select a market…</option>
                    {MARKET_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input className="border rounded-lg px-3 py-2" placeholder="Reseller Name *" value={createForm.resellerName} onChange={(e) => setCreateForm((p) => ({ ...p, resellerName: e.target.value }))} />
                  <input className="border rounded-lg px-3 py-2" placeholder="Product Name *" value={createForm.productName} onChange={(e) => setCreateForm((p) => ({ ...p, productName: e.target.value }))} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    className="border rounded-lg px-3 py-2"
                    placeholder={createForm.productStatus === 'already_listed' ? 'SKU *' : 'SKU (optional)'}
                    value={createForm.sku}
                    onChange={(e) => setCreateForm((p) => ({ ...p, sku: e.target.value }))}
                  />
                  <input className="border rounded-lg px-3 py-2" placeholder="Reference Link (optional)" value={createForm.referenceLink} onChange={(e) => setCreateForm((p) => ({ ...p, referenceLink: e.target.value }))} />
                </div>

                <textarea
                  className="border rounded-lg px-3 py-2 w-full"
                  rows={2}
                  placeholder="Remarks (optional) — any notes or context about this request"
                  value={createForm.remarks}
                  onChange={(e) => setCreateForm((p) => ({ ...p, remarks: e.target.value }))}
                />

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCheckInventory}
                    disabled={isCheckingInventory || !createForm.sku.trim()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
                  >
                    {isCheckingInventory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Check Inventory
                  </button>
                  {inventoryError && <span className="text-sm text-amber-600">{inventoryError}</span>}
                </div>

                {inventoryLookup && (
                  <div className="border rounded-lg p-3 bg-gray-50">
                    <p className="text-sm text-gray-700 mb-2">
                      Matched prefix: <span className="font-semibold">{inventoryLookup.matchedPrefix || 'N/A'}</span> | Results: <span className="font-semibold">{inventoryLookup.totalMatches}</span>
                    </p>
                    <div className="space-y-2 max-h-56 overflow-auto">
                      {inventoryLookup.warehouseGroups.map((group) => (
                        <div key={group.warehouseName} className="bg-white border rounded-md p-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedWarehouses((prev) => ({
                                ...prev,
                                [group.warehouseName]: !prev[group.warehouseName],
                              }))
                            }
                            className="w-full flex items-center justify-between text-sm font-semibold text-left"
                          >
                            <span>{group.warehouseName} (Qty: {group.totalQuantity})</span>
                            <span className="text-xs text-blue-600">
                              {expandedWarehouses[group.warehouseName] ? 'Hide SKUs' : 'Show SKUs'}
                            </span>
                          </button>
                          {expandedWarehouses[group.warehouseName] && (
                            <div className="mt-2 max-h-28 overflow-y-auto border rounded p-2 bg-gray-50">
                              <ul className="text-xs text-gray-700 space-y-1">
                                {group.rows.map((row) => (
                                  <li key={`${group.warehouseName}-${row.sku}-${row.variant_id ?? ''}`}>
                                    {row.sku} ({row.quantity})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Pictures * (max 5)</label>
                  <input type="file" accept="image/*" multiple onChange={(e) => handleCreateImageChange(e.target.files)} />
                  <div className="text-xs text-gray-500 mt-1">{createForm.images.length}/5 selected</div>
                </div>

                <button type="submit" disabled={savingRequest} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50">
                  {savingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
                )}
              </div>
            )}

            {/* ── Drafts tab ────────────────────────────────────────────── */}
            {canCreate && filter === 'drafts' && (
              <div className="rounded-xl overflow-hidden border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-700">Drafts — Add Photos to Submit</span>
                  <span className="text-xs text-amber-600">({draftRequests.length} pending photo upload)</span>
                </div>
                {draftRequests.length === 0 && (
                  <p className="text-sm text-amber-600">No drafts yet. Use Bulk Upload in the New tab to create drafts.</p>
                )}
                {draftRequests.map((req) => (
                  <div key={req.id} className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="font-medium text-gray-900">{titleCaseWords(req.product_name)}</div>
                        <div className="text-xs text-gray-500">
                          {req.reseller_name} · {req.market || req.markets?.join(', ')} · {req.priority_level === 'urgent' ? 'Urgent' : 'Normal'}
                          {req.sku && ` · SKU: ${req.sku}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDraftPhotoOpen(draftPhotoOpen === req.id ? null : req.id)}
                        className="px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs hover:bg-amber-600"
                      >
                        {draftPhotoOpen === req.id ? 'Cancel' : 'Add Photos & Submit'}
                      </button>
                    </div>

                    {draftPhotoOpen === req.id && (
                      <div className="border-t border-amber-100 pt-2 space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Photos * (1–5 images)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleDraftPhotoChange(req.id, e.target.files)}
                            className="block text-sm"
                          />
                          {draftPhotoFiles[req.id]?.length ? (
                            <p className="text-xs text-gray-500 mt-1">{draftPhotoFiles[req.id].length}/5 selected</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={draftSubmitting === req.id}
                          onClick={() => handleSubmitDraft(req.id)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50"
                        >
                          {draftSubmitting === req.id && <Loader2 className="w-4 h-4 animate-spin" />}
                          {draftSubmitting === req.id ? 'Submitting…' : 'Submit to Purchaser'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isPurchaser && showResponseForm && selectedAssignment && (
              <div
                className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center sm:p-4"
                onClick={closeResponseModal}
              >
                <div
                  className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl bg-white max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <form onSubmit={handleSubmitResponse} className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">Submit Response</h2>
                      <button
                        type="button"
                        onClick={closeResponseModal}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {modalError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{modalError}</div>}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={responseForm.availability}
                        onChange={(e) => setResponseForm((p) => ({ ...p, availability: e.target.value as PurchaserResponseState['availability'] }))}
                        className="border rounded-lg px-3 py-2 w-full"
                      >
                        <option value="available">Available</option>
                        <option value="not_available">Not Available</option>
                        <option value="on_demand">On-Demand</option>
                        <option value="alternative">Alternative Option</option>
                      </select>
                      {responseForm.availability !== 'not_available' && (
                        <select
                          value={responseForm.stockStatus}
                          onChange={(e) => setResponseForm((p) => ({ ...p, stockStatus: e.target.value as PurchaserResponseState['stockStatus'] }))}
                          className="border rounded-lg px-3 py-2 w-full"
                        >
                          <option value="limited">Limited Quantity</option>
                          <option value="on_demand">On Demand</option>
                          <option value="bulk_limited_both">Normal Qty (Single/Bulk)</option>
                        </select>
                      )}
                    </div>

                    {/* Fields for all options except Not Available */}
                    {responseForm.availability !== 'not_available' && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            className="border rounded-lg px-3 py-2 w-full"
                            placeholder={responseForm.stockStatus === 'bulk_limited_both' ? 'Single Unit Price (optional)' : 'Single Unit Price *'}
                            type="number"
                            min="0"
                            step="0.01"
                            value={responseForm.singleUnitPrice}
                            onChange={(e) => setResponseForm((p) => ({ ...p, singleUnitPrice: e.target.value }))}
                          />
                          {responseForm.stockStatus === 'bulk_limited_both' && (
                            <input
                              className="border rounded-lg px-3 py-2 w-full"
                              placeholder="Bulk Unit Price (optional)"
                              type="number"
                              min="0"
                              step="0.01"
                              value={responseForm.bulkUnitPrice}
                              onChange={(e) => setResponseForm((p) => ({ ...p, bulkUnitPrice: e.target.value }))}
                            />
                          )}
                        </div>
                        <textarea
                          className="border rounded-lg px-3 py-2 w-full"
                          rows={2}
                          placeholder="Remarks (optional)"
                          value={responseForm.remarks}
                          onChange={(e) => setResponseForm((p) => ({ ...p, remarks: e.target.value }))}
                        />
                        <div>
                          <label className="block text-sm font-medium mb-1">Pictures * (max 5)</label>
                          <input type="file" accept="image/*" multiple onChange={(e) => handleResponseImageChange(e.target.files)} className="block text-sm" />
                          <div className="text-xs text-gray-500 mt-1">{responseForm.images.length}/5 selected</div>
                        </div>
                      </>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={savingResponse}
                        className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {savingResponse && <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
                        {savingResponse ? 'Submitting...' : 'Submit Response'}
                      </button>
                      <button
                        type="button"
                        onClick={closeResponseModal}
                        className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {filter !== 'new' && filter !== 'drafts' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by request ID, seller name, product, SKU, or market…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            )}

            {filter !== 'new' && filter !== 'drafts' && (() => {
              if (displayedRequests.length === 0) {
                return (
                  <div className="rounded-xl border border-white/10 px-4 py-10 text-center text-white/60 text-sm"
                    style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)' }}>
                    {searchQuery.trim() ? 'No requests match your search.' : 'No requests found for this tab.'}
                  </div>
                )
              }

              const statusClass = (s: string) =>
                s === 'delayed' ? 'bg-red-100 text-red-700'
                : s === 'completed' ? 'bg-green-100 text-green-700'
                : s === 'cancelled' ? 'bg-gray-200 text-gray-600'
                : 'bg-yellow-100 text-yellow-700'

              return (
                <>
                  {/* ── Top pagination bar ── */}
                  {paTotalPages > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/10 mb-2"
                      style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)' }}>
                      <span className="text-xs text-white/60">
                        Showing {((paCurrentPage - 1) * PA_ITEMS) + 1}–{Math.min(paCurrentPage * PA_ITEMS, displayedRequests.length)} of {displayedRequests.length} requests
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPaCurrentPage(1)} disabled={paCurrentPage === 1}
                          className="px-2 py-1 rounded text-xs text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          « First
                        </button>
                        <button onClick={() => setPaCurrentPage(p => Math.max(1, p - 1))} disabled={paCurrentPage === 1}
                          className="px-2 py-1 rounded text-xs text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          ‹ Prev
                        </button>
                        <span className="px-3 py-1 rounded bg-white/10 text-white text-xs font-medium">
                          {paCurrentPage} / {paTotalPages}
                        </span>
                        <button onClick={() => setPaCurrentPage(p => Math.min(paTotalPages, p + 1))} disabled={paCurrentPage >= paTotalPages}
                          className="px-2 py-1 rounded text-xs text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          Next ›
                        </button>
                        <button onClick={() => setPaCurrentPage(paTotalPages)} disabled={paCurrentPage >= paTotalPages}
                          className="px-2 py-1 rounded text-xs text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          Last »
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Mobile cards (hidden on md+) ── */}
                  <div className="md:hidden space-y-3">
                    {paginatedDisplayed.map((request) => {
                      const canRespond = isPurchaser && request.assignment_status === 'pending'
                      const noMapping = !request.assigned_purchaser_user_id
                      const thumb = getRequestThumbnail(request)
                      return (
                        <div
                          key={request.id}
                          className="rounded-xl border border-white/10 p-3 space-y-2"
                          style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)' }}
                        >
                          {/* Top row: thumbnail + name + req no + status */}
                          <div className="flex items-start gap-3">
                            {thumb && (
                              <button type="button" onClick={() => { setViewerImageUrl(thumb); setIsImageViewerOpen(true) }} className="shrink-0">
                                <img src={thumb} alt={request.product_name} className="w-12 h-12 rounded-lg object-cover" />
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="font-semibold text-white text-sm leading-tight">{titleCaseWords(request.product_name)}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs shrink-0 ${statusClass(request.derived_status)}`}>
                                  {formatDerivedStatusLabel(request.derived_status)}
                                </span>
                              </div>
                              {request.request_number && (
                                <div className="text-xs text-white/40 font-mono">#{request.request_number}</div>
                              )}
                              {request.sku && <div className="text-xs text-white/60">SKU: {request.sku.toUpperCase()}</div>}
                              {request.reference_link && (
                                <div className="text-xs text-blue-400 truncate">
                                  <a href={request.reference_link} target="_blank" rel="noreferrer">{request.reference_link}</a>
                                </div>
                              )}
                              {request.remarks && <div className="text-xs text-white/50 italic">{request.remarks}</div>}
                            </div>
                          </div>

                          {/* Middle: reseller + market (non-purchaser) */}
                          {!isPurchaser && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
                              <span><span className="text-white/40">Reseller:</span> {titleCaseWords(request.reseller_name)}</span>
                              <span><span className="text-white/40">Market:</span> {request.market || request.markets?.join(', ')}</span>
                            </div>
                          )}
                          {noMapping && (
                            <div className="text-xs text-amber-500">No purchaser mapped for {request.market || 'this market'}</div>
                          )}

                          {/* Bottom: date + action */}
                          <div className="flex items-center justify-between pt-1 border-t border-white/10">
                            <span className="text-xs text-white/40">{new Date(request.created_at).toLocaleDateString()}</span>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                              {isPurchaser && (
                                canRespond
                                  ? <button onClick={() => openRespondForm(request.id)} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium">Respond</button>
                                  : <span className="text-xs text-white/50">{request.assignment_status === 'completed' ? 'Responded' : 'No pending assignment'}</span>
                              )}
                              {(canCreate || isManager) && request.derived_status === 'completed' && (
                                <button type="button" onClick={() => setSelectedFeedbackRequest(request)} className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium">See Feedback</button>
                              )}
                              {!isPurchaser && request.derived_status !== 'completed' && request.derived_status !== 'cancelled' && (
                                cancelConfirmId === request.id
                                  ? <span className="flex items-center gap-1">
                                      <span className="text-xs text-white/70">Cancel?</span>
                                      <button disabled={cancelling} onClick={() => handleCancelRequest(request.id)} className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-50">Yes</button>
                                      <button onClick={() => setCancelConfirmId(null)} className="px-2 py-1 rounded bg-white/10 text-white text-xs">No</button>
                                    </span>
                                  : <button onClick={() => setCancelConfirmId(request.id)} className="px-3 py-1.5 rounded-lg bg-gray-600 text-white text-xs">Cancel Request</button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Desktop table (hidden below md) ── */}
                  <div
                    className="hidden md:block rounded-xl overflow-hidden border border-white/10"
                    style={{
                      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.25)',
                    }}
                  >
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-white/5">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-white/70">Request No.</th>
                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70">Product</th>
                            {!isPurchaser && <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70">Reseller</th>}
                            {!isPurchaser && <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70">Market</th>}
                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70">Status</th>
                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70">Created</th>
                            {isPurchaser && <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70">Action</th>}
                            {(canCreate || isManager) && <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70">Feedback</th>}
                            {!isPurchaser && <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/70">Cancel</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedDisplayed.map((request) => {
                            const created = new Date(request.created_at).toLocaleString()
                            const canRespond = isPurchaser && request.assignment_status === 'pending'
                            const noMapping = !request.assigned_purchaser_user_id
                            return (
                              <tr key={request.id} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                                <td className="px-3 py-2 text-white/50 text-sm font-mono whitespace-nowrap">
                                  {request.request_number ? `#${request.request_number}` : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-3">
                                    {getRequestThumbnail(request) ? (
                                      <button type="button" onClick={() => { setViewerImageUrl(getRequestThumbnail(request)); setIsImageViewerOpen(true) }} className="hover:opacity-80 transition-opacity">
                                        <img src={getRequestThumbnail(request) || ''} alt={request.product_name} className="w-10 h-10 rounded-lg object-cover" />
                                      </button>
                                    ) : null}
                                    <div>
                                      <div className="font-medium text-white">{titleCaseWords(request.product_name)}</div>
                                      {request.sku && <div className="text-xs text-white/60">SKU: {request.sku.toUpperCase()}</div>}
                                      {request.reference_link && (
                                        <div className="text-xs text-blue-400 max-w-[240px] truncate">
                                          <a href={request.reference_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{request.reference_link}</a>
                                        </div>
                                      )}
                                      {request.remarks && <div className="text-xs text-white/55 italic mt-0.5 max-w-[240px]">{request.remarks}</div>}
                                    </div>
                                  </div>
                                  {noMapping && (
                                    <div className="text-xs text-amber-700 mt-1">No purchaser mapped for {request.market || 'this market'}</div>
                                  )}
                                </td>
                                {!isPurchaser && <td className="px-3 py-2 text-white">{titleCaseWords(request.reseller_name)}</td>}
                                {!isPurchaser && <td className="px-3 py-2 text-white">{request.market || request.markets?.join(', ')}</td>}
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-1 rounded-full text-xs ${statusClass(request.derived_status)}`}>
                                    {formatDerivedStatusLabel(request.derived_status)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-white/80">{created}</td>
                                {isPurchaser && (
                                  <td className="px-3 py-2">
                                    {canRespond
                                      ? <button onClick={() => openRespondForm(request.id)} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs">Respond</button>
                                      : <span className="text-xs text-white/60">{request.assignment_status === 'completed' ? 'Responded' : 'No pending assignment'}</span>}
                                  </td>
                                )}
                                {(canCreate || isManager) && (
                                  <td className="px-3 py-2">
                                    {request.derived_status === 'completed'
                                      ? <button type="button" onClick={() => setSelectedFeedbackRequest(request)} className="px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs">See Feedback</button>
                                      : <span className="text-xs text-white/60">-</span>}
                                  </td>
                                )}
                                {!isPurchaser && (
                                  <td className="px-3 py-2">
                                    {request.derived_status !== 'completed' && request.derived_status !== 'cancelled'
                                      ? cancelConfirmId === request.id
                                        ? <span className="flex items-center gap-1">
                                            <button disabled={cancelling} onClick={() => handleCancelRequest(request.id)} className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-50">Confirm</button>
                                            <button onClick={() => setCancelConfirmId(null)} className="px-2 py-1 rounded bg-white/10 text-white text-xs">No</button>
                                          </span>
                                        : <button onClick={() => setCancelConfirmId(request.id)} className="px-3 py-1.5 rounded-md bg-gray-600 text-white text-xs">Cancel</button>
                                      : <span className="text-xs text-white/40">—</span>}
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <Pagination
                    currentPage={paCurrentPage}
                    totalPages={paTotalPages}
                    totalItems={displayedRequests.length}
                    onPageChange={setPaCurrentPage}
                  />
                </>
              )
            })()}

            {isImageViewerOpen && viewerImageUrl && (
              <div
                className="fixed inset-0 bg-black/80 z-[90] flex items-center justify-center p-4"
                onClick={() => {
                  setIsImageViewerOpen(false)
                  setViewerImageUrl(null)
                }}
              >
                <div className="relative max-w-3xl w-full flex justify-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsImageViewerOpen(false)
                      setViewerImageUrl(null)
                    }}
                    className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <img src={viewerImageUrl} alt="Product preview" className="max-h-[80vh] w-auto rounded-xl object-contain" />
                </div>
              </div>
            )}

            {selectedFeedbackRequest && (
              <div
                className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center sm:p-4"
                onClick={() => { setSelectedFeedbackRequest(null); setShowAltSearch(false); setAltSearchError('') }}
              >
                <div
                  className="w-full sm:max-w-4xl rounded-t-2xl sm:rounded-xl border border-white/10 max-h-[90vh] overflow-y-auto"
                  style={{
                    background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Purchaser Feedback</h3>
                    <button
                      type="button"
                      onClick={() => { setSelectedFeedbackRequest(null); setShowAltSearch(false); setAltSearchError('') }}
                      className="p-1 text-white/70 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="text-white font-medium">{selectedFeedbackRequest.product_name}</div>
                    <div className="text-xs text-white/50">
                      Market: {selectedFeedbackRequest.market || selectedFeedbackRequest.markets?.join(', ')}
                      {selectedFeedbackRequest.remarks && <span className="ml-3 italic">Remarks: {selectedFeedbackRequest.remarks}</span>}
                    </div>

                    {/* Latest response */}
                    <div className="border border-white/10 rounded-lg p-3 bg-white/5">
                      <div className="text-xs font-semibold text-white/50 uppercase mb-2">
                        Latest Response
                        {selectedFeedbackRequest.response && ` — Round ${selectedFeedbackRequest.response.round_number}`}
                      </div>
                      {!selectedFeedbackRequest.response ? (
                        <div className="text-xs text-white/60">No feedback submitted yet.</div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          {Array.isArray(selectedFeedbackRequest.response.response_images) &&
                            selectedFeedbackRequest.response.response_images.length > 0 && (
                              <div>
                                <div className="text-white/90 mb-1">Pictures:</div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {selectedFeedbackRequest.response.response_images.map((img, idx) => (
                                    <button
                                      type="button"
                                      key={idx}
                                      onClick={() => { setViewerImageUrl(String(img)); setIsImageViewerOpen(true) }}
                                      className="hover:opacity-80"
                                    >
                                      <img src={String(img)} alt="Feedback" className="w-20 h-20 rounded object-cover" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          <div className="text-white/90">Availability: <span className="text-white">{formatAvailabilityLabel(selectedFeedbackRequest.response.availability)}</span></div>
                          <div className="text-white/90">Stock Status: <span className="text-white">{formatStockStatusLabel(selectedFeedbackRequest.response.stock_status)}</span></div>
                          <div className="text-white/90">Single Unit Price: <span className="text-white">{selectedFeedbackRequest.response.single_unit_price ?? 'N/A'}</span></div>
                          <div className="text-white/90">Bulk Unit Price: <span className="text-white">{selectedFeedbackRequest.response.bulk_unit_price ?? 'N/A'}</span></div>
                          <div className="text-white/90">Remarks: <span className="text-white">{selectedFeedbackRequest.response.remarks || 'N/A'}</span></div>
                          <div className="text-white/40 text-xs">{new Date(selectedFeedbackRequest.response.created_at).toLocaleString()}</div>
                        </div>
                      )}
                    </div>

                    {/* Response history (older rounds) */}
                    {selectedFeedbackRequest.responseHistory.length > 1 && (
                      <details className="border border-white/10 rounded-lg bg-white/5">
                        <summary className="px-3 py-2 text-xs font-semibold text-white/50 cursor-pointer select-none">
                          Previous Rounds ({selectedFeedbackRequest.responseHistory.length - 1})
                        </summary>
                        <div className="divide-y divide-white/10">
                          {selectedFeedbackRequest.responseHistory.slice(1).map((r) => (
                            <div key={r.id} className="px-3 py-2 text-xs space-y-1">
                              <div className="text-white/50 font-semibold">Round {r.round_number} — {new Date(r.created_at).toLocaleString()}</div>
                              <div className="text-white/70">Availability: {formatAvailabilityLabel(r.availability)}</div>
                              {r.remarks && <div className="text-white/60 italic">Remarks: {r.remarks}</div>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Search Alternative section (agents only, when latest response is not_available) */}
                    {isAgent && selectedFeedbackRequest.response?.availability === 'not_available' &&
                      selectedFeedbackRequest.assignment_status !== 'pending' && (
                      <div className="border border-amber-500/30 rounded-lg p-3 bg-amber-500/10 space-y-3">
                        <div className="text-sm font-semibold text-amber-300">Search Alternative Product</div>
                        <p className="text-xs text-amber-200/70">
                          Re-send this request to the purchaser with updated remarks. The purchaser will see the previous response history and your new notes.
                        </p>
                        {!showAltSearch ? (
                          <button
                            type="button"
                            onClick={() => { setShowAltSearch(true); setAltSearchRemarks(selectedFeedbackRequest.remarks || '') }}
                            className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600"
                          >
                            Search Alternative Product
                          </button>
                        ) : (
                          <div className="space-y-2">
                            {altSearchError && <div className="text-xs text-red-400">{altSearchError}</div>}
                            <textarea
                              rows={3}
                              className="w-full rounded-lg px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400"
                              placeholder="Updated remarks for the purchaser…"
                              value={altSearchRemarks}
                              onChange={(e) => setAltSearchRemarks(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={altSearchSaving}
                                onClick={async () => {
                                  if (!altSearchRemarks.trim()) { setAltSearchError('Please add updated remarks.'); return }
                                  setAltSearchSaving(true)
                                  setAltSearchError('')
                                  try {
                                    await requestAlternativeSearch(selectedFeedbackRequest.id, altSearchRemarks)
                                    setSelectedFeedbackRequest(null)
                                    setShowAltSearch(false)
                                    await refreshData()
                                  } catch (err) {
                                    setAltSearchError(err instanceof Error ? err.message : 'Failed to re-send request')
                                  } finally {
                                    setAltSearchSaving(false)
                                  }
                                }}
                                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm disabled:opacity-50"
                              >
                                {altSearchSaving ? 'Sending…' : 'Confirm & Re-send'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowAltSearch(false); setAltSearchError('') }}
                                className="px-4 py-2 rounded-lg border border-white/20 text-white/70 text-sm hover:bg-white/10"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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

