'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Your profile photo (Riipen Labs, Group 34, slide 21). The photo is cut to a
 * square and made smaller in the browser before it is uploaded, which also
 * drops the details a phone hides in a photo, such as where it was taken.
 * It goes in your own folder of the avatars bucket (STEP 64) and is saved at
 * once; older photos there are removed.
 */

const TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_ORIGINAL = 15 * 1024 * 1024
const SIDE = 512

async function squareJpeg(file: File): Promise<Blob> {
  const src = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = src
    await img.decode()
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const size = Math.min(SIDE, side)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    // A see-through PNG would turn black as a JPEG.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85))
  } finally {
    URL.revokeObjectURL(src)
  }
}

export default function PhotoField({ userId, url, emoji, onSaved }: {
  userId: string
  url: string | null
  emoji: string
  /** The profile row after the photo was saved or removed. */
  onSaved: (profile: any) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<null | 'upload' | 'remove'>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const patch = async (avatar_url: string | null) => {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_url }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Your photo could not be saved. Please try again.')
    return body.profile
  }

  // Everything in your folder except the photo in use.
  const tidy = async (keep: string | null) => {
    const storage = createClient().storage.from('avatars')
    const { data } = await storage.list(userId, { limit: 100 })
    const old = ((data || []) as { name: string }[]).map((f) => `${userId}/${f.name}`).filter((path) => path !== keep)
    if (old.length) await storage.remove(old)
  }

  const choose = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    if (!TYPES.includes(file.type)) { setMessage({ ok: false, text: 'Please choose a PNG, JPEG or WebP photo.' }); return }
    if (file.size > MAX_ORIGINAL) { setMessage({ ok: false, text: 'That photo is too big. Please choose one under 15 MB.' }); return }
    setBusy('upload')
    try {
      const blob = await squareJpeg(file).catch(() => { throw new Error('That photo could not be opened. Please try another.') })
      const path = `${userId}/${crypto.randomUUID()}.jpg`
      const storage = createClient().storage.from('avatars')
      const { error } = await storage.upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
      if (error) throw new Error('Your photo could not be uploaded. Please try again.')
      const profile = await patch(storage.getPublicUrl(path).data.publicUrl)
      onSaved(profile)
      setMessage({ ok: true, text: 'Photo saved.' })
      await tidy(path).catch(() => {})
    } catch (e: any) {
      setMessage({ ok: false, text: e.message })
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    setMessage(null)
    setBusy('remove')
    try {
      onSaved(await patch(null))
      setMessage({ ok: true, text: 'Photo removed.' })
      await tidy(null).catch(() => {})
    } catch (e: any) {
      setMessage({ ok: false, text: e.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div role="group" aria-labelledby="profile-photo-label">
      <p id="profile-photo-label" className="mb-2 block text-sm font-semibold text-slate-800">Photo</p>
      <div className="flex flex-wrap items-center gap-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Your photo" width={72} height={72} className="h-[72px] w-[72px] rounded-full object-cover" />
        ) : (
          <span className="keep-colors grid h-[72px] w-[72px] place-items-center rounded-full bg-purple-50 text-4xl" aria-hidden="true">{emoji || '👤'}</span>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id="profile-photo-file"
            type="file"
            accept={TYPES.join(',')}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy !== null}
            aria-describedby="profile-photo-help"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
          >
            {busy === 'upload' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {url ? 'Change photo' : 'Upload a photo'}
          </button>
          {url && (
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === 'remove' ? 'Removing…' : 'Remove photo'}
            </button>
          )}
        </div>
      </div>
      <p id="profile-photo-help" className="mt-2 text-xs text-slate-600">
        Optional. A PNG, JPEG or WebP photo. Other members see it instead of your picture below, and anyone with its link can open it.
      </p>
      <p role="status" className={`mt-1 text-sm ${message?.ok ? 'font-medium text-emerald-800' : 'text-red-700'}`}>{message?.text || ''}</p>
    </div>
  )
}
