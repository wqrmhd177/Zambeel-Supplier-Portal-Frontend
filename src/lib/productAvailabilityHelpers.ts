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
  /** Legacy array kept for display of old multi-market requests */
  markets: string[]
  /** Single market for this request (new style) */
  market: string | null
  /** Purchaser assigned to respond */
  assigned_purchaser_user_id: string | null
  /** Whether the purchaser has responded */
  assignment_status: 'pending' | 'completed'
  responded_at: string | null
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

export interface ProductAvailabilityResponse {
  id: string
  request_id: string
  assignment_id: string | null
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
  response: ProductAvailabilityResponse | null
}

export interface CreateProductAvailabilityInput {
  requestedByUserId: string
  requestedByRole: string
  productStatus: ProductStatusInput
  market: string
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
  market: string
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

function deriveStatus(
  dbStatus: ProductAvailabilityStatus,
  assignmentStatus: 'pending' | 'completed',
  createdAt: string
): ProductAvailabilityStatus {
  if (dbStatus === 'completed' || assignmentStatus === 'completed') return 'completed'
  const elapsedHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  return elapsedHours >= 48 ? 'delayed' : 'pending'
}

/**
 * Tab filters — each open request appears in exactly one tab.
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
  if (row.is_draft) return false
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
    case 'pending': return 'Pending'
    case 'delayed': return 'Delayed'
    case 'completed': return 'Completed'
    default: return status
  }
}

export function formatAvailabilityLabel(av: AvailabilityOption): string {
  switch (av) {
    case 'available': return 'Available'
    case 'not_available': return 'Not Available'
    case 'on_demand': return 'On Demand'
    default: return av
  }
}

export function formatStockStatusLabel(stock: StockStatusOption): string {
  switch (stock) {
    case 'limited': return 'Limited Quantity'
    case 'on_demand': return 'On Demand'
    case 'bulk_limited_both': return 'Normal Qty (Single/Bulk)'
    default: return stock
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

export async function createProductAvailabilityRequest(
  input: CreateProductAvailabilityInput
): Promise<ProductAvailabilityRequest | null> {
  const isDraft = input.isDraft === true
  const normalizedMarket = normalizeMarket(input.market)

  if (!normalizedMarket) {
    throw new Error('A market is required')
  }
  if (!isDraft && (input.requestImages.length === 0 || input.requestImages.length > 5)) {
    throw new Error('Request images must contain between 1 and 5 files')
  }
  if (input.productStatus === 'already_listed' && !String(input.sku || '').trim()) {
    throw new Error('SKU is required when product status is Already Listed')
  }

  // Find the purchaser for this market
  const { data: purchasers, error: purchasersError } = await supabase
    .from('users')
    .select('user_id, country, stock_location_country, role')
    .eq('role', 'purchaser')

  // #region agent log
  console.log('[DBG:create-purchaser-lookup] H-1/H-2', {
    market: normalizedMarket,
    queryError: purchasersError?.message ?? null,
    purchaserCount: (purchasers || []).length,
    allPurchasers: (purchasers || []).map((p: any) => ({
      user_id: p.user_id,
      role: p.role,
      country: p.country,
      stock_location_country: p.stock_location_country,
      countryUpper: (p.country || '').toUpperCase(),
      matchesUAE: countryMatchesMarket('UAE', p.country || p.stock_location_country),
    })),
  })
  // #endregion

  const matchingPurchaser = (purchasers || []).find((p: any) =>
    countryMatchesMarket(normalizedMarket, p.country || p.stock_location_country)
  )

  // #region agent log
  console.log('[DBG:create-matched-purchaser] H-1/H-2', {
    matchingPurchaser: matchingPurchaser
      ? { user_id: matchingPurchaser.user_id, country: matchingPurchaser.country }
      : null,
  })
  // #endregion

  const { data: createdRequest, error: requestError } = await supabase
    .from('product_availability_requests')
    .insert([
      {
        requested_by_user_id: input.requestedByUserId,
        requested_by_role: input.requestedByRole,
        product_status: input.productStatus,
        markets: [normalizedMarket],
        market: normalizedMarket,
        assigned_purchaser_user_id: matchingPurchaser ? String(matchingPurchaser.user_id || '') : null,
        assignment_status: 'pending',
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

  return createdRequest
}

export async function fetchProductAvailabilityRequests(params: {
  userRole: string
  userFriendlyId: string
  statusFilter: ProductAvailabilityListFilter
}): Promise<ProductAvailabilityRequestWithDetails[]> {
  await maybeSyncDelayedRequests()

  const role = (params.userRole || '').toLowerCase()

  // #region agent log
  console.log('[DBG:fetch-params] H-2', { role, userFriendlyId: params.userFriendlyId })
  // #endregion

  // #region agent log — compare stored IDs vs what the purchaser session holds
  if (role === 'purchaser') {
    const { data: sampleRows } = await supabase
      .from('product_availability_requests')
      .select('id, assigned_purchaser_user_id, market, is_draft')
      .eq('is_draft', false)
      .order('created_at', { ascending: false })
      .limit(5)
    console.log('[DBG:id-compare] H-2/RLS', {
      userFriendlyId: params.userFriendlyId,
      userFriendlyIdType: typeof params.userFriendlyId,
      recentRows: sampleRows,
    })
  }
  // #endregion

  let requestQuery = supabase
    .from('product_availability_requests')
    .select('*')
    .order('created_at', { ascending: true })

  if (role === 'agent') {
    requestQuery = requestQuery.eq('requested_by_user_id', params.userFriendlyId)
  } else if (role === 'purchaser') {
    requestQuery = requestQuery
      .eq('assigned_purchaser_user_id', params.userFriendlyId)
      .eq('is_draft', false)
  } else {
    if (params.statusFilter !== 'draft') {
      requestQuery = requestQuery.eq('is_draft', false)
    }
  }

  const { data: requestRows, error: requestError } = await requestQuery

  // #region agent log
  console.log('[DBG:fetch-result] H-RLS', {
    role,
    rowCount: (requestRows || []).length,
    error: requestError?.message ?? null,
  })
  // #endregion

  if (requestError) {
    throw new Error(requestError.message || 'Failed to fetch availability requests')
  }

  const requestIds = (requestRows || []).map((row: any) => row.id)
  if (requestIds.length === 0) return []

  // Fetch responses linked directly by request_id (new style, assignment_id IS NULL)
  const { data: newStyleResponses } = await supabase
    .from('product_availability_responses')
    .select('*')
    .in('request_id', requestIds)
    .is('assignment_id', null)

  // Also fetch old-style responses (assignment_id IS NOT NULL) for legacy requests
  const { data: oldStyleResponses } = await supabase
    .from('product_availability_responses')
    .select('*')
    .in('request_id', requestIds)
    .not('assignment_id', 'is', null)

  const responseByRequestId: Record<string, ProductAvailabilityResponse> = {}
  // Old-style first (lower priority), new-style overwrites
  ;(oldStyleResponses || []).forEach((r: any) => {
    responseByRequestId[r.request_id] = r
  })
  ;(newStyleResponses || []).forEach((r: any) => {
    responseByRequestId[r.request_id] = r
  })

  const withDerived = (requestRows || [])
    .map((request: any) => {
      // #region agent log
      console.log('[DBG:derive-status] H-1', {
        requestId: request.id,
        reqNo: request.request_number,
        dbStatus: request.status,
        assignmentStatus: request.assignment_status,
        assignedTo: request.assigned_purchaser_user_id,
      })
      // #endregion

      const derived = deriveStatus(
        request.status,
        request.assignment_status ?? 'pending',
        request.created_at
      )
      return {
        ...request,
        derived_status: derived,
        response: responseByRequestId[request.id] ?? null,
      } as ProductAvailabilityRequestWithDetails
    })
    .filter((row) => matchesProductAvailabilityListFilter(row, params.statusFilter))

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

  // #region agent log
  console.log('[DBG:submit-start] H-1', {
    requestId: input.requestId,
    availability: input.availability,
    stockStatus: input.stockStatus,
    singleUnitPrice: input.singleUnitPrice,
  })
  // #endregion

  const { data, error } = await supabase.rpc('submit_availability_response', {
    p_request_id:           input.requestId,
    p_responded_by_user_id: input.respondedByUserId,
    p_availability:         input.availability === 'not_available' ? 'not_available' : input.availability,
    p_stock_status:         input.availability === 'not_available' ? 'on_demand' : input.stockStatus,
    p_single_unit_price:    input.availability === 'not_available' ? null : singleUnitPrice,
    p_bulk_unit_price:
      input.availability === 'not_available'
        ? null
        : input.stockStatus === 'bulk_limited_both'
          ? bulkUnitPrice
          : null,
    p_response_images: input.availability === 'not_available' ? [] : input.responseImages,
    p_remarks:         input.availability === 'not_available' ? null : (input.remarks?.trim() || null),
  })

  // #region agent log
  if (error) console.error('[DBG:rpc-error] H-1', { error: error.message, code: error.code })
  else console.log('[DBG:rpc-ok] H-1', data)
  // #endregion

  if (error) {
    throw new Error(error.message || 'Failed to save purchaser response')
  }

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
    const rowIndex = i + 2
    const cells = line.split(',').map((c) => c.trim())
    const get = (col: string) => cells[headers.indexOf(col)] || ''

    const rawMarket = get('market').trim().toUpperCase()
    const product_status = get('product_status') as ProductStatusInput
    const priority_level = get('priority_level') as PriorityLevel

    const errors: string[] = []

    if (!get('product_name')) errors.push('product_name is required')
    if (!get('reseller_name')) errors.push('reseller_name is required')
    if (!rawMarket) errors.push('market is required')
    else if (!VALID_MARKETS.has(rawMarket)) errors.push(`unknown market "${rawMarket}"`)
    if (!VALID_PRODUCT_STATUSES.has(product_status)) {
      errors.push('product_status must be already_listed, not_listed, or not_sure')
    }
    if (!VALID_PRIORITIES.has(priority_level)) {
      errors.push('priority_level must be urgent or normal')
    }
    if (product_status === 'already_listed' && !get('sku')) {
      errors.push('sku is required when product_status is already_listed')
    }

    return {
      rowIndex,
      product_name: get('product_name'),
      reseller_name: get('reseller_name'),
      market: rawMarket,
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
        market: row.market,
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
