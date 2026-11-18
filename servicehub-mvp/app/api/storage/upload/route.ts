import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { imageKind } from '@/lib/visuals/aiCheck'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' } as const

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const resourceId = String(formData.get('resourceId') || '')
    const index = String(formData.get('index') || '0').replace(/[^0-9]/g, '').slice(0, 3) || '0'

    if (!(file instanceof File) || !resourceId) {
      return NextResponse.json({ error: 'Missing file or resourceId' }, { status: 400 })
    }
    // Part of the file's path, so only an id.
    if (!UUID.test(resourceId)) {
      return NextResponse.json({ error: 'Which listing is this picture for?' }, { status: 400 })
    }

    // Validate file size (500KB max)
    if (file.size > 500 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 500KB' }, { status: 400 })
    }

    // The file's own bytes decide its type, never the browser's label: an
    // SVG (which can carry script) used to pass as "image/svg+xml".
    const bytes = new Uint8Array(await file.arrayBuffer())
    const kind = imageKind(bytes)
    if (!kind) {
      return NextResponse.json({ error: 'Please choose a JPG, PNG, GIF or WebP picture.' }, { status: 400 })
    }

    // Generate file path
    const fileName = `${resourceId}/${user.id}/${Date.now()}_${index}.${kind}`
    const filePath = `ratings/${fileName}`

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('resource-images')
      .upload(filePath, bytes, {
        contentType: TYPES[kind],
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Error uploading to storage:', error)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('resource-images').getPublicUrl(filePath)

    return NextResponse.json({ success: true, url: publicUrl, path: filePath })
  } catch (error) {
    console.error('Error in upload route:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}