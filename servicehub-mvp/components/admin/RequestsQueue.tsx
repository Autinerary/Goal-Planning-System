'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

const WANT_LABELS: Record<string, string> = {
  edit_details: 'Edit our details',
  hours: 'Opening hours',
  photos: 'Photos',
  insights: 'How people use our listing',
  reply_comments: 'Reply to comments',
  booking_link: 'A booking link',
  waitlist: 'Our waitlist or availability',
  accessibility: 'Accessibility and sensory information',
  languages: 'Languages we serve in',
  events: 'Events and groups',
  promotions: 'Promotions (sponsored places)',
  referrals: 'Referrals from families',
  messages: 'Messages from families',
  verified_badge: 'A badge that we checked our listing',
}

interface Data {
  ready: boolean
  note?: string
  claims: any[]
  edits: any[]
  promotions: any[]
  guides: any[]
  access: any[]
  survey: { answers: number; wants: [string, number][]; imageWrong: number; other: string[] }
}

function Actions({ onApprove, onReject, busy, approve = 'Approve' }: { onApprove: () => void; onReject: () => void; busy: boolean; approve?: string }) {
  return (
    <div className="mt-3 flex gap-2">
      <button type="button" onClick={onApprove} disabled={busy} className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60">
        {approve}
      </button>
      <button type="button" onClick={onReject} disabled={busy} className="rounded-md border border-red-700 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60">
        Reject
      </button>
    </div>
  )
}

/**
 * Requests (STEP 81): everything that waits for the team, in one place.
 * Approving a Spot Guide adds them to spot_guides; approving free access
 * gives a year; approving a promotion makes it live, which shows only once
 * sponsored listings are turned on (NEXT_PUBLIC_SPONSORED). Nothing here
 * deletes anything: a rejection is kept as rejected.
 */
