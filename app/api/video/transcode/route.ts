import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import ffmpegPath from 'ffmpeg-static'

export const maxDuration = 60

const execFileAsync = promisify(execFile)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const RAW_BUCKET = 'widget-video-raw'
const HLS_BUCKET = 'widget-video'
const MAX_SIZE = 50 * 1024 * 1024 // 50MB

async function uploadToStorage(bucket: string, objectPath: string, body: Buffer, contentType: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(body),
  })
  if (!response.ok) throw new Error(await response.text())
}

export async function POST(request: NextRequest) {
  let workDir: string | null = null

  try {
    if (!ffmpegPath) throw new Error('ffmpeg binary not available')

    const { rawPath, filename, contentType, size } = await request.json()

    if (!rawPath || !filename || !contentType || typeof size !== 'number') {
      return NextResponse.json({ error: 'rawPath, filename, contentType, and size are required' }, { status: 400 })
    }

    if (size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is 50MB. Your file is ${(size / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      )
    }

    // Download the raw upload from the private bucket.
    const downloadResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${RAW_BUCKET}/${rawPath}`,
      { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } }
    )
    if (!downloadResponse.ok) throw new Error(`Failed to download raw upload: ${await downloadResponse.text()}`)
    const inputBuffer = Buffer.from(await downloadResponse.arrayBuffer())

    const id = Date.now().toString()
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), `video-${id}-`))
    const ext = filename.includes('.') ? filename.split('.').pop() : 'mp4'
    const inputPath = path.join(workDir, `input.${ext}`)
    const playlistPath = path.join(workDir, 'playlist.m3u8')
    const segmentPattern = path.join(workDir, 'seg%03d.ts')

    await fs.writeFile(inputPath, inputBuffer)

    // Remux (no re-encode) into HLS segments — fast and reliable within a
    // serverless function's time budget, at the cost of not offering
    // multiple bitrate renditions.
    await execFileAsync(ffmpegPath, [
      '-y',
      '-i', inputPath,
      '-c', 'copy',
      '-start_number', '0',
      '-hls_time', '6',
      '-hls_list_size', '0',
      '-hls_segment_filename', segmentPattern,
      '-f', 'hls',
      playlistPath,
    ])

    const outputFiles = await fs.readdir(workDir)
    const segmentFiles = outputFiles.filter((f) => f.endsWith('.ts'))

    const hlsPrefix = `hls/${id}`
    for (const segmentFile of segmentFiles) {
      const buffer = await fs.readFile(path.join(workDir, segmentFile))
      await uploadToStorage(HLS_BUCKET, `${hlsPrefix}/${segmentFile}`, buffer, 'video/mp2t')
    }

    const playlistBuffer = await fs.readFile(playlistPath)
    await uploadToStorage(HLS_BUCKET, `${hlsPrefix}/playlist.m3u8`, playlistBuffer, 'application/vnd.apple.mpegurl')

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${HLS_BUCKET}/${hlsPrefix}/playlist.m3u8`

    const { data, error } = await supabase
      .from('video_assets')
      .insert([{ filename, url, size, content_type: 'application/vnd.apple.mpegurl' }])
      .select()

    if (error) throw error

    // Best-effort cleanup of the raw upload — not fatal if it fails.
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${RAW_BUCKET}/${rawPath}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    }).catch(() => {})

    return NextResponse.json({ video: data[0] }, { status: 201 })
  } catch (error) {
    console.error('Transcode error:', error)
    return NextResponse.json(
      { error: `Failed to process video: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  } finally {
    if (workDir) {
      fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}
