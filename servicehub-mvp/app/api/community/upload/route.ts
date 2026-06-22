/**
 * /api/community/upload
 *   POST FormData { file: File } — upload an image for a post or answer.
 *
 * Reuses the existing `resource-images` Supabase Storage bucket. Files are
 * placed under `community/{user_id}/{ts}_{rand}.{ext}` so they can't
 * collide with the existing ratings/ path. Public URL is returned.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File must be ≤ ${Math.round(MAX_BYTES / 1024)} KB` },
      { status: 400 }
    );
  }

  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeExt = ext.length > 0 && ext.length <= 5 ? ext : 'png';
  const random = Math.random().toString(36).slice(2, 8);
  const filePath = `community/${user.id}/${Date.now()}_${random}.${safeExt}`;

  const { error } = await supa.storage
    .from('resource-images')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });
  if (error) {
    console.error('[community] upload failed:', error.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
  const {
    data: { publicUrl },
  } = supa.storage.from('resource-images').getPublicUrl(filePath);
  return NextResponse.json({ url: publicUrl, path: filePath });
}
