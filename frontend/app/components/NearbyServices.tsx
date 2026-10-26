'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import SignupButton from './SignupButton'
import { SIGNUP_ON } from '@/lib/signups'
import { goHubHref } from '@/lib/serviceHub'
import type { Signups } from '@/lib/useSignups'

export interface NearbyService {
  id: string
  name: string
  category: string | null
  city: string | null
  province: string | null
}

export interface NearbyPlace {
  city: string | null
  province: string | null
}

/**
 * Services near the person for one step of their plan
 * (app/api/me/path/services; the account holder's choice, 26 October 2026),
 * so Send my request has somewhere to go on any plan: an older one's tools
 * are often guides and apps nothing can be sent to. `place` is undefined
 * until it has asked, then null when their profile has no province.
 */
export function useNearbyServices(milestoneId: string): { nearby: NearbyService[]; place: NearbyPlace | null | undefined } {
  const [nearby, setNearby] = useState<NearbyService[]>([])
  const [place, setPlace] = useState<NearbyPlace | null | undefined>(undefined)
  useEffect(() => {
    if (!SIGNUP_ON || !milestoneId) return
    let live = true
    fetch(`/api/me/path/services?milestone=${encodeURIComponent(milestoneId)}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live || !j) return
        setNearby(Array.isArray(j.services) ? j.services : [])
        setPlace(j.place ?? null)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [milestoneId])
  return { nearby, place }
}

const label = (category: string | null) => (category ? category.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '')

/** The list: each service, where it is, and Send my request (or how far its request has got). */
export default function NearbyServices({ app, nearby, place }: { app: Signups; nearby: NearbyService[]; place: NearbyPlace | null | undefined }) {
  if (!app.on || !app.ready || nearby.length === 0) return null
  return (
    <div className="mt-4" data-nearby-services>
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
        <MapPin className="h-4 w-4" aria-hidden="true" /> Services that can start with you{place?.city ? ` near ${place.city}` : ''}
      </h3>
      <p className="mt-0.5 text-xs text-slate-700">
        Matched to this step{place ? '' : ' (add your city to your profile to see ones near you)'}. Send my request asks them to start with you, and they
        reply by email.
      </p>
      <ul className="mt-2 space-y-2">
        {nearby.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2" data-nearby-service={s.id}>
            <span className="min-w-0">
              <a href={goHubHref(`/resources/${s.id}`)} target="_blank" rel="noopener noreferrer" className="block font-semibold text-slate-900 underline-offset-2 hover:underline">
                {s.name}
                <span className="sr-only"> (opens ResourceHub in a new tab)</span>
              </a>
              <span className="block text-xs text-slate-700">
                {[label(s.category), [s.city, s.province].filter(Boolean).join(', ') || 'Online or across Canada'].filter(Boolean).join(' · ')}
              </span>
            </span>
            <SignupButton app={app} service={app.requestFor(s.id)} resourceId={s.id} compact />
          </li>
        ))}
      </ul>
    </div>
  )
}
