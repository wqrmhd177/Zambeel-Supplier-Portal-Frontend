import { supabase } from './supabase'

export type ProductAvailabilityStatus = 'pending' | 'delayed' | 'completed'
export type ProductStatusInput = 'already_listed' | 'not_listed' | 'not_sure'
export type PriorityLevel = 'urgent' | 'normal'
export type AvailabilityOption = 'available' | 'not_available' | 'on_demand'
export type StockStatusOption = 'limited' | 'on_demand' | 'bulk_limited_both'

export interface ProductAvailabilityRequest {
  id: string
  request_number?: number
  requested_by_user_id: string
  requested_by_role: string
  product_status: ProductStatusInput
  markets: string[]
  reseller_name: string
  product_name: string
  sku: string | null
  reference_link: string | null
  remarks: string | null
  priority_level: PriorityLevel
  request_images: string[]
  inventory_matches: unknown[]
  status: ProductAvailabilityStatus
  is_draft: boolean
  created_at: string
  updated_at: string
}

export interface ProductAvailabilityAssignment {
  id: string
  request_id: string
  market: string
  assigned_purchaser_user_id: string | null
  assignment_status: 'pending' | 'completed'
  responded_at: string | null
  created_at: string
  updated_at: string
}

export interface ProductAvailabilityResponse {
  id: string
  request_id: string
  assignment_id: string
  responded_by_user_id: string
  availability: AvailabilityOption
  stock_status: StockStatusOption
  single_unit_price: number | null
  bulk_unit_price: number | null
  response_images: string[]
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface ProductAvailabilityRequestWithDetails extends ProductAvailabilityRequest {
  derived_status: ProductAvailabilityStatus
  assignments: ProductAvailabilityAssignment[]
  responsesByAssignmentId: Record<string, ProductAvailabilityResponse>
}

export interface CreateProductAvailabilityInput {
  requestedByUserId: string
  requestedByRole: string
  productStatus: ProductStatusInput
  markets: string[]
  resellerName: string
  productName: string
  sku?: string | null
  referenceLink?: string | null
  remarks?: string | null
  priorityLevel: PriorityLevel
  requestImages: string[]
  inventoryMatches?: unknown[]
  isDraft?: boolean
}

/** One row parsed from agent's bulk-upload CSV */
export interface BulkUploadRow {
  product_name: string
  reseller_name: string
  markets: string[]
  sku: string
  reference_link: string
  product_status: ProductStatusInput
  priority_level: PriorityLevel
  remarks: string
}

/** Validation result for a single parsed CSV row */
export interface BulkUploadRowValidated extends BulkUploadRow {
  rowIndex: number
  errors: string[]
}

export interface SubmitProductAvailabilityResponseInput {
  assignmentId: string
  requestId: string
  respondedByUserId: string
  availability: AvailabilityOption
  stockStatus: StockStatusOption
  singleUnitPrice?: number | null
  bulkUnitPrice?: number | null
  responseImages: string[]
  remarks?: string | null
}

const MARKET_TO_COUNTRY_KEYWORDS: Record<string, string[]> = {
  UAE: ['UAE', 'UNITED ARAB EMIRATES'],
  KSA: ['KSA', 'SAUDI', 'SAUDI ARABIA'],
  PAK: ['PAK', 'PAKISTAN', 'KARACHI'],
  QTR: ['QTR', 'QATAR'],
  KWT: ['KWT', 'KUWAIT'],
  OMN: ['OMN', 'OMAN'],
  BHR: ['BHR', 'BAHRAIN'],
  IRQ: ['IRQ', 'IRAQ'],
  USA: ['USA', 'UNITED STATES', 'US'],
}

function normalizeMarket(market: string): string {
  return market.trim().toUpperCase()
}

function deriveStatus(status: ProductAvailabilityStatus, createdAt: string): ProductAvailabilityStatus {
  if (status === 'completed') return 'completed'
  const createdMs = new Date(createdAt).getTime()
  const nowMs = Date.now()
  const elapsedHours = (nowMs - createdMs) / (1000 * 60 * 60)
  return elapsedHours >= 48 ? 'delayed' : 'pending'
}

/**
 * Tab filters — each open request appears in exactly one tab:
 * - draft: is_draft = true (only visible to the agent who created it)
 * - urgent_open: urgent priority, still within 48h (derived pending), not draft
 * - normal_pending: normal priority, still within 48h (derived pending), not draft
 * - delayed: past 48h for any priority (normal or urgent); never also in urgent/normal tabs
 * - completed, all: standard
 */
export type ProductAvailabilityListFilter =
  | 'all'
  | 'completed'
  | 'delayed'
  | 'urgent_open'
  | 'normal_pending'
  | 'draft'

function matchesProductAvailabilityListFilter(
  row: ProductAvailabilityRequestWithDetails,
  filter: ProductAvailabilityListFilter
): boolean {
  if (filter === 'draft') return row.is_draft === true
  // All non-draft filters exclude drafts
  if (row.is_draft) return filter === 'all' ? false : false
  if (filter === 'all') return true
  const priority = row.priority_level as PriorityLevel
  if (filter === 'completed') return row.derived_status === 'completed'
  if (filter === 'delayed') return row.derived_status === 'delayed'
  if (filter === 'urgent_open') return priority === 'urgent' && row.derived_status === 'pending'
  if (filter === 'normal_pending') return priority === 'normal' && row.derived_status === 'pending'
  return false
}

export function formatDerivedStatusLabel(status: ProductAvailabilityStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'delayed':
      return 'Delayed'
    case 'completed':
      return 'Completed'
    default:
      return status
  }
}

