'use client'

/**
 * "Use my own model": a small open model on this device, reached from this browser (lib/localModel.ts), either in
 * Ollama on this computer or inside this browser with nothing to install (lib/browserModel.ts, for phones and tablets
 * too). When it's on, making a plan sends every agent prompt to it instead of a cloud model (lib/deviceRun.ts); if it
 * isn't answering when they make a plan, they're asked before a cloud model is used (app/onboarding/page.tsx), never
 * switched silently. A model that can think first does so only on the plan itself, if the person allows it.
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
import { BROWSER_MODELS, browserModelInfo } from '@/lib/browserModel'
import { tunedModels, tunedLabel, type TunedModel } from '@/lib/tunedModels'
import { sharingStatus } from '@/lib/sharedModels'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Models to suggest for Ollama (`ollama pull <name>`).
const SUGGESTED = [
  { name: 'llama3.2:3b', note: 'about 2 GB' },
  { name: 'llama3.2:1b', note: 'about 1.3 GB, for older laptops' },
  { name: 'qwen3:4b', note: 'about 2.5 GB, thinks first' },
]

export default function OwnModel() {
  const [settings, setSettings] = useState<OwnModelSettings>(DEFAULT_OWN_MODEL)
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OWN_MODEL.baseUrl)
  const [model, setModel] = useState(DEFAULT_OWN_MODEL.model)
  const [ping, setPing] = useState<Ping | null>(null)
  const [checking, setChecking] = useState(false)
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'done' | 'failed'; text?: string; seconds?: number }>({ state: 'idle' })
  const [download, setDownload] = useState<{ state: 'idle' | 'running' | 'done' | 'failed'; fraction?: number; text?: string }>({ state: 'idle' })
  const [origin, setOrigin] = useState('this site')
  const [sharing, setSharing] = useState(false)
  // Models the person tuned in this browser (Build my training set), kept only here.
  const [tuned, setTuned] = useState<TunedModel[]>([])

  /** Saves the change and returns the settings with it. */
  const save = useCallback((next: Partial<OwnModelSettings>): OwnModelSettings => {
    const merged = { ...loadOwnModel(), ...next }
    saveOwnModel(merged)
    setSettings(merged)
    return merged
  }, [])

  const check = useCallback(async (current: OwnModelSettings) => {
    setChecking(true)
    const result = await pingOwnModel(current)
    setPing(result)
    // Remember whether this model can think first, for the plan.
    save({ thinks: result.ok && !!result.thinks })
    setChecking(false)
  }, [save])

  useEffect(() => {
    const loaded = loadOwnModel()
    setSettings(loaded)
    setBaseUrl(loaded.baseUrl)
    setModel(loaded.model)
    setOrigin(window.location.origin)
    setTuned(tunedModels())
    if (loaded.enabled) check(loaded)
    sharingStatus(API_URL).then((s) => setSharing(s.enabled)).catch(() => {})
  }, [check])

  const inBrowser = settings.runtime === 'browser'
  const urlOk = cleanBaseUrl(baseUrl) !== null
  const modelOk = cleanModelName(model) !== null
  const canAsk = inBrowser ? !!(ping?.ok && ping.hasModel) : urlOk && modelOk
  const thinks = inBrowser ? !!browserModelInfo(settings.browserModel)?.thinks : !!(ping?.ok && ping.thinks)

  const runTest = async () => {
    const current = inBrowser ? loadOwnModel() : save({ baseUrl: cleanBaseUrl(baseUrl) ?? settings.baseUrl, model: cleanModelName(model) ?? settings.model })
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

  const downloadModel = async () => {
    setDownload({ state: 'running', fraction: 0 })
    try {
      const browser = await import('@/lib/browserModel')
      await browser.loadBrowserModel(settings.browserModel, (fraction, text) => setDownload({ state: 'running', fraction, text }))
      setDownload({ state: 'done' })
      check(loadOwnModel())
    } catch (e: any) {
      setDownload({ state: 'failed', text: String(e?.message || e) })
    }
  }

  const forget = async () => {
    const browser = await import('@/lib/browserModel')
    await browser.forgetBrowserModel(settings.browserModel).catch(() => {})
    setDownload({ state: 'idle' })
    // A tuned model taken out is gone from the list: the first of ours takes its place.
    const left = tunedModels()
    setTuned(left)
    if (!browserModelInfo(settings.browserModel)) check(save({ browserModel: BROWSER_MODELS[0].id }))
    else check(loadOwnModel())
  }

  return (
    <section className="rounded-xl border border-slate-200 p-4 space-y-4" aria-labelledby="own-model-heading">
      <div className="space-y-1">
        <h2 id="own-model-heading" className="text-lg font-semibold text-slate-900">Use my own model</h2>
        <p className="text-sm text-slate-600">
          Make your plan with a small open model on your device: in{' '}
          <a className="underline" href="https://ollama.com" target="_blank" rel="noopener noreferrer">Ollama</a> on
          this computer, or inside this browser with nothing to install. It&apos;s smaller than the cloud models, so
          plans may be simpler, and it takes longer on a laptop.
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
            Your plan&apos;s prompts and the model&apos;s answers travel only between our server and your device: they
            are never sent to OpenAI, Google, Anthropic or any other AI company. Our server still builds each prompt
            from what you entered and saves your finished plan, as it does for everyone.
          </p>
          <p>If your model isn&apos;t answering when you make a plan, we&apos;ll ask you before using a cloud model instead.</p>
        </div>
      )}

      <fieldset className="space-y-1 text-sm text-slate-800">
        <legend className="font-medium">Where it runs</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="own-model-runtime" checked={!inBrowser} onChange={() => { setPing(null); check(save({ runtime: 'ollama' })) }} />
          Ollama on this computer (Mac, Windows or Linux)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="own-model-runtime" checked={inBrowser} onChange={() => { setPing(null); check(save({ runtime: 'browser' })) }} />
          In this browser, nothing to install (phones and tablets too)
        </label>
      </fieldset>

      {inBrowser ? (
        <div className="space-y-2 text-sm text-slate-700">
          <label className="block space-y-1">
            <span className="block font-medium">Model</span>
            <select
              value={settings.browserModel}
              onChange={(e) => { setDownload({ state: 'idle' }); check(save({ browserModel: e.target.value })) }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {tuned.map((m) => (
                <option key={m.id} value={m.id}>{tunedLabel(m)}: kept in this browser</option>
              ))}
              {BROWSER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}: {m.size}{m.phones ? ', for phones and tablets' : ''}</option>
              ))}
            </select>
          </label>
          <p className="text-slate-600">
            It&apos;s downloaded once from Hugging Face into this browser and runs on this device&apos;s graphics chip.
            Use Wi-Fi: it&apos;s large. A model you tune in{' '}
            <Link href="/settings/models/training-set" className="underline">Build my training set</Link> is kept here too, for
            you alone; models you tune on a laptop run in Ollama.
          </p>
        </div>
      ) : (
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
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={(!inBrowser && !urlOk) || checking}
          onClick={() => check(inBrowser ? loadOwnModel() : save({ baseUrl: cleanBaseUrl(baseUrl) as string, model: cleanModelName(model) ?? settings.model }))}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Check status'}
        </button>
        <button
          type="button"
          disabled={!canAsk || test.state === 'running'}
          onClick={runTest}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 disabled:opacity-50"
        >
          {test.state === 'running' ? 'Asking your model…' : 'Send a test prompt'}
        </button>
        {inBrowser && ping?.ok && !ping.hasModel && (
          <button type="button" disabled={download.state === 'running'} onClick={downloadModel}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {download.state === 'running' ? 'Downloading…' : 'Download the model'}
          </button>
        )}
        {inBrowser && ping?.ok && ping.hasModel && (
          <button type="button" onClick={forget} className="text-sm text-slate-600 underline">Remove it from this browser</button>
        )}
        {ping && (
          <span role="status" className={`text-sm ${ping.ok && ping.hasModel ? 'text-emerald-700' : 'text-amber-800'}`}>
            {pingMessage(ping, origin)}
          </span>
        )}
      </div>

      {download.state === 'running' && (
        <div className="space-y-1" aria-live="polite">
          <progress className="w-full" max={1} value={download.fraction ?? 0} aria-label="Download progress" />
          <p className="text-xs text-slate-600">{download.text}</p>
        </div>
      )}
      {download.state === 'failed' && <p className="text-sm text-red-700">{download.text}</p>}

      {!inBrowser && (
        <p className="text-xs text-slate-600">
          Suggested:{' '}
          {SUGGESTED.map((s, i) => (
            <span key={s.name}>
              {i > 0 && ' · '}
              <button type="button" className="font-mono underline" onClick={() => { setModel(s.name); check(save({ model: s.name })) }}>
                {s.name}
              </button>{' '}
              ({s.note})
            </span>
          ))}
        </p>
      )}

      {thinks && (
        <fieldset className="space-y-1 text-sm text-slate-800">
          <legend className="font-medium">This model can think before it answers</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="own-model-thinking" className="mt-1" checked={settings.thinking === 'main'} onChange={() => save({ thinking: 'main' })} />
            <span>Think first on the plan itself only. Slower: on a laptop, about 1 to 3 minutes more for each goal.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="own-model-thinking" className="mt-1" checked={settings.thinking === 'off'} onChange={() => save({ thinking: 'off' })} />
            <span>Don&apos;t think first. Fastest.</span>
          </label>
        </fieldset>
      )}

      {test.state === 'done' && (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
          <span className="block text-xs text-slate-500 mb-1">Your model answered in {test.seconds} s:</span>
          {test.text}
        </p>
      )}
      {test.state === 'failed' && <p className="text-sm text-red-700">{test.text}</p>}

      {!inBrowser && (
        <details className="text-sm text-slate-700">
          <summary className="cursor-pointer font-medium">How to set it up</summary>
          <ol className="mt-2 list-decimal pl-5 space-y-1">
            <li>Install Ollama from ollama.com and open it.</li>
            <li>In a terminal, download a small model: <code className="font-mono">ollama pull llama3.2:3b</code> (about 2 GB).</li>
            <li>
              Let this site talk to it, then quit and reopen Ollama.
              <ul className="list-disc pl-5 space-y-1">
                <li>Mac: <code className="font-mono">launchctl setenv OLLAMA_ORIGINS &quot;{origin}&quot;</code></li>
                <li>Windows (Command Prompt): <code className="font-mono">setx OLLAMA_ORIGINS &quot;{origin}&quot;</code></li>
                <li>
                  Linux: <code className="font-mono">sudo systemctl edit ollama.service</code>, add{' '}
                  <code className="font-mono">Environment=&quot;OLLAMA_ORIGINS={origin}&quot;</code> under [Service], then{' '}
                  <code className="font-mono">sudo systemctl restart ollama</code>
                </li>
              </ul>
            </li>
            <li>Press Check status above. Your browser may ask to let this site reach devices on your network; say yes.</li>
          </ol>
        </details>
      )}

      <div className="text-sm text-slate-600 space-y-1">
        <p className="font-medium text-slate-800">What uses it</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Making your plan: yes, every agent.</li>
          <li>
            Everything else that writes with AI: adding a goal later, step guidance, your journal and the plan changes it
            suggests, the assistant, the goal helper in setup, and setting up your agents on My agents. If your model isn’t ready, you’re asked before a cloud
            model is used, step guidance waits for it, and journal entries are saved without an AI reading them.
          </li>
          <li>
            Tuning it to your own writing:{' '}
            <Link href="/settings/models/training-set" className="underline">Build my training set</Link>, then train it on
            your computer.
          </li>
          {sharing ? (
            <li>
              Sharing it with your community: <Link href="/settings/models/share" className="underline">Share my model</Link>, or
              start from one someone shared in <Link href="/settings/models/community" className="underline">Community models</Link>.
            </li>
          ) : (
            <li>Sharing a tuned model with your community: switched off for now.</li>
          )}
        </ul>
      </div>
    </section>
  )
}
