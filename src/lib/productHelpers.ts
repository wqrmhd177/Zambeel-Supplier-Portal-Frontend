import { supabase } from '@/lib/supabase'
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

export type ProductDbClient = SupabaseClient
export type { GroupedProduct, ProductRow, ProductVariantRow, VariantInfo }
export { groupProductsByProductId }

/**
 * Fetch all product rows, paging past PostgREST's 1000-row cap.
 */
export async function fetchAllProductRows(
  filters?: {
    ownerId?: string
    ownerIds?: string[]
    status?: string
  },
  db: ProductDbClient = supabase
): Promise<ProductRow[]> {
  const withFilters = (
    query: ReturnType<ReturnType<typeof db.from>['select']>
  ) => {
    let nextQuery = query
    if (filters?.ownerId) {
      nextQuery = nextQuery.eq('fk_owned_by', filters.ownerId)
    }
    if (filters?.status) {
      nextQuery = nextQuery.eq('status', filters.status)
    }
    return nextQuery
  }

  // If ownerIds was explicitly provided but is empty it means "this scope has no owners" —
  // return an empty list rather than falling through and fetching every product in the DB.
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
  productIds: number[],
  db: ProductDbClient = supabase
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

/**
 * Fetch products with their variants from the new product_variants table.
 * Returns GroupedProduct[] with variants loaded from product_variants.
 */
export async function fetchProductsWithVariants(
  filters?: {
    ownerId?: string
    ownerIds?: string[]
    status?: string
    productIds?: number[]
  },
  db: ProductDbClient = supabase
): Promise<GroupedProduct[]> {
  try {
    let productsData: ProductRow[]

    if (filters?.productIds && filters.productIds.length > 0) {
      productsData = await fetchAllByInChunks<ProductRow, number>(
        filters.productIds,
        POSTGREST_IN_CHUNK_SIZE,
        async (chunk, from, to) =>
          db
            .from('products')
            .select('*')
            .in('product_id', chunk)
            .order('created_at', { ascending: false })
            .range(from, to)
      )
    } else {
      productsData = await fetchAllProductRows(
        {
          ownerId: filters?.ownerId,
          ownerIds: filters?.ownerIds,
          status: filters?.status,
        },
        db
      )
    }

    if (!productsData || productsData.length === 0) {
      return []
    }

    const productIds = productsData.map(p => p.product_id)
    const variantsData = await fetchVariantsForProductIds(productIds, db)

    const variantsByProductId = new Map<number, ProductVariantRow[]>()
    if (variantsData) {
      variantsData.forEach((v: any) => {
        if (!variantsByProductId.has(v.product_id)) {
          variantsByProductId.set(v.product_id, [])
        }
        variantsByProductId.get(v.product_id)!.push(v)
      })
    }

    const grouped: GroupedProduct[] = productsData.map((p: any) => {
      const productVariants = variantsByProductId.get(p.product_id) || []
      
      const variants: VariantInfo[] = productVariants.map(v => ({
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

    return grouped
  } catch (err) {
    console.error('Unexpected error fetching products with variants:', err)
    throw err
  }
}

/**
 * Get count of "New Products" for agent listings: status is 'pending' in Supabase.
 * Used for sidebar badge on Listings.
 */
export async function getPendingListingsCount(): Promise<number> {
  try {
    const data = await fetchAllPages<{ product_id: number }>(async (from, to) =>
      supabase
        .from('products')
        .select('product_id')
        .eq('status', 'pending')
        .range(from, to)
    )
    if (data.length === 0) return 0
    const distinctProductIds = new Set(data.map((r) => r.product_id))
    return distinctProductIds.size
  } catch (err) {
    console.error('Unexpected error fetching pending listings count:', err)
    return 0
  }
}

/**
 * Get total listings count for sidebar badge (all statuses).
 * This should match the sum of Listings tabs.
 */
export async function getListingsSidebarCount(): Promise<number> {
  try {
    const data = await fetchAllPages<{ product_id: number }>(async (from, to) =>
      supabase.from('products').select('product_id').range(from, to)
    )
    if (data.length === 0) return 0
    const distinctProductIds = new Set(data.map((r) => r.product_id))
    return distinctProductIds.size
  } catch (err) {
    console.error('Unexpected error fetching listings sidebar count:', err)
    return 0
  }
}
