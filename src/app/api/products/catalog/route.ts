import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchMergedProductCatalog } from '@/lib/productCatalogServer'

const SESSION_COOKIE = 'supplier_session'
const CATALOG_ROLES = new Set([
  'admin',
  'purchaser',
  'manager',
  'listing_agent',
  'supplier',
  'agent',
])

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

async function supplierUserIdsForPurchaser(
  supabase: SupabaseClient,
  purchaserUuid: string
): Promise<string[]> {
  const { data: purchaserData, error: purchaserError } = await supabase
    .from('users')
    .select('country, stock_location_country')
    .eq('id', purchaserUuid)
    .eq('role', 'purchaser')
    .maybeSingle()

  if (purchaserError || !purchaserData) return []

  const purchaserCountry =
    purchaserData.country || purchaserData.stock_location_country
  if (!purchaserCountry) return []

  const { data: suppliers, error } = await supabase
    .from('users')
    .select('user_id')
    .eq('role', 'supplier')
    .eq('archived', false)
    .eq('account_approval', 'Approved')
    .or(`country.eq.${purchaserCountry},stock_location_country.eq.${purchaserCountry}`)

  if (error || !suppliers?.length) return []
  return suppliers.map((s) => String(s.user_id)).filter(Boolean)
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const supabase = getAdminSupabase()
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, user_id, role')
      .eq('id', sessionId)
      .maybeSingle()

    if (actorError || !actor) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const role = String(actor.role || '').toLowerCase()
    if (!CATALOG_ROLES.has(role)) {
      return NextResponse.json({ error: 'You do not have permission to view products.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const status = body.status ? String(body.status) : undefined

    let ownerId: string | undefined = body.ownerId ? String(body.ownerId).trim() : undefined
    let ownerIds: string[] | undefined = Array.isArray(body.ownerIds)
      ? body.ownerIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      : undefined

    if (role === 'supplier') {
      const sid = String(actor.user_id || '').trim()
      if (!sid) {
        return NextResponse.json({ error: 'Supplier account is missing user_id.' }, { status: 400 })
      }
      ownerId = sid
      ownerIds = undefined
    } else if (role === 'purchaser') {
      const allowed = await supplierUserIdsForPurchaser(supabase, actor.id)
      if (allowed.length === 0) {
        return NextResponse.json({ products: [] })
      }
      if (ownerIds && ownerIds.length > 0) {
        const bad = ownerIds.filter((id) => !allowed.includes(id))
        if (bad.length > 0) {
          return NextResponse.json({ error: 'One or more suppliers are outside your market.' }, { status: 403 })
        }
      } else if (ownerId) {
        if (!allowed.includes(ownerId)) {
          return NextResponse.json({ error: 'Supplier is outside your market.' }, { status: 403 })
        }
      } else {
        ownerIds = allowed
      }
    }

    const products = await fetchMergedProductCatalog(supabase, { ownerId, ownerIds, status })
    return NextResponse.json({ products })
  } catch (err) {
    console.error('[products/catalog]', err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
