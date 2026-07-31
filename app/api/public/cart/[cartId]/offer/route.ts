import { NextRequest, NextResponse } from 'next/server'
import { cartSupabase, computeCart, isPromoEligible } from '@/lib/cart'

export async function POST(request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const { cartId } = await params
    const body = await request.json()
    const code = String(body.code || '').trim()

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const { data: cart } = await cartSupabase.from('carts').select('id').eq('id', cartId).maybeSingle()
    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 })

    const { data: promo } = await cartSupabase
      .from('promo_codes')
      .select('*')
      .ilike('code', code)
      .maybeSingle()

    if (!promo) {
      return NextResponse.json({ error: 'This code does not exist' }, { status: 404 })
    }

    const { data: rows } = await cartSupabase
      .from('cart_items')
      .select('quantity, products(selling_price)')
      .eq('cart_id', cartId)

    interface Row {
      quantity: number
      products: { selling_price: number } | null
    }
    const items = (rows as unknown as Row[]) || []
    const subtotal = items.reduce((sum, r) => sum + (r.products?.selling_price || 0) * r.quantity, 0)
    const totalQuantity = items.reduce((sum, r) => sum + r.quantity, 0)

    const { eligible, reason } = isPromoEligible(promo, subtotal, totalQuantity)
    if (!eligible) {
      return NextResponse.json({ error: reason || 'This code is not applicable to your cart' }, { status: 400 })
    }

    const { error } = await cartSupabase
      .from('carts')
      .update({ promo_code_id: promo.id, updated_at: new Date().toISOString() })
      .eq('id', cartId)
    if (error) throw error

    const updatedCart = await computeCart(cartId)
    return NextResponse.json(updatedCart)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to apply offer' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const { cartId } = await params

    const { data: cart } = await cartSupabase.from('carts').select('id').eq('id', cartId).maybeSingle()
    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 })

    const { error } = await cartSupabase
      .from('carts')
      .update({ promo_code_id: null, updated_at: new Date().toISOString() })
      .eq('id', cartId)
    if (error) throw error

    const updatedCart = await computeCart(cartId)
    return NextResponse.json(updatedCart)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to remove offer' }, { status: 500 })
  }
}
