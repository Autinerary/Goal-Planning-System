'use client'

import { useState } from 'react'
import { PROVIDER_WANTS } from '@/lib/providerSurvey'

/** The survey's questions: what they'd use, their own ideas, whether the picture is right, and how to reach them. */
export default function SurveyForm({ r, t, name, image, listingUrl }: { r: string; t: string; name: string; image: string | null; listingUrl: string }) {
  const [wants, setWants] = useState<string[]>([])
  const [other, setOther] = useState('')
  const [imageSame, setImageSame] = useState<'' | 'yes' | 'no'>('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('busy')
    const res = await fetch('/api/providers/survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ r, t, wants, other, image_same: imageSame === '' ? null : imageSame === 'yes', contact_email: email }),
    }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    if (res?.ok) setState('done')
    else {
      setState('error')
      setError(d?.error || 'Could not send that just now.')
    }
  }

  if (state === 'done')
    return (
      <div role="status" className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-slate-900">
        <p className="text-lg font-semibold">Thank you.</p>
        <p className="mt-1">We will build what services ask for most, and ask again where services disagree.</p>
      </div>
    )

  return (
    <form onSubmit={send} className="mt-6 space-y-6">
      <fieldset>
        <legend className="font-semibold text-slate-900">What would you use? Choose any.</legend>
        <div className="mt-2 grid gap-2">
          {PROVIDER_WANTS.map((w) => (
            <label key={w.id} className="flex items-start gap-2 text-slate-900">
              <input
                type="checkbox"
                checked={wants.includes(w.id)}
                onChange={(e) => setWants((x) => (e.target.checked ? [...x, w.id] : x.filter((y) => y !== w.id)))}
                className="mt-1 h-4 w-4"
              />
              {w.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="font-semibold text-slate-900">Anything else you&apos;d like? (optional)</span>
        <textarea value={other} onChange={(e) => setOther(e.target.value)} rows={4} maxLength={2000} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
      </label>
      <fieldset>
        <legend className="font-semibold text-slate-900">Is this the right picture for {name}?</legend>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`The picture ResourceHub shows for ${name}`} className="mt-2 h-40 w-auto rounded-lg border border-slate-200" />
        ) : (
          <p className="mt-1 text-slate-800">We don&apos;t show a picture of {name} yet.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-4">
          {[
            ['yes', image ? 'Yes, it’s right' : 'That’s fine'],
            ['no', image ? 'No, it isn’t' : 'We’d like one'],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 text-slate-900">
              <input type="radio" name="image" checked={imageSame === v} onChange={() => setImageSame(v as 'yes' | 'no')} className="h-4 w-4" />
              {l}
            </label>
          ))}
        </div>
        <a href={listingUrl} className="mt-2 inline-block text-sm font-medium text-indigo-800 underline underline-offset-2">
          See your listing
        </a>
      </fieldset>
      <label className="block">
        <span className="font-semibold text-slate-900">An email to reach you about it (optional)</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
      </label>
      {state === 'error' && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === 'busy' || (!wants.length && !other.trim() && !imageSame)}
        className="rounded-lg bg-indigo-700 px-5 py-2.5 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
      >
        {state === 'busy' ? 'Sending…' : 'Send'}
      </button>
      <p className="text-xs text-slate-700">Only the Autinerary team reads your answers.</p>
    </form>
  )
}
