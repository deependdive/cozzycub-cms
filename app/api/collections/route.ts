import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

interface CollectionItemInput {
  widget_id: string
  display_order: number
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*, collection_items(id, widget_id, display_order, widgets(id, name))')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ collections: data })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = (body.name || '').trim()
    const slug = (body.slug || '').trim()
    const items: CollectionItemInput[] = Array.isArray(body.items) ? body.items : []

    if (!name || !slug) {
      return NextResponse.json({ error: 'Collection name and slug are required' }, { status: 400 })
    }

    const { data: existing, error: lookupError } = await supabase.from('collections').select('id, name, slug')

    if (lookupError) throw lookupError
    if (existing?.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'A collection with this name already exists' }, { status: 409 })
    }
    if (existing?.some((c) => c.slug.toLowerCase() === slug.toLowerCase())) {
      return NextResponse.json({ error: 'A collection with this slug already exists' }, { status: 409 })
    }

    const { data: collectionRows, error: insertError } = await supabase
      .from('collections')
      .insert([{ name, slug }])
      .select()

    if (insertError) throw insertError
    const collection = collectionRows[0]

    if (items.length > 0) {
      const rows = items.map((item) => ({
        collection_id: collection.id,
        widget_id: item.widget_id,
        display_order: item.display_order,
      }))
      const { error: itemsError } = await supabase.from('collection_items').insert(rows)
      if (itemsError) throw itemsError
    }

    return NextResponse.json({ collection }, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 })
  }
}
