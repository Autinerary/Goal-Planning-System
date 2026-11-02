'use client'

/**
 * Share my model (Settings, Models): share the adapter a person tuned on their computer, with everyone, with people
 * they pick, or by private link (backend api/routes/adapters.py, STEP 96). Nothing is shared until every check passes:
 * the training set it came from was scrubbed and approved; the memory check (run here, against the model on their
 * computer) finds it doesn't say its training answers back; the title and description name no one; shared with
 * everyone, enough people share its tags that they can't point to its owner; the people are the owner's own; the
 * model it was built on is shared; and its files are an adapter and a settings file with nothing from their computer
 * in it (lib/sharedModels.ts). The files go up only after that, to links the server signs, in a folder named after the
 * adapter, not the person.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loadOwnModel } from '@/lib/localModel'
import { listConsents, type ConsentRecord } from '@/lib/trainingSet'
import {
  BASE_FAMILIES,
  COMMUNITY_TAGS,
  MAX_TAGS,
  MEMORY_THRESHOLD,
  type CleanConfig,
  type Checks,
  type MemoryReport,
  type MyShared,
  type ShareRequest,
  type Visibility,
  ShareError,
  baseModelLabel,
  checkShare,
  cleanConfig,
  createShare,
  linkFor,
  listMine,
  listPeople,
  listShared,
  memoryCheck,
  parseTrainingSet,
  publishShare,
  removeShare,
  sharedConfig,
  sharingStatus,
  tagLabel,
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
  crowd: 'Its tags don’t point to you',
  audience: 'The people you picked are your people',
  lineage: 'The model it was built on is shared',
  files: 'The files are an adapter and its settings',
}

const VISIBILITY_TEXT: Record<Visibility, string> = {
  everyone: 'Everyone',
  people: 'People you picked',
  link: 'Anyone with the link',
}

function CheckList({ checks }: { checks: Partial<Checks> }) {
  return (
    <ul className="space-y-1 text-sm" aria-label="Checks">
      {Object.entries(checks).filter(([, c]) => c && c.applies !== false).map(([key, c]) => (
        <li key={key} className={c!.passed ? 'text-emerald-800' : 'text-red-800'}>
          {c!.passed ? '✓' : '✗'} {CHECK_NAMES[key] || key}
          {!c!.passed && c!.why ? <span className="block pl-5 text-red-700">{String(c!.why)}</span> : null}
        </li>
      ))}
    </ul>
  )
}

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
  const [visibility, setVisibility] = useState<Visibility>('everyone')
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [checks, setChecks] = useState<Partial<Checks> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState<{ id: string; visibility: Visibility; link: string | null } | null>(null)
  const [copied, setCopied] = useState(false)
  const [mine, setMine] = useState<MyShared[]>([])
  const [origin, setOrigin] = useState('')

  const refreshMine = async (token: string) => {
    try {
      setMine((await listMine(API_URL, token)).adapters)
    } catch {}
  }

  useEffect(() => {
    setOrigin(window.location.origin)
    ;(async () => {
      try {
        const status = await sharingStatus(API_URL)
        setEnabled(status.enabled)
        if (!status.enabled) return
      } catch {
        setEnabled(false)
        setError('Sharing couldn’t be reached just now. Please try again in a moment.')
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
      listPeople(API_URL, token).then((r) => setPeople(r.people)).catch(() => {})
      // The titles of models shared with them, to name the one theirs was built on.
      listShared(API_URL, token).then((r) => setTitles(Object.fromEntries([...r.adapters, ...r.sharedWithMe].map((a) => [a.id, a.title])))).catch(() => {})
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
    setMemory(null)
    setConfig(file ? cleanConfig(await file.text()) : null)
  }

  const family = config?.config ? BASE_FAMILIES[config.config.model] ?? 'llama3' : null

  const runMemoryCheck = async () => {
    setMemory(null)
    setMemoryError(null)
    setChecks(null)
    try {
      const report = await memoryCheck({
        examples: parseTrainingSet(setText || ''),
        settings: loadOwnModel(),
        model: modelName.trim(),
        family: family ?? 'llama3',
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
      ? { title: title.trim(), description: description.trim(), tags, baseModel: config.config.model, consentId, memoryCheck: memory,
          visibility, people: visibility === 'people' ? picked : [], builtOn: config.builtOn }
      : null
  const ready = !!(request() && consentId && weights && !weightsIssue && title.trim().length >= 3 && (visibility !== 'people' || picked.length))

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
        // The settings file that goes up: the four settings, this model's own id, and what it was built on.
        const file = isWeights ? weights : new Blob([JSON.stringify(sharedConfig(config.config, made.id, config.builtOn), null, 2)], { type: 'application/json' })
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
      setShared({ id: made.id, visibility: out.visibility, link: out.linkKey ? linkFor(origin, out.linkKey) : null })
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

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const allPassed = !!checks && Object.values(checks).every((c) => !c || c.passed)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <Link href="/settings/models" className="text-sm text-slate-500 hover:text-slate-800">← Models</Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Share my model</h1>
        <p className="text-slate-600">
          Share the adapter you tuned on your computer (a small add-on to a small open model, a few MB), so others in your
          community can start from it. <Link href="/settings/models/community" className="underline">Community models</Link>
        </p>
      </header>

      {enabled === null && <p className="text-sm text-slate-500">Loading…</p>}
      {enabled === false && !error && (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          Sharing models is switched off for now.
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
              (on a Mac, press Cmd+Shift+. in the file picker to see folders starting with a dot).
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
              <div className={config.problem ? 'text-red-700' : 'text-emerald-800'}>
                {config.problem || `✓ For ${baseModelLabel(config.config!.model)}.`}
                {!config.problem && config.removed.length > 0 && (
                  <span className="block text-slate-600">
                    Only the settings the tools need will be shared. Left out: {config.removed.join(', ')} (some have folders
                    from your computer in them).
                  </span>
                )}
                {config.builtOn && (
                  <span className="block text-slate-700">
                    Built on {titles[config.builtOn] ? <>&ldquo;{titles[config.builtOn]}&rdquo;</> : 'a model from Community models'}: it will say so.
                  </span>
                )}
              </div>
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
            <button type="button" disabled={!setText || !modelName.trim() || !family || !!progress} onClick={runMemoryCheck}
              className="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50">
              {progress ? 'Checking…' : 'Run the memory check'}
            </button>
            {!family && <p className="text-slate-600">Choose the adapter&apos;s settings file above first, so the check uses its model&apos;s format.</p>}
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
              <legend className="font-medium">Who it&apos;s for (up to {MAX_TAGS})</legend>
              <p className="text-slate-600">People are matched to models by these and by what they told us at setup. Fewer tags keep you harder to pick out.</p>
              <div className="flex flex-wrap gap-2">
                {COMMUNITY_TAGS.map((t) => (
                  <label key={t.id} className="flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5">
                    <input type="checkbox" checked={tags.includes(t.id)} disabled={!tags.includes(t.id) && tags.length >= MAX_TAGS}
                      onChange={(e) => { setTags(e.target.checked ? [...tags, t.id] : tags.filter((x) => x !== t.id)); setChecks(null) }} />
                    {t.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section aria-labelledby="who-heading" className="rounded-xl border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
            <h2 id="who-heading" className="text-lg font-semibold text-slate-900">5. Who can see it</h2>
            <fieldset className="space-y-2">
              <legend className="sr-only">Who can see it</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="visibility" className="mt-1" checked={visibility === 'everyone'} onChange={() => { setVisibility('everyone'); setChecks(null) }} />
                <span><span className="font-medium">Everyone.</span> Listed in Community models, without your name. Only if at least 5 people here share all of its tags, so they can&apos;t point to you.</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="visibility" className="mt-1" checked={visibility === 'people'} onChange={() => { setVisibility('people'); setChecks(null) }} />
                <span><span className="font-medium">People I pick.</span> Only your people in Hare World that you choose. They&apos;ll know it&apos;s yours, so this is less anonymous.</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="visibility" className="mt-1" checked={visibility === 'link'} onChange={() => { setVisibility('link'); setChecks(null) }} />
                <span><span className="font-medium">Anyone with the link.</span> Not listed. Whoever you give the link to can use it, and so can anyone they pass it on to.</span>
              </label>
            </fieldset>
            {visibility === 'people' && (
              people.length === 0 ? (
                <p className="text-slate-600">You haven&apos;t connected with anyone in Hare World yet.</p>
              ) : (
                <fieldset className="space-y-1" aria-label="Your people">
                  {people.map((p) => (
                    <label key={p.id} className="flex items-center gap-2">
                      <input type="checkbox" checked={picked.includes(p.id)}
                        onChange={(e) => { setPicked(e.target.checked ? [...picked, p.id] : picked.filter((x) => x !== p.id)); setChecks(null) }} />
                      {p.name}
                    </label>
                  ))}
                </fieldset>
              )
            )}
          </section>

          <section aria-labelledby="share-heading" className="rounded-xl border border-slate-200 p-4 space-y-3 text-sm text-slate-700">
            <h2 id="share-heading" className="text-lg font-semibold text-slate-900">6. Check and share</h2>
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
              <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-900 space-y-2">
                {shared.visibility === 'everyone' && <p>Shared. It&apos;s on <Link href="/settings/models/community" className="underline">Community models</Link> now. Thank you.</p>}
                {shared.visibility === 'people' && <p>Shared with the people you picked. It&apos;s in their Community models, under Shared with you.</p>}
                {shared.link && (
                  <>
                    <p>Shared. Give this link to whoever you want to use it:</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-xs break-all rounded bg-white px-2 py-1">{shared.link}</code>
                      <button type="button" onClick={() => copy(shared.link!)} className="underline">{copied ? 'Copied' : 'Copy'}</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {mine.length > 0 && (
            <section aria-labelledby="mine-heading" className="space-y-2 text-sm text-slate-700">
              <h2 id="mine-heading" className="font-semibold text-slate-900">Models you&apos;ve shared</h2>
              <ul className="space-y-2">
                {mine.map((m) => (
                  <li key={m.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.title}</span>
                      <span className="text-xs text-slate-500">
                        {m.status === 'approved' ? `shared with ${VISIBILITY_TEXT[m.visibility].toLowerCase()}` : m.status === 'pending' ? 'not shared yet (a check didn’t pass, or the upload didn’t finish)' : m.status}
                      </span>
                      <button type="button" onClick={() => takeDown(m.id)} className="text-xs text-red-700 underline">Take it down</button>
                    </div>
                    {m.status === 'approved' && m.visibility === 'people' && m.people.length > 0 && (
                      <p className="text-xs text-slate-600">With {m.people.map((p) => p.name).join(', ')}</p>
                    )}
                    {m.status === 'approved' && m.linkKey && (
                      <p className="text-xs text-slate-600 break-all">Link: <code className="font-mono">{linkFor(origin, m.linkKey)}</code></p>
                    )}
                    {m.tags.length > 0 && <p className="text-xs text-slate-500">{m.tags.map(tagLabel).join(' · ')}</p>}
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
