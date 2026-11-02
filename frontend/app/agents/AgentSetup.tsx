'use client'

/**
 * "Tell Autinerary what you need": they say it their way, and their agents are set up for it (lib/agentSetup.ts):
 * what each of the six built-in agents will do for them, and a 7th drafted for the rest, which My agents opens in
 * Build an agent to check before it's saved. On their own model when "Use my own model" is on (lib/ownModelRoute.ts).
 */
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MAX_ASK, SetupResult } from '@/lib/agentSetup'
import { saidByServer, withOwnModel, wordsFor } from '@/lib/ownModelRoute'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const UNAVAILABLE = 'Setting up your agents isn’t available right now. You can still build one yourself below.'

type Crisis = { message: string; lines: { name: string; how: string }[]; after: string }

export default function AgentSetup({ onResult }: { onResult: (asked: string, result: SetupResult) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [crisis, setCrisis] = useState<Crisis | null>(null)

  const ask = async () => {
    const asked = text.trim()
    if (!asked || busy) return
    setBusy(true)
    setMessage(null)
    setCrisis(null)
    try {
      const body = { text: asked }
      const json: any = await withOwnModel('agent-setup', body, async () => {
        const { data: { session } } = await createClient().auth.getSession()
        const res = await fetch(`${API_URL}/api/onboarding/agent-setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
        })
        const out = await res.json().catch(() => null)
        if (!res.ok) throw saidByServer(res.status === 429 && typeof out?.detail === 'string' ? out.detail : UNAVAILABLE)
        return out
      }, { ask: true })
      if (json?.crisis) setCrisis(json.crisis)
      else if (typeof json?.message === 'string') setMessage(json.message)
      else if (json?.available === false) setMessage(UNAVAILABLE)
      else onResult(asked, { goal: json?.goal ?? null, forYou: json?.forYou ?? {}, seventh: json?.seventh ?? null })
    } catch (e) {
      setMessage(wordsFor(e, UNAVAILABLE))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="ask-heading" className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
      <div className="space-y-1">
        <h2 id="ask-heading" className="text-lg font-semibold text-slate-900">Tell Autinerary what you need</h2>
        <p className="text-sm text-slate-700">
          Say it your way: your goal, what gets in the way, and how you like to be helped. The six built-in agents are set
          up for it, and a 7th is written for the rest, for you to check before it&apos;s saved.
        </p>
      </div>
      <label className="block">
        <span className="sr-only">What you need</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_ASK} rows={4} data-agent-ask
          placeholder="For example: I need to finish my college diploma. I’m autistic and have ADHD. I need small steps, quiet places to study, and a week that fits my energy."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={ask} disabled={!text.trim() || busy}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">
          {busy ? 'Setting up your agents…' : 'Set up my agents'}
        </button>
        <span className="text-xs text-slate-500">{text.length} of {MAX_ASK} characters. Written with AI. What you type isn’t stored.</span>
      </div>
      {busy && <p role="status" className="text-sm text-slate-600">Setting up your agents…</p>}
      {message && <p role="alert" className="text-sm text-slate-800">{message}</p>}
      {crisis && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 space-y-2">
          <p>{crisis.message}</p>
          <ul className="list-disc pl-5">{crisis.lines.map((l) => <li key={l.name}><span className="font-medium">{l.name}</span>: {l.how}</li>)}</ul>
          <p>{crisis.after}</p>
        </div>
      )}
    </section>
  )
}
