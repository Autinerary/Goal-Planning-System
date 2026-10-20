'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bookmark, ChefHat, ShoppingBag, Trash2 } from 'lucide-react'
import { showToast } from '@/lib/toast'

type Kind = 'product' | 'post'
type Status = 'wishlist' | 'current' | 'past'

interface Item {
  id: string
  name: string
  href: string
  category: string
  categoryLabel: string
  image: string | null
  detail: string | null
  notes: string | null
  savedAt: string
  gone: boolean
}

const MOVES: Record<Status, { to: Status; label: string }[]> = {
  wishlist: [{ to: 'current', label: 'Start using it' }],
  current: [
    { to: 'past', label: 'Mark as used' },
    { to: 'wishlist', label: 'Back to the Wishlist' },
  ],
  past: [{ to: 'current', label: 'Using it again' }],
}

const WHAT: Record<Kind, { many: string; browse: string; href: string }> = {
  product: { many: 'shop items', browse: 'Browse the shop', href: '/shop' },
  post: { many: 'Tidbits', browse: 'Browse Tidbits', href: '/community' },
}

/**
 * Store Items and Posts in My Resources (Layer 1 beside Services), with
 * their own categories as Layer 2: a shop item's group, a Tidbit's
 * community group (the team's notes, October 2026).
 */
export default function KeptItems({ kind, status }: { kind: Kind; status: Status }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([])
  const [ready, setReady] = useState(true)
  const [category, setCategory] = useState<string | null>(null)

  useEffect(() => {
    let gone = false
    setItems(null)
    setCategory(null)
    fetch(`/api/my-resources/items?kind=${kind}&status=${status}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (gone) return
        setReady(d?.ready !== false)
        setItems(d?.items || [])
        setCategories(d?.categories || [])
      })
      .catch(() => !gone && setItems([]))
    return () => {
      gone = true
    }
  }, [kind, status])

  const send = async (method: 'PATCH' | 'DELETE', item: Item, to?: Status) => {
    try {
      const res =
        method === 'DELETE'
          ? await fetch(`/api/my-resources/items?kind=${kind}&id=${item.id}`, { method, credentials: 'include' })
          : await fetch('/api/my-resources/items', { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id: item.id, status: to }) })
      if (!res.ok) throw new Error()
      setItems((list) => (list || []).filter((i) => i.id !== item.id))
      showToast.success(method === 'DELETE' ? 'Taken out of My Resources' : 'Moved')
    } catch {
      showToast.error('That didn’t save. Please try again.')
    }
  }

  if (!ready) {
    return <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-700">Keeping {WHAT[kind].many} in My Resources opens soon.</p>
  }
  if (items === null) return <p className="text-sm text-gray-700">Loading…</p>
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <Bookmark className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
        <p className="mt-2 text-gray-900">No {WHAT[kind].many} here yet.</p>
        <p className="mt-1 text-sm text-gray-700">Use &ldquo;Save to My Resources&rdquo; on any of them to keep it here.</p>
        <Link href={WHAT[kind].href} className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          {WHAT[kind].browse}
        </Link>
      </div>
    )
  }

  const shown = category ? items.filter((i) => i.category === category) : items
  const pill = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`
  return (
    <div className="space-y-4">
      {categories.length > 1 && (
        <div role="group" aria-label="Category" className="flex flex-wrap gap-2 border-l-2 border-gray-200 pl-3">
          <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={pill(category === null)}>
            All categories
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)} className={pill(category === c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item) => (
          <li key={item.id} className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              {item.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={item.image} alt="" className="h-14 w-14 flex-shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md bg-gray-100" aria-hidden="true">
                  {kind === 'post' ? <ChefHat className="h-6 w-6 text-amber-700" /> : <ShoppingBag className="h-6 w-6 text-gray-600" />}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs text-gray-700">
                  {item.categoryLabel}
                  {item.detail ? ` · ${item.detail}` : ''}
                </p>
                {item.gone ? (
                  <p className="font-semibold text-gray-700">{item.name}</p>
                ) : (
                  <Link href={item.href} className="font-semibold text-gray-900 underline-offset-2 hover:underline">
                    {item.name}
                  </Link>
                )}
                <p className="mt-0.5 text-xs text-gray-600">Saved {new Date(item.savedAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!item.gone &&
                MOVES[status].map((m) => (
                  <button key={m.to} type="button" onClick={() => send('PATCH', item, m.to)} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-200">
                    {m.label}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => send('DELETE', item)}
                className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
                aria-label={`Take ${item.name} out of My Resources`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
