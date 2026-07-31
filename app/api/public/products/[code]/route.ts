import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface RawProduct {
  id: string
  product_code: string
  name: string
  msrp: number
  selling_price: number
  discount_percent: number
  cta_text: string
  inclusions: string[] | null
  quantity_default: number
  quantity_max: number
  is_featured: boolean
  product_images: { image_url: string; display_order: number }[]
  product_videos: { video_url: string; display_order: number }[]
  product_variants: {
    variant_name: string
    swatch_image_url: string
    display_order: number
    variant: { id: string; name: string; product_code: string } | null
  }[]
  offer_widget: { id: string; name: string; json_data: unknown } | null
  rich_collection: {
    name: string
    slug: string
    collection_items: {
      display_order: number
      widgets: { id: string; name: string; json_data: unknown } | null
    }[]
  } | null
}

function byOrder<T extends { display_order: number }>(items: T[] | null | undefined): T[] {
  return [...(items || [])].sort((a, b) => a.display_order - b.display_order)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params

    const { data, error } = await supabase
      .from('products')
      .select(
        `*,
        product_images(id, image_url, display_order),
        product_videos(id, video_url, display_order),
        product_variants!product_variants_product_id_fkey(
          id, variant_name, swatch_image_url, display_order,
          variant:products!product_variants_variant_product_id_fkey(id, name, product_code)
        ),
        offer_widget:widgets(id, name, json_data),
        rich_collection:collections(
          id, name, slug,
          collection_items(id, display_order, widgets(id, name, json_data))
        )`
      )
      .eq('product_code', code)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const product = data as unknown as RawProduct

    const images = byOrder(product.product_images).map((i) => i.image_url)
    const videos = byOrder(product.product_videos).map((v) => v.video_url)

    const variants = byOrder(product.product_variants)
      .filter((v) => v.variant)
      .map((v) => ({
        name: v.variant_name,
        swatchImageUrl: v.swatch_image_url,
        productCode: v.variant!.product_code,
        productName: v.variant!.name,
      }))

    const offer = product.offer_widget
      ? { id: product.offer_widget.id, name: product.offer_widget.name, data: product.offer_widget.json_data }
      : null

    const richCollection = product.rich_collection
      ? {
          name: product.rich_collection.name,
          slug: product.rich_collection.slug,
          widgets: byOrder(product.rich_collection.collection_items)
            .filter((item) => item.widgets)
            .map((item) => ({
              id: item.widgets!.id,
              name: item.widgets!.name,
              rank: item.display_order,
              data: item.widgets!.json_data,
            })),
        }
      : null

    return NextResponse.json({
      product: {
        id: product.id,
        code: product.product_code,
        name: product.name,
        msrp: product.msrp,
        sellingPrice: product.selling_price,
        discountPercent: product.discount_percent,
        ctaText: product.cta_text,
        inclusions: product.inclusions || [],
        quantityDefault: product.quantity_default,
        quantityMax: product.quantity_max,
        isFeatured: product.is_featured,
      },
      gallery: { images, videos },
      variants,
      offer,
      richCollection,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}
