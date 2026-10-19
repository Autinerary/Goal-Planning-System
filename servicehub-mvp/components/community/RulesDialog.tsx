'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChefHat, X } from 'lucide-react'
import { RULES, RULES_INTRO } from '@/lib/community/tidbits'

/**
 * Whether this person still has to read the community rules (STEP 83): signed
 * in, the rules are in the database, and they haven't agreed to this version.
 */
export function useCommunityRules() {
  const [state, setState] = useState({ loaded: false, signedIn: false, accepted: true, open: false })
  const refresh = useCallback(async () => {
    try {
      const d = await (await fetch('/api/community/rules', { cache: 'no-store', credentials: 'include' })).json()
      setState({ loaded: true, signedIn: !!d.signedIn, accepted: !!d.accepted, open: d.open !== false })
    } catch {
      setState((s) => ({ ...s, loaded: true }))
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const accept = useCallback(async () => {
    const res = await fetch('/api/community/rules', { method: 'POST', credentials: 'include' }).catch(() => null)
    if (res?.ok) setState((s) => ({ ...s, accepted: true }))
    return !!res?.ok
  }, [])
  return { ...state, needed: state.loaded && state.signedIn && state.open && !state.accepted, accept, refresh }
}

/**
 * The community rules, in two pages (the Tidbits round's planning note,
 * Goal 2): first what Tidbits is for (short and sweet, and solution-
 * oriented), then the rules. Shown the first time someone opens Tidbits, and
 * before a first post, answer or rating.
 */
export default function RulesDialog({
  open,
  onAgree,
  onClose,
  reason = 'tidbits',
}: {
  open: boolean
  onAgree: () => Promise<boolean> | Promise<void> | void
  onClose: () => void
  reason?: 'tidbits' | 'post' | 'rating'
}) {
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setPage(0)
    setError('')
    const t = setTimeout(() => box.current?.focus(), 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  useEffect(() => {
    if (open) box.current?.focus()
  }, [page, open])
  if (!open) return null

  const agree = async () => {
    setBusy(true)
    setError('')
    const ok = await onAgree()
    setBusy(false)
    if (ok === false) setError('That didn’t save. Please try again.')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="rules-title" tabIndex={-1} className="w-full max-w-lg rounded-2xl bg-white p-6 text-gray-900 shadow-xl outline-none">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Page {page + 1} of 2</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-700 hover:bg-gray-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {page === 0 ? (
          <>
            <h2 id="rules-title" className="mt-1 flex items-center gap-2 text-xl font-bold">
              <ChefHat className="h-6 w-6 text-blue-700" aria-hidden="true" /> {RULES_INTRO.title}
            </h2>
            {reason === 'rating' && <p className="mt-2 text-sm font-medium">Before your first rating, a short read: it takes a minute.</p>}
            {reason === 'post' && <p className="mt-2 text-sm font-medium">Before your first post, a short read: it takes a minute.</p>}
            {RULES_INTRO.paragraphs.map((p) => (
              <p key={p} className="mt-3 text-sm text-gray-800">
                {p}
              </p>
            ))}
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setPage(1)} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                Next: the rules
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="rules-title" className="mt-1 text-xl font-bold">
              {RULES.title}
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-800">
              {RULES.items.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
            {error && (
              <p role="alert" className="mt-3 text-sm text-red-800">
                {error}
              </p>
            )}
            <div className="mt-6 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setPage(0)} className="rounded-xl px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100">
                Back
              </button>
              <button type="button" disabled={busy} onClick={agree} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                {busy ? 'Saving…' : 'I agree'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
