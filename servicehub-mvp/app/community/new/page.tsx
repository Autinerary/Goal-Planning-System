'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import Markdown from '@/components/community/Markdown'
import ImageUploader from '@/components/community/ImageUploader'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'

export default function NewPostPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams?.get('from') ?? ''
  const context = searchParams?.get('context') ?? ''
  const contextQuery = (() => {
    const query = new URLSearchParams()
    if (from) query.set('from', from)
    if (context) query.set('context', context)
    const built = query.toString()
    return built ? `?${built}` : ''
  })()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [unlockingMoment, setUnlockingMoment] = useState('')
  const [whatDidntWork, setWhatDidntWork] = useState('')
  const [barrierInput, setBarrierInput] = useState('')
  const [barriers, setBarriers] = useState<string[]>([])
  const [categoryInput, setCategoryInput] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [preview, setPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTag = (raw: string, list: string[], setList: (l: string[]) => void) => {
    const tag = raw.trim().toLowerCase()
    if (!tag) return
    if (tag.length > 32) return
    if (list.includes(tag)) return
    setList([...list, tag])
  }

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body_markdown: body.trim(),
          unlocking_moment: unlockingMoment.trim(),
          what_didnt_work: whatDidntWork.trim(),
          barrier_tags: barriers,
          category_tags: categories,
          image_urls: imageUrls,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `Create failed (${res.status})`)
      }
      const j = await res.json()
      router.push(`/community/post/${j.id}${contextQuery}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
      setSubmitting(false)
    }
  }

  // Mirrors the DB CHECKs in 2026_community_tidbits.sql: title 8-250,
  // body_markdown 20-30000. Kept here so the button state and the hint that
  // explains it can never drift apart.
  const MIN_TITLE = 8
  const MAX_TITLE = 250
  const MIN_BODY = 20

  // Everything still standing between the user and a publishable question.
  // Rendered next to the button so it is never disabled without saying why.
  const blockers: string[] = []
  if (title.trim().length < MIN_TITLE) {
    blockers.push(
      title.trim().length === 0
        ? `a title (at least ${MIN_TITLE} characters)`
        : `${MIN_TITLE - title.trim().length} more character${MIN_TITLE - title.trim().length === 1 ? '' : 's'} in the title`
    )
  }
  if (title.trim().length > MAX_TITLE) {
    blockers.push(`a title under ${MAX_TITLE} characters`)
  }
  if (body.trim().length < MIN_BODY) {
    blockers.push(
      body.trim().length === 0
        ? `a description (at least ${MIN_BODY} characters)`
        : `${MIN_BODY - body.trim().length} more character${MIN_BODY - body.trim().length === 1 ? '' : 's'} in the description`
    )
  }

  const canSubmit = blockers.length === 0

  return (
    /* Chrome so this is not a dead end (Odosa) — every community page needs a
       way back to ResourceHub, not just the feed. */
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Tidbits', href: '/community' },
          { label: 'Ask a question', href: '/community/new' },
        ]}
      />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link
        href={`/community${contextQuery}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tidbits
      </Link>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-emerald-600" />
          Ask the community
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          You'll post under your pseudonym. The community sees only that — never your real name.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900">
          Title <span className="text-rose-600">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={250}
          placeholder="What are you stuck on? Be specific."
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-400 text-right">
          {title.length} / 250 (min 8)
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-900">
            Body <span className="text-rose-600">*</span>
          </label>
          <button
            type="button"
            className="text-xs text-blue-700 hover:underline"
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {preview ? (
          <Markdown source={body || '*Nothing to preview yet*'} />
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Walk through what you've tried, what's blocking you, and the outcome you want. Markdown supported."
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[220px] font-mono"
            minLength={20}
            maxLength={30000}
          />
        )}
        <p className="text-xs text-gray-400 text-right">
          {body.length} / 30,000 (min 20)
        </p>
      </div>

      {/* Unlocking moment — the key sentence that turned the story around (Odosa) */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-500" /> Unlocking moment
        </label>
        <p className="text-xs text-gray-500">
          The key sentence that turned things around — the one thing that unlocked it for you. This gets highlighted at the top of your story.
        </p>
        <textarea
          value={unlockingMoment}
          onChange={(e) => setUnlockingMoment(e.target.value.slice(0, 280))}
          maxLength={280}
          placeholder='e.g. "Once I asked for written instructions instead of verbal, everything clicked."'
          className="w-full rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          rows={2}
        />
        <p className="text-xs text-gray-400 text-right">{unlockingMoment.length} / 280 (optional)</p>
      </div>

      {/* What didn't work — dead ends so readers can skip them (Odosa) */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-rose-500" /> What didn&apos;t work
        </label>
        <p className="text-xs text-gray-500">
          Things you tried that didn&apos;t help — so readers can skip the dead ends. This gets highlighted alongside your story.
        </p>
        <textarea
          value={whatDidntWork}
          onChange={(e) => setWhatDidntWork(e.target.value.slice(0, 280))}
          maxLength={280}
          placeholder='e.g. "Generic time-management apps just added more noise for me."'
          className="w-full rounded-xl border border-rose-200 bg-rose-50/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
          rows={2}
        />
        <p className="text-xs text-gray-400 text-right">{whatDidntWork.length} / 280 (optional)</p>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900">Norms</label>
        <p className="text-xs text-gray-500">
          Which of your norms does this relate to? e.g. <code>anxiety</code>, <code>adhd</code>,{' '}
          <code>first-gen</code>. Press Enter to add.
        </p>
        <div className="flex flex-wrap gap-1.5 items-center rounded-xl border border-gray-300 px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
          {barriers.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs"
            >
              #{t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => setBarriers(barriers.filter((b) => b !== t))}
                className="hover:text-rose-700"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={barrierInput}
            onChange={(e) => setBarrierInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(barrierInput, barriers, setBarriers)
                setBarrierInput('')
              }
            }}
            onBlur={() => {
              if (barrierInput.trim()) {
                addTag(barrierInput, barriers, setBarriers)
                setBarrierInput('')
              }
            }}
            placeholder={barriers.length === 0 ? 'Add a tag…' : ''}
            className="flex-1 min-w-[120px] outline-none text-sm"
            maxLength={32}
            disabled={barriers.length >= 10}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900">Category</label>
        <p className="text-xs text-gray-500">
          High-level group: e.g. <code>employment</code>, <code>education</code>,{' '}
          <code>housing</code>, <code>health</code>.
        </p>
        <div className="flex flex-wrap gap-1.5 items-center rounded-xl border border-gray-300 px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
          {categories.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs"
            >
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => setCategories(categories.filter((b) => b !== t))}
                className="hover:text-rose-700"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(categoryInput, categories, setCategories)
                setCategoryInput('')
              }
            }}
            onBlur={() => {
              if (categoryInput.trim()) {
                addTag(categoryInput, categories, setCategories)
                setCategoryInput('')
              }
            }}
            placeholder={categories.length === 0 ? 'Add a category…' : ''}
            className="flex-1 min-w-[120px] outline-none text-sm"
            maxLength={32}
            disabled={categories.length >= 5}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900">Images (optional)</label>
        <ImageUploader urls={imageUrls} onChange={setImageUrls} max={6} disabled={submitting} />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!canSubmit && (
        <p className="text-sm text-gray-500 text-right" aria-live="polite">
          Still needed: {blockers.join(' and ')}.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Link
          href={`/community${contextQuery}`}
          className="px-4 py-2 text-sm rounded-xl text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Publishing…' : 'Publish question'}
        </button>
      </div>
      </main>
      <Footer />
    </div>
  )
}
