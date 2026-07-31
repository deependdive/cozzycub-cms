import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export const DEFAULT_SHIPPING_FEE = 49

interface PromoCode {
  id: string
  code: string
  label: string | null
  applies_to: 'cart' | 'item' | 'delivery'
  discount_percent: number | null
  discount_amount: number | null
  free_delivery: boolean
  min_purchase_amount: number | null
  min_quantity: number | null
  max_discount_amount: number | null
  max_usage: number | null
  usage_count: number
  is_active: boolean
  expires_at: string | null
}

export interface CartItemResponse {
  productCode: string
  name: string
  imageUrl: string | null
  quantity: number
  unitPrice: number
  unitMsrp: number
  lineTotal: number
  lineSlashTotal: number
}

export interface CartResponse {
  cartId: string
  items: CartItemResponse[]
  itemCount: number
  subtotal: number
  slashSubtotal: number
  savedAmount: number
  shippingFee: number
  offer: { code: string; label: string | null; appliesTo: string; discountAmount: number } | null
  toPay: number
}

export function isPromoEligible(
  promo: PromoCode,
  subtotal: number,
  totalQuantity: number
): { eligible: boolean; reason?: string } {
  if (!promo.is_active) return { eligible: false, reason: 'This code is no longer active' }
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { eligible: false, reason: 'This code has expired' }
  }
  if (promo.max_usage !== null && promo.usage_count >= promo.max_usage) {
    return { eligible: false, reason: 'This code has reached its usage limit' }
  }
  if (promo.min_purchase_amount !== null && subtotal < promo.min_purchase_amount) {
    return { eligible: false, reason: `Minimum cart value for this code is ₹${promo.min_purchase_amount}` }
  }
  if (promo.min_quantity !== null && totalQuantity < promo.min_quantity) {
    return { eligible: false, reason: `This code needs at least ${promo.min_quantity} items in your cart` }
  }
  return { eligible: true }
}

export async function computeCart(cartId: string): Promise<CartResponse | null> {
  const { data: cart, error: cartError } = await supabase
    .from('carts')
    .select('id, promo_code_id')
    .eq('id', cartId)
    .maybeSingle()

  if (cartError) throw cartError
  if (!cart) return null

  const { data: rows, error: itemsError } = await supabase
    .from('cart_items')
    .select(
      'quantity, product_id, products(id, product_code, name, selling_price, msrp, product_images(image_url, display_order))'
    )
    .eq('cart_id', cartId)

  if (itemsError) throw itemsError

  interface RawItemRow {
    quantity: number
    product_id: string
    products: {
      id: string
      product_code: string
      name: string
      selling_price: number
      msrp: number
      product_images: { image_url: string; display_order: number }[]
    } | null
  }

  const items: CartItemResponse[] = ((rows as unknown as RawItemRow[]) || [])
    .filter((row) => row.products)
    .map((row) => {
      const product = row.products!
      const sortedImages = [...(product.product_images || [])].sort((a, b) => a.display_order - b.display_order)
      return {
        productCode: product.product_code,
        name: product.name,
        imageUrl: sortedImages[0]?.image_url ?? null,
        quantity: row.quantity,
        unitPrice: product.selling_price,
        unitMsrp: product.msrp,
        lineTotal: product.selling_price * row.quantity,
        lineSlashTotal: product.msrp * row.quantity,
      }
    })

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const slashSubtotal = items.reduce((sum, i) => sum + i.lineSlashTotal, 0)
  const savedAmount = slashSubtotal - subtotal

  let shippingFee = DEFAULT_SHIPPING_FEE
  let offer: CartResponse['offer'] = null

  if (cart.promo_code_id) {
    const { data: promo, error: promoError } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('id', cart.promo_code_id)
      .maybeSingle()

    if (promoError) throw promoError

    if (promo) {
      const { eligible } = isPromoEligible(promo as PromoCode, subtotal, itemCount)

      if (!eligible) {
        // Cart changed since the offer was applied and it no longer
        // qualifies — self-heal by detaching it rather than silently
        // showing a discount that no longer applies.
        await supabase.from('carts').update({ promo_code_id: null }).eq('id', cartId)
      } else {
        const p = promo as PromoCode
        let discountAmount = 0

        if (p.applies_to === 'delivery') {
          if (p.free_delivery) {
            shippingFee = 0
          } else {
            const reduction = p.discount_percent
              ? (shippingFee * p.discount_percent) / 100
              : p.discount_amount || 0
            shippingFee = Math.max(0, shippingFee - reduction)
          }
        } else if (p.applies_to === 'item') {
          const { data: scopeRows } = await supabase
            .from('promo_code_products')
            .select('product_id, products(product_code)')
            .eq('promo_code_id', p.id)

          const scopedCodes = new Set(
            ((scopeRows as unknown as { products: { product_code: string } | null }[]) || [])
              .map((r) => r.products?.product_code)
              .filter((c): c is string => !!c)
          )
          const qualifying = scopedCodes.size === 0 ? items : items.filter((i) => scopedCodes.has(i.productCode))

          discountAmount = qualifying.reduce((sum, i) => {
            return sum + (p.discount_percent ? (i.lineTotal * p.discount_percent) / 100 : (p.discount_amount || 0) * i.quantity)
          }, 0)
          if (p.max_discount_amount !== null) discountAmount = Math.min(discountAmount, p.max_discount_amount)
          discountAmount = Math.min(discountAmount, subtotal)
        } else {
          discountAmount = p.discount_percent ? (subtotal * p.discount_percent) / 100 : p.discount_amount || 0
          if (p.max_discount_amount !== null) discountAmount = Math.min(discountAmount, p.max_discount_amount)
          discountAmount = Math.min(discountAmount, subtotal)
        }

        offer = {
          code: p.code,
          label: p.label,
          appliesTo: p.applies_to,
          discountAmount: Math.round(discountAmount * 100) / 100,
        }
      }
    }
  }

  const discountAmount = offer?.discountAmount || 0
  const toPay = Math.max(0, subtotal - discountAmount + shippingFee)

  return {
    cartId,
    items,
    itemCount,
    subtotal,
    slashSubtotal,
    savedAmount,
    shippingFee,
    offer,
    toPay,
  }
}

export { supabase as cartSupabase }
