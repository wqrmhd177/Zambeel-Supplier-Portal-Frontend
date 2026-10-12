/** Zambeel supplier / purchaser markets (Add Supplier + currency). */
export type SupplierMarketCode =
  | 'PK'
  | 'UAE'
  | 'KSA'
  | 'Qatar'
  | 'Kuwait'
  | 'Bahrain'
  | 'Oman'
  | 'Iraq'
  | 'USA'

export interface SupplierMarket {
  code: SupplierMarketCode
  /** Shown in dropdown after code, e.g. "PK — Pakistan" */
  label: string
  /** Value stored in users.country and users.stock_location_country */
  dbCountry: string
  currency: string
  /** Other country strings that should map to this market (legacy rows). */
  aliases: string[]
}

export const SUPPLIER_MARKETS: readonly SupplierMarket[] = [
  {
    code: 'PK',
    label: 'Pakistan',
    dbCountry: 'Pakistan',
    currency: 'PKR',
    aliases: ['pak', 'pakistan'],
  },
  {
    code: 'UAE',
    label: 'United Arab Emirates',
    dbCountry: 'United Arab Emirates',
    currency: 'AED',
    aliases: ['uae', 'united arab emirates', 'emirates'],
  },
  {
    code: 'KSA',
    label: 'Saudi Arabia',
    dbCountry: 'Saudia Arabia',
    currency: 'SAR',
    aliases: ['ksa', 'saudi arabia', 'saudia arabia'],
  },
  {
    code: 'Qatar',
    label: 'Qatar',
    dbCountry: 'Qatar',
    currency: 'QAR',
    aliases: ['qatar', 'qtr'],
  },
  {
    code: 'Kuwait',
    label: 'Kuwait',
    dbCountry: 'Kuwait',
    currency: 'KWD',
    aliases: ['kuwait', 'kwt'],
  },
  {
    code: 'Bahrain',
    label: 'Bahrain',
    dbCountry: 'Bahrain',
    currency: 'BHD',
    aliases: ['bahrain', 'bhr'],
  },
  {
    code: 'Oman',
    label: 'Oman',
    dbCountry: 'Oman',
    currency: 'OMR',
    aliases: ['oman', 'omn'],
  },
  {
    code: 'Iraq',
    label: 'Iraq',
    dbCountry: 'Iraq',
    currency: 'IQD',
    aliases: ['iraq', 'irq'],
  },
  {
    code: 'USA',
    label: 'United States',
    dbCountry: 'United States',
    currency: 'USD',
    aliases: ['usa', 'us', 'united states', 'u.s.a.', 'u.s.'],
  },
] as const

/** Must match Supabase `users.check_currency_valid` (USD requires SQL migration). */
export const DB_ALLOWED_USER_CURRENCIES = [
  'PKR',
  'AED',
  'SAR',
  'QAR',
  'KWD',
  'BHD',
  'OMR',
  'IQD',
  'USD',
] as const

export type DbAllowedUserCurrency = (typeof DB_ALLOWED_USER_CURRENCIES)[number]

export function isDbAllowedUserCurrency(code: string): code is DbAllowedUserCurrency {
  return (DB_ALLOWED_USER_CURRENCIES as readonly string[]).includes(code.trim().toUpperCase())
}

export function getSupplierMarketByDbCountry(dbCountry: string): SupplierMarket | undefined {
  const trimmed = dbCountry.trim()
  if (!trimmed) return undefined
  return SUPPLIER_MARKETS.find(
    (m) => m.dbCountry.toLowerCase() === trimmed.toLowerCase()
  )
}

/** Map purchaser/supplier country text (incl. PK, UAE, KSA) to a supported market. */
export function resolveSupplierMarketFromCountry(input: string): SupplierMarket | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const lower = trimmed.toLowerCase()

  const byCode = SUPPLIER_MARKETS.find((m) => m.code.toLowerCase() === lower)
  if (byCode) return byCode

  for (const market of SUPPLIER_MARKETS) {
    if (market.dbCountry.toLowerCase() === lower) return market
    if (market.aliases.some((a) => a === lower)) return market
  }

  return null
}

export function getCurrencyForMarketDbCountry(dbCountry: string): string {
  return getSupplierMarketByDbCountry(dbCountry)?.currency ?? ''
}

export function formatSupplierMarketOption(market: SupplierMarket): string {
  return `${market.code} — ${market.label}`
}

/** Resolve market from any country string (code, alias, or db name). */
export function resolveSupplierMarket(input: string): SupplierMarket | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  return resolveSupplierMarketFromCountry(trimmed) ?? getSupplierMarketByDbCountry(trimmed) ?? null
}

/**
 * Country + currency safe for `users` insert (canonical dbCountry + allowed currency).
 */
export function resolveMarketForUserInsert(countryInput: string):
  | { ok: true; market: SupplierMarket; dbCountry: string; currency: DbAllowedUserCurrency }
  | { ok: false; error: string } {
  const market = resolveSupplierMarket(countryInput)
  if (!market) {
    return {
      ok: false,
      error:
        'Country must be one of: PK, UAE, KSA, Qatar, Kuwait, Bahrain, Oman, Iraq, USA.',
    }
  }

  const currency = market.currency.trim().toUpperCase()

  if (!isDbAllowedUserCurrency(currency)) {
    return {
      ok: false,
      error: `Currency ${currency} is not allowed for new suppliers. Contact support.`,
    }
  }

  return {
    ok: true,
    market,
    dbCountry: market.dbCountry,
    currency,
  }
}
