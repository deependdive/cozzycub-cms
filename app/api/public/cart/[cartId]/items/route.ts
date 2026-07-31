import { NextRequest, NextResponse } from 'next/server'
import { cartSupabase, computeCart } from '@/lib/cart'

export async function POST(request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const { cartId } = await params
    const body = await request.json()
    const productCode = String(body.productCode || '').trim()
    const quantity = typeof body.quantity === 'number' && body.quantity > 0 ? body.quantity : 1

    if (!productCode) {
      return NextResponse.json({ error: 'productCode is required' }, { status: 400 })
    }

    const { data: cart } = await cartSupabase.from('carts').select('id').eq('id', cartId).maybeSingle()
    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 })

    const { data: product } = await cartSupabase
      .from('products')
      .select('id')
      .eq('product_code', productCode)
      .maybeSingle()
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const { data: existing } = await cartSupabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', product.id)
      .maybeSingle()

    if (existing) {
      const { error } = await cartSupabase
        .from('cart_items')
        .update({ quantity: existing.quantity + quantity, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await cartSupabase
        .from('cart_items')
        .insert([{ cart_id: cartId, product_id: product.id, quantity }])
      if (error) throw error
    }

    const updatedCart = await computeCart(cartId)
    return NextResponse.json(updatedCart, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to add item to cart' }, { status: 500 })
  }
}
