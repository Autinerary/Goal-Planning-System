'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2, Save, Sparkles } from 'lucide-react'
import BackButton from '../components/BackButton'
import { usePreferences } from '../context/usePreferences'
import { ABOUT_ME_MAX, ABOUT_ME_SECTIONS, type AboutMe, type AboutMeSection } from '@/lib/aboutMe'

/**
 * About me (Riipen Labs, Group 34, slide 26): you, in your own words, under
 * a few prompts, with a switch to let the assistant read it. Only you can see
 * it. It is kept with your preferences, which other people could read until
 * STEP 64, so the page waits for STEP 64 (lib/aboutMe.ts).
 */
export default function AboutMePage() {
  const { prefs, update } = usePreferences()
  const [ready, setReady] = useState<null | boolean>(null)
  const [draft, setDraft] = useState<AboutMe>({ sections: {}, shareWithAssistant: false })
  const [loaded, setLoaded] = useState(false)
  const [state, setState] = useState<null | 'saving' | { ok: boolean; text: string }>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/profile', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled) setReady(Boolean(json?.extended)) })
      .catch(() => { if (!cancelled) setReady(false) })
    return () => { cancelled = true }
  }, [])

  // Start from what is saved, once it has arrived from the account.
  useEffect(() => {
    if (loaded || !prefs.aboutMe) return
    setDraft({ sections: { ...(prefs.aboutMe.sections || {}) }, shareWithAssistant: Boolean(prefs.aboutMe.shareWithAssistant) })
    setLoaded(true)
  }, [prefs.aboutMe, loaded])

  const setSection = (id: AboutMeSection, text: string) => {
    setDraft((d) => ({ ...d, sections: { ...d.sections, [id]: text.slice(0, ABOUT_ME_MAX) } }))
    setState(null)
  }

  const save = async (next: AboutMe = draft) => {
    setState('saving')
    const ok = await update({ aboutMe: { ...next, updatedAt: new Date().toISOString() } })
    setLoaded(true)
    setState(ok ? { ok: true, text: 'Saved.' } : { ok: false, text: 'Saved on this device only. Please try again when you are connected.' })
  }

  const toggleShare = () => {
    const next = { ...draft, shareWithAssistant: !draft.shareWithAssistant }
    setDraft(next)
    void save(next)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <BackButton fallback="/reflection" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">About me</h1>
          <p className="mt-1 text-slate-700">
            You, in your own words. Write as much or as little as you like; every part is optional. Only you can see this page.
          </p>
        </div>

        {ready === null && (
          <p className="flex items-center gap-2 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…</p>
        )}

        {ready === false && (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-sm">
            About me isn’t switched on yet. It will be soon. In the meantime, your{' '}
            <Link href="/reflection" className="font-medium text-indigo-800 underline underline-offset-2">journal</Link> is a good place to write.
          </p>
        )}

        {ready && (
          <>
            <section aria-labelledby="share-heading" className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="share-heading" className="flex items-center gap-2 font-semibold text-slate-900">
                    <Sparkles className="h-4 w-4 text-indigo-700" aria-hidden="true" /> Share with the assistant
                  </h2>
                  <p id="share-help" className="mt-1 text-sm text-slate-700">
                    When this is on, the{' '}
                    <Link href="/assistant" className="font-medium text-indigo-800 underline underline-offset-2">assistant</Link>{' '}
                    reads this page with each question you ask, so you don’t have to explain yourself again. It is sent to
                    OpenAI with your question, as Privacy explains. Off unless you turn it on.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.shareWithAssistant}
                  aria-labelledby="share-heading"
                  aria-describedby="share-help"
                  onClick={toggleShare}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${draft.shareWithAssistant ? 'bg-indigo-700' : 'bg-slate-400'}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${draft.shareWithAssistant ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </section>

            <form
              onSubmit={(e) => { e.preventDefault(); void save() }}
              className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              {ABOUT_ME_SECTIONS.map((s) => {
                const value = draft.sections[s.id] || ''
                return (
                  <div key={s.id}>
                    <label htmlFor={`about-${s.id}`} className="block font-semibold text-slate-900">{s.label}</label>
                    <p id={`about-${s.id}-hint`} className="mb-1 text-sm text-slate-600">{s.hint}</p>
                    <textarea
                      id={`about-${s.id}`}
                      value={value}
                      rows={3}
                      maxLength={ABOUT_ME_MAX}
                      aria-describedby={`about-${s.id}-hint`}
                      onChange={(e) => setSection(s.id, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-right text-xs text-slate-600">{value.length}/{ABOUT_ME_MAX}</p>
                  </div>
                )
              })}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={state === 'saving'}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                >
                  {state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                  Save
                </button>
                <span role="status" className={`text-sm ${state && state !== 'saving' && !state.ok ? 'text-red-700' : 'font-medium text-emerald-800'}`}>
                  {state && state !== 'saving' ? state.text : ''}
                </span>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
