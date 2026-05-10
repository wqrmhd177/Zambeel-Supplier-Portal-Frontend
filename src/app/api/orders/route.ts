import { NextRequest, NextResponse } from 'next/server'

const METABASE_ORDERS_URL =
  'https://zambeel.metabaseapp.com/public/question/deab3d2c-9fbc-4d1e-8400-e93d1513582e.json'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const PAGE_LIMIT = 50

export interface MetabaseOrder {
  id: number
  order_number: string
  country: string
  full_name: string
  phone: string
  shipping: string
  city: string
  title: string
  sku: string
  quantity: number
  total_payable: number
  System_gen_tracking_id_removed: string | null
  Courier_tracking_id: string | null
  status: string
  substatus: string | null
  tag: string | null
  OP_remarks: string | null
  NDR_remarks: string | null
  bifurcation: string | null
  Order_date: string
  updatedAt: string
  activity_counter: number
  reschedule_date: string | null
  shipment_date: string | null
  approved_date: string | null
  shipment_date_log: string | null
  delivered_date: string | null
  Returned_date: string | null
  Undelivered_tag: string | null
  PLATFORM: string | null
  vendor_id: number
}

export interface OrderStats {
  total: number
  inTransit: number
  toBeDispatch: number
  delivered: number
  returned: number
}

export interface OrdersResponse {
  orders: MetabaseOrder[]
  total: number
  page: number
  limit: number
  totalPages: number
  stats: OrderStats
  countries: string[]
}

// ---------------------------------------------------------------------------
// Server-side in-memory cache
// ---------------------------------------------------------------------------
let _cache: { data: MetabaseOrder[]; expires: number } | null = null

async function getAll(forceRefresh = false): Promise<MetabaseOrder[]> {
  if (!forceRefresh && _cache && Date.now() < _cache.expires) {
    return _cache.data
  }
  const response = await fetch(METABASE_ORDERS_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Metabase returned ${response.status}`)
  const raw = await response.json()
  const data: MetabaseOrder[] = Array.isArray(raw) ? raw : []
  _cache = { data, expires: Date.now() + CACHE_TTL_MS }
  return data
}

// Statuses excluded from "In-Transit"
const EXCLUDED_FROM_IN_TRANSIT = [
  'delivered',
  'return',
  'approved',
  'dispatching in process',
  'cancelled',
  'confirmation pending',
]

function computeStats(rows: MetabaseOrder[]): OrderStats {
  let inTransit = 0, toBeDispatch = 0, delivered = 0, returned = 0

  for (const o of rows) {
    const s = o.status?.toLowerCase() || ''

    if (s.includes('delivered')) {
      delivered++
    } else if (s.includes('return')) {
      returned++
    } else if (s.includes('dispatching in process')) {
      toBeDispatch++
    } else {
      // In-Transit = not any of the excluded statuses
      const isExcluded = EXCLUDED_FROM_IN_TRANSIT.some((ex) => s.includes(ex))
      if (!isExcluded) inTransit++
    }
  }

  return { total: rows.length, inTransit, toBeDispatch, delivered, returned }
}

function filterRows(
  rows: MetabaseOrder[],
  search: string,
  status: string,
  country: string
): MetabaseOrder[] {
  let out = rows

  if (status !== 'all') {
    const sl = status.toLowerCase()
    out = out.filter((o) => o.status?.toLowerCase().includes(sl))
  }

  if (country !== 'all') {
    const cl = country.toLowerCase()
    out = out.filter((o) => o.country?.toLowerCase() === cl)
  }

  if (search.trim()) {
    const q = search.toLowerCase()
    out = out.filter(
      (o) =>
        o.order_number?.toLowerCase().includes(q) ||
        o.Courier_tracking_id?.toLowerCase().includes(q) ||
        o.System_gen_tracking_id_removed?.toLowerCase().includes(q) ||
        o.sku?.toLowerCase().includes(q) ||
        o.title?.toLowerCase().includes(q) ||
        o.full_name?.toLowerCase().includes(q) ||
        o.phone?.toLowerCase().includes(q)
    )
  }

  return out
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(10, parseInt(sp.get('limit') || String(PAGE_LIMIT), 10)))
    const search = sp.get('search') || ''
    const status = sp.get('status') || 'all'
    const country = sp.get('country') || 'all'
    const vendorId = sp.get('vendorId') || ''
    const forceRefresh = sp.get('refresh') === '1'
    const isExport = sp.get('export') === '1'

    let all = await getAll(forceRefresh)

    // Scope to vendor when provided (supplier view)
    if (vendorId) {
      const vid = Number(vendorId)
      if (!isNaN(vid)) {
        all = all.filter((o) => o.vendor_id === vid)
      }
    }

    // Stats always over the vendor-scoped (but unfiltered by search/status/country) dataset
    const stats = computeStats(all)
    const countries = Array.from(new Set(all.map((o) => o.country).filter(Boolean))).sort() as string[]

    const filtered = filterRows(all, search, status, country)

    if (isExport) {
      return NextResponse.json({ orders: filtered, total: filtered.length, stats, countries })
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * limit
    const pageRows = filtered.slice(start, start + limit)

    const body: OrdersResponse = {
      orders: pageRows,
      total: filtered.length,
      page: safePage,
      limit,
      totalPages,
      stats,
      countries,
    }

    return NextResponse.json(body)
  } catch (error) {
    console.error('Error in orders route:', error)
    return NextResponse.json(
      { error: 'Unable to load orders. Please try again.' },
      { status: 500 }
    )
  }
}
