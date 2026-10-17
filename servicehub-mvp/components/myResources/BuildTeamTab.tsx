'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Search,
  CalendarCheck,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { showToast } from '@/lib/toast'
import type { Resource, SavedResource } from '@/types/database'
import TeamAction from '@/components/team/TeamAction'
import type { TeamState } from '@/lib/team'

interface BuildTeamRow extends SavedResource {
  resource: Resource | null
}

interface BuildTeamTabProps {
  userId: string
}

const WISHLIST_PAGE_SIZE = 6

// Three clicks (the team's planning note, October 2026, "Ex. Preferred
// Service"; lib/team.ts). There were four steps and nine clicks: save, open
// this page, "Schedule Call", "Request Contact", "+", a checkbox, "Add to Team".
const STEPS: Array<{ title: string; description: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = [
  {
    title: 'Step 1',
    description: 'Search in your own words, such as “a speech therapist for my son near Ottawa”.',
    color: 'bg-emerald-100 text-emerald-700',
    Icon: Search,
  },
  {
    title: 'Step 2',
    description: '“Add to my team” on the one you like. It is added here, and “book a first meeting” goes in your calendar.',
    color: 'bg-sky-100 text-sky-700',
    Icon: CalendarCheck,
  },
  {
    title: 'Step 3',
    description: '“Sign them on” once you have met and agreed to work together. You can undo it.',
    color: 'bg-violet-100 text-violet-700',
    Icon: Users,
  },
]

export default function BuildTeamTab({ userId }: BuildTeamTabProps) {
  const [rows, setRows] = useState<BuildTeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [wishlistPage, setWishlistPage] = useState(1)

  useEffect(() => {
    fetchAll()
  }, [userId])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [wRes, tRes] = await Promise.all([
        fetch(`/api/my-resources/saved?userId=${userId}&status=wishlist&sort=date`),
        fetch(`/api/my-resources/saved?userId=${userId}&status=current&sort=date`),
      ])
      const wData = wRes.ok ? await wRes.json() : { resources: [] }
      const tData = tRes.ok ? await tRes.json() : { resources: [] }
      setRows([...(wData.resources ?? []), ...(tData.resources ?? [])])
    } catch (error) {
      console.error('BuildTeamTab fetch failed:', error)
      showToast.error('Could not load your Build-a-Team data.')
    } finally {
      setLoading(false)
    }
  }

  const wishlist = useMemo(
    () => rows.filter((r) => r.status === 'wishlist'),
    [rows]
  )
  const team = useMemo(() => rows.filter((r) => r.status === 'current'), [rows])

  const wishlistPageCount = Math.max(1, Math.ceil(wishlist.length / WISHLIST_PAGE_SIZE))
  const wishlistVisible = useMemo(
    () =>
      wishlist.slice(
        (wishlistPage - 1) * WISHLIST_PAGE_SIZE,
        wishlistPage * WISHLIST_PAGE_SIZE
      ),
    [wishlist, wishlistPage]
  )

  // A change made on a card (lib/team.ts): signed on moves it to the team,
  // undone it leaves, a meeting to book or saved stays here.
  const onTeamChange = (row: BuildTeamRow, state: TeamState) => {
    setRows((prev) =>
      state === 'none'
        ? prev.filter((r) => r.resource_id !== row.resource_id)
        : prev.map((r) =>
            r.resource_id === row.resource_id
              ? {
                  ...r,
                  status: state === 'signed' ? 'current' : 'wishlist',
                  calls_scheduled: state === 'meeting' || (state === 'signed' && r.calls_scheduled),
                  added_to_team_at: state === 'signed' ? new Date().toISOString() : null,
                }
              : r
          )
    )
  }

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 md:p-10">
          <div className="md:col-span-2">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              All of your{' '}
              <span className="relative inline-block">
                <span className="relative z-10">Autism Support</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-1 h-2 bg-yellow-300/70 rounded -z-0"
                />
              </span>{' '}
              in 1 place.
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl">
              The services you are arranging and the ones on your team, in one
              place. Adding one puts a first meeting to book in your calendar;
              signing them on is one click.
            </p>
            {/* Emerald 700 under white text, here and below: 600 was 3.8 to 1,
                under WCAG AA's 4.5 (the accessibility checker, signed in). */}
            <Link
              href="/search"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              Find Services
            </Link>
          </div>
          <div className="hidden md:flex items-center justify-center text-emerald-500">
            <PlantIllustration />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section>
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-emerald-700 font-semibold">
            Our Steps
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">
            How to Use Build-A-Team System
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map(({ title, description, color, Icon }) => (
            <div
              key={title}
              className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-3"
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {title}
                </p>
                <p className="text-sm text-gray-700 mt-1">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* My Wishlist */}
      <section>
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-emerald-700 font-semibold">
            Our Contact Hub
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">My Wishlist</h3>
          <p className="mt-2 text-sm text-gray-600">
            Saved services and the ones you are arranging. Book a first meeting,
            then sign them on.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-xl border border-gray-200 bg-white animate-pulse"
              />
            ))}
          </div>
        ) : wishlist.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">
              Nothing here yet. Search for a service and choose “Add to my team”.
            </p>
            <Link
              href="/search"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
              Browse services
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {wishlistVisible.map((row) => (
                <WishlistCard key={row.id} row={row} onChange={(state) => onTeamChange(row, state)} />
              ))}
            </div>

            {wishlistPageCount > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setWishlistPage((p) => Math.max(1, p - 1))}
                  disabled={wishlistPage === 1}
                  className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                {Array.from({ length: wishlistPageCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWishlistPage(i + 1)}
                    className={`w-9 h-9 rounded-md text-sm font-medium ${
                      wishlistPage === i + 1
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setWishlistPage((p) => Math.min(wishlistPageCount, p + 1))}
                  disabled={wishlistPage === wishlistPageCount}
                  className="p-2 rounded-md border border-gray-300 bg-white text-gray-700 disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* My Team */}
      <section>
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-emerald-700 font-semibold">
            Our Community
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">My Team</h3>
          <p className="mt-2 text-sm text-gray-600">
            The services you have signed on.
          </p>
        </div>

        {loading ? (
          <div className="h-40 rounded-xl border border-gray-200 bg-white animate-pulse" />
        ) : team.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">
              No one signed on yet. Choose “Sign them on” once you have met and
              agreed to work together.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {team.map((row) => (
              <TeamCard key={row.id} row={row} onChange={(state) => onTeamChange(row, state)} />
            ))}
          </div>
        )}
      </section>

    </div>
  )
}

// ---------- Sub-components ----------

function WishlistCard({ row, onChange }: { row: BuildTeamRow; onChange: (state: TeamState) => void }) {
  const resource = row.resource

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
      <div className="relative aspect-[16/10] bg-gray-900 text-white">
        {resource?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resource.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/60 text-2xl font-semibold tracking-wide" aria-hidden="true">
            Image
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <Link
          href={resource ? `/resources/${resource.id}` : '#'}
          className="text-sm font-semibold text-gray-900 hover:text-blue-600 line-clamp-2"
        >
          {resource?.name ?? 'Unknown service'}
        </Link>
        {resource?.category && (
          <p className="mt-1 text-xs text-gray-600 capitalize">{resource.category}</p>
        )}
      </div>
      {resource && (
        <TeamAction
          resource={resource}
          initial={row.calls_scheduled ? 'meeting' : 'saved'}
          signedIn
          onTeamPage
          onChange={onChange}
        />
      )}
    </div>
  )
}

function TeamCard({ row, onChange }: { row: BuildTeamRow; onChange: (state: TeamState) => void }) {
  const resource = row.resource

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden grid grid-cols-1 md:grid-cols-5">
      <div className="md:col-span-3 p-5 flex flex-col gap-3">
        <div>
          <Link
            href={resource ? `/resources/${resource.id}` : '#'}
            className="text-base font-semibold text-gray-900 hover:text-blue-600 line-clamp-2"
          >
            {resource?.name ?? 'Unknown service'}
          </Link>
          {resource?.category && (
            <p className="text-xs text-gray-500 capitalize mt-0.5">{resource.category}</p>
          )}
        </div>
        <p className="flex items-center gap-2 text-sm text-gray-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          {row.added_to_team_at
            ? `Signed on ${new Date(row.added_to_team_at).toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : 'Signed on'}
        </p>
        <div className="mt-auto pt-2">
          <Link
            href={resource ? `/resources/${resource.id}` : '#'}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            See details<span className="sr-only"> about {resource?.name ?? 'this service'}</span>
          </Link>
        </div>
        {resource && (
          <div className="-mx-5 -mb-5">
            <TeamAction resource={resource} initial="signed" signedIn onTeamPage onChange={onChange} />
          </div>
        )}
      </div>
      <div className="md:col-span-2 relative aspect-video md:aspect-auto md:min-h-full bg-gray-900 text-white">
        {resource?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resource.image_url}
            alt={resource.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/60 text-2xl font-semibold tracking-wide">
            Image
          </div>
        )}
      </div>
    </div>
  )
}

