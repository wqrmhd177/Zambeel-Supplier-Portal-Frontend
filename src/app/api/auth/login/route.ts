import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const SESSION_COOKIE = 'supplier_session'
// 12 hours — matches IDLE_TIMEOUT_MS in authCookie.ts
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

    // Fetch all users with this email (handles duplicates, same logic as before)
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

    // Filter to non-archived users, find best password match
    const candidates = users.filter((u) => u.archived !== true)
    const pool = candidates.length ? candidates : users

    // Try to find a user whose password matches (bcrypt or legacy plaintext)
    let matchedUser: Record<string, unknown> | null = null
    for (const u of pool) {
      const stored = String(u.password || '')
      if (!stored) continue

      // Try bcrypt compare first (hashed passwords)
      let matches = false
      if (stored.startsWith('$2')) {
        try {
          matches = await bcrypt.compare(password, stored)
        } catch {
          matches = false
        }
      } else {
        // Legacy plaintext comparison
        matches = stored === password
      }

      if (matches) {
        // Prefer approved/onboarded suppliers over non-approved
        if (!matchedUser) {
          matchedUser = u
        } else {
          // Keep highest priority user (same logic as client-side)
          const aApproved = String(matchedUser.account_approval || '').toLowerCase().includes('approv')
          const bApproved = String(u.account_approval || '').toLowerCase().includes('approv')
          if (!aApproved && bApproved) matchedUser = u
        }
      }
    }

    if (!matchedUser) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    if (matchedUser.archived === true) {
      return NextResponse.json({ error: 'Account not found. Please sign up first to create an account.' }, { status: 401 })
    }

    // Migrate legacy plaintext password to bcrypt hash in background
    const storedPw = String(matchedUser.password || '')
    if (!storedPw.startsWith('$2')) {
      bcrypt.hash(password, 10).then(async (hash) => {
        await supabase
          .from('users')
          .update({ password: hash })
          .eq('id', matchedUser!.id)
      }).catch(() => { /* non-blocking migration */ })
    }

    // Strip password before returning
    const { password: _pw, ...safeUser } = matchedUser as Record<string, unknown> & { password: string }

    const response = NextResponse.json({ user: safeUser }, { status: 200 })

    // Set HttpOnly, Secure, SameSite=Strict cookie bound to userId
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
