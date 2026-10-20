'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Palette, Plus, ShieldCheck } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { NORM_GROUPS } from '@/lib/norms/taxonomy'
import { useMyProfile } from '@/lib/useMyProfile'

interface Visual {
  id: string
  title: string
  description: string | null
  alt_text: string
  image_url: string
  medium: string | null
  credit: string | null
  norms: string[]
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

const NORMS = NORM_GROUPS.flatMap((g) => g.norms).filter((n) => !n.id.endsWith('_other'))
const normLabel = (id: string) => NORMS.find((n) => n.id === id)?.label || id
const STATUS: Record<Visual['status'], string> = { pending: 'Waiting for the team', approved: 'Shared', rejected: 'Not shared' }

/**
 * Visuals (the team's notes, October 2026: "Add new category beside
 * services, shop & tidbits: Visuals. People can add their real art here. No
 * to AI-generated art or visuals"). Approved art, newest first; the
 * signed-in artist's own, with where each stands; and a way to share one.
 */
export default function VisualsPage() {
  const { profile } = useMyProfile()
  const [visuals, setVisuals] = useState<Visual[] | null>(null)
  const [mine, setMine] = useState<Visual[]>([])
  const [ready, setReady] = useState(true)
  const [norm, setNorm] = useState('')

  useEffect(() => {
    setVisuals(null)
    fetch(`/api/visuals${norm ? `?norm=${encodeURIComponent(norm)}` : ''}`)
      .then((r) => r.json())
      .then((d) => {
        setReady(d.ready !== false)
        setVisuals(d.visuals || [])
      })
      .catch(() => setVisuals([]))
  }, [norm])

  useEffect(() => {
    if (!profile?.signedIn) return
    fetch('/api/visuals?mine=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMine((d?.visuals || []).filter((v: Visual) => v.status !== 'approved')))
      .catch(() => {})
  }, [profile?.signedIn])

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Visuals', href: '/visuals' }]} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
              <Palette className="h-8 w-8 text-rose-700" aria-hidden="true" /> Visuals
            </h1>
            <p className="mt-2 max-w-2xl text-gray-700">Real art by people in the community: drawings, paintings, photographs, crafts and more.</p>
          </div>
          {ready && (
            <Link
              href={profile?.signedIn ? '/visuals/new' : '/login?next=/visuals/new'}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Share your art
            </Link>
          )}
        </div>

        <p className="mt-4 flex max-w-3xl items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-gray-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-800" aria-hidden="true" />
          <span>
            <strong>No AI-generated art.</strong> Every artist says they made their piece themselves, without AI; files carrying an AI
            tool&apos;s marks are turned away; and the team looks at each one before it&apos;s shown.
          </span>
        </p>

        {!ready ? (
          <p className="mt-8 rounded-lg border border-gray-200 bg-white p-6 text-gray-900">Visuals opens soon.</p>
        ) : (
          <>
            {mine.length > 0 && (
              <section aria-labelledby="mine-heading" className="mt-8">
                <h2 id="mine-heading" className="text-lg font-semibold text-gray-900">
                  Yours, not shown yet
                </h2>
                <ul className="mt-3 flex flex-wrap gap-3">
                  {mine.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2 pr-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.image_url} alt="" className="h-12 w-12 rounded object-cover" />
                      <span className="text-sm">
                        <span className="block font-medium text-gray-900">{v.title}</span>
                        <span className="text-gray-700">{STATUS[v.status]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <label htmlFor="visuals-norm" className="text-sm font-medium text-gray-900">
                Made by or about
              </label>
              <select
                id="visuals-norm"
                value={norm}
                onChange={(e) => setNorm(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Everyone</option>
                {NORMS.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>

            {visuals === null ? (
              <p className="mt-6 text-gray-700">Loading…</p>
            ) : visuals.length === 0 ? (
              <div className="mt-6 rounded-lg border border-gray-200 bg-white p-10 text-center">
                <Palette className="mx-auto h-10 w-10 text-gray-400" aria-hidden="true" />
                <p className="mt-3 text-gray-900">{norm ? 'Nothing here for that yet.' : 'No art shared yet. Be the first!'}</p>
              </div>
            ) : (
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visuals.map((v) => (
                  <li key={v.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <a href={v.image_url} target="_blank" rel="noopener noreferrer" className="block bg-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.image_url} alt={v.alt_text} loading="lazy" className="aspect-[4/3] w-full object-contain" />
                      <span className="sr-only">(opens the full image in a new tab)</span>
                    </a>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900">{v.title}</h3>
                      <p className="text-sm text-gray-700">
                        by {v.credit || 'a community artist'}
                        {v.medium ? ` · ${v.medium}` : ''}
                      </p>
                      {v.description && <p className="mt-2 text-sm text-gray-800">{v.description}</p>}
                      {v.norms.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Norms">
                          {v.norms.map((n) => (
                            <li key={n} className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-900">
                              {normLabel(n)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
