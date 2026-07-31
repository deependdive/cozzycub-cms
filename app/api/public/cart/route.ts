import { NextResponse } from 'next/server'
import { cartSupabase, computeCart } from '@/lib/cart'

export async function POST() {
  try {
    const { data, error } = await cartSupabase.from('carts').insert([{}]).select().single()
    if (error) throw error

    const cart = await computeCart(data.id)
    return NextResponse.json(cart, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to create cart' }, { status: 500 })
  }
}
