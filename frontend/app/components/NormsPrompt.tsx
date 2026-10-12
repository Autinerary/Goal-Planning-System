'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Asked where it is used (Riipen Labs, Group 30: "move deferred questions into
 * contextual prompts shown when related features are first used"; Group 28:
 * personalization "asked in context at the point it is actually used"). On a
 * step's tools: someone who has shared no norms is told that sharing them
 * makes suggestions fit, with where to do it. Shown nothing once they have.
 * Checked once per visit (sessionStorage), not on every step.
 */
const KEY = 'autinerary_has_norms'

export default function NormsPrompt() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let cancelled = false
    try {
      const known = sessionStorage.getItem(KEY)
      if (known !== null) { setShow(known === '0'); return }
    } catch {}
    Promise.all([
      fetch('/api/me/norms', { cache: 'no-store', credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/me/diagnostic-profile', { cache: 'no-store', credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([norms, support]) => {
      if (cancelled || !norms) return
      const has = (norms.norms || []).length > 0 || Boolean(support?.diagnosticProfile?.profile)
      try { sessionStorage.setItem(KEY, has ? '1' : '0') } catch {}
      setShow(!has)
    })
    return () => { cancelled = true }
  }, [])
  if (!show) return null
  return (
    <p className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-slate-800">
      These suggestions don&apos;t know your norms yet. Share them, if you like, so tools fit how you work.{' '}
      <Link href="/profile/diagnostic" className="font-semibold text-indigo-800 underline underline-offset-2">Add your norms</Link>{' '}
      <span className="text-slate-700">(optional, private)</span>
    </p>
  )
}
