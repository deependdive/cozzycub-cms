import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET() {
  try {
    const { data, error } = await supabase.from('widgets').select('*').order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ widgets: data })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch widgets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = (body.name || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Widget name is required' }, { status: 400 })
    }

    const { data: existing, error: lookupError } = await supabase.from('widgets').select('id, name')

    if (lookupError) throw lookupError
    if (existing?.some((w) => w.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'A widget with this name already exists' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('widgets')
      .insert([{ name, json_data: body.json_data }])
      .select()

    if (error) throw error

    return NextResponse.json({ widget: data[0] }, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to create widget' }, { status: 500 })
  }
}
