import { supabase } from '@/lib/supabase'

export interface ProductRow {
  product_id: number
  product_title: string
  image: string | string[] | null
  bar_code: string
  fk_owned_by: string
  status: 'pending' | 'active' | 'inactive' | 'rejected'
  created_at: string
  updated_at: string
  has_variants?: boolean
  options?: Array<{ name: string; values: string[] }> | null
  variant_id: number | null
  size: string | null
  size_category: string | null
  color: string | null
  variant_selling_price: number | null
  variant_stock: number | null
  company_sku: string | null
  active?: boolean | null
}

export interface ProductVariantRow {
  variant_id: number
  product_id: number
  option_values: Record<string, string>
  sku: string | null
  price: number
  stock: number
  image: string[] | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface GroupedProduct {
  product_id: number
  product_title: string
  image: string | string[] | null
  bar_code: string
  fk_owned_by: string
  status: 'pending' | 'active' | 'inactive' | 'rejected'
  created_at: string
  updated_at: string
  has_variants?: boolean
  options?: Array<{ name: string; values: string[] }> | null
  variants: VariantInfo[]
}

export interface VariantInfo {
  variant_id: number
  bar_code: string | null
  size: string | null
  size_category: string | null
  color: string | null
  option_values?: Record<string, string>
  sku?: string | null
  variant_selling_price: number
  variant_stock: number
  company_sku: string | null
  active?: boolean
  image?: string[] | null
}

/**
 * Fetch products with their variants from the new product_variants table.
 * Returns GroupedProduct[] with variants loaded from product_variants.
 */
export async function fetchProductsWithVariants(
  filters?: {
    ownerId?: string
    status?: string
    productIds?: number[]
  }
): Promise<GroupedProduct[]> {
  try {
    let productsQuery = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.ownerId) {
      productsQuery = productsQuery.eq('fk_owned_by', filters.ownerId)
    }
    if (filters?.status) {
      productsQuery = productsQuery.eq('status', filters.status)
    }
    if (filters?.productIds && filters.productIds.length > 0) {
      productsQuery = productsQuery.in('product_id', filters.productIds)
    }

    const { data: productsData, error: productsError } = await productsQuery

    if (productsError) {
      console.error('Error fetching products:', productsError)
      return []
    }

    if (!productsData || productsData.length === 0) {
      return []
    }

    const productIds = productsData.map(p => p.product_id)

    const { data: variantsData, error: variantsError } = await supabase
      .from('product_variants')
      .select('*')
      .in('product_id', productIds)

    if (variantsError) {
      console.error('Error fetching variants:', variantsError)
    }

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
    return []
  }
}

/**
 * Groups legacy product rows by product_id (for backward compatibility).
 * Products with multiple variants will have multiple rows that get grouped together.
 */
export function groupProductsByProductId(rows: ProductRow[]): GroupedProduct[] {
  const grouped = new Map<number, GroupedProduct>()

  rows.forEach((row) => {
    if (!grouped.has(row.product_id)) {
      grouped.set(row.product_id, {
        product_id: row.product_id,
        product_title: row.product_title,
        image: row.image,
        bar_code: row.bar_code,
        fk_owned_by: row.fk_owned_by,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        has_variants: row.has_variants,
        options: row.options,
        variants: [],
      })
    }

    const product = grouped.get(row.product_id)!

    if (row.variant_id) {
      product.variants.push({
        variant_id: row.variant_id,
        bar_code: row.bar_code,
        size: row.size,
        size_category: row.size_category,
        color: row.color,
        variant_selling_price: row.variant_selling_price || 0,
        variant_stock: row.variant_stock || 0,
        company_sku: row.company_sku,
        active: row.active ?? true,
      })
    }
  })

  return Array.from(grouped.values())
}

/**
 * Get count of "New Products" for agent listings: status is 'pending' in Supabase.
 * Used for sidebar badge on Listings.
 */
export async function getPendingListingsCount(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('product_id')
      .eq('status', 'pending')

    if (error) {
      console.error('Error fetching pending listings count:', error)
      return 0
    }
    if (!data || data.length === 0) return 0
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
    const { data, error } = await supabase
      .from('products')
      .select('product_id')

    if (error) {
      console.error('Error fetching listings sidebar count:', error)
      return 0
    }
    if (!data || data.length === 0) return 0
    const distinctProductIds = new Set(data.map((r) => r.product_id))
    return distinctProductIds.size
  } catch (err) {
    console.error('Unexpected error fetching listings sidebar count:', err)
    return 0
  }
}
