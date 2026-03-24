/**
 * Price History Helper Functions
 * 
 * Frontend-only functions to manage product price history
 * All operations connect directly to Supabase (no backend)
 */

import { supabase } from './supabase'
import { getPendingStatusChangeCount } from './variantStatusChangeHelpers'

export interface PriceHistoryEntry {
  id: string
  product_id: number
  variant_id: number
  previous_price: number
  updated_price: number
  created_at: string
  created_by_supplier_id: string | null
  created_by_purchaser_id: number | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_at: string | null
  reviewed_by: string | null
}

/**
 * Create a price history entry when a price is changed
 * For approval workflow: status defaults to 'pending'
 * For direct updates: pass status='approved'
 */
export async function createPriceHistoryEntry(
  productId: number,
  variantId: number,
  previousPrice: number,
  updatedPrice: number,
  createdBySupplierId: string,
  createdByPurchaserId?: number | null,
  status: 'pending' | 'approved' = 'pending'
): Promise<PriceHistoryEntry | null> {
  try {
    // Prices can come from inputs as strings at runtime, even if TS says number.
    // Normalize to numbers so equality/constraints behave correctly.
    const prev = Number(previousPrice)
    const upd = Number(updatedPrice)

    if (Number.isNaN(prev) || Number.isNaN(upd)) {
      console.error('Invalid price values for price_history insert', { previousPrice, updatedPrice })
      return null
    }

    // Validate that prices are different (numeric equality)
    if (prev === upd) {
      console.warn('Price did not change, skipping history entry')
      return null
    }

    const doInsert = async (payload: any) => {
      const { data, error } = await supabase
        .from('price_history')
        .insert([payload])
        .select()
        .single()
      return { data, error }
    }

    const withStatusPayload = {
      product_id: productId,
      variant_id: variantId,
      previous_price: prev,
      updated_price: upd,
      created_by_supplier_id: createdBySupplierId,
      created_by_purchaser_id: createdByPurchaserId || null,
      status,
      created_at: new Date().toISOString()
    }

    const withoutStatusPayload = {
      product_id: productId,
      variant_id: variantId,
      previous_price: prev,
      updated_price: upd,
      created_by_supplier_id: createdBySupplierId,
      created_by_purchaser_id: createdByPurchaserId || null,
      created_at: new Date().toISOString()
    }

    const { data, error } = await doInsert(withStatusPayload)
    if (error) {
      const msg = error?.message?.toLowerCase?.() || ''
      // If the DB schema hasn't been migrated yet, retry without `status`.
      if (msg.includes('status') && (msg.includes('column') || msg.includes('does not exist'))) {
        const { data: data2, error: error2 } = await doInsert(withoutStatusPayload)
        if (error2) {
          console.error('Error creating price history entry (fallback):', error2)
          throw new Error(error2.message || 'Failed to create price history entry')
        }
        return {
          ...(data2 as any),
          status,
          reviewed_at: null,
          reviewed_by: null
        } as PriceHistoryEntry
      }

      console.error('Error creating price history entry:', error)
      throw new Error(error.message || 'Failed to create price history entry')
    }

    return data as PriceHistoryEntry
  } catch (err) {
    console.error('Unexpected error creating price history entry:', err)
    if (err instanceof Error) throw err
    throw new Error('Failed to create price history entry')
  }
}

/**
 * Get all price history for a specific variant
 * Returns entries ordered by most recent first
 */
export async function getVariantPriceHistory(
  variantId: number
): Promise<PriceHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching variant price history:', error)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('Unexpected error fetching variant price history:', err)
    return []
  }
}

/**
 * Get all price history for a product (all variants)
 * Returns entries ordered by most recent first
 */
export async function getProductPriceHistory(
  productId: number
): Promise<PriceHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching product price history:', error)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('Unexpected error fetching product price history:', err)
    return []
  }
}

/**
 * Get price history with user information
 * Joins with users table to get user details
 */
