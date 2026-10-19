'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Item {
  id: string
  headline: string
  body: string | null
  image_url: string | null
  resource: { id: string; name: string; category: string; city: string }
}

const WHY: Record<'search' | 'tidbits', string> = {
  search: 'it matches what you searched',
  tidbits: 'it is about what this Tidbit is about',
}

const APP = (process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000').replace(/\/$/, '')

/** A view or a click, sent even as the page changes (app/api/sponsored/event). */
function record(id: string, kind: 'impression' | 'click', placement: string) {
  const body = JSON.stringify({ id, kind, placement })
  try {
    if (navigator.sendBeacon?.('/api/sponsored/event', new Blob([body], { type: 'application/json' }))) return
  } catch {}
  fetch('/api/sponsored/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

/**
 * One sponsored listing beside a search or a Tidbit, only when sponsored
 * listings are on (NEXT_PUBLIC_SPONSORED; app/api/search/sponsored). Always
 * labelled, says why it is there, and is counted as seen only once half of
 * it is on screen. People who pay never get one.
 */
export default function SponsoredCard({
  q,
  category,
  province,
  placement = 'search',
}: {
  q: string
  category?: string
  province?: string
  placement?: 'search' | 'tidbits'
}) {
  const [item, setItem] = useState<Item | null>(null)
  const [offer, setOffer] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SPONSORED !== 'on') return
    const p = new URLSearchParams({ q, category: category || '', province: province || '', placement })
    let gone = false
    fetch(`/api/search/sponsored?${p}`, { cache: 'no-store' })
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
  }, [q, category, province, placement])

  useEffect(() => {
    const el = ref.current
    if (!item || !el || typeof IntersectionObserver === 'undefined') return
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          record(item.id, 'impression', placement)
          seen.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    seen.observe(el)
    return () => seen.disconnect()
  }, [item, placement])

  if (!item) return null
  return (
    <aside ref={ref} aria-label="Sponsored" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Sponsored</p>
      <div className="mt-1 flex gap-4">
        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
        )}
        <div>
          <Link
            href={`/resources/${item.resource.id}`}
            onClick={() => record(item.id, 'click', placement)}
            className="text-lg font-semibold text-gray-900 underline underline-offset-2"
          >
            {item.headline}
          </Link>
          <p className="text-sm text-gray-800">
            {item.resource.name}
            {item.resource.city ? ` · ${item.resource.city}` : ''}
          </p>
          {item.body && <p className="mt-1 text-sm text-gray-900">{item.body}</p>}
          <p className="mt-2 text-xs text-gray-700">
            Why you see this: {WHY[placement]}. Nothing about you is used or shared with them, and it doesn&apos;t change what else you see.
            {offer && (
              <>
                {' '}
                <a href={`${APP}/pricing`} className="font-medium text-amber-950 underline underline-offset-2">
                  A paid plan has no sponsored listings.
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </aside>
  )
}
