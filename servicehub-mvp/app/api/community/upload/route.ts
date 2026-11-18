/**
 * /api/community/upload
 *   POST FormData { file: File } — upload an image for a post or answer.
 *
 * Reuses the existing `resource-images` Supabase Storage bucket. Files are
 * placed under `community/{user_id}/{ts}_{rand}.{ext}` so they can't
 * collide with the existing ratings/ path. Public URL is returned.
 *
 * The kind of picture is read from the file's first bytes (JPEG, PNG, GIF,
 * WebP or AVIF), never from the name or the type the browser sends, and it
 * is saved with that kind. SVG used to be accepted, and it can carry script
 * (bug audit, 17 November 2026, item 16).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { COMMUNITY_IMAGE_BUCKET, sniffImage } from '@/lib/community/images';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 750 * 1024; // 750KB — same family as the ratings uploader

export async function POST(request: NextRequest) {
  const supa = createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign-in required' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File must be ≤ ${Math.round(MAX_BYTES / 1024)} KB` },
      { status: 400 }
    );
  }

  // What the file really is, from its bytes.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) {
    return NextResponse.json(
      { error: 'Please choose a JPG, PNG, GIF or WebP picture.' },
      { status: 400 }
    );
  }

  const random = Math.random().toString(36).slice(2, 8);
  const filePath = `community/${user.id}/${Date.now()}_${random}.${kind.ext}`;

  const { error } = await supa.storage
    .from(COMMUNITY_IMAGE_BUCKET)
    .upload(filePath, bytes, { cacheControl: '3600', upsert: false, contentType: kind.contentType });
  if (error) {
    console.error('[community] upload failed:', error.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
  const {
    data: { publicUrl },
  } = supa.storage.from(COMMUNITY_IMAGE_BUCKET).getPublicUrl(filePath);
  return NextResponse.json({ url: publicUrl, path: filePath });
}
