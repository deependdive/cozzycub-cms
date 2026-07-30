import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params
    const query = decodeURIComponent(name).toLowerCase()

    const { data: collections, error: collectionError } = await supabase
      .from('collections')
      .select('id, name, slug')

    if (collectionError) throw collectionError

    const collection = collections?.find(
      (c) => c.slug.toLowerCase() === query || c.name.toLowerCase() === query
    )

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const { data: items, error: itemsError } = await supabase
      .from('collection_items')
      .select('display_order, widgets(id, name, json_data)')
      .eq('collection_id', collection.id)
      .order('display_order', { ascending: true })

    if (itemsError) throw itemsError

    const widgets = (items || [])
      .filter((item) => item.widgets)
      .map((item) => {
        const widget = item.widgets as unknown as { id: string; name: string; json_data: unknown }
        return { id: widget.id, name: widget.name, rank: item.display_order, json_data: widget.json_data }
      })

    return NextResponse.json({
      collection: { name: collection.name, slug: collection.slug },
      widgets,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch collection' }, { status: 500 })
  }
}
