'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ImagePlus, Palette, Send } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { NORM_GROUPS } from '@/lib/norms/taxonomy'
import { useMyProfile } from '@/lib/useMyProfile'

/**
 * Share a piece of your own art on Visuals (STEP 86). The image is checked
 * for AI tools' marks as it uploads (lib/visuals/aiCheck.ts); the artist
 * says they made it and that no AI made it; the team reviews it before it
 * shows.
 */
export default function ShareVisualPage() {
  const router = useRouter()
  const { profile } = useMyProfile()
  const [imageUrl, setImageUrl] = useState('')
  const [preview, setPreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [alt, setAlt] = useState('')
  const [description, setDescription] = useState('')
  const [medium, setMedium] = useState('')
  const [credit, setCredit] = useState('')
  const [norms, setNorms] = useState<string[]>([])
  const [madeByMe, setMadeByMe] = useState(false)
  const [notAi, setNotAi] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const upload = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setUploading(true)
    setImageUrl('')
    setPreview(URL.createObjectURL(file))
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/visuals/upload', { method: 'POST', body: form, credentials: 'include' })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'The upload failed.')
      setImageUrl(d.url)
    } catch (e) {
      setPreview('')
      setError(e instanceof Error ? e.message : 'The upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/visuals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, alt_text: alt, description, medium, credit, norms, image_url: imageUrl, made_by_me: madeByMe, not_ai: notAi }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'That didn’t save.')
      router.push('/visuals?shared=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t save.')
    } finally {
      setBusy(false)
    }
  }

  const missing: string[] = []
  if (!imageUrl) missing.push('your image')
  if (title.trim().length < 2) missing.push('a title')
  if (alt.trim().length < 5) missing.push('a description of what it shows')
  if (!madeByMe || !notAi) missing.push('both statements')

  const input = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500'
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Visuals', href: '/visuals' }, { label: 'Share your art', href: '/visuals/new' }]} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <Link href="/visuals" className="inline-flex items-center gap-1 text-sm text-gray-800 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Visuals
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
          <Palette className="h-7 w-7 text-rose-700" aria-hidden="true" /> Share your art
        </h1>
        <p className="mt-2 text-gray-700">Something you made yourself: a drawing, painting, photograph, craft or anything else. The team looks at it before it&apos;s shown.</p>

        {profile && !profile.signedIn ? (
          <p className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-gray-900">
            <Link href="/login?next=/visuals/new" className="font-medium text-blue-800 underline">
              Sign in
            </Link>{' '}
            to share your art.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="visual-file" className="block text-sm font-semibold text-gray-900">
                Your image
              </label>
              <p id="visual-file-hint" className="text-xs text-gray-700">
                PNG, JPEG, WebP or GIF, up to 4 MB. Files that carry an AI tool&apos;s marks are turned away.
              </p>
              <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-white p-4 hover:border-rose-400">
                <ImagePlus className="h-6 w-6 text-gray-600" aria-hidden="true" />
                <span className="text-sm text-gray-900">{uploading ? 'Checking and uploading…' : imageUrl ? 'Choose a different image' : 'Choose an image'}</span>
                <input
                  id="visual-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  aria-describedby="visual-file-hint"
                  className="sr-only"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </label>
              {preview && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={preview} alt="" className="mt-3 max-h-72 rounded-lg border border-gray-200 object-contain" />
              )}
            </div>

            <label className="block text-sm font-semibold text-gray-900">
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={input} />
            </label>

            <label className="block text-sm font-semibold text-gray-900">
              What it shows
              <span className="block text-xs font-normal text-gray-700">For people who can&apos;t see it, read aloud by screen readers.</span>
              <textarea value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={400} rows={2} className={input} placeholder="A watercolour of a fox asleep in long grass" />
            </label>

            <label className="block text-sm font-semibold text-gray-900">
              About it (optional)
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} className={input} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-900">
                Medium (optional)
                <input value={medium} onChange={(e) => setMedium(e.target.value)} maxLength={80} className={input} placeholder="Watercolour, clay, photograph…" />
              </label>
              <label className="block text-sm font-semibold text-gray-900">
                Credit it to (optional)
                <input value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={80} className={input} placeholder="A name or initials" />
                <span className="block text-xs font-normal text-gray-700">Without one it says &ldquo;a community artist&rdquo;.</span>
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-gray-900">Norms it&apos;s by or about (optional)</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {NORM_GROUPS.flatMap((g) => g.norms)
                  .filter((n) => !n.id.endsWith('_other'))
                  .map((n) => (
                    <label key={n.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${norms.includes(n.id) ? 'border-rose-600 bg-rose-50 text-rose-900' : 'border-gray-300 bg-white text-gray-800'}`}>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={norms.includes(n.id)}
                        onChange={() => setNorms((list) => (list.includes(n.id) ? list.filter((x) => x !== n.id) : [...list, n.id].slice(0, 12)))}
                      />
                      {n.label}
                    </label>
                  ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-4">
              <legend className="px-1 text-sm font-semibold text-gray-900">Your two statements</legend>
              <label className="flex items-start gap-2 text-sm text-gray-900">
                <input type="checkbox" checked={madeByMe} onChange={(e) => setMadeByMe(e.target.checked)} className="mt-0.5 h-4 w-4" />I made this myself
                (or I&apos;m sharing it for the person who made it, with their permission).
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-900">
                <input type="checkbox" checked={notAi} onChange={(e) => setNotAi(e.target.checked)} className="mt-0.5 h-4 w-4" />
                No AI made or changed it: no image generator, and no AI fill or AI filter.
              </label>
            </fieldset>

            {error && (
              <p role="alert" className="text-sm text-red-800">
                {error}
              </p>
            )}
            {missing.length > 0 && <p className="text-right text-sm text-gray-700">To share it, add {missing.join(', ')}.</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy || uploading || missing.length > 0}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden="true" /> {busy ? 'Sharing…' : 'Send it to the team'}
              </button>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </div>
  )
}
