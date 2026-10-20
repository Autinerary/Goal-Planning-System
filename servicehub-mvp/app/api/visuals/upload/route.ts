/**
 * /api/visuals/upload
 *   POST FormData { file } — an artwork's image, for Visuals.
 *
 * The file's own bytes decide its type (PNG, JPEG, WebP or GIF; never SVG,
 * which can carry script), and a file carrying an AI tool's marks is turned
 * away (lib/visuals/aiCheck.ts). Stored in the `resource-images` bucket under
 * `visuals/{user_id}/`, like Tidbits' images under `community/`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkForAiMarks, imageKind } from '@/lib/visuals/aiCheck'

export const dynamic = 'force-dynamic'

// Under the 4.5 MB a serverless request can carry.
const MAX_BYTES = 4 * 1024 * 1024
const TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' } as const

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to share your art' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'That upload didn’t come through. Please try again.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image first' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Images can be up to 4 MB' }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = imageKind(bytes)
  if (!kind) return NextResponse.json({ error: 'Use a PNG, JPEG, WebP or GIF image' }, { status: 400 })
  const check = checkForAiMarks(bytes)
  if (check.ai) {
    return NextResponse.json(
      {
        error: `This file looks AI-made (${check.found.join('; ')}). Visuals is for art people make themselves.`,
        code: 'ai_marks',
        found: check.found,
      },
      { status: 400 }
    )
  }

  const path = `visuals/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${kind}`
  const { error } = await supabase.storage.from('resource-images').upload(path, bytes, { contentType: TYPES[kind], cacheControl: '3600', upsert: false })
  if (error) {
    console.error('[visuals] upload failed:', error.message)
    return NextResponse.json({ error: 'The upload failed. Please try again.' }, { status: 500 })
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from('resource-images').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl, path })
}
