'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, ImagePlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CAPTION_PROMPTS, VISIBILITY, type MomentKind, type MomentVisibility } from '@/lib/moments'
import { discardMomentMedia, uploadMomentMedia } from '@/lib/momentUpload'
import { playPageTurnSound } from '@/lib/taskSound'

/**
 * "Capture this moment", at the end of a task or milestone (Hare World
 * Social; the team's notes, October 2026): a photo or video and a caption,
 * or just one of them. The caption is about the mess-ups and the beginning
 * that led here, not only the finish. Private unless you share it: with your
 * people, or with everyone in Hare World once the team has looked. Family
 * accounts (under 18) keep theirs private.
 */
export default function MomentCapture({
  open,
  kind,
  refId,
  title,
  onClose,
}: {
  open: boolean
  kind: MomentKind
  refId?: string
  title: string
  /** saved: whether a moment was saved. */
  onClose: (saved: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState<{ id: string; managed: boolean } | null>(null)
  const [media, setMedia] = useState<{ path: string; type: 'image' | 'video'; preview: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<MomentVisibility>('private')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [prompt] = useState(() => CAPTION_PROMPTS[Math.floor(Math.random() * CAPTION_PROMPTS.length)])

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])

  useEffect(() => {
    if (!open || user) return
    createClient()
      .auth.getUser()
      .then(({ data }: { data: { user: any } }) => {
        const u = data.user
        if (u) setUser({ id: u.id, managed: Boolean((u.app_metadata as any)?.managed_by_guardian || (u.user_metadata as any)?.managed_by_guardian) })
      })
      .catch(() => null)
  }, [open, user])

  const reset = () => {
    setMedia(null)
    setCaption('')
    setVisibility('private')
    setError('')
  }

  const finish = (saved: boolean) => {
    if (!saved && media) discardMomentMedia(media.path)
    reset()
    onClose(saved)
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      // Who is signed in may still be on its way (a slow connection): ask
      // now rather than dropping the photo without a word.
      const id = user?.id || (await createClient().auth.getUser()).data.user?.id
      if (!id) throw new Error('Please sign in again to add a photo.')
      if (media) await discardMomentMedia(media.path)
      const up = await uploadMomentMedia(file, id)
      setMedia({ ...up, preview: URL.createObjectURL(file) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That upload didn’t work.')
    } finally {
      setUploading(false)
      if (camera.current) camera.current.value = ''
      if (files.current) files.current.value = ''
    }
  }

  const save = async () => {
    if (busy) return
    if (!media && !caption.trim()) return setError('Add a photo, a video or a few words first.')
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/moments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ref: refId, title, caption, media_path: media?.path, media_type: media?.type, visibility }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'Your moment could not be saved.')
      playPageTurnSound()
      reset()
      onClose(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your moment could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  const choices = user?.managed ? VISIBILITY.filter((v) => v.id === 'private') : VISIBILITY

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault()
        finish(false)
      }}
      aria-labelledby="moment-title"
      className="w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 backdrop:bg-black/50"
      data-moment-capture
    >
      <div className="max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="moment-title" className="text-xl font-bold text-slate-900">
              Capture this moment
            </h2>
            <p className="mt-1 text-sm text-slate-800">
              {kind === 'milestone' ? 'Milestone' : 'Task'}: <span className="font-semibold">{title}</span>
            </p>
          </div>
          <button type="button" onClick={() => finish(false)} aria-label="Close" className="rounded-lg p-1 text-slate-700 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-800">A photo or video and a few words to remember how you got here. One or the other is fine.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <input ref={camera} type="file" accept="image/*,video/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} aria-hidden="true" />
          <input ref={files} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} aria-hidden="true" />
          <button type="button" onClick={() => camera.current?.click()} disabled={uploading || !user} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60">
            <Camera className="h-4 w-4" aria-hidden="true" /> Take a photo or video
          </button>
          <button type="button" onClick={() => files.current?.click()} disabled={uploading || !user} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-60">
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Choose one
          </button>
        </div>
        {uploading && (
          <p role="status" className="mt-2 text-sm text-slate-800">
            Uploading…
          </p>
        )}
        {media && (
          <div className="mt-3">
            {media.type === 'video' ? (
              <video src={media.preview} controls className="max-h-60 w-full rounded-xl bg-black" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={media.preview} alt="Your photo" className="max-h-60 w-full rounded-xl object-contain bg-slate-100" />
            )}
            <button type="button" onClick={() => { discardMomentMedia(media.path); setMedia(null) }} className="mt-1 text-sm font-medium text-slate-800 underline">
              Remove it
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-700">Photos and videos up to 50 MB. Please don’t show other people’s faces or names without their OK.</p>

        <label htmlFor="moment-caption" className="mt-4 block text-sm font-semibold text-slate-900">
          Caption
        </label>
        <p id="moment-caption-hint" className="text-sm text-slate-800">
          The beginning and the mess-ups count most. {prompt}
        </p>
        <textarea
          id="moment-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 1000))}
          rows={4}
          aria-describedby="moment-caption-hint"
          className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="It started with…"
        />

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-slate-900">Who can see it</legend>
          <div className="mt-2 space-y-2">
            {choices.map((v) => (
              <label key={v.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${visibility === v.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300'}`}>
                <input type="radio" name="moment-visibility" checked={visibility === v.id} onChange={() => setVisibility(v.id)} className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="font-semibold text-slate-900">{v.label}</span>
                  <span className="block text-slate-800">{v.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {user?.managed && <p className="mt-2 text-xs text-slate-700">Moments from a Family account stay private.</p>}
        </fieldset>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/hare-world/memories" className="text-sm font-medium text-indigo-800 underline underline-offset-2">
            Your Memories
          </Link>
          <div className="flex gap-2">
            <button type="button" onClick={() => finish(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              Not now
            </button>
            <button type="button" onClick={save} disabled={busy || uploading} className="rounded-xl bg-indigo-700 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
              {busy ? 'Saving…' : 'Save to my Memories'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
