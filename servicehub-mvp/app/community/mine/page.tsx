'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChefHat, FileText, PenLine } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import type { CommunityPostSummary } from '@/types/community'
import { lengthOf } from '@/lib/community/tidbits'

const TABS = [
  { id: 'published', label: 'Published' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'well-dones', label: 'Previous Well-Dones' },
] as const

type Row = CommunityPostSummary & { updated_at?: string; viewer_well_done?: number }

/**
 * My Tidbits (the Tidbits round's planning note, Goal 4): what you published,
 * your drafts, and the Tidbits you gave a Well-Done ("similar to the
 * Liked/Bookmarked tab from Twitter").
 */
function MineInner() {
  const router = useRouter()
  const tab = (useSearchParams()?.get('tab') as (typeof TABS)[number]['id']) || 'published'
  const [rows, setRows] = useState<Row[] | null>(null)
  const [state, setState] = useState<'ok' | 'signin' | 'soon'>('ok')

  useEffect(() => {
    setRows(null)
    fetch(`/api/community/mine?tab=${tab}`, { cache: 'no-store', credentials: 'include' })
      .then(async (r) => {
        if (r.status === 401) return setState('signin')
        const d = await r.json()
        if (d.open === false) setState('soon')
        setRows(d.posts ?? [])
      })
      .catch(() => setRows([]))
  }, [tab])

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Tidbits', href: '/community' }, { label: 'My Tidbits', href: '/community/mine' }]} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        <Link href="/community" className="inline-flex items-center gap-1 text-sm text-gray-800 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Tidbits
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ChefHat className="h-6 w-6 text-amber-700" aria-hidden="true" /> My Tidbits
          </h1>
          <Link href="/community/write" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            <PenLine className="h-4 w-4" aria-hidden="true" /> Write a Tidbit
          </Link>
        </div>
        <nav aria-label="My Tidbits" className="flex flex-wrap gap-1 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => router.push(`/community/mine?tab=${t.id}`)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.id ? 'border-blue-700 font-semibold text-blue-800' : 'border-transparent text-gray-800 hover:text-gray-900'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {state === 'signin' ? (
          <p className="text-gray-900">Sign in to see your Tidbits.</p>
        ) : state === 'soon' ? (
          <p className="rounded-xl border border-gray-300 bg-white p-4 text-gray-900">Tidbits open soon.</p>
        ) : rows === null ? (
          <p className="text-sm text-gray-700">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-gray-800">
            {tab === 'drafts' ? 'No drafts. "Save draft" keeps one here.' : tab === 'well-dones' ? 'No Well-Dones yet. Rate a Tidbit you liked, and it shows here.' : 'Nothing published yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((p) => (
              <li key={p.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-950">
                    <FileText className="h-3 w-3" aria-hidden="true" /> {p.kind === 'tidbit' ? lengthOf(p.length_type).label : 'Question'}
                  </span>
                  {p.is_anonymous && <span className="rounded-full bg-gray-200 px-2 py-0.5 font-semibold text-gray-800">Anonymous</span>}
                  {p.group && <span>{p.group.name}</span>}
                  <span className="ml-auto">{new Date(p.updated_at || p.created_at).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <h2 className="mt-1 text-lg font-semibold text-gray-900">{p.title || 'Untitled draft'}</h2>
                {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-gray-800">{p.excerpt}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                  {tab === 'well-dones' && p.viewer_well_done && <span className="text-gray-800">You gave it {p.viewer_well_done} of 5</span>}
                  {tab !== 'drafts' && <span className="text-gray-700">{p.bite_count ?? 0} Bites · {p.well_done_count ?? 0} Well-Dones</span>}
                  {tab !== 'drafts' && (
                    <Link href={`/community/post/${p.id}`} className="font-medium text-blue-800 underline underline-offset-2">
                      Open
                    </Link>
                  )}
                  {tab !== 'well-dones' && p.kind === 'tidbit' && (
                    <Link href={`/community/write?id=${p.id}`} className="font-medium text-blue-800 underline underline-offset-2">
                      {tab === 'drafts' ? 'Keep writing' : 'Edit'}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  )
}

export default function MyTidbitsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-10 text-gray-700">Loading…</div>}>
      <MineInner />
    </Suspense>
  )
}
