import { NextRequest, NextResponse } from 'next/server'
import { computeCart } from '@/lib/cart'

export async function GET(request: NextRequest, { params }: { params: Promise<{ cartId: string }> }) {
  try {
    const { cartId } = await params
    const cart = await computeCart(cartId)
    if (!cart) return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
    return NextResponse.json(cart)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 })
  }
}
