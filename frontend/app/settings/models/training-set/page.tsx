'use client'

/**
 * "Build my training set" (Settings, Models): choose your own journal entries, reflections and plan notes, check
 * them scrubbed beside what you wrote, and download them to train a small open model on your own laptop.
 *
 * Nothing is chosen until the person turns it on. The backend reads only their own items, scrubs them in memory and
 * keeps nothing but a record of what they approved (backend/api/routes/training.py, STEP 95). Then, with one button,
 * their model is tuned right here, in this browser, and kept in it (lib/tunedModels.ts, lib/tune/); or the file is
 * made here (lib/trainingSet.ts) and trained on their laptop (public/own-model/).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ConsentRecord,
  ScrubbedItem,
  TrainingItem,
  chatExample,
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
import { byLink, downloadLinks, listShared, sharingStatus } from '@/lib/sharedModels'
import { hasWebGPU } from '@/lib/browserModel'
import { loadOwnModel, saveOwnModel } from '@/lib/localModel'
import { SharedStart, TuneHandle, TunedModel, forgetTunedModel, tuneInThisBrowser, tunedLabel } from '@/lib/tunedModels'
import type { Progress } from '@/lib/tune/run'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Review = ScrubbedItem & { edited: boolean; checking: boolean; note?: string }

/** Where tuning is, in words. */
function progressWords(p: Progress): string {
  const mb = (n: number) => Math.round(n / 1e6).toLocaleString()
  switch (p.stage) {
    case 'download':
      return `Getting the model it starts from: ${mb(p.done)} of ${mb(p.total)} MB (the first time only; it stays in this browser).`
    case 'read':
      return `Reading your items: ${p.done} of ${p.total}.`
    case 'train':
      return `Tuning: step ${p.done} of ${p.total}.`
    case 'save':
      return `Saving your model in this browser: ${p.done} of ${p.total}.`
  }
}

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
  const [canTune, setCanTune] = useState(true)
  const [tuning, setTuning] = useState<TuneHandle | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [tuned, setTuned] = useState<TunedModel | null>(null)
  const [tuneNote, setTuneNote] = useState<string | null>(null)
  const [using, setUsing] = useState(false)
  // A shared model to start from (Community models, "Tune it with my own items": ?from=<id>, &key= for a private link).
  const [fromShared, setFromShared] = useState<{ id: string; title: string; key: string | null } | null>(null)

  useEffect(() => {
    setCanTune(hasWebGPU())
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
      const params = new URLSearchParams(window.location.search)
      const from = params.get('from'), key = params.get('key')
      if (from) {
        ;(key ? byLink(API_URL, token, key).then((r) => [r.adapter]) : listShared(API_URL, token).then((r) => [...r.adapters, ...r.sharedWithMe]))
          .then((list) => {
            const shared = list.find((a) => a.id === from && a.browserBase)
            if (shared) setFromShared({ id: shared.id, title: shared.title, key })
          })
          .catch(() => {})
      }
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

  /** Your approval recorded (which items, when, with which scrubber; never their text), then the file or the tuning. */
  const approve = async (then: 'download' | 'tune') => {
    const token = await freshToken()
    if (!token || !review || !kept.length || unchecked || !confirmed) return
    setSaving(true)
    setError(null)
    setTuneNote(null)
    try {
      const record = await recordConsent(API_URL, token, kept, version)
      setRecords((current) => [
        { id: record.id, createdAt: record.createdAt, itemCount: record.itemCount, scrubberVersion: record.scrubberVersion },
        ...current,
      ])
      if (then === 'download') {
        const file = trainingFileName()
        download(toJsonl(kept), file)
        setDone({ file, count: kept.length, at: record.createdAt })
      } else {
        startTuning(record.id)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Tuned here, in a worker on this device's graphics chip: the approved items never leave this browser.
  const startTuning = async (consentId: string) => {
    setTuned(null)
    setProgress(null)
    let startFrom: SharedStart | null = null
    if (fromShared) {
      try {
        const links = await downloadLinks(API_URL, await freshToken(), fromShared.id, fromShared.key)
        const url = links.files.find((f) => f.name.endsWith('.safetensors'))?.url
        const res = url ? await fetch(url) : null
        if (!res?.ok) throw new Error()
        startFrom = { id: fromShared.id, title: fromShared.title, weights: await res.arrayBuffer() }
      } catch {
        setTuneNote(`“${fromShared.title}” couldn’t be downloaded just now, so nothing was tuned. Try again.`)
        return
      }
    }
    const handle = tuneInThisBrowser(kept.map((item) => chatExample(item).messages as any), setProgress, { consentId, startFrom })
    setTuning(handle)
    handle.done
      .then((model) => setTuned(model))
      .catch((e: any) => setTuneNote(e?.cancelled ? 'Stopped. Nothing was kept.' : `Your model couldn’t be tuned here: ${e?.message || e}`))
      .finally(() => {
        setTuning(null)
        setProgress(null)
      })
  }

  const useTuned = (model: TunedModel) => {
    saveOwnModel({ ...loadOwnModel(), enabled: true, runtime: 'browser', browserModel: model.id })
    setUsing(true)
  }

  const forget = async (model: TunedModel) => {
    await forgetTunedModel(model.id)
    const settings = loadOwnModel()
    if (settings.browserModel === model.id) saveOwnModel({ ...settings, enabled: false })
    setTuned(null)
    setUsing(false)
    setTuneNote('Your tuned model was taken out of this browser.')
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
          tune a small open model to how you talk about your steps. It&apos;s tuned on your own device, here in this
          browser or on your laptop, never on our servers.
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
            <span className="font-medium">Approve.</span> With one button your model is tuned here, in this browser, and kept
            in it. Or download the file to train on your laptop. Either way we keep only a record that you approved these
            items: which ones, when, and the scrubber&apos;s version. Never their text.
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
            <h2 className="text-lg font-semibold text-slate-900">3. Approve</h2>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span className="text-sm text-slate-800">
                I&apos;ve read every item on the right. Nothing in them says who I am or who anyone else is.
              </span>
            </label>
            <p className="text-sm text-slate-700">
              Tuning here downloads a small open model once (Qwen3 0.6B, which thinks first; 1.2 GB) and tunes it on this
              device&apos;s graphics chip, which takes a few minutes. Your items never leave this browser, and neither does
              your model: it&apos;s kept here, for you alone.
            </p>
            {fromShared && (
              <p className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-900">
                It starts from &ldquo;{fromShared.title}&rdquo; (Community models), and goes through your items once. If you
                share yours, it will say it was built on that one.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!confirmed || !kept.length || unchecked || saving || !!tuning || !canTune}
                onClick={() => approve('tune')}
                className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {tuning ? 'Tuning…' : `Approve and tune my model here (${kept.length} item${kept.length === 1 ? '' : 's'})`}
              </button>
              <button
                type="button"
                disabled={!confirmed || !kept.length || unchecked || saving || !!tuning}
                onClick={() => approve('download')}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
              >
                {saving ? 'Saving…' : `Approve and download ${kept.length} item${kept.length === 1 ? '' : 's'} instead`}
              </button>
            </div>
            {!canTune && (
              <p className="text-xs text-slate-700">
                This browser can&apos;t tune a model (it has no WebGPU). Try a recent Chrome or Edge, or Safari 26, or download
                the items and train on your laptop.
              </p>
            )}
            {unchecked && <p className="text-xs text-slate-600">Click outside the box you edited, so your edit can be checked first.</p>}
            {tuning && (
              <div className="space-y-2" role="status" aria-live="polite">
                <p className="text-sm text-slate-800">{progress ? progressWords(progress) : 'Starting…'}</p>
                <progress className="w-full" max={progress?.total || 1} value={progress?.done || 0} aria-label="Tuning progress" />
                <button type="button" onClick={() => tuning.cancel()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                  Stop
                </button>
              </div>
            )}
            {tuneNote && <p role="status" className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-800">{tuneNote}</p>}
            {tuned && (
              <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 space-y-2">
                <p>
                  <span className="font-semibold">{tunedLabel(tuned)}</span> is ready, kept in this browser.
                  {tuned.lossBefore !== null && tuned.lossAfter !== null && (
                    <> On the {tuned.heldOut} item{tuned.heldOut === 1 ? '' : 's'} held back to check it, it now fits your
                      answers {tuned.lossAfter < tuned.lossBefore ? 'better' : 'no better'} (from {tuned.lossBefore} to {tuned.lossAfter}; lower is closer).</>
                  )}
                </p>
                {using ? (
                  <p>
                    It&apos;s your own model now: plans and everything else that writes with AI use it. Change that in{' '}
                    <Link href="/settings/models" className="underline">Use my own model</Link>.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => useTuned(tuned)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800">
                      Use it as my own model
                    </button>
                    <button type="button" onClick={() => forget(tuned)} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm">
                      Take it out of this browser
                    </button>
                  </div>
                )}
              </div>
            )}
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
        <h2 id="train-heading" className="text-lg font-semibold text-slate-900">Or train it on your laptop</h2>
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
          <a className="underline" href="/own-model/autinerary_model.py" download>autinerary_model.py</a> tunes it, makes an
          adapter you can share, and runs it for Autinerary: <code className="font-mono">python autinerary_model.py serve my-model</code>,
          then use the address <code className="font-mono">http://localhost:11435/v1</code> in Use my own model.
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
          <h2 id="share-heading" className="font-semibold text-slate-800">Share it with your community</h2>
          <p>Sharing a tuned model, and starting from one someone else shared, is switched off for now.</p>
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
