/**
 * Currency helpers: resolve currency from user's stock location country.
 */

import { supabase } from './supabase'
import { getCurrencyForCountry } from './countryData'

/**
 * Get currency code for a single user (by id or user_id).
 * Prefer passing the same id used in users table (userId from auth = users.id).
 */
export async function getCurrencyForUserId(userId: string | null): Promise<string> {
  const id = (userId ?? '').trim()
  if (!id) return 'USD'
  try {
    const select = 'stock_location_country,country'
    let data: { stock_location_country?: string; country?: string } | null = null
    let error: Error | null = null

    const byId = await supabase.from('users').select(select).eq('id', id).maybeSingle()
    if (byId.data) {
      data = byId.data
    } else if (byId.error) {
      error = byId.error
    }
    if (!data) {
      const byUserId = await supabase.from('users').select(select).eq('user_id', id).maybeSingle()
      if (byUserId.data) data = byUserId.data
      else if (byUserId.error) error = byUserId.error
    }
    if (!data) return 'USD'
    const country = (data.stock_location_country || data.country || '').trim()
    return getCurrencyForCountry(country)
  } catch {
    return 'USD'
  }
}

/**
 * Get currency codes for multiple users (by user_id / id / fk_owned_by).
 * Returns Map<userId, currencyCode>. Lookup by stock_location_country (fallback: country).
 */
export async function getCurrenciesForUserIds(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return map
  try {
    const addRow = (row: { user_id?: string; id?: string; stock_location_country?: string; country?: string }) => {
      const country = (row.stock_location_country || row.country || '').trim()
      const currency = getCurrencyForCountry(country)
      if (row.user_id) map.set(row.user_id, currency)
      if (row.id) map.set(row.id, currency)
    }
    let { data, error } = await supabase
      .from('users')
      .select('user_id, id, stock_location_country, country')
      .in('user_id', unique)
    if (!error && data) data.forEach(addRow)
    const missing = unique.filter((id) => !map.has(id))
    if (missing.length > 0) {
      const { data: dataById, error: errById } = await supabase
        .from('users')
        .select('user_id, id, stock_location_country, country')
        .in('id', missing)
      if (!errById && dataById) dataById.forEach(addRow)
    }
  } catch {
    // ignore
  }
  return map
}
