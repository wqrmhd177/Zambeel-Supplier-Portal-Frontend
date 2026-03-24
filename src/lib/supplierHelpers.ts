// Helper functions for purchaser-supplier relationships

import { supabase } from './supabase'

/**
 * Get purchaser's country (and optional stock_location_country) for pre-filling new supplier form.
 * Returns null for admin or if not found.
 */
export async function getPurchaserCountry(purchaserUuid: string): Promise<{ country: string; stockLocationCountry: string } | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('country, stock_location_country')
      .eq('id', purchaserUuid)
      .eq('role', 'purchaser')
      .single<{ country: string | null; stock_location_country: string | null }>()

    if (error || !data) return null
    const country = data.country || data.stock_location_country
    const stockLocationCountry = data.stock_location_country || data.country
    if (!country) return null
    return { country, stockLocationCountry: stockLocationCountry || country }
  } catch (err) {
    console.error('Error fetching purchaser country:', err)
    return null
  }
}

/**
 * Get purchaser's integer ID from their UUID
 * Used to link a new supplier to the purchaser who created them.
 * First tries to get a stable index from the purchasers list; if that fails (e.g. RLS),
 * returns a deterministic integer derived from the UUID so creation still succeeds.
 */
export async function getPurchaserIntegerId(purchaserUuid: string): Promise<number | null> {
  try {
    // Try: get all purchasers and use 1-based index (works when RLS allows reading purchasers)
    const { data: allPurchasers, error: purchasersError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'purchaser')
      .order('created_at', { ascending: true })

    if (!purchasersError && allPurchasers && allPurchasers.length > 0) {
      const index = allPurchasers.findIndex((p: { id: string }) => p.id === purchaserUuid)
      if (index !== -1) {
        return index + 1
      }
    }

    // Fallback: current user might not be in the list (e.g. RLS only returns own row or blocks).
    // Return a deterministic integer from the UUID so the same purchaser always gets the same ID.
    const hex = purchaserUuid.replace(/-/g, '').slice(0, 8)
    const num = parseInt(hex, 16)
    if (!Number.isNaN(num)) {
      return (num % 2147483647) + 1
    }
    return null
  } catch (err) {
    console.error('Error getting purchaser integer ID:', err)
    return null
  }
}

export interface SupplierInfo {
  id: string
  user_id: string
  email: string
  shop_name_on_zambeel: string | null
  country: string | null
  phone_number: string | null
  onboarded: boolean
  account_approval: string | null
  created_at: string
}

export interface PurchaserSupplier {
  supplier: SupplierInfo
  productCount: number
}

/**
 * Fetch all suppliers managed by a purchaser
 * Purchasers only see suppliers from their own country
 */
export async function fetchSuppliersForPurchaser(purchaserUuid: string): Promise<SupplierInfo[]> {
  try {
    // Get purchaser's country first using UUID
    const { data: purchaserData, error: purchaserError } = await supabase
      .from('users')
      .select('country, stock_location_country')
      .eq('id', purchaserUuid)
      .eq('role', 'purchaser')
      .single<{ country: string | null; stock_location_country: string | null }>()
    
    if (purchaserError) {
      console.error('Error fetching purchaser country:', purchaserError)
      return []
    }
    
    // Use country or stock_location_country (fallback)
    const purchaserCountry = purchaserData?.country || purchaserData?.stock_location_country
    
    if (!purchaserCountry) {
      console.error('Purchaser has no country set')
      return []
    }
    
    console.log('Fetching suppliers for purchaser country:', purchaserCountry)
    
    // Fetch suppliers from the same country only
    const { data, error } = await supabase
      .from('users')
      .select('id, user_id, email, shop_name_on_zambeel, country, phone_number, onboarded, account_approval, created_at')
      .eq('role', 'supplier')
      .eq('archived', false)
      .eq('account_approval', 'Approved')
      .eq('country', purchaserCountry)
      .order('shop_name_on_zambeel', { ascending: true })

    if (error) {
      console.error('Error fetching suppliers:', error)
      return []
    }
    
    console.log('Found suppliers:', data?.length || 0, data)

    return data || []
  } catch (err) {
    console.error('Unexpected error fetching suppliers:', err)
    return []
  }
}

/**
 * Fetch all products from suppliers in the purchaser's country.
 * Purchaser only sees products from suppliers in the same country (e.g. UAE purchaser → UAE suppliers' products).
 */
export async function fetchProductsForPurchaser(purchaserUuid: string) {
  try {
    const supplierList = await fetchSuppliersForPurchaser(purchaserUuid)
    if (supplierList.length === 0) {
      return []
    }

    const supplierUserIds = supplierList.map(s => s.user_id).filter(Boolean)
    if (supplierUserIds.length === 0) return []

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('fk_owned_by', supplierUserIds)
      .order('created_at', { ascending: false })

    if (productsError) {
      console.error('Error fetching products for purchaser:', productsError)
      return []
    }

    return productsData || []
  } catch (err) {
    console.error('Unexpected error fetching products for purchaser:', err)
    return []
  }
}

/**
 * Check if a purchaser can edit a product (product belongs to one of their suppliers)
 */
export async function canPurchaserEditProduct(purchaserId: number, productOwnerId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', productOwnerId)
      .eq('purchaser_id', purchaserId)
      .eq('role', 'supplier')
      .single()

    if (error || !data) {
      return false
    }

    return true
  } catch (err) {
    console.error('Error checking purchaser permission:', err)
    return false
  }
}

/**
 * Get supplier info by user_id
 */
export async function getSupplierByUserId(userId: string): Promise<SupplierInfo | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, user_id, email, shop_name_on_zambeel, country, phone_number, onboarded, account_approval, created_at')
      .eq('user_id', userId)
      .eq('role', 'supplier')
      .single()

    if (error || !data) {
      return null
    }

    return data
  } catch (err) {
    console.error('Error fetching supplier:', err)
    return null
  }
}

/**
 * Get product count for a supplier (distinct products, not variant rows).
 * Matches the Products tab definition so supplier card totals align with Products page stats.
 */
export async function getProductCountForSupplier(supplierUserId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('product_id')
      .eq('fk_owned_by', supplierUserId)

    if (error) {
      console.error('Error counting products:', error)
      return 0
    }

    const distinctProductIds = new Set((data || []).map((r) => r.product_id))
    return distinctProductIds.size
  } catch (err) {
    console.error('Unexpected error counting products:', err)
    return 0
  }
}


