import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface ProductInput {
  name: string
  msrp: number
  selling_price: number
  inclusions: string[]
  quantity_default: number
  quantity_max: number
  offer_widget_id: string | null
  rich_collection_id: string | null
  classification: string | null
  cta_text: string
  is_featured: boolean
  images: string[]
  videos: string[]
  variants: { variant_name: string; variant_product_id: string; swatch_image_url: string }[]
}

const CLASSIFICATIONS = ['kit', 'figure', 'coaster', 'tray', 'art_supply']

function validateProduct(body: Partial<ProductInput>): string | null {
  if (!body.name || !body.name.trim()) return 'Product name is required'
  if (typeof body.msrp !== 'number' || body.msrp <= 0) return 'MSRP must be a positive number'
  if (typeof body.selling_price !== 'number' || body.selling_price <= 0) return 'Selling price must be a positive number'
  if (body.selling_price > body.msrp) return 'Selling price cannot exceed MSRP'
  if (typeof body.quantity_default !== 'number' || body.quantity_default < 1) return 'Quantity default must be at least 1'
  if (typeof body.quantity_max === 'number' && body.quantity_max < body.quantity_default) {
    return 'Quantity max cannot be less than quantity default'
  }
  if (body.classification && !CLASSIFICATIONS.includes(body.classification)) {
    return 'Invalid classification'
  }
  if (!Array.isArray(body.images) || body.images.filter((u) => u.trim()).length === 0) {
    return 'At least one product image is required'
  }
  if (Array.isArray(body.variants)) {
    for (const variant of body.variants) {
      if (!variant.variant_name?.trim() || !variant.variant_product_id || !variant.swatch_image_url?.trim()) {
        return 'Each variant requires a name, a linked product, and a swatch image'
      }
    }
  }
  return null
}

function computeDiscountPercent(msrp: number, sellingPrice: number): number {
  if (msrp <= 0 || sellingPrice >= msrp) return 0
  return Math.max(0, Math.ceil(((msrp - sellingPrice) / msrp) * 100))
}

async function generateProductCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const { data } = await supabase.from('products').select('id').eq('product_code', code).maybeSingle()
    if (!data) return code
  }
  throw new Error('Failed to generate a unique product code')
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        `*,
        product_images(id, image_url, display_order),
        product_videos(id, video_url, display_order),
        product_variants!product_variants_product_id_fkey(id, variant_name, swatch_image_url, display_order, variant_product_id, variant:products!product_variants_variant_product_id_fkey(id, name, product_code))`
      )
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ products: data })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ProductInput>

    const validationError = validateProduct(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const name = body.name!.trim()
    const msrp = body.msrp!
    const sellingPrice = body.selling_price!
    const discountPercent = computeDiscountPercent(msrp, sellingPrice)
    const productCode = await generateProductCode()

    const { data: productRows, error: insertError } = await supabase
      .from('products')
      .insert([
        {
          product_code: productCode,
          name,
          msrp,
          selling_price: sellingPrice,
          discount_percent: discountPercent,
          inclusions: (body.inclusions || []).filter((i) => i.trim()),
          quantity_default: body.quantity_default,
          quantity_max: body.quantity_max ?? 20,
          offer_widget_id: body.offer_widget_id || null,
          rich_collection_id: body.rich_collection_id || null,
          classification: body.classification || null,
          cta_text: body.cta_text?.trim() || 'Add to Cart',
          is_featured: body.is_featured ?? false,
        },
      ])
      .select()

    if (insertError) throw insertError
    const product = productRows[0]

    const images = (body.images || []).filter((u) => u.trim())
    if (images.length > 0) {
      const { error } = await supabase
        .from('product_images')
        .insert(images.map((image_url, index) => ({ product_id: product.id, image_url, display_order: index })))
      if (error) throw error
    }

    const videos = (body.videos || []).filter((u) => u.trim())
    if (videos.length > 0) {
      const { error } = await supabase
        .from('product_videos')
        .insert(videos.map((video_url, index) => ({ product_id: product.id, video_url, display_order: index })))
      if (error) throw error
    }

    const variants = body.variants || []
    if (variants.length > 0) {
      const { error } = await supabase.from('product_variants').insert(
        variants.map((v, index) => ({
          product_id: product.id,
          variant_name: v.variant_name.trim(),
          variant_product_id: v.variant_product_id,
          swatch_image_url: v.swatch_image_url.trim(),
          display_order: index,
        }))
      )
      if (error) throw error
    }

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: `Failed to create product: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
