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

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const emailNormalized = String(email).trim().toLowerCase()
    const supabase = getAdminSupabase()

    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, archived, user_id, role, onboarded')
      .ilike('email', emailNormalized)
      .maybeSingle()

    if (existingUser && existingUser.archived !== true) {
      return NextResponse.json({ error: 'Email already exists. Please sign in instead.' }, { status: 409 })
    }

    if (existingUser && existingUser.archived === true) {
      // Restore archived account
      const { data: restoredUser, error: restoreError } = await supabase
        .from('users')
        .update({
          password,
          archived: false,
          onboarded: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select()
        .single()

      if (restoreError || !restoredUser) {
        return NextResponse.json({ error: 'Failed to restore account. Please try again.' }, { status: 500 })
      }

      const { password: _pw, ...safeUser } = restoredUser as Record<string, unknown> & { password: string }
      const response = NextResponse.json({ user: safeUser, restored: true }, { status: 200 })
      response.cookies.set(SESSION_COOKIE, String(restoredUser.id), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      })
      return response
    }

    // Create new account — password stored as plaintext so admin can look it up
    const { data, error: insertError } = await supabase
      .from('users')
      .insert([{
        email: emailNormalized,
        password,
        created_at: new Date().toISOString(),
        account_approval: 'Wait',
      }])
      .select()
      .single()

    if (insertError || !data) {
      return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 })
    }

    const { password: _pw, ...safeUser } = data as Record<string, unknown> & { password: string }
    const response = NextResponse.json({ user: safeUser }, { status: 201 })
    response.cookies.set(SESSION_COOKIE, String(data.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[auth/signup] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