// Tiny inline SVG that mirrors the Figma "hand holding a plant" placeholder.
function PlantIllustration() {
  return (
    <svg
      viewBox="0 0 200 200"
      className="w-48 h-48"
      role="img"
      aria-label="Hand holding plant illustration"
    >
      <circle cx="155" cy="40" r="6" fill="#22c55e" opacity="0.7" />
      <circle cx="40" cy="60" r="4" fill="#22c55e" opacity="0.6" />
      <circle cx="170" cy="120" r="5" fill="#22c55e" opacity="0.5" />
      <circle cx="30" cy="160" r="6" fill="#22c55e" opacity="0.6" />
      <circle cx="120" cy="20" r="3" fill="#f87171" opacity="0.7" />
      <path
        d="M70 170 Q100 140 130 170 L130 185 L70 185 Z"
        fill="#fde68a"
        stroke="#f59e0b"
        strokeWidth="2"
      />
      <path d="M100 150 L100 90" stroke="#16a34a" strokeWidth="3" />
      <path
        d="M100 110 Q70 95 65 70 Q90 85 100 110"
        fill="#22c55e"
      />
      <path
        d="M100 95 Q130 80 135 55 Q110 70 100 95"
        fill="#16a34a"
      />
      <path
        d="M100 90 Q98 70 110 50"
        stroke="#16a34a"
        strokeWidth="3"
        fill="none"
      />
      <circle cx="110" cy="50" r="6" fill="#22c55e" />
    </svg>
  )
}