export async function getVariantPriceHistoryWithUsers(
  variantId: number
): Promise<Array<PriceHistoryEntry & { supplier_name?: string, supplier_email?: string }>> {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select(`
        *,
        users:created_by_supplier_id (
          owner_name,
          email
        )
      `)
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching price history with users:', error)
      return []
    }
    
    // Transform the data to flatten user info
    return (data || []).map(entry => ({
      ...entry,
      supplier_name: entry.users?.owner_name || null,
      supplier_email: entry.users?.email || null
    }))
  } catch (err) {
    console.error('Unexpected error fetching price history with users:', err)
    return []
  }
}

/**
 * Get the most recent price change for a variant
 */
export async function getLatestPriceChange(
  variantId: number
): Promise<PriceHistoryEntry | null> {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('variant_id', variantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error) {
      // No history found is not an error
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching latest price change:', error)
      return null
    }
    
    return data
  } catch (err) {
    console.error('Unexpected error fetching latest price change:', err)
    return null
  }
}

/**
 * Get price history count for a variant
 */
export async function getPriceChangeCount(variantId: number): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('price_history')
      .select('id', { count: 'exact', head: true })
      .eq('variant_id', variantId)
    
    if (error) {
      console.error('Error counting price changes:', error)
      return 0
    }
    
    return count || 0
  } catch (err) {
    console.error('Unexpected error counting price changes:', err)
    return 0
  }
}

/**
 * Get all price changes by a specific supplier
 */
export async function getPriceChangesBySupplier(
  supplierId: string
): Promise<PriceHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('created_by_supplier_id', supplierId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching price changes by supplier:', error)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('Unexpected error fetching price changes by supplier:', err)
    return []
  }
}

/**
 * Get all price changes by a specific purchaser
 */
export async function getPriceChangesByPurchaser(
  purchaserId: number
): Promise<PriceHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('created_by_purchaser_id', purchaserId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching price changes by purchaser:', error)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('Unexpected error fetching price changes by purchaser:', err)
    return []
  }
}

/**
 * Calculate price change statistics for a variant
 */
export async function getVariantPriceStats(variantId: number): Promise<{
  totalChanges: number
  averageIncrease: number
  averageDecrease: number
  highestPrice: number
  lowestPrice: number
  currentPrice: number | null
} | null> {
  try {
    const history = await getVariantPriceHistory(variantId)
    
    if (history.length === 0) {
      return null
    }
    
    let totalIncrease = 0
    let totalDecrease = 0
    let increaseCount = 0
    let decreaseCount = 0
    let highestPrice = history[0].updated_price
    let lowestPrice = history[0].updated_price
    
    history.forEach(entry => {
      const change = entry.updated_price - entry.previous_price
      
      if (change > 0) {
        totalIncrease += change
        increaseCount++
      } else if (change < 0) {
        totalDecrease += Math.abs(change)
        decreaseCount++
      }
      
      highestPrice = Math.max(highestPrice, entry.updated_price, entry.previous_price)
      lowestPrice = Math.min(lowestPrice, entry.updated_price, entry.previous_price)
    })
    
    return {
      totalChanges: history.length,
      averageIncrease: increaseCount > 0 ? totalIncrease / increaseCount : 0,
      averageDecrease: decreaseCount > 0 ? totalDecrease / decreaseCount : 0,
      highestPrice,
      lowestPrice,
      currentPrice: history[0].updated_price // Most recent price
    }
  } catch (err) {
    console.error('Unexpected error calculating price stats:', err)
    return null
  }
}

// ============================================================================
// APPROVAL WORKFLOW FUNCTIONS
// ============================================================================

/**
 * Fetch all pending price change requests
 * Used by agents to see what needs approval
 */
export async function fetchPendingPriceRequests(): Promise<PriceHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching pending price requests:', error)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('Unexpected error fetching pending price requests:', err)
    return []
  }
}

/**
 * Fetch pending price requests with product details
 * Joins with products table to show product info
 */
