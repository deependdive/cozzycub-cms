import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json()
    const { id } = await params
    const name = (body.name || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Widget name is required' }, { status: 400 })
    }

    const { data: existing, error: lookupError } = await supabase.from('widgets').select('id, name')

    if (lookupError) throw lookupError
    if (existing?.some((w) => w.id !== id && w.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'A widget with this name already exists' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('widgets')
      .update({ name, json_data: body.json_data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()

    if (error) throw error

    return NextResponse.json({ widget: data[0] })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to update widget' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { error } = await supabase.from('widgets').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to delete widget' }, { status: 500 })
  }
}