export default function RequestsQueue() {
  const [d, setD] = useState<Data | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(
    () =>
      fetch('/api/admin/requests', { cache: 'no-store' })
        .then((r) => r.json())
        .then(setD)
        .catch(() => setMsg('Could not load the requests.')),
    []
  )
  useEffect(() => {
    void load()
  }, [load])

  const act = async (section: string, id: string, action: 'approve' | 'reject') => {
    setBusy(`${section}:${id}`)
    const res = await fetch('/api/admin/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section, id, action }) }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setBusy('')
    setMsg(res?.ok ? (action === 'approve' ? 'Approved.' : 'Rejected.') : data?.error || 'Could not save that.')
    void load()
  }

  const card = 'rounded-lg border border-gray-200 bg-white p-4'
  const section = (title: string, n: number) => (
    <h2 className="mt-8 text-lg font-semibold text-gray-900">
      {title} <span className="text-sm font-normal text-gray-700">({n})</span>
    </h2>
  )

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Link href="/admin" className="text-sm text-blue-800 underline">
        Back to admin
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Requests</h1>
      {msg && (
        <p role="status" className="mt-3 rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900">
          {msg}
        </p>
      )}
      {!d ? (
        <p className="mt-4 text-gray-700">Loading…</p>
      ) : !d.ready ? (
        <p className="mt-4 text-gray-800">{d.note}</p>
      ) : (
        <>
          {section('Listing claims to check', d.claims.length)}
          <p className="text-sm text-gray-700">Someone says they run a listing that shows no email, or asked the team instead of a code. Check what they wrote (call the number on the listing, or look at the web page).</p>
          <ul className="mt-2 space-y-3">
            {d.claims.map((c) => (
              <li key={c.id} className={card}>
                <p className="font-semibold text-gray-900">{c.listing}</p>
                <p className="text-sm text-gray-800">
                  {c.email}
                  {c.account ? ` · ${c.account.organization}${c.account.role_title ? `, ${c.account.role_title}` : ''}` : ''}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{c.evidence}</p>
                <Actions busy={busy === `claims:${c.id}`} approve="Confirm they run it" onApprove={() => act('claims', c.id, 'approve')} onReject={() => act('claims', c.id, 'reject')} />
              </li>
            ))}
          </ul>

          {section('Listing changes that wait for the team', d.edits.length)}
          <ul className="mt-2 space-y-3">
            {d.edits.map((e) => (
              <li key={e.id} className={card}>
                <p className="font-semibold text-gray-900">
                  {e.listing} <span className="text-sm font-normal text-gray-700">· {e.email}</span>
                </p>
                <ul className="mt-1 text-sm text-gray-900">
                  {Object.entries(e.changes || {}).map(([k, v]) => (
                    <li key={k}>
                      {k}: <span className="line-through">{String(e.before?.[k] ?? '') || '(empty)'}</span> → <strong>{String(v) || '(empty)'}</strong>
                      {k === 'image_url' && typeof v === 'string' && v && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v} alt="The proposed picture" className="mt-1 h-24 w-auto rounded border border-gray-200" />
                      )}
                    </li>
                  ))}
                </ul>
                <Actions busy={busy === `edits:${e.id}`} approve="Apply" onApprove={() => act('edits', e.id, 'approve')} onReject={() => act('edits', e.id, 'reject')} />
              </li>
            ))}
          </ul>

          {section('Promotions sent for approval', d.promotions.length)}
          <p className="text-sm text-gray-700">Approved promotions show only once sponsored listings are turned on, labelled “Sponsored”. Check the words are true, kind and not medical claims.</p>
          <ul className="mt-2 space-y-3">
            {d.promotions.map((p) => (
              <li key={p.id} className={card}>
                <p className="font-semibold text-gray-900">
                  {p.headline} <span className="text-sm font-normal text-gray-700">· {p.listing} · {p.email}</span>
                </p>
                {p.body && <p className="text-sm text-gray-900">{p.body}</p>}
                <p className="mt-1 text-xs text-gray-700">
                  Searches: {(p.keywords || []).join(', ') || 'any'} · Provinces: {(p.provinces || []).join(', ') || 'any'} · {p.starts_on || '…'} to {p.ends_on || '…'}
                </p>
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="The promotion's picture" className="mt-2 h-24 w-auto rounded border border-gray-200" />
                )}
                <Actions busy={busy === `promotions:${p.id}`} onApprove={() => act('promotions', p.id, 'approve')} onReject={() => act('promotions', p.id, 'reject')} />
              </li>
            ))}
          </ul>

          {section('People asking to be Spot Guides', d.guides.length)}
          <ul className="mt-2 space-y-3">
            {d.guides.map((g) => (
              <li key={g.id} className={card}>
                <p className="font-semibold text-gray-900">
                  {g.email} <span className="text-sm font-normal text-gray-700">· {g.area}</span>
                </p>
                {g.why && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{g.why}</p>}
                <Actions busy={busy === `guides:${g.id}`} approve="Make them a Spot Guide" onApprove={() => act('guides', g.id, 'approve')} onReject={() => act('guides', g.id, 'reject')} />
              </li>
            ))}
          </ul>

          {section('Free access requests', d.access.length)}
          <p className="text-sm text-gray-700">Students wait for their school to partner (approve one to give a year now). “Explain your case” requests: approve gives a year.</p>
          <ul className="mt-2 space-y-3">
            {d.access.map((a) => (
              <li key={a.id} className={card}>
                <p className="font-semibold text-gray-900">
                  {a.kind === 'student' ? 'Student' : 'Their situation'} · {a.source} <span className="text-sm font-normal text-gray-700">· {a.email}</span>
                </p>
                {a.case_text && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{a.case_text}</p>}
                <Actions busy={busy === `access:${a.id}`} approve="Give a year" onApprove={() => act('access', a.id, 'approve')} onReject={() => act('access', a.id, 'reject')} />
              </li>
            ))}
          </ul>

          {section('What services want in their Resource Account (V1.5 survey)', d.survey.answers)}
          {d.survey.answers === 0 ? (
            <p className="text-sm text-gray-800">No answers yet.</p>
          ) : (
            <div className={`${card} mt-2`}>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-900">
                {d.survey.wants.map(([w, n]) => (
                  <li key={w}>
                    {WANT_LABELS[w] || w}: {n}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-sm text-gray-800">Said the picture on their listing is wrong: {d.survey.imageWrong}</p>
              {d.survey.other.length > 0 && (
                <>
                  <p className="mt-3 text-sm font-semibold text-gray-900">In their words</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-900">
                    {d.survey.other.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="mt-3 text-xs text-gray-700">docs/goals-6-11-2026-10.md says how to turn these into changes: build what nobody disagrees with, and put the rest to a vote.</p>
            </div>
          )}
        </>
      )}
    </main>
  )
}
