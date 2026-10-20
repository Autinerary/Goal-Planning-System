'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Palette, X } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import { showToast } from '@/lib/toast'

interface Visual {
  id: string
  title: string
  description: string | null
  alt_text: string
  image_url: string
  medium: string | null
  credit: string | null
  norms: string[]
  created_at: string
}

/**
 * The team's review of shared art (STEP 86): each piece waiting, to show
 * on Visuals or not. Only admins get the list (the API and the visuals
 * policy both check is_admin()).
 */
export default function AdminVisualsPage() {
  const [items, setItems] = useState<Visual[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/visuals?review=1', { credentials: 'include' })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error || 'Couldn’t load them')
        if (d?.ready === false) throw new Error('Visuals isn’t in the database yet (STEP 86).')
        setItems(d?.visuals || [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Couldn’t load them'))
  }, [])

  const decide = async (v: Visual, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/visuals/${v.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!res.ok) return showToast.error('That didn’t save')
    setItems((list) => (list || []).filter((x) => x.id !== v.id))
    showToast.success(status === 'approved' ? 'Shown on Visuals' : 'Not shown')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-gray-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Admin
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Palette className="h-7 w-7 text-rose-700" aria-hidden="true" /> Visuals waiting for review
        </h1>
        <p className="mt-2 text-sm text-gray-700">
          Each artist said they made it themselves, without AI, and the upload found no AI tool&apos;s marks in the file. Still look for the
          usual signs (garbled hands or text, a too-smooth finish) before showing it.
        </p>
        {error && (
          <p role="alert" className="mt-6 text-sm text-red-800">
            {error}
          </p>
        )}
        {items === null && !error && <p className="mt-6 text-gray-700">Loading…</p>}
        {items?.length === 0 && <p className="mt-6 rounded-lg border border-gray-200 bg-white p-6 text-gray-900">Nothing waiting.</p>}
        <ul className="mt-6 space-y-4">
          {(items || []).map((v) => (
            <li key={v.id} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row">
              <a href={v.image_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.image_url} alt={v.alt_text} className="h-48 w-full rounded-lg bg-gray-100 object-contain sm:w-64" />
              </a>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-gray-900">{v.title}</h2>
                <p className="text-sm text-gray-700">
                  by {v.credit || 'a community artist'}
                  {v.medium ? ` · ${v.medium}` : ''} · sent {new Date(v.created_at).toLocaleDateString()}
                </p>
                <p className="mt-2 text-sm text-gray-900">
                  <span className="font-medium">Shows:</span> {v.alt_text}
                </p>
                {v.description && <p className="mt-1 text-sm text-gray-800">{v.description}</p>}
                {v.norms.length > 0 && <p className="mt-1 text-xs text-gray-700">Norms: {v.norms.join(', ')}</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => decide(v, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800">
                    <Check className="h-4 w-4" aria-hidden="true" /> Show it
                  </button>
                  <button type="button" onClick={() => decide(v, 'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                    <X className="h-4 w-4" aria-hidden="true" /> Don&apos;t show it
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
