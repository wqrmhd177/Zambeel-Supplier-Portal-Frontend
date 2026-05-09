import { NextRequest, NextResponse } from 'next/server'

const METABASE_ORDERS_URL =
  'https://zambeel.metabaseapp.com/public/question/deab3d2c-9fbc-4d1e-8400-e93d1513582e.json'

export interface MetabaseOrder {
  id: number
  order_number: string
  country: string
  full_name: string
  phone: string
  shipping: string
  city: string
  title: string
  sku: string
  quantity: number
  total_payable: number
  System_gen_tracking_id_removed: string | null
  Courier_tracking_id: string | null
  status: string
  substatus: string | null
  tag: string | null
  OP_remarks: string | null
  NDR_remarks: string | null
  bifurcation: string | null
  Order_date: string
  updatedAt: string
  activity_counter: number
  reschedule_date: string | null
  shipment_date: string | null
  approved_date: string | null
  shipment_date_log: string | null
  delivered_date: string | null
  Returned_date: string | null
  Undelivered_tag: string | null
  PLATFORM: string | null
  vendor_id: number
}

export async function GET(_request: NextRequest) {
  try {
    const response = await fetch(METABASE_ORDERS_URL, { cache: 'no-store' })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Unable to fetch orders from Metabase' },
        { status: 502 }
      )
    }

    const data = (await response.json()) as MetabaseOrder[]
    const rows = Array.isArray(data) ? data : []

    return NextResponse.json({ orders: rows, total: rows.length })
  } catch (error) {
    console.error('Error in orders route:', error)
    return NextResponse.json(
      { error: 'Unexpected error fetching orders' },
      { status: 500 }
    )
  }
}
