'use client'

/**
 * "Build my training set" (Settings, Models): choose your own journal entries, reflections and plan notes, check
 * them scrubbed beside what you wrote, and download them to train a small open model on your own laptop.
 *
 * Nothing is chosen until the person turns it on. The backend reads only their own items, scrubs them in memory and
 * keeps nothing but a record of what they approved (backend/api/routes/training.py, STEP 95); the file is made here,
 * in the browser (lib/trainingSet.ts), and trained on their laptop (public/own-model/).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ConsentRecord,
  ScrubbedItem,
  TrainingItem,
  foundSummary,
  itemKey,
  listConsents,
  listItems,
  recordConsent,
  scrubItems,
  scrubTexts,
  toJsonl,
  trainingFileName,
} from '@/lib/trainingSet'
import { sharingStatus } from '@/lib/sharedModels'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Review = ScrubbedItem & { edited: boolean; checking: boolean; note?: string }

async function freshToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/jsonl' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function TrainingSetPage() {
  const [signedOut, setSignedOut] = useState(false)
  const [items, setItems] = useState<TrainingItem[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const [review, setReview] = useState<Review[] | null>(null)
  const [version, setVersion] = useState('')
  const [namesByRecogniser, setNamesByRecogniser] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<{ file: string; count: number; at: string } | null>(null)
  const [records, setRecords] = useState<ConsentRecord[]>([])
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    sharingStatus(API_URL).then((s) => setSharing(s.enabled)).catch(() => {})
    ;(async () => {
      const token = await freshToken()
      if (!token) {
        setSignedOut(true)
        return
      }
      try {
        setItems((await listItems(API_URL, token)).items)
      } catch (e: any) {
        setError(e.message)
      }
      listConsents(API_URL, token).then((r) => setRecords(r.records)).catch(() => {})
    })()
  }, [])

  const toggle = (key: string, on: boolean) =>
    setChosen((current) => {
      const next = new Set(current)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  const scrub = async () => {
    const token = await freshToken()
    if (!token || !items) return
    setScrubbing(true)
    setError(null)
    setDone(null)
    setConfirmed(false)
    try {
      const out = await scrubItems(API_URL, token, items.filter((item) => chosen.has(itemKey(item))))
      setVersion(out.version)
      setNamesByRecogniser(out.names)
      setReview(out.items.map((item) => ({ ...item, edited: false, checking: false })))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setScrubbing(false)
    }
  }

  const update = (key: string, change: Partial<Review>) =>
    setReview((current) => current && current.map((item) => (itemKey(item) === key ? { ...item, ...change } : item)))

  // An edit is scrubbed again, so a name typed back in is caught too.
  const checkEdit = async (item: Review) => {
    if (!item.edited) return
    const token = await freshToken()
    if (!token) return
    update(itemKey(item), { checking: true, note: undefined })
    try {
      const out = (await scrubTexts(API_URL, token, [item.after])).texts[0]
      const changed = out.after !== item.after
      update(itemKey(item), {
        after: out.after,
        edited: false,
        checking: false,
        note: changed ? `Checked your edit: ${foundSummary(out.found).toLowerCase()}.` : 'Checked your edit: nothing to replace.',
      })
    } catch {
      update(itemKey(item), { checking: false, note: 'Your edit couldn’t be checked. Click outside the box to try again.' })
    }
  }

  const kept = (review || []).filter((item) => item.after.trim())
  const unchecked = (review || []).some((item) => item.edited || item.checking)

  const approve = async () => {
    const token = await freshToken()
    if (!token || !review || !kept.length || unchecked || !confirmed) return
    setSaving(true)
    setError(null)
    try {
      const record = await recordConsent(API_URL, token, kept, version)
      const file = trainingFileName()
      download(toJsonl(kept), file)
      setDone({ file, count: kept.length, at: record.createdAt })
      setRecords((current) => [
        { id: record.id, createdAt: record.createdAt, itemCount: record.itemCount, scrubberVersion: record.scrubberVersion },
        ...current,
      ])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-2">
        <Link href="/settings/models" className="text-sm text-slate-500 hover:text-slate-800">
          ← Models
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Build my training set</h1>
        <p className="text-slate-600">
          Choose things you wrote, like journal entries, reflections, notes on your plan and steps you made your own, to
          tune a small open model on your device to how you talk about your steps. The training happens on your laptop,
          not on our servers.
        </p>
      </header>

      <section aria-labelledby="how-heading" className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700 space-y-2">
        <h2 id="how-heading" className="font-semibold text-slate-900">How it works</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li><span className="font-medium">Choose.</span> Nothing is included unless you turn it on.</li>
          <li>
            <span className="font-medium">Check.</span> We replace names, contact details, addresses, schools, employers,
            dates of birth and diagnoses with placeholders like [NAME]. It catches a lot, not everything, so read every item
            and edit or remove anything.
          </li>
          <li>
            <span className="font-medium">Download.</span> The file is made in this browser and saved to your computer.
            We keep only a record that you approved these items: which ones, when, and the scrubber&apos;s version. Never
            their text.
          </li>
        </ol>
        <p className="text-slate-500">
          To scrub your items, our server reads them and checks them in memory. The scrubbed text isn&apos;t saved there.
        </p>
      </section>

      {signedOut && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <Link href="/login" className="underline">Sign in</Link> to build your training set.
        </p>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</p>}

      {!signedOut && !review && (
        <section aria-labelledby="choose-heading" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="choose-heading" className="text-lg font-semibold text-slate-900">1. Choose</h2>
            {items && items.length > 0 && <span className="text-sm text-slate-600">{chosen.size} of {items.length} chosen</span>}
          </div>
          {!items && !error && <p className="text-sm text-slate-500">Loading what you wrote…</p>}
          {items && items.length === 0 && (
            <p className="text-sm text-slate-600">
              Nothing here yet. Your journal entries, reflections and notes on your plan will show up here once you write some,
              and so will steps of your plan you put in your own words, rated useful, loved or finished.
            </p>
          )}
          {items && items.length > 0 && (
            <ul className="space-y-2">
              {items.map((item) => {
                const key = itemKey(item)
                return (
                  <li key={key} className="rounded-lg border border-slate-200 p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={chosen.has(key)}
                        onChange={(e) => toggle(key, e.target.checked)}
                      />
                      <span className="space-y-1 min-w-0">
                        <span className="block text-xs text-slate-500">{item.label} · {item.date}</span>
                        <span className="block text-sm font-medium text-slate-800">{item.prompt}</span>
                        <span className="block text-sm text-slate-700 whitespace-pre-wrap break-words">{item.text}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          {items && items.length > 0 && (
            <button
              type="button"
              disabled={chosen.size === 0 || scrubbing}
              onClick={scrub}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {scrubbing ? 'Scrubbing…' : `Scrub my ${chosen.size} chosen item${chosen.size === 1 ? '' : 's'}`}
            </button>
          )}
        </section>
      )}

      {review && (
        <section aria-labelledby="check-heading" className="space-y-4">
          <div className="space-y-1">
            <h2 id="check-heading" className="text-lg font-semibold text-slate-900">2. Check</h2>
            <p className="text-sm text-slate-600">
              On the left is what you wrote; on the right is what goes in your file. Edit the right side, or remove an item.
              {namesByRecogniser
                ? ' Names were looked for with patterns and a name finder.'
                : ' Names were looked for with patterns only this time, so check names especially carefully.'}
            </p>
            <button type="button" onClick={() => { setReview(null); setDone(null) }} className="text-sm underline text-slate-600">
              ← Change what I chose
            </button>
          </div>
          {review.length === 0 && <p className="text-sm text-slate-600">Nothing left to check.</p>}
          <ul className="space-y-4">
            {review.map((item) => {
              const key = itemKey(item)
              return (
                <li key={key} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs text-slate-500">{item.label} · {item.date}</span>
                    <button
                      type="button"
                      onClick={() => setReview((current) => current && current.filter((r) => itemKey(r) !== key))}
                      className="text-sm text-red-700 underline"
                    >
                      Remove from my set
                    </button>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{item.prompt}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <span className="block text-xs font-medium text-slate-500">What you wrote</span>
                      <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-700 whitespace-pre-wrap break-words">{item.before}</p>
                    </div>
                    <label className="space-y-1 block">
                      <span className="block text-xs font-medium text-slate-500">What goes in your file</span>
                      <textarea
                        value={item.after}
                        rows={Math.min(10, Math.max(3, Math.ceil(item.after.length / 60)))}
                        onChange={(e) => update(key, { after: e.target.value, edited: true, note: undefined })}
                        onBlur={() => checkEdit(item)}
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-600" role="status">
                    {item.checking ? 'Checking your edit…' : item.note || foundSummary(item.found)}
                    {!item.after.trim() && ' Empty, so it’s left out.'}
                  </p>
                </li>
              )
            })}
          </ul>

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">3. Download</h2>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span className="text-sm text-slate-800">
                I&apos;ve read every item on the right. Nothing in them says who I am or who anyone else is.
              </span>
            </label>
            <button
              type="button"
              disabled={!confirmed || !kept.length || unchecked || saving}
              onClick={approve}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : `Approve and download ${kept.length} item${kept.length === 1 ? '' : 's'}`}
            </button>
            {unchecked && <p className="text-xs text-slate-600">Click outside the box you edited, so your edit can be checked first.</p>}
            {done && (
              <p role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
                Saved {done.file} with {done.count} example{done.count === 1 ? '' : 's'}. Your approval was recorded
                {done.at ? ` on ${new Date(done.at).toLocaleString()}` : ''}, with scrubber {version}.
              </p>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="train-heading" className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700 space-y-2">
        <h2 id="train-heading" className="text-lg font-semibold text-slate-900">Train it on your laptop</h2>
        <p>
          For a Mac with Apple silicon (M1 or newer). 16 GB of memory is best; with 8 GB the script picks a smaller model.
          It downloads a small open model the first time (a few GB), trains for about 10 to 30 minutes, and adds the result
          to Ollama so you can use it under <Link href="/settings/models" className="underline">Use my own model</Link>.
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            Download <a className="underline" href="/own-model/train-my-model.sh" download>train-my-model.sh</a> and read{' '}
            <a className="underline" href="/own-model/README.md" target="_blank" rel="noopener noreferrer">the instructions</a>.
          </li>
          <li>In a terminal: <code className="font-mono">bash train-my-model.sh ~/Downloads/my-training-set-….jsonl</code></li>
          <li>Set the model name in Use my own model to the name it prints (my-model, unless you chose another).</li>
        </ol>
        <p className="text-slate-500">
          A few dozen items change the model only a little, and a tuned model can get worse as well as better. Try it with
          Send a test prompt and keep the one you prefer. On Windows or Linux with an NVIDIA graphics card,{' '}
          <a className="underline" href="/own-model/autinerary_model.py" download>autinerary_model.py</a> tunes it and makes an
          adapter you can share; using it in Ollama there is <span className="text-slate-500">coming soon</span>.
        </p>
      </section>

      {sharing ? (
        <section aria-labelledby="share-heading" className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700 space-y-1">
          <h2 id="share-heading" className="font-semibold text-slate-900">Share it with your community</h2>
          <p>
            Once you&apos;ve trained it, you can <Link href="/settings/models/share" className="underline">share your model</Link>,
            or start from one someone else shared in <Link href="/settings/models/community" className="underline">Community models</Link>.
          </p>
        </section>
      ) : (
        <section aria-labelledby="share-heading" className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 space-y-1">
          <h2 id="share-heading" className="font-semibold text-slate-800">Share it with your community <span className="text-slate-500 font-normal">Coming soon</span></h2>
          <p>Sharing a tuned model, and starting from one someone else shared, isn&apos;t available yet.</p>
        </section>
      )}

      {records.length > 0 && (
        <section aria-labelledby="records-heading" className="text-sm text-slate-600 space-y-1">
          <h2 id="records-heading" className="font-semibold text-slate-800">What you&apos;ve approved</h2>
          <ul className="list-disc pl-5">
            {records.map((r) => (
              <li key={r.id}>
                {r.itemCount} item{r.itemCount === 1 ? '' : 's'} on {new Date(r.createdAt).toLocaleDateString()}, scrubber {r.scrubberVersion}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
