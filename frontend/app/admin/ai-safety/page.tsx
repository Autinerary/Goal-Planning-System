'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BackButton from '../../components/BackButton'
import { ACTION_WORDS, CATEGORY_WORDS, type SafetySummary } from '@/lib/aiSafety'

const HIDDEN_WORDS: Record<string, string> = {
  phone: 'Phone numbers', email: 'Email addresses', id_number: 'ID numbers', address: 'Their own address', password: 'Passwords',
}

function Counts({ label, rows }: { label: string; rows: [string, number][] }) {
  if (!rows.length) return <p className="text-sm text-slate-600">None yet.</p>
  return (
    <table className="w-full max-w-xl text-sm" aria-label={label}>
      <tbody>
        {rows.map(([name, n]) => (
          <tr key={name} className="border-b border-slate-100">
            <th scope="row" className="py-1.5 pr-4 text-left font-normal text-slate-800">{name}</th>
            <td className="py-1.5 text-right tabular-nums font-semibold text-slate-900">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * The team's view of the safety check on the assistant and on agents (STEP 101; backend core/moderation.py;
 * docs/ai-moderation.md): how often it did something, and what, over the last 90 days. Counts only: the table keeps no
 * words and no accounts, so nobody here can read what anyone wrote.
 */
export default function AiSafetyPage() {
  const [data, setData] = useState<{ days: number; summary: SafetySummary } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/ai-safety', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error || 'Could not load.')
        if (d.available === false) throw new Error('The counts aren’t in the database yet (STEP 101).')
        setData({ days: d.days, summary: d.summary })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load.'))
  }, [])

  const s = data?.summary
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">AI safety check</h1>
      <p className="mt-1 text-sm text-slate-700">
        What the safety check on the assistant and on agents did, counted. It keeps no words and no accounts, and times only
        to the hour, so this can’t say who wrote what. <Link href="/help#ai-safety" className="font-medium text-indigo-800 underline underline-offset-2">What people are told</Link>
      </p>
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      {!s && !error && <p className="mt-4 text-slate-600">Loading…</p>}
      {s && (
        <div className="mt-6 space-y-8">
          <p className="text-slate-900">
            In the last {data!.days} days the check did something <strong>{s.total}</strong> {s.total === 1 ? 'time' : 'times'}.
            An ordinary message leaves no line here.
          </p>
          <section>
            <h2 className="mb-2 text-lg font-bold text-slate-900">What it did</h2>
            <Counts label="What it did" rows={ACTION_WORDS.filter(([k]) => s.byAction[k]).map(([k, w]) => [w, s.byAction[k]])} />
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold text-slate-900">What it found</h2>
            <Counts label="What it found" rows={Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]).map(([k, n]) => [CATEGORY_WORDS[k] ?? k, n])} />
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold text-slate-900">Personal details hidden</h2>
            <Counts label="Personal details hidden" rows={Object.entries(s.hidden).sort((a, b) => b[1] - a[1]).map(([k, n]) => [HIDDEN_WORDS[k] ?? k, n])} />
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold text-slate-900">Where</h2>
            <Counts label="Where" rows={Object.entries(s.bySurface).map(([k, n]) => [k === 'agent' ? 'My agents' : 'The assistant', n])} />
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold text-slate-900">Week by week</h2>
            <div className="overflow-x-auto" role="region" aria-label="Week by week" tabIndex={0}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-700">
                    <th scope="col" className="py-1.5 pr-4 font-semibold">Week of</th>
                    <th scope="col" className="py-1.5 pr-4 text-right font-semibold">Crisis lines</th>
                    <th scope="col" className="py-1.5 pr-4 text-right font-semibold">Steered</th>
                    <th scope="col" className="py-1.5 pr-4 text-right font-semibold">Details hidden</th>
                    <th scope="col" className="py-1.5 pr-4 text-right font-semibold">Answers redone or left out</th>
                    <th scope="col" className="py-1.5 text-right font-semibold">Couldn’t run</th>
                  </tr>
                </thead>
                <tbody>
                  {s.weeks.map((w) => (
                    <tr key={w.start} className="border-b border-slate-100 tabular-nums text-slate-900">
                      <th scope="row" className="py-1.5 pr-4 text-left font-normal">{w.start}</th>
                      <td className="py-1.5 pr-4 text-right">{w.care}</td>
                      <td className="py-1.5 pr-4 text-right">{w.steer}</td>
                      <td className="py-1.5 pr-4 text-right">{w.hide}</td>
                      <td className="py-1.5 pr-4 text-right">{w.answers}</td>
                      <td className="py-1.5 text-right">{w.unchecked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
