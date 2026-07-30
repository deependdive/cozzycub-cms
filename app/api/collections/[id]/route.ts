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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const name = (body.name || '').trim()
    const slug = (body.slug || '').trim()
    const items: CollectionItemInput[] = Array.isArray(body.items) ? body.items : []

    if (!name || !slug) {
      return NextResponse.json({ error: 'Collection name and slug are required' }, { status: 400 })
    }

    const { data: existing, error: lookupError } = await supabase.from('collections').select('id, name, slug')

    if (lookupError) throw lookupError
    if (existing?.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'A collection with this name already exists' }, { status: 409 })
    }
    if (existing?.some((c) => c.id !== id && c.slug.toLowerCase() === slug.toLowerCase())) {
      return NextResponse.json({ error: 'A collection with this slug already exists' }, { status: 409 })
    }

    const { data: collectionRows, error: updateError } = await supabase
      .from('collections')
      .update({ name, slug, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()

    if (updateError) throw updateError

    const { error: deleteItemsError } = await supabase.from('collection_items').delete().eq('collection_id', id)
    if (deleteItemsError) throw deleteItemsError

    if (items.length > 0) {
      const rows = items.map((item) => ({
        collection_id: id,
        widget_id: item.widget_id,
        display_order: item.display_order,
      }))
      const { error: itemsError } = await supabase.from('collection_items').insert(rows)
      if (itemsError) throw itemsError
    }

    return NextResponse.json({ collection: collectionRows[0] })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { error: itemsError } = await supabase.from('collection_items').delete().eq('collection_id', id)
    if (itemsError) throw itemsError

    const { error } = await supabase.from('collections').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 })
  }
}