export async function fetchPendingRequestsWithProducts(): Promise<Array<PriceHistoryEntry & {
  product_title?: string
  size?: string
  color?: string
  company_sku?: string
}>> {
  try {
    // First, get all pending price history entries
    const { data: priceHistoryData, error: priceHistoryError } = await supabase
      .from('price_history')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (priceHistoryError) {
      console.error('Error fetching pending requests:', priceHistoryError)
      return []
    }
    
    if (!priceHistoryData || priceHistoryData.length === 0) {
      return []
    }
    
    // Get unique variant_ids to fetch product details
    const variantIds = Array.from(new Set(priceHistoryData.map(entry => entry.variant_id)))
    
    // Fetch product details for these variants
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('variant_id, product_title, size, color, company_sku')
      .in('variant_id', variantIds)
    
    if (productsError) {
      console.error('Error fetching products:', productsError)
      // Return price history without product details
      return priceHistoryData
    }
    
    // Create a map of variant_id to product details
    const productsMap = new Map(
      (productsData || []).map(p => [p.variant_id, p])
    )
    
    // Merge price history with product details
    return priceHistoryData.map(entry => {
      const product = productsMap.get(entry.variant_id)
      return {
        ...entry,
        product_title: product?.product_title,
        size: product?.size,
        color: product?.color,
        company_sku: product?.company_sku
      }
    })
  } catch (err) {
    console.error('Unexpected error fetching pending requests with products:', err)
    return []
  }
}

/**
 * Approve a price change request
 * Updates the products table and marks the request as approved
 */
export async function approvePriceChange(
  priceHistoryId: string,
  reviewedBy: string
): Promise<boolean> {
  try {
    // First, get the price history entry to know what to update
    const { data: priceHistory, error: fetchError } = await supabase
      .from('price_history')
      .select('*')
      .eq('id', priceHistoryId)
      .single()
    
    if (fetchError || !priceHistory) {
      console.error('Error fetching price history entry:', fetchError)
      return false
    }
    
    // Update the products table with the new price
    const { error: updateProductError } = await supabase
      .from('products')
      .update({ 
        variant_selling_price: priceHistory.updated_price,
        updated_at: new Date().toISOString()
      })
      .eq('variant_id', priceHistory.variant_id)
      .eq('product_id', priceHistory.product_id)
    
    if (updateProductError) {
      console.error('Error updating product price:', updateProductError)
      return false
    }
    
    // Update the price_history status to approved
    const { error: updateHistoryError } = await supabase
      .from('price_history')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy
      })
      .eq('id', priceHistoryId)
    
    if (updateHistoryError) {
      console.error('Error updating price history status:', updateHistoryError)
      return false
    }
    
    return true
  } catch (err) {
    console.error('Unexpected error approving price change:', err)
    return false
  }
}

/**
 * Reject a price change request
 * Only updates the price_history status, does NOT change product price
 */
export async function rejectPriceChange(
  priceHistoryId: string,
  reviewedBy: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('price_history')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy
      })
      .eq('id', priceHistoryId)
    
    if (error) {
      console.error('Error rejecting price change:', error)
      return false
    }
    
    return true
  } catch (err) {
    console.error('Unexpected error rejecting price change:', err)
    return false
  }
}

/**
 * Get count of pending price change requests
 * Useful for showing notification badges
 */
export async function getPendingRequestCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('price_history')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    
    if (error) {
      console.error('Error counting pending requests:', error)
      return 0
    }
    
    return count || 0
  } catch (err) {
    console.error('Unexpected error counting pending requests:', err)
    return 0
  }
}

/**
 * Get count of price change requests with status 'pending'
 * Used for sidebar badge
 */
