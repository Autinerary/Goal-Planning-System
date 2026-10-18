'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Item {
  id: string
  headline: string
  body: string | null
  image_url: string | null
  resource: { id: string; name: string; category: string; city: string }
}

/**
 * One sponsored listing beside a search, only when sponsored listings are on
 * (NEXT_PUBLIC_SPONSORED; app/api/search/sponsored). Always labelled, and
 * says why it is there.
 */
export default function SponsoredCard({ q, category, province }: { q: string; category?: string; province?: string }) {
  const [item, setItem] = useState<Item | null>(null)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SPONSORED !== 'on') return
    const p = new URLSearchParams({ q, category: category || '', province: province || '' })
    let gone = false
    fetch(`/api/search/sponsored?${p}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => !gone && setItem(d.items?.[0] || null))
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [q, category, province])
  if (!item) return null
  return (
    <aside aria-label="Sponsored" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Sponsored</p>
      <div className="mt-1 flex gap-4">
        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
        )}
        <div>
          <Link href={`/resources/${item.resource.id}`} className="text-lg font-semibold text-gray-900 underline underline-offset-2">
            {item.headline}
          </Link>
          <p className="text-sm text-gray-800">
            {item.resource.name}
            {item.resource.city ? ` · ${item.resource.city}` : ''}
          </p>
          {item.body && <p className="mt-1 text-sm text-gray-900">{item.body}</p>}
          <p className="mt-2 text-xs text-gray-700">Why you see this: it matches what you searched. Nothing about you is used, and it doesn&apos;t change the results below.</p>
        </div>
      </div>
    </aside>
  )
}
