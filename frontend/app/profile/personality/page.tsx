'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BackButton from '../../components/BackButton'
import { usePreferences } from '../../context/usePreferences'
import { ITEMS, SCALE, TRAITS, isTypeLabel, profileOf, type PersonalityChoice } from '@/lib/personality'

// "Am the life of the party." reads as "I am the life of the party."
const asI = (text: string) => `I ${text.charAt(0).toLowerCase()}${text.slice(1)}`

const TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']

/**
 * Your personality, optional (the team's note, October 2026: "Make this one
 * optional/skippable … If selected, should adjust based on personality type
 * intersections with norms"). Twenty statements from the International
 * Personality Item Pool's Mini-IPIP (public domain), each one skippable, and
 * a "Not for me" that stops the profile card asking. The answers shape how
 * new plans' steps are written (lib/personality.ts, workingStyleFor); only
 * the person sees them.
 */
export default function PersonalityPage() {
  const { prefs, update } = usePreferences()
  const saved = prefs.personality as PersonalityChoice | undefined
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [typeLabel, setTypeLabel] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<null | 'saving' | { ok: boolean; text: string }>(null)

  useEffect(() => {
    if (loaded || !saved) return
    setAnswers({ ...(saved.answers || {}) })
    setTypeLabel(saved.typeLabel || '')
    setLoaded(true)
  }, [saved, loaded])

  const answered = Object.keys(answers).length
  const profile = profileOf(answers)
  const traitsKnown = Object.keys(profile).length

  const save = async (next: PersonalityChoice) => {
    setStatus('saving')
    const ok = await update({ personality: { ...next, updatedAt: new Date().toISOString() } })
    setStatus(ok ? { ok: true, text: next.skipped ? 'Done. We won’t ask about this again; it stays here if you change your mind.' : 'Saved. Plans made from now on use it.' } : { ok: false, text: 'Saved on this device only. Please try again when you are connected.' })
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <BackButton fallback="/profile" />
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Your personality <span className="font-normal text-slate-700">(optional)</span></h1>
          <p className="mt-2 text-slate-800">
            Twenty short statements about how you usually are. Your answers shape how your plan&apos;s steps are written: quieter or
            more social, more or less structure. There are no right answers. Skip any statement, or all of them.
          </p>
          <p className="mt-2 text-sm text-slate-700">
            Only you see your answers. They are never used to guess anything about your norms, and you can clear them any time.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => save({ ...(saved || {}), skipped: true })} className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              Not for me
            </button>
          </div>
        </header>

        {status && status !== 'saving' && (
          <p role="status" className={`rounded-lg border p-3 text-sm ${status.ok ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
            {status.text}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save({ answers, profile, typeLabel: isTypeLabel(typeLabel) ? typeLabel.trim().toUpperCase() : undefined, skipped: false })
          }}
          className="space-y-4"
        >
          <p className="text-sm text-slate-700">How well does each describe you? {answered} of {ITEMS.length} answered.</p>
          {ITEMS.map((item, n) => (
            <fieldset key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <legend className="px-1 text-sm font-semibold text-slate-900">
                {n + 1}. {asI(item.text)}
              </legend>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-5">
                {SCALE.map((label, i) => (
                  <label key={label} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${answers[item.id] === i + 1 ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-slate-200 text-slate-800'}`}>
                    <input type="radio" name={item.id} value={i + 1} checked={answers[item.id] === i + 1} onChange={() => setAnswers((a) => ({ ...a, [item.id]: i + 1 }))} className="h-4 w-4" />
                    {label}
                  </label>
                ))}
              </div>
              {answers[item.id] !== undefined && (
                <button type="button" onClick={() => setAnswers(({ [item.id]: _, ...rest }) => rest)} className="mt-2 text-xs text-slate-700 underline underline-offset-2">
                  Skip this one
                </button>
              )}
            </fieldset>
          ))}

          {traitsKnown > 0 && (
            <section aria-labelledby="personality-result" className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
              <h2 id="personality-result" className="font-semibold text-slate-900">What this says about how you work</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-900">
                {TRAITS.filter((t) => profile[t.id]).map((t) => (
                  <li key={t.id}>
                    <strong>{t.label}:</strong> {profile[t.id] === 'low' ? t.low : profile[t.id] === 'high' ? t.high : 'Somewhere in the middle'}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-700">From the Big Five, the model most personality research uses. A short form like this gives a rough picture, not a label.</p>
            </section>
          )}

          <label className="block text-sm font-medium text-slate-900">
            A four-letter type, if you know yours (optional)
            <select value={typeLabel} onChange={(e) => setTypeLabel(e.target.value)} className="mt-1 block w-full max-w-xs rounded-lg border border-slate-300 p-2">
              <option value="">None</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="mt-1 block font-normal text-slate-700">Kept as a label for you. Plans use the statements above, which research supports better.</span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={status === 'saving'} className="rounded-lg bg-indigo-700 px-5 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
              {status === 'saving' ? 'Saving…' : 'Save'}
            </button>
            {(answered > 0 || saved?.answers) && (
              <button
                type="button"
                onClick={() => {
                  setAnswers({})
                  setTypeLabel('')
                  void save({ skipped: false })
                }}
                className="rounded-lg border border-slate-400 bg-white px-5 py-2 font-semibold text-slate-800 hover:bg-slate-50"
              >
                Clear my answers
              </button>
            )}
          </div>
        </form>
        <p className="text-xs text-slate-700">
          Statements from the International Personality Item Pool (ipip.ori.org), in the public domain. <Link href="/privacy" className="underline">Privacy</Link>
        </p>
      </div>
    </main>
  )
}
