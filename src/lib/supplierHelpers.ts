// Helper functions for purchaser-supplier relationships

import { supabase } from './supabase'

/**
 * Get purchaser's integer ID from their UUID
 * This assumes purchasers have an integer ID field (like purchaser_id or a sequential ID)
 * If your users table has a different integer ID field, update this function
 */
export async function getPurchaserIntegerId(purchaserUuid: string): Promise<number | null> {
  try {
    // First, try to get purchaser_id if it exists as an integer field on the purchaser's own record
    // Or we can use a sequence/row number approach
    // For now, we'll query the user and use their purchaser_id if they are a purchaser
    // But actually, purchasers don't have purchaser_id set (only suppliers do)
    
    // Alternative: If you have an integer ID field in users table, use that
    // For now, let's assume we need to get it from a separate field or calculate it
    
    // Check if user is a purchaser and get their integer ID
    // This might need to be adjusted based on your actual schema
    const { data, error } = await supabase
      .from('users')
      .select('purchaser_id') // This won't work for purchasers themselves
      .eq('id', purchaserUuid)
      .eq('role', 'purchaser')
      .single()
    
    // Actually, purchasers don't have purchaser_id. We need a different approach.
    // Let's query for an integer ID field. If your users table has an auto-increment integer ID,
    // we can use that. Otherwise, we might need to add one.
    
    // For now, let's use a workaround: get the row number or use a sequence
    // But the best solution is to have an integer ID field in users table
    
    // Temporary solution: Query all purchasers and find the index
    // This is not ideal but works if we don't have an integer ID field
    const { data: allPurchasers, error: purchasersError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'purchaser')
      .order('created_at', { ascending: true })
    
    if (purchasersError || !allPurchasers) {
      console.error('Error fetching purchasers:', purchasersError)
      return null
    }
    
    // Find the index of this purchaser (1-based)
    const index = allPurchasers.findIndex(p => p.id === purchaserUuid)
    if (index === -1) {
      return null
    }
    
    return index + 1 // Return 1-based integer ID
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
 * Get product count for a supplier
 */
export async function getProductCountForSupplier(supplierUserId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('products')
      .select('product_id', { count: 'exact', head: true })
      .eq('fk_owned_by', supplierUserId)

    if (error) {
      console.error('Error counting products:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('Unexpected error counting products:', err)
    return 0
  }
}


