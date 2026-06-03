import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'supplier_session'

function isAuthenticated(request: NextRequest): boolean {
  const val = request.cookies.get(SESSION_COOKIE)?.value
  return Boolean(val && val.length > 1 && val !== '0')
}

const METABASE_PUBLIC_URL =
  'https://zambeel.metabaseapp.com/public/question/050ce5ce-ce25-41e9-b34a-819933ec0235.json'

type MetabaseInventoryRow = {
  sku: string
  quantity: number
  warehouse_name: string
  warehouse_id?: number | null
  variant_id?: number | null
}

function normalizeSku(input: string): string {
  return input.trim().toUpperCase()
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawSku = request.nextUrl.searchParams.get('sku') || ''
    const normalizedSku = normalizeSku(rawSku)
    if (!normalizedSku) {
      return NextResponse.json(
        { error: 'sku query parameter is required' },
        { status: 400 }
      )
    }

    const prefix4 = normalizedSku.slice(0, 4)
    const prefix3 = normalizedSku.slice(0, 3)

    const response = await fetch(METABASE_PUBLIC_URL, { cache: 'no-store' })
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Unable to fetch Metabase inventory feed' },
        { status: 502 }
      )
    }

    const feed = (await response.json()) as MetabaseInventoryRow[]
    const rows = Array.isArray(feed) ? feed : []

    const byPrefix4 = rows.filter((row) =>
      String(row.sku || '').toUpperCase().startsWith(prefix4)
    )
    const prefixMatches =
      byPrefix4.length > 0
        ? byPrefix4
        : rows.filter((row) =>
            String(row.sku || '').toUpperCase().startsWith(prefix3)
          )

    // Show only SKUs with available inventory.
    const finalMatches = prefixMatches.filter(
      (row) => Number(row.quantity) > 0
    )

    return NextResponse.json({
      normalizedSku,
      matchedPrefix: byPrefix4.length > 0 ? prefix4 : prefixMatches.length > 0 ? prefix3 : null,
      matches: finalMatches,
    })
  } catch (error) {
    console.error('Error in product availability inventory lookup route:', error)
    return NextResponse.json(
      { error: 'Unexpected error fetching inventory' },
      { status: 500 }
    )
  }
}

