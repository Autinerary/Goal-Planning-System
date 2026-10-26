'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Mail, MousePointerClick, UserPlus } from 'lucide-react'
import EmptyState from '@/components/feedback/EmptyState'
import { SIGNUP_SERVICES } from '@/lib/signupServices'
import { signupHref, signupLabel, type SignupStatus } from '@/lib/signup'

interface Row {
  service: string
  resource_id: string | null
  /** The ResourceHub listing it was for, when there is one (a local service's request). */
  resource?: { name?: string } | null
  status: SignupStatus
  runner: string
  updated_at: string
}

/** The services Sign me up signed the person up for (lib/signup.ts), and where each is. */
export default function SignedUpTab() {
  const [rows, setRows] = useState<Row[] | null>(null)
  useEffect(() => {
    fetch('/api/my-resources/signups', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { signups: [] }))
      .then((j) => setRows(j.signups || []))
      .catch(() => setRows([]))
  }, [])

  if (!rows) return <p className="text-gray-700">Loading…</p>
  if (!rows.length) {
    return (
      <EmptyState
        icon={<UserPlus className="w-16 h-16 text-gray-300" aria-hidden="true" />}
        title="No sign-ups yet"
        message="Press Sign me up on a service, here or on a task in Autinerary, and its own sign-up form is filled in for you."
        actionLabel="Find services"
        actionHref="/search"
      />
    )
  }
  return (
    <ul className="space-y-3" aria-label="Your sign-ups">
      {rows.map((r) => {
        const s = SIGNUP_SERVICES[r.service]
        // A partner, or a service a newer extension brought: its key, readably.
        const name = s?.name || r.resource?.name || r.service.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
        const Icon = r.status === 'check_email' ? Mail : r.status === 'needs_you' ? MousePointerClick : CheckCircle2
        const good = r.status === 'signed_up' || r.status === 'exists' || r.status === 'requested'
        return (
          <li key={r.service} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <span className="font-semibold text-gray-900">
              {r.resource_id ? (
                <Link href={`/resources/${r.resource_id}`} className="underline-offset-2 hover:underline">
                  {name}
                </Link>
              ) : (
                name
              )}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-semibold ${good ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" /> {signupLabel(r.status, s?.kind || 'account', r.updated_at)}
              {(r.status === 'failed' || r.status === 'needs_you') && (
                <a href={signupHref(r.service, r.resource_id)} className="ml-1 underline underline-offset-2">
                  Try again
                </a>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
