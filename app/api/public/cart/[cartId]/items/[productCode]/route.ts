import { NextRequest, NextResponse } from 'next/server'
import { cartSupabase, computeCart } from '@/lib/cart'

async function resolveItem(cartId: string, productCode: string) {
  const { data: cart } = await cartSupabase.from('carts').select('id').eq('id', cartId).maybeSingle()
  if (!cart) return { error: NextResponse.json({ error: 'Cart not found' }, { status: 404 }) } as const

  const { data: product } = await cartSupabase
    .from('products')
    .select('id')
    .eq('product_code', productCode)
    .maybeSingle()
  if (!product) return { error: NextResponse.json({ error: 'Product not found' }, { status: 404 }) } as const

  return { productId: product.id } as const
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cartId: string; productCode: string }> }
) {
  try {
    const { cartId, productCode } = await params
    const body = await request.json()
    const quantity = typeof body.quantity === 'number' ? body.quantity : null
    if (quantity === null) {
      return NextResponse.json({ error: 'quantity is required' }, { status: 400 })
    }

    const resolved = await resolveItem(cartId, productCode)
    if ('error' in resolved) return resolved.error

    if (quantity <= 0) {
      const { error } = await cartSupabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cartId)
        .eq('product_id', resolved.productId)
      if (error) throw error
    } else {
      const { data: existing } = await cartSupabase
        .from('cart_items')
        .select('id')
        .eq('cart_id', cartId)
        .eq('product_id', resolved.productId)
        .maybeSingle()

      if (existing) {
        const { error } = await cartSupabase
          .from('cart_items')
          .update({ quantity, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await cartSupabase
          .from('cart_items')
          .insert([{ cart_id: cartId, product_id: resolved.productId, quantity }])
        if (error) throw error
      }
    }

    const cart = await computeCart(cartId)
    return NextResponse.json(cart)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to update cart item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cartId: string; productCode: string }> }
) {
  try {
    const { cartId, productCode } = await params

    const resolved = await resolveItem(cartId, productCode)
    if ('error' in resolved) return resolved.error

    const { error } = await cartSupabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId)
      .eq('product_id', resolved.productId)
    if (error) throw error

    const cart = await computeCart(cartId)
    return NextResponse.json(cart)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to remove cart item' }, { status: 500 })
  }
}
