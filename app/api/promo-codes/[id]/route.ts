import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface PromoCodeInput {
  code: string
  label: string
  applies_to: 'cart' | 'item' | 'delivery'
  discount_percent: number | null
  discount_amount: number | null
  free_delivery: boolean
  min_purchase_amount: number | null
  min_quantity: number | null
  max_discount_amount: number | null
  max_usage: number | null
  is_active: boolean
  expires_at: string | null
  productIds: string[]
}

function validatePromoCode(body: Partial<PromoCodeInput>): string | null {
  if (!body.code || !body.code.trim()) return 'Code is required'
  if (!['cart', 'item', 'delivery'].includes(body.applies_to || '')) {
    return 'applies_to must be cart, item, or delivery'
  }
  const hasDiscountValue = !!body.discount_percent || !!body.discount_amount
  if (body.applies_to === 'delivery') {
    if (!body.free_delivery && !hasDiscountValue) {
      return 'Delivery offers need either free delivery or a discount percent/amount'
    }
  } else if (!hasDiscountValue) {
    return 'A discount percent or discount amount is required'
  }
  return null
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as Partial<PromoCodeInput>

    const validationError = validatePromoCode(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const code = body.code!.trim()

    const { data: existing } = await supabase.from('promo_codes').select('id, code')
    if (existing?.some((p) => p.id !== id && p.code.toLowerCase() === code.toLowerCase())) {
      return NextResponse.json({ error: 'A code with this name already exists' }, { status: 409 })
    }

    const { data: rows, error: updateError } = await supabase
      .from('promo_codes')
      .update({
        code,
        label: body.label?.trim() || null,
        applies_to: body.applies_to,
        discount_percent: body.discount_percent || null,
        discount_amount: body.discount_amount || null,
        free_delivery: body.free_delivery ?? false,
        min_purchase_amount: body.min_purchase_amount || null,
        min_quantity: body.min_quantity || null,
        max_discount_amount: body.max_discount_amount || null,
        max_usage: body.max_usage || null,
        is_active: body.is_active ?? true,
        expires_at: body.expires_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()

    if (updateError) throw updateError

    const { error: deleteScopeError } = await supabase.from('promo_code_products').delete().eq('promo_code_id', id)
    if (deleteScopeError) throw deleteScopeError

    if (body.applies_to === 'item' && Array.isArray(body.productIds) && body.productIds.length > 0) {
      const { error } = await supabase
        .from('promo_code_products')
        .insert(body.productIds.map((product_id) => ({ promo_code_id: id, product_id })))
      if (error) throw error
    }

    return NextResponse.json({ promoCode: rows[0] })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: `Failed to update promo code: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await supabase.from('promo_code_products').delete().eq('promo_code_id', id)

    const { error } = await supabase.from('promo_codes').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 })
  }
}
