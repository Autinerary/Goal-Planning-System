'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, CheckCircle2, Globe, Mail, Phone } from 'lucide-react'
import { appSignInHref, APP_CALENDAR } from '@/lib/appSignIn'
import { nextMeeting, type Meeting, type TeamState } from '@/lib/team'
import type { ContactInfo } from '@/types/database'
import MeetingPlanner from './MeetingPlanner'

/** "Mon 20 Oct, 10:00". */
export function meetingWhen(m: Meeting): string {
  const d = new Date(`${m.date}T${m.time}:00`)
  return `${d.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric', month: 'short' })}, ${m.time}`
}

/**
 * Clicks two and three of the planning note's three (lib/team.ts), on a
 * search result or a service's page: "Add to my team" puts the service on the
 * team with a first meeting to book in the calendar; "Sign them on" once
 * they have met and agreed. Each can be undone. Signed out, "Add to my team"
 * goes through the one Autinerary sign-in and comes back to finish
 * (?then=team:<id>, handled by the page).
 */
export default function TeamAction({
  resource,
  initial,
  signedIn,
  autoAdd = false,
  onChange,
  onTeamPage = false,
}: {
  resource: { id: string; name: string; contact_info?: unknown; tags?: unknown; delivery?: unknown; location?: unknown }
  initial?: TeamState
  signedIn: boolean
  /** Add at once (coming back from signing in to add). */
  autoAdd?: boolean
  onChange?: (state: TeamState) => void
  /** In Build a Team itself: no link to it. */
  onTeamPage?: boolean
}) {
  const [state, setState] = useState<TeamState>(initial || 'none')
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [created, setCreated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const autoDone = useRef(false)

  useEffect(() => {
    if (initial) setState(initial)
  }, [initial])

  // The meeting as scheduled, when the page did not just add it.
  const loaded = useRef(false)
  useEffect(() => {
    if (state !== 'meeting' || !signedIn || meeting || loaded.current) return
    loaded.current = true
    fetch(`/api/team?meeting=${resource.id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.meeting && setMeeting(d.meeting))
      .catch(() => {})
  }, [state, signedIn, meeting, resource.id])

  const change = (next: TeamState) => {
    setState(next)
    onChange?.(next)
  }

  const add = async () => {
    if (!signedIn) {
      const url = new URL(window.location.href)
      url.searchParams.set('then', `team:${resource.id}`)
      window.location.href = appSignInHref(`${url.pathname}${url.search}`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id, meeting: nextMeeting() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not add them to your team.')
      setMeeting(data.meeting || null)
      setCreated(Boolean(data.created))
      // So Undo on another page knows the saved row came with this add.
      try {
        if (data.created) sessionStorage.setItem(`team-created-${resource.id}`, '1')
      } catch {}
      change(data.state)
      setMessage(
        data.state === 'signed'
          ? `${resource.name} is already on your team.`
          : data.meeting
            ? `${resource.name} is on your team. “Book a first meeting” is in your calendar for ${meetingWhen(data.meeting)}.`
            : `${resource.name} is on your team. Next, book a first meeting.`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add them to your team.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (autoAdd && signedIn && !autoDone.current) {
      autoDone.current = true
      // The sign-in's "then" is done; a reload should not add again.
      const url = new URL(window.location.href)
      url.searchParams.delete('then')
      window.history.replaceState({}, '', `${url.pathname}${url.search}`)
      if (state === 'none' || state === 'saved') void add()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdd, signedIn])

  const undoAdd = async () => {
    setBusy(true)
    setError('')
    let addedHere = created
    try {
      addedHere = addedHere || sessionStorage.getItem(`team-created-${resource.id}`) === '1'
    } catch {}
    try {
      const res = await fetch(`/api/team?resourceId=${resource.id}&created=${addedHere ? '1' : '0'}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not undo that.')
      setMeeting(null)
      try {
        sessionStorage.removeItem(`team-created-${resource.id}`)
      } catch {}
      change(data.state)
      setMessage(`${resource.name} is off your team, and the meeting is out of your calendar.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not undo that.')
    } finally {
      setBusy(false)
    }
  }

  const sign = async (on: boolean) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/my-resources/saved/${resource.id}/build-team`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(on ? { promote: true } : { demote: true }),
      })
      if (!res.ok) throw new Error('Could not save that. Please try again.')
      change(on ? 'signed' : 'meeting')
      setMessage(on ? `${resource.name} is signed on.` : `${resource.name} is back to being arranged.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that.')
    } finally {
      setBusy(false)
    }
  }

  const contact = (resource.contact_info as ContactInfo | null) || null
  const mail = contact?.email
    ? `mailto:${contact.email}?subject=${encodeURIComponent('Booking a first meeting')}&body=${encodeURIComponent(
        `Hello,\n\nI found ${resource.name} on ResourceHub and would like to book a first meeting. When would suit you?\n\nThank you,`
      )}`
    : ''
  const named = <span className="sr-only">: {resource.name}</span>

  return (
    <div className="border-t border-gray-100 px-6 py-4">
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
      {error && (
        <p className="mb-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {(state === 'none' || state === 'saved') && (
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="w-full rounded-lg border-2 border-blue-700 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {busy ? 'Adding…' : 'Add to my team'}
          {named}
        </button>
      )}

      {state === 'meeting' && (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-gray-800">
            <CalendarCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-700" aria-hidden="true" />
            <span>
              On your team.{' '}
              {meeting?.type ? (
                <>
                  Your first meeting is{' '}
                  <a href={APP_CALENDAR} className="font-medium text-blue-700 underline">
                    in your calendar
                  </a>
                  .
                </>
              ) : meeting ? (
                <>
                  First meeting to book: {meetingWhen(meeting)},{' '}
                  <a href={APP_CALENDAR} className="font-medium text-blue-700 underline">
                    in your calendar
                  </a>
                  .
                </>
              ) : (
                'Next, book a first meeting.'
              )}
            </span>
          </p>
          <MeetingPlanner
            resource={resource}
            meeting={meeting}
            onSaved={(m) => {
              setMeeting(m)
              setMessage(`Your meeting with ${resource.name} is saved, and in your calendar for ${meetingWhen(m)}.`)
            }}
          />
          {(contact?.phone || mail || contact?.website) && (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {contact?.phone && (
                <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 font-medium text-blue-700 underline">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Call
                  {named}
                </a>
              )}
              {mail && (
                <a href={mail} className="inline-flex items-center gap-1 font-medium text-blue-700 underline">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email
                  {named}
                </a>
              )}
              {contact?.website && (
                <a href={contact.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-700 underline">
                  <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Website
                  {named}
                </a>
              )}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => sign(true)}
              disabled={busy}
              className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
            >
              Sign them on
              {named}
            </button>
            <button type="button" onClick={undoAdd} disabled={busy} className="text-sm font-medium text-gray-700 underline hover:text-gray-900">
              Undo
              {named}
            </button>
          </div>
          <p className="text-xs text-gray-600">Sign them on once you have met and agreed to work together.</p>
        </div>
      )}

      {state === 'signed' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <p className="flex items-center gap-2 font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Signed on: on your team
          </p>
          {!onTeamPage && (
            <Link href="/my-resources" className="font-medium text-blue-700 underline">
              See your team
            </Link>
          )}
          <button type="button" onClick={() => sign(false)} disabled={busy} className="font-medium text-gray-700 underline hover:text-gray-900">
            Undo
            {named}
          </button>
        </div>
      )}
    </div>
  )
}
