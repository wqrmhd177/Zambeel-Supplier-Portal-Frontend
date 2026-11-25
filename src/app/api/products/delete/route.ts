import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireApiActor } from '@/lib/requireApiActor'
const DELETE_ROLES = new Set(['admin', 'agent', 'listing_agent'])

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiActor(request)
    if (!auth.ok) return auth.response

    const supabase = getAdminSupabase()

    const role = auth.actor.role
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
