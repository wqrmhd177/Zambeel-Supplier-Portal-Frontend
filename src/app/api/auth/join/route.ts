import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, phone, country, team } = await request.json()

    if (!email || !password || !fullName || !country || !team) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const emailNormalized = String(email).trim().toLowerCase()
    const supabase = getAdminSupabase()

    const { data: existing } = await supabase
      .from('users')
      .select('id, archived')
      .ilike('email', emailNormalized)
      .maybeSingle()

    if (existing && existing.archived !== true) {
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in instead.' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { error: insertError } = await supabase
      .from('users')
      .insert([{
        email: emailNormalized,
        password: hashedPassword,
        full_name: String(fullName).trim(),
        phone_number: phone ? String(phone).trim() : null,
        country,
        team,
        account_approval: 'Wait',
        onboarded: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[auth/join] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
