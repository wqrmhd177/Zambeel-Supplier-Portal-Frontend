import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword } = await request.json()

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password are required.' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const emailNormalized = String(email).trim().toLowerCase()
    const supabase = getAdminSupabase()

    // Check that an active (non-archived) account exists for this email
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, archived')
      .ilike('email', emailNormalized)
      .eq('archived', false)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 })
    }

    if (!existingUser) {
      // Return a generic message so we don't reveal whether an email exists
      return NextResponse.json({ success: true }, { status: 200 })
    }

    // Update password as plaintext
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password: newPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingUser.id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update password. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[auth/reset-password] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
