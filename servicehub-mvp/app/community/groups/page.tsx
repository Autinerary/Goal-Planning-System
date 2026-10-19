'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'

interface Group {
  slug: string
  name: string
  description: string | null
  member_count: number
  joined: boolean
}

/**
 * Tidbits groups (STEP 83): join the ones that fit you, to write Tidbits in
 * them. Who is in a group is private; only how many.
 */
export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [signedIn, setSignedIn] = useState(true)
  const [open, setOpen] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/community/groups', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setGroups(d.groups ?? [])
        setSignedIn(d.signedIn !== false)
        setOpen(d.open !== false)
      })
      .catch(() => setGroups([]))
  }, [])

  const toggle = async (g: Group) => {
    setBusy(g.slug)
    setError('')
    const res = await fetch('/api/community/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug: g.slug, join: !g.joined }),
    }).catch(() => null)
    setBusy('')
    if (!res?.ok) return setError((await res?.json().catch(() => null))?.error || 'That didn’t work. Please try again.')
    setGroups((list) => list?.map((x) => (x.slug === g.slug ? { ...x, joined: !g.joined, member_count: Math.max(0, x.member_count + (g.joined ? -1 : 1)) } : x)) ?? null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Tidbits', href: '/community' }, { label: 'Groups', href: '/community/groups' }]} />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        <Link href="/community" className="inline-flex items-center gap-1 text-sm text-gray-800 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Tidbits
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Users className="h-6 w-6 text-blue-700" aria-hidden="true" /> Groups
          </h1>
          <p className="mt-1 text-sm text-gray-800">
            Join the groups that fit you, to write Tidbits in them. Nobody sees who is in a group, only how many people are.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-800">
            {error}
          </p>
        )}
        {!open ? (
          <p className="rounded-xl border border-gray-300 bg-white p-4 text-gray-900">Groups open soon.</p>
        ) : groups === null ? (
          <p className="text-sm text-gray-700">Loading…</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <li key={g.slug} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4">
                <h2 className="font-semibold text-gray-900">{g.name}</h2>
                {g.description && <p className="mt-1 flex-1 text-sm text-gray-800">{g.description}</p>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-700">
                    {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                  </span>
                  {signedIn ? (
                    <button
                      type="button"
                      onClick={() => toggle(g)}
                      disabled={busy === g.slug}
                      aria-pressed={g.joined}
                      aria-label={`${g.joined ? 'Leave' : 'Join'} ${g.name}`}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${g.joined ? 'border border-gray-300 text-gray-900 hover:bg-gray-50' : 'bg-blue-700 text-white hover:bg-blue-800'}`}
                    >
                      {g.joined ? 'Joined · Leave' : 'Join'}
                    </button>
                  ) : (
                    <Link href="/login?next=/community/groups" className="text-sm font-medium text-blue-800 underline underline-offset-2">
                      Sign in to join
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
