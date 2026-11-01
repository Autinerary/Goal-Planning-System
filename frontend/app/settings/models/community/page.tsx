'use client'

/**
 * Community models (Settings, Models): starter models people shared (backend api/routes/adapters.py, STEP 96), with
 * their ratings, tags and a report button, and how to adopt one and tune it a little with your own writing.
 * Ratings and reports use ResourceHub's components (StarRating, ReportButton); reports go to its moderation queue.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import StarRating from '@/app/components/StarRating'
import ReportButton from '@/app/components/ReportButton'
import { createClient } from '@/lib/supabase/client'
import { SharedAdapter, downloadLinks, listShared, rateShared, reportShared, sharingStatus, slugOf, tagLabel } from '@/lib/sharedModels'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function freshToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

const sizeOf = (baseModel: string) => (baseModel.includes('-1B-') ? 'Llama 3.2 1B' : 'Llama 3.2 3B')

function Adopt({ adapter }: { adapter: SharedAdapter }) {
  const [files, setFiles] = useState<{ name: string; url: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const slug = slugOf(adapter.title)
  const weights = files?.[0]?.name || `${slug}.safetensors`
  const get = async () => {
    setError(null)
    try {
      setFiles((await downloadLinks(API_URL, await freshToken(), adapter.id)).files)
    } catch (e: any) {
      setError(e.message)
    }
  }
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
      <p className="font-medium text-slate-900">Adopt it, and tune it a little</p>
      <p>For a Mac with Apple silicon, with Ollama. It all happens on your computer.</p>
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
          Download <a className="underline" href="/own-model/use-shared-model.sh" download>use-shared-model.sh</a> and run{' '}
          <code className="font-mono break-all">bash use-shared-model.sh ~/Downloads/{weights} {slug}</code>. It puts the
          adapter with the model it starts from and adds it to Ollama as {slug}.
        </li>
        <li>
          To tune it a little with your own writing, approve some items in{' '}
          <Link href="/settings/models/training-set" className="underline">Build my training set</Link>, then run{' '}
          <code className="font-mono break-all">FROM_ADAPTER=~/Downloads/{weights} bash train-my-model.sh ~/Downloads/my-training-set-….jsonl my-{slug}</code>{' '}
          (<a className="underline" href="/own-model/train-my-model.sh" download>train-my-model.sh</a>). It starts from this
          adapter and goes through your set once.
        </li>
        <li>
          In <Link href="/settings/models" className="underline">Use my own model</Link>, set the model name to {slug} (or my-{slug}) and
          send a test prompt.
        </li>
      </ol>
    </div>
  )
}

export default function CommunityModelsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [adapters, setAdapters] = useState<SharedAdapter[]>([])
  const [signedIn, setSignedIn] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const status = await sharingStatus(API_URL)
        setEnabled(status.enabled)
        if (!status.enabled) return
        const token = await freshToken()
        setSignedIn(!!token)
        setAdapters((await listShared(API_URL, token)).adapters)
      } catch (e: any) {
        setEnabled(false)
        setError(e.message)
      }
    })()
  }, [])

  const rate = async (adapter: SharedAdapter, rating: number) => {
    const token = await freshToken()
    if (!token) return
    setError(null)
    try {
      const out = await rateShared(API_URL, token, adapter.id, rating)
      setAdapters((current) => current.map((a) => (a.id === adapter.id ? { ...a, rating: out.rating, myRating: out.myRating } : a)))
      setSaved(adapter.id)
      window.setTimeout(() => setSaved(null), 1500)
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <Link href="/settings/models" className="text-sm text-slate-500 hover:text-slate-800">← Models</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Community models</h1>
        <p className="text-slate-600">
          Starter models people in the community tuned from their own writing and shared, for a small open model on your
          device. You won&apos;t see who shared one, and they won&apos;t see who uses it.
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
            Each one passed our checks before it was listed: it was trained on a set its owner scrubbed and approved, its
            title and description name no one, and its owner&apos;s memory check found it doesn&apos;t say its training
            answers back. That check runs on the owner&apos;s computer, where the model is, so it&apos;s their report.
            Report anything that looks wrong. <Link href="/settings/models/share" className="underline">Share yours</Link>
          </p>
          {adapters.length === 0 && <p className="text-sm text-slate-600">Nobody has shared a model yet.</p>}
          <ul className="space-y-4">
            {adapters.map((adapter) => (
              <li key={adapter.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">{adapter.title}</h2>
                  {signedIn && !adapter.mine && (
                    <ReportButton what="model" onReport={async (reason) => { await reportShared(API_URL, (await freshToken()) || '', adapter.id, reason) }} />
                  )}
                </div>
                {adapter.tags.length > 0 && (
                  <ul className="flex flex-wrap gap-1" aria-label="Community tags">
                    {adapter.tags.map((t) => (
                      <li key={t} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-900">{tagLabel(t)}</li>
                    ))}
                  </ul>
                )}
                {adapter.description && <p className="text-sm text-slate-700 whitespace-pre-wrap">{adapter.description}</p>}
                <p className="text-xs text-slate-500">
                  Starts from {sizeOf(adapter.baseModel)}
                  {adapter.checks.trainedOn ? ` · trained on ${adapter.checks.trainedOn} approved items` : ''}
                  {typeof adapter.checks.memoryCheck === 'number' ? ` · memory check ${adapter.checks.memoryCheck} (it fails at 0.5)` : ''}
                  {adapter.mine ? ' · shared by you' : ''}
                </p>
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
                  {signedIn && !adapter.mine && (
                    <div className="text-sm text-slate-700 flex items-center gap-2">
                      <StarRating value={adapter.myRating || 0} onChange={(r) => rate(adapter, r)} size="sm" label="Your rating" />
                      {saved === adapter.id && <span role="status" className="text-xs text-emerald-700">Saved</span>}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  aria-expanded={open === adapter.id}
                  onClick={() => setOpen(open === adapter.id ? null : adapter.id)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Adopt and tune a little
                </button>
                {open === adapter.id && <Adopt adapter={adapter} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
