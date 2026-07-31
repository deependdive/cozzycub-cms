import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('code, label, applies_to, min_purchase_amount, min_quantity, expires_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    const now = new Date()
    const offers = (data || [])
      .filter((p) => !p.expires_at || new Date(p.expires_at) >= now)
      .map((p) => ({
        code: p.code,
        label: p.label,
        appliesTo: p.applies_to,
        minPurchaseAmount: p.min_purchase_amount,
        minQuantity: p.min_quantity,
      }))

    return NextResponse.json({ offers })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}
