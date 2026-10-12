/** Product types and legacy grouping (no Supabase client import). */

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