export async function getPendingApprovalsCount(): Promise<number> {
  try {
    let priceRows: any[] = []
    let priceQueryOk = true
    const { data: priceRowsMaybe, error: priceError } = await supabase
      .from('price_history')
      .select('product_id, variant_id, created_by_supplier_id, created_at, status')
      .eq('status', 'pending')

    if (priceError) {
      const msg = priceError?.message?.toLowerCase?.() || ''
      // If the DB doesn't yet have `status`, treat all price_history rows as pending for badge purposes.
      if (msg.includes('status') && (msg.includes('column') || msg.includes('does not exist'))) {
        priceQueryOk = false
        const { data: priceRowsNoStatus, error: priceError2 } = await supabase
          .from('price_history')
          .select('product_id, variant_id, created_by_supplier_id, created_at')

        if (priceError2) {
          console.error('Error fetching pending approvals count (fallback):', priceError2)
          return await getPendingStatusChangeCount()
        }

        priceRows = (priceRowsNoStatus || []).map((r: any) => ({ ...r, status: 'pending' }))
      } else {
        priceQueryOk = false
        console.error('Error fetching pending approvals count:', priceError)
        return await getPendingStatusChangeCount()
      }
    } else {
      priceRows = priceRowsMaybe || []
    }

    const { data: statusRows } = await supabase
      .from('variant_status_change_requests')
      .select('product_id, variant_id, request_scope, created_by_supplier_id, created_at, status')
      .eq('status', 'pending')

    const toMinuteBucket = (iso: string) => {
      const d = new Date(iso)
      d.setSeconds(0, 0)
      return d.toISOString()
    }
    const keys = new Set<string>()
    ;(priceRows || []).forEach((r: any) => {
      keys.add(`pending|variant|${r.product_id}|${r.variant_id}|${r.created_by_supplier_id ?? ''}|${toMinuteBucket(r.created_at)}`)
    })
    ;(statusRows || []).forEach((r: any) => {
      const scope = r.request_scope || 'variant'
      const scopeKey = scope === 'product'
        ? `${r.product_id}`
        : `${r.product_id}|${r.variant_id}`
      keys.add(`pending|${scope}|${scopeKey}|${r.created_by_supplier_id ?? ''}|${toMinuteBucket(r.created_at)}`)
    })
    return keys.size
  } catch (err) {
    console.error('Unexpected error fetching pending approvals count:', err)
    return await getPendingStatusChangeCount()
  }
}

/**
 * Fetch all price requests with a specific status
 * Used for filtering in the approvals page
 */
export async function fetchRequestsByStatus(
  status: 'pending' | 'approved' | 'rejected' | 'all'
): Promise<Array<PriceHistoryEntry & {
  product_title?: string
  size?: string
  color?: string
  company_sku?: string
}>> {
  try {
    // First, get price history entries
    let query = supabase.from('price_history').select('*')

    // Only filter by status if not 'all'
    if (status !== 'all') query = query.eq('status', status)

    const { data: priceHistoryData, error: priceHistoryError } = await query.order('created_at', { ascending: false })

    if (priceHistoryError) {
      const msg = priceHistoryError?.message?.toLowerCase?.() || ''
      // If the DB hasn't been migrated yet and `status` column is missing,
      // fetch everything and assume it matches the requested status.
      if (status !== 'all' && msg.includes('status') && (msg.includes('column') || msg.includes('does not exist'))) {
        const { data: priceHistoryData2, error: priceHistoryError2 } = await supabase
          .from('price_history')
          .select('*')
          .order('created_at', { ascending: false })

        if (priceHistoryError2) {
          console.error('Error fetching requests by status (fallback):', priceHistoryError2)
          return []
        }

        return (priceHistoryData2 || []).map((entry: any) => ({
          ...entry,
          status,
          reviewed_at: entry.reviewed_at ?? null,
          reviewed_by: entry.reviewed_by ?? null
        }))
      }

      console.error('Error fetching requests by status:', priceHistoryError)
      return []
    }
    
    if (!priceHistoryData || priceHistoryData.length === 0) {
      return []
    }
    
    // Get unique variant_ids to fetch product details
    const variantIds = Array.from(new Set(priceHistoryData.map(entry => entry.variant_id)))
    
    // Fetch product details for these variants
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('variant_id, product_title, size, color, company_sku')
      .in('variant_id', variantIds)
    
    if (productsError) {
      console.error('Error fetching products:', productsError)
      // Return price history without product details
      return priceHistoryData
    }
    
    // Create a map of variant_id to product details
    const productsMap = new Map(
      (productsData || []).map(p => [p.variant_id, p])
    )
    
    // Merge price history with product details
    return priceHistoryData.map(entry => {
      const product = productsMap.get(entry.variant_id)
      return {
        ...entry,
        product_title: product?.product_title,
        size: product?.size,
        color: product?.color,
        company_sku: product?.company_sku
      }
    })
  } catch (err) {
    console.error('Unexpected error fetching requests by status:', err)
    return []
  }
}

