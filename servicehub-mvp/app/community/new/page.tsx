'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import Markdown from '@/components/community/Markdown'
import ImageUploader from '@/components/community/ImageUploader'

export default function NewPostPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
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
      router.push(`/community/post/${j.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
      setSubmitting(false)
    }
  }

  const canSubmit =
    title.trim().length >= 8 && title.trim().length <= 250 && body.trim().length >= 20

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link
        href="/community"
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

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-900">Barrier tags</label>
        <p className="text-xs text-gray-500">
          What kind of barrier is this? e.g. <code>anxiety</code>, <code>paperwork</code>,{' '}
          <code>job-search</code>. Press Enter to add.
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

      <div className="flex justify-end gap-2 pt-2">
        <Link
          href="/community"
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
    </div>
  )
}
