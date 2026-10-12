import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  parseProductImportCsv,
  groupProductImportRows,
  buildVariantOptionValues,
  buildProductOptionsFromRows,
  type ProductCsvRow,
} from '@/lib/productCsvImport'
import { resolveSupplierMarketFromCountry } from '@/lib/supportedMarkets'

const SESSION_COOKIE = 'supplier_session'
const MAX_ROWS = 500
const IMPORT_ROLES = new Set(['admin', 'purchaser', 'manager', 'listing_agent'])

function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

function abbrevOptionValues(optionValues: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(optionValues).map(([k, v]) => [k, v.trim()])
  )
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE)?.value
    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const supabase = getAdminSupabase()
    const { data: actor, error: actorError } = await supabase
      .from('users')
      .select('id, role, country, stock_location_country')
      .eq('id', sessionId)
      .maybeSingle()

    if (actorError || !actor) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
    }

    const role = String(actor.role || '').toLowerCase()
    if (!IMPORT_ROLES.has(role)) {
      return NextResponse.json({ error: 'You do not have permission to import products.' }, { status: 403 })
    }

    const body = await request.json()
    const csvText = String(body.csvText || '')
    if (!csvText.trim()) {
      return NextResponse.json({ error: 'CSV content is required.' }, { status: 400 })
    }

    const parsed = parseProductImportCsv(csvText)
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'CSV has no data rows (need header + at least one row).' }, { status: 400 })
    }
    if (parsed.length > MAX_ROWS) {
      return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import.` }, { status: 400 })
    }

    const invalidRows = parsed.filter((r) => r.errors.length > 0)
    if (invalidRows.length > 0) {
      return NextResponse.json(
        {
          error: 'Fix validation errors before importing.',
          invalidRows: invalidRows.map((r) => ({ rowIndex: r.rowIndex, errors: r.errors })),
        },
        { status: 400 }
      )
    }

    const supplierIds = [...new Set(parsed.map((r) => r.supplier_user_id))]
    const { data: suppliers, error: supErr } = await supabase
      .from('users')
      .select('user_id, role, country, stock_location_country, shop_name_on_zambeel')
      .in('user_id', supplierIds)
      .eq('role', 'supplier')

    if (supErr) {
      return NextResponse.json({ error: supErr.message || 'Failed to verify suppliers.' }, { status: 500 })
    }

    const supplierMap = new Map(
      (suppliers || []).map((s) => [String(s.user_id), s])
    )

    const missingSuppliers = supplierIds.filter((id) => !supplierMap.has(id))
    if (missingSuppliers.length > 0) {
      return NextResponse.json(
        {
          error: `Unknown or non-supplier user_id: ${missingSuppliers.slice(0, 5).join(', ')}${missingSuppliers.length > 5 ? '…' : ''}`,
        },
        { status: 400 }
      )
    }

    if (role === 'purchaser') {
      const purchaserCountry = actor.country || actor.stock_location_country || ''
      const purchaserMarket = resolveSupplierMarketFromCountry(purchaserCountry)
      if (purchaserMarket) {
        for (const sid of supplierIds) {
          const s = supplierMap.get(sid)!
          const sc = s.country || s.stock_location_country || ''
          const sm = resolveSupplierMarketFromCountry(sc)
          if (sm && sm.code !== purchaserMarket.code) {
            return NextResponse.json(
              { error: `Supplier ${sid} is not in your country (${purchaserMarket.code}).` },
              { status: 403 }
            )
          }
        }
      }
    }

    const groups = groupProductImportRows(parsed)
    const now = new Date().toISOString()
    let productsCreated = 0
    let variantsCreated = 0
    const failures: { product_title: string; supplier_user_id: string; error: string }[] = []

    for (const group of groups) {
      try {
        const hasVariants = group.rows.length > 1 || group.rows.some((r) => r.size || r.color)
        const options = hasVariants ? buildProductOptionsFromRows(group.rows) : null

        const { data: product, error: productError } = await supabase
          .from('products')
          .insert([
            {
              product_title: group.product_title,
              brand_name: group.brand_name,
              material: group.material,
              fk_owned_by: group.supplier_user_id,
              image: group.image_urls,
              status: group.status,
              has_variants: hasVariants,
              options,
              created_at: now,
              updated_at: now,
            },
          ])
          .select('product_id')
          .single()

        if (productError || !product) {
          failures.push({
            product_title: group.product_title,
            supplier_user_id: group.supplier_user_id,
            error: productError?.message || 'Product insert failed',
          })
          continue
        }

        const productId = product.product_id
        productsCreated += 1

        const variantRows = group.rows.map((r: ProductCsvRow) => {
          const option_values = buildVariantOptionValues(r.size, r.color)
          const image =
            r.image_urls.length > 0 ? r.image_urls : group.image_urls?.length ? group.image_urls : null
          return {
            product_id: productId,
            option_values,
            option_values_abbrev: abbrevOptionValues(option_values),
            sku: r.sku || null,
            price: r.price,
            stock: r.stock,
            image,
            active: true,
            created_at: now,
            updated_at: now,
          }
        })

        const { data: insertedVariants, error: variantError } = await supabase
          .from('product_variants')
          .insert(variantRows)
          .select('variant_id, price, stock')
        if (variantError) {
          await supabase.from('products').delete().eq('product_id', productId)
          failures.push({
            product_title: group.product_title,
            supplier_user_id: group.supplier_user_id,
            error: variantError.message || 'Variant insert failed',
          })
          continue
        }

        const firstVariant = insertedVariants?.[0]
        if (firstVariant) {
          const firstRow = group.rows[0]
          await supabase
            .from('products')
            .update({
              variant_id: firstVariant.variant_id,
              variant_selling_price: firstVariant.price,
              variant_stock: firstVariant.stock,
              company_sku: firstRow?.sku || null,
              updated_at: now,
            })
            .eq('product_id', productId)
        }

        variantsCreated += variantRows.length
      } catch (err) {
        failures.push({
          product_title: group.product_title,
          supplier_user_id: group.supplier_user_id,
          error: err instanceof Error ? err.message : 'Unexpected error',
        })
      }
    }

    return NextResponse.json(
      {
        productsCreated,
        variantsCreated,
        groupsProcessed: groups.length,
        failures,
      },
      { status: failures.length === groups.length && groups.length > 0 ? 500 : 201 }
    )
  } catch (err) {
    console.error('[products/import-csv]', err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
