import type { SupabaseClient } from '@supabase/supabase-js'

const NUMERIC_USER_ID = /^\d+$/

/**
 * Allocate the next numeric user_id (products.fk_owned_by uses users.user_id).
 * Prefers existing numeric IDs in the users table; falls back to timestamp suffix.
 */
export async function allocateNextUserId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(2000)

  if (error) {
    console.error('[allocateNextUserId] fetch failed:', error.message)
    return String(Date.now())
  }

  let max = 0
  for (const row of data || []) {
    const raw = String(row.user_id ?? '').trim()
    if (!NUMERIC_USER_ID.test(raw)) continue
    const n = parseInt(raw, 10)
    if (!Number.isNaN(n) && n > max) max = n
  }

  if (max > 0) return String(max + 1)
  return String(Date.now())
}

/** Ensure users.user_id is set after insert (DB trigger may be missing on admin-created rows). */
export async function ensureUserFriendlyId(
  supabase: SupabaseClient,
  userUuid: string,
  existingUserId?: string | null
): Promise<string> {
  const current = (existingUserId ?? '').trim()
  if (current) return current

  const { data: row } = await supabase
    .from('users')
    .select('user_id')
    .eq('id', userUuid)
    .maybeSingle()

  const fromDb = (row?.user_id ?? '').trim()
  if (fromDb) return fromDb

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await allocateNextUserId(supabase)
    const { data: updated, error } = await supabase
      .from('users')
      .update({ user_id: candidate, updated_at: new Date().toISOString() })
      .eq('id', userUuid)
      .is('user_id', null)
      .select('user_id')
      .maybeSingle()

    if (!error && updated?.user_id) return String(updated.user_id)

    if (error?.code === '23505') continue

    const { data: refetch } = await supabase
      .from('users')
      .select('user_id')
      .eq('id', userUuid)
      .maybeSingle()
    if (refetch?.user_id) return String(refetch.user_id)
  }

  throw new Error('Could not assign user_id for new supplier.')
}
