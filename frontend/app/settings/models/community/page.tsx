'use client'

/**
 * Community models (Settings, Models): starter models people shared (backend api/routes/adapters.py, STEP 96), the
 * best for you first: how much of each model's community you're part of (from what you told us at setup: your norms,
 * who you're here for, your goals' areas), then its rating from people like you. Models shared with you by your
 * people, and one opened from a private link (?key=). Each says what it was built on, so you can see which models came
 * from which. Ratings and reports use ResourceHub's components (StarRating, ReportButton); reports go to its
 * moderation queue. And how to adopt one and tune it a little with your own writing.
 */

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import StarRating from '@/app/components/StarRating'
import ReportButton from '@/app/components/ReportButton'
import { createClient } from '@/lib/supabase/client'
import {
  SharedAdapter,
  baseModelLabel,
  byLink,
  downloadLinks,
  listShared,
  rateShared,
  reportShared,
  sharingStatus,
  slugOf,
  tagLabel,
} from '@/lib/sharedModels'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function freshToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

function Adopt({ adapter, linkKey }: { adapter: SharedAdapter; linkKey: string | null }) {
  const [files, setFiles] = useState<{ name: string; url: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const slug = slugOf(adapter.title)
  const weights = files?.[0]?.name || `${slug}.safetensors`
  const get = async () => {
    setError(null)
    try {
      setFiles((await downloadLinks(API_URL, await freshToken(), adapter.id, linkKey)).files)
    } catch (e: any) {
      setError(e.message)
    }
  }
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
      <p className="font-medium text-slate-900">Adopt it, and tune it a little</p>
      <p>On a Mac with Apple silicon, with Ollama. It all happens on your computer.</p>
      <ol className="list-decimal pl-5 space-y-2">
        <li>
          {files ? (
            <span className="block space-y-1">
              Download both files (the links work for ten minutes):
              {files.map((f) => (
                <a key={f.name} href={f.url} download={f.name} className="block underline font-mono text-xs break-all">{f.name}</a>
              ))}
            </span>
          ) : (
            <button type="button" onClick={get} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium">
              Get the files
            </button>
          )}
          {error && <span className="block text-red-700">{error}</span>}
        </li>
        <li>
          Get the model it starts from: <code className="font-mono">ollama pull {adapter.ollamaBase || 'llama3.2:3b'}</code>
        </li>
        <li>
          Mac: download <a className="underline" href="/own-model/use-shared-model.sh" download>use-shared-model.sh</a> and run{' '}
          <code className="font-mono break-all">bash use-shared-model.sh ~/Downloads/{weights} {slug}</code>. It puts the adapter
          with the model it starts from and adds it to Ollama as {slug}. Windows and Linux:{' '}
          <span className="text-slate-500">coming soon</span> (Ollama there can&apos;t add a tuned model without a converter yet).
        </li>
        <li>
          To tune it a little with your own writing, approve some items in{' '}
          <Link href="/settings/models/training-set" className="underline">Build my training set</Link>, then run{' '}
          <code className="font-mono break-all">FROM_ADAPTER=~/Downloads/{weights} bash train-my-model.sh ~/Downloads/my-training-set-….jsonl my-{slug}</code>{' '}
          on a Mac (<a className="underline" href="/own-model/train-my-model.sh" download>train-my-model.sh</a>), or on a Windows or
          Linux computer with an NVIDIA card,{' '}
          <code className="font-mono break-all">python autinerary_model.py train Downloads/my-training-set-….jsonl my-{slug} --from Downloads/{weights}</code>{' '}
          (<a className="underline" href="/own-model/autinerary_model.py" download>autinerary_model.py</a>; it makes an adapter you
          can share, and using it in Ollama there is coming soon). It starts from this adapter and goes through your set once. If
          you share yours, it will say it was built on this one.
        </li>
        <li>
          In <Link href="/settings/models" className="underline">Use my own model</Link>, set the model name to {slug} (or my-{slug}) and
          send a test prompt.
        </li>
      </ol>
    </div>
  )
}

