'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, MessageSquare, Star, Users } from 'lucide-react'
import ResourceCard from '@/components/resources/ResourceCard'
import TeamAction from '@/components/team/TeamAction'
import type { TeamState } from '@/lib/team'
import type { Understood } from '@/lib/search/understand'
import type { FoundItem } from '@/app/api/search/found/route'

const PLACE = ['Most matching', '2nd', '3rd']
const KIND: Record<FoundItem['kind'], string> = {
  review: 'A review',
  comment: 'A comment',
  tidbit: 'From Tidbits',
  article: 'An article',
  campus: 'Campus page',
  kit: 'Starter kit',
}

function Rank({ n, label }: { n: number; label: string }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white" aria-hidden="true">
        {n}
      </span>
      {label}
    </p>
  )
}

function Item({ item }: { item: FoundItem }) {
  const external = item.href.startsWith('http')
  return (
    <a
      href={item.href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="block h-full rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
        {KIND[item.kind]}
      </p>
      <p className="mt-1 font-semibold text-gray-900">{item.title}</p>
      {item.kind === 'tidbit' && item.about && <p className="text-xs text-gray-700">About {item.about}</p>}
      {typeof item.stars === 'number' && (
        <p className="mt-1 flex items-center gap-1 text-sm text-gray-800" aria-label={`${item.stars} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={`h-3.5 w-3.5 ${i < (item.stars as number) ? 'fill-yellow-400 text-yellow-500' : 'text-gray-300'}`} aria-hidden="true" />
          ))}
        </p>
      )}
      <p className="mt-2 text-sm text-gray-800">{item.excerpt}</p>
      <p className="mt-2 text-xs text-gray-700">
        {item.by ? `${item.by}` : ''}
        {item.helpful ? `${item.by ? ' · ' : ''}${item.helpful} found this helpful` : ''}
      </p>
    </a>
  )
}

/**
 * "Here's what we found!" (the team's planning note, October 2026, Goal 7:
 * the page after pressing Enter in the search bar): the three services that
 * match best, to meet and sign on today (Build a Team); the community's
 * experiences and advice about those three; general related information; and
 * how we picked them. The full list follows it.
 */
export default function FoundSummary({
  services,
  understood,
  query,
  team,
  signedIn,
  nearFirst,
  onTeamChange,
}: {
  services: any[]
  understood: Understood | null
  query: string
  team: Record<string, TeamState>
  signedIn: boolean
  nearFirst: boolean
  onTeamChange?: (id: string, state: TeamState) => void
}) {
  const top = services.slice(0, 3)
  const [found, setFound] = useState<{ experiences: FoundItem[]; info: FoundItem[] } | null>(null)
  const key = top.map((s) => s.id).join(',')

  useEffect(() => {
    if (!key) return
    const words = understood ? Array.from(new Set([...understood.words, ...understood.intents.flatMap((i) => i.terms.slice(0, 2))])) : query.split(/\s+/)
    const params = new URLSearchParams({
      ids: key,
      words: words.slice(0, 6).join(','),
      norms: (understood?.norms || []).map((n) => n.id).join(','),
      q: query.slice(0, 200),
    })
    let gone = false
    fetch(`/api/search/found?${params}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { experiences: [], info: [] }))
      .then((d) => !gone && setFound(d))
      .catch(() => !gone && setFound({ experiences: [], info: [] }))
    return () => {
      gone = true
    }
  }, [key, query, understood])

  if (top.length === 0) return null
  return (
    <section aria-labelledby="found-heading" className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
      <h2 id="found-heading" className="text-2xl font-bold text-gray-900">
        Here&apos;s what we found!
      </h2>

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Users className="h-5 w-5 text-blue-800" aria-hidden="true" /> Meet and sign on with these services today!
          </h3>
          <Link href="/my-resources" className="text-sm font-medium text-blue-800 underline">
            Go to Build a Team
          </Link>
        </div>
        <ol className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
          {top.map((s, i) => (
            <li key={s.id} className="flex flex-col">
              <Rank n={i + 1} label={PLACE[i]} />
              <ResourceCard
                resource={s}
                averageRating={s.averageRating}
                ratingCount={s.ratingCount}
                distance={s.distance}
                footer={
                  <TeamAction
                    resource={s}
                    initial={team[s.id] || 'none'}
                    signedIn={signedIn}
                    onChange={(state) => onTeamChange?.(s.id, state)}
                  />
                }
              />
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <MessageSquare className="h-5 w-5 text-blue-800" aria-hidden="true" /> Check out community members&apos; experiences and advice for these services!
        </h3>
        {found === null ? (
          <p className="mt-2 text-sm text-gray-700">Looking…</p>
        ) : found.experiences.length === 0 ? (
          <p className="mt-2 text-sm text-gray-800">
            Nobody has written about these yet.{' '}
            <Link href="/community/new" className="font-medium text-blue-800 underline">
              Ask the community in Tidbits
            </Link>
            .
          </p>
        ) : (
          <ol className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            {found.experiences.map((item, i) => (
              <li key={item.href} className="flex flex-col">
                <Rank n={i + 1} label={i === 0 ? 'Most relevant' : PLACE[i]} />
                <Item item={item} />
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <BookOpen className="h-5 w-5 text-blue-800" aria-hidden="true" /> Read and learn about related information!
        </h3>
        {found === null ? (
          <p className="mt-2 text-sm text-gray-700">Looking…</p>
        ) : found.info.length === 0 ? (
          <p className="mt-2 text-sm text-gray-800">
            Nothing to read on this yet.{' '}
            <Link href="/community" className="font-medium text-blue-800 underline">
              Browse Tidbits
            </Link>
            .
          </p>
        ) : (
          <ol className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
            {found.info.map((item, i) => (
              <li key={item.href} className="flex flex-col">
                <Rank n={i + 1} label={i === 0 ? 'Most relevant' : PLACE[i]} />
                <Item item={item} />
              </li>
            ))}
          </ol>
        )}
      </div>

      <details className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-lg font-semibold text-gray-900">How we picked these</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm text-gray-800">
          <li>
            <span className="font-medium">Services:</span> the words you typed (in a service&apos;s name counts most, then its
            description)
            {understood?.intents.length ? `, the kind of place (${understood.intents.map((i) => i.label.toLowerCase()).join(', ')})` : ''}
            {understood?.norms.length ? `, and who it is for (${understood.norms.map((n) => n.label).join(', ')})` : ''}.{' '}
            {nearFirst ? 'Places within 50 km of you come first. ' : ''}
            Then ratings from people who have used them; a tie goes to the one with more ratings.
          </li>
          <li>
            <span className="font-medium">Experiences and advice:</span> the reviews of these three that people found most
            helpful, then Tidbits that talk about them, then other reviews and comments.
          </li>
          <li>
            <span className="font-medium">Information:</span> Autinerary&apos;s starter kits and campus pages when they fit what you
            searched, then articles and answered Tidbits about it.
          </li>
          <li>Nothing here is paid for. The full list is below.</li>
        </ul>
      </details>
    </section>
  )
}
