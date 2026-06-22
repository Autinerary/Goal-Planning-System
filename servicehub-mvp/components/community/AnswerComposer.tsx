'use client'

import { useState } from 'react'
import Markdown from './Markdown'
import ImageUploader from './ImageUploader'

interface AnswerComposerProps {
  postId: string
  parentId?: string | null
  onSubmitted: () => void
  onCancel?: () => void
}

/**
 * Compact composer used in two places:
 *   1. Below the post body — "Your answer".
 *   2. Threaded reply box under an existing answer.
 *
 * Live preview (markdown) is collapsible.
 */
export default function AnswerComposer({
  postId,
  parentId,
  onSubmitted,
  onCancel,
}: AnswerComposerProps) {
  const [body, setBody] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body_markdown: body.trim(),
          parent_id: parentId ?? null,
          image_urls: imageUrls,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `Submit failed (${res.status})`)
      }
      setBody('')
      setImageUrls([])
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2" data-testid="answer-composer">
      {preview ? (
        <Markdown source={body || '*Nothing to preview yet*'} />
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={parentId ? 'Write a reply…' : 'Share what worked for you. Markdown supported.'}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] font-mono"
          minLength={10}
          maxLength={30000}
        />
      )}
      <ImageUploader urls={imageUrls} onChange={setImageUrls} max={3} disabled={busy} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs text-blue-700 hover:underline"
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-lg text-gray-700 hover:bg-gray-100"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={busy || body.trim().length < 10}
            onClick={submit}
          >
            {busy ? 'Posting…' : parentId ? 'Reply' : 'Post answer'}
          </button>
        </div>
      </div>
    </div>
  )
}
