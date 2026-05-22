import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { MetabaseOrder } from '@/app/api/orders/route'
import { isDateInRange, parseSearchTerms, rowMatchesSearch } from '@/lib/filterUtils'

const METABASE_ORDERS_URL =
  'https://zambeel.metabaseapp.com/public/question/deab3d2c-9fbc-4d1e-8400-e93d1513582e.json'

const CACHE_TTL_MS = 5 * 60 * 1000
const PAGE_LIMIT = 50

export type ReturnTab = 'all' | 'pending' | 'not_received' | 'received'

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
  auto_received_by_system?: boolean | null
}

export interface ReturnOrder extends MetabaseOrder {
  receiving_status: string | null
  return_condition: string | null
  auto_received_by_system?: boolean
}

function receivingStatusForKey(
  supabaseMap: Record<string, ReturnManagementRecord>,
  o: MetabaseOrder
): string {
  return supabaseMap[`${o.order_number}__${o.sku}`]?.receiving_status ?? ''
}

function matchesReturnTab(tab: ReturnTab, receivingStatus: string): boolean {
  if (tab === 'pending') return !receivingStatus
  if (tab === 'not_received') return receivingStatus === 'No'
  if (tab === 'received') return receivingStatus === 'Yes'
  return true
}

async function fetchReturnManagementMap(
  orderIds: string[]
): Promise<Record<string, ReturnManagementRecord>> {
  const supabaseMap: Record<string, ReturnManagementRecord> = {}
  if (orderIds.length === 0) return supabaseMap

  const selectWithFlag =
    'order_id, sku, vendor_id, receiving_status, return_condition, updated_at, auto_received_by_system'
  const selectBase = 'order_id, sku, vendor_id, receiving_status, return_condition, updated_at'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: rmData, error } = await (getSupabase() as any)
    .from('return_management')
    .select(selectWithFlag)
    .in('order_id', orderIds)

  if (error) {
    const msg = error?.message?.toLowerCase?.() || ''
    if (msg.includes('auto_received_by_system') && (msg.includes('column') || msg.includes('does not exist'))) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallback = await (getSupabase() as any)
        .from('return_management')
        .select(selectBase)
        .in('order_id', orderIds)
      rmData = fallback.data
    } else {
      console.error('Error fetching return_management:', error)
    }
  }

  if (rmData) {
    for (const rec of rmData as ReturnManagementRecord[]) {
      supabaseMap[`${rec.order_id}__${rec.sku}`] = rec
    }
  }
  return supabaseMap
}

function mergeRow(o: MetabaseOrder, supabaseMap: Record<string, ReturnManagementRecord>): ReturnOrder {
  const key = `${o.order_number}__${o.sku}`
  const rm = supabaseMap[key]
  return {
    ...o,
    receiving_status: rm?.receiving_status ?? null,
    return_condition: rm?.return_condition ?? null,
    auto_received_by_system: Boolean(rm?.auto_received_by_system),
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(10, parseInt(sp.get('limit') || String(PAGE_LIMIT), 10)))
    const search = sp.get('search') || ''
    const vendorId = sp.get('vendorId') || ''
    const dateFrom = sp.get('dateFrom') || undefined
    const dateTo = sp.get('dateTo') || undefined
    const forceRefresh = sp.get('refresh') === '1'
    const tab = (sp.get('tab') || 'all') as ReturnTab
    const validTabs: ReturnTab[] = ['all', 'pending', 'not_received', 'received']
    const activeTab: ReturnTab = validTabs.includes(tab) ? tab : 'all'

    let all = await getAllOrders(forceRefresh)

    all = all.filter((o) => o.status?.toLowerCase().includes('return'))

    if (vendorId) {
      const vid = Number(vendorId)
      if (!isNaN(vid)) {
        all = all.filter((o) => o.vendor_id === vid)
      }
    }

    if (dateFrom || dateTo) {
      all = all.filter((o) => isDateInRange(o.Returned_date, dateFrom, dateTo))
    }

    const terms = parseSearchTerms(search)
    if (terms.length > 0) {
      all = all.filter((o) => rowMatchesSearch(o, terms))
    }

    all.sort((a, b) => {
      const da = a.Returned_date ? new Date(a.Returned_date).getTime() : 0
      const db = b.Returned_date ? new Date(b.Returned_date).getTime() : 0
      return db - da
    })

    const allOrderIds = Array.from(new Set(all.map((o) => String(o.order_number))))
    const supabaseMap = await fetchReturnManagementMap(allOrderIds)

    let tabStats = { all: 0, pending: 0, notReceived: 0, received: 0 }
    for (const o of all) {
      const rs = receivingStatusForKey(supabaseMap, o)
      tabStats.all++
      if (!rs) tabStats.pending++
      else if (rs === 'No') tabStats.notReceived++
      else if (rs === 'Yes') tabStats.received++
    }

    const tabFiltered =
      activeTab === 'all'
        ? all
        : all.filter((o) => matchesReturnTab(activeTab, receivingStatusForKey(supabaseMap, o)))

    const total = tabFiltered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * limit
    const pageRows = tabFiltered.slice(start, start + limit)

    const orders: ReturnOrder[] = pageRows.map((o) => mergeRow(o, supabaseMap))

    return NextResponse.json({
      orders,
      total,
      page: safePage,
      limit,
      totalPages,
      tabStats,
      tab: activeTab,
    })
  } catch (error) {
    console.error('Error in returns GET:', error)
    return NextResponse.json({ error: 'Unable to load returns.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      order_id: string
      sku: string
      vendor_id?: number | null
      receiving_status?: string | null
      return_condition?: string | null
      auto_received_by_system?: boolean
    }

    const { order_id, sku, vendor_id, receiving_status, return_condition, auto_received_by_system } = body

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

    if (auto_received_by_system !== undefined) {
      upsertPayload.auto_received_by_system = auto_received_by_system
    } else if (receiving_status === 'Yes') {
      upsertPayload.auto_received_by_system = false
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { error } = await (getSupabase() as any)
      .from('return_management')
      .upsert(upsertPayload, { onConflict: 'order_id,sku' })

    if (error) {
      const msg = error?.message?.toLowerCase?.() || ''
      if (msg.includes('auto_received_by_system') && (msg.includes('column') || msg.includes('does not exist'))) {
        const { auto_received_by_system: _drop, ...basePayload } = upsertPayload
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const retry = await (getSupabase() as any)
          .from('return_management')
          .upsert(basePayload, { onConflict: 'order_id,sku' })
        error = retry.error
      }
    }

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
