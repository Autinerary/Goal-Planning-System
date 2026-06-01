import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const file = formData.get('file') as File
    const resourceId = formData.get('resourceId') as string
    const index = formData.get('index') as string

    if (!file || !resourceId) {
      return NextResponse.json({ error: 'Missing file or resourceId' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (500KB max)
    if (file.size > 500 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 500KB' }, { status: 400 })
    }

    // Generate file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${resourceId}/${user.id}/${Date.now()}_${index}.${fileExt}`
    const filePath = `ratings/${fileName}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('resource-images')
      .upload(filePath, file, {
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