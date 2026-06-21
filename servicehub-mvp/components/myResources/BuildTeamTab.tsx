'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Phone,
  CheckCircle2,
  Circle,
  Plus,
  Search,
  CalendarCheck,
  ScrollText,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { showToast } from '@/lib/toast'
import type { Resource, SavedResource } from '@/types/database'
import type { ContactInfo } from '@/types/database'

interface BuildTeamRow extends SavedResource {
  resource: Resource | null
}

interface BuildTeamTabProps {
  userId: string
}

const WISHLIST_PAGE_SIZE = 6

const STEPS: Array<{ title: string; description: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = [
  {
    title: 'Step 1',
    description: 'Find Highly-Rated Autism Services',
    color: 'bg-emerald-100 text-emerald-700',
    Icon: Search,
  },
  {
    title: 'Step 2',
    description:
      "Add Autism Services to Wishlist — click '+' once you've assessed a need and add them to your Wishlist.",
    color: 'bg-orange-100 text-orange-700',
    Icon: Plus,
  },
  {
    title: 'Step 3',
    description:
      'Contacting your Services — view your Wishlist to schedule calls and request contact for the services you are interested in.',
    color: 'bg-sky-100 text-sky-700',
    Icon: CalendarCheck,
  },
  {
    title: 'Step 4',
    description:
      'Form your Autism Support Team — once both parties have agreed on a contract, promote the service into your Team.',
    color: 'bg-violet-100 text-violet-700',
    Icon: Users,
  },
]

export default function BuildTeamTab({ userId }: BuildTeamTabProps) {
  const [rows, setRows] = useState<BuildTeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [wishlistPage, setWishlistPage] = useState(1)
  const [pendingAdd, setPendingAdd] = useState<BuildTeamRow | null>(null)
  const [confirmAcknowledged, setConfirmAcknowledged] = useState(false)
  const [submittingAdd, setSubmittingAdd] = useState(false)

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

  // Optimistic flag update + outbound contact action.
  const setFlag = async (
    row: BuildTeamRow,
    field: 'calls_scheduled' | 'contract_sent',
    nextValue: boolean,
    contactAction?: () => void
  ) => {
    setRows((prev) =>
      prev.map((r) =>
        r.resource_id === row.resource_id ? { ...r, [field]: nextValue } : r
      )
    )
    try {
      const response = await fetch(
        `/api/my-resources/saved/${row.resource_id}/build-team`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: nextValue }),
        }
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error || 'Update failed')
      }
      contactAction?.()
    } catch (error) {
      console.error('setFlag failed:', error)
      showToast.error('Could not save that. Please try again.')
      // Roll back the optimistic update.
      setRows((prev) =>
        prev.map((r) =>
          r.resource_id === row.resource_id ? { ...r, [field]: !nextValue } : r
        )
      )
    }
  }

  const handleScheduleCall = (row: BuildTeamRow) => {
    const contact = row.resource?.contact_info as ContactInfo | null
    let action: (() => void) | undefined
    if (contact?.phone) {
      const phone = contact.phone
      action = () => {
        window.location.href = `tel:${phone}`
      }
    } else if (contact?.email) {
      const email = contact.email
      const subject = encodeURIComponent(`Scheduling a call about ${row.resource?.name ?? 'your service'}`)
      action = () => {
        window.location.href = `mailto:${email}?subject=${subject}`
      }
    } else {
      action = () => showToast.success('Marked as scheduled — no contact info on file.')
    }
    setFlag(row, 'calls_scheduled', !row.calls_scheduled, !row.calls_scheduled ? action : undefined)
  }

  const handleRequestContact = (row: BuildTeamRow) => {
    const contact = row.resource?.contact_info as ContactInfo | null
    let action: (() => void) | undefined
    if (contact?.email) {
      const email = contact.email
      const subject = encodeURIComponent(`Requesting a contract — ${row.resource?.name ?? ''}`)
      const body = encodeURIComponent(
        `Hi,\n\nI'm interested in moving forward with your service and would like to discuss next steps / a contract.\n\nThank you,`
      )
      action = () => {
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
      }
    } else if (contact?.website) {
      const website = contact.website
      action = () => {
        window.open(website, '_blank', 'noopener,noreferrer')
      }
    } else if (contact?.phone) {
      const phone = contact.phone
      action = () => {
        window.location.href = `tel:${phone}`
      }
    } else {
      action = () => showToast.success('Marked as requested — no contact info on file.')
    }
    setFlag(row, 'contract_sent', !row.contract_sent, !row.contract_sent ? action : undefined)
  }

  const openAddToTeam = (row: BuildTeamRow) => {
    setPendingAdd(row)
    setConfirmAcknowledged(false)
  }

  const confirmAddToTeam = async () => {
    if (!pendingAdd || !confirmAcknowledged) return
    setSubmittingAdd(true)
    try {
      const response = await fetch(
        `/api/my-resources/saved/${pendingAdd.resource_id}/build-team`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promote: true }),
        }
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error || 'Failed to add to team')
      }
      showToast.success(`Added ${pendingAdd.resource?.name ?? 'service'} to your Team`)
      setRows((prev) =>
        prev.map((r) =>
          r.resource_id === pendingAdd.resource_id
            ? { ...r, status: 'current', added_to_team_at: new Date().toISOString() }
            : r
        )
      )
      setPendingAdd(null)
    } catch (error) {
      console.error('confirmAddToTeam failed:', error)
      showToast.error('Could not add to team. Please try again.')
    } finally {
      setSubmittingAdd(false)
    }
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
              The Build-A-Team system provides a centralized hub for assembling
              your autism community. Track outreach, contracts, and your active
              service team — all in one place.
            </p>
            <Link
              href="/search"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <p className="mt-2 text-sm text-gray-500">
            Schedule intro calls and request contracts. Once both parties agree,
            promote the service to your Team.
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
              Your wishlist is empty. Browse the directory and tap{' '}
              <Plus className="inline w-4 h-4" /> on a service to add it.
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
                <WishlistCard
                  key={row.id}
                  row={row}
                  onScheduleCall={() => handleScheduleCall(row)}
                  onRequestContact={() => handleRequestContact(row)}
                  onAddToTeam={() => openAddToTeam(row)}
                />
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
          <p className="mt-2 text-sm text-gray-500">
            Services you're actively working with.
          </p>
        </div>

        {loading ? (
          <div className="h-40 rounded-xl border border-gray-200 bg-white animate-pulse" />
        ) : team.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-gray-600">
              No team members yet. Move services from your Wishlist once you've
              signed a contract.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {team.map((row) => (
              <TeamCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>

      {/* Add to Team modal */}
      {pendingAdd && (
        <AddToTeamModal
          row={pendingAdd}
          submitting={submittingAdd}
          acknowledged={confirmAcknowledged}
          onAcknowledgeChange={setConfirmAcknowledged}
          onCancel={() => setPendingAdd(null)}
          onConfirm={confirmAddToTeam}
        />
      )}
    </div>
  )
}

// ---------- Sub-components ----------

function WishlistCard({
  row,
  onScheduleCall,
  onRequestContact,
  onAddToTeam,
}: {
  row: BuildTeamRow
  onScheduleCall: () => void
  onRequestContact: () => void
  onAddToTeam: () => void
}) {
  const resource = row.resource
  const canPromote = row.calls_scheduled && row.contract_sent

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
      <div className="relative aspect-[16/10] bg-gray-900 text-white">
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
        <button
          type="button"
          onClick={onAddToTeam}
          disabled={!canPromote}
          title={
            canPromote
              ? 'Add to my Team'
              : 'Schedule a call AND request a contract before adding to your team.'
          }
          className={`absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
            canPromote
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-white/80 text-gray-400 cursor-not-allowed'
          }`}
          aria-label="Add to Team"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <Link
          href={resource ? `/resources/${resource.id}` : '#'}
          className="text-sm font-semibold text-gray-900 hover:text-blue-600 line-clamp-2"
        >
          {resource?.name ?? 'Unknown service'}
        </Link>
        {resource?.category && (
          <p className="mt-1 text-xs text-gray-500 capitalize">{resource.category}</p>
        )}

        <div className="mt-auto pt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onScheduleCall}
            className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              row.calls_scheduled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            aria-pressed={row.calls_scheduled}
          >
            {row.calls_scheduled ? (
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Phone className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{row.calls_scheduled ? 'Call scheduled' : 'Schedule Call'}</span>
          </button>
          <button
            type="button"
            onClick={onRequestContact}
            className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              row.contract_sent
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            aria-pressed={row.contract_sent}
          >
            {row.contract_sent ? (
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ScrollText className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{row.contract_sent ? 'Contract sent' : 'Request Contact'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function TeamCard({ row }: { row: BuildTeamRow }) {
  const resource = row.resource

  const Status = ({ done, label }: { done: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <Circle className="w-4 h-4 text-gray-300" aria-hidden="true" />
      )}
      <span className={done ? 'text-gray-800' : 'text-gray-500'}>{label}</span>
    </div>
  )

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
        <div className="space-y-1.5">
          <Status done={row.calls_scheduled} label="Calls were scheduled" />
          <Status done={row.contract_sent} label="Contract request was sent" />
        </div>
        {row.added_to_team_at && (
          <p className="text-xs text-gray-500">
            Added to team {new Date(row.added_to_team_at).toLocaleDateString()}
          </p>
        )}
        <div className="mt-auto pt-2">
          <Link
            href={resource ? `/resources/${resource.id}` : '#'}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Learn More
          </Link>
        </div>
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

function AddToTeamModal({
  row,
  submitting,
  acknowledged,
  onAcknowledgeChange,
  onCancel,
  onConfirm,
}: {
  row: BuildTeamRow
  submitting: boolean
  acknowledged: boolean
  onAcknowledgeChange: (v: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="fixed inset-0 bg-black/40"
        aria-hidden="true"
        onClick={submitting ? undefined : onCancel}
      />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h4 className="text-lg font-semibold text-gray-900">
          Add {row.resource?.name ?? 'this service'} to your Team
        </h4>
        <p className="mt-2 text-sm text-gray-600">
          Are you sure you want to add this service to your active Team? It will
          move out of your Wishlist into the Community section above.
        </p>

        <label className="mt-4 flex items-start gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledgeChange(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            I confirm that I've had calls with this service and we've mutually
            agreed on the contract. The service is now part of my team.
          </span>
        </label>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!acknowledged || submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Adding…' : 'Add to Team'}
          </button>
        </div>
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
