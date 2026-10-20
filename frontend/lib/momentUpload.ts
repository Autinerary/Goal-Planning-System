import { createClient } from '@/lib/supabase/client'
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_TYPES } from './moments'

/**
 * A moment's photo or video, from the browser straight to the private
 * "moments" bucket, in the person's own folder (STEP 87 lets nobody write
 * anywhere else). Photos are made smaller first (at most 1600 px, JPEG);
 * videos go as they are, up to 50 MB.
 */
export async function uploadMomentMedia(file: File, userId: string): Promise<{ path: string; type: 'image' | 'video' }> {
  const isVideo = VIDEO_TYPES.includes(file.type)
  const isImage = IMAGE_TYPES.includes(file.type)
  if (!isVideo && !isImage) throw new Error('Choose a photo (JPEG, PNG, WebP or GIF) or a video (MP4, WebM or MOV).')
  if (isVideo && file.size > MAX_VIDEO_BYTES) throw new Error('That video is over 50 MB. Please choose a shorter one.')
  if (isImage && file.size > MAX_IMAGE_BYTES) throw new Error('That photo is over 15 MB. Please choose a smaller one.')

  let body: Blob = file
  let contentType = file.type
  let ext = isVideo ? (file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4') : file.type === 'image/gif' ? 'gif' : 'jpg'
  if (isImage && file.type !== 'image/gif') {
    body = await smaller(file).catch(() => file)
    contentType = body === file ? file.type : 'image/jpeg'
    if (body === file) ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  }
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await createClient().storage.from('moments').upload(path, body, { contentType, cacheControl: '3600', upsert: false })
  if (error) throw new Error(/bucket/i.test(error.message) ? 'Saving photos and videos opens soon.' : 'That upload didn’t work. Please try again.')
  return { path, type: isVideo ? 'video' : 'image' }
}

/** A JPEG no wider or taller than 1600 px. */
async function smaller(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', 0.86))
}

/** Remove a file you uploaded but didn't keep (cancelled before saving). */
export async function discardMomentMedia(path: string): Promise<void> {
  await createClient().storage.from('moments').remove([path]).catch(() => null)
}
