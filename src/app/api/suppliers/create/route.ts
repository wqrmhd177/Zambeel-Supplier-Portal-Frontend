import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  resolveSupplierMarketFromCountry,
  resolveMarketForUserInsert,
} from '@/lib/supportedMarkets'
import { ensureUserFriendlyId, allocateNextUserId } from '@/lib/userIdHelpers'

const SESSION_COOKIE = 'supplier_session'

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

async function getPurchaserIntegerId(supabase: SupabaseClient, purchaserUuid: string): Promise<number | null> {
  const { data: allPurchasers, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'purchaser')
    .order('created_at', { ascending: true })

  if (!error && allPurchasers?.length) {
    const index = allPurchasers.findIndex((p) => p.id === purchaserUuid)
    if (index !== -1) return index + 1
  }

  const hex = purchaserUuid.replace(/-/g, '').slice(0, 8)
  const num = parseInt(hex, 16)
  if (!Number.isNaN(num)) return (num % 2147483647) + 1
  return null
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
      .select('id, role, country, stock_location_country')
      .eq('id', sessionId)
      .maybeSingle()

    if (actorError || !actor) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const role = String(actor.role || '').toLowerCase()
    if (role !== 'purchaser' && role !== 'admin') {
      return NextResponse.json({ error: 'You do not have permission to create suppliers.' }, { status: 403 })
    }

    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const ownerName = String(body.ownerName || '').trim()
    const shopNameOnZambeel = String(body.shopNameOnZambeel || '').trim()
    const phone = String(body.phone || '').trim()
    const whatsapp = String(body.whatsapp || '').trim()
    const countryInput = String(body.country || '').trim()
    const pickupCity = String(body.city || '').trim()
    const supplierType = String(body.supplierType || '').trim()
    const categories = Array.isArray(body.categories) ? body.categories : []

    if (!email || !password || !shopNameOnZambeel || !phone || !whatsapp || !countryInput) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    const resolved = resolveMarketForUserInsert(countryInput)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 })
    }
    const { market, dbCountry, currency: insertCurrency } = resolved

    if (role === 'purchaser') {
      const purchaserCountry =
        actor.country || actor.stock_location_country || ''
      const purchaserMarket = resolveSupplierMarketFromCountry(purchaserCountry)
      if (purchaserMarket && purchaserMarket.code !== market.code) {
        return NextResponse.json(
          { error: 'You can only create suppliers in your assigned country.' },
          { status: 403 }
        )
      }
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    let purchaserIntId: number | null = null
    if (role !== 'admin') {
      purchaserIntId = await getPurchaserIntegerId(supabase, actor.id)
      if (!purchaserIntId) {
        return NextResponse.json({ error: 'Unable to resolve purchaser ID.' }, { status: 500 })
      }
    }

    const preallocatedUserId = await allocateNextUserId(supabase)

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          email,
          password,
          role: 'supplier',
          user_id: preallocatedUserId,
          purchaser_id: purchaserIntId,
          full_name: ownerName || null,
          shop_name_on_zambeel: shopNameOnZambeel,
          phone_number: phone,
          whatsapp_phone_number: whatsapp,
          country: dbCountry,
          stock_location_country: dbCountry,
          pickup_city: pickupCity || null,
          currency: insertCurrency,
          supplier_type: supplierType || null,
          category: categories.length > 0 ? JSON.stringify(categories) : null,
          onboarded: true,
          account_approval: 'Approved',
          archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('id, user_id')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
      }
      if (insertError.message?.includes('check_currency_valid')) {
        return NextResponse.json(
          {
            error:
              'Invalid currency for the selected country. Ask an admin to allow this currency in Supabase (check_currency_valid).',
          },
          { status: 400 }
        )
      }
      console.error('[suppliers/create] insert failed:', insertError.message)
      return NextResponse.json({ error: insertError.message || 'Failed to create supplier.' }, { status: 500 })
    }

    let userId = newUser?.user_id ? String(newUser.user_id) : ''
    if (newUser?.id) {
      userId = await ensureUserFriendlyId(supabase, newUser.id, userId)
    }

    if (!userId) {
      return NextResponse.json({ error: 'Supplier created but user_id could not be assigned.' }, { status: 500 })
    }

    return NextResponse.json({ user: { id: newUser?.id, user_id: userId } }, { status: 201 })
  } catch (err) {
    console.error('[suppliers/create] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
