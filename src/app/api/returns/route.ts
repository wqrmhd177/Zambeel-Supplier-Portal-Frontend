import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { MetabaseOrder } from '@/app/api/orders/route'

const METABASE_ORDERS_URL =
  'https://zambeel.metabaseapp.com/public/question/deab3d2c-9fbc-4d1e-8400-e93d1513582e.json'

const CACHE_TTL_MS = 5 * 60 * 1000
const PAGE_LIMIT = 50

// ---------------------------------------------------------------------------
// Supabase — lazy singleton (evaluated per serverless instance, not at build)
// ---------------------------------------------------------------------------
let _supabase: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ''
    _supabase = createClient(url, key)
  }
  return _supabase
}

// ---------------------------------------------------------------------------
// Metabase cache (shared concept — separate instance from orders route cache)
// ---------------------------------------------------------------------------
let _cache: { data: MetabaseOrder[]; expires: number } | null = null

async function getAllOrders(forceRefresh = false): Promise<MetabaseOrder[]> {
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

export interface ReturnManagementRecord {
  order_id: string
  sku: string
  vendor_id: number | null
  receiving_status: string | null
  return_condition: string | null
  updated_at: string | null
}

export interface ReturnOrder extends MetabaseOrder {
  receiving_status: string | null
  return_condition: string | null
}

// ---------------------------------------------------------------------------
// GET /api/returns
// Query params: page, limit, search, vendorId, refresh
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(10, parseInt(sp.get('limit') || String(PAGE_LIMIT), 10)))
    const search = sp.get('search') || ''
    const vendorId = sp.get('vendorId') || ''
    const forceRefresh = sp.get('refresh') === '1'

    let all = await getAllOrders(forceRefresh)

    // Only return orders
    all = all.filter((o) => o.status?.toLowerCase().includes('return'))

    // Scope to vendor when provided
    if (vendorId) {
      const vid = Number(vendorId)
      if (!isNaN(vid)) {
        all = all.filter((o) => o.vendor_id === vid)
      }
    }

    // Search by order number or tracking ID
    if (search.trim()) {
      const q = search.toLowerCase()
      all = all.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(q) ||
          o.Courier_tracking_id?.toLowerCase().includes(q) ||
          o.System_gen_tracking_id_removed?.toLowerCase().includes(q) ||
          o.sku?.toLowerCase().includes(q) ||
          o.title?.toLowerCase().includes(q)
      )
    }

    const total = all.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * limit
    const pageRows = all.slice(start, start + limit)

    // Fetch Supabase return_management records for this page
    const keys = pageRows.map((o) => ({ order_id: String(o.order_number), sku: o.sku }))
    let supabaseMap: Record<string, ReturnManagementRecord> = {}

    if (keys.length > 0) {
      const orderIds = keys.map((k) => k.order_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rmData } = await (getSupabase() as any)
        .from('return_management')
        .select('order_id, sku, vendor_id, receiving_status, return_condition, updated_at')
        .in('order_id', orderIds)

      if (rmData) {
        for (const rec of rmData as ReturnManagementRecord[]) {
          supabaseMap[`${rec.order_id}__${rec.sku}`] = rec
        }
      }
    }

    // Merge Metabase rows with Supabase editable fields
    const orders: ReturnOrder[] = pageRows.map((o) => {
      const key = `${o.order_number}__${o.sku}`
      const rm = supabaseMap[key]
      return {
        ...o,
        receiving_status: rm?.receiving_status ?? null,
        return_condition: rm?.return_condition ?? null,
      }
    })

    return NextResponse.json({ orders, total, page: safePage, limit, totalPages })
  } catch (error) {
    console.error('Error in returns GET:', error)
    return NextResponse.json({ error: 'Unable to load returns.' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/returns
// Body: { order_id, sku, vendor_id, receiving_status?, return_condition? }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      order_id: string
      sku: string
      vendor_id?: number | null
      receiving_status?: string | null
      return_condition?: string | null
    }

    const { order_id, sku, vendor_id, receiving_status, return_condition } = body

    if (!order_id || !sku) {
      return NextResponse.json({ error: 'order_id and sku are required.' }, { status: 400 })
    }

    const upsertPayload: ReturnManagementRecord = {
      order_id,
      sku,
      vendor_id: vendor_id ?? null,
      receiving_status: receiving_status ?? null,
      return_condition: return_condition ?? null,
      updated_at: new Date().toISOString(),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getSupabase() as any)
      .from('return_management')
      .upsert(upsertPayload, { onConflict: 'order_id,sku' })

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in returns PATCH:', error)
    return NextResponse.json({ error: 'Unable to save return data.' }, { status: 500 })
  }
}
