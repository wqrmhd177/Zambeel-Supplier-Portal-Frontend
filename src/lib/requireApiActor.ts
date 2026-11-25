import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { canAccessPortal, isServerPortalHoldEnabled, portalAccessDeniedMessage } from '@/lib/portalAccess'

export const SESSION_COOKIE = 'supplier_session'

export interface ApiActor {
  id: string
  role: string
  user_id: string | null
  email: string | null
  country: string | null
  account_approval: string | null
}

let _supabase: SupabaseClient | null = null

function getAdminSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    _supabase = createClient(url, key)
  }
  return _supabase
}

/**
 * Require a valid session. When PORTAL_HOLD is on, only admin may use API routes.
 */
export async function requireApiActor(
  request: NextRequest
): Promise<{ ok: true; actor: ApiActor } | { ok: false; response: NextResponse }> {
  if (isServerPortalHoldEnabled()) {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    if (!sessionId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: portalAccessDeniedMessage('hold') },
          { status: 503 }
        ),
      }
    }
  }

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value
  if (!sessionId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('users')
    .select('id, role, user_id, email, country, account_approval, onboarded, archived, full_name, shop_name_on_zambeel, shop_name, phone_number')
    .eq('id', sessionId)
    .maybeSingle()

  if (error || !data || data.archived === true) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const access = canAccessPortal(data, { portalHold: isServerPortalHoldEnabled() })
  if (!access.ok) {
    const status = access.reason === 'hold' ? 503 : 403
    return {
      ok: false,
      response: NextResponse.json({ error: portalAccessDeniedMessage(access.reason) }, { status }),
    }
  }

  const actor: ApiActor = {
    id: String(data.id),
    role: String(data.role || 'supplier').trim().toLowerCase(),
    user_id: data.user_id ? String(data.user_id) : null,
    email: data.email ? String(data.email) : null,
    country: data.country ? String(data.country) : null,
    account_approval: data.account_approval ? String(data.account_approval) : null,
  }

  return { ok: true, actor }
}