/**
 * Price History Helper Functions
 * 
 * Frontend-only functions to manage product price history
 * All operations connect directly to Supabase (no backend)
 */

import { supabase } from './supabase'

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
    // Validate that prices are different
    if (previousPrice === updatedPrice) {
      console.warn('Price did not change, skipping history entry')
      return null
    }

    const { data, error } = await supabase
      .from('price_history')
      .insert([{
        product_id: productId,
        variant_id: variantId,
        previous_price: previousPrice,
        updated_price: updatedPrice,
        created_by_supplier_id: createdBySupplierId,
        created_by_purchaser_id: createdByPurchaserId || null,
        status: status,
        created_at: new Date().toISOString()
      }])
      .select()
      .single()
    
    if (error) {
      console.error('Error creating price history entry:', error)
      return null
    }
    
    return data
  } catch (err) {
    console.error('Unexpected error creating price history entry:', err)
    return null
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
    let query = supabase
      .from('price_history')
      .select('*')
    
    // Only filter by status if not 'all'
    if (status !== 'all') {
      query = query.eq('status', status)
    }
    
    const { data: priceHistoryData, error: priceHistoryError } = await query.order('created_at', { ascending: false })
    
    if (priceHistoryError) {
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

