export type DateFilterPreset = 'all' | 'today' | 'yesterday' | 'last7' | 'thisMonth'

export const DATE_FILTER_PRESETS: { value: DateFilterPreset; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'thisMonth', label: 'This Month' },
]

/** Parse search input into terms (supports comma/newline-separated bulk paste). */
export function parseSearchTerms(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.includes(',') || trimmed.includes('\n') || trimmed.includes('\r')) {
    return Array.from(new Set(trimmed.split(/[\n\r,]+/).map((s) => s.trim()).filter(Boolean)))
  }
  return [trimmed]
}

/** Serialize terms for API query param. */
export function serializeSearchTerms(terms: string[]): string {
  if (terms.length === 0) return ''
  if (terms.length === 1) return terms[0]
  return terms.join(',')
}

export function getDateRange(preset: DateFilterPreset): { dateFrom: string; dateTo: string } | null {
  if (preset === 'all') return null

  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const endOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  let from: Date
  let to: Date

  switch (preset) {
    case 'today':
      from = startOfDay(now)
      to = endOfDay(now)
      break
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      from = startOfDay(y)
      to = endOfDay(y)
      break
    }
    case 'last7': {
      const s = new Date(now)
      s.setDate(s.getDate() - 6)
      from = startOfDay(s)
      to = endOfDay(now)
      break
    }
    case 'thisMonth':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = endOfDay(now)
      break
    default:
      return null
  }

  return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
}

function parseDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

export function isDateInRange(
  iso: string | null | undefined,
  dateFrom: string | undefined,
  dateTo: string | undefined
): boolean {
  if (!dateFrom && !dateTo) return true
  const d = parseDateOnly(iso)
  if (!d) return false
  if (dateFrom && d < new Date(dateFrom)) return false
  if (dateTo && d > new Date(dateTo)) return false
  return true
}

/** Match order status to stat-card buckets (same logic as computeStats). */
export function matchesOrderStatusBucket(status: string, bucket: string): boolean {
  if (bucket === 'all') return true
  const s = status?.toLowerCase().trim() || ''
  if (s === 'approved' || s === 'cancelled' || s === 'confirmation pending') return false

  switch (bucket) {
    case 'toBeDispatch':
      return s.includes('dispatching in process')
    case 'inTransit':
      if (s.includes('undelivered')) return true
      if (s.includes('delivered')) return false
      if (s.includes('return')) return false
      if (s.includes('dispatching in process')) return false
      if (s.includes('shipped')) return true
      return true
    case 'delivered':
      return s.includes('delivered') && !s.includes('undelivered')
    case 'returning':
      return s.includes('return in transit')
    case 'returned':
      return s.includes('return') && !s.includes('return in transit')
    default:
      return s.includes(bucket.toLowerCase())
  }
}

/** Multi-term search against order/return row fields. */
export function rowMatchesSearch(
  row: {
    id?: number
    order_number?: string
    Courier_tracking_id?: string | null
    System_gen_tracking_id_removed?: string | null
    sku?: string
    title?: string
    full_name?: string
    phone?: string
  },
  terms: string[]
): boolean {
  if (terms.length === 0) return true
  const haystack = [
    row.order_number,
    row.Courier_tracking_id,
    row.System_gen_tracking_id_removed,
    row.sku,
    row.title,
    row.full_name,
    row.phone,
    row.id != null ? String(row.id) : '',
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())

  return terms.some((term) => {
    const q = term.toLowerCase()
    return haystack.some((h) => h.includes(q))
  })
}
