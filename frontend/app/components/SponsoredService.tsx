'use client'

import { useEffect, useRef, useState } from 'react'
import { goHubHref } from '@/lib/serviceHub'

interface Item {
  id: string
  headline: string
  body: string | null
  image_url: string | null
  resource: { id: string; name: string; category: string; city: string }
}

/** A view or a click, sent even as the page changes (app/api/sponsored/event). */
function record(id: string, kind: 'impression' | 'click') {
  const body = JSON.stringify({ id, kind, placement: 'paths' })
  try {
    if (navigator.sendBeacon?.('/api/sponsored/event', new Blob([body], { type: 'application/json' }))) return
  } catch {}
  fetch('/api/sponsored/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

/**
 * The sponsored service among a step's suggested services (the Tidbits
 * round's planning note, Goal 7: "in Paths, 1 of 3 recommended resources
 * 'Promoted'"). The milestone page shows it third, only after two services
 * of the plan's own, so at most one in three is sponsored and none of the
 * plan's suggestions is pushed out. Off until NEXT_PUBLIC_SPONSORED is on;
 * never for people who pay or have free access (app/api/sponsored).
 */
export default function SponsoredService({ text }: { text: string }) {
  const [item, setItem] = useState<Item | null>(null)
  const [offer, setOffer] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SPONSORED !== 'on' || !text.trim()) return
    let gone = false
    fetch(`/api/sponsored?${new URLSearchParams({ q: text.slice(0, 400) })}`, { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (gone) return
        setItem(d.items?.[0] || null)
        setOffer(Boolean(d.adFreeOffer))
      })
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [text])

  useEffect(() => {
    const el = ref.current
    if (!item || !el || typeof IntersectionObserver === 'undefined') return
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          record(item.id, 'impression')
          seen.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    seen.observe(el)
    return () => seen.disconnect()
  }, [item])

  if (!item) return null
  return (
    <div ref={ref} role="group" aria-label="Sponsored" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Sponsored</p>
      <a
        href={goHubHref(`/resources/${item.resource.id}`)}
        onClick={() => record(item.id, 'click')}
        className="mt-1 block font-semibold text-slate-900 underline underline-offset-2"
      >
        {item.headline}
      </a>
      <p className="text-sm text-slate-800">
        {item.resource.name}
        {item.resource.city ? ` · ${item.resource.city}` : ''}
      </p>
      {item.body && <p className="mt-1 text-sm text-slate-900">{item.body}</p>}
      <p className="mt-2 text-xs text-slate-700">
        Why you see this: it is about this step of your plan. Nothing about you is used or shared with them, and your plan&apos;s own suggestions are all still here.
        {offer && (
          <>
            {' '}
            <a href="/pricing" className="font-medium text-amber-950 underline underline-offset-2">
              A paid plan has no sponsored listings.
            </a>
          </>
        )}
      </p>
    </div>
  )
}
