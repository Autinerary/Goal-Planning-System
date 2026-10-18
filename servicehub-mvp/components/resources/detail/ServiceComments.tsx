'use client'

import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { appSignInHref } from '@/lib/appSignIn'

interface Comment {
  id: string
  body: string
  created_at: string
  author?: string
  role?: string | null
  mine?: boolean
}

/**
 * Comments on a service: anyone signed in, at any time (the team's planning
 * note, October 2026, Goal 5). Ratings, above, come from experience.
 */
export default function ServiceComments({ resourceId, resourceName, signedIn }: { resourceId: string; resourceName: string; signedIn: boolean }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [open, setOpen] = useState(true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetch(`/api/resources/${resourceId}/comments`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setComments(d.comments || [])
        setOpen(d.open !== false)
      })
      .catch(() => {})
  }, [resourceId])

  const post = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/resources/${resourceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error || 'Could not post that.')
      setComments((c) => [{ ...d.comment, author: 'You', mine: true }, ...c])
      setText('')
      setStatus('Your comment is posted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post that.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/resources/${resourceId}/comments?comment=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setComments((c) => c.filter((x) => x.id !== id))
      setStatus('Your comment is removed.')
    }
  }

  if (!open) return null
  return (
    <section aria-labelledby="comments-heading" className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
      <h2 id="comments-heading" className="flex items-center gap-2 text-xl font-semibold text-gray-900">
        <MessageSquare className="h-5 w-5 text-gray-700" aria-hidden="true" /> Comments
      </h2>
      <p className="mt-1 text-sm text-gray-700">Anyone can comment, whether or not they have used {resourceName}. Ratings come from people who have.</p>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {signedIn ? (
        <form onSubmit={post} className="mt-4 space-y-2">
          <label htmlFor="comment-body" className="block text-sm font-medium text-gray-900">
            Add a comment
          </label>
          <textarea
            id="comment-body"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="A question, a tip, what you have heard…"
          />
          {error && (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700">{text.length}/1,000</span>
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {busy ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm">
          <a href={appSignInHref(typeof window === 'undefined' ? '/' : window.location.pathname)} className="font-medium text-blue-800 underline">
            Sign in to comment
          </a>
        </p>
      )}
      {comments.length === 0 ? (
        <p className="mt-4 text-sm text-gray-700">No comments yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {comments.map((c) => (
            <li key={c.id} className="py-3">
              <p className="text-sm text-gray-900 whitespace-pre-line">{c.body}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-gray-700">
                <span>
                  {c.mine ? 'You' : c.author}
                  {c.role ? ` · ${c.role}` : ''} · {new Date(c.created_at).toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {c.mine && (
                  <button type="button" onClick={() => remove(c.id)} className="font-medium text-gray-800 underline">
                    Remove
                  </button>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
