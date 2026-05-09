export interface InventoryMatchRow {
  sku: string
  quantity: number
  warehouse_name: string
  warehouse_id?: number | null
  variant_id?: number | null
}

export interface InventoryLookupResult {
  normalizedSku: string
  matchedPrefix: string | null
  totalMatches: number
  warehouseGroups: Array<{
    warehouseName: string
    rows: InventoryMatchRow[]
    totalQuantity: number
  }>
}

function normalizeSku(input: string): string {
  return input.trim().toUpperCase()
}

export async function lookupInventoryBySkuPrefix(rawSku: string): Promise<InventoryLookupResult> {
  const normalizedSku = normalizeSku(rawSku)
  if (!normalizedSku) {
    return {
      normalizedSku: '',
      matchedPrefix: null,
      totalMatches: 0,
      warehouseGroups: [],
    }
  }

  const response = await fetch(`/api/product-availability-inventory?sku=${encodeURIComponent(normalizedSku)}`)
  if (!response.ok) {
    throw new Error('Failed to fetch inventory from Metabase')
  }

  const json = (await response.json()) as {
    normalizedSku: string
    matchedPrefix: string | null
    matches: InventoryMatchRow[]
  }

  const grouped = new Map<string, InventoryMatchRow[]>()
  ;(json.matches || []).forEach((row) => {
    const key = row.warehouse_name || 'Unknown'
    const existing = grouped.get(key) || []
    existing.push(row)
    grouped.set(key, existing)
  })

  const warehouseGroups = Array.from(grouped.entries()).map(([warehouseName, rows]) => ({
    warehouseName,
    rows,
    totalQuantity: rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
  }))

  return {
    normalizedSku: json.normalizedSku || normalizedSku,
    matchedPrefix: json.matchedPrefix || null,
    totalMatches: (json.matches || []).length,
    warehouseGroups,
  }
}

