import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SESSION_COOKIE = 'supplier_session'
const COOKIE_MAX_AGE = 12 * 60 * 60

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const emailNormalized = String(email).trim().toLowerCase()
    const supabase = getAdminSupabase()

    // Fetch all users with this email (handles duplicate rows)
    const { data: matchingUsers, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', emailNormalized)
      .limit(50)

    if (fetchError) {
      return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
    }

    const users = (matchingUsers as Record<string, unknown>[] | null)?.filter(Boolean) || []
    if (users.length === 0) {
      return NextResponse.json({ error: 'Account not found. Please sign up first to create an account.' }, { status: 401 })
    }

    const candidates = users.filter((u) => u.archived !== true)
    const pool = candidates.length ? candidates : users

    // Find matching user by plaintext password comparison
    const passwordMatchedPool = pool.filter(
      (u) => typeof u.password === 'string' && u.password === password
    )

    // Pick best candidate (prefer approved/onboarded suppliers)
    const pickBest = (arr: Record<string, unknown>[]) => {
      return arr.slice().sort((a, b) => {
        const aApproved = String(a.account_approval || '').toLowerCase().includes('approv') ? 1 : 0
        const bApproved = String(b.account_approval || '').toLowerCase().includes('approv') ? 1 : 0
        if (bApproved !== aApproved) return bApproved - aApproved
        const aTs = Math.max(Date.parse(String(a.updated_at || '')) || 0, Date.parse(String(a.created_at || '')) || 0)
        const bTs = Math.max(Date.parse(String(b.updated_at || '')) || 0, Date.parse(String(b.created_at || '')) || 0)
        return bTs - aTs
      })[0]
    }

    const matchedUser = pickBest(passwordMatchedPool.length > 0 ? passwordMatchedPool : pool)

    if (!matchedUser) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    if (matchedUser.archived === true) {
      return NextResponse.json({ error: 'Account not found. Please sign up first to create an account.' }, { status: 401 })
    }

    const storedPw = String(matchedUser.password || '')

    // Bcrypt fallback: handles accounts whose passwords were briefly hashed during a migration.
    // Verifies with bcrypt and migrates back to plaintext so admins can view it in Supabase.
    if (storedPw.startsWith('$2')) {
      const bcrypt = await import('bcryptjs')
      const bcryptMatch = await bcrypt.compare(password, storedPw)
      if (!bcryptMatch) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
      }
      // Migrate back to plaintext
      await supabase
        .from('users')
        .update({ password, updated_at: new Date().toISOString() })
        .eq('id', matchedUser.id)
    } else if (!storedPw || storedPw !== password) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    // Strip password before returning to client
    const { password: _pw, ...safeUser } = matchedUser as Record<string, unknown> & { password: string }

    const response = NextResponse.json({ user: safeUser }, { status: 200 })
    response.cookies.set(SESSION_COOKIE, String(matchedUser.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[auth/login] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
