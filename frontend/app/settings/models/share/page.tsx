'use client'

/**
 * Share my model (Settings, Models): share the adapter a person tuned on their laptop, for others in their community to
 * start from (backend api/routes/adapters.py, STEP 96). Nothing is shared until every check passes: the training set
 * it came from was scrubbed and approved, the memory check (run here, against the model on their laptop) finds it
 * doesn't say its training answers back, the title and description name no one, and its files are an adapter and a
 * settings file with nothing from their computer in it (lib/sharedModels.ts). The files go up only after that, to
 * links the server signs, in a folder named after the adapter, not the person.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loadOwnModel } from '@/lib/localModel'
import { listConsents, type ConsentRecord } from '@/lib/trainingSet'
import {
  COMMUNITY_TAGS,
  MEMORY_THRESHOLD,
  type CleanConfig,
  type Checks,
  type MemoryReport,
  type ShareRequest,
  ShareError,
  checkShare,
  cleanConfig,
  createShare,
  listMine,
  memoryCheck,
  parseTrainingSet,
  publishShare,
  removeShare,
  sharingStatus,
  weightsProblem,
} from '@/lib/sharedModels'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const BUCKET = 'shared-adapters'

async function freshToken(): Promise<string | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.access_token ?? null
}

const CHECK_NAMES: Record<string, string> = {
  scrub_review: 'Your training set was scrubbed and approved',
  memorization: 'The memory check (on your computer)',
  metadata: 'The title and description name no one',
  files: 'The files are an adapter and its settings',
}

function CheckList({ checks }: { checks: Partial<Checks> }) {
  return (
    <ul className="space-y-1 text-sm" aria-label="Checks">
      {Object.entries(checks).filter(([, c]) => c).map(([key, c]) => (
        <li key={key} className={c!.passed ? 'text-emerald-800' : 'text-red-800'}>
          {c!.passed ? '✓' : '✗'} {CHECK_NAMES[key] || key}
          {!c!.passed && c!.why ? <span className="block pl-5 text-red-700">{String(c!.why)}</span> : null}
        </li>
      ))}
    </ul>
  )
}

type Mine = { id: string; title: string; status: string; createdAt: string }

export default function ShareModelPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [consentId, setConsentId] = useState('')
  const [weights, setWeights] = useState<File | null>(null)
  const [weightsIssue, setWeightsIssue] = useState<string | null>(null)
  const [config, setConfig] = useState<CleanConfig | null>(null)
  const [setText, setSetText] = useState<string | null>(null)
  const [modelName, setModelName] = useState('my-model')
  const [progress, setProgress] = useState<string | null>(null)
  const [memory, setMemory] = useState<MemoryReport | null>(null)
  const [memoryError, setMemoryError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [checks, setChecks] = useState<Partial<Checks> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState<string | null>(null)
  const [mine, setMine] = useState<Mine[]>([])

  const refreshMine = async (token: string) => {
    try {
      setMine((await listMine(API_URL, token)).adapters.map((a) => ({ id: a.id, title: a.title, status: a.status, createdAt: a.createdAt })))
    } catch {}
  }

  useEffect(() => {
    ;(async () => {
      try {
        const status = await sharingStatus(API_URL)
        setEnabled(status.enabled)
        if (!status.enabled) return
      } catch {
        setEnabled(false)
        return
      }
      const token = await freshToken()
      if (!token) {
        setSignedOut(true)
        return
      }
      const own = loadOwnModel()
      if (own.model && own.model !== 'llama3.2:3b') setModelName(own.model)
      listConsents(API_URL, token).then((r) => {
        setConsents(r.records)
        if (r.records[0]) setConsentId(r.records[0].id)
      }).catch(() => {})
      refreshMine(token)
    })()
  }, [])

  const chooseWeights = async (file: File | null) => {
    setWeights(file)
    setChecks(null)
    if (!file) return setWeightsIssue(null)
    if (file.size > 100 * 1024 * 1024) return setWeightsIssue('That file is bigger than 100 MB, so it isn’t an adapter.')
    setWeightsIssue(weightsProblem(await file.slice(0, 1024 * 1024).arrayBuffer()))
  }

  const chooseConfig = async (file: File | null) => {
    setChecks(null)
    setConfig(file ? cleanConfig(await file.text()) : null)
  }

  const runMemoryCheck = async () => {
    setMemory(null)
    setMemoryError(null)
    setChecks(null)
    try {
      const examples = parseTrainingSet(setText || '')
      const report = await memoryCheck({
        examples,
        settings: loadOwnModel(),
        model: modelName.trim(),
        onProgress: (done, total) => setProgress(`Checked ${done} of ${total} answers…`),
      })
      setMemory(report)
    } catch (e: any) {
      setMemoryError(e?.message || String(e))
    } finally {
      setProgress(null)
    }
  }

  const request = (): ShareRequest | null =>
    config?.config && memory
      ? { title: title.trim(), description: description.trim(), tags, baseModel: config.config.model, consentId, memoryCheck: memory }
      : null
  const ready = !!(request() && consentId && weights && !weightsIssue && title.trim().length >= 3)

  const check = async () => {
    const token = await freshToken()
    const body = request()
    if (!token || !body) return
    setBusy('Checking…')
    setError(null)
    try {
      setChecks((await checkShare(API_URL, token, body)).checks)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const share = async () => {
    const token = await freshToken()
    const body = request()
    if (!token || !body || !weights || !config?.config) return
    setError(null)
    try {
      setBusy('Sharing: checking again…')
      const made = await createShare(API_URL, token, body)
      setBusy('Uploading your adapter…')
      const storage = createClient().storage.from(BUCKET)
      for (const upload of made.uploads) {
        const isWeights = upload.name === 'adapters.safetensors'
        const file = isWeights ? weights : new Blob([JSON.stringify(config.config, null, 2)], { type: 'application/json' })
        // cacheControl given, or supabase-js sends the word "undefined" for it.
        const { error: uploadError } = await storage.uploadToSignedUrl(upload.path, upload.token, file, {
          contentType: isWeights ? 'application/octet-stream' : 'application/json',
          cacheControl: '3600',
        })
        if (uploadError) throw new Error(`The upload didn’t finish: ${uploadError.message}`)
      }
      setBusy('Checking the files…')
      const out = await publishShare(API_URL, token, made.id)
      setChecks(out.checks)
      setShared(made.id)
      refreshMine(token)
    } catch (e: any) {
      if (e instanceof ShareError && e.checks) setChecks(e.checks)
      setError(e.message)
      refreshMine(token)
    } finally {
      setBusy(null)
    }
  }

  const takeDown = async (id: string) => {
    const token = await freshToken()
    if (!token || !window.confirm('Take this model down? People who already downloaded it keep their copy.')) return
    try {
      await removeShare(API_URL, token, id)
      refreshMine(token)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const allPassed = !!checks && Object.values(checks).every((c) => !c || c.passed)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <Link href="/settings/models" className="text-sm text-slate-500 hover:text-slate-800">← Models</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Share my model</h1>
        <p className="text-slate-600">
          Share the adapter you tuned on your laptop (a small add-on to a small open model, a few MB), so others in your
          community can start from it. Nobody sees who shared it. <Link href="/settings/models/community" className="underline">Community models</Link>
        </p>
      </header>

      {enabled === null && <p className="text-sm text-slate-500">Loading…</p>}
      {enabled === false && (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          Sharing models isn&apos;t on yet. <span className="text-slate-500">Coming soon.</span>
        </p>
      )}
      {enabled && signedOut && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          <Link href="/login" className="underline">Sign in</Link> to share a model.
        </p>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</p>}

      {enabled && !signedOut && (
        <>
          <section aria-labelledby="set-heading" className="rounded-xl border border-slate-200 p-4 space-y-2 text-sm text-slate-700">
            <h2 id="set-heading" className="text-lg font-semibold text-slate-900">1. The training set it came from</h2>
            {consents.length === 0 ? (
              <p>
                You haven&apos;t approved a training set yet. Make one in{' '}
                <Link href="/settings/models/training-set" className="underline">Build my training set</Link> and train on it first.
              </p>
            ) : (
              <fieldset className="space-y-1">
                <legend className="sr-only">Which approved training set</legend>
                {consents.map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <input type="radio" name="consent" checked={consentId === c.id} onChange={() => { setConsentId(c.id); setChecks(null) }} />
                    {c.itemCount} items, approved {new Date(c.createdAt).toLocaleString()}
                  </label>
                ))}
              </fieldset>
            )}
          </section>

          <section aria-labelledby="files-heading" className="rounded-xl border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
            <h2 id="files-heading" className="text-lg font-semibold text-slate-900">2. Your adapter</h2>
            <p>
              Both are in the adapter folder the training script made, <code className="font-mono">~/.autinerary-model/my-model/adapter</code>{' '}
              (press Cmd+Shift+. in the file picker to see folders starting with a dot).
            </p>
            <label className="block space-y-1">
              <span className="font-medium">adapters.safetensors</span>
              <input type="file" accept=".safetensors" onChange={(e) => chooseWeights(e.target.files?.[0] || null)} className="block" />
            </label>
            {weights && <p className={weightsIssue ? 'text-red-700' : 'text-emerald-800'}>{weightsIssue || `✓ A LoRA adapter (${(weights.size / 1048576).toFixed(1)} MB)`}</p>}
            <label className="block space-y-1">
              <span className="font-medium">adapter_config.json</span>
              <input type="file" accept=".json,application/json" onChange={(e) => chooseConfig(e.target.files?.[0] || null)} className="block" />
            </label>
            {config && (
              <p className={config.problem ? 'text-red-700' : 'text-emerald-800'}>
                {config.problem || `✓ For ${config.config!.model.includes('-1B-') ? 'Llama 3.2 1B' : 'Llama 3.2 3B'}.`}
                {!config.problem && config.removed.length > 0 && (
                  <span className="block text-slate-600">
                    Only the four settings the tools need will be shared. Left out: {config.removed.join(', ')} (some have folders
                    from your computer in them).
                  </span>
                )}
              </p>
            )}
          </section>

          <section aria-labelledby="memory-heading" className="rounded-xl border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
            <h2 id="memory-heading" className="text-lg font-semibold text-slate-900">3. The memory check</h2>
            <p>
              Your model, in Ollama on this computer, is given the start of each answer in your training set and asked to go
              on. If it says the rest back closely (half or more of it, in order), it has learnt your words, not just your way
              of putting things, and it isn&apos;t shared. This runs on your computer, so the result is yours to report.
            </p>
            <label className="block space-y-1">
              <span className="font-medium">Your training set file (my-training-set-….jsonl)</span>
              <input type="file" accept=".jsonl,application/jsonl" onChange={async (e) => { const f = e.target.files?.[0]; setSetText(f ? await f.text() : null); setMemory(null) }} className="block" />
            </label>
            <label className="block space-y-1">
              <span className="font-medium">Your model&apos;s name in Ollama</span>
              <input value={modelName} onChange={(e) => setModelName(e.target.value)} className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 font-mono" />
            </label>
            <button type="button" disabled={!setText || !modelName.trim() || !!progress} onClick={runMemoryCheck}
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50">
              {progress ? 'Checking…' : 'Run the memory check'}
            </button>
            <p role="status" className="text-slate-600">{progress}</p>
            {memoryError && <p className="text-red-700">{memoryError}</p>}
            {memory && (
              <p className={memory.failed === 0 && memory.maxCloseness < MEMORY_THRESHOLD ? 'text-emerald-800' : 'text-red-700'}>
                {memory.failed === 0 && memory.maxCloseness < MEMORY_THRESHOLD
                  ? `✓ Passed: ${memory.probes} answers checked, the closest was ${memory.maxCloseness} (it fails at ${MEMORY_THRESHOLD}).`
                  : `✗ It said ${memory.failed} of ${memory.probes} answers back closely (up to ${memory.maxCloseness}). Train it again with EPOCHS=1, or with more items, then check again.`}
                {memory.skipped > 0 && <span className="block text-slate-600">{memory.skipped} answers were too short to check.</span>}
              </p>
            )}
          </section>

          <section aria-labelledby="describe-heading" className="rounded-xl border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
            <h2 id="describe-heading" className="text-lg font-semibold text-slate-900">4. Describe it</h2>
            <p>Don&apos;t put your name, or anyone&apos;s, in the title or description, or a school, a workplace or contact details.</p>
            <label className="block space-y-1">
              <span className="font-medium">Title</span>
              <input value={title} maxLength={80} onChange={(e) => { setTitle(e.target.value); setChecks(null) }} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span className="font-medium">What it&apos;s good for</span>
              <textarea value={description} maxLength={1000} rows={3} onChange={(e) => { setDescription(e.target.value); setChecks(null) }} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <fieldset className="space-y-1">
              <legend className="font-medium">Who it&apos;s for (up to 6)</legend>
              <div className="flex flex-wrap gap-2">
                {COMMUNITY_TAGS.map((t) => (
                  <label key={t.id} className="flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5">
                    <input type="checkbox" checked={tags.includes(t.id)} disabled={!tags.includes(t.id) && tags.length >= 6}
                      onChange={(e) => { setTags(e.target.checked ? [...tags, t.id] : tags.filter((x) => x !== t.id)); setChecks(null) }} />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section aria-labelledby="share-heading" className="rounded-xl border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
            <h2 id="share-heading" className="text-lg font-semibold text-slate-900">5. Check and share</h2>
            {!ready && <p className="text-slate-600">Finish the steps above first.</p>}
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={!ready || !!busy} onClick={check} className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50">
                Check
              </button>
              <button type="button" disabled={!ready || !allPassed || !!busy || !!shared} onClick={share}
                className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">
                Share it
              </button>
            </div>
            {busy && <p role="status" className="text-slate-600">{busy}</p>}
            {checks && <CheckList checks={checks} />}
            {shared && (
              <p role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-900">
                Shared. It&apos;s on <Link href="/settings/models/community" className="underline">Community models</Link> now. Thank you.
              </p>
            )}
          </section>

          {mine.length > 0 && (
            <section aria-labelledby="mine-heading" className="space-y-2 text-sm text-slate-700">
              <h2 id="mine-heading" className="font-semibold text-slate-900">Models you&apos;ve shared</h2>
              <ul className="space-y-1">
                {mine.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <span>{m.title}</span>
                    <span className="text-xs text-slate-500">
                      {m.status === 'approved' ? 'shared' : m.status === 'pending' ? 'not shared yet (a check didn’t pass, or the upload didn’t finish)' : m.status}
                    </span>
                    <button type="button" onClick={() => takeDown(m.id)} className="text-xs text-red-700 underline">Take it down</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}
