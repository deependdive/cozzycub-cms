import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File is too large. Maximum size is 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Please select an image file' }, { status: 400 })
    }

    const fileName = `${Date.now()}-${file.name.replace(/[^a-z0-9.-]/gi, '_').toLowerCase()}`
    const bytes = await file.arrayBuffer()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const uploadUrl = `${supabaseUrl}/storage/v1/object/products/${fileName}`

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': file.type,
      },
      body: bytes,
    })

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text()
      throw new Error(error)
    }

    const imageUrl = `products/${fileName}`
    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
