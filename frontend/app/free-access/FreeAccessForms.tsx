'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ACCESS_KINDS } from '@/lib/billing'

interface Grant {
  kind: string
  source: string | null
  status: string
  ends_at: string | null
  created_at: string
}

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
const KIND_WORDS: Record<string, string> = { student: 'Student', employee: 'Workplace', government: 'Government or city', advocate: 'Your situation', partner: 'Partner', team: 'Team' }
const STATUS_WORDS: Record<string, string> = { pending: 'Waiting for the team', active: 'Active', rejected: 'Not approved', expired: 'Ended' }

function Result({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p role={ok ? 'status' : 'alert'} className={`mt-3 rounded-lg border p-3 text-sm ${ok ? 'border-emerald-300 bg-emerald-50 text-slate-900' : 'border-red-300 bg-red-50 text-red-900'}`}>
      {text}
    </p>
  )
}

/** A partner's code, registering as a student, and explaining your situation (STEP 81). */
export default function FreeAccessForms() {
  const [grants, setGrants] = useState<Grant[] | null>(null)
  const [open, setOpen] = useState(true)
  const [code, setCode] = useState('')
  const [school, setSchool] = useState('')
  const [town, setTown] = useState('')
  const [story, setStory] = useState('')
  const [willHelp, setWillHelp] = useState(false)
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState<Record<string, { ok: boolean; text: string }>>({})

  const load = () =>
    fetch('/api/access/apply', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { grants: [] }))
      .then((d) => {
        setGrants(d.grants || [])
        setOpen(d.open !== false)
      })
      .catch(() => setGrants([]))
  useEffect(() => {
    void load()
  }, [])

  const send = async (what: string, path: string, body: object, ok: (d: any) => string) => {
    setBusy(what)
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setBusy('')
    setResult((r) => ({ ...r, [what]: res?.ok ? { ok: true, text: ok(d) } : { ok: false, text: d?.error || 'That didn’t work just now. Please try again.' } }))
    if (res?.ok) void load()
  }

  const kind = (id: string) => ACCESS_KINDS.find((k) => k.id === id)!

  return (
    <div className="mt-8 space-y-8">
      {!open && <p className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-slate-900">Free access opens soon.</p>}

      {grants && grants.length > 0 && (
        <section aria-labelledby="yours" className="rounded-xl border border-slate-200 p-5">
          <h2 id="yours" className="text-lg font-semibold text-slate-900">
            Yours
          </h2>
          <ul className="mt-2 space-y-1 text-slate-800">
            {grants.map((g, i) => (
              <li key={i}>
                {KIND_WORDS[g.kind] || g.kind}
                {g.source && !g.source.startsWith('code:') ? `: ${g.source}` : ''} · {STATUS_WORDS[g.status] || g.status}
                {g.status === 'active' && g.ends_at ? `, until ${day(g.ends_at)}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="code" className="rounded-xl border border-slate-200 p-5">
        <h2 id="code" className="text-lg font-semibold text-slate-900">
          Have a code?
        </h2>
        <p className="mt-1 text-slate-800">Your school, workplace, city or a government program may have given you one.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send('code', '/api/access/redeem', { code }, (d) => `Done: free access from ${d.organization}${d.ends_at ? `, until ${day(d.ends_at)}` : ''}.`)
          }}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <label className="block">
            <span className="block text-sm font-medium text-slate-900">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="off"
              maxLength={32}
              className="mt-1 w-56 rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase text-slate-900"
            />
          </label>
          <button type="submit" disabled={code.trim().length < 6 || busy === 'code'} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
            {busy === 'code' ? 'Checking…' : 'Use code'}
          </button>
        </form>
        {result.code && <Result {...result.code} />}
      </section>

      <section aria-labelledby="students" className="rounded-xl border border-slate-200 p-5">
        <h2 id="students" className="text-lg font-semibold text-slate-900">
          {kind('student').label}
        </h2>
        <p className="mt-1 text-slate-800">{kind('student').text}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send('student', '/api/access/apply', { kind: 'student', source: school }, () => `Registered. We will email you when ${school.trim()} joins.`)
          }}
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          <label className="block flex-1">
            <span className="block text-sm font-medium text-slate-900">Your university or college</span>
            <input value={school} onChange={(e) => setSchool(e.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <button type="submit" disabled={!school.trim() || busy === 'student'} className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
            {busy === 'student' ? 'Sending…' : 'Register as a student'}
          </button>
        </form>
        {result.student && <Result {...result.student} />}
      </section>

      <section aria-labelledby="work" className="rounded-xl border border-slate-200 p-5">
        <h2 id="work" className="text-lg font-semibold text-slate-900">
          {kind('employee').label}, and {kind('government').label.toLowerCase()}
        </h2>
        <p className="mt-1 text-slate-800">
          {kind('employee').text} {kind('government').text}
        </p>
        <p className="mt-2 text-slate-800">
          Not yet?{' '}
          <Link href="/petition?ask=workplace" className="font-medium text-indigo-800 underline underline-offset-2">
            Ask your workplace
          </Link>{' '}
          or{' '}
          <Link href="/petition?ask=city" className="font-medium text-indigo-800 underline underline-offset-2">
            your city
          </Link>{' '}
          to fund Autinerary.
        </p>
      </section>

      <section aria-labelledby="none" className="rounded-xl border border-slate-200 p-5">
        <h2 id="none" className="text-lg font-semibold text-slate-900">
          {kind('advocate').label}
        </h2>
        <p className="mt-1 text-slate-800">{kind('advocate').text}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send('advocate', '/api/access/apply', { kind: 'advocate', source: town, case: story }, () => 'Thank you. The team will read it and email you.')
          }}
          className="mt-3 space-y-3"
        >
          <label className="block">
            <span className="block text-sm font-medium text-slate-900">Where you live (town or city)</span>
            <input value={town} onChange={(e) => setTown(e.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-900">Your situation, in a few sentences</span>
            <textarea value={story} onChange={(e) => setStory(e.target.value)} rows={4} maxLength={2000} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
            <span className="block text-xs text-slate-700">Only the Autinerary team reads it.</span>
          </label>
          <label className="flex items-start gap-2 text-slate-900">
            <input type="checkbox" checked={willHelp} onChange={(e) => setWillHelp(e.target.checked)} className="mt-1 h-4 w-4" />
            <span>I will help ask my town, school or workplace to fund Autinerary, for example by sharing the petition.</span>
          </label>
          <button
            type="submit"
            disabled={!town.trim() || story.trim().length < 20 || !willHelp || busy === 'advocate'}
            className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
          >
            {busy === 'advocate' ? 'Sending…' : 'Send'}
          </button>
        </form>
        {result.advocate && <Result {...result.advocate} />}
      </section>

      <p className="text-sm">
        <Link href="/billing" className="font-medium text-indigo-800 underline underline-offset-2">
          Billing
        </Link>
        {' · '}
        <Link href="/pricing" className="font-medium text-indigo-800 underline underline-offset-2">
          How Autinerary is paid for
        </Link>
        {' · '}
        <Link href="/petition" className="font-medium text-indigo-800 underline underline-offset-2">
          #FundAutinerary
        </Link>
      </p>
    </div>
  )
}
