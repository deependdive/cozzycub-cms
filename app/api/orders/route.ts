import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export const PAGE_SIZE = 25

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

    let query = supabase.from('orders').select('*', { count: 'exact' })

    if (search) {
      const escaped = search.replace(/[%,]/g, '')
      query = query.or(`order_number.ilike.%${escaped}%,customer_name.ilike.%${escaped}%`)
    }
    if (from) query = query.gte('created_at', `${from}T00:00:00`)
    if (to) query = query.lte('created_at', `${to}T23:59:59.999`)

    const start = (page - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE - 1

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(start, end)

    if (error) throw error

    return NextResponse.json({ orders: data, total: count || 0, page, pageSize: PAGE_SIZE })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
