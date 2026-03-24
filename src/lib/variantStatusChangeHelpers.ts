import { supabase } from './supabase'

export interface VariantStatusChangeRequest {
  id: string
  product_id: number
  variant_id: number
  request_scope?: 'variant' | 'product'
  previous_active: boolean
  updated_active: boolean
  created_at: string
  created_by_supplier_id: string | null
  created_by_purchaser_id: number | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_at: string | null
  reviewed_by: string | null
}

export async function createVariantStatusChangeRequest(
  productId: number,
  variantId: number,
  previousActive: boolean,
  updatedActive: boolean,
  createdBySupplierId: string,
  createdByPurchaserId?: number | null,
  requestScope: 'variant' | 'product' = 'variant'
): Promise<VariantStatusChangeRequest | null> {
  try {
    if (previousActive === updatedActive) return null
    const insertPayload: any = {
      product_id: productId,
      variant_id: variantId,
      request_scope: requestScope,
      previous_active: previousActive,
      updated_active: updatedActive,
      created_by_supplier_id: createdBySupplierId,
      created_by_purchaser_id: createdByPurchaserId ?? null,
      status: 'pending',
    }

    const doInsert = async (payload: any) => {
      const { data, error } = await supabase
        .from('variant_status_change_requests')
        .insert([payload])
        .select()
        .single()
      return { data, error }
    }

    let { data, error } = await doInsert(insertPayload)

    if (error) {
      const msg = error?.message || ''

      // Defensive fallback: if DB schema is missing `request_scope`, retry without it.
      // This prevents the UI from hard-failing before migrations are applied.
      if (
        msg.toLowerCase().includes('request_scope') ||
        msg.toLowerCase().includes('schema cache') ||
        msg.toLowerCase().includes('column') ||
        msg.toLowerCase().includes('not found')
      ) {
        const { data: data2, error: error2 } = await doInsert({
          ...insertPayload,
          request_scope: undefined,
        })
        if (error2) {
          console.error('Error creating status change request (fallback):', error2)
          throw new Error(error2.message || 'Failed to create status change request')
        }
        return data2
      }

      console.error('Error creating variant status change request:', error)
      throw new Error(error.message || 'Failed to create status change request')
    }
    return data
  } catch (err) {
    console.error('Unexpected error creating variant status change request:', err)
    if (err instanceof Error) throw err
    throw new Error('Failed to create status change request')
  }
}

export async function fetchStatusRequestsByStatus(
  status: 'pending' | 'approved' | 'rejected' | 'all'
): Promise<VariantStatusChangeRequest[]> {
  try {
    let query = supabase.from('variant_status_change_requests').select('*')
    if (status !== 'all') query = query.eq('status', status)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
      console.error('Error fetching status change requests:', error)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Unexpected error fetching status change requests:', err)
    return []
  }
}

export async function approveStatusChangeRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  try {
    const { data: req, error: fetchErr } = await supabase
      .from('variant_status_change_requests')
      .select('*')
      .eq('id', requestId)
      .single()
    if (fetchErr || !req) return false

    const isProductScope = req.request_scope === 'product'

    // New system table
    const pvQuery = supabase
      .from('product_variants')
      .update({ active: req.updated_active, updated_at: new Date().toISOString() })
      .eq('product_id', req.product_id)
    const { error: pvErr } = isProductScope
      ? await pvQuery
      : await pvQuery.eq('variant_id', req.variant_id)

    if (isProductScope) {
      // Keep product-level status in sync for whole-product requests.
      await supabase
        .from('products')
        .update({
          status: req.updated_active ? 'active' : 'inactive',
          updated_at: new Date().toISOString(),
        })
        .eq('product_id', req.product_id)
    }

    // Legacy fallback
    if (pvErr) {
      const pQuery = supabase
        .from('products')
        .update({ active: req.updated_active, updated_at: new Date().toISOString() })
        .eq('product_id', req.product_id)
      const { error: pErr } = isProductScope
        ? await pQuery
        : await pQuery.eq('variant_id', req.variant_id)
      if (pErr) {
        console.error('Error applying status change request:', pErr)
        return false
      }
    }

    const { error: updErr } = await supabase
      .from('variant_status_change_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
      })
      .eq('id', requestId)
    if (updErr) return false
    return true
  } catch (err) {
    console.error('Unexpected error approving status change request:', err)
    return false
  }
}

export async function rejectStatusChangeRequest(
  requestId: string,
  reviewedBy: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('variant_status_change_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
      })
      .eq('id', requestId)
    if (error) return false
    return true
  } catch (err) {
    console.error('Unexpected error rejecting status change request:', err)
    return false
  }
}

export async function getPendingStatusChangeCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('variant_status_change_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

