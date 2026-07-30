import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const HLS_BUCKET = 'widget-video'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { data: existing, error: fetchError } = await supabase
      .from('video_assets')
      .select('url')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    // url looks like .../storage/v1/object/public/widget-video/hls/<folderId>/playlist.m3u8
    const marker = `/storage/v1/object/public/${HLS_BUCKET}/`
    const objectPath = existing.url.split(marker)[1]
    const folderPrefix = objectPath ? objectPath.split('/').slice(0, -1).join('/') : null

    if (folderPrefix) {
      const listResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/${HLS_BUCKET}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix: folderPrefix, limit: 1000 }),
      })
      const files = (await listResponse.json()) as { name: string }[]
      const prefixes = files.map((f) => `${folderPrefix}/${f.name}`)

      if (prefixes.length > 0) {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${HLS_BUCKET}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prefixes }),
        })
      }
    }

    const { error } = await supabase.from('video_assets').delete().eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 })
  }
}
