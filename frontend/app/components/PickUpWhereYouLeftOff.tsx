'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { placeName, placeToOffer, type LastPlace } from '@/lib/lastPlace'
import { readLastPlace, visitStartedAt } from './NavTrail'

/**
 * "Pick up where you left off": the page someone had open on their last
 * visit, one tap from the Path (Riipen Labs, Group 16: personalise "based on
 * user behaviour rather than user input"; Group 15: "links back to the exact
 * spot they left off"). From this browser only (lib/lastPlace.ts). Says
 * nothing when the place is the next step, which has its own button.
 */
export default function PickUpWhereYouLeftOff({ milestones, skipId }: { milestones: { id: string; name?: string; title?: string }[]; skipId?: string }) {
  const { supabaseUser } = useAuth()
  const [place, setPlace] = useState<LastPlace | null>(null)
  useEffect(() => {
    if (!supabaseUser?.id) return
    setPlace(placeToOffer(readLastPlace(), supabaseUser.id, Date.now(), visitStartedAt()))
  }, [supabaseUser?.id])
  if (!place) return null
  const stepId = place.path.startsWith('/milestones/') ? decodeURIComponent(place.path.split('/')[2] || '') : null
  if (stepId && stepId === skipId) return null
  const step = stepId ? milestones.find((m) => m.id === stepId) : null
  const name = step ? `the step “${step.name || step.title}”` : stepId ? 'the step you had open' : placeName(place.path)
  return (
    <p className="mt-2 text-sm text-slate-800">
      Pick up where you left off:{' '}
      <Link href={place.path} className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">{name}</Link>
    </p>
  )
}
