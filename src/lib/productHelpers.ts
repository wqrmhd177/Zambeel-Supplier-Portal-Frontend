// Helper function to group product rows by product_id
// Since products with multiple variants now have multiple rows,
// we need to group them together for display

export interface ProductRow {
  product_id: number
  product_title: string
  image: string | string[] | null // JSONB: can be array of URLs or single string (backward compatibility)
  bar_code: string
  fk_owned_by: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  // Variant fields (nullable for products without variants)
  variant_id: number | null
  size: string | null
  color: string | null
  ml: string | null
  variant_selling_price: number | null
  variant_stock: number | null
  company_sku: string | null
}

export interface GroupedProduct {
  product_id: number
  product_title: string
  image: string | string[] | null // JSONB: can be array of URLs or single string (backward compatibility)
  bar_code: string
  fk_owned_by: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  variants: VariantInfo[]
}

export interface VariantInfo {
  variant_id: number
  bar_code: string | null
  size: string | null
  color: string | null
  ml: string | null
  variant_selling_price: number
  variant_stock: number
  company_sku: string | null
}

/**
 * Groups product rows by product_id.
 * Products with multiple variants will have multiple rows that get grouped together.
 * Products without variants will have variant fields as NULL.
 */
export function groupProductsByProductId(rows: ProductRow[]): GroupedProduct[] {
  const grouped = new Map<number, GroupedProduct>()

  rows.forEach((row) => {
    if (!grouped.has(row.product_id)) {
      // First row for this product - create the base product entry
      grouped.set(row.product_id, {
        product_id: row.product_id,
        product_title: row.product_title,
        image: row.image, // JSONB: can be array or string
        bar_code: row.bar_code,
        fk_owned_by: row.fk_owned_by,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        variants: [],
      })
    }

    const product = grouped.get(row.product_id)!

    // If this row has variant_id, add it as a variant
    // Products without variants still have variant_id (auto-generated), but size/color/ml are NULL
    if (row.variant_id) {
      product.variants.push({
        variant_id: row.variant_id,
        bar_code: row.bar_code,
        size: row.size,
        color: row.color,
        ml: row.ml,
        variant_selling_price: row.variant_selling_price || 0,
        variant_stock: row.variant_stock || 0,
        company_sku: row.company_sku,
      })
    }
  })

  return Array.from(grouped.values())
}
