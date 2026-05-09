import { supabase } from './supabase'

export type ProductAvailabilityStatus = 'pending' | 'delayed' | 'completed'
export type ProductStatusInput = 'already_listed' | 'not_listed' | 'not_sure'
export type PriorityLevel = 'urgent' | 'normal'
export type AvailabilityOption = 'available' | 'not_available' | 'on_demand'
export type StockStatusOption = 'limited' | 'on_demand' | 'bulk_limited_both'

export interface ProductAvailabilityRequest {
  id: string
  requested_by_user_id: string
  requested_by_role: string
  product_status: ProductStatusInput
  markets: string[]
  reseller_name: string
  product_name: string
  sku: string | null
  reference_link: string | null
  priority_level: PriorityLevel
  request_images: string[]
  inventory_matches: unknown[]
  status: ProductAvailabilityStatus
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
  priorityLevel: PriorityLevel
  requestImages: string[]
  inventoryMatches?: unknown[]
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
 * - urgent_open: urgent priority, still within 48h (derived pending)
 * - normal_pending: normal priority, still within 48h (derived pending)
 * - delayed: past 48h for any priority (normal or urgent); never also in urgent/normal tabs
 */
export type ProductAvailabilityListFilter =
  | 'all'
  | 'completed'
  | 'delayed'
  | 'urgent_open'
  | 'normal_pending'

function matchesProductAvailabilityListFilter(
  row: ProductAvailabilityRequestWithDetails,
  filter: ProductAvailabilityListFilter
): boolean {
  if (filter === 'all') return true
  const priority = row.priority_level as PriorityLevel
  if (filter === 'completed') return row.derived_status === 'completed'
  if (filter === 'delayed') {
    return row.derived_status === 'delayed'
  }
  if (filter === 'urgent_open') {
    return priority === 'urgent' && row.derived_status === 'pending'
  }
  if (filter === 'normal_pending') {
    return priority === 'normal' && row.derived_status === 'pending'
  }
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
      return 'Available in Bulk & Single Unit'
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
    .select('assignment_status')
    .eq('request_id', requestId)

  const allCompleted =
    (assignments || []).length > 0 &&
    (assignments || []).every((a) => a.assignment_status === 'completed')

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

export async function createProductAvailabilityRequest(
  input: CreateProductAvailabilityInput
): Promise<ProductAvailabilityRequest | null> {
  const normalizedMarkets = Array.from(
    new Set(input.markets.map(normalizeMarket).filter(Boolean))
  )

  if (normalizedMarkets.length === 0) {
    throw new Error('At least one market is required')
  }
  if (input.requestImages.length === 0 || input.requestImages.length > 5) {
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
        priority_level: input.priorityLevel,
        request_images: input.requestImages,
        inventory_matches: input.inventoryMatches || [],
        status: 'pending',
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
  await maybeSyncDelayedRequests()

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
    requestQuery = requestQuery.in('id', requestIdsForPurchaser)
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
      const derived = deriveStatus(request.status, request.created_at)
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

  const { error: responseError } = await supabase
    .from('product_availability_responses')
    .upsert(payload, { onConflict: 'assignment_id' })

  if (responseError) {
    throw new Error(responseError.message || 'Failed to save purchaser response')
  }

  const { error: assignmentError } = await supabase
    .from('product_availability_request_markets')
    .update({
      assignment_status: 'completed',
      responded_at: new Date().toISOString(),
    })
    .eq('id', input.assignmentId)

  if (assignmentError) {
    throw new Error(assignmentError.message || 'Failed to update assignment status')
  }

  await refreshRequestStatus(input.requestId)
  return true
}

export async function getProductAvailabilityCounts(
  userRole: string,
  userFriendlyId: string
): Promise<{
  urgent: number
  normalRequests: number
  delayed: number
  completed: number
  all: number
}> {
  const rows = await fetchProductAvailabilityRequests({
    userRole,
    userFriendlyId,
    statusFilter: 'all',
  })

  const counts = { urgent: 0, normalRequests: 0, delayed: 0, completed: 0, all: rows.length }
  rows.forEach((row) => {
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

