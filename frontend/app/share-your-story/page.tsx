'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { NAME_DISPLAYS, PROVINCES, STATUS_LABEL, STORY_ROLES, type StoryStatus } from '@/lib/stories'

/**
 * Share your story (Riipen Labs, Group 11: "short stories from a parent, a
 * sibling, and a neurodivergent adult ... shared with consent"). The consent
 * is docs/beta/testimonials.md in plain words: the person chooses how their
 * name shows, what else shows and where; the team may shorten the story; the
 * person approves the exact final text before anything is shared, and can
 * take it back at any time (app/api/stories).
 */

interface Mine {
  id: string
  story: string
  final_text: string | null
  status: StoryStatus
  created_at: string
}

const FIELD = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300'

export default function ShareYourStoryPage() {
  const { user, isLoading } = useAuth()
  const [mine, setMine] = useState<Mine[] | null>(null)
  const [form, setForm] = useState({
    story: '', role: '', showRole: true, province: '', showProvince: false,
    nameDisplay: 'first_name', displayName: '', shareSite: true, shareSocial: false, format: 'text', adult: false,
  })
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState('')

  const load = () =>
    fetch('/api/stories/mine', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { stories: [] }))
      .then((json) => setMine(json.stories || []))
      .catch(() => setMine([]))
  useEffect(() => {
    if (user) load()
  }, [user])

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setNote('')
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...form, role: form.role || null, province: form.province || null }),
    }).catch(() => null)
    const json = await res?.json().catch(() => ({}))
    setSending(false)
    if (res?.ok) {
      setNote('Thank you. Your story is with the team. We will show you the final version to approve before anything is shared.')
      setForm((f) => ({ ...f, story: '' }))
      load()
    } else setNote(json?.error || 'Your story could not be sent just now. Please try again later.')
  }

  const act = async (id: string, action: 'approve' | 'withdraw') => {
    if (action === 'withdraw' && !window.confirm('Withdraw this story? It will not be shown anywhere.')) return
    await fetch(`/api/stories/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action }) }).catch(() => {})
    load()
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-bold text-slate-900">Share your story</h1>
        <p className="mt-3 text-slate-800">
          Has Autinerary helped you, even a little? A few honest sentences can help someone like you decide to try it. It is
          completely up to you, and saying no changes nothing.
        </p>

        <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <summary className="cursor-pointer font-semibold text-slate-900">What happens to your story</summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>The team reads it, may shorten it without changing what it means, and shows you the final version. Nothing is shared until you approve that exact text.</li>
            <li>It is shared only where you choose below, for up to two years, with your name shown the way you choose.</li>
            <li>Leave out health details you don&apos;t want shared, and anything that identifies someone else, especially a child. We never show children&apos;s names or photos.</li>
            <li>Say what really happened, good and bad. If we ever give anything in return, we will say so next to your story.</li>
            <li>We don&apos;t sell stories, use them in ads aimed at people, or use them to train AI.</li>
            <li>You can withdraw it here at any time. It comes off the website and our accounts within 14 days.</li>
          </ul>
        </details>

        {isLoading ? null : !user ? (
          <p className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-slate-800">
            Please <Link href="/login" className="font-medium text-indigo-800 underline underline-offset-2">sign in</Link> to share your story, so you can approve it and take it back later.
          </p>
        ) : (
          <form onSubmit={send} className="mt-6 space-y-5">
            <label className="block font-medium text-slate-900">
              Your story
              <span className="block text-sm font-normal text-slate-700">For example: what things were like before, what you tried in Autinerary, and what changed.</span>
              <textarea value={form.story} onChange={(e) => set({ story: e.target.value })} rows={7} maxLength={1500} required className={FIELD} />
              <span className="block text-right text-xs text-slate-700">{form.story.length} / 1,500</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-900">
                I am sharing as
                <select value={form.role} onChange={(e) => set({ role: e.target.value })} className={FIELD}>
                  <option value="">Prefer not to say</option>
                  {STORY_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-900">
                Province or territory
                <select value={form.province} onChange={(e) => set({ province: e.target.value })} className={FIELD}>
                  <option value="">Prefer not to say</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-slate-900">Show my name as</legend>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-800">
                {NAME_DISPLAYS.map((n) => (
                  <label key={n.id} className="flex items-center gap-2">
                    <input type="radio" name="nameDisplay" value={n.id} checked={form.nameDisplay === n.id} onChange={() => set({ nameDisplay: n.id })} />
                    {n.label}
                  </label>
                ))}
              </div>
              {form.nameDisplay !== 'none' && (
                <label className="mt-2 block text-sm text-slate-800">
                  {form.nameDisplay === 'initials' ? 'Your initials' : 'Your first name'}
                  <input value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} maxLength={40} className={`${FIELD} max-w-xs`} />
                </label>
              )}
            </fieldset>

            <fieldset className="space-y-2 text-sm text-slate-800">
              <legend className="font-medium text-slate-900">You may show and share</legend>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.showRole} onChange={(e) => set({ showRole: e.target.checked })} /> Who I am in the story (for example &ldquo;parent&rdquo;)</label>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.showProvince} onChange={(e) => set({ showProvince: e.target.checked })} /> My province</label>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.shareSite} onChange={(e) => set({ shareSite: e.target.checked })} /> On the Autinerary website and app</label>
              <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={form.shareSocial} onChange={(e) => set({ shareSocial: e.target.checked })} /> On Autinerary&apos;s social media accounts</label>
            </fieldset>

            <label className="block text-sm font-medium text-slate-900">
              I would rather
              <select value={form.format} onChange={(e) => set({ format: e.target.value })} className={`${FIELD} max-w-sm`}>
                <option value="text">Share it in writing</option>
                <option value="audio">Record it as audio with the team</option>
                <option value="video">Record it as a video with the team</option>
              </select>
              {form.format !== 'text' && <span className="mt-1 block font-normal text-slate-700">We will email you to arrange it. Captions are added to every recording.</span>}
            </label>

            <label className="flex items-start gap-2 text-sm text-slate-900">
              <input type="checkbox" className="mt-1" checked={form.adult} onChange={(e) => set({ adult: e.target.checked })} required />
              I am 18 or older, and I agree to share my story as chosen above. I will approve the final version first.
            </label>

            <button type="submit" disabled={sending} className="rounded-xl bg-indigo-700 px-6 py-3 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-300 disabled:text-slate-700">
              {sending ? 'Sending…' : 'Send my story to the team'}
            </button>
            {note && <p role="status" className="text-slate-800">{note}</p>}
          </form>
        )}

        {user && mine && mine.length > 0 && (
          <section aria-labelledby="mine-heading" className="mt-10 border-t border-slate-200 pt-6">
            <h2 id="mine-heading" className="text-xl font-bold text-slate-900">Your stories</h2>
            <ul className="mt-4 space-y-4">
              {mine.map((s) => (
                <li key={s.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">{STATUS_LABEL[s.status]}</p>
                  <blockquote className="mt-2 whitespace-pre-line border-l-4 border-indigo-200 pl-3 text-slate-800">
                    {s.status === 'awaiting_approval' || s.status === 'approved' || s.status === 'published' ? s.final_text || s.story : s.story}
                  </blockquote>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {s.status === 'awaiting_approval' && (
                      <button type="button" onClick={() => act(s.id, 'approve')} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
                        Approve this version
                      </button>
                    )}
                    {s.status !== 'withdrawn' && s.status !== 'declined' && (
                      <button type="button" onClick={() => act(s.id, 'withdraw')} className="text-sm font-medium text-slate-800 underline underline-offset-2">
                        Withdraw
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  )
}
