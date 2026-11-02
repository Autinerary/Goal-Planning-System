'use client'

/**
 * "Ask my agents" on a step's page: one of the person's own agents (app/agents, lib/agents.ts) looks at the step and
 * may offer it in other words, which they can use with one press (app/api/me/path/step, so "Use the original" puts the
 * planner's back). Nothing is changed until they press it.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Agent, PersonData, STEP_REVIEW, StepReview, contextFor, loadAgents, readStepReview } from '@/lib/agents'
import { runnerFor, whereItRuns } from '../agents/run'

type Props = {
  step: { id: string; name: string; description: string; goal?: string }
  data: PersonData
  onUsed: (step: { name: string; description: string; edited: boolean }) => void
}

export default function AskMyAgents({ step, data, onUsed }: Props) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentId, setAgentId] = useState('')
  const [where, setWhere] = useState<{ ready: boolean; words: string } | null>(null)
  const [review, setReview] = useState<StepReview | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const agent = agents.find((a) => a.id === agentId) ?? null

  useEffect(() => {
    const mine = loadAgents()
    setAgents(mine)
    setAgentId(mine[0]?.id ?? '')
  }, [])

  useEffect(() => {
    setReview(null)
    setWhere(null)
    if (agent) whereItRuns(agent).then(setWhere).catch(() => setWhere({ ready: false, words: 'Couldn’t check where it runs.' }))
  }, [agent])

  if (agents.length === 0) {
    return (
      <p className="mt-3 text-sm text-slate-600">
        <Link href="/agents" className="text-cyan-700 underline underline-offset-2">Build an agent</Link> to look at your steps your way.
      </p>
    )
  }

  const ask = async () => {
    if (!agent) return
    setBusy('asking')
    setError(null)
    setReview(null)
    try {
      // The step itself always goes in the question; the rest only as far as the agent may see.
      const answer = await runnerFor(agent, contextFor(agent, data, step))([{ role: 'user', content: STEP_REVIEW(step) }], { json: true, maxTokens: 500 })
      setReview(readStepReview(answer))
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(null)
    }
  }

  const use = async () => {
    if (!review?.rewrite) return
    setBusy('saving')
    setError(null)
    try {
      const res = await fetch('/api/me/path/step', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId: step.id, name: review.rewrite.name, description: review.rewrite.description }),
      })
      const out = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(out?.error || 'That didn’t save. Please try again.')
      onUsed({ name: out.name, description: out.description, edited: !!out.edited })
      setReview(null)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Ask my agents" className="mt-4 rounded-xl border border-slate-200 p-4 space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="ask-agent" className="font-medium text-slate-800">Ask my agent</label>
        <select id="ask-agent" value={agentId} onChange={(e) => setAgentId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1">
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button type="button" onClick={ask} disabled={!agent || !!busy || where?.ready === false}
          className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white disabled:opacity-50">
          {busy === 'asking' ? `${agent?.name} is looking…` : 'Look at this step'}
        </button>
      </div>
      {where && <p role="status" className={`text-xs ${where.ready ? 'text-slate-500' : 'text-amber-800'}`}>{where.words}</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {review && (
        <div className="rounded-lg bg-indigo-50 p-3 space-y-2" aria-live="polite">
          <p className="text-xs text-slate-500">{agent?.name} (AI) says:</p>
          {review.note && <p className="text-slate-900 whitespace-pre-wrap">{review.note}</p>}
          {review.rewrite ? (
            <div className="space-y-2">
              <p className="text-slate-700">In other words:</p>
              <p className="font-medium text-slate-900">{review.rewrite.name}</p>
              {review.rewrite.description && <p className="text-slate-700">{review.rewrite.description}</p>}
              <button type="button" onClick={use} disabled={!!busy} className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white disabled:opacity-50">
                {busy === 'saving' ? 'Saving…' : 'Use these words'}
              </button>
              <span className="block text-xs text-slate-500">They replace this step everywhere in your plan; “Use the original” puts it back.</span>
            </div>
          ) : (
            <p className="text-slate-600">It didn’t suggest new words for this step.</p>
          )}
        </div>
      )}
    </section>
  )
}