function Card({ adapter, signedIn, linkKey, onRated }: {
  adapter: SharedAdapter
  signedIn: boolean
  linkKey: string | null
  onRated: (id: string, change: Partial<SharedAdapter>) => void
}) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rate = async (rating: number) => {
    const token = await freshToken()
    if (!token) return
    setError(null)
    try {
      const out = await rateShared(API_URL, token, adapter.id, rating, linkKey)
      onRated(adapter.id, { rating: out.rating, ratingForYou: out.ratingForYou, myRating: out.myRating })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch (e: any) {
      setError(e.message)
    }
  }
  return (
    <li id={`model-${adapter.id}`} className="rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{adapter.title}</h2>
        {signedIn && !adapter.mine && (
          <ReportButton what="model" onReport={async (reason) => { await reportShared(API_URL, (await freshToken()) || '', adapter.id, reason, linkKey) }} />
        )}
      </div>
      {adapter.match.shared.length > 0 && (
        <p className="text-sm font-medium text-emerald-800">Matches you: {adapter.match.shared.map(tagLabel).join(', ')}</p>
      )}
      {adapter.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Community tags">
          {adapter.tags.map((t) => (
            <li key={t} className={`rounded-full px-2 py-0.5 text-xs ${adapter.match.shared.includes(t) ? 'bg-emerald-100 text-emerald-900' : 'bg-indigo-50 text-indigo-900'}`}>
              {tagLabel(t)}
            </li>
          ))}
        </ul>
      )}
      {adapter.description && <p className="text-sm text-slate-700 whitespace-pre-wrap">{adapter.description}</p>}
      <p className="text-xs text-slate-500">
        Starts from {baseModelLabel(adapter.baseModel)}
        {adapter.checks.trainedOn ? ` · trained on ${adapter.checks.trainedOn} approved items` : ''}
        {typeof adapter.checks.memoryCheck === 'number' ? ` · memory check ${adapter.checks.memoryCheck} (it fails at 0.5)` : ''}
        {adapter.mine ? ' · shared by you' : ''}
      </p>
      {(adapter.builtOn || adapter.builtOnCount > 0) && (
        <p className="text-xs text-slate-600">
          {adapter.builtOn && (adapter.builtOn.title
            ? <>Built on <a href={`#model-${adapter.builtOn.id}`} className="underline">{adapter.builtOn.title}</a>. </>
            : <>Built on a model that isn&apos;t shared with you. </>)}
          {adapter.builtOnCount > 0 && <>{adapter.builtOnCount} model{adapter.builtOnCount === 1 ? '' : 's'} here {adapter.builtOnCount === 1 ? 'was' : 'were'} built on this one.</>}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600" aria-label={adapter.rating.count ? `Rated ${adapter.rating.average} out of 5 by ${adapter.rating.count}` : 'No ratings yet'}>
          {adapter.rating.count ? (
            <>
              <StarRating value={adapter.rating.average || 0} onChange={() => {}} interactive={false} size="sm" />
              <span>({adapter.rating.count} rating{adapter.rating.count === 1 ? '' : 's'})</span>
            </>
          ) : (
            <span>No ratings yet</span>
          )}
        </div>
        {typeof adapter.ratingForYou === 'number' && adapter.rating.count > 0 && (
          <span className="text-sm text-slate-700">People like you: {adapter.ratingForYou} out of 5</span>
        )}
        {signedIn && !adapter.mine && (
          <div className="text-sm text-slate-700 flex items-center gap-2">
            <StarRating value={adapter.myRating || 0} onChange={rate} size="md" label="Your rating" />
            {saved && <span role="status" className="text-xs text-emerald-700">Saved</span>}
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
        Adopt and tune a little
      </button>
      {open && <Adopt adapter={adapter} linkKey={linkKey} />}
    </li>
  )
}

function CommunityModels() {
  const params = useSearchParams()
  const linkKey = params.get('key')
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [adapters, setAdapters] = useState<SharedAdapter[]>([])
  const [sharedWithMe, setSharedWithMe] = useState<SharedAdapter[]>([])
  const [linked, setLinked] = useState<SharedAdapter | null>(null)
  const [forYou, setForYou] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const status = await sharingStatus(API_URL)
        setEnabled(status.enabled)
        if (!status.enabled) return
        const token = await freshToken()
        setSignedIn(!!token)
        const listed = await listShared(API_URL, token)
        setAdapters(listed.adapters)
        setSharedWithMe(listed.sharedWithMe)
        setForYou(listed.forYou)
        if (linkKey) setLinked((await byLink(API_URL, token, linkKey)).adapter)
      } catch (e: any) {
        setEnabled((current) => current ?? false)
        setError(e.message)
      }
    })()
  }, [linkKey])

  const changed = (id: string, change: Partial<SharedAdapter>) => {
    const apply = (list: SharedAdapter[]) => list.map((a) => (a.id === id ? { ...a, ...change } : a))
    setAdapters(apply)
    setSharedWithMe(apply)
    setLinked((current) => (current && current.id === id ? { ...current, ...change } : current))
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <Link href="/settings/models" className="text-sm text-slate-500 hover:text-slate-800">← Models</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Community models</h1>
        <p className="text-slate-600">
          Starter models people in the community tuned from their own writing and shared, for a small open model on your
          device. A model shared with everyone doesn&apos;t say who shared it, and nobody who shares one sees who uses it.
        </p>
      </header>

      {enabled === null && <p className="text-sm text-slate-500">Loading…</p>}
      {enabled === false && (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          Sharing models isn&apos;t on yet. <span className="text-slate-500">Coming soon.</span>
        </p>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</p>}

      {enabled && (
        <>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            Each one passed our checks before it was shared: it was trained on a set its owner scrubbed and approved, its
            title and description name no one, and its owner&apos;s memory check found it doesn&apos;t say its training
            answers back. That check runs on the owner&apos;s computer, where the model is, so it&apos;s their report.
            Report anything that looks wrong. <Link href="/settings/models/share" className="underline">Share yours</Link>
          </p>

          {linked && (
            <section aria-labelledby="link-heading" className="space-y-3">
              <h2 id="link-heading" className="text-lg font-semibold text-slate-900">Shared with you by link</h2>
              <ul className="space-y-4"><Card adapter={linked} signedIn={signedIn} linkKey={linkKey} onRated={changed} /></ul>
            </section>
          )}

          {sharedWithMe.length > 0 && (
            <section aria-labelledby="shared-heading" className="space-y-3">
              <h2 id="shared-heading" className="text-lg font-semibold text-slate-900">Shared with you</h2>
              <p className="text-sm text-slate-600">By your people in Hare World.</p>
              <ul className="space-y-4">
                {sharedWithMe.map((a) => <Card key={a.id} adapter={a} signedIn={signedIn} linkKey={null} onRated={changed} />)}
              </ul>
            </section>
          )}

          <section aria-labelledby="everyone-heading" className="space-y-3">
            <h2 id="everyone-heading" className="text-lg font-semibold text-slate-900">{forYou ? 'Recommended for you' : 'Shared with everyone'}</h2>
            {forYou && (
              <p className="text-sm text-slate-600">
                First the ones whose community you&apos;re most part of, from what you told us at setup, then the ones people
                like you rated highest.
              </p>
            )}
            {adapters.length === 0 && <p className="text-sm text-slate-600">Nobody has shared a model with everyone yet.</p>}
            <ul className="space-y-4">
              {adapters.map((a) => <Card key={a.id} adapter={a} signedIn={signedIn} linkKey={null} onRated={changed} />)}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}

export default function CommunityModelsPage() {
  // useSearchParams needs a Suspense boundary in a static page.
  return (
    <Suspense fallback={<main className="max-w-3xl mx-auto px-4 py-8"><p className="text-sm text-slate-500">Loading…</p></main>}>
      <CommunityModels />
    </Suspense>
  )
}
