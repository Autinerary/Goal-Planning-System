'use client'

import { useEffect, useState } from 'react'
import { CalendarPlus, Gift, Mail, MapPin, Phone, Video } from 'lucide-react'
import { MEETING_TYPES, meetingTaskName, newVideoLink, nextMeeting, type Meeting, type MeetingType } from '@/lib/team'
import type { ContactInfo } from '@/types/database'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "Tuesday 21 October, 14:00". */
export function meetingLong(m: Meeting): string {
  const d = new Date(`${m.date}T${m.time}:00`)
  return `${d.toLocaleDateString('en-CA', { weekday: 'long', day: 'numeric', month: 'long' })}, ${m.time}`
}

const ICON: Record<MeetingType, typeof Video> = { video: Video, phone: Phone, in_person: MapPin }

/** One event for the person's own calendar app, with the link or the place. */
function icsFor(m: Meeting, resource: { id: string; name: string }): string {
  const start = new Date(`${m.date}T${m.time}:00`)
  const end = new Date(start.getTime() + (m.minutes || 30) * 60_000)
  const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Autinerary//ResourceHub//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:team-meet-${resource.id}@autinerary.ca`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${text(meetingTaskName(m, resource.name))}`,
    ...(m.type === 'in_person' && m.place ? [`LOCATION:${text(m.place)}`] : []),
    ...(m.type === 'video' && m.link ? [`LOCATION:${text(m.link)}`, `URL:${m.link}`] : []),
    `DESCRIPTION:${text(`From your team on ResourceHub.${m.freeFirstVisit ? ' Their first visit is free.' : ''}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}

/** The email to ask for this time, from the person's own email app. */
function askFor(m: Meeting, name: string): string {
  const when = meetingLong(m)
  const how =
    m.type === 'video'
      ? `a video call on ${when}${m.link ? ` (we could use this link: ${m.link})` : ''}`
      : m.type === 'phone'
        ? `a phone call on ${when}`
        : `a meeting in person on ${when}${m.place ? `, at ${m.place}` : ''}`
  return `Hello,\n\nI found ${name} on ResourceHub and would like to book a first meeting: ${how}. Does that suit you? If not, what would?\n\nThank you,`
}

/**
 * The first meeting with a team member (the team's planning note, October
 * 2026, Goal 2: "Schedule Video Call + (Potential) In-Person Meet w/ Free 1st
 * Visit"): how, when, and the video link or the place, saved with the
 * person's own team (lib/team.ts). Nothing is sent to the service: the
 * person can email them from their own email app, and add the meeting to
 * their own calendar app.
 */
