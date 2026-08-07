import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export const ORDER_STATUSES = [
  'order_received',
  'order_being_prepared',
  'order_ready_to_ship',
  'order_shipped',
  'order_delivered',
] as const

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', id).single()
    if (orderError) throw orderError

    const { data: items, error: itemsError } = await supabase.from('order_items').select('*').eq('order_id', id)
    if (itemsError) throw itemsError

    const { data: emails, error: emailsError } = await supabase
      .from('order_emails')
      .select('*')
      .eq('order_id', id)
      .order('triggered_at', { ascending: false })
    if (emailsError) throw emailsError

    return NextResponse.json({ order, items, emails })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 404 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as { status?: string }

    if (!body.status || !ORDER_STATUSES.includes(body.status as (typeof ORDER_STATUSES)[number])) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ order: data })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }
}
