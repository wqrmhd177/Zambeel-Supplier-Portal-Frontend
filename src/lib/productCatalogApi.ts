import type { GroupedProduct } from '@/lib/productHelpers'

export type ProductCatalogFilters = {
  ownerId?: string
  ownerIds?: string[]
  status?: string
}

export async function fetchProductCatalogViaApi(
  filters?: ProductCatalogFilters
): Promise<GroupedProduct[]> {
  const res = await fetch('/api/products/catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(filters ?? {}),
  })
  const data = (await res.json()) as { products?: GroupedProduct[]; error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load products.')
  }
  return data.products ?? []
}

export async function deleteProductViaApi(productId: number): Promise<void> {
  const res = await fetch('/api/products/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ productId }),
  })
  const data = (await res.json()) as { error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete product.')
  }
}
