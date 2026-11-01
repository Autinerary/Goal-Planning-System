'use client'

/**
 * "Use my own model": a small open model on this device (Ollama), reached from this browser (lib/localModel.ts).
 * When it's on, making a plan sends every agent prompt to the person's laptop instead of a cloud model
 * (lib/deviceRun.ts); if the laptop isn't answering when they make a plan, they're asked before a cloud model is
 * used (app/onboarding/page.tsx), never switched silently.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  DEFAULT_OWN_MODEL,
  OwnModelSettings,
  Ping,
  askOwnModel,
  cleanBaseUrl,
  cleanModelName,
  loadOwnModel,
  pingMessage,
  pingOwnModel,
  saveOwnModel,
} from '@/lib/localModel'

export default function OwnModel() {
  const [settings, setSettings] = useState<OwnModelSettings>(DEFAULT_OWN_MODEL)
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OWN_MODEL.baseUrl)
  const [model, setModel] = useState(DEFAULT_OWN_MODEL.model)
  const [ping, setPing] = useState<Ping | null>(null)
  const [checking, setChecking] = useState(false)
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'done' | 'failed'; text?: string; seconds?: number }>({ state: 'idle' })
  const [origin, setOrigin] = useState('this site')

  const check = useCallback(async (current: OwnModelSettings) => {
    setChecking(true)
    setPing(await pingOwnModel(current))
    setChecking(false)
  }, [])

  useEffect(() => {
    const loaded = loadOwnModel()
    setSettings(loaded)
    setBaseUrl(loaded.baseUrl)
    setModel(loaded.model)
    setOrigin(window.location.origin)
    if (loaded.enabled) check(loaded)
  }, [check])

  const urlOk = cleanBaseUrl(baseUrl) !== null
  const modelOk = cleanModelName(model) !== null

  const save = (next: Partial<OwnModelSettings>) => {
    const merged = { ...settings, ...next }
    setSettings(merged)
    saveOwnModel(merged)
    return merged
  }

  const runTest = async () => {
    const current = save({ baseUrl: cleanBaseUrl(baseUrl) ?? settings.baseUrl, model: cleanModelName(model) ?? settings.model })
    setTest({ state: 'running' })
    const started = performance.now()
    try {
      const text = await askOwnModel(current, {
        messages: [
          { role: 'system', content: 'You are a kind, plain-spoken planning assistant.' },
          { role: 'user', content: 'In one short sentence, suggest a first small step toward going for a walk every day.' },
        ],
        temperature: 0.4,
        max_tokens: 80,
      })
      setTest({ state: 'done', text: text.trim(), seconds: Math.round((performance.now() - started) / 100) / 10 })
    } catch (e: any) {
      setTest({ state: 'failed', text: String(e?.message || e) })
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 p-4 space-y-4" aria-labelledby="own-model-heading">
      <div className="space-y-1">
        <h2 id="own-model-heading" className="text-lg font-semibold text-slate-900">Use my own model</h2>
        <p className="text-sm text-slate-600">
          Make your plan with a small open model on your device, using{' '}
          <a className="underline" href="https://ollama.com" target="_blank" rel="noopener noreferrer">Ollama</a>.
          It&apos;s smaller than the cloud models, so plans may be simpler, and it takes longer on a laptop.
        </p>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={settings.enabled}
          onChange={(e) => {
            const next = save({ enabled: e.target.checked })
            if (next.enabled) check(next)
          }}
        />
        <span className="text-sm text-slate-900">Make my plans with the small open model on my device</span>
      </label>

      {settings.enabled && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 space-y-1">
          <p className="font-medium">While this is on, the AI that writes your plan runs on your device.</p>
          <p>
            Your plan&apos;s prompts and the model&apos;s answers travel only between our server and your laptop: they
            are never sent to OpenAI, Google, Anthropic or any other AI company. Our server still builds each prompt
            from what you entered and saves your finished plan, as it does for everyone.
          </p>
          <p>If your model isn&apos;t answering when you make a plan, we&apos;ll ask you before using a cloud model instead.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-700 space-y-1">
          <span className="block font-medium">Address</span>
          <input
            className={`w-full rounded-lg border px-3 py-2 font-mono text-sm ${urlOk ? 'border-slate-200' : 'border-red-400'}`}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            onBlur={() => urlOk && save({ baseUrl: cleanBaseUrl(baseUrl) as string })}
            aria-invalid={!urlOk}
          />
          {!urlOk && <span className="block text-xs text-red-700">Must be on this computer, for example http://localhost:11434/v1</span>}
        </label>
        <label className="text-sm text-slate-700 space-y-1">
          <span className="block font-medium">Model name</span>
          <input
            className={`w-full rounded-lg border px-3 py-2 font-mono text-sm ${modelOk ? 'border-slate-200' : 'border-red-400'}`}
            value={model}
            list="own-model-names"
            onChange={(e) => setModel(e.target.value)}
            onBlur={() => modelOk && save({ model: cleanModelName(model) as string })}
            aria-invalid={!modelOk}
          />
          <datalist id="own-model-names">
            {ping?.ok && ping.models.map((m) => <option key={m} value={m} />)}
          </datalist>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!urlOk || checking}
          onClick={() => check(save({ baseUrl: cleanBaseUrl(baseUrl) as string, model: cleanModelName(model) ?? settings.model }))}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Check status'}
        </button>
        <button
          type="button"
          disabled={!urlOk || !modelOk || test.state === 'running'}
          onClick={runTest}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50"
        >
          {test.state === 'running' ? 'Asking your model…' : 'Send a test prompt'}
        </button>
        {ping && (
          <span role="status" className={`text-sm ${ping.ok && ping.hasModel ? 'text-emerald-700' : 'text-amber-800'}`}>
            {pingMessage(ping, origin)}
          </span>
        )}
      </div>

      {test.state === 'done' && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
          <span className="block text-xs text-slate-500 mb-1">Your model answered in {test.seconds} s:</span>
          {test.text}
        </p>
      )}
      {test.state === 'failed' && <p className="text-sm text-red-700">{test.text}</p>}

      <details className="text-sm text-slate-700">
        <summary className="cursor-pointer font-medium">How to set it up</summary>
        <ol className="mt-2 list-decimal pl-5 space-y-1">
          <li>Install Ollama from ollama.com and open it.</li>
          <li>In a terminal, download a small model: <code className="font-mono">ollama pull llama3.2:3b</code> (about 2 GB).</li>
          <li>
            Let this site talk to it. On a Mac: <code className="font-mono">launchctl setenv OLLAMA_ORIGINS &quot;{origin}&quot;</code>,
            then quit and reopen Ollama. On Linux: <code className="font-mono">OLLAMA_ORIGINS=&quot;{origin}&quot; ollama serve</code>.
          </li>
          <li>Press Check status above. Your browser may ask to let this site reach devices on your network; say yes.</li>
        </ol>
      </details>

      <div className="text-sm text-slate-600 space-y-1">
        <p className="font-medium text-slate-800">What uses it</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Making your plan: yes, every agent.</li>
          <li>
            Adding a goal later, step guidance, plan changes, the assistant and journal insights: your cloud model for
            now. <span className="text-slate-500">Coming soon.</span>
          </li>
          <li>
            Tuning it to your own writing:{' '}
            <Link href="/settings/models/training-set" className="underline">Build my training set</Link>, then train it on
            your laptop.
          </li>
          <li>Sharing a tuned model with your community. <span className="text-slate-500">Coming soon.</span></li>
        </ul>
      </div>
    </section>
  )
}
