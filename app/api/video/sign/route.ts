import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const RAW_BUCKET = 'widget-video-raw'
const MAX_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType, size } = await request.json()

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 })
    }

    if (!contentType.startsWith('video/')) {
      return NextResponse.json({ error: 'Please select a video file' }, { status: 400 })
    }

    if (typeof size === 'number' && size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is 50MB. Your file is ${(size / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      )
    }

    const path = `${Date.now()}-${String(filename).replace(/[^a-z0-9.-]/gi, '_').toLowerCase()}`

    const { data, error } = await supabase.storage.from(RAW_BUCKET).createSignedUploadUrl(path)

    if (error) throw error

    return NextResponse.json({ path: data.path, token: data.token })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 })
  }
}
