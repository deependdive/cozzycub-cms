import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const BUCKET = 'widget-media'
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function GET() {
  try {
    const { data, error } = await supabase.from('media_assets').select('*').order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ media: data })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is 2MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Please select an image file' }, { status: 400 })
    }

    const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_').toLowerCase()}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const uploadResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': file.type,
        },
        body: buffer,
      }
    )

    if (!uploadResponse.ok) {
      throw new Error(await uploadResponse.text())
    }

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`

    const { data, error } = await supabase
      .from('media_assets')
      .insert([{ filename: file.name, url, size: file.size, content_type: file.type }])
      .select()

    if (error) throw error

    return NextResponse.json({ media: data[0] }, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