export default function MeetingPlanner({
  resource,
  meeting,
  onSaved,
}: {
  resource: { id: string; name: string; contact_info?: unknown; tags?: unknown; delivery?: unknown; location?: unknown }
  meeting: Meeting | null
  onSaved: (m: Meeting) => void
}) {
  const scheduled = meeting?.type ? meeting : null
  const freeHere = Array.isArray(resource.tags) && resource.tags.includes('free_first_visit')
  const address = (() => {
    const loc = (resource.location || {}) as { address?: string; city?: string }
    return [loc.address, loc.city].filter(Boolean).join(', ')
  })()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<MeetingType>(resource.delivery === 'in_person' ? 'in_person' : 'video')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [link, setLink] = useState('')
  const [place, setPlace] = useState(address)
  const [free, setFree] = useState(freeHere)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const start = scheduled || meeting || nextMeeting()
    setDate(start.date)
    setTime(start.time)
    if (scheduled?.type) setType(scheduled.type)
    if (scheduled?.link) setLink(scheduled.link)
    if (scheduled?.place) setPlace(scheduled.place)
    if (scheduled) setFree(Boolean(scheduled.freeFirstVisit))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting])

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setError('Choose a day and a time.')
      return
    }
    setBusy(true)
    setError('')
    const day = WEEKDAYS[new Date(`${date}T12:00:00`).getDay()]
    const next: Meeting = {
      date,
      day,
      time,
      type,
      ...(type === 'video' && link.trim() ? { link: link.trim() } : {}),
      ...(type === 'in_person' && place.trim() ? { place: place.trim() } : {}),
      ...(free ? { freeFirstVisit: true } : {}),
      minutes: 30,
    }
    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id, meeting: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not save the meeting.')
      onSaved(data.meeting || next)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the meeting.')
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    if (!scheduled) return
    const url = URL.createObjectURL(new Blob([icsFor(scheduled, resource)], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `meeting-${resource.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const contact = (resource.contact_info as ContactInfo | null) || null
  const ask = scheduled && contact?.email
    ? `mailto:${contact.email}?subject=${encodeURIComponent('Booking a first meeting')}&body=${encodeURIComponent(askFor(scheduled, resource.name))}`
    : ''
  const Icon = scheduled?.type ? ICON[scheduled.type] : Video
  const named = <span className="sr-only">: {resource.name}</span>

  if (!open) {
    return scheduled ? (
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-gray-900">
        <p className="flex items-start gap-2 font-medium">
          <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-800" aria-hidden="true" />
          <span>
            {MEETING_TYPES.find((t) => t.id === scheduled.type)?.label}: {meetingLong(scheduled)}
            {scheduled.type === 'in_person' && scheduled.place ? `, at ${scheduled.place}` : ''}
          </span>
        </p>
        {scheduled.freeFirstVisit && (
          <p className="mt-1 flex items-center gap-1.5 text-emerald-900">
            <Gift className="h-4 w-4" aria-hidden="true" /> Their first visit is free.
          </p>
        )}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {scheduled.type === 'video' && scheduled.link && (
            <a href={scheduled.link} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-800 underline">
              Video link{named}
            </a>
          )}
          <button type="button" onClick={download} className="inline-flex items-center gap-1 font-medium text-blue-800 underline">
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add to my calendar app{named}
          </button>
          {ask && (
            <a href={ask} className="inline-flex items-center gap-1 font-medium text-blue-800 underline">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Email them this time{named}
            </a>
          )}
          <button type="button" onClick={() => setOpen(true)} className="font-medium text-gray-800 underline">
            Change{named}
          </button>
        </p>
      </div>
    ) : (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-lg border-2 border-blue-700 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Schedule the meeting{named}
        </button>
        {freeHere && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-900">
            <Gift className="h-3.5 w-3.5" aria-hidden="true" /> Their first visit is free.
          </p>
        )}
      </div>
    )
  }

  const id = `meet-${resource.id}`
  return (
    <form
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-gray-900">How will you meet?</legend>
        <div className="flex flex-wrap gap-2">
          {MEETING_TYPES.map((t) => {
            const I = ICON[t.id]
            return (
              <label
                key={t.id}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                  type === t.id ? 'border-blue-700 bg-blue-50 font-semibold text-blue-900' : 'border-gray-300 text-gray-800'
                }`}
              >
                <input type="radio" name={`${id}-type`} value={t.id} checked={type === t.id} onChange={() => setType(t.id)} className="sr-only" />
                <I className="h-4 w-4" aria-hidden="true" /> {t.label}
              </label>
            )
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-gray-900">
          <span className="mb-1 block font-medium">Day</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="rounded-md border border-gray-300 px-2 py-1.5" />
        </label>
        <label className="text-sm text-gray-900">
          <span className="mb-1 block font-medium">Time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="rounded-md border border-gray-300 px-2 py-1.5" />
        </label>
      </div>
      {type === 'video' && (
        <div className="text-sm text-gray-900">
          <label htmlFor={`${id}-link`} className="mb-1 block font-medium">
            Video link <span className="font-normal text-gray-700">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`${id}-link`}
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5"
            />
            <button type="button" onClick={() => setLink(newVideoLink())} className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-900 hover:bg-gray-50">
              Make a free video link
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-700">Or use the link the service sends you. A free link is a Jitsi Meet room; nobody needs an account to join.</p>
        </div>
      )}
      {type === 'in_person' && (
        <label className="block text-sm text-gray-900">
          <span className="mb-1 block font-medium">
            Where <span className="font-normal text-gray-700">(optional)</span>
          </span>
          <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} className="w-full rounded-md border border-gray-300 px-2 py-1.5" />
        </label>
      )}
      <label className="flex items-start gap-2 text-sm text-gray-900">
        <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>
          {freeHere ? 'This is the free first visit they offer' : 'This first visit is free'}
          {freeHere && <span className="block text-xs text-gray-700">Their listing says their first visit is free.</span>}
        </span>
      </label>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save the meeting'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-gray-800 underline">
          Cancel
        </button>
      </div>
      <p className="text-xs text-gray-700">
        It goes in your Autinerary calendar. Nothing is sent to {resource.name}: you can email them the time afterwards.
      </p>
    </form>
  )
}
