'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bookmark, BookmarkCheck, X } from 'lucide-react'
import { showToast } from '@/lib/toast'

type Kind = 'product' | 'post'
type Status = 'wishlist' | 'current' | 'past'

const STATUS_LABEL: Record<Status, string> = { wishlist: 'Wishlist', current: 'Using it', past: 'Used it' }

/**
 * Keep a shop item or a Tidbit in My Resources (the team's notes, October
 * 2026: My Resources holds Services, Posts and Store Items), on the
 * Wishlist, as one you're using, or one you've used. Hidden until STEP 86
 * adds saved_items.
 */
export default function KeepButton({ kind, id, signedIn }: { kind: Kind; id: string; signedIn: boolean }) {
  const path = usePathname()
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    let gone = false
    fetch(`/api/my-resources/items?kind=${kind}&id=${id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (gone || !d) return
        setReady(Boolean(d.ready))
        setStatus(d.status ?? null)
      })
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [kind, id, signedIn])

  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(path || '/')}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-800 underline underline-offset-2">
        <Bookmark className="h-4 w-4" aria-hidden="true" /> Sign in to keep it in My Resources
      </Link>
    )
  }
  if (!ready) return null

  const send = async (method: 'POST' | 'PATCH' | 'DELETE', next: Status | null) => {
    if (busy) return
    setBusy(true)
    try {
      const res =
        method === 'DELETE'
          ? await fetch(`/api/my-resources/items?kind=${kind}&id=${id}`, { method, credentials: 'include' })
          : await fetch('/api/my-resources/items', { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, status: next }) })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'That didn’t save.')
      setStatus(next)
      showToast.success(next ? `In My Resources: ${STATUS_LABEL[next]}` : 'Taken out of My Resources')
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'That didn’t save.')
    } finally {
      setBusy(false)
    }
  }

  if (!status) {
    return (
      <button
        type="button"
        onClick={() => send('POST', 'wishlist')}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" /> Save to My Resources
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
        <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> In My Resources
      </span>
      <div role="group" aria-label="Where it is in My Resources" className="inline-flex overflow-hidden rounded-lg border border-gray-300">
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            disabled={busy}
            onClick={() => status !== s && send('PATCH', s)}
            className={`px-3 py-1.5 text-sm font-medium ${status === s ? 'bg-blue-700 text-white' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => send('DELETE', null)}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove
      </button>
    </div>
  )
}
