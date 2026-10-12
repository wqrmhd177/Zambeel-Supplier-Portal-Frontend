/**
 * Server-side product catalog fetch (service role). Avoids importing @/lib/supabase at module load.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchAllByInChunks,
  fetchAllPages,
  POSTGREST_IN_CHUNK_SIZE,
} from '@/lib/supabasePagination'
import {
  groupProductsByProductId,
  type GroupedProduct,
  type ProductRow,
  type ProductVariantRow,
  type VariantInfo,
} from '@/lib/productTypes'

export type { GroupedProduct }

async function fetchAllProductRows(
  db: SupabaseClient,
  filters?: {
    ownerId?: string
    ownerIds?: string[]
    status?: string
  }
): Promise<ProductRow[]> {
  const withFilters = (query: ReturnType<ReturnType<typeof db.from>['select']>) => {
    let nextQuery = query
    if (filters?.ownerId) {
      nextQuery = nextQuery.eq('fk_owned_by', filters.ownerId)
    }
    if (filters?.status) {
      nextQuery = nextQuery.eq('status', filters.status)
    }
    return nextQuery
  }

  if (filters?.ownerIds !== undefined) {
    if (filters.ownerIds.length === 0) return []
    const rows = await fetchAllByInChunks<ProductRow, string>(
      filters.ownerIds,
      POSTGREST_IN_CHUNK_SIZE,
      async (chunk, from, to) =>
        withFilters(db.from('products').select('*'))
          .in('fk_owned_by', chunk)
          .order('created_at', { ascending: false })
          .range(from, to)
    )
    return rows.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  return fetchAllPages<ProductRow>(async (from, to) =>
    withFilters(db.from('products').select('*'))
      .order('created_at', { ascending: false })
      .range(from, to)
  )
}

async function fetchVariantsForProductIds(
  db: SupabaseClient,
  productIds: number[]
): Promise<ProductVariantRow[]> {
  if (productIds.length === 0) return []

  try {
    return await fetchAllByInChunks<ProductVariantRow, number>(
      productIds,
      POSTGREST_IN_CHUNK_SIZE,
      async (chunk, from, to) =>
        db
          .from('product_variants')
          .select('*')
          .in('product_id', chunk)
          .range(from, to)
    )
  } catch (err) {
    console.error('Error fetching variants:', err)
    return []
  }
}

async function fetchProductsWithVariants(
  db: SupabaseClient,
  filters?: {
    ownerId?: string
    ownerIds?: string[]
    status?: string
  }
): Promise<GroupedProduct[]> {
  const productsData = await fetchAllProductRows(db, filters)
  if (!productsData.length) return []

  const productIds = productsData.map((p) => p.product_id)
  const variantsData = await fetchVariantsForProductIds(db, productIds)

  const variantsByProductId = new Map<number, ProductVariantRow[]>()
  variantsData.forEach((v) => {
    if (!variantsByProductId.has(v.product_id)) {
      variantsByProductId.set(v.product_id, [])
    }
    variantsByProductId.get(v.product_id)!.push(v)
  })

  return productsData.map((p) => {
    const productVariants = variantsByProductId.get(p.product_id) || []
    const variants: VariantInfo[] = productVariants.map((v) => ({
      variant_id: v.variant_id,
      bar_code: null,
      size: null,
      size_category: null,
      color: null,
      option_values: v.option_values,
      sku: v.sku,
      variant_selling_price: v.price,
      variant_stock: v.stock,
      company_sku: null,
      active: v.active,
      image: v.image,
    }))

    return {
      product_id: p.product_id,
      product_title: p.product_title,
      image: p.image,
      bar_code: p.bar_code,
      fk_owned_by: p.fk_owned_by,
      status: p.status,
      created_at: p.created_at,
      updated_at: p.updated_at,
      has_variants: p.has_variants,
      options: p.options,
      variants,
    }
  })
}

export async function fetchMergedProductCatalog(
  db: SupabaseClient,
  filters?: {
    ownerId?: string
    ownerIds?: string[]
    status?: string
  }
): Promise<GroupedProduct[]> {
  const legacyData = await fetchAllProductRows(db, filters)
  const legacyGrouped = groupProductsByProductId(legacyData)
  const newGrouped = await fetchProductsWithVariants(db, filters)

  const mergedMap = new Map<number, GroupedProduct>()
  legacyGrouped.forEach((p) => mergedMap.set(p.product_id, p))
  newGrouped.forEach((p) => {
    if (p.variants.length > 0) {
      mergedMap.set(p.product_id, p)
    }
  })

  return Array.from(mergedMap.values())
}
