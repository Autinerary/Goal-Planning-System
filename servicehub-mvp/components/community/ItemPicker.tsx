'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'

export interface PickedItem {
  kind: 'resource' | 'product'
  id: string
  name: string
}

/**
 * Integrated Resources: the services and products a Tidbit mentions, found
 * in ResourceHub and shown at its end (the Tidbits round's planning note,
 * Goal 2). Up to 8.
 */
export default function ItemPicker({ items, onChange }: { items: PickedItem[]; onChange: (items: PickedItem[]) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PickedItem[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 3) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setBusy(true)
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&pageSize=8`, { credentials: 'include' }).catch(() => null)
      const d = await res?.json().catch(() => null)
      setBusy(false)
      setResults(
        ((d?.results as any[]) ?? []).slice(0, 8).map((r) => ({ kind: r.kind === 'product' ? 'product' : 'resource', id: r.id, name: r.name }))
      )
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  const has = (r: PickedItem) => items.some((i) => i.kind === r.kind && i.id === r.id)
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map((i) => (
            <li key={`${i.kind}:${i.id}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-950">
              {i.kind === 'product' ? 'Product' : 'Service'}: {i.name}
              <button type="button" aria-label={`Remove ${i.name}`} onClick={() => onChange(items.filter((x) => !(x.kind === i.kind && x.id === i.id)))} className="rounded-full p-0.5 hover:bg-emerald-100">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length < 8 && (
        <div>
          <label htmlFor="item-search" className="sr-only">
            Find a service or product in ResourceHub
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" aria-hidden="true" />
            <input
              id="item-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a service or product you mention…"
              className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900"
            />
          </div>
          {busy && <p className="mt-1 text-xs text-gray-700">Looking…</p>}
          {results.length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {results.map((r) => (
                <li key={`${r.kind}:${r.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-gray-900">
                    <span className="text-gray-700">{r.kind === 'product' ? 'Product' : 'Service'}:</span> {r.name}
                  </span>
                  <button
                    type="button"
                    disabled={has(r)}
                    onClick={() => onChange([...items, r])}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {has(r) ? 'Added' : 'Add'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