export function formatAvailabilityLabel(av: AvailabilityOption): string {
  switch (av) {
    case 'available':
      return 'Available'
    case 'not_available':
      return 'Not Available'
    case 'on_demand':
      return 'On Demand'
    default:
      return av
  }
}

/** Labels shown to agents in feedback; purchaser form uses the same values with purchaser-specific wording for stock types */
export function formatStockStatusLabel(stock: StockStatusOption): string {
  switch (stock) {
    case 'limited':
      return 'Limited Quantity'
    case 'on_demand':
      return 'On Demand'
    case 'bulk_limited_both':
      return 'Normal Qty (Single/Bulk)'
    default:
      return stock
  }
}

export function titleCaseWords(input: string): string {
  if (!input || !input.trim()) return input
  return input
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function countryMatchesMarket(market: string, country: string | null | undefined): boolean {
  if (!country) return false
  const normalizedCountry = country.trim().toUpperCase()
  const keywords = MARKET_TO_COUNTRY_KEYWORDS[market] || [market]
  return keywords.some((keyword) => normalizedCountry.includes(keyword))
}

async function maybeSyncDelayedRequests(): Promise<void> {
  const thresholdIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('product_availability_requests')
    .update({ status: 'delayed' })
    .eq('status', 'pending')
    .lte('created_at', thresholdIso)
}

async function refreshRequestStatus(requestId: string): Promise<void> {
  const { data: assignments } = await supabase
    .from('product_availability_request_markets')
    .select('assignment_status, assigned_purchaser_user_id')
    .eq('request_id', requestId)

  // Only count assignments that have an actual purchaser assigned.
  // Markets with no purchaser (null) will never complete on their own, so
  // they should not block the request from being marked as completed.
  const responsibleAssignments = (assignments || []).filter(
    (a) => a.assigned_purchaser_user_id !== null && a.assigned_purchaser_user_id !== undefined
  )

  const allCompleted =
    responsibleAssignments.length > 0 &&
    responsibleAssignments.every((a) => a.assignment_status === 'completed')

  if (allCompleted) {
    await supabase
      .from('product_availability_requests')
      .update({ status: 'completed' })
      .eq('id', requestId)
    return
  }

  const { data: requestRow } = await supabase
    .from('product_availability_requests')
    .select('created_at, status')
    .eq('id', requestId)
    .single()

  if (!requestRow) return
  const next = deriveStatus('pending', requestRow.created_at)
  await supabase
    .from('product_availability_requests')
    .update({ status: next })
    .eq('id', requestId)
}

/**
 * Proactively mark requests as completed if all assigned-purchaser assignments
 * are done. Catches cases where refreshRequestStatus was skipped (e.g. old data).
 */
async function maybeSyncCompletedRequests(): Promise<void> {
  // Find all non-draft requests still in pending/delayed state
  const { data: openRequests } = await supabase
    .from('product_availability_requests')
    .select('id')
    .in('status', ['pending', 'delayed'])
    .eq('is_draft', false)

  if (!openRequests || openRequests.length === 0) return

  const openIds = openRequests.map((r: any) => r.id)

  // Fetch all their assignments in one query
  const { data: allAssignments } = await supabase
    .from('product_availability_request_markets')
    .select('request_id, assignment_status, assigned_purchaser_user_id')
    .in('request_id', openIds)

  if (!allAssignments || allAssignments.length === 0) return

  // Group by request
  const byRequest = new Map<string, typeof allAssignments>()
  for (const a of allAssignments) {
    const existing = byRequest.get(a.request_id) || []
    existing.push(a)
    byRequest.set(a.request_id, existing)
  }

  const nowCompleted: string[] = []
  byRequest.forEach((assigns, requestId) => {
    const responsible = assigns.filter(
      (a) => a.assigned_purchaser_user_id !== null && a.assigned_purchaser_user_id !== undefined
    )
    if (responsible.length > 0 && responsible.every((a) => a.assignment_status === 'completed')) {
      nowCompleted.push(requestId)
    }
  })

  if (nowCompleted.length > 0) {
    await supabase
      .from('product_availability_requests')
      .update({ status: 'completed' })
      .in('id', nowCompleted)
  }
}

export async function createProductAvailabilityRequest(
  input: CreateProductAvailabilityInput
): Promise<ProductAvailabilityRequest | null> {
  const isDraft = input.isDraft === true
  const normalizedMarkets = Array.from(
    new Set(input.markets.map(normalizeMarket).filter(Boolean))
  )

  if (normalizedMarkets.length === 0) {
    throw new Error('At least one market is required')
  }
  if (!isDraft && (input.requestImages.length === 0 || input.requestImages.length > 5)) {
    throw new Error('Request images must contain between 1 and 5 files')
  }
  if (input.productStatus === 'already_listed' && !String(input.sku || '').trim()) {
    throw new Error('SKU is required when product status is Already Listed')
  }

  const { data: createdRequest, error: requestError } = await supabase
    .from('product_availability_requests')
    .insert([
      {
        requested_by_user_id: input.requestedByUserId,
        requested_by_role: input.requestedByRole,
        product_status: input.productStatus,
        markets: normalizedMarkets,
        reseller_name: input.resellerName.trim(),
        product_name: input.productName.trim(),
        sku: input.sku?.trim() || null,
        reference_link: input.referenceLink?.trim() || null,
        remarks: input.remarks?.trim() || null,
        priority_level: input.priorityLevel,
        request_images: isDraft ? [] : input.requestImages,
        inventory_matches: input.inventoryMatches || [],
        status: 'pending',
        is_draft: isDraft,
      },
    ])
    .select('*')
    .single<ProductAvailabilityRequest>()

  if (requestError || !createdRequest) {
    throw new Error(requestError?.message || 'Failed to create product availability request')
  }

  const { data: purchasers } = await supabase
    .from('users')
    .select('user_id, country, stock_location_country')
    .eq('role', 'purchaser')

  const assignmentsToInsert: Array<{
    request_id: string
    market: string
    assigned_purchaser_user_id: string | null
    assignment_status: 'pending'
  }> = []

  normalizedMarkets.forEach((market) => {
    const matchingPurchasers = (purchasers || []).filter((p: any) =>
      countryMatchesMarket(market, p.country || p.stock_location_country)
    )

    if (matchingPurchasers.length === 0) {
      assignmentsToInsert.push({
        request_id: createdRequest.id,
        market,
        assigned_purchaser_user_id: null,
        assignment_status: 'pending',
      })
      return
    }

    matchingPurchasers.forEach((p: any) => {
      assignmentsToInsert.push({
        request_id: createdRequest.id,
        market,
        assigned_purchaser_user_id: String(p.user_id || ''),
        assignment_status: 'pending',
      })
    })
  })

  const { error: assignmentError } = await supabase
    .from('product_availability_request_markets')
    .insert(assignmentsToInsert)

  if (assignmentError) {
    throw new Error(assignmentError.message || 'Failed to create market assignments')
  }

  return createdRequest
}

export async function fetchProductAvailabilityRequests(params: {
  userRole: string
  userFriendlyId: string
  statusFilter: ProductAvailabilityListFilter
}): Promise<ProductAvailabilityRequestWithDetails[]> {
  await Promise.all([maybeSyncDelayedRequests(), maybeSyncCompletedRequests()])

  const role = (params.userRole || '').toLowerCase()
  let requestIdsForPurchaser: string[] = []

  if (role === 'purchaser') {
    const { data: assignedRows, error: assignedError } = await supabase
      .from('product_availability_request_markets')
      .select('request_id')
      .eq('assigned_purchaser_user_id', params.userFriendlyId)

    if (assignedError) {
      throw new Error(assignedError.message || 'Failed to fetch purchaser assignments')
    }
    requestIdsForPurchaser = Array.from(
      new Set((assignedRows || []).map((row: any) => row.request_id))
    )
    if (requestIdsForPurchaser.length === 0) return []
  }

  let requestQuery = supabase
    .from('product_availability_requests')
    .select('*')
    .order('created_at', { ascending: true })

  if (role === 'agent') {
    requestQuery = requestQuery.eq('requested_by_user_id', params.userFriendlyId)
  } else if (role === 'purchaser') {
    // Purchasers never see draft requests
    requestQuery = requestQuery.in('id', requestIdsForPurchaser).eq('is_draft', false)
  } else {
    // Admin and other roles: exclude drafts from normal views
    if (params.statusFilter !== 'draft') {
      requestQuery = requestQuery.eq('is_draft', false)
    }
  }

  const { data: requestRows, error: requestError } = await requestQuery
  if (requestError) {
    throw new Error(requestError.message || 'Failed to fetch availability requests')
  }

  const requestIds = (requestRows || []).map((row: any) => row.id)
  if (requestIds.length === 0) return []

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from('product_availability_request_markets')
    .select('*')
    .in('request_id', requestIds)

  if (assignmentError) {
    throw new Error(assignmentError.message || 'Failed to fetch request assignments')
  }

  const assignmentIds = (assignmentRows || []).map((row: any) => row.id)
  const { data: responseRows, error: responseError } = await supabase
    .from('product_availability_responses')
    .select('*')
    .in('assignment_id', assignmentIds.length > 0 ? assignmentIds : ['00000000-0000-0000-0000-000000000000'])

  if (responseError && assignmentIds.length > 0) {
    throw new Error(responseError.message || 'Failed to fetch availability responses')
  }

  const assignmentsByRequest = new Map<string, ProductAvailabilityAssignment[]>()
  ;(assignmentRows || []).forEach((row: any) => {
    const existing = assignmentsByRequest.get(row.request_id) || []
    existing.push(row)
    assignmentsByRequest.set(row.request_id, existing)
  })

  const responsesByAssignmentId: Record<string, ProductAvailabilityResponse> = {}
  ;(responseRows || []).forEach((row: any) => {
    responsesByAssignmentId[row.assignment_id] = row
  })

  const withDerived = (requestRows || [])
    .map((request: any) => {
      const assignments = assignmentsByRequest.get(request.id) || []

      // Derive completion from assignments directly — never rely solely on the DB
      // status field, which may lag behind due to RLS preventing updates by
      // purchaser/agent roles.
      const responsibleAssignments = assignments.filter(
        (a: any) => a.assigned_purchaser_user_id !== null && a.assigned_purchaser_user_id !== undefined
      )
      const allResponsibleDone =
        responsibleAssignments.length > 0 &&
        responsibleAssignments.every((a: any) => a.assignment_status === 'completed')

      // #region agent log
      if (responsibleAssignments.length > 0) {
        fetch('http://127.0.0.1:7744/ingest/cf8ad616-2757-428a-b0c7-1ddd68a3b548',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a8deff'},body:JSON.stringify({sessionId:'a8deff',location:'productAvailabilityHelpers.ts:derive-status',message:'deriving status for request',data:{requestId:request.id,requestNumber:request.request_number,dbStatus:request.status,totalAssignments:assignments.length,responsibleCount:responsibleAssignments.length,allResponsibleDone,assignmentStatuses:responsibleAssignments.map((a:any)=>({id:a.id,status:a.assignment_status,purchaserId:a.assigned_purchaser_user_id}))},timestamp:Date.now(),hypothesisId:'H-B,H-C'})}).catch(()=>{})
      }
      // #endregion

      const derived: ProductAvailabilityStatus = allResponsibleDone
        ? 'completed'
        : deriveStatus(request.status, request.created_at)

      const responsesMapForRequest: Record<string, ProductAvailabilityResponse> = {}
      assignments.forEach((assignment) => {
        const response = responsesByAssignmentId[assignment.id]
        if (response) responsesMapForRequest[assignment.id] = response
      })
      return {
        ...request,
        derived_status: derived,
        assignments,
        responsesByAssignmentId: responsesMapForRequest,
      } as ProductAvailabilityRequestWithDetails
    })
    .filter((row) => matchesProductAvailabilityListFilter(row, params.statusFilter))

  if (role === 'purchaser') {
    return withDerived.map((row) => ({
      ...row,
      assignments: row.assignments.filter(
        (assignment) => assignment.assigned_purchaser_user_id === params.userFriendlyId
      ),
    }))
  }

  return withDerived
}

export async function submitProductAvailabilityResponse(
  input: SubmitProductAvailabilityResponseInput
): Promise<boolean> {
  if (
    input.availability !== 'not_available' &&
    (input.responseImages.length === 0 || input.responseImages.length > 5)
  ) {
    throw new Error('Response images must contain between 1 and 5 files')
  }
  const singleUnitPrice =
    input.singleUnitPrice === null || input.singleUnitPrice === undefined
      ? null
      : Number(input.singleUnitPrice)
  const bulkUnitPrice =
    input.bulkUnitPrice === null || input.bulkUnitPrice === undefined
      ? null
      : Number(input.bulkUnitPrice)

  if (
    input.availability !== 'not_available' &&
    input.stockStatus !== 'bulk_limited_both' &&
    (singleUnitPrice === null || Number.isNaN(singleUnitPrice))
  ) {
    throw new Error('Single unit price is required for this stock status')
  }

  const payload = {
    request_id: input.requestId,
    assignment_id: input.assignmentId,
    responded_by_user_id: input.respondedByUserId,
    availability: input.availability,
    stock_status: input.availability === 'not_available' ? 'on_demand' : input.stockStatus,
    single_unit_price: input.availability === 'not_available' ? null : singleUnitPrice,
    bulk_unit_price:
      input.availability === 'not_available'
        ? null
        : input.stockStatus === 'bulk_limited_both'
          ? bulkUnitPrice
          : null,
    response_images: input.availability === 'not_available' ? [] : input.responseImages,
    remarks: input.remarks?.trim() || null,
  }

  // #region agent log
  fetch('http://127.0.0.1:7744/ingest/cf8ad616-2757-428a-b0c7-1ddd68a3b548',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a8deff'},body:JSON.stringify({sessionId:'a8deff',location:'productAvailabilityHelpers.ts:submit-start',message:'submitProductAvailabilityResponse called',data:{assignmentId:input.assignmentId,requestId:input.requestId,availability:input.availability,stockStatus:input.stockStatus,singleUnitPrice:input.singleUnitPrice},timestamp:Date.now(),hypothesisId:'H-D'})}).catch(()=>{})
  // #endregion

  const { error: responseError } = await supabase
    .from('product_availability_responses')
    .upsert(payload, { onConflict: 'assignment_id' })

  // #region agent log
  fetch('http://127.0.0.1:7744/ingest/cf8ad616-2757-428a-b0c7-1ddd68a3b548',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a8deff'},body:JSON.stringify({sessionId:'a8deff',location:'productAvailabilityHelpers.ts:after-response-upsert',message:'response upsert result',data:{error:responseError ? responseError.message : null,code:responseError ? responseError.code : null},timestamp:Date.now(),hypothesisId:'H-D'})}).catch(()=>{})
  // #endregion

  if (responseError) {
    throw new Error(responseError.message || 'Failed to save purchaser response')
  }

  const { data: assignmentUpdateData, error: assignmentError, count: assignmentCount } = await supabase
    .from('product_availability_request_markets')
    .update({
      assignment_status: 'completed',
      responded_at: new Date().toISOString(),
    })
    .eq('id', input.assignmentId)
    .select('id, assignment_status')

  // #region agent log
  fetch('http://127.0.0.1:7744/ingest/cf8ad616-2757-428a-b0c7-1ddd68a3b548',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a8deff'},body:JSON.stringify({sessionId:'a8deff',location:'productAvailabilityHelpers.ts:after-assignment-update',message:'assignment update result',data:{error:assignmentError ? assignmentError.message : null,code:assignmentError ? assignmentError.code : null,rowsReturned: assignmentUpdateData ? assignmentUpdateData.length : 0,updatedRows:assignmentUpdateData},timestamp:Date.now(),hypothesisId:'H-A'})}).catch(()=>{})
  // #endregion

  if (assignmentError) {
    throw new Error(assignmentError.message || 'Failed to update assignment status')
  }

  await refreshRequestStatus(input.requestId)
  return true
}

const VALID_MARKETS = new Set(['UAE', 'KSA', 'PAK', 'QTR', 'KWT', 'OMN', 'BHR', 'IRQ', 'USA'])
const VALID_PRODUCT_STATUSES = new Set<ProductStatusInput>(['already_listed', 'not_listed', 'not_sure'])
const VALID_PRIORITIES = new Set<PriorityLevel>(['urgent', 'normal'])

/** Parse a raw CSV string into validated rows ready for bulk import */
export function parseBulkUploadCsv(csvText: string): BulkUploadRowValidated[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))

  return lines.slice(1).map((line, i) => {
    const rowIndex = i + 2 // 1-based, header is row 1
    const cells = line.split(',').map((c) => c.trim())
    const get = (col: string) => cells[headers.indexOf(col)] || ''

    const rawMarkets = get('markets')
      .split(';')
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean)
    const product_status = get('product_status') as ProductStatusInput
    const priority_level = get('priority_level') as PriorityLevel

    const errors: string[] = []

    if (!get('product_name')) errors.push('product_name is required')
    if (!get('reseller_name')) errors.push('reseller_name is required')
    if (rawMarkets.length === 0) errors.push('at least one market is required')
    rawMarkets.forEach((m) => {
      if (!VALID_MARKETS.has(m)) errors.push(`unknown market "${m}"`)
    })
    if (!VALID_PRODUCT_STATUSES.has(product_status)) {
      errors.push(`product_status must be already_listed, not_listed, or not_sure`)
    }
    if (!VALID_PRIORITIES.has(priority_level)) {
      errors.push(`priority_level must be urgent or normal`)
    }
    if (product_status === 'already_listed' && !get('sku')) {
      errors.push('sku is required when product_status is already_listed')
    }

    return {
      rowIndex,
      product_name: get('product_name'),
      reseller_name: get('reseller_name'),
      markets: rawMarkets,
      sku: get('sku'),
      reference_link: get('reference_link'),
      product_status,
      priority_level,
      remarks: get('remarks'),
      errors,
    } satisfies BulkUploadRowValidated
  })
}

/** Create multiple draft requests from a validated CSV batch */
export async function createBulkDraftRequests(
  rows: BulkUploadRow[],
  agentUserId: string,
  agentRole: string
): Promise<{ successCount: number; failedRows: number[] }> {
  let successCount = 0
  const failedRows: number[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      await createProductAvailabilityRequest({
        requestedByUserId: agentUserId,
        requestedByRole: agentRole,
        productStatus: row.product_status,
        markets: row.markets,
        resellerName: row.reseller_name,
        productName: row.product_name,
        sku: row.sku || null,
        referenceLink: row.reference_link || null,
        remarks: row.remarks || null,
        priorityLevel: row.priority_level,
        requestImages: [],
        isDraft: true,
      })
      successCount++
    } catch {
      failedRows.push(i + 1)
    }
  }
  return { successCount, failedRows }
}

/** Submit photos for a draft request — makes it live and visible to purchasers */
export async function submitDraftRequest(
  requestId: string,
  imageUrls: string[]
): Promise<void> {
  if (imageUrls.length === 0 || imageUrls.length > 5) {
    throw new Error('Please attach between 1 and 5 photos before submitting')
  }

  const { error } = await supabase
    .from('product_availability_requests')
    .update({
      request_images: imageUrls,
      is_draft: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) {
    throw new Error(error.message || 'Failed to submit draft request')
  }
}

export async function getProductAvailabilityCounts(
  userRole: string,
  userFriendlyId: string
): Promise<{
  urgent: number
  normalRequests: number
  delayed: number
  completed: number
  drafts: number
  all: number
}> {
  const [liveRows, draftRows] = await Promise.all([
    fetchProductAvailabilityRequests({ userRole, userFriendlyId, statusFilter: 'all' }),
    userRole === 'agent'
      ? fetchProductAvailabilityRequests({ userRole, userFriendlyId, statusFilter: 'draft' })
      : Promise.resolve([]),
  ])

  const counts = {
    urgent: 0,
    normalRequests: 0,
    delayed: 0,
    completed: 0,
    drafts: draftRows.length,
    all: liveRows.length,
  }
  liveRows.forEach((row) => {
    const priority = row.priority_level as PriorityLevel
    if (priority === 'urgent' && row.derived_status === 'pending') counts.urgent += 1
    if (priority === 'normal' && row.derived_status === 'pending') counts.normalRequests += 1
    if (row.derived_status === 'delayed') counts.delayed += 1
    if (row.derived_status === 'completed') counts.completed += 1
  })
  return counts
}

export async function getPendingProductAvailabilityCount(
  userRole: string,
  userFriendlyId: string
): Promise<number> {
  const counts = await getProductAvailabilityCounts(userRole, userFriendlyId)
  return counts.all
}

