'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock, Phone, Send } from 'lucide-react'
import EmptyState from '@/components/feedback/EmptyState'
import { applicationLabel, applyHref, type ApplicationStatus } from '@/lib/apply'

interface Application {
  resourceId: string
  name: string
  category: string | null
  status: ApplicationStatus
  at: string | null
  phone: string | null
}

/**
 * Services the person applied to with one-click Apply (lib/apply.ts): sent,
 * or waiting for the team to find the service's email address.
 */
export default function AppliedTab() {
  const [applications, setApplications] = useState<Application[] | null>(null)

  useEffect(() => {
    fetch('/api/my-resources/applications', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { applications: [] }))
      .then((j) => setApplications(j.applications || []))
      .catch(() => setApplications([]))
  }, [])

  if (!applications) return <p className="text-gray-700">Loading…</p>
  if (!applications.length) {
    return (
      <EmptyState
        icon={<Send className="w-16 h-16 text-gray-300" aria-hidden="true" />}
        title="No applications yet"
        message="Press Apply on a service, here or on a task in Autinerary, and we send your request for you. They reply to your email."
        actionLabel="Find services"
        actionHref="/search"
      />
    )
  }
  return (
    <ul className="space-y-3" aria-label="Your applications">
      {applications.map((a) => {
        const Icon = a.status === 'sent' ? CheckCircle2 : a.status === 'waiting' ? Clock : a.status === 'unreachable' ? Phone : Send
        return (
          <li key={a.resourceId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <span>
              <Link href={`/resources/${a.resourceId}`} className="font-semibold text-gray-900 underline-offset-2 hover:underline">
                {a.name}
              </Link>
              {a.category && <span className="ml-2 text-sm text-gray-700">{a.category}</span>}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-semibold ${a.status === 'sent' ? 'bg-emerald-100 text-emerald-950' : 'bg-amber-100 text-amber-950'}`}>
              <Icon className="h-4 w-4" aria-hidden="true" /> {applicationLabel(a.status, a.at)}
              {a.status === 'unreachable' && a.phone ? `: call ${a.phone}` : ''}
              {a.status === 'failed' && (
                <a href={applyHref(a.resourceId)} className="ml-1 underline underline-offset-2">
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
