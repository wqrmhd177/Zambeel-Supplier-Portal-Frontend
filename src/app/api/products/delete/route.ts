import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SESSION_COOKIE = 'supplier_session'
const DELETE_ROLES = new Set(['admin', 'agent', 'listing_agent'])

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
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
      .select('id, role')
      .eq('id', sessionId)
      .maybeSingle()

    if (actorError || !actor) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const role = String(actor.role || '').toLowerCase()
    if (!DELETE_ROLES.has(role)) {
      return NextResponse.json({ error: 'You do not have permission to delete products.' }, { status: 403 })
    }

    const body = await request.json()
    const productId = Number(body.productId)
    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json({ error: 'Invalid productId.' }, { status: 400 })
    }

    const { error: variantError } = await supabase
      .from('product_variants')
      .delete()
      .eq('product_id', productId)

    if (variantError) {
      return NextResponse.json(
        { error: variantError.message || 'Failed to delete product variants.' },
        { status: 500 }
      )
    }

    const { error: productError } = await supabase.from('products').delete().eq('product_id', productId)

    if (productError) {
      return NextResponse.json(
        { error: productError.message || 'Failed to delete product.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[products/delete]', err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
